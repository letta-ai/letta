# Alternative implementation of StreamingResponse that allows for effectively
# stremaing HTTP trailers, as we cannot set codes after the initial response.
# Taken from: https://github.com/fastapi/fastapi/discussions/10138#discussioncomment-10377361

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi.responses import StreamingResponse
from starlette.types import Send

from letta.log import get_logger
from letta.schemas.enums import JobStatus
from letta.schemas.user import User
from letta.services.job_manager import JobManager

logger = get_logger(__name__)


# TODO (cliandy) wrap this and handle types
async def cancellation_aware_stream_wrapper(
    stream_generator: AsyncIterator[str | bytes],
    job_manager: JobManager,
    job_id: str,
    actor: User,
    cancellation_check_interval: float = 0.5,
) -> AsyncIterator[str | bytes]:
    """
    Wraps a stream generator to provide real-time job cancellation checking.

    This wrapper periodically checks for job cancellation while streaming and
    can interrupt the stream at any point, not just at step boundaries.

    Args:
        stream_generator: The original stream generator to wrap
        job_manager: Job manager instance for checking job status
        job_id: ID of the job to monitor for cancellation
        actor: User/actor making the request
        cancellation_check_interval: How often to check for cancellation (seconds)

    Yields:
        Stream chunks from the original generator until cancelled

    Raises:
        asyncio.CancelledError: If the job is cancelled during streaming
    """
    last_cancellation_check = asyncio.get_event_loop().time()

    try:
        async for chunk in stream_generator:
            # Check for cancellation periodically (not on every chunk for performance)
            current_time = asyncio.get_event_loop().time()
            if current_time - last_cancellation_check >= cancellation_check_interval:
                try:
                    job = await job_manager.get_job_by_id_async(job_id=job_id, actor=actor)
                    if job.status == JobStatus.cancelled:
                        logger.info(f"Stream cancelled for job {job_id}, interrupting stream")
                        # Send cancellation event to client
                        cancellation_event = {"message_type": "stop_reason", "stop_reason": "cancelled"}
                        yield f"data: {json.dumps(cancellation_event)}\n\n"
                        # Raise CancelledError to interrupt the stream
                        raise asyncio.CancelledError(f"Job {job_id} was cancelled")
                except Exception as e:
                    # Log warning but don't fail the stream if cancellation check fails
                    logger.warning(f"Failed to check job cancellation for job {job_id}: {e}")

                last_cancellation_check = current_time

            yield chunk

    except asyncio.CancelledError:
        # Re-raise CancelledError to ensure proper cleanup
        logger.info(f"Stream for job {job_id} was cancelled and cleaned up")
        raise
    except Exception as e:
        logger.error(f"Error in cancellation-aware stream wrapper for job {job_id}: {e}")
        raise


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

        # This should be handled properly upstream?
        except asyncio.CancelledError:
            logger.info("Stream was cancelled by client or job cancellation")
            # Handle cancellation gracefully
            more_body = False
            cancellation_resp = {"error": {"message": "Stream cancelled"}}
            cancellation_event = f"event: cancelled\ndata: {json.dumps(cancellation_resp)}\n\n".encode(self.charset)
            if not self.response_started:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 200,  # Use 200 for graceful cancellation
                        "headers": self.raw_headers,
                    }
                )
            await send(
                {
                    "type": "http.response.body",
                    "body": cancellation_event,
                    "more_body": more_body,
                }
            )
            return

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
