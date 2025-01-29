import json
from typing import Generator, Union, get_args

import httpx
from httpx_sse import SSEError, connect_sse
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.constants import OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING
from letta.errors import LLMError
from letta.log import get_logger
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import AssistantMessage, ReasoningMessage, ToolCallMessage, ToolReturnMessage
from letta.schemas.letta_response import LettaStreamingResponse
from letta.schemas.usage import LettaUsageStatistics

logger = get_logger(__name__)


def _sse_post(url: str, data: dict, headers: dict) -> Generator[Union[LettaStreamingResponse, ChatCompletionChunk], None, None]:

    with httpx.Client() as client:
        with connect_sse(client, method="POST", url=url, json=data, headers=headers) as event_source:

            # Inspect for errors before iterating (see https://github.com/florimondmanca/httpx-sse/pull/12)
            if not event_source.response.is_success:
                # handle errors
                pass

                logger.warning("Caught error before iterating SSE request:", vars(event_source.response))
                logger.warning(event_source.response.read().decode("utf-8"))

                try:
                    response_bytes = event_source.response.read()
                    response_dict = json.loads(response_bytes.decode("utf-8"))
                    # e.g.: This model's maximum context length is 8192 tokens. However, your messages resulted in 8198 tokens (7450 in the messages, 748 in the functions). Please reduce the length of the messages or functions.
                    if (
                        "error" in response_dict
                        and "message" in response_dict["error"]
                        and OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING in response_dict["error"]["message"]
                    ):
                        logger.error(response_dict["error"]["message"])
                        raise LLMError(response_dict["error"]["message"])
                except LLMError:
                    raise
                except:
                    logger.error(f"Failed to parse SSE message, throwing SSE HTTP error up the stack")
                    event_source.response.raise_for_status()

            try:
                for sse in event_source.iter_sse():
                    # if sse.data == OPENAI_SSE_DONE:
                    # print("finished")
                    # break
                    if sse.data in [status.value for status in MessageStreamStatus]:
                        # break
                        yield MessageStreamStatus(sse.data)
                    else:
                        chunk_data = json.loads(sse.data)
                        if "reasoning" in chunk_data:
                            yield ReasoningMessage(**chunk_data)
                        elif "message_type" in chunk_data and chunk_data["message_type"] == "assistant_message":
                            yield AssistantMessage(**chunk_data)
                        elif "tool_call" in chunk_data:
                            yield ToolCallMessage(**chunk_data)
                        elif "tool_return" in chunk_data:
                            yield ToolReturnMessage(**chunk_data)
                        elif "step_count" in chunk_data:
                            yield LettaUsageStatistics(**chunk_data)
                        elif chunk_data.get("object") == get_args(ChatCompletionChunk.__annotations__["object"])[0]:
                            yield ChatCompletionChunk(**chunk_data)  # Add your processing logic for chat chunks here
                        else:
                            raise ValueError(f"Unknown message type in chunk_data: {chunk_data}")

            except SSEError as e:
                logger.error("Caught an error while iterating the SSE stream:", str(e))
                if "application/json" in str(e):  # Check if the error is because of JSON response
                    # TODO figure out a better way to catch the error other than re-trying with a POST
                    response = client.post(url=url, json=data, headers=headers)  # Make the request again to get the JSON response
                    if response.headers["Content-Type"].startswith("application/json"):
                        error_details = response.json()  # Parse the JSON to get the error message
                        logger.error("Request:", vars(response.request))
                        logger.error("POST Error:", error_details)
                        logger.error("Original SSE Error:", str(e))
                    else:
                        logger.error("Failed to retrieve JSON error message via retry.")
                else:
                    logger.error("SSEError not related to 'application/json' content type.")

                # Optionally re-raise the exception if you need to propagate it
                raise e

            except Exception as e:
                if event_source.response.request is not None:
                    logger.error("HTTP Request:", vars(event_source.response.request))
                if event_source.response is not None:
                    logger.error("HTTP Status:", event_source.response.status_code)
                    logger.error("HTTP Headers:", event_source.response.headers)
                logger.error("Exception message:", str(e))
                raise e
