# Alternative implementation of StreamingResponse that allows for effectively
# stremaing HTTP trailers, as we cannot set codes after the initial response.
# Taken from: https://github.com/fastapi/fastapi/discussions/10138#discussioncomment-10377361

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import uuid4

import anyio
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.types import Send

from letta.errors import LettaUnexpectedStreamCancellationError, PendingApprovalError
from letta.log import get_logger
from letta.schemas.enums import RunStatus
from letta.schemas.letta_message import LettaPing
from letta.schemas.user import User
from letta.server.rest_api.utils import capture_sentry_exception
from letta.services.run_manager import RunManager
from letta.settings import settings
from letta.utils import safe_create_task

logger = get_logger(__name__)


class RunCancelledException(Exception):
    """Exception raised when a run is explicitly cancelled (not due to client timeout)"""

    def __init__(self, run_id: str, message: str = None):
        self.run_id = run_id
        super().__init__(message or f"Run {run_id} was explicitly cancelled")


async def add_keepalive_to_stream(
    stream_generator: AsyncIterator[str | bytes],
    run_id: str,
    keepalive_interval: float = 30.0,
) -> AsyncIterator[str | bytes]:
    """
    Adds periodic keepalive messages to a stream to prevent connection timeouts.

    Sends a keepalive ping every `keepalive_interval` seconds, regardless of
    whether data is flowing. This ensures connections stay alive during long
    operations like tool execution.

    Args:
        stream_generator: The original stream generator to wrap
        keepalive_interval: Seconds between keepalive messages (default: 30)

    Yields:
        Original stream chunks interspersed with keepalive messages
    """
    # Use a bounded queue to decouple reading from keepalive while preserving backpressure
    # A small maxsize prevents unbounded memory growth if the client is slow
    queue = asyncio.Queue(maxsize=1)
    stream_exhausted = False

    async def stream_reader():
        """Read from the original stream and put items in the queue."""
        nonlocal stream_exhausted
        try:
            async for item in stream_generator:
                await queue.put(("data", item))
        finally:
            stream_exhausted = True
            await queue.put(("end", None))

    # Start the stream reader task
    reader_task = safe_create_task(stream_reader(), label="stream_reader")

    try:
        while True:
            try:
                # Wait for data with a timeout equal to keepalive interval
                msg_type, data = await asyncio.wait_for(queue.get(), timeout=keepalive_interval)

                if msg_type == "end":
                    # Stream finished
                    break
                elif msg_type == "data":
                    yield data

            except asyncio.TimeoutError:
                # No data received within keepalive interval
                if not stream_exhausted:
                    # Send keepalive ping in the same format as [DONE]
                    yield f"data: {LettaPing(id=f'ping-{uuid4()}', date=datetime.now(timezone.utc), run_id=run_id).model_dump_json()}\n\n"
                else:
                    # Stream is done but queue might be processing
                    # Check if there's anything left
                    try:
                        msg_type, data = queue.get_nowait()
                        if msg_type == "end":
                            break
                        elif msg_type == "data":
                            yield data
                    except asyncio.QueueEmpty:
                        # Really done now
                        break

    finally:
        # Clean up the reader task
        reader_task.cancel()
        try:
            await reader_task
        except asyncio.CancelledError:
            pass


# TODO (cliandy) wrap this and handle types
async def cancellation_aware_stream_wrapper(
    stream_generator: AsyncIterator[str | bytes],
    run_manager: RunManager,
    run_id: str,
    actor: User,
    cancellation_check_interval: float = 0.5,
) -> AsyncIterator[str | bytes]:
    """
    Wraps a stream generator to provide real-time run cancellation checking.

    This wrapper periodically checks for run cancellation while streaming and
    can interrupt the stream at any point, not just at step boundaries.

    Args:
        stream_generator: The original stream generator to wrap
        run_manager: Run manager instance for checking run status
        run_id: ID of the run to monitor for cancellation
        actor: User/actor making the request
        cancellation_check_interval: How often to check for cancellation (seconds)

    Yields:
        Stream chunks from the original generator until cancelled

    Raises:
        asyncio.CancelledError: If the run is cancelled during streaming
    """
    last_cancellation_check = asyncio.get_event_loop().time()

    try:
        async for chunk in stream_generator:
            # Check for cancellation periodically (not on every chunk for performance)
            current_time = asyncio.get_event_loop().time()
            if current_time - last_cancellation_check >= cancellation_check_interval:
                try:
                    run = await run_manager.get_run_by_id(run_id=run_id, actor=actor)
                    if run.status == RunStatus.cancelled:
                        logger.info(f"Stream cancelled for run {run_id}, interrupting stream")
                        # Send cancellation event to client
                        cancellation_event = {"message_type": "stop_reason", "stop_reason": "cancelled"}
                        yield f"data: {json.dumps(cancellation_event)}\n\n"
                        # Raise custom exception for explicit run cancellation
                        raise RunCancelledException(run_id, f"Run {run_id} was cancelled")
                except RunCancelledException:
                    # Re-raise cancellation immediately, don't catch it
                    raise
                except Exception as e:
                    # Log warning but don't fail the stream if cancellation check fails
                    logger.warning(f"Failed to check run cancellation for run {run_id}: {e}")

                last_cancellation_check = current_time

            yield chunk

    except RunCancelledException:
        # Re-raise RunCancelledException to distinguish from client timeout
        logger.info(f"Stream for run {run_id} was explicitly cancelled and cleaned up")
        raise
    except asyncio.CancelledError:
        # Re-raise CancelledError (likely client timeout) to ensure proper cleanup
        logger.info(f"Stream for run {run_id} was cancelled (likely client timeout) and cleaned up")
        raise
    except Exception as e:
        logger.error(f"Error in cancellation-aware stream wrapper for run {run_id}: {e}")
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
    _client_connected: bool = True

    async def stream_response(self, send: Send) -> None:
        if settings.use_asyncio_shield:
            try:
                await asyncio.shield(self._protected_stream_response(send))
            except asyncio.CancelledError:
                logger.info("Stream response was cancelled, but shielded task should continue")
            except anyio.ClosedResourceError:
                logger.info("Client disconnected, but shielded task should continue")
                self._client_connected = False
            except PendingApprovalError as e:
                # This is an expected error, don't log as error
                logger.info(f"Pending approval conflict in stream response: {e}")
                # Re-raise as HTTPException for proper client handling
                raise HTTPException(
                    status_code=409, detail={"code": "PENDING_APPROVAL", "message": str(e), "pending_request_id": e.pending_request_id}
                )
            except Exception as e:
                logger.error(f"Error in protected stream response: {e}")
                raise
        else:
            await self._protected_stream_response(send)

    async def _protected_stream_response(self, send: Send) -> None:
        more_body = True
        try:
            first_chunk = await self.body_iterator.__anext__()
            logger.debug("stream_response first chunk:", first_chunk)
            if isinstance(first_chunk, tuple):
                first_chunk_content, self.status_code = first_chunk
            else:
                first_chunk_content = first_chunk
            if isinstance(first_chunk_content, str):
                first_chunk_content = first_chunk_content.encode(self.charset)

            try:
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
            except anyio.ClosedResourceError:
                logger.info("Client disconnected during initial response, continuing processing without sending more chunks")
                self._client_connected = False

            async for chunk in self.body_iterator:
                if isinstance(chunk, tuple):
                    content, status_code = chunk
                    if status_code // 100 != 2:
                        # An error occurred mid-stream
                        if not isinstance(content, bytes):
                            content = content.encode(self.charset)
                        more_body = False
                        raise Exception(f"An exception occurred mid-stream with status code {status_code} with content {content}")
                else:
                    content = chunk

                if isinstance(content, str):
                    content = content.encode(self.charset)
                more_body = True

                # Only attempt to send if client is still connected
                if self._client_connected:
                    try:
                        await send(
                            {
                                "type": "http.response.body",
                                "body": content,
                                "more_body": more_body,
                            }
                        )
                    except anyio.ClosedResourceError:
                        logger.info("Client disconnected, continuing processing without sending more data")
                        self._client_connected = False
                        # Continue processing but don't try to send more data

        # Handle explicit run cancellations (should not throw error)
        except RunCancelledException as exc:
            logger.info(f"Stream was explicitly cancelled for run {exc.run_id}")
            # Handle explicit cancellation gracefully without error
            more_body = False
            cancellation_resp = {"message": "Run was cancelled"}
            cancellation_event = f"event: cancelled\ndata: {json.dumps(cancellation_resp)}\n\n".encode(self.charset)
            if not self.response_started:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 200,  # Use 200 for graceful cancellation
                        "headers": self.raw_headers,
                    }
                )
                raise
            if self._client_connected:
                try:
                    await send(
                        {
                            "type": "http.response.body",
                            "body": cancellation_event,
                            "more_body": more_body,
                        }
                    )
                except anyio.ClosedResourceError:
                    self._client_connected = False
            return

        # Handle client timeouts (should throw error to inform user)
        except asyncio.CancelledError as exc:
            logger.warning("Stream was terminated due to unexpected cancellation from server")
            # Handle unexpected cancellation with error
            more_body = False
            capture_sentry_exception(exc)
            raise LettaUnexpectedStreamCancellationError("Stream was terminated due to unexpected cancellation from server")

        except Exception as exc:
            logger.exception(f"Unhandled Streaming Error: {str(exc)}")
            more_body = False
            # error_resp = {"error": {"message": str(exc)}}
            error_resp = {"error": str(exc), "code": "INTERNAL_SERVER_ERROR"}
            error_event = f"event: error\ndata: {json.dumps(error_resp)}\n\n".encode(self.charset)
            logger.debug("response_started:", self.response_started)
            if not self.response_started:
                await send(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": self.raw_headers,
                    }
                )
                raise
            if self._client_connected:
                try:
                    await send(
                        {
                            "type": "http.response.body",
                            "body": error_event,
                            "more_body": more_body,
                        }
                    )
                except anyio.ClosedResourceError:
                    self._client_connected = False

            capture_sentry_exception(exc)
            return
        if more_body and self._client_connected:
            try:
                await send({"type": "http.response.body", "body": b"", "more_body": False})
            except anyio.ClosedResourceError:
                self._client_connected = False
