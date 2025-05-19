# Alternative implementation of StreamingResponse that allows for effectively
# stremaing HTTP trailers, as we cannot set codes after the initial response.
# Taken from: https://github.com/fastapi/fastapi/discussions/10138#discussioncomment-10377361

import json
from collections.abc import AsyncIterator

from fastapi.responses import StreamingResponse
from starlette.types import Send

from letta.log import get_logger

logger = get_logger(__name__)


class StreamingResponseWithStatusCode(StreamingResponse):
    """
    Variation of StreamingResponse that can dynamically decide the HTTP status code,
    based on the return value of the content iterator (parameter `content`).
    Expects the content to yield either just str content as per the original `StreamingResponse`
    or else tuples of (`content`: `str`, `status_code`: `int`).
    """

    body_iterator: AsyncIterator[str | bytes]
    response_started: bool = False

    async def stream_response(self, send: Send) -> None:
        more_body = True
        try:
            first_chunk = await self.body_iterator.__anext__()
            if isinstance(first_chunk, tuple):
                first_chunk_content, self.status_code = first_chunk
            else:
                first_chunk_content = first_chunk
            if isinstance(first_chunk_content, str):
                first_chunk_content = first_chunk_content.encode(self.charset)

            await send(
                {
                    "type": "http.response.start",
                    "status": self.status_code,
                    "headers": self.raw_headers,
                }
            )
            self.response_started = True
            await send(
                {
                    "type": "http.response.body",
                    "body": first_chunk_content,
                    "more_body": more_body,
                }
            )

            async for chunk in self.body_iterator:
                if isinstance(chunk, tuple):
                    content, status_code = chunk
                    if status_code // 100 != 2:
                        # An error occurred mid-stream
                        if not isinstance(content, bytes):
                            content = content.encode(self.charset)
                        more_body = False
                        await send(
                            {
                                "type": "http.response.body",
                                "body": content,
                                "more_body": more_body,
                            }
                        )
                        return
                else:
                    content = chunk

                if isinstance(content, str):
                    content = content.encode(self.charset)
                more_body = True
                await send(
                    {
                        "type": "http.response.body",
                        "body": content,
                        "more_body": more_body,
                    }
                )

        except Exception:
            logger.exception("unhandled_streaming_error")
            more_body = False
            error_resp = {"error": {"message": "Internal Server Error"}}
            error_event = f"event: error\ndata: {json.dumps(error_resp)}\n\n".encode(self.charset)
            if not self.response_started:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": self.raw_headers,
                    }
                )
            await send(
                {
                    "type": "http.response.body",
                    "body": error_event,
                    "more_body": more_body,
                }
            )
        if more_body:
            await send({"type": "http.response.body", "body": b"", "more_body": False})
