import asyncio
from collections import deque
from datetime import datetime
from typing import AsyncGenerator, Optional, Union

from openai.types.chat.chat_completion_chunk import ChatCompletionChunk, Choice, ChoiceDelta

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import LettaMessage
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionChunkResponse
from letta.server.rest_api.optimistic_json_parser import OptimisticJSONParser
from letta.streaming_interface import AgentChunkStreamingInterface

logger = get_logger(__name__)


class ChatCompletionsStreamingInterface(AgentChunkStreamingInterface):
    """
    Provides an asynchronous streaming mechanism for LLM output. Internally
    maintains a queue of chunks that can be consumed via an async generator.

    Key Behaviors:
    - process_chunk: Accepts ChatCompletionChunkResponse objects (e.g. from an
      OpenAI-like streaming API), potentially transforms them to a partial
      text response, and enqueues them.
    - get_generator: Returns an async generator that yields messages or status
      markers as they become available.
    - step_complete, step_yield: End streaming for the current step or entirely,
      depending on the multi_step setting.
    - function_message, internal_monologue: Handle LLM “function calls” and
      “reasoning” messages for non-streaming contexts.
    """

    FINISH_REASON_STR = "stop"
    ASSISTANT_STR = "assistant"

    def __init__(
        self,
        multi_step: bool = True,
        timeout: int = 3 * 60,
        # The following are placeholders for potential expansions; they
        # remain if you need to differentiate between actual "assistant messages"
        # vs. tool calls. By default, they are set for the "send_message" tool usage.
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
        inner_thoughts_in_kwargs: bool = True,
        inner_thoughts_kwarg: str = INNER_THOUGHTS_KWARG,
    ):
        self.streaming_mode = True

        # Parsing state for incremental function-call data
        self.current_function_name = ""
        self.current_function_arguments = []
        self.current_json_parse_result = {}
        self._found_message_tool_kwarg = False

        # Internal chunk buffer and event for async notification
        self._chunks = deque()
        self._event = asyncio.Event()
        self._active = True

        # Whether or not the stream should remain open across multiple steps
        self.multi_step = multi_step

        # Timing / debug parameters
        self.timeout = timeout

        # These are placeholders to handle specialized
        # assistant message logic or storing inner thoughts.
        self.assistant_message_tool_name = assistant_message_tool_name
        self.assistant_message_tool_kwarg = assistant_message_tool_kwarg
        self.inner_thoughts_in_kwargs = inner_thoughts_in_kwargs
        self.inner_thoughts_kwarg = inner_thoughts_kwarg

    async def _create_generator(
        self,
    ) -> AsyncGenerator[Union[LettaMessage, MessageStreamStatus], None]:
        """
        An asynchronous generator that yields queued items as they arrive.
        Ends when _active is set to False or when timing out.
        """
        while self._active:
            try:
                await asyncio.wait_for(self._event.wait(), timeout=self.timeout)
            except asyncio.TimeoutError:
                logger.warning("Chat completions interface timed out! Please check that this is intended.")
                break

            while self._chunks:
                yield self._chunks.popleft()

            self._event.clear()

    def get_generator(self) -> AsyncGenerator:
        """
        Provide the async generator interface. Will raise StopIteration
        if the stream is inactive.
        """
        if not self._active:
            raise StopIteration("The stream is not active.")
        return self._create_generator()

    def _push_to_buffer(
        self,
        item: ChatCompletionChunk,
    ):
        """m
        Add an item (a LettaMessage, status marker, or partial chunk)
        to the queue and signal waiting consumers.
        """
        if not self._active:
            raise RuntimeError("Attempted to push to an inactive stream.")
        self._chunks.append(item)
        self._event.set()

    def stream_start(self) -> None:
        """Initialize or reset the streaming state for a new request."""
        self._active = True
        self._chunks.clear()
        self._event.clear()
        self._reset_parsing_state()

    def stream_end(self) -> None:
        """
        Clean up after the current streaming session. Typically called when the
        request is done or the data source has signaled it has no more data.
        """
        self._reset_parsing_state()

    def step_complete(self) -> None:
        """
        Indicate that one step of multi-step generation is done.
        If multi_step=False, the stream is closed immediately.
        """
        if not self.multi_step:
            self._active = False
            self._event.set()  # Ensure waiting generators can finalize
        self._reset_parsing_state()

    def step_yield(self) -> None:
        """
        Explicitly end the stream in a multi-step scenario, typically
        called when the entire chain of steps is complete.
        """
        self._active = False
        self._event.set()

    @staticmethod
    def clear() -> None:
        """No-op retained for interface compatibility."""
        return

    def process_chunk(
        self, chunk: ChatCompletionChunkResponse, message_id: str, message_date: datetime, expect_reasoning_content: bool = False
    ) -> None:
        """
        Called externally with a ChatCompletionChunkResponse. Transforms
        it if necessary, then enqueues partial messages for streaming back.
        """
        processed_chunk = self._process_chunk_to_openai_style(chunk)
        if processed_chunk is not None:
            self._push_to_buffer(processed_chunk)

    def user_message(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """
        Handle user messages. Here, it's a no-op, but included if your
        pipeline needs to respond to user messages distinctly.
        """
        return

    def internal_monologue(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """
        Handle LLM reasoning or internal monologue. Example usage: if you want
        to capture chain-of-thought for debugging in a non-streaming scenario.
        """
        return

    def assistant_message(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """
        Handle direct assistant messages. This class primarily handles them
        as function calls, so it's a no-op by default.
        """
        return

    def function_message(self, msg: str, msg_obj: Optional[Message] = None) -> None:
        """
        Handle function-related log messages, typically of the form:
        It's a no-op by default.
        """
        return

    def _process_chunk_to_openai_style(self, chunk: ChatCompletionChunkResponse) -> Optional[ChatCompletionChunk]:
        """
        Optionally transform an inbound OpenAI-style chunk so that partial
        content (especially from a 'send_message' tool) is exposed as text
        deltas in 'content'. Otherwise, pass through or yield finish reasons.
        """
        # If we've already sent the final chunk, ignore everything.
        if self._found_message_tool_kwarg:
            return None

        choice = chunk.choices[0]
        delta = choice.delta

        # If there's direct content, we usually let it stream as-is
        if delta.content is not None:
            # TODO: Eventually use all of the native OpenAI objects
            return ChatCompletionChunk(**chunk.model_dump(exclude_none=True))

        # If there's a function call, accumulate its name/args. If it's a known
        # text-producing function (like send_message), stream partial text.
        if delta.tool_calls:
            tool_call = delta.tool_calls[0]
            if tool_call.function.name:
                self.current_function_name += tool_call.function.name
            if tool_call.function.arguments:
                self.current_function_arguments.append(tool_call.function.arguments)

            # Only parse arguments for "send_message" to stream partial text
            if self.current_function_name.strip() == self.assistant_message_tool_name:
                combined_args = "".join(self.current_function_arguments)
                parsed_args = OptimisticJSONParser().parse(combined_args)

                if parsed_args.get(self.assistant_message_tool_kwarg) and parsed_args.get(
                    self.assistant_message_tool_kwarg
                ) != self.current_json_parse_result.get(self.assistant_message_tool_kwarg):
                    self.current_json_parse_result = parsed_args
                    return ChatCompletionChunk(
                        id=chunk.id,
                        object=chunk.object,
                        created=chunk.created.timestamp(),
                        model=chunk.model,
                        choices=[
                            Choice(
                                index=choice.index,
                                delta=ChoiceDelta(content=self.current_function_arguments[-1], role=self.ASSISTANT_STR),
                                finish_reason=None,
                            )
                        ],
                    )

        # If there's a finish reason, pass that along
        if choice.finish_reason is not None:
            # only emit a final chunk if finish_reason == "stop"
            if choice.finish_reason == "stop":
                return ChatCompletionChunk(
                    id=chunk.id,
                    object=chunk.object,
                    created=chunk.created.timestamp(),
                    model=chunk.model,
                    choices=[
                        Choice(
                            index=choice.index,
                            delta=ChoiceDelta(),  # no partial text here
                            finish_reason="stop",
                        )
                    ],
                )

        return None

    def _reset_parsing_state(self) -> None:
        """Clears internal buffers for function call name/args."""
        self.current_function_name = ""
        self.current_function_arguments = []
        self.current_json_parse_result = {}
        self._found_message_tool_kwarg = False
