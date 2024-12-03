import asyncio
import json
import warnings
from collections import deque
from datetime import datetime
from typing import AsyncGenerator, Optional, Union

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import (
    AssistantMessage,
    FunctionCall,
    FunctionCallMessage,
    FunctionReturn,
    InternalMonologue,
    LegacyFunctionCallMessage,
    LegacyLettaMessage,
    LettaMessage,
)
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionChunkResponse
from letta.streaming_interface import AgentChunkStreamingInterface
from letta.streaming_utils import (
    FunctionArgumentsStreamHandler,
    JSONInnerThoughtsExtractor,
)


class VoiceStreamingServerInterface(AgentChunkStreamingInterface):
    """Maintain a generator that is a proxy for self.process_chunk()

    Usage:
    - The main POST SSE code that launches the streaming request
      will call .process_chunk with each incoming stream (as a handler)
    -

    NOTE: this interface is SINGLE THREADED, and meant to be used
    with a single agent. A multi-agent implementation of this interface
    should maintain multiple generators and index them with the request ID
    """

    def __init__(
        self,
        multi_step=True,
        # Related to if we want to try and pass back the AssistantMessage as a special case function
        assistant_message_tool_name=DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg=DEFAULT_MESSAGE_TOOL_KWARG,
        # Related to if we expect inner_thoughts to be in the kwargs
        inner_thoughts_in_kwargs=True,
        inner_thoughts_kwarg=INNER_THOUGHTS_KWARG,
    ):
        # If streaming mode, ignores base interface calls like .assistant_message, etc
        self.streaming_mode = False
        # NOTE: flag for supporting legacy 'stream' flag where send_message is treated specially
        self.nonstreaming_legacy_mode = False
        # If chat completion mode, creates a "chatcompletion-style" stream, but with concepts remapped
        self.streaming_chat_completion_mode = False
        self.streaming_chat_completion_mode_function_name = None  # NOTE: sadly need to track state during stream
        # If chat completion mode, we need a special stream reader to
        # turn function argument to send_message into a normal text stream
        self.streaming_chat_completion_json_reader = FunctionArgumentsStreamHandler(json_key=assistant_message_tool_kwarg)

        self._chunks = deque()
        self._event = asyncio.Event()  # Use an event to notify when chunks are available
        self._active = True  # This should be set to False to stop the generator

        # if multi_step = True, the stream ends when the agent yields
        # if multi_step = False, the stream ends when the step ends
        self.multi_step = multi_step
        self.multi_step_indicator = MessageStreamStatus.done_step
        self.multi_step_gen_indicator = MessageStreamStatus.done_generation

        # Support for AssistantMessage
        self.use_assistant_message = False  # TODO: Remove this
        self.assistant_message_tool_name = assistant_message_tool_name
        self.assistant_message_tool_kwarg = assistant_message_tool_kwarg

        # Support for inner_thoughts_in_kwargs
        self.inner_thoughts_in_kwargs = inner_thoughts_in_kwargs
        self.inner_thoughts_kwarg = inner_thoughts_kwarg
        # A buffer for accumulating function arguments (we want to buffer keys and run checks on each one)
        self.function_args_reader = JSONInnerThoughtsExtractor(inner_thoughts_key=inner_thoughts_kwarg, wait_for_first_key=True)
        # Two buffers used to make sure that the 'name' comes after the inner thoughts stream (if inner_thoughts_in_kwargs)
        self.function_name_buffer = None
        self.function_args_buffer = None
        self.function_id_buffer = None

        # extra prints
        self.debug = False
        self.timeout = 30

    def _reset_inner_thoughts_json_reader(self):
        # A buffer for accumulating function arguments (we want to buffer keys and run checks on each one)
        self.function_args_reader = JSONInnerThoughtsExtractor(inner_thoughts_key=self.inner_thoughts_kwarg, wait_for_first_key=True)
        # Two buffers used to make sure that the 'name' comes after the inner thoughts stream (if inner_thoughts_in_kwargs)
        self.function_name_buffer = None
        self.function_args_buffer = None
        self.function_id_buffer = None

    async def _create_generator(self) -> AsyncGenerator[Union[LettaMessage, LegacyLettaMessage, MessageStreamStatus], None]:
        """An asynchronous generator that yields chunks as they become available."""
        while self._active:
            try:
                # Wait until there is an item in the deque or the stream is deactivated
                await asyncio.wait_for(self._event.wait(), timeout=self.timeout)  # 30 second timeout
            except asyncio.TimeoutError:
                break  # Exit the loop if we timeout

            while self._chunks:
                yield self._chunks.popleft()

            # Reset the event until a new item is pushed
            self._event.clear()

    def get_generator(self) -> AsyncGenerator:
        """Get the generator that yields processed chunks."""
        if not self._active:
            # If the stream is not active, don't return a generator that would produce values
            raise StopIteration("The stream has not been started or has been ended.")
        return self._create_generator()

    def _push_to_buffer(
        self,
        item: Union[
            # signal on SSE stream status [DONE_GEN], [DONE_STEP], [DONE]
            MessageStreamStatus,
            # the non-streaming message types
            LettaMessage,
            LegacyLettaMessage,
            # the streaming message types
            ChatCompletionChunkResponse,
        ],
    ):
        """Add an item to the deque"""
        assert self._active, "Generator is inactive"
        assert (
            isinstance(item, LettaMessage) or isinstance(item, LegacyLettaMessage) or isinstance(item, MessageStreamStatus)
        ), f"Wrong type: {type(item)}"

        self._chunks.append(item)
        self._event.set()  # Signal that new data is available

    def stream_start(self):
        """Initialize streaming by activating the generator and clearing any old chunks."""
        self.streaming_chat_completion_mode_function_name = None

        if not self._active:
            self._active = True
            self._chunks.clear()
            self._event.clear()

    def stream_end(self):
        """Clean up the stream by deactivating and clearing chunks."""
        self.streaming_chat_completion_mode_function_name = None

        if not self.streaming_chat_completion_mode and not self.nonstreaming_legacy_mode:
            self._push_to_buffer(self.multi_step_gen_indicator)

        # Wipe the inner thoughts buffers
        self._reset_inner_thoughts_json_reader()

    def step_complete(self):
        """Signal from the agent that one 'step' finished (step = LLM response + tool execution)"""
        if not self.multi_step:
            # end the stream
            self._active = False
            self._event.set()  # Unblock the generator if it's waiting to allow it to complete
        elif not self.streaming_chat_completion_mode and not self.nonstreaming_legacy_mode:
            # signal that a new step has started in the stream
            self._push_to_buffer(self.multi_step_indicator)

        # Wipe the inner thoughts buffers
        self._reset_inner_thoughts_json_reader()

    def step_yield(self):
        """If multi_step, this is the true 'stream_end' function."""
        self._active = False
        self._event.set()  # Unblock the generator if it's waiting to allow it to complete

    @staticmethod
    def clear():
        return

    def _process_chunk_to_openai_style(self, chunk: ChatCompletionChunkResponse) -> Optional[dict]:
        """Chunks should look like OpenAI, but be remapped from letta-style concepts.

        inner_thoughts are silenced:
          - means that 'content' -> /dev/null
        send_message is a "message"
          - means that tool call to "send_message" should map to 'content'

        TODO handle occurance of multi-step function calling
        TODO handle partial stream of "name" in tool call
        """
        proxy_chunk = chunk.model_copy(deep=True)

        choice = chunk.choices[0]
        message_delta = choice.delta

        # inner thoughts
        if message_delta.content is not None:
            # skip inner monologue
            return None

        # tool call
        elif message_delta.tool_calls is not None and len(message_delta.tool_calls) > 0:
            tool_call = message_delta.tool_calls[0]

            if tool_call.function:

                # Track the function name while streaming
                # If we were previously on a 'send_message', we need to 'toggle' into 'content' mode
                if tool_call.function.name:
                    if self.streaming_chat_completion_mode_function_name is None:
                        self.streaming_chat_completion_mode_function_name = tool_call.function.name
                    else:
                        self.streaming_chat_completion_mode_function_name += tool_call.function.name

                    if tool_call.function.name == "send_message":
                        # early exit to turn into content mode
                        self.streaming_chat_completion_json_reader.reset()
                        return None

                if tool_call.function.arguments:
                    if self.streaming_chat_completion_mode_function_name == "send_message":
                        cleaned_func_args = self.streaming_chat_completion_json_reader.process_json_chunk(tool_call.function.arguments)
                        if cleaned_func_args is None:
                            return None
                        else:
                            # Wipe tool call
                            proxy_chunk.choices[0].delta.tool_calls = None
                            # Replace with 'content'
                            proxy_chunk.choices[0].delta.content = cleaned_func_args

        processed_chunk = proxy_chunk.model_dump(exclude_none=True)

        return processed_chunk

    def process_chunk(self, chunk: ChatCompletionChunkResponse, message_id: str, message_date: datetime):
        """Process a streaming chunk from an OpenAI-compatible server.

        Example data from non-streaming response looks like:

        data: {"function_call": "send_message({'message': \"Ah, the age-old question, Chad. The meaning of life is as subjective as the life itself. 42, as the supercomputer 'Deep Thought' calculated in 'The Hitchhiker's Guide to the Galaxy', is indeed an answer, but maybe not the one we're after. Among other things, perhaps life is about learning, experiencing and connecting. What are your thoughts, Chad? What gives your life meaning?\"})", "date": "2024-02-29T06:07:48.844733+00:00"}

        data: {"assistant_message": "Ah, the age-old question, Chad. The meaning of life is as subjective as the life itself. 42, as the supercomputer 'Deep Thought' calculated in 'The Hitchhiker's Guide to the Galaxy', is indeed an answer, but maybe not the one we're after. Among other things, perhaps life is about learning, experiencing and connecting. What are your thoughts, Chad? What gives your life meaning?", "date": "2024-02-29T06:07:49.846280+00:00"}

        data: {"function_return": "None", "status": "success", "date": "2024-02-29T06:07:50.847262+00:00"}
        """
        # print("Processed CHUNK:", chunk)

        # Example where we just pass through the raw stream from the underlying OpenAI SSE stream
        processed_chunk = chunk.model_dump_json(exclude_none=True)
        if processed_chunk is None:
            return

        self._push_to_buffer(processed_chunk)

    def user_message(self, msg: str, msg_obj: Optional[Message] = None):
        """Letta receives a user message"""
        return

    def internal_monologue(self, msg: str, msg_obj: Optional[Message] = None):
        """Letta generates some internal monologue"""
        if not self.streaming_mode:

            # create a fake "chunk" of a stream
            # processed_chunk = {
            #     "internal_monologue": msg,
            #     "date": msg_obj.created_at.isoformat() if msg_obj is not None else get_utc_time().isoformat(),
            #     "id": str(msg_obj.id) if msg_obj is not None else None,
            # }
            assert msg_obj is not None, "Internal monologue requires msg_obj references for metadata"
            processed_chunk = InternalMonologue(
                id=msg_obj.id,
                date=msg_obj.created_at,
                internal_monologue=msg,
            )

            self._push_to_buffer(processed_chunk)

        return

    def assistant_message(self, msg: str, msg_obj: Optional[Message] = None):
        """Letta uses send_message"""

        # NOTE: this is a no-op, we handle this special case in function_message instead
        return

    def function_message(self, msg: str, msg_obj: Optional[Message] = None):
        """Letta calls a function"""

        # TODO handle 'function' messages that indicate the start of a function call
        assert msg_obj is not None, "StreamingServerInterface requires msg_obj references for metadata"

        if msg.startswith("Running "):
            if not self.streaming_mode:
                # create a fake "chunk" of a stream
                assert msg_obj.tool_calls is not None and len(msg_obj.tool_calls) > 0, "Function call required for function_message"
                function_call = msg_obj.tool_calls[0]

                if self.nonstreaming_legacy_mode:
                    # Special case where we want to send two chunks - one first for the function call, then for send_message

                    # Should be in the following legacy style:
                    # data: {
                    #   "function_call": "send_message({'message': 'Chad, ... ask?'})",
                    #   "id": "771748ee-120a-453a-960d-746570b22ee5",
                    #   "date": "2024-06-22T23:04:32.141923+00:00"
                    # }
                    try:
                        func_args = json.loads(function_call.function.arguments)
                    except:
                        func_args = function_call.function.arguments
                    # processed_chunk = {
                    #     "function_call": f"{function_call.function.name}({func_args})",
                    #     "id": str(msg_obj.id),
                    #     "date": msg_obj.created_at.isoformat(),
                    # }
                    processed_chunk = LegacyFunctionCallMessage(
                        id=msg_obj.id,
                        date=msg_obj.created_at,
                        function_call=f"{function_call.function.name}({func_args})",
                    )
                    self._push_to_buffer(processed_chunk)

                    if function_call.function.name == "send_message":
                        try:
                            # processed_chunk = {
                            #     "assistant_message": func_args["message"],
                            #     "id": str(msg_obj.id),
                            #     "date": msg_obj.created_at.isoformat(),
                            # }
                            processed_chunk = AssistantMessage(
                                id=msg_obj.id,
                                date=msg_obj.created_at,
                                assistant_message=func_args["message"],
                            )
                            self._push_to_buffer(processed_chunk)
                        except Exception as e:
                            print(f"Failed to parse function message: {e}")

                else:

                    try:
                        func_args = json.loads(function_call.function.arguments)
                    except:
                        warnings.warn(f"Failed to parse function arguments: {function_call.function.arguments}")
                        func_args = {}

                    if (
                        self.use_assistant_message
                        and function_call.function.name == self.assistant_message_tool_name
                        and self.assistant_message_tool_kwarg in func_args
                    ):
                        processed_chunk = AssistantMessage(
                            id=msg_obj.id,
                            date=msg_obj.created_at,
                            assistant_message=func_args[self.assistant_message_tool_kwarg],
                        )
                    else:
                        processed_chunk = FunctionCallMessage(
                            id=msg_obj.id,
                            date=msg_obj.created_at,
                            function_call=FunctionCall(
                                name=function_call.function.name,
                                arguments=function_call.function.arguments,
                                function_call_id=function_call.id,
                            ),
                        )

                    # processed_chunk = {
                    #     "function_call": {
                    #         "name": function_call.function.name,
                    #         "arguments": function_call.function.arguments,
                    #     },
                    #     "id": str(msg_obj.id),
                    #     "date": msg_obj.created_at.isoformat(),
                    # }
                    self._push_to_buffer(processed_chunk)

                return
            else:
                return

        elif msg.startswith("Ran "):
            return

        elif msg.startswith("Success: "):
            msg = msg.replace("Success: ", "")
            # new_message = {"function_return": msg, "status": "success"}
            assert msg_obj.tool_call_id is not None
            new_message = FunctionReturn(
                id=msg_obj.id,
                date=msg_obj.created_at,
                function_return=msg,
                status="success",
                function_call_id=msg_obj.tool_call_id,
            )

        elif msg.startswith("Error: "):
            msg = msg.replace("Error: ", "")
            # new_message = {"function_return": msg, "status": "error"}
            assert msg_obj.tool_call_id is not None
            new_message = FunctionReturn(
                id=msg_obj.id,
                date=msg_obj.created_at,
                function_return=msg,
                status="error",
                function_call_id=msg_obj.tool_call_id,
            )

        else:
            # NOTE: generic, should not happen
            raise ValueError(msg)
            new_message = {"function_message": msg}

        self._push_to_buffer(new_message)
