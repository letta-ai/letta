import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Optional

from openai import AsyncStream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk
from openai.types.responses import (
    ResponseCompletedEvent,
    ResponseContentPartAddedEvent,
    ResponseContentPartDoneEvent,
    ResponseCreatedEvent,
    ResponseFunctionCallArgumentsDeltaEvent,
    ResponseFunctionCallArgumentsDoneEvent,
    ResponseFunctionToolCall,
    ResponseInProgressEvent,
    ResponseOutputItemAddedEvent,
    ResponseOutputItemDoneEvent,
    ResponseOutputMessage,
    ResponseOutputText,
    ResponseReasoningItem,
    ResponseReasoningSummaryPartAddedEvent,
    ResponseReasoningSummaryPartDoneEvent,
    ResponseReasoningSummaryTextDeltaEvent,
    ResponseReasoningSummaryTextDoneEvent,
    ResponseTextDeltaEvent,
    ResponseTextDoneEvent,
)
from openai.types.responses.response_stream_event import ResponseStreamEvent

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.llm_api.openai_client import is_openai_reasoning_model
from letta.local_llm.utils import num_tokens_from_functions, num_tokens_from_messages
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
from letta.schemas.letta_message_content import (
    OmittedReasoningContent,
    ReasoningContent,
    SummarizedReasoningContent,
    SummarizedReasoningContentPart,
    TextContent,
)
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall
from letta.server.rest_api.json_parser import OptimisticJSONParser
from letta.server.rest_api.utils import decrement_message_uuid
from letta.streaming_utils import (
    FunctionArgumentsStreamHandler,
    JSONInnerThoughtsExtractor,
    sanitize_streamed_message_content,
)
from letta.utils import count_tokens

logger = get_logger(__name__)


class OpenAIStreamingInterface:
    """
    Encapsulates the logic for streaming responses from OpenAI.
    This class handles parsing of partial tokens, pre-execution messages,
    and detection of tool call events.
    """

    def __init__(
        self,
        use_assistant_message: bool = False,
        is_openai_proxy: bool = False,
        messages: Optional[list] = None,
        tools: Optional[list] = None,
        put_inner_thoughts_in_kwarg: bool = True,
        requires_approval_tools: list = [],
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.use_assistant_message = use_assistant_message
        self.assistant_message_tool_name = DEFAULT_MESSAGE_TOOL
        self.assistant_message_tool_kwarg = DEFAULT_MESSAGE_TOOL_KWARG
        self.put_inner_thoughts_in_kwarg = put_inner_thoughts_in_kwarg
        self.run_id = run_id
        self.step_id = step_id

        self.optimistic_json_parser: OptimisticJSONParser = OptimisticJSONParser()
        self.function_args_reader = JSONInnerThoughtsExtractor(wait_for_first_key=put_inner_thoughts_in_kwarg)
        # Reader that extracts only the assistant message value from send_message args
        self.assistant_message_json_reader = FunctionArgumentsStreamHandler(json_key=self.assistant_message_tool_kwarg)
        self.function_name_buffer = None
        self.function_args_buffer = None
        self.function_id_buffer = None
        self.last_flushed_function_name = None
        self.last_flushed_function_id = None

        # Buffer to hold function arguments until inner thoughts are complete
        self.current_function_arguments = ""
        self.current_json_parse_result = {}

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()

        self.message_id = None
        self.model = None

        # Token counters (from OpenAI usage)
        self.input_tokens = 0
        self.output_tokens = 0

        # Fallback token counters (using tiktoken cl200k-base)
        self.fallback_input_tokens = 0
        self.fallback_output_tokens = 0

        # Store messages and tools for fallback counting
        self.is_openai_proxy = is_openai_proxy
        self.messages = messages or []
        self.tools = tools or []

        self.content_buffer: list[str] = []
        self.tool_call_name: str | None = None
        self.tool_call_id: str | None = None
        self.reasoning_messages = []
        self.emitted_hidden_reasoning = False  # Track if we've emitted hidden reasoning message

        self.requires_approval_tools = requires_approval_tools

    def get_reasoning_content(self) -> list[TextContent | OmittedReasoningContent]:
        content = "".join(self.reasoning_messages).strip()

        # Right now we assume that all models omit reasoning content for OAI,
        # if this changes, we should return the reasoning content
        if is_openai_reasoning_model(self.model):
            return [OmittedReasoningContent()]
        else:
            return [TextContent(text=content)]

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        function_name = self.last_flushed_function_name if self.last_flushed_function_name else self.function_name_buffer
        if not function_name:
            raise ValueError("No tool call ID available")
        tool_call_id = self.last_flushed_function_id if self.last_flushed_function_id else self.function_id_buffer
        if not tool_call_id:
            raise ValueError("No tool call ID available")
        return ToolCall(
            id=tool_call_id,
            function=FunctionCall(arguments=self.current_function_arguments, name=function_name),
        )

    async def process(
        self,
        stream: AsyncStream[ChatCompletionChunk],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """
        Iterates over the OpenAI stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        # Fallback input token counting - this should only be required for non-OpenAI providers using the OpenAI client (e.g. LMStudio)
        if self.is_openai_proxy:
            if self.messages:
                # Convert messages to dict format for token counting
                message_dicts = [msg.to_openai_dict() if hasattr(msg, "to_openai_dict") else msg for msg in self.messages]
                message_dicts = [m for m in message_dicts if m is not None]
                self.fallback_input_tokens = num_tokens_from_messages(message_dicts)  # fallback to gpt-4 cl100k-base

            if self.tools:
                # Convert tools to dict format for token counting
                tool_dicts = [tool["function"] if isinstance(tool, dict) and "function" in tool else tool for tool in self.tools]
                self.fallback_input_tokens += num_tokens_from_functions(tool_dicts)

        prev_message_type = None
        message_index = 0
        try:
            async with stream:
                async for chunk in stream:
                    try:
                        async for message in self._process_chunk(chunk, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            yield message
                    except asyncio.CancelledError as e:
                        import traceback

                        logger.info("Cancelled stream attempt but overriding %s: %s", e, traceback.format_exc())
                        async for message in self._process_chunk(chunk, ttft_span, prev_message_type, message_index):
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
            logger.info("OpenAIStreamingInterface: Stream processing complete.")

    async def _process_chunk(
        self,
        chunk: ChatCompletionChunk,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        if not self.model or not self.message_id:
            self.model = chunk.model
            self.message_id = chunk.id

        # track usage
        if chunk.usage:
            self.input_tokens += chunk.usage.prompt_tokens
            self.output_tokens += chunk.usage.completion_tokens

        if chunk.choices:
            choice = chunk.choices[0]
            message_delta = choice.delta

            if message_delta.tool_calls is not None and len(message_delta.tool_calls) > 0:
                tool_call = message_delta.tool_calls[0]

                # For OpenAI reasoning models, emit a hidden reasoning message before the first tool call
                if not self.emitted_hidden_reasoning and is_openai_reasoning_model(self.model) and not self.put_inner_thoughts_in_kwarg:
                    self.emitted_hidden_reasoning = True
                    if prev_message_type and prev_message_type != "hidden_reasoning_message":
                        message_index += 1
                    hidden_message = HiddenReasoningMessage(
                        id=self.letta_message_id,
                        date=datetime.now(timezone.utc),
                        state="omitted",
                        hidden_reasoning=None,
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    yield hidden_message
                    prev_message_type = hidden_message.message_type
                    message_index += 1  # Increment for the next message

                if tool_call.function.name:
                    # If we're waiting for the first key, then we should hold back the name
                    # ie add it to a buffer instead of returning it as a chunk
                    if self.function_name_buffer is None:
                        self.function_name_buffer = tool_call.function.name
                    else:
                        self.function_name_buffer += tool_call.function.name

                if tool_call.id:
                    # Buffer until next time
                    if self.function_id_buffer is None:
                        self.function_id_buffer = tool_call.id
                    else:
                        self.function_id_buffer += tool_call.id

                if tool_call.function.arguments:
                    # updates_main_json, updates_inner_thoughts = self.function_args_reader.process_fragment(tool_call.function.arguments)
                    self.current_function_arguments += tool_call.function.arguments
                    updates_main_json, updates_inner_thoughts = self.function_args_reader.process_fragment(tool_call.function.arguments)

                    if self.is_openai_proxy:
                        self.fallback_output_tokens += count_tokens(tool_call.function.arguments)

                    # If we have inner thoughts, we should output them as a chunk
                    if updates_inner_thoughts:
                        if prev_message_type and prev_message_type != "reasoning_message":
                            message_index += 1
                        self.reasoning_messages.append(updates_inner_thoughts)
                        reasoning_message = ReasoningMessage(
                            id=self.letta_message_id,
                            date=datetime.now(timezone.utc),
                            reasoning=updates_inner_thoughts,
                            # name=name,
                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                            run_id=self.run_id,
                            step_id=self.step_id,
                        )
                        prev_message_type = reasoning_message.message_type
                        yield reasoning_message

                        # Additionally inner thoughts may stream back with a chunk of main JSON
                        # In that case, since we can only return a chunk at a time, we should buffer it
                        if updates_main_json:
                            if self.function_args_buffer is None:
                                self.function_args_buffer = updates_main_json
                            else:
                                self.function_args_buffer += updates_main_json

                    # If we have main_json, we should output a ToolCallMessage
                    elif updates_main_json:
                        # If there's something in the function_name buffer, we should release it first
                        # NOTE: we could output it as part of a chunk that has both name and args,
                        #       however the frontend may expect name first, then args, so to be
                        #       safe we'll output name first in a separate chunk
                        if self.function_name_buffer:
                            # use_assisitant_message means that we should also not release main_json raw, and instead should only release the contents of "message": "..."
                            if self.use_assistant_message and self.function_name_buffer == self.assistant_message_tool_name:
                                # Store the ID of the tool call so allow skipping the corresponding response
                                if self.function_id_buffer:
                                    self.prev_assistant_message_id = self.function_id_buffer
                                # Reset message reader at the start of a new send_message stream
                                self.assistant_message_json_reader.reset()

                            else:
                                if prev_message_type and prev_message_type != "tool_call_message":
                                    message_index += 1
                                self.tool_call_name = str(self.function_name_buffer)
                                if self.tool_call_name in self.requires_approval_tools:
                                    tool_call_msg = ApprovalRequestMessage(
                                        id=decrement_message_uuid(self.letta_message_id),
                                        date=datetime.now(timezone.utc),
                                        tool_call=ToolCallDelta(
                                            name=self.function_name_buffer,
                                            arguments=None,
                                            tool_call_id=self.function_id_buffer,
                                        ),
                                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                                        run_id=self.run_id,
                                        step_id=self.step_id,
                                    )
                                else:
                                    tool_call_delta = ToolCallDelta(
                                        name=self.function_name_buffer,
                                        arguments=None,
                                        tool_call_id=self.function_id_buffer,
                                    )
                                    tool_call_msg = ToolCallMessage(
                                        id=self.letta_message_id,
                                        date=datetime.now(timezone.utc),
                                        tool_call=tool_call_delta,
                                        tool_calls=tool_call_delta,
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                        run_id=self.run_id,
                                        step_id=self.step_id,
                                    )
                                prev_message_type = tool_call_msg.message_type
                                yield tool_call_msg

                            # Record what the last function name we flushed was
                            self.last_flushed_function_name = self.function_name_buffer
                            if self.last_flushed_function_id is None:
                                self.last_flushed_function_id = self.function_id_buffer
                            # Clear the buffer
                            self.function_name_buffer = None
                            self.function_id_buffer = None
                            # Since we're clearing the name buffer, we should store
                            # any updates to the arguments inside a separate buffer

                            # Add any main_json updates to the arguments buffer
                            if self.function_args_buffer is None:
                                self.function_args_buffer = updates_main_json
                            else:
                                self.function_args_buffer += updates_main_json

                        # If there was nothing in the name buffer, we can proceed to
                        # output the arguments chunk as a ToolCallMessage
                        else:
                            # use_assistant_message means that we should also not release main_json raw, and instead should only release the contents of "message": "..."
                            if self.use_assistant_message and (
                                self.last_flushed_function_name is not None
                                and self.last_flushed_function_name == self.assistant_message_tool_name
                            ):
                                # Minimal, robust extraction: only emit the value of "message".
                                # If we buffered a prefix while name was streaming, feed it first.
                                if self.function_args_buffer:
                                    payload = self.function_args_buffer + tool_call.function.arguments
                                    self.function_args_buffer = None
                                else:
                                    payload = tool_call.function.arguments
                                extracted = self.assistant_message_json_reader.process_json_chunk(payload)
                                extracted = sanitize_streamed_message_content(extracted or "")
                                if extracted:
                                    if prev_message_type and prev_message_type != "assistant_message":
                                        message_index += 1
                                    assistant_message = AssistantMessage(
                                        id=self.letta_message_id,
                                        date=datetime.now(timezone.utc),
                                        content=extracted,
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                        run_id=self.run_id,
                                        step_id=self.step_id,
                                    )
                                    prev_message_type = assistant_message.message_type
                                    yield assistant_message
                                    # Store the ID of the tool call so allow skipping the corresponding response
                                    if self.function_id_buffer:
                                        self.prev_assistant_message_id = self.function_id_buffer
                            else:
                                # There may be a buffer from a previous chunk, for example
                                # if the previous chunk had arguments but we needed to flush name
                                if self.function_args_buffer:
                                    # In this case, we should release the buffer + new data at once
                                    combined_chunk = self.function_args_buffer + updates_main_json
                                    if prev_message_type and prev_message_type != "tool_call_message":
                                        message_index += 1
                                    if self.function_name_buffer in self.requires_approval_tools:
                                        tool_call_msg = ApprovalRequestMessage(
                                            id=decrement_message_uuid(self.letta_message_id),
                                            date=datetime.now(timezone.utc),
                                            tool_call=ToolCallDelta(
                                                name=self.function_name_buffer,
                                                arguments=combined_chunk,
                                                tool_call_id=self.function_id_buffer,
                                            ),
                                            # name=name,
                                            otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                                            run_id=self.run_id,
                                            step_id=self.step_id,
                                        )
                                    else:
                                        tool_call_delta = ToolCallDelta(
                                            name=self.function_name_buffer,
                                            arguments=combined_chunk,
                                            tool_call_id=self.function_id_buffer,
                                        )
                                        tool_call_msg = ToolCallMessage(
                                            id=self.letta_message_id,
                                            date=datetime.now(timezone.utc),
                                            tool_call=tool_call_delta,
                                            tool_calls=tool_call_delta,
                                            # name=name,
                                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                            run_id=self.run_id,
                                            step_id=self.step_id,
                                        )
                                    prev_message_type = tool_call_msg.message_type
                                    yield tool_call_msg
                                    # clear buffer
                                    self.function_args_buffer = None
                                    self.function_id_buffer = None
                                else:
                                    # If there's no buffer to clear, just output a new chunk with new data
                                    if prev_message_type and prev_message_type != "tool_call_message":
                                        message_index += 1
                                    if self.function_name_buffer in self.requires_approval_tools:
                                        tool_call_msg = ApprovalRequestMessage(
                                            id=decrement_message_uuid(self.letta_message_id),
                                            date=datetime.now(timezone.utc),
                                            tool_call=ToolCallDelta(
                                                name=None,
                                                arguments=updates_main_json,
                                                tool_call_id=self.function_id_buffer,
                                            ),
                                            # name=name,
                                            otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                                            run_id=self.run_id,
                                            step_id=self.step_id,
                                        )
                                    else:
                                        tool_call_delta = ToolCallDelta(
                                            name=None,
                                            arguments=updates_main_json,
                                            tool_call_id=self.function_id_buffer,
                                        )
                                        tool_call_msg = ToolCallMessage(
                                            id=self.letta_message_id,
                                            date=datetime.now(timezone.utc),
                                            tool_call=tool_call_delta,
                                            tool_calls=tool_call_delta,
                                            # name=name,
                                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                            run_id=self.run_id,
                                            step_id=self.step_id,
                                        )
                                    prev_message_type = tool_call_msg.message_type
                                    yield tool_call_msg
                                    self.function_id_buffer = None


class SimpleOpenAIStreamingInterface:
    """
    Encapsulates the logic for streaming responses from OpenAI.
    This class handles parsing of partial tokens, pre-execution messages,
    and detection of tool call events.
    """

    def __init__(
        self,
        is_openai_proxy: bool = False,
        messages: Optional[list] = None,
        tools: Optional[list] = None,
        requires_approval_tools: list = [],
        model: str = None,
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.run_id = run_id
        self.step_id = step_id
        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()

        self.message_id = None
        self.model = model

        # Token counters (from OpenAI usage)
        self.input_tokens = 0
        self.output_tokens = 0

        # Fallback token counters (using tiktoken cl200k-base)
        self.fallback_input_tokens = 0
        self.fallback_output_tokens = 0

        # Store messages and tools for fallback counting
        self.is_openai_proxy = is_openai_proxy
        self.messages = messages or []
        self.tools = tools or []

        # Buffers to hold accumulating tools
        self.tool_call_name = ""
        self.tool_call_args = ""
        self.tool_call_id = ""

        self.content_messages = []
        self.emitted_hidden_reasoning = False  # Track if we've emitted hidden reasoning message

        self.requires_approval_tools = requires_approval_tools

    def get_content(self) -> list[TextContent | OmittedReasoningContent | ReasoningContent]:
        shown_omitted = False
        concat_content = ""
        merged_messages = []
        reasoning_content = []

        for msg in self.content_messages:
            if isinstance(msg, HiddenReasoningMessage) and not shown_omitted:
                merged_messages.append(OmittedReasoningContent())
                shown_omitted = True
            elif isinstance(msg, ReasoningMessage):
                reasoning_content.append(msg.reasoning)
            elif isinstance(msg, AssistantMessage):
                if isinstance(msg.content, list):
                    concat_content += "".join([c.text for c in msg.content])
                else:
                    concat_content += msg.content

        if reasoning_content:
            combined_reasoning = "".join(reasoning_content)
            merged_messages.append(ReasoningContent(is_native=True, reasoning=combined_reasoning, signature=None))

        if concat_content:
            merged_messages.append(TextContent(text=concat_content))

        return merged_messages

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        if not self.tool_call_name:
            raise ValueError("No tool call name available")
        if not self.tool_call_args:
            raise ValueError("No tool call arguments available")
        if not self.tool_call_id:
            raise ValueError("No tool call ID available")

        return ToolCall(
            id=self.tool_call_id,
            function=FunctionCall(arguments=self.tool_call_args, name=self.tool_call_name),
        )

    async def process(
        self,
        stream: AsyncStream[ChatCompletionChunk],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """
        Iterates over the OpenAI stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        # Fallback input token counting - this should only be required for non-OpenAI providers using the OpenAI client (e.g. LMStudio)
        if self.is_openai_proxy:
            if self.messages:
                # Convert messages to dict format for token counting
                message_dicts = [msg.to_openai_dict() if hasattr(msg, "to_openai_dict") else msg for msg in self.messages]
                message_dicts = [m for m in message_dicts if m is not None]
                self.fallback_input_tokens = num_tokens_from_messages(message_dicts)  # fallback to gpt-4 cl100k-base

            if self.tools:
                # Convert tools to dict format for token counting
                tool_dicts = [tool["function"] if isinstance(tool, dict) and "function" in tool else tool for tool in self.tools]
                self.fallback_input_tokens += num_tokens_from_functions(tool_dicts)

        prev_message_type = None
        message_index = 0
        try:
            async with stream:
                # For reasoning models, emit a hidden reasoning message before the first chunk
                if not self.emitted_hidden_reasoning and is_openai_reasoning_model(self.model):
                    self.emitted_hidden_reasoning = True
                    if prev_message_type and prev_message_type != "hidden_reasoning_message":
                        message_index += 1
                    hidden_message = HiddenReasoningMessage(
                        id=self.letta_message_id,
                        date=datetime.now(timezone.utc),
                        state="omitted",
                        hidden_reasoning=None,
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    self.content_messages.append(hidden_message)
                    prev_message_type = hidden_message.message_type
                    yield hidden_message

                async for chunk in stream:
                    try:
                        async for message in self._process_chunk(chunk, ttft_span, prev_message_type, message_index):
                            new_message_type = message.message_type
                            if new_message_type != prev_message_type:
                                if prev_message_type != None:
                                    message_index += 1
                                prev_message_type = new_message_type
                            yield message
                    except asyncio.CancelledError as e:
                        import traceback

                        logger.info("Cancelled stream attempt but overriding %s: %s", e, traceback.format_exc())
                        async for message in self._process_chunk(chunk, ttft_span, prev_message_type, message_index):
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
            logger.info("OpenAIStreamingInterface: Stream processing complete.")

    async def _process_chunk(
        self,
        chunk: ChatCompletionChunk,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        if not self.model or not self.message_id:
            self.model = chunk.model
            self.message_id = chunk.id

        # track usage
        if chunk.usage:
            self.input_tokens += chunk.usage.prompt_tokens
            self.output_tokens += chunk.usage.completion_tokens

        if chunk.choices:
            choice = chunk.choices[0]
            message_delta = choice.delta

            if message_delta.content is not None and message_delta.content != "":
                if prev_message_type and prev_message_type != "assistant_message":
                    message_index += 1
                assistant_msg = AssistantMessage(
                    id=self.letta_message_id,
                    content=message_delta.content,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                self.content_messages.append(assistant_msg)
                prev_message_type = assistant_msg.message_type
                yield assistant_msg

            if (
                hasattr(chunk, "choices")
                and len(chunk.choices) > 0
                and hasattr(chunk.choices[0], "delta")
                and hasattr(chunk.choices[0].delta, "reasoning_content")
            ):
                delta = chunk.choices[0].delta
                reasoning_content = getattr(delta, "reasoning_content", None)
                if reasoning_content is not None and reasoning_content != "":
                    if prev_message_type and prev_message_type != "reasoning_message":
                        message_index += 1
                    reasoning_msg = ReasoningMessage(
                        id=self.letta_message_id,
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        source="reasoner_model",
                        reasoning=reasoning_content,
                        signature=None,
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    self.content_messages.append(reasoning_msg)
                    prev_message_type = reasoning_msg.message_type
                    yield reasoning_msg

            if message_delta.tool_calls is not None and len(message_delta.tool_calls) > 0:
                tool_call = message_delta.tool_calls[0]

                # For OpenAI reasoning models, emit a hidden reasoning message before the first tool call
                # if not self.emitted_hidden_reasoning and is_openai_reasoning_model(self.model):
                #     self.emitted_hidden_reasoning = True
                #     if prev_message_type and prev_message_type != "hidden_reasoning_message":
                #         message_index += 1
                #     hidden_message = HiddenReasoningMessage(
                #         id=self.letta_message_id,
                #         date=datetime.now(timezone.utc),
                #         state="omitted",
                #         hidden_reasoning=None,
                #         otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                #     )
                #     self.content_messages.append(hidden_message)
                #     prev_message_type = hidden_message.message_type
                #     message_index += 1  # Increment for the next message
                #     yield hidden_message

                if not tool_call.function.name and not tool_call.function.arguments and not tool_call.id:
                    # No chunks to process, exit
                    return

                if tool_call.function.name:
                    self.tool_call_name += tool_call.function.name
                if tool_call.function.arguments:
                    self.tool_call_args += tool_call.function.arguments
                if tool_call.id:
                    self.tool_call_id += tool_call.id

                if self.requires_approval_tools:
                    tool_call_msg = ApprovalRequestMessage(
                        id=decrement_message_uuid(self.letta_message_id),
                        date=datetime.now(timezone.utc),
                        tool_call=ToolCallDelta(
                            name=tool_call.function.name,
                            arguments=tool_call.function.arguments,
                            tool_call_id=tool_call.id,
                        ),
                        # name=name,
                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                else:
                    if prev_message_type and prev_message_type != "tool_call_message":
                        message_index += 1
                    tool_call_delta = ToolCallDelta(
                        name=tool_call.function.name,
                        arguments=tool_call.function.arguments,
                        tool_call_id=tool_call.id,
                    )
                    tool_call_msg = ToolCallMessage(
                        id=self.letta_message_id,
                        date=datetime.now(timezone.utc),
                        tool_call=tool_call_delta,
                        tool_calls=tool_call_delta,
                        # name=name,
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    prev_message_type = tool_call_msg.message_type
                yield tool_call_msg


class SimpleOpenAIResponsesStreamingInterface:
    """
    Encapsulates the logic for streaming responses from OpenAI Responses API.
    """

    def __init__(
        self,
        is_openai_proxy: bool = False,
        messages: Optional[list] = None,
        tools: Optional[list] = None,
        requires_approval_tools: list = [],
        model: str = None,
        run_id: str | None = None,
        step_id: str | None = None,
    ):
        self.is_openai_proxy = is_openai_proxy
        self.messages = messages
        self.tools = tools
        self.requires_approval_tools = requires_approval_tools
        # We need to store the name for approvals
        self.tool_call_name = None
        # ID responses used
        self.message_id = None
        self.run_id = run_id
        self.step_id = step_id

        # Premake IDs for database writes
        self.letta_message_id = Message.generate_id()
        self.model = model
        self.final_response = None

    def get_content(self) -> list[TextContent | SummarizedReasoningContent]:
        """This includes both SummarizedReasoningContent and TextContent"""
        if self.final_response is None:
            raise ValueError("No final response available")

        content = []
        for response in self.final_response.output:
            if isinstance(response, ResponseReasoningItem):
                # TODO consider cleaning up our representation to not require indexing
                letta_summary = [SummarizedReasoningContentPart(index=i, text=part.text) for i, part in enumerate(response.summary)]
                content.append(
                    SummarizedReasoningContent(
                        id=response.id,
                        summary=letta_summary,
                        encrypted_content=response.encrypted_content,
                    )
                )
            elif isinstance(response, ResponseOutputMessage):
                if len(response.content) == 1:
                    content.append(
                        TextContent(
                            text=response.content[0].text,
                        )
                    )
                else:
                    raise ValueError(f"Got {len(response.content)} content parts, expected 1")

        return content

    def get_tool_call_object(self) -> ToolCall:
        """Useful for agent loop"""
        if self.final_response is None:
            raise ValueError("No final response available")

        tool_calls = []
        for response in self.final_response.output:
            # TODO make sure this shouldn't be ResponseCustomToolCall?
            if isinstance(response, ResponseFunctionToolCall):
                tool_calls.append(
                    ToolCall(
                        id=response.call_id,
                        function=FunctionCall(
                            name=response.name,
                            arguments=response.arguments,
                        ),
                    )
                )

        if len(tool_calls) == 0:
            raise ValueError("No tool calls available")
        if len(tool_calls) > 1:
            raise ValueError(f"Got {len(tool_calls)} tool calls, expected 1")

        return tool_calls[0]

    async def process(
        self,
        stream: AsyncStream[ResponseStreamEvent],
        ttft_span: Optional["Span"] = None,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        """
        Iterates over the OpenAI stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        # Fallback input token counting - this should only be required for non-OpenAI providers using the OpenAI client (e.g. LMStudio)
        if self.is_openai_proxy:
            raise NotImplementedError("OpenAI proxy is not supported for OpenAI Responses API")

        prev_message_type = None
        message_index = 0
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
            logger.info("OpenAIStreamingInterface: Stream processing complete.")

    async def _process_event(
        self,
        event: ResponseStreamEvent,
        ttft_span: Optional["Span"] = None,
        prev_message_type: Optional[str] = None,
        message_index: int = 0,
    ) -> AsyncGenerator[LettaMessage | LettaStopReason, None]:
        if isinstance(event, ResponseCreatedEvent):
            # No-op, just had the input events
            return
            # or yield None?

        elif isinstance(event, ResponseInProgressEvent):
            # No-op, just an indicator that we've started
            return

        elif isinstance(event, ResponseOutputItemAddedEvent):
            new_event_item = event.item

            # New "item" was added, can be reasoning, tool call, or content
            if isinstance(new_event_item, ResponseReasoningItem):
                # Look for summary delta, or encrypted_content
                summary = new_event_item.summary
                content = new_event_item.content  # NOTE: always none
                encrypted_content = new_event_item.encrypted_content
                # TODO change to summarize reasoning message, but we need to figure out the streaming indices of summary problem
                concat_summary = "".join([s.text for s in summary])
                if concat_summary != "":
                    if prev_message_type and prev_message_type != "reasoning_message":
                        message_index += 1
                    yield ReasoningMessage(
                        id=self.letta_message_id,
                        date=datetime.now(timezone.utc).isoformat(),
                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                        source="reasoner_model",
                        reasoning=concat_summary,
                        run_id=self.run_id,
                        step_id=self.step_id,
                    )
                    prev_message_type = "reasoning_message"
                else:
                    return

            elif isinstance(new_event_item, ResponseFunctionToolCall):
                # Look for call_id, name, and possibly arguments (though likely always empty string)
                call_id = new_event_item.call_id
                name = new_event_item.name
                arguments = new_event_item.arguments
                # cache for approval if/elses
                self.tool_call_name = name
                if self.tool_call_name and self.tool_call_name in self.requires_approval_tools:
                    yield ApprovalRequestMessage(
                        id=decrement_message_uuid(self.letta_message_id),
                        otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                        date=datetime.now(timezone.utc),
                        tool_call=ToolCallDelta(
                            name=name,
                            arguments=arguments if arguments != "" else None,
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
                        arguments=arguments if arguments != "" else None,
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

            elif isinstance(new_event_item, ResponseOutputMessage):
                # Look for content (may be empty list []), or contain ResponseOutputText
                if len(new_event_item.content) > 0:
                    for content_item in new_event_item.content:
                        if isinstance(content_item, ResponseOutputText):
                            # Add this as a AssistantMessage part
                            if prev_message_type and prev_message_type != "assistant_message":
                                message_index += 1
                            yield AssistantMessage(
                                id=self.letta_message_id,
                                otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                date=datetime.now(timezone.utc),
                                content=content_item.text,
                                run_id=self.run_id,
                                step_id=self.step_id,
                            )
                            prev_message_type = "assistant_message"
                else:
                    return

            else:
                # Other types we don't handle, ignore
                return

        # Reasoning summary is streaming in
        # TODO / FIXME return a SummaryReasoning type
        elif isinstance(event, ResponseReasoningSummaryPartAddedEvent):
            # This means the part got added, but likely no content yet (likely empty string)
            summary_index = event.summary_index
            part = event.part

            # If this is a follow-up summary part, we need to add leading newlines
            if summary_index > 1:
                summary_text = "\n\n" + part.text
            else:
                summary_text = part.text

            if prev_message_type and prev_message_type != "reasoning_message":
                message_index += 1
            yield ReasoningMessage(
                id=self.letta_message_id,
                date=datetime.now(timezone.utc).isoformat(),
                otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                source="reasoner_model",
                reasoning=summary_text,
                run_id=self.run_id,
            )
            prev_message_type = "reasoning_message"

        # Reasoning summary streaming
        elif isinstance(event, ResponseReasoningSummaryTextDeltaEvent):
            # NOTE: the summary is a list with indices
            summary_index = event.summary_index
            delta = event.delta
            if delta != "":
                summary_index = event.summary_index
                # Check if we need to instantiate a fresh new part
                # NOTE: we can probably use the part added and part done events, but this is safer
                # TODO / FIXME return a SummaryReasoning type
                if prev_message_type and prev_message_type != "reasoning_message":
                    message_index += 1
                yield ReasoningMessage(
                    id=self.letta_message_id,
                    date=datetime.now(timezone.utc).isoformat(),
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    source="reasoner_model",
                    reasoning=delta,
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                prev_message_type = "reasoning_message"
            else:
                return

        # Reasoning summary streaming
        elif isinstance(event, ResponseReasoningSummaryTextDoneEvent):
            # NOTE: is this inclusive of the deltas?
            # If not, we should add it to the rolling
            summary_index = event.summary_index
            text = event.text
            return

        # Reasoning summary streaming
        elif isinstance(event, ResponseReasoningSummaryPartDoneEvent):
            # NOTE: this one is definitely inclusive, so can skip
            summary_index = event.summary_index
            # text = event
            return

        # Assistant message streaming
        elif isinstance(event, ResponseContentPartAddedEvent):
            part = event.part
            if isinstance(part, ResponseOutputText):
                # Append to running
                return  # TODO
            else:
                # TODO handle
                return

        # Assistant message streaming
        elif isinstance(event, ResponseTextDeltaEvent):
            delta = event.delta
            if delta != "":
                # Append to running
                if prev_message_type and prev_message_type != "assistant_message":
                    message_index += 1
                yield AssistantMessage(
                    id=self.letta_message_id,
                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                    date=datetime.now(timezone.utc),
                    content=delta,
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
                prev_message_type = "assistant_message"
            else:
                return

        # Assistant message streaming
        elif isinstance(event, ResponseTextDoneEvent):
            # NOTE: inclusive, can skip
            text = event.text
            return

        # Assistant message done
        elif isinstance(event, ResponseContentPartDoneEvent):
            # NOTE: inclusive, can skip
            part = event.part
            return

        # Function calls
        elif isinstance(event, ResponseFunctionCallArgumentsDeltaEvent):
            # only includes delta on args
            delta = event.delta

            if self.tool_call_name and self.tool_call_name in self.requires_approval_tools:
                yield ApprovalRequestMessage(
                    id=decrement_message_uuid(self.letta_message_id),
                    otid=Message.generate_otid_from_id(decrement_message_uuid(self.letta_message_id), -1),
                    date=datetime.now(timezone.utc),
                    tool_call=ToolCallDelta(
                        name=None,
                        arguments=delta,
                        tool_call_id=None,
                    ),
                    run_id=self.run_id,
                    step_id=self.step_id,
                )
            else:
                if prev_message_type and prev_message_type != "tool_call_message":
                    message_index += 1
                tool_call_delta = ToolCallDelta(
                    name=None,
                    arguments=delta,
                    tool_call_id=None,
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

        # Function calls
        elif isinstance(event, ResponseFunctionCallArgumentsDoneEvent):
            # NOTE: inclusive
            full_args = event.arguments
            return

        # Generic
        elif isinstance(event, ResponseOutputItemDoneEvent):
            # Inclusive, so skip
            return

        # Generic finish
        elif isinstance(event, ResponseCompletedEvent):
            # NOTE we can "rebuild" the final state of the stream using the values in here, instead of relying on the accumulators
            self.final_response = event.response
            self.model = event.response.model
            self.input_tokens = event.response.usage.input_tokens
            self.output_tokens = event.response.usage.output_tokens
            self.message_id = event.response.id
            return

        else:
            logger.debug(f"Unhandled event: {event}")
            return


"""
ResponseCreatedEvent(response=Response(id='resp_0ad9f0876b2555790068c7b783d17c8192a1a12ecc0b83d381', created_at=1757919107.0, error=None, incomplete_details=None, instructions=None, metadata={}, model='gpt-5-2025-08-07', object='response', output=[], parallel_tool_calls=True, temperature=1.0, tool_choice='auto', tools=[], top_p=1.0, background=False, max_output_tokens=None, max_tool_calls=None, previous_response_id=None, prompt=None, prompt_cache_key=None, reasoning=Reasoning(effort='high', generate_summary=None, summary='detailed'), safety_identifier=None, service_tier='auto', status='in_progress', text=ResponseTextConfig(format=ResponseFormatText(type='text'), verbosity='medium'), top_logprobs=0, truncation='disabled', usage=None, user=None, store=True), sequence_number=0, type='response.created')
ResponseInProgressEvent(response=Response(id='resp_0ad9f0876b2555790068c7b783d17c8192a1a12ecc0b83d381', created_at=1757919107.0, error=None, incomplete_details=None, instructions=None, metadata={}, model='gpt-5-2025-08-07', object='response', output=[], parallel_tool_calls=True, temperature=1.0, tool_choice='auto', tools=[], top_p=1.0, background=False, max_output_tokens=None, max_tool_calls=None, previous_response_id=None, prompt=None, prompt_cache_key=None, reasoning=Reasoning(effort='high', generate_summary=None, summary='detailed'), safety_identifier=None, service_tier='auto', status='in_progress', text=ResponseTextConfig(format=ResponseFormatText(type='text'), verbosity='medium'), top_logprobs=0, truncation='disabled', usage=None, user=None, store=True), sequence_number=1, type='response.in_progress')
ResponseOutputItemAddedEvent(item=ResponseReasoningItem(id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', summary=[], type='reasoning', content=None, encrypted_content='gAAAAABox7eEiOVncSJVTjHrczwPKD0bueuhRmgzj6sBTQPnyB5TTE4T3CCoxXALshB1mkOnz48dkd8OkkqFSjZ90OmFi1uVZ9LdJQxoibXj2qUetqhwO_Lm8tcy5Yi4DHrqqhMPbGnDOuJr38PyI_Jx5BDPzJlPbDeU6a99Eg531W7nfSVCzwihekQxlcV9X0xYAvSaigCgbu75sSkx4mopcYDeBTxTjYtpJIAH4C-ygv_MyEeqTJqGdGoQ1NjmF6QJECIXir6llkHlvUHhGeAH6bUabUw7SDBk7gJnMAwDUOZVfp0GyWHRVbDfLCrP7G5nkz98iaEl9LFOcTolsrqxYI_e7k2rIejhfvvSEwgvhCOidNjjKNr3Jujt2ALJ6kGgG3fyWu81cLMobRTL6H0iQ2uT8u9XqZ2eiwHwImexRytC1sSDPK9LaBih46J66HVBKQTeRqMA7m379U8o-qLESN6AiS0PoiJvBpT3F89qJSl3rG19NwzJpPC99Ni1Dzgbr6VPqVmYBqJ5pRt98P-zcW4G72xNr1BLWgCGlCiuuNOxvn2fxPmdHt6S4422oNYb8mNkKeL7p0-6QB9C6L4WPrXUmCOr2_9-dcd1YIplHNQd7BGcbrotZIOj_kTgOvkbQa72ihDV6lNFg8w0_WO2JqubjxP4Ss22-hhtODP6dtuhWjAX5vhIS1j0lFlCRjnQsdC6j7nWhq8ymoPVrmoTE9Ej-evsvTnKO1QVXDKPrKd0y-fMmuvMghHCmhqJ5IiYT1xPX6X83HEXwZs2YY5aHHZkKcbgScAhcv0d1Rv4dp18XHzHUkM=', status=None), output_index=0, sequence_number=2, type='response.output_item.added')
ResponseReasoningSummaryPartAddedEvent(item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, part=Part(text='', type='summary_text'), sequence_number=3, summary_index=0, type='response.reasoning_summary_part.added')
ResponseReasoningSummaryTextDeltaEvent(delta='**Analy', item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=4, summary_index=0, type='response.reasoning_summary_text.delta', obfuscation='JdVJEL6G1')
ResponseReasoningSummaryTextDeltaEvent(delta='zing', item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=5, summary_index=0, type='response.reasoning_summary_text.delta', obfuscation='3g4DefV5mIyG')
ResponseReasoningSummaryTextDeltaEvent(delta=' r', item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=6, summary_index=0, type='response.reasoning_summary_text.delta', obfuscation='dCErh1m4eFG18w')
ResponseReasoningSummaryTextDeltaEvent(delta=' things', item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=214, summary_index=1, type='response.reasoning_summary_text.delta', obfuscation='hPD6t2pv9')
ResponseReasoningSummaryTextDeltaEvent(delta='!', item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=215, summary_index=1, type='response.reasoning_summary_text.delta', obfuscation='g1Sjo96fgHE4LQa')
ResponseReasoningSummaryTextDoneEvent(item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, sequence_number=216, summary_index=1, text='**Clarifying letter counts**\n\nI realize this task is straightforward: I can provide both answers. If the user is counting uppercase R\'s, the answer would be 0. For a case-insensitive count, it\'s 3. It\'s good to give both for clarity. I should keep it brief; a concise response would be: "If you\'re asking about uppercase \'R\', there are 0. If counting \'r\' regardless of case, there are 3." This way, I cover all bases without overcomplicating things!', type='response.reasoning_summary_text.done')
ResponseReasoningSummaryPartDoneEvent(item_id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', output_index=0, part=Part(text='**Clarifying letter counts**\n\nI realize this task is straightforward: I can provide both answers. If the user is counting uppercase R\'s, the answer would be 0. For a case-insensitive count, it\'s 3. It\'s good to give both for clarity. I should keep it brief; a concise response would be: "If you\'re asking about uppercase \'R\', there are 0. If counting \'r\' regardless of case, there are 3." This way, I cover all bases without overcomplicating things!', type='summary_text'), sequence_number=217, summary_index=1, type='response.reasoning_summary_part.done')
ResponseOutputItemDoneEvent(item=ResponseReasoningItem(id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', summary=[Summary(text='**Analyzing riddle ambiguity**\n\nI’m thinking about a puzzle that mixes cases to mislead, but the answer should be \'3\'. There are gotcha riddles about counting letters, like asking how many R\'s are in "Strawberry." If it\'s capitalized, the answer differs. The typical trick is that there are no capital R\'s in "strawberry." Since the user asked about uppercase R\'s but quoted the lowercase version, it\'s confusing. I should clarify if they mean uppercase \'R\' or any \'r\'.', type='summary_text'), Summary(text='**Clarifying letter counts**\n\nI realize this task is straightforward: I can provide both answers. If the user is counting uppercase R\'s, the answer would be 0. For a case-insensitive count, it\'s 3. It\'s good to give both for clarity. I should keep it brief; a concise response would be: "If you\'re asking about uppercase \'R\', there are 0. If counting \'r\' regardless of case, there are 3." This way, I cover all bases without overcomplicating things!', type='summary_text')], type='reasoning', content=None, encrypted_content='gAAAAABox7eQs7K1F8qaKB_jhBgufrTLqEXk96f-M9YyeTQ7tvQO730WOtTZtmuQ7XLiAekqxt4yrNQEmgYZhS7qQx-5oq30NlfHezcgkYqmvBqFhGtJkg_Ea6eO9WVMYaXK6nbxXvyK-HS73GvF8AN6NE72rITUE0fdlT6_VeU_OLBSDtVJXUMqbr6V4MOllzXRklbIOJCemZWRax0tenrxaVBrR4IbGoXoFbz5q2Lt8-Xc4NtuUShrzv8AU8Lm46KGvZeX2bWtS0d7-x3in6HJNk4gAFmepYh-cNbk_Qd8UVMvARb2nBjK7jHTB6IP1fDbVYYMUvX6ox8q2jPdHA7ZFRF-YFDXUyX6lwvhLGhVodqyQ4IdmZv1sJ78mvLUpuEdJrHSapA83SN6oaqpoD5cO174UKxyZnrhwQCyxPQ__lS5ZaUgnsIfgtuF5_cKATDxJFBrVo-0SwPHJZdtiCD1CYaVgUKr6uBDtUk32WCDOSJbFK5ClYM1W41x7mBLUWwBJVJ4PZVz3Cc6lR6EMa4a3SAMtIRzMY3869ox6WwDUV8TAYpSMdsb_VW3aezj0hXhnGYUrfmrmtYJEmxy36kV9GsHoBSLwXwNYbjTnP-Pni_AqlCQgZWKTI9KzJ8Zi95l617XwDJ6PzaHt2D6OSX2pmiVPwMGjZDIR6o21fBw3ZwI9TGkJitwL5O9Xlc6PQfYnk-oAVt17OZet6tXQe8LA3wq-9BQXY-88OQRrIGsnFjuGKOmaEXXDmaT1u9lGwOfSdKtU-4X67iDmy5e--lKYZrbWEVy2aoMcwMh2gTsPl-nS_fLzPdOlIgXv4DKCFf_E93LjjdyVoSFctm928rqY_qayqvP5kGx4UjPGiIxFD7tI3lEGMMFA8P0h6nE6NnZgb7pgMtgsqF17SdBKAXFLF8JtuaZulzoBdJJ_2Skq0FO7X8xynq_hhIDdwK2QU9PEfaX7h0j-kGYwVuWs8C_zispG--pHveDqPE1j9GUVrRN9W72-qNHnXRMPEDan1jq4WFN4VknDVwbnK9HR_suKJOTKGZF0MJACtaL4_FyvGfqANLky3cfWeMLpYmXec2Buo-4x8XwlRASCyvK6KXnz7K-M0SuvtoEqTBw0Pa4PBO683OtssZ-ujqMgnzFy3tTKpAabGq-Tz3Dn5fxbYgZONpE6jdTEQxBhkkvplReda3GATlskQHrQtn5Q_tvYwOIQu3iFiP9uoTtfCVQ_Tm4CIGxcEDqWnVaP1fOe8LKHwCvPf7bm046YI3oL-2do70oBJEch0JRKiI3ijrqHzXpI6e-bam9inNnzKxq0HMornRJh37HMDtME0nbXvrNSTu7k7pldDJtQ7SVIoey_PnLirAL9WdfM0HTdsAVmHgXp8u6Ta3_aob-vdrYs19TnGAh6Hp5DqC47wrDeg4RqqSWTM5PLdj4kfdmzkBB90zLMTdR_7Xq7ox64NXfaOXkyLSdFNgz3vmMGyyI3RDeDfVN8tLWfmAWKnooXp866vmdkdWp2IGiq8VWFOe20oaugm8CtT54XLlL6Hh_nipMZy_4pLTVZSsSNd1lvUn-xPMu7WD3NMEdk5b61juYsa77CLHj71vzbPVfHhmOtxqQ_Iqeh4sgPhY0FKRhblvs6yIXy__Ab9MKMYz1Cba1qAr-m9_JGNR1PzUPb7CfS-gbwBwqGoNy5ig1ir-GccsA9hB0UPORaobOGkklDI6B-aEjf8DkzEGdzXQLpJkWwv4cjJAeU1oA9R0hNAwR_STZDvmjkos7j0opRUl-qOez4pBeoRcR8T6V3uqO6OD4j0WNMkLekAGi_BE9tt25v2ClWVSeBE7M9TjlG4uOJwp_IHJZRM3VwunJt9L6ZXALck5sEdIG1EYiAgSophCMqfqUUS2cG7QkDOH-N_jGQisoKRqWJKouERgIHT9TK5ZDeL3WVQL3a-6-HH3y-Lv8UJC1-F_V15FZTgAK3SxUqeHHts6EvDKEqde9QxxTPWwhMOk6dBxNQ0jxfKn9pzNNXhasVIHnk5zn1wWJkm8P3B5sG6Oxwpsxu6ywbY4AOFjBRwHGnnO06CykNaB6uR3KxIlDo2pdidOChI1uZrqYAEDKhjGHcKUQOlgq83wz4dLciiioDYPHfexfSl91QQaQZWrAIN77AbT6e9wxXaZZNQ4Jwo9JpQNjRkoBu2_4tW317nzLj31ayK-5w07imhOBh3ziD8yx3MC7AxuIbsAWo_scZgq8h7OxwRBih9NyiYMePLTLPOPahjDQvl-4XFj4NVNNnXKsiLrxPwtxmMREZraJxcmrSzDFiYDnqkibHXQ3eYyykcjCY3kWRCszoAEYhI3a2qsfbyePgPlfynf3_8rCsb2qaiXmu93lLqrRRg0ktRXtBb3lJVlpVGezUD6Itc_BDZQJAfC0PJbf_AoLfxIVw9-Pj5p5ssxuyybJn0thiqR5CnzcK_TO4jA2PJkjdfK5zLZbyNSYp4NKUpaL1u0jxiuD_vJ30qt3hJugsTv8EvCLdtoNwuvBwjhqplPPZ8_TWCVsowYm3n9LEYWCK-EEk6D2H4_Z8gQYNWz0O735CSiAVpSZpChBRwkfOhlerp8o6k8NJmf7VEqVCE5_iwrKqllB0o8hNLPDSlzQ97EacKz6wsLBorlqTRvGvRrJqwQHwybQLkJlCinqZV9XF52kc0c9GqdKdF-aPxv5VNoPenEBDo6EpAnDyM-TRxzsWtQ71kzRQgLIi-tvO9fTA2MExrF4tv_m1CULjF2jIoeG8RZPC4zhHVd9lvyflhCVSLflF6GR2qzSQua2zqqMsfM4qYGdW83in2U5KDWc7yD7FVi_IM5F1_AKeUaPQ_9MbwCkUO8zdDSQ-eVxY051PGiKHNKTP982Legft29skJqqDZv57Oju9wtI9PmmoeozaBPv4-spuuczsMsVbl6aRLs8xQsPQoke-MUMuelF1kGIqJnMktKiN8AGB8CoU_XzBjGSV-8yJj7tCBYquF66tj5wyn5tsVWwHsi8sl-IRMrVsza1LY0mVx-6ljo97j3WME1LuCTTNF5GOZMHUfRUXgHW5aENuENS9LhsqymVK8sAeQVMVVijC1Gnq2I0ddKLwodsrzCReaqLKx4y3Q4NB0Rom76UzyODd3vzDxjUS9k-IvRbzyXYC0YO-WsngpJr8sKZ8eQqJuBSE3rjT6CEx6-Ldxf8ad-iT6rh-nJRMn27jtHaUgQdZoexMDS1yons8r-MfUYayTaAGeIiimpuCj1A-f3zpQgqqehRkxoEJmjcGLe0oRI5H-kXEk8_LZt45nCiD86HnSCBqRasFNV0lAhWy2UF2cuu0AQuixUDRRgJU5ilWuDTcnJAo-Y4T7wh06xUGuCa50mLAszVnldO-JFrYGYE5UsWTe7qSNOSNsLIJqVoR4WLJJp-FaDFpiir14v1llvh1OumR03aDCA4gOQzeFNzfkUIQNRq0sU1ReZcxLUnlNjHWFqSBfB53rerSV8mdauA91EweO3cOJ1iTUFnAST_QPB2da03hINiRWd8jSkkiUdha-t6iajgOA2w_YlP2cyZ2b-L-cVhBFx0r1VSHocASSSTK1vU1vrPwtXJdMHq6c_EcMSirybtLzpIM3WR-z1wbr2gYvPF2KR_DvsybXE3DsX4qKInsykvBLmg-0RYWcFivmBgAGcIgYLjuCaWbpi5wYi_hNbPBJw07WpxN4QOS9_CaOn0AQh0NnqgPg9DH_am9mpOutvWMKWOqMcNKaRACDCpQkGDhX8yfF6W4EihLKam0vmiYYYtnFQ19Xl59cXf8gVcbNOnElOuA3gK_4PMCYHL66tPUdhKreBlboULKLm0xgYMf3lRrPh803TG0x5L0oYAGzXcGUZIs0AtX2wmkfYSSivFsqSThLY-q2VHtiNBigEZRIWr1lfNzLFYzNipiajvFAfB1EpDpfRkjnnoV5n656y11uFcyySyiskKxZqZryqfb3HPfn8VlK3baKLMk5a0i1CZp5LswGErlk2qgwaSYSWOcHmt6z1GfJOKzrGkHFTWMzzg', status=None), output_index=0, sequence_number=218, type='response.output_item.done')
ResponseOutputItemAddedEvent(item=ResponseOutputMessage(id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', content=[], role='assistant', status='in_progress', type='message'), output_index=1, sequence_number=219, type='response.output_item.added')
ResponseContentPartAddedEvent(content_index=0, item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', output_index=1, part=ResponseOutputText(annotations=[], text='', type='output_text', logprobs=[]), sequence_number=220, type='response.content_part.added')
ResponseTextDeltaEvent(content_index=0, delta='Upper', item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', logprobs=[], output_index=1, sequence_number=221, type='response.output_text.delta', obfuscation='a8XGRatycGS')
esponseTextDeltaEvent(content_index=0, delta=' ', item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', logprobs=[], output_index=1, sequence_number=234, type='response.output_text.delta', obfuscation='Ljhu9qR46fiOkfr')
...
ResponseTextDeltaEvent(content_index=0, delta='3', item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', logprobs=[], output_index=1, sequence_number=235, type='response.output_text.delta', obfuscation='5auIEi4JmSFDF72')
ResponseTextDeltaEvent(content_index=0, delta='.', item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', logprobs=[], output_index=1, sequence_number=236, type='response.output_text.delta', obfuscation='I78DIGKqtD2P6H2')
ResponseTextDoneEvent(content_index=0, item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', logprobs=[], output_index=1, sequence_number=237, text='Uppercase R: 0. Counting r regardless of case: 3.', type='response.output_text.done')
ResponseContentPartDoneEvent(content_index=0, item_id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', output_index=1, part=ResponseOutputText(annotations=[], text='Uppercase R: 0. Counting r regardless of case: 3.', type='output_text', logprobs=[]), sequence_number=238, type='response.content_part.done')
ResponseOutputItemDoneEvent(item=ResponseOutputMessage(id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', content=[ResponseOutputText(annotations=[], text='Uppercase R: 0. Counting r regardless of case: 3.', type='output_text', logprobs=[])], role='assistant', status='completed', type='message'), output_index=1, sequence_number=239, type='response.output_item.done')
ResponseCompletedEvent(response=Response(id='resp_0ad9f0876b2555790068c7b783d17c8192a1a12ecc0b83d381', created_at=1757919107.0, error=None, incomplete_details=None, instructions=None, metadata={}, model='gpt-5-2025-08-07', object='response', output=[ResponseReasoningItem(id='rs_0ad9f0876b2555790068c7b78439888192a40c50a09625bb26', summary=[Summary(text='**Analyzing riddle ambiguity**\n\nI’m thinking about a puzzle that mixes cases to mislead, but the answer should be \'3\'. There are gotcha riddles about counting letters, like asking how many R\'s are in "Strawberry." If it\'s capitalized, the answer differs. The typical trick is that there are no capital R\'s in "strawberry." Since the user asked about uppercase R\'s but quoted the lowercase version, it\'s confusing. I should clarify if they mean uppercase \'R\' or any \'r\'.', type='summary_text'), Summary(text='**Clarifying letter counts**\n\nI realize this task is straightforward: I can provide both answers. If the user is counting uppercase R\'s, the answer would be 0. For a case-insensitive count, it\'s 3. It\'s good to give both for clarity. I should keep it brief; a concise response would be: "If you\'re asking about uppercase \'R\', there are 0. If counting \'r\' regardless of case, there are 3." This way, I cover all bases without overcomplicating things!', type='summary_text')], type='reasoning', content=None, encrypted_content='gAAAAABox7eRIRNnSmrunATD6UBi-Hm77E5JggsaXTKrNH-6ZkwIcosPQPf4vVdjR3ywdcYr4pr2Od3C0ADYSUpyR35tyusZq8A8yR-EmpgA-7otyIGLk5zzZy3AqKv2zZElkvgcr8PEKpYpC8VS6AO4Qg3g_gvBD8eV8j2O_FtGTIQ5MKS_Q0_gf9BCJtkh-PgYjL-0bEXsmCfgPa37BogC4nYh42b5hc7vge3ZH_RmR3irxWontsGaUIkOxR8_oK3RGKvkLfR24QYd4U8BIiZk3G58cR1UDRmtvfHwM4E7W6mpog-dFe9D-V96q1OWBGsNObyHxJcoSNGLxHkxWRvGnq3aWts_Lh-srgJ50rIa19pnOzfXePfdNxdXy7dYXD0D1uiBibpX5nneKUr1C0QmQdwS_nW16pr1oNKZ2fVkZJDTn31rOR3WfvtY9gL7tKo_CMnJ8jT3YKhZxFHG9PhHEoA5OsE_QC-3To54meckPExJqrVJ-h3u_5S4lHK9xu8buzIv4WM92X91zeX98A3g_YkqqvoTUmkFyMoIr8PVxM6Cmg4JtooT9bL2FAVUo6MV2_tlX07hNNH-hWSgqZHMVdx3_cTDAfKW3cAbwaG16ApgK_VUUc7rIfygHxgxtW-YeZpbETlvdNrDIDhzhuPQqPB86DQFh9O262o3cvBHok7V0WVqq-KXH5mH-eio7MhZJ46Ri4qklU9Xn77Tw4zl1cw029FuDKwF0_KsFZ8Omayi5iWJoZFjzqhATR_qt2J3nr368skIHDQ1tSa1vUAJt4UM7A4Un9KG2syCydoAmVQYoRgc5niiWU9FFouzulKW_cfyLrJDlVN1EfaUx2xVzaJO-LhdimhDiP4CKk5DsvEuuhTDn9RkO19cz7eJdrt_wGthYRlcJ-5bSFsSG1UV4VlovcLjuqApc5Fsis9kRo0jkar53HM7rmI7t9uN3TcTCQWGpbDvi-OQblbdvNFZh8wy-BaC0SFtOwcVkhwR2CDCf-7FuB5HOJnzmSOtKDZoFrA9gspNZjXoV6LCKmKIGj_tRLaI9jsn9iZZ7Bdtv2SLw7blE53f4OesXbsC0evl9GzlJfIsiaO1I5pEGCT2sWitWyHrbQLJTWeUBi6SoeULpujVp_w25xJonbCD9HAV51bD6rmAI9LEj0bYOBJ1RmtESAqZpV2wj68i-tv5ejdQ-YXOXSuy4DwInYsALmGMRhFFf0tKhNLHMVdCOij0zo4fU24EhmfxMRZifapm4fDBe2bswE10_LJI2DhzLv_NwQfHMQ0qEDOZQss74qaggBnsr4N-OK6egO3RJYCFddDFUa9vwxYIBHjlqb2p7tX4YpugHQ0ZmDYpUAwRzUmcwYaLjs9lzskQzzpOCeKXmwksWWOax-aWkkw9ic17PTAqne84_LMSNnY4mPOYU4sQ0DxdfNX_2iGVrWSkP3XcLUut1OH6Mah-yWaioJbLoXIpxbngW-IAm3Uxafha94fOHSaMymRYG8ZIbKHvg6n3tud08gBfiiJON5CLCovoKkAeGC3-NQQC58341osMVKSRF6SEpsHMGd97lMdWTlkB3v29m-xf8nuCOqgk4Ig5gIodter_BWs2BEXLiw5ISDBvdl26FVUUoBOpexXFwf99wTroDPK85UYlH5W9m51FlSwfgm0Vg5N9nzivMGClDy_jvNDyI5UHnQjVuqnTAcK0nF6RJn-lnO6hT60qq9hRsqa84iUMqOmQZxXv1KbS0exoqfrqps6ILqifM93r87HVzrrCShWFB1A7hfJHoVqRq-PLsO2iv-V6v9S5_nFwYGG8srrNUuNgzLvLB9J7hlN6fPL4f6vWIJ9sBVpPukR-Pr_I8q8hZicr3YVshIuB544w-srUH4OvRx5v5pz9Jfcm2hHZZjO2yaVDAWKQ_PQk0xj43b-pyrjpAznYdG1QMmFcTfjqVDal97EQeMjIAIjlah0BOqhzHtT0dBjYLyBXZwzO7ii7z-6-jQk5FIDX-RqrdHm8D41dTHx-W7LMvNwpW6ueir7HVoYdIZAP0qaSU-Nf3oJTK8wGhRsh4G3PBsrGbamsfK7c2-AYi_f6kcvXWE4G7ch6c5H6cVqrriil8AcjUZ422dIkFIJHfhbPeAIFy6zuDm9ZnZvgjyqI_mnnK0hlLzfSgJFV6QRAYdkmiviit4qIwEOobM6zYeYPdb09Y15MDLcCOM1KpCecaSJDZm4PrnvP3F0nUpYHvVygA1C-CPenmCjeC_AqWMJ_BVXQyIcVx31fxZCvBIkEskI9Wm6qfJkN8IYw00_X4PnpV-u9d6poChA2smfOsFaeHqoNE_RmPO_QTqHE4m6xBH2RueVnIt4QZ2NVOFyZUI4vBEOsNOXYQpw8tkzONR3FcRRsp2qWNXfmTVdrkVR_-oQpUSlkhQKKo9thNq6SpDezaMUpWjMpi1lgaIZUbSU0WUq3A2EtpWW1yJQjuA2rosQYh2zgILAEtyYgu0Qh5qqsKQB_7oyv3LOB5JHVYa94H1xqHwk9XVfOM6Eeszb1-FYZ3ibagpOiIzPPrGhZA1FIfdVDLk3ulDR7l3-NZZD48SkbkxlnJqbjksgtoM-0AAPVV7q4OSH9MBHK29yVJRahzoFei9toYhD2qN3Mo-HVbWPOo89wJ8LKnwTTF02RUcA4xstjuD5B4IEGF2fMprohnlYVpULejRkkga3Mt6wdjLHzJY4WHkSaGfrDChgMfRpAhtPYQ4sSf4FVFaeT6up-1pU3o-n56zibIwHDfmB_rXEXHLIpaUBEDo7-X8TXZ8SvS-isKwmExJxDtjUI_pglFcThIfigVOJvyemEQ11iLmcoIw6vj5Zge3xzxR7pJgiHbGXhbUpYIJyvrol7NIBZwW_AhgE0WJEjrq9ffdoE9OB311ZZbES2q-ghlfGKgyFrrZNgpY_mYCjd8yx5APWvBYoj-w1WxL42Q0bE3DSyBM9JOwb8t1SPNNduz01MVsbj6_zbya7KDW4pHGiU-4Dh-YU8q9ndeuIezb7km6vQn6zjOfLLPXSkIH99RgAn-eNMPdk5CZWXm16nqgpL1ZtxivXhPItlq2p5akhj64_nreXLe2bKscR7syMZ_9xRC1u9EdomxyuJx6HAB-Jo7_AatJcYeI0BNLiGjnflLnbqwP0jH9_6Q2ucC9oNoNNtiyzq-Wy7zW9Q9eDCL8zVfKVAwNkyvzKSra8EJ6u-ukskCAXmN09_WUXQC00H7foIKOhhn4LXT9LoVgFblMsVjm_bBzXQuEA11Bc3RAJHUyLlpH9K-vz1Zebn-1AUDSlEQENIkzW6TpnoumA1m728tvaF8byNOqKgfRdftIixRHmKYUPrgKXrJErEz6P_n2MJvOvvCVH03o_Dpoh19PY6Rcvv1t56SaUCzdEyTcsVP9JRNh26HckesWjb2IfJsDuGrjlX5V5FabPImAKVRGzwNW5lJLwB59OBGkS4xXxI_vwzFiwrP6Pb2DPVgw3-Epe017D0atbZVs6Oik-14Q9uLrxBz4X2EV0HK_nnkg3mndj2LDBEXtCFky6sIrWer4W3i4Ksrfe5oxGiV02tjNNzFSqHg_z9QX43kTbcBePuYDlMRJ2DwmBykJUXdLcT4j9FlQ9BwOSAKHNaE35j-YZkASDYKqRn5SL9zC71C2qyJVDQ-5cw9GRaFZfLDKO6ySv7yZb367UpQ1uUUzqsyivAYA8jqez7LV0Yxz_hq5mBKE-NdHf-EU9uHHg1zkB73pk1wFOqE5siD0fjr7IkU3R3OcTsNSXEMa63jfeiODcSEoKwcOB8gxG-3Xwh1ueQO6sGvP7Z6sWBfPeWlmA662QytXV7njzFerjuXVRLbCfUg1v26xoPdh2jCKN_GZXroctfpV5LuOGfXd6xjgEpDq4CxNLFmNfVAZBKMQ-Fxk_szAtGpOB3lPcJTdy73VelN_L-adhUGmJmETqqK77CFTYze80l1c_lzWn6zNvS6T5HmLaNFdf5m-Rl_DSEijvJiqZrkY-Ff_R3FthqM4NZDrxwkkX99uXbkEqXjReJ', status=None), ResponseOutputMessage(id='msg_0ad9f0876b2555790068c7b790e5388192aa7d4d442882790a', content=[ResponseOutputText(annotations=[], text='Uppercase R: 0. Counting r regardless of case: 3.', type='output_text', logprobs=[])], role='assistant', status='completed', type='message')], parallel_tool_calls=True, temperature=1.0, tool_choice='auto', tools=[], top_p=1.0, background=False, max_output_tokens=None, max_tool_calls=None, previous_response_id=None, prompt=None, prompt_cache_key=None, reasoning=Reasoning(effort='high', generate_summary=None, summary='detailed'), safety_identifier=None, service_tier='default', status='completed', text=ResponseTextConfig(format=ResponseFormatText(type='text'), verbosity='medium'), top_logprobs=0, truncation='disabled', usage=ResponseUsage(input_tokens=19, input_tokens_details=InputTokensDetails(cached_tokens=0), output_tokens=598, output_tokens_details=OutputTokensDetails(reasoning_tokens=576), total_tokens=617), user=None, store=True), sequence_number=240, type='response.completed')
"""
