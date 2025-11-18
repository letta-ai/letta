import asyncio
import base64
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import AsyncIterator, List, Optional

from google.genai.types import (
    GenerateContentResponse,
)

from letta.log import get_logger
from letta.schemas.letta_message import (
    ApprovalRequestMessage,
    AssistantMessage,
    LettaMessage,
    ReasoningMessage,
    ToolCallDelta,
    ToolCallMessage,
)
from letta.schemas.letta_message_content import (
    ReasoningContent,
    TextContent,
    ToolCallContent,
)
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall
from letta.server.rest_api.utils import decrement_message_uuid
from letta.utils import get_tool_call_id

logger = get_logger(__name__)


class SimpleGeminiStreamingInterface:
    """
    Encapsulates the logic for streaming responses from Gemini API:
    https://ai.google.dev/gemini-api/docs/text-generation#streaming-responses
    """

    def __init__(
        self,
        requires_approval_tools: list = [],
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.run_id = run_id
        self.step_id = step_id

        # self.messages = messages
        # self.tools = tools
        self.requires_approval_tools = requires_approval_tools
        # ID responses used
        self.message_id = None

        # In Gemini streaming, tool call comes all at once
        self.tool_call_id: str | None = None
        self.tool_call_name: str | None = None
        self.tool_call_args: dict | None = None  # NOTE: Not a str!

        self.collected_tool_calls: list[ToolCall] = []

        # NOTE: signature only is included if tools are present
        self.thinking_signature: str | None = None

        # Regular text content too (avoid O(n^2) by accumulating parts)
        self._text_parts: list[str] = []
        self.text_content: str | None = None  # legacy; not used elsewhere

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()
        # self.model = model

        # Sadly, Gemini's encrypted reasoning logic forces us to store stream parts in state
        self.content_parts: List[ReasoningContent | TextContent | ToolCallContent] = []

    def get_content(self) -> List[ReasoningContent | TextContent | ToolCallContent]:
        """This is (unusually) in chunked format, instead of merged"""
        for content in self.content_parts:
            if isinstance(content, ReasoningContent):
                # This assumes there is only one signature per turn
                content.signature = self.thinking_signature
        return self.content_parts

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        if self.collected_tool_calls:
            return self.collected_tool_calls[-1]

        if self.tool_call_id is None:
            raise ValueError("No tool call ID available")
        if self.tool_call_name is None:
            raise ValueError("No tool call name available")
        if self.tool_call_args is None:
            raise ValueError("No tool call arguments available")

        tool_call_args_str = json.dumps(self.tool_call_args)
        return ToolCall(id=self.tool_call_id, function=FunctionCall(name=self.tool_call_name, arguments=tool_call_args_str))

    def get_tool_call_objects(self) -> list[ToolCall]:
        """Return all finalized tool calls collected during this message (parallel supported)."""
        return list(self.collected_tool_calls)

    async def process(
        self,
        stream: AsyncIterator[GenerateContentResponse],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """
        Iterates over the Gemini stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        prev_message_type = None
        message_index = 0
        try:
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
            logger.info("GeminiStreamingInterface: Stream processing complete.")

    async def _process_event(
        self,
        event: GenerateContentResponse,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        # Every event has usage data + model info on it,
        # so we can continually extract
        self.model = event.model_version
        self.message_id = event.response_id
        usage_metadata = event.usage_metadata
        if usage_metadata:
            if usage_metadata.prompt_token_count:
                self.input_tokens = usage_metadata.prompt_token_count
            if usage_metadata.total_token_count:
                self.output_tokens = usage_metadata.total_token_count - usage_metadata.prompt_token_count

        if not event.candidates or len(event.candidates) == 0:
            return
        else:
            # NOTE: should always be len 1
            candidate = event.candidates[0]

        if not candidate.content or not candidate.content.parts:
            return

        for part in candidate.content.parts:
            # NOTE: the thought signature often comes after the thought text, eg with the tool call
            if part.thought_signature:
                # NOTE: the thought_signature comes on the Part with the function_call
                thought_signature = part.thought_signature
                self.thinking_signature = base64.b64encode(thought_signature).decode("utf-8")
                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                yield ReasoningMessage(
                    id=self.letta_message_id,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    source="reasoner_model",
                    reasoning="",
                    signature=self.thinking_signature,
                )
                prev_message_type = "reasoning_message"

            # Thinking summary content part (bool means text is thought part)
            if part.thought:
                reasoning_summary = part.text
                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                yield ReasoningMessage(
                    id=self.letta_message_id,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    source="reasoner_model",
                    reasoning=reasoning_summary,
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                prev_message_type = "reasoning_message"
                self.content_parts.append(
                    ReasoningContent(
                        is_native=True,
                        reasoning=reasoning_summary,
                        signature=self.thinking_signature,
                    )
                )

            # Plain text content part
            elif part.text:
                content = part.text
                self._text_parts.append(content)
                if prev_message_type and prev_message_type != "assistant_message":
                    message_index += 1
                yield AssistantMessage(
                    id=self.letta_message_id,
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    date=datetime.now(timezone.utc),
                    content=content,
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                prev_message_type = "assistant_message"
                self.content_parts.append(
                    TextContent(
                        text=content,
                        signature=self.thinking_signature,
                    )
                )

            # Tool call function part
            # NOTE: in gemini, this comes all at once, and the args are JSON dict, not stringified
            elif part.function_call:
                function_call = part.function_call

                # Look for call_id, name, and possibly arguments (though likely always empty string)
                call_id = get_tool_call_id()
                name = function_call.name
                arguments = function_call.args  # NOTE: dict, not str
                arguments_str = json.dumps(arguments)  # NOTE: use json_dumps?

                self.tool_call_id = call_id
                self.tool_call_name = name
                self.tool_call_args = arguments

                self.collected_tool_calls.append(ToolCall(id=call_id, function=FunctionCall(name=name, arguments=arguments_str)))

                if self.tool_call_name and self.tool_call_name in self.requires_approval_tools:
                    yield ApprovalRequestMessage(
                        id=decrement_message_uuid(self.letta_message_id),
                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                        date=datetime.now(timezone.utc),
                        tool_call=ToolCallDelta(
                            name=name,
                            arguments=arguments_str,
                            tool_call_id=call_id,
                        ),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_delta = ToolCallDelta(
                        name=name,
                        arguments=arguments_str,
                        tool_call_id=call_id,
                    )
                    yield ToolCallMessage(
                        id=self.letta_message_id,
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        date=datetime.now(timezone.utc),
                        tool_call=tool_call_delta,
                        tool_calls=tool_call_delta,
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    prev_message_type = "tool_call_message"
                self.content_parts.append(
                    ToolCallContent(
                        id=call_id,
                        name=name,
                        input=arguments,
                        signature=self.thinking_signature,
                    )
                )
