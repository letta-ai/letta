import json
from datetime import datetime, timezone
from enum import Enum
from typing import AsyncGenerator, List, Optional, Union

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
from letta.helpers.datetime_helpers import get_utc_timestamp_ns, ns_to_ms
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.letta_message import (
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

    def __init__(self, use_assistant_message: bool = False, put_inner_thoughts_in_kwarg: bool = False):
        self.json_parser: JSONParser = PydanticJSONParser()
        self.use_assistant_message = use_assistant_message

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()

        self.anthropic_mode = None
        self.message_id = None
        self.accumulated_inner_thoughts = []
        self.tool_call_id = None
        self.tool_call_name = None
        self.accumulated_tool_call_args = ""
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

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        if not self.tool_call_name:
            raise ValueError("No tool call returned")
        # hack for tool rules
        try:
            tool_input = json.loads(self.accumulated_tool_call_args)
        except json.JSONDecodeError as e:
            logger.warning(
                f"Failed to decode tool call arguments for tool_call_id={self.tool_call_id}, "
                f"name={self.tool_call_name}. Raw input: {self.accumulated_tool_call_args!r}. Error: {e}"
            )
            raise
        if "id" in tool_input and tool_input["id"].startswith("toolu_") and "function" in tool_input:
            arguments = str(json.dumps(tool_input["function"]["arguments"], indent=2))
        else:
            arguments = self.accumulated_tool_call_args
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

    async def process(
        self,
        stream: AsyncStream[BetaRawMessageStreamEvent],
        ttft_span: Optional["Span"] = None,
        provider_request_start_timestamp_ns: Optional[int] = None,
    ) -> AsyncGenerator[LettaMessage, None]:
        prev_message_type = None
        message_index = 0
        first_chunk = True
        try:
            async with stream:
                async for event in stream:
                    if first_chunk and ttft_span is not None and provider_request_start_timestamp_ns is not None:
                        now = get_utc_timestamp_ns()
                        ttft_ns = now - provider_request_start_timestamp_ns
                        ttft_span.add_event(
                            name="anthropic_time_to_first_token_ms", attributes={"anthropic_time_to_first_token_ms": ns_to_ms(ttft_ns)}
                        )
                        metric_attributes = get_ctx_attributes()
                        if isinstance(event, BetaRawMessageStartEvent):
                            metric_attributes["model.name"] = event.message.model
                        MetricRegistry().ttft_ms_histogram.record(ns_to_ms(ttft_ns), metric_attributes)
                        first_chunk = False

                    # TODO: Support BetaThinkingBlock, BetaRedactedThinkingBlock
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
                                # Buffer the initial tool call message instead of yielding immediately
                                tool_call_msg = ToolCallMessage(
                                    id=self.letta_message_id,
                                    tool_call=ToolCallDelta(name=self.tool_call_name, tool_call_id=self.tool_call_id),
                                    date=datetime.now(timezone.utc).isoformat(),
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
                            )
                            self.reasoning_messages.append(hidden_reasoning_message)
                            prev_message_type = hidden_reasoning_message.message_type
                            yield hidden_reasoning_message

                    elif isinstance(event, BetaRawContentBlockDeltaEvent):
                        delta = event.delta

                        if isinstance(delta, BetaTextDelta):
                            # Safety check
                            if not self.anthropic_mode == EventMode.TEXT:
                                raise RuntimeError(
                                    f"Streaming integrity failed - received BetaTextDelta object while not in TEXT EventMode: {delta}"
                                )

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
                            )
                            self.reasoning_messages.append(reasoning_message)
                            prev_message_type = reasoning_message.message_type
                            yield reasoning_message

                        elif isinstance(delta, BetaInputJSONDelta):
                            if not self.anthropic_mode == EventMode.TOOL_USE:
                                raise RuntimeError(
                                    f"Streaming integrity failed - received BetaInputJSONDelta object while not in TOOL_USE EventMode: {delta}"
                                )

                            self.accumulated_tool_call_args += delta.partial_json
                            current_parsed = self.json_parser.parse(self.accumulated_tool_call_args)

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
                                )
                                self.reasoning_messages.append(reasoning_message)
                                prev_message_type = reasoning_message.message_type
                                yield reasoning_message

                            # Check if inner thoughts are complete - if so, flush the buffer
                            if not self.inner_thoughts_complete and self._check_inner_thoughts_complete(self.accumulated_tool_call_args):
                                self.inner_thoughts_complete = True
                                # Flush all buffered tool call messages
                                if len(self.tool_call_buffer) > 0:
                                    if prev_message_type and prev_message_type != "tool_call_message":
                                        message_index += 1

                                    # Strip out the inner thoughts from the buffered tool call arguments before streaming
                                    tool_call_args = ""
                                    for buffered_msg in self.tool_call_buffer:
                                        tool_call_args += buffered_msg.tool_call.arguments if buffered_msg.tool_call.arguments else ""
                                    tool_call_args = tool_call_args.replace(f'"{INNER_THOUGHTS_KWARG}": "{current_inner_thoughts}"', "")

                                    tool_call_msg = ToolCallMessage(
                                        id=self.tool_call_buffer[0].id,
                                        otid=Message.generate_otid_from_id(self.tool_call_buffer[0].id, message_index),
                                        date=self.tool_call_buffer[0].date,
                                        name=self.tool_call_buffer[0].name,
                                        sender_id=self.tool_call_buffer[0].sender_id,
                                        step_id=self.tool_call_buffer[0].step_id,
                                        tool_call=ToolCallDelta(
                                            name=self.tool_call_name,
                                            tool_call_id=self.tool_call_id,
                                            arguments=tool_call_args,
                                        ),
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
                                        content=[TextContent(text=send_message_diff)],
                                        date=datetime.now(timezone.utc).isoformat(),
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                    )
                                    prev_message_type = assistant_msg.message_type
                                    yield assistant_msg
                            else:
                                # Otherwise, it is a normal tool call - buffer or yield based on inner thoughts status
                                tool_call_msg = ToolCallMessage(
                                    id=self.letta_message_id,
                                    tool_call=ToolCallDelta(
                                        name=self.tool_call_name, tool_call_id=self.tool_call_id, arguments=delta.partial_json
                                    ),
                                    date=datetime.now(timezone.utc).isoformat(),
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
        except Exception as e:
            logger.error("Error processing stream: %s", e)
            stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
            yield stop_reason
            raise
        finally:
            logger.info("AnthropicStreamingInterface: Stream processing complete.")

    def get_reasoning_content(self) -> List[Union[TextContent, ReasoningContent, RedactedReasoningContent]]:
        def _process_group(
            group: List[Union[ReasoningMessage, HiddenReasoningMessage]], group_type: str
        ) -> Union[TextContent, ReasoningContent, RedactedReasoningContent]:
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
