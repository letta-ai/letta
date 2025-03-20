from typing import Any, AsyncGenerator, Dict, List, Optional

from openai import AsyncStream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk, Choice, ChoiceDelta

from letta.constants import PRE_EXECUTION_MESSAGE_ARG
from letta.interfaces.utils import _format_sse_chunk
from letta.server.rest_api.optimistic_json_parser import OptimisticJSONParser


class OpenAIChatCompletionsStreamingInterface:
    """
    Encapsulates the logic for streaming responses from OpenAI.
    This class handles parsing of partial tokens, pre-execution messages,
    and detection of tool call events.
    """

    def __init__(self, stream_pre_execution_message: bool = True):
        self.optimistic_json_parser: OptimisticJSONParser = OptimisticJSONParser()
        self.stream_pre_execution_message: bool = stream_pre_execution_message

        self.current_parsed_json_result: Dict[str, Any] = {}
        self.content_buffer: List[str] = []
        self.tool_call_happened: bool = False
        self.finish_reason_stop: bool = False

        self.tool_call_name: Optional[str] = None
        self.tool_call_args_str: str = ""
        self.tool_call_id: Optional[str] = None

    async def process(self, stream: AsyncStream[ChatCompletionChunk]) -> AsyncGenerator[str, None]:
        """
        Iterates over the OpenAI stream, yielding SSE events.
        It also collects tokens and detects if a tool call is triggered.
        """
        async with stream:
            async for chunk in stream:
                choice = chunk.choices[0]
                delta = choice.delta
                finish_reason = choice.finish_reason

                async for sse_chunk in self._process_content(delta, chunk):
                    yield sse_chunk

                async for sse_chunk in self._process_tool_calls(delta, chunk):
                    yield sse_chunk

                if self._handle_finish_reason(finish_reason):
                    break

    async def _process_content(self, delta: ChoiceDelta, chunk: ChatCompletionChunk) -> AsyncGenerator[str, None]:
        """Processes regular content tokens and streams them."""
        if delta.content:
            self.content_buffer.append(delta.content)
            yield _format_sse_chunk(chunk)

    async def _process_tool_calls(self, delta: ChoiceDelta, chunk: ChatCompletionChunk) -> AsyncGenerator[str, None]:
        """Handles tool call initiation and streaming of pre-execution messages."""
        if not delta.tool_calls:
            return

        tool_call = delta.tool_calls[0]
        self._update_tool_call_info(tool_call)

        if self.stream_pre_execution_message and tool_call.function.arguments:
            self.tool_call_args_str += tool_call.function.arguments
            async for sse_chunk in self._stream_pre_execution_message(chunk, tool_call):
                yield sse_chunk

    def _update_tool_call_info(self, tool_call: Any) -> None:
        """Updates tool call-related attributes."""
        if tool_call.function.name:
            self.tool_call_name = tool_call.function.name
        if tool_call.id:
            self.tool_call_id = tool_call.id

    async def _stream_pre_execution_message(self, chunk: ChatCompletionChunk, tool_call: Any) -> AsyncGenerator[str, None]:
        """Parses and streams pre-execution messages if they have changed."""
        parsed_args = self.optimistic_json_parser.parse(self.tool_call_args_str)

        if parsed_args.get(PRE_EXECUTION_MESSAGE_ARG) and self.current_parsed_json_result.get(PRE_EXECUTION_MESSAGE_ARG) != parsed_args.get(
            PRE_EXECUTION_MESSAGE_ARG
        ):
            if parsed_args != self.current_parsed_json_result:
                self.current_parsed_json_result = parsed_args
                synthetic_chunk = ChatCompletionChunk(
                    id=chunk.id,
                    object=chunk.object,
                    created=chunk.created,
                    model=chunk.model,
                    choices=[
                        Choice(
                            index=0,
                            delta=ChoiceDelta(content=tool_call.function.arguments, role="assistant"),
                            finish_reason=None,
                        )
                    ],
                )
                yield _format_sse_chunk(synthetic_chunk)

    def _handle_finish_reason(self, finish_reason: Optional[str]) -> bool:
        """Handles the finish reason and determines if streaming should stop."""
        if finish_reason == "tool_calls":
            self.tool_call_happened = True
            return True
        if finish_reason == "stop":
            self.finish_reason_stop = True
            return True
        return False
