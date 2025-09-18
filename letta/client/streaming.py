import json
from typing import Generator, Union, get_args

import httpx
from httpx_sse import SSEError, connect_sse
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.constants import OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING
from letta.errors import LLMError
from letta.log import get_logger
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import AssistantMessage, HiddenReasoningMessage, ReasoningMessage, ToolCallMessage, ToolReturnMessage
from letta.schemas.letta_response import LettaStreamingResponse
from letta.schemas.usage import LettaUsageStatistics

logger = get_logger(__name__)


def _sse_post(url: str, data: dict, headers: dict) -> Generator[Union[LettaStreamingResponse, ChatCompletionChunk], None, None]:
    """
    Sends an SSE POST request and yields parsed response chunks.
    """
    # TODO: Please note his is a very generous timeout for e2b reasons
    with httpx.Client(timeout=httpx.Timeout(5 * 60.0, read=5 * 60.0)) as client:
        with connect_sse(client, method="POST", url=url, json=data, headers=headers) as event_source:
            # Check for immediate HTTP errors before processing the SSE stream
            if not event_source.response.is_success:
                response_bytes = event_source.response.read()
                logger.warning(f"SSE request error: {vars(event_source.response)}")
                logger.warning(response_bytes.decode("utf-8"))

                try:
                    response_dict = json.loads(response_bytes.decode("utf-8"))
                    error_message = response_dict.get("error", {}).get("message", "")

                    if OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING in error_message:
                        logger.error(error_message)
                        raise LLMError(error_message)
                except LLMError:
                    raise
                except Exception:
                    logger.error("Failed to parse SSE message, raising HTTP error")
                    event_source.response.raise_for_status()

            try:
                for sse in event_source.iter_sse():
                    if sse.data in {status.value for status in MessageStreamStatus}:
                        yield MessageStreamStatus(sse.data)
                        if sse.data == MessageStreamStatus.done.value:
                            # We received the [DONE], so stop reading the stream.
                            break
                    else:
                        chunk_data = json.loads(sse.data)

                        if "reasoning" in chunk_data:
                            yield ReasoningMessage(**chunk_data)
                        elif chunk_data.get("message_type") == "assistant_message":
                            yield AssistantMessage(**chunk_data)
                        elif "hidden_reasoning" in chunk_data:
                            yield HiddenReasoningMessage(**chunk_data)
                        elif "tool_call" in chunk_data:
                            yield ToolCallMessage(**chunk_data)
                        elif "tool_return" in chunk_data:
                            yield ToolReturnMessage(**chunk_data)
                        elif "step_count" in chunk_data:
                            yield LettaUsageStatistics(**chunk_data)
                        elif chunk_data.get("object") == get_args(ChatCompletionChunk.__annotations__["object"])[0]:
                            yield ChatCompletionChunk(**chunk_data)
                        else:
                            raise ValueError(f"Unknown message type in chunk_data: {chunk_data}")

            except SSEError as e:
                logger.error(f"SSE stream error: {e}")

                if "application/json" in str(e):
                    response = client.post(url=url, json=data, headers=headers)

                    if response.headers.get("Content-Type", "").startswith("application/json"):
                        error_details = response.json()
                        logger.error(f"POST Error: {error_details}")
                    else:
                        logger.error("Failed to retrieve JSON error message via retry.")

                raise e

            except Exception as e:
                logger.error(f"Unexpected exception: {e}")

                if event_source.response.request:
                    logger.error(f"HTTP Request: {vars(event_source.response.request)}")
                if event_source.response:
                    logger.error(f"HTTP Status: {event_source.response.status_code}")
                    logger.error(f"HTTP Headers: {event_source.response.headers}")

                raise e
