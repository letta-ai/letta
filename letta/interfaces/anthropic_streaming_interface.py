import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from anthropic import AsyncStream
from anthropic.types.beta import (
    BetaInputJSONDelta,
    BetaRawContentBlockDeltaEvent,
    BetaRawContentBlockStartEvent,
    BetaRawContentBlockStopEvent,
    BetaRawMessageDeltaEvent,
    BetaRawMessageStartEvent,
    BetaRawMessageStopEvent,
    BetaRawMessageStreamEvent,
    BetaRedactedThinkingBlock,
    BetaSignatureDelta,
    BetaTextBlock,
    BetaTextDelta,
    BetaThinkingBlock,
    BetaThinkingDelta,
    BetaToolUseBlock,
)

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.schemas.letta_message import (
    ApprovalRequestMessage,
    AssistantMessage,
    HiddenReasoningMessage,
    LettaMessage,
    ReasoningMessage,
    ToolCallDelta,
    ToolCallMessage,
)
from letta.schemas.letta_message_content import ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall
from letta.server.rest_api.json_parser import JSONParser, PydanticJSONParser

logger = get_logger(__name__)


# TODO: These modes aren't used right now - but can be useful we do multiple sequential tool calling within one Claude message
class EventMode(Enum):
    TEXT = "TEXT"
    TOOL_USE = "TOOL_USE"
    THINKING = "THINKING"
    REDACTED_THINKING = "REDACTED_THINKING"


class AnthropicStreamingInterface:
    """
    Encapsulates the logic for streaming responses from Anthropic.
    This class handles parsing of partial tokens, pre-execution messages,
    and detection of tool call events.
    """

    def __init__(
        self,
        use_assistant_message: bool = False,
        put_inner_thoughts_in_kwarg: bool = False,
        requires_approval_tools: list = [],
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.json_parser: JSONParser = PydanticJSONParser()
        self.use_assistant_message = use_assistant_message
        self.run_id = run_id
        self.step_id = step_id

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()

        self.anthropic_mode = None
        self.message_id = None
        self.accumulated_inner_thoughts = []
        self.tool_call_id = None
        self.tool_call_name = None
        # Accumulate tool-call args as parts to avoid O(n^2)
        self._accumulated_tool_call_args_parts: list[str] = []
        self.previous_parse = {}

        # usage trackers
        self.input_tokens = 0
        self.output_tokens = 0
        self.model = None

        # reasoning object trackers
        self.reasoning_messages = []

        # Buffer to hold tool call messages until inner thoughts are complete
        self.tool_call_buffer = []
        self.inner_thoughts_complete = False
        self.put_inner_thoughts_in_kwarg = put_inner_thoughts_in_kwarg

        # Buffer to handle partial XML tags across chunks
        self.partial_tag_buffer = ""

        self.requires_approval_tools = requires_approval_tools

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        if not self.tool_call_name:
            raise ValueError("No tool call returned")
        # hack for tool rules
        try:
            args_str = "".join(self._accumulated_tool_call_args_parts)
            tool_input = json.loads(args_str)
        except json.JSONDecodeError as e:
            # Attempt to use OptimisticJSONParser to handle incomplete/malformed JSON
            try:
                tool_input = self.json_parser.parse(args_str)
            except:
                logger.warning(
                    f"Failed to decode tool call arguments for tool_call_id={self.tool_call_id}, "
                    f"name={self.tool_call_name}. Raw input: {args_str!r}. Error: {e}"
                )
                raise e
        if "id" in tool_input and tool_input["id"].startswith("toolu_") and "function" in tool_input:
            arguments = str(json.dumps(tool_input["function"]["arguments"], indent=2))
        else:
            arguments = str(json.dumps(tool_input, indent=2))
        return ToolCall(id=self.tool_call_id, function=FunctionCall(arguments=arguments, name=self.tool_call_name))

    def _check_inner_thoughts_complete(self, combined_args: str) -> bool:
        """
        Check if inner thoughts are complete in the current tool call arguments
        by looking for a closing quote after the inner_thoughts field
        """
        try:
            if not self.put_inner_thoughts_in_kwarg:
                # None of the things should have inner thoughts in kwargs
                return True
            else:
                parsed = self.json_parser.parse(combined_args)
                # TODO: This will break on tools with 0 input
                return len(parsed.keys()) > 1 and INNER_THOUGHTS_KWARG in parsed.keys()
        except Exception as e:
            logger.error("Error checking inner thoughts: %s", e)
            raise

    def get_reasoning_content(self) -> list[TextContent | ReasoningContent | RedactedReasoningContent]:
        def _process_group(
            group: list[ReasoningMessage | HiddenReasoningMessage], group_type: str
        ) -> TextContent | ReasoningContent | RedactedReasoningContent:
            if group_type == "reasoning":
                reasoning_text = "".join(chunk.reasoning for chunk in group).strip()
                is_native = any(chunk.source == "reasoner_model" for chunk in group)
                signature = next((chunk.signature for chunk in group if chunk.signature is not None), None)
                if is_native:
                    return ReasoningContent(is_native=is_native, reasoning=reasoning_text, signature=signature)
                else:
                    return TextContent(text=reasoning_text)
            elif group_type == "redacted":
                redacted_text = "".join(chunk.hidden_reasoning for chunk in group if chunk.hidden_reasoning is not None)
                return RedactedReasoningContent(data=redacted_text)
            else:
                raise ValueError("Unexpected group type")

        merged = []
        current_group = []
        current_group_type = None  # "reasoning" or "redacted"

        for msg in self.reasoning_messages:
            # Determine the type of the current message
            if isinstance(msg, HiddenReasoningMessage):
                msg_type = "redacted"
            elif isinstance(msg, ReasoningMessage):
                msg_type = "reasoning"
            else:
                raise ValueError("Unexpected message type")

            # Initialize group type if not set
            if current_group_type is None:
                current_group_type = msg_type

            # If the type changes, process the current group
            if msg_type != current_group_type:
                merged.append(_process_group(current_group, current_group_type))
                current_group = []
                current_group_type = msg_type

            current_group.append(msg)

        # Process the final group, if any.
        if current_group:
            merged.append(_process_group(current_group, current_group_type))

        # Strip out XML from any text content fields
        for content in merged:
            if isinstance(content, TextContent) and content.text.endswith("</thinking>"):
                cutoff = len(content.text) - len("</thinking>")
                content.text = content.text[:cutoff]

        return merged

    async def process(
        self,
        stream: AsyncStream[BetaRawMessageStreamEvent],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        prev_message_type = None
        message_index = 0
        event = None
        try:
            async with stream:
                async for event in stream:
                    try:
                        async for message in self._process_event(event, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            yield message
                    except asyncio.CancelledError as e:
                        import traceback

                        logger.info("Cancelled stream attempt but overriding %s: %s", e, traceback.format_exc())
                        async for message in self._process_event(event, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            yield message

                        # Don't raise the exception here
                        continue

        except Exception as e:
            import traceback

            logger.exception("Error processing stream: %s", e)
            if ttft_span:
                ttft_span.add_event(
                    name="stop_reason",
                    attributes={"stop_reason": StopReasonType.error.value, "error": str(e), "stacktrace": traceback.format_exc()},
                )
            yield LettaStopReason(stop_reason=StopReasonType.error)
            raise e
        finally:
            logger.info("AnthropicStreamingInterface: Stream processing complete.")

    async def _process_event(
        self,
        event: BetaRawMessageStreamEvent,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """Process a single event from the Anthropic stream and yield any resulting messages.

        Args:
            event: The event to process

        Yields:
            Messages generated from processing this event
        """
        if isinstance(event, BetaRawContentBlockStartEvent):
            content = event.content_block

            if isinstance(content, BetaTextBlock):
                self.anthropic_mode = EventMode.TEXT
                # TODO: Can capture citations, etc.
            elif isinstance(content, BetaToolUseBlock):
                self.anthropic_mode = EventMode.TOOL_USE
                self.tool_call_id = content.id
                self.tool_call_name = content.name
                self.inner_thoughts_complete = False

                if not self.use_assistant_message:
                    # Only buffer the initial tool call message if it doesn't require approval
                    # For approval-required tools, we'll create the ApprovalRequestMessage later
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    if self.tool_call_name not in self.requires_approval_tools:
                        tool_call_delta = ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id)
                        tool_call_msg = ToolCallMessage(
                            id=self.letta_message_id,
                            tool_call=tool_call_delta,
                            tool_calls=tool_call_delta,
                            date=datetime.now(timezone.utc).isoformat(),
                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                            run_id=self.run_id,
                        )
                        self.tool_call_buffer.append(tool_call_msg)
            elif isinstance(content, BetaThinkingBlock):
                self.anthropic_mode = EventMode.THINKING
                # TODO: Can capture signature, etc.
            elif isinstance(content, BetaRedactedThinkingBlock):
                self.anthropic_mode = EventMode.REDACTED_THINKING
                if prev_message_type and prev_message_type != "hidden_reasoning_message":
                    message_index += 1
                hidden_reasoning_message = HiddenReasoningMessage(
                    id=self.letta_message_id,
                    state="redacted",
                    hidden_reasoning=content.data,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(hidden_reasoning_message)
                prev_message_type = hidden_reasoning_message.message_type
                yield hidden_reasoning_message

        elif isinstance(event, BetaRawContentBlockDeltaEvent):
            delta = event.delta

            if isinstance(delta, BetaTextDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.TEXT:
                    raise RuntimeError(f"Streaming integrity failed - received BetaTextDelta object while not in TEXT EventMode: {delta}")

                # Weird bug happens with native thinking where a single response can contain:
                # [reasoning, text, tool_call]
                # In these cases, we should pipe text out to null / ignore it
                # TODO this will have to be redone to support non-tool calling message sending
                if not self.put_inner_thoughts_in_kwarg:
                    return

                # Combine buffer with current text to handle tags split across chunks
                combined_text = self.partial_tag_buffer + delta.text

                # Remove all occurrences of </thinking> tag
                cleaned_text = combined_text.replace("</thinking>", "")

                # Extract just the new content (without the buffer part)
                if len(self.partial_tag_buffer) <= len(cleaned_text):
                    delta.text = cleaned_text[len(self.partial_tag_buffer) :]
                else:
                    # Edge case: the tag was removed and now the text is shorter than the buffer
                    delta.text = ""

                # Store the last 10 characters (or all if less than 10) for the next chunk
                # This is enough to catch "</thinking" which is 10 characters
                self.partial_tag_buffer = combined_text[-10:] if len(combined_text) > 10 else combined_text
                self.accumulated_inner_thoughts.append(delta.text)

                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                reasoning_message = ReasoningMessage(
                    id=self.letta_message_id,
                    reasoning=self.accumulated_inner_thoughts[-1],
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(reasoning_message)
                prev_message_type = reasoning_message.message_type
                yield reasoning_message

            elif isinstance(delta, BetaInputJSONDelta):
                if not self.anthropic_mode == EventMode.TOOL_USE:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaInputJSONDelta object while not in TOOL_USE EventMode: {delta}"
                    )

                if delta.partial_json:
                    self._accumulated_tool_call_args_parts.append(delta.partial_json)
                current_parsed = self.json_parser.parse("".join(self._accumulated_tool_call_args_parts))

                # Start detecting a difference in inner thoughts
                previous_inner_thoughts = self.previous_parse.get(INNER_THOUGHTS_KWARG, "")
                current_inner_thoughts = current_parsed.get(INNER_THOUGHTS_KWARG, "")
                inner_thoughts_diff = current_inner_thoughts[len(previous_inner_thoughts) :]

                if inner_thoughts_diff:
                    if prev_message_type and prev_message_type != "reasoning_message":
                        message_index += 1
                    reasoning_message = ReasoningMessage(
                        id=self.letta_message_id,
                        reasoning=inner_thoughts_diff,
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    self.reasoning_messages.append(reasoning_message)
                    prev_message_type = reasoning_message.message_type
                    yield reasoning_message

                # Check if inner thoughts are complete - if so, flush the buffer or create approval message
                if not self.inner_thoughts_complete and self._check_inner_thoughts_complete(
                    "".join(self._accumulated_tool_call_args_parts)
                ):
                    self.inner_thoughts_complete = True

                    # Check if this tool requires approval
                    if self.tool_call_name in self.requires_approval_tools:
                        # Create ApprovalRequestMessage directly (buffer should be empty)
                        if prev_message_type and prev_message_type != "approval_request_message":
                            message_index += 1

                        # Strip out inner thoughts from arguments
                        tool_call_args = "".join(self._accumulated_tool_call_args_parts)
                        if current_inner_thoughts:
                            tool_call_args = tool_call_args.replace(f'"{INNER_THOUGHTS_KWARG}": "{current_inner_thoughts}"', "")

                        approval_msg = ApprovalRequestMessage(
                            id=self.letta_message_id,
                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                            date=datetime.now(timezone.utc).isoformat(),
                            name=self.tool_call_name,
                            tool_call=ToolCallDelta(
                                name=self.tool_call_name,
                                tool_call_id=self.tool_call_id,
                                arguments=tool_call_args,
                            ),
                            run_id=self.run_id,
                        )
                        prev_message_type = approval_msg.message_type
                        yield approval_msg
                    elif len(self.tool_call_buffer) > 0:
                        # Flush buffered tool call messages for non-approval tools
                        if prev_message_type and prev_message_type != "tool_call_message":
                            message_index += 1

                        # Strip out the inner thoughts from the buffered tool call arguments before streaming
                        parts = [
                            buffered_msg.tool_call.arguments for buffered_msg in self.tool_call_buffer if buffered_msg.tool_call.arguments
                        ]
                        tool_call_args = "".join(parts)
                        tool_call_args = tool_call_args.replace(f'"{INNER_THOUGHTS_KWARG}": "{current_inner_thoughts}"', "")

                        tool_call_delta = ToolCallDelta(
                            name=self.tool_call_name,
                            tool_call_id=self.tool_call_id,
                            arguments=tool_call_args,
                        )
                        tool_call_msg = ToolCallMessage(
                            id=self.tool_call_buffer[0].id,
                            otid=Message.generate_otid_from_id(self.tool_call_buffer[0].id, message_index),
                            date=self.tool_call_buffer[0].date,
                            tool_call=tool_call_delta,
                            tool_calls=tool_call_delta,
                            run_id=self.run_id,
                        )
                        prev_message_type = tool_call_msg.message_type
                        yield tool_call_msg
                        self.tool_call_buffer = []

                # Start detecting special case of "send_message"
                if self.tool_call_name == DEFAULT_MESSAGE_TOOL and self.use_assistant_message:
                    previous_send_message = self.previous_parse.get(DEFAULT_MESSAGE_TOOL_KWARG, "")
                    current_send_message = current_parsed.get(DEFAULT_MESSAGE_TOOL_KWARG, "")
                    send_message_diff = current_send_message[len(previous_send_message) :]

                    # Only stream out if it's not an empty string
                    if send_message_diff:
                        if prev_message_type and prev_message_type != "assistant_message":
                            message_index += 1
                        assistant_msg = AssistantMessage(
                            id=self.letta_message_id,
                            content=send_message_diff,
                            date=datetime.now(timezone.utc).isoformat(),
                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                            run_id=self.run_id,
                        )
                        prev_message_type = assistant_msg.message_type
                        yield assistant_msg
                else:
                    # Otherwise, it is a normal tool call - buffer or yield based on inner thoughts status
                    if self.tool_call_name in self.requires_approval_tools:
                        tool_call_msg = ApprovalRequestMessage(
                            id=self.letta_message_id,
                            tool_call=ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id, arguments=delta.partial_json),
                            date=datetime.now(timezone.utc).isoformat(),
                            run_id=self.run_id,
                        )
                    else:
                        tool_call_delta = ToolCallDelta(
                            name=self.tool_call_name, tool_call_id=self.tool_call_id, arguments=delta.partial_json
                        )
                        tool_call_msg = ToolCallMessage(
                            id=self.letta_message_id,
                            tool_call=tool_call_delta,
                            tool_calls=tool_call_delta,
                            date=datetime.now(timezone.utc).isoformat(),
                            run_id=self.run_id,
                        )
                    if self.inner_thoughts_complete:
                        if prev_message_type and prev_message_type != "tool_call_message":
                            message_index += 1
                        tool_call_msg.otid = Message.generate_otid_from_id(self.letta_message_id, message_index)
                        prev_message_type = tool_call_msg.message_type
                        yield tool_call_msg
                    else:
                        self.tool_call_buffer.append(tool_call_msg)

                # Set previous parse
                self.previous_parse = current_parsed
            elif isinstance(delta, BetaThinkingDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.THINKING:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaThinkingBlock object while not in THINKING EventMode: {delta}"
                    )

                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                reasoning_message = ReasoningMessage(
                    id=self.letta_message_id,
                    source="reasoner_model",
                    reasoning=delta.thinking,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(reasoning_message)
                prev_message_type = reasoning_message.message_type
                yield reasoning_message
            elif isinstance(delta, BetaSignatureDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.THINKING:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaSignatureDelta object while not in THINKING EventMode: {delta}"
                    )

                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                reasoning_message = ReasoningMessage(
                    id=self.letta_message_id,
                    source="reasoner_model",
                    reasoning="",
                    date=datetime.now(timezone.utc).isoformat(),
                    signature=delta.signature,
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(reasoning_message)
                prev_message_type = reasoning_message.message_type
                yield reasoning_message
        elif isinstance(event, BetaRawMessageStartEvent):
            self.message_id = event.message.id
            self.input_tokens += event.message.usage.input_tokens
            self.output_tokens += event.message.usage.output_tokens
            self.model = event.message.model
        elif isinstance(event, BetaRawMessageDeltaEvent):
            self.output_tokens += event.usage.output_tokens
        elif isinstance(event, BetaRawMessageStopEvent):
            # Don't do anything here! We don't want to stop the stream.
            pass
        elif isinstance(event, BetaRawContentBlockStopEvent):
            # If we're exiting a tool use block and there are still buffered messages,
            # we should flush them now
            if self.anthropic_mode == EventMode.TOOL_USE and self.tool_call_buffer:
                for buffered_msg in self.tool_call_buffer:
                    yield buffered_msg
                self.tool_call_buffer = []

            self.anthropic_mode = None


class SimpleAnthropicStreamingInterface:
    """
    A simpler version of AnthropicStreamingInterface that doesn't handle send_message parsing on inner_thoughts_in_kwargs
    """

    def __init__(
        self,
        requires_approval_tools: list = [],
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.json_parser: JSONParser = PydanticJSONParser()
        self.run_id = run_id
        self.step_id = step_id

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()

        self.anthropic_mode = None
        self.message_id = None
        self.accumulated_inner_thoughts = []
        self.tool_call_id = None
        self.tool_call_name = None
        self._accumulated_tool_call_args_parts: list[str] = []
        self.previous_parse = {}

        # usage trackers
        self.input_tokens = 0
        self.output_tokens = 0
        self.model = None

        # reasoning object trackers
        self.reasoning_messages = []

        # assistant object trackers
        self.assistant_messages: list[AssistantMessage] = []

        # Buffer to hold tool call messages until inner thoughts are complete
        self.tool_call_buffer = []
        self.inner_thoughts_complete = False

        # Buffer to handle partial XML tags across chunks
        self.partial_tag_buffer = ""

        self.requires_approval_tools = requires_approval_tools

    def get_tool_call_object(self) -> Optional[ToolCall]:
        """Useful for agent loop"""
        if not self.tool_call_name:
            return None

        # hack for tool rules
        try:
            args_str = "".join(self._accumulated_tool_call_args_parts)
            tool_input = json.loads(args_str)
        except json.JSONDecodeError as e:
            # Attempt to use OptimisticJSONParser to handle incomplete/malformed JSON
            try:
                tool_input = self.json_parser.parse(args_str)
            except:
                logger.warning(
                    f"Failed to decode tool call arguments for tool_call_id={self.tool_call_id}, "
                    f"name={self.tool_call_name}. Raw input: {args_str!r}. Error: {e}"
                )
                raise e
        if "id" in tool_input and tool_input["id"].startswith("toolu_") and "function" in tool_input:
            arguments = str(json.dumps(tool_input["function"]["arguments"], indent=2))
        else:
            arguments = str(json.dumps(tool_input, indent=2))
        return ToolCall(id=self.tool_call_id, function=FunctionCall(arguments=arguments, name=self.tool_call_name))

    def get_reasoning_content(self) -> list[TextContent | ReasoningContent | RedactedReasoningContent]:
        def _process_group(
            group: list[ReasoningMessage | HiddenReasoningMessage | AssistantMessage],
            group_type: str,
        ) -> TextContent | ReasoningContent | RedactedReasoningContent:
            if group_type == "reasoning":
                reasoning_text = "".join(chunk.reasoning for chunk in group).strip()
                is_native = any(chunk.source == "reasoner_model" for chunk in group)
                signature = next((chunk.signature for chunk in group if chunk.signature is not None), None)
                if is_native:
                    return ReasoningContent(is_native=is_native, reasoning=reasoning_text, signature=signature)
                else:
                    return TextContent(text=reasoning_text)
            elif group_type == "redacted":
                redacted_text = "".join(chunk.hidden_reasoning for chunk in group if chunk.hidden_reasoning is not None)
                return RedactedReasoningContent(data=redacted_text)
            elif group_type == "text":
                parts: list[str] = []
                for chunk in group:
                    if isinstance(chunk.content, list):
                        parts.append("".join([c.text for c in chunk.content]))
                    else:
                        parts.append(chunk.content)
                return TextContent(text="".join(parts))
            else:
                raise ValueError("Unexpected group type")

        merged = []
        current_group = []
        current_group_type = None  # "reasoning" or "redacted"

        for msg in self.reasoning_messages:
            # Determine the type of the current message
            if isinstance(msg, HiddenReasoningMessage):
                msg_type = "redacted"
            elif isinstance(msg, ReasoningMessage):
                msg_type = "reasoning"
            elif isinstance(msg, AssistantMessage):
                msg_type = "text"
            else:
                raise ValueError("Unexpected message type")

            # Initialize group type if not set
            if current_group_type is None:
                current_group_type = msg_type

            # If the type changes, process the current group
            if msg_type != current_group_type:
                merged.append(_process_group(current_group, current_group_type))
                current_group = []
                current_group_type = msg_type

            current_group.append(msg)

        # Process the final group, if any.
        if current_group:
            merged.append(_process_group(current_group, current_group_type))

        return merged

    def get_content(self) -> list[TextContent | ReasoningContent | RedactedReasoningContent]:
        return self.get_reasoning_content()
        # concat = ""
        # for msg in self.assistant_messages:
        #     if isinstance(msg.content, list):
        #         concat += "".join([c.text for c in msg.content])
        #     else:
        #         concat += msg.content
        # return [TextContent(text=concat)]

    async def process(
        self,
        stream: AsyncStream[BetaRawMessageStreamEvent],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        prev_message_type = None
        message_index = 0
        event = None
        try:
            async with stream:
                async for event in stream:
                    try:
                        async for message in self._process_event(event, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            # print(f"Yielding message: {message}")
                            yield message
                    except asyncio.CancelledError as e:
                        import traceback

                        logger.info("Cancelled stream attempt but overriding %s: %s", e, traceback.format_exc())
                        async for message in self._process_event(event, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            yield message

                        # Don't raise the exception here
                        continue

        except Exception as e:
            import traceback

            logger.exception("Error processing stream: %s", e)
            if ttft_span:
                ttft_span.add_event(
                    name="stop_reason",
                    attributes={"stop_reason": StopReasonType.error.value, "error": str(e), "stacktrace": traceback.format_exc()},
                )
            yield LettaStopReason(stop_reason=StopReasonType.error)
            raise e
        finally:
            logger.info("AnthropicStreamingInterface: Stream processing complete.")

    async def _process_event(
        self,
        event: BetaRawMessageStreamEvent,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """Process a single event from the Anthropic stream and yield any resulting messages.

        Args:
            event: The event to process

        Yields:
            Messages generated from processing this event
        """
        if isinstance(event, BetaRawContentBlockStartEvent):
            content = event.content_block

            if isinstance(content, BetaTextBlock):
                self.anthropic_mode = EventMode.TEXT
                # TODO: Can capture citations, etc.

            elif isinstance(content, BetaToolUseBlock):
                self.anthropic_mode = EventMode.TOOL_USE
                self.tool_call_id = content.id
                self.tool_call_name = content.name

                if self.tool_call_name in self.requires_approval_tools:
                    if prev_message_type and prev_message_type != "approval_request_message":
                        message_index += 1
                    tool_call_msg = ApprovalRequestMessage(
                        id=self.letta_message_id,
                        tool_call=ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id),
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_delta = ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id)
                    tool_call_msg = ToolCallMessage(
                        id=self.letta_message_id,
                        tool_call=tool_call_delta,
                        tool_calls=tool_call_delta,
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                prev_message_type = tool_call_msg.message_type
                yield tool_call_msg

            elif isinstance(content, BetaThinkingBlock):
                self.anthropic_mode = EventMode.THINKING
                # TODO: Can capture signature, etc.

            elif isinstance(content, BetaRedactedThinkingBlock):
                self.anthropic_mode = EventMode.REDACTED_THINKING

                if prev_message_type and prev_message_type != "hidden_reasoning_message":
                    message_index += 1

                hidden_reasoning_message = HiddenReasoningMessage(
                    id=self.letta_message_id,
                    state="redacted",
                    hidden_reasoning=content.data,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )

                self.reasoning_messages.append(hidden_reasoning_message)
                prev_message_type = hidden_reasoning_message.message_type
                yield hidden_reasoning_message

        elif isinstance(event, BetaRawContentBlockDeltaEvent):
            delta = event.delta

            if isinstance(delta, BetaTextDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.TEXT:
                    raise RuntimeError(f"Streaming integrity failed - received BetaTextDelta object while not in TEXT EventMode: {delta}")

                if prev_message_type and prev_message_type != "assistant_message":
                    message_index += 1

                assistant_msg = AssistantMessage(
                    id=self.letta_message_id,
                    content=delta.text,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                # self.assistant_messages.append(assistant_msg)
                self.reasoning_messages.append(assistant_msg)
                prev_message_type = assistant_msg.message_type
                yield assistant_msg

            elif isinstance(delta, BetaInputJSONDelta):
                if not self.anthropic_mode == EventMode.TOOL_USE:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaInputJSONDelta object while not in TOOL_USE EventMode: {delta}"
                    )

                if delta.partial_json:
                    self._accumulated_tool_call_args_parts.append(delta.partial_json)

                if self.tool_call_name in self.requires_approval_tools:
                    if prev_message_type and prev_message_type != "approval_request_message":
                        message_index += 1
                    tool_call_msg = ApprovalRequestMessage(
                        id=self.letta_message_id,
                        tool_call=ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id, arguments=delta.partial_json),
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_delta = ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id, arguments=delta.partial_json)
                    tool_call_msg = ToolCallMessage(
                        id=self.letta_message_id,
                        tool_call=tool_call_delta,
                        tool_calls=tool_call_delta,
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )

                yield tool_call_msg

            elif isinstance(delta, BetaThinkingDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.THINKING:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaThinkingBlock object while not in THINKING EventMode: {delta}"
                    )

                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                reasoning_message = ReasoningMessage(
                    id=self.letta_message_id,
                    source="reasoner_model",
                    reasoning=delta.thinking,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(reasoning_message)
                prev_message_type = reasoning_message.message_type
                yield reasoning_message

            elif isinstance(delta, BetaSignatureDelta):
                # Safety check
                if not self.anthropic_mode == EventMode.THINKING:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaSignatureDelta object while not in THINKING EventMode: {delta}"
                    )

                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                reasoning_message = ReasoningMessage(
                    id=self.letta_message_id,
                    source="reasoner_model",
                    reasoning="",
                    date=datetime.now(timezone.utc).isoformat(),
                    signature=delta.signature,
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.reasoning_messages.append(reasoning_message)
                prev_message_type = reasoning_message.message_type
                yield reasoning_message

        elif isinstance(event, BetaRawMessageStartEvent):
            self.message_id = event.message.id
            self.input_tokens += event.message.usage.input_tokens
            self.output_tokens += event.message.usage.output_tokens
            self.model = event.message.model

        elif isinstance(event, BetaRawMessageDeltaEvent):
            self.output_tokens += event.usage.output_tokens

        elif isinstance(event, BetaRawMessageStopEvent):
            # Don't do anything here! We don't want to stop the stream.
            pass

        elif isinstance(event, BetaRawContentBlockStopEvent):
            self.anthropic_mode = None
