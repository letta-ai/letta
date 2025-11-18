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
from letta.server.rest_api.utils import decrement_message_uuid

logger = get_logger(__name__)


# TODO: These modes aren't used right now - but can be useful we do multiple sequential tool calling within one Claude message
class EventMode(Enum):
    TEXT = "TEXT"
    TOOL_USE = "TOOL_USE"
    THINKING = "THINKING"
    REDACTED_THINKING = "REDACTED_THINKING"


# TODO: There's a duplicate version of this in anthropic_streaming_interface
class SimpleAnthropicStreamingInterface:
    """
    A simpler version of AnthropicStreamingInterface focused on streaming assistant text and
    tool call deltas. Updated to support parallel tool calling by collecting completed
    ToolUse blocks (from content_block stop events) and exposing all finalized tool calls
    via get_tool_call_objects().

    Notes:
    - We keep emitting the stream (text and tool-call deltas) as before for latency.
    - We no longer rely on accumulating partial JSON to build the final tool call; instead
      we read the finalized ToolUse input from the stop event and store it.
    - Multiple tool calls within a single message (parallel tool use) are collected and
      can be returned to the agent as a list.
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
        self.accumulated_tool_call_args = ""
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
        # Collected finalized tool calls (supports parallel tool use)
        self.collected_tool_calls: list[ToolCall] = []
        # Track active tool_use blocks by stream index for parallel tool calling
        # { index: {"id": str, "name": str, "args_parts": list[str]} }
        self.active_tool_uses: dict[int, dict[str, object]] = {}
        # Maintain start order and indexed collection for stable ordering
        self._tool_use_start_order: list[int] = []
        self._collected_indexed: list[tuple[int, ToolCall]] = []

    def get_tool_call_objects(self) -> list[ToolCall]:
        """Return all finalized tool calls collected during this message (parallel supported)."""
        # Prefer indexed ordering if available
        if self._collected_indexed:
            return [
                call
                for _, call in sorted(
                    self._collected_indexed,
                    key=lambda x: self._tool_use_start_order.index(x[0]) if x[0] in self._tool_use_start_order else x[0],
                )
            ]
        return self.collected_tool_calls

    # This exists for legacy compatibility
    def get_tool_call_object(self) -> Optional[ToolCall]:
        tool_calls = self.get_tool_call_objects()
        if tool_calls:
            return tool_calls[0]
        return None

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

            logger.error("Error processing stream: %s\n%s", e, traceback.format_exc())
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
                # New tool_use block started at this index
                self.anthropic_mode = EventMode.TOOL_USE
                self.active_tool_uses[event.index] = {"id": content.id, "name": content.name, "args_parts": []}
                if event.index not in self._tool_use_start_order:
                    self._tool_use_start_order.append(event.index)

                # Emit an initial tool call delta for this new block
                name = content.name
                call_id = content.id
                # Initialize arguments from the start event's input (often {}) to avoid undefined in UIs
                if name in self.requires_approval_tools:
                    tool_call_msg = ApprovalRequestMessage(
                        id=decrement_message_uuid(self.letta_message_id),
                        # Do not emit placeholder arguments here to avoid UI duplicates
                        tool_call=ToolCallDelta(name=name, tool_call_id=call_id),
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_msg = ToolCallMessage(
                        id=self.letta_message_id,
                        # Do not emit placeholder arguments here to avoid UI duplicates
                        tool_call=ToolCallDelta(name=name, tool_call_id=call_id),
                        tool_calls=ToolCallDelta(name=name, tool_call_id=call_id),
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
                # Append partial JSON for the specific tool_use block at this index
                if not self.anthropic_mode == EventMode.TOOL_USE:
                    raise RuntimeError(
                        f"Streaming integrity failed - received BetaInputJSONDelta object while not in TOOL_USE EventMode: {delta}"
                    )

                ctx = self.active_tool_uses.get(event.index)
                if ctx is None:
                    # Defensive: initialize if missing
                    self.active_tool_uses[event.index] = {
                        "id": self.tool_call_id or "",
                        "name": self.tool_call_name or "",
                        "args_parts": [],
                    }
                    ctx = self.active_tool_uses[event.index]

                # Append only non-empty partials
                if delta.partial_json:
                    # Append fragment to args_parts to avoid O(n^2) string growth
                    args_parts = ctx.get("args_parts") if isinstance(ctx.get("args_parts"), list) else None
                    if args_parts is None:
                        args_parts = []
                        ctx["args_parts"] = args_parts
                    args_parts.append(delta.partial_json)
                else:
                    # Skip streaming a no-op delta to prevent duplicate placeholders in UI
                    return

                name = ctx.get("name")
                call_id = ctx.get("id")

                if name in self.requires_approval_tools:
                    tool_call_msg = ApprovalRequestMessage(
                        id=decrement_message_uuid(self.letta_message_id),
                        tool_call=ToolCallDelta(name=name, tool_call_id=call_id, arguments=delta.partial_json),
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_msg = ToolCallMessage(
                        id=self.letta_message_id,
                        tool_call=ToolCallDelta(name=name, tool_call_id=call_id, arguments=delta.partial_json),
                        tool_calls=ToolCallDelta(name=name, tool_call_id=call_id, arguments=delta.partial_json),
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    prev_message_type = tool_call_msg.message_type
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
            # Finalize the tool_use block at this index using accumulated deltas
            ctx = self.active_tool_uses.pop(event.index, None)
            if ctx is not None and ctx.get("id") and ctx.get("name") is not None:
                parts = ctx.get("args_parts") if isinstance(ctx.get("args_parts"), list) else None
                raw_args = "".join(parts) if parts else ""
                try:
                    # Prefer strict JSON load, fallback to permissive parser
                    tool_input = json.loads(raw_args) if raw_args else {}
                except json.JSONDecodeError:
                    try:
                        tool_input = self.json_parser.parse(raw_args) if raw_args else {}
                    except Exception:
                        tool_input = {}

                arguments = json.dumps(tool_input)
                finalized = ToolCall(id=ctx["id"], function=FunctionCall(arguments=arguments, name=ctx["name"]))
                # Keep both raw list and indexed list for compatibility
                self.collected_tool_calls.append(finalized)
                self._collected_indexed.append((event.index, finalized))

            # Reset mode when a content block ends
            self.anthropic_mode = None
