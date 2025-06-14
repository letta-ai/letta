from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional

from openai import AsyncStream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.helpers.datetime_helpers import get_utc_timestamp_ns, ns_to_ms
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.letta_message import AssistantMessage, LettaMessage, ReasoningMessage, ToolCallDelta, ToolCallMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall
from letta.server.rest_api.json_parser import OptimisticJSONParser
from letta.streaming_utils import JSONInnerThoughtsExtractor

logger = get_logger(__name__)


class OpenAIStreamingInterface:
    """
    Encapsulates the logic for streaming responses from OpenAI.
    This class handles parsing of partial tokens, pre-execution messages,
    and detection of tool call events.
    """

    def __init__(self, use_assistant_message: bool = False, put_inner_thoughts_in_kwarg: bool = False):
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

        # token counters
        self.input_tokens = 0
        self.output_tokens = 0

        self.content_buffer: List[str] = []
        self.tool_call_name: Optional[str] = None
        self.tool_call_id: Optional[str] = None
        self.reasoning_messages = []

    def get_reasoning_content(self) -> List[TextContent]:
        content = "".join(self.reasoning_messages).strip()
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
        provider_request_start_timestamp_ns: Optional[int] = None,
    ) -> AsyncGenerator[LettaMessage, None]:
        """
        Iterates over the OpenAI stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        first_chunk = True
        try:
            async with stream:
                prev_message_type = None
                message_index = 0
                async for chunk in stream:
                    if first_chunk and ttft_span is not None and provider_request_start_timestamp_ns is not None:
                        now = get_utc_timestamp_ns()
                        ttft_ns = now - provider_request_start_timestamp_ns
                        ttft_span.add_event(
                            name="openai_time_to_first_token_ms", attributes={"openai_time_to_first_token_ms": ns_to_ms(ttft_ns)}
                        )
                        metric_attributes = get_ctx_attributes()
                        metric_attributes["model.name"] = chunk.model
                        MetricRegistry().ttft_ms_histogram.record(ns_to_ms(ttft_ns), metric_attributes)

                        first_chunk = False

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
                                updates_main_json, updates_inner_thoughts = self.function_args_reader.process_fragment(
                                    tool_call.function.arguments
                                )

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

                                        # use_assisitant_message means that we should also not release main_json raw, and instead should only release the contents of "message": "..."
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
                                                continue

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
        except Exception as e:
            logger.error("Error processing stream: %s", e)
            stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
            yield stop_reason
            raise
        finally:
            logger.info("OpenAIStreamingInterface: Stream processing complete.")
