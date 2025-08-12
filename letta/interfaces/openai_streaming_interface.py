import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Optional

from openai import AsyncStream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.llm_api.openai_client import is_openai_reasoning_model
from letta.local_llm.utils import num_tokens_from_functions, num_tokens_from_messages
from letta.log import get_logger
from letta.schemas.letta_message import AssistantMessage, LettaMessage, ReasoningMessage, ToolCallDelta, ToolCallMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, TextContent
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall
from letta.server.rest_api.json_parser import OptimisticJSONParser
from letta.streaming_utils import JSONInnerThoughtsExtractor
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
    ):
        self.use_assistant_message = use_assistant_message
        self.assistant_message_tool_name = DEFAULT_MESSAGE_TOOL
        self.assistant_message_tool_kwarg = DEFAULT_MESSAGE_TOOL_KWARG

        self.optimistic_json_parser: OptimisticJSONParser = OptimisticJSONParser()
        self.function_args_reader = JSONInnerThoughtsExtractor(wait_for_first_key=True)  # TODO: pass in kwarg
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

            logger.error("Error processing stream: %s", e, traceback.format_exc())
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

                            else:
                                if prev_message_type and prev_message_type != "tool_call_message":
                                    message_index += 1
                                self.tool_call_name = str(self.function_name_buffer)
                                tool_call_msg = ToolCallMessage(
                                    id=self.letta_message_id,
                                    date=datetime.now(timezone.utc),
                                    tool_call=ToolCallDelta(
                                        name=self.function_name_buffer,
                                        arguments=None,
                                        tool_call_id=self.function_id_buffer,
                                    ),
                                    otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
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
                                # do an additional parse on the updates_main_json
                                if self.function_args_buffer:
                                    updates_main_json = self.function_args_buffer + updates_main_json
                                    self.function_args_buffer = None

                                    # Pretty gross hardcoding that assumes that if we're toggling into the keywords, we have the full prefix
                                    match_str = '{"' + self.assistant_message_tool_kwarg + '":"'
                                    if updates_main_json == match_str:
                                        updates_main_json = None

                                else:
                                    # Some hardcoding to strip off the trailing "}"
                                    if updates_main_json in ["}", '"}']:
                                        updates_main_json = None
                                    if updates_main_json and len(updates_main_json) > 0 and updates_main_json[-1:] == '"':
                                        updates_main_json = updates_main_json[:-1]

                                if not updates_main_json:
                                    # early exit to turn into content mode
                                    pass

                                # There may be a buffer from a previous chunk, for example
                                # if the previous chunk had arguments but we needed to flush name
                                if self.function_args_buffer:
                                    # In this case, we should release the buffer + new data at once
                                    combined_chunk = self.function_args_buffer + updates_main_json

                                    if prev_message_type and prev_message_type != "assistant_message":
                                        message_index += 1
                                    assistant_message = AssistantMessage(
                                        id=self.letta_message_id,
                                        date=datetime.now(timezone.utc),
                                        content=combined_chunk,
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                    )
                                    prev_message_type = assistant_message.message_type
                                    yield assistant_message
                                    # Store the ID of the tool call so allow skipping the corresponding response
                                    if self.function_id_buffer:
                                        self.prev_assistant_message_id = self.function_id_buffer
                                    # clear buffer
                                    self.function_args_buffer = None
                                    self.function_id_buffer = None

                                else:
                                    # If there's no buffer to clear, just output a new chunk with new data
                                    # TODO: THIS IS HORRIBLE
                                    # TODO: WE USE THE OLD JSON PARSER EARLIER (WHICH DOES NOTHING) AND NOW THE NEW JSON PARSER
                                    # TODO: THIS IS TOTALLY WRONG AND BAD, BUT SAVING FOR A LARGER REWRITE IN THE NEAR FUTURE
                                    parsed_args = self.optimistic_json_parser.parse(self.current_function_arguments)

                                    if parsed_args.get(self.assistant_message_tool_kwarg) and parsed_args.get(
                                        self.assistant_message_tool_kwarg
                                    ) != self.current_json_parse_result.get(self.assistant_message_tool_kwarg):
                                        new_content = parsed_args.get(self.assistant_message_tool_kwarg)
                                        prev_content = self.current_json_parse_result.get(self.assistant_message_tool_kwarg, "")
                                        # TODO: Assumes consistent state and that prev_content is subset of new_content
                                        diff = new_content.replace(prev_content, "", 1)

                                        # quick patch to mitigate double message streaming error
                                        # TODO: root cause this issue and remove patch
                                        if diff != "" and "\\n" not in new_content:
                                            converted_new_content = new_content.replace("\n", "\\n")
                                            converted_content_diff = converted_new_content.replace(prev_content, "", 1)
                                            if converted_content_diff == "":
                                                diff = converted_content_diff

                                        self.current_json_parse_result = parsed_args
                                        if prev_message_type and prev_message_type != "assistant_message":
                                            message_index += 1
                                        assistant_message = AssistantMessage(
                                            id=self.letta_message_id,
                                            date=datetime.now(timezone.utc),
                                            content=diff,
                                            # name=name,
                                            otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                        )
                                        prev_message_type = assistant_message.message_type
                                        yield assistant_message

                                    # Store the ID of the tool call so allow skipping the corresponding response
                                    if self.function_id_buffer:
                                        self.prev_assistant_message_id = self.function_id_buffer
                                    # clear buffers
                                    self.function_id_buffer = None
                            else:

                                # There may be a buffer from a previous chunk, for example
                                # if the previous chunk had arguments but we needed to flush name
                                if self.function_args_buffer:
                                    # In this case, we should release the buffer + new data at once
                                    combined_chunk = self.function_args_buffer + updates_main_json
                                    if prev_message_type and prev_message_type != "tool_call_message":
                                        message_index += 1
                                    tool_call_msg = ToolCallMessage(
                                        id=self.letta_message_id,
                                        date=datetime.now(timezone.utc),
                                        tool_call=ToolCallDelta(
                                            name=self.function_name_buffer,
                                            arguments=combined_chunk,
                                            tool_call_id=self.function_id_buffer,
                                        ),
                                        # name=name,
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
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
                                    tool_call_msg = ToolCallMessage(
                                        id=self.letta_message_id,
                                        date=datetime.now(timezone.utc),
                                        tool_call=ToolCallDelta(
                                            name=None,
                                            arguments=updates_main_json,
                                            tool_call_id=self.function_id_buffer,
                                        ),
                                        # name=name,
                                        otid=Message.generate_otid_from_id(self.letta_message_id, message_index),
                                    )
                                    prev_message_type = tool_call_msg.message_type
                                    yield tool_call_msg
                                    self.function_id_buffer = None
