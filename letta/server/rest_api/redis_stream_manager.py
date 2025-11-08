"""Redis stream manager for reading and writing SSE chunks with batching and TTL."""

import asyncio
import json
import time
from collections import defaultdict
from typing import AsyncIterator, Dict, List, Optional

from letta.data_sources.redis_client import AsyncRedisClient
from letta.log import get_logger
from letta.schemas.enums import RunStatus
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.run import RunUpdate
from letta.schemas.user import User
from letta.server.rest_api.streaming_response import RunCancelledException
from letta.services.run_manager import RunManager
from letta.utils import safe_create_task

logger = get_logger(__name__)


class RedisSSEStreamWriter:
    """
    Efficiently writes SSE chunks to Redis streams with batching and TTL management.

    Features:
    - Batches writes using Redis pipelines for performance
    - Automatically sets/refreshes TTL on streams
    - Tracks sequential IDs for cursor-based recovery
    - Handles flush on size or time thresholds
    """

    def __init__(
        self,
        redis_client: AsyncRedisClient,
        flush_interval: float = 0.5,
        flush_size: int = 50,
        stream_ttl_seconds: int = 10800,  # 3 hours default
        max_stream_length: int = 10000,  # Max entries per stream
    ):
        """
        Initialize the Redis SSE stream writer.

        Args:
            redis_client: Redis client instance
            flush_interval: Seconds between automatic flushes
            flush_size: Number of chunks to buffer before flushing
            stream_ttl_seconds: TTL for streams in seconds (default: 6 hours)
            max_stream_length: Maximum entries per stream before trimming
        """
        self.redis = redis_client
        self.flush_interval = flush_interval
        self.flush_size = flush_size
        self.stream_ttl = stream_ttl_seconds
        self.max_stream_length = max_stream_length

        # Buffer for batching: run_id -> list of chunks
        self.buffer: Dict[str, List[Dict]] = defaultdict(list)
        # Track sequence IDs per run
        self.seq_counters: Dict[str, int] = defaultdict(lambda: 1)
        # Track last flush time per run
        self.last_flush: Dict[str, float] = defaultdict(float)

        # Background flush task
        self._flush_task = None
        self._running = False

    async def start(self):
        """Start the background flush task."""
        if not self._running:
            self._running = True
            self._flush_task = safe_create_task(self._periodic_flush(), label="redis_periodic_flush")

    async def stop(self):
        """Stop the background flush task and flush remaining data."""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        for run_id in list(self.buffer.keys()):
            if self.buffer[run_id]:
                await self._flush_run(run_id)

    async def write_chunk(
        self,
        run_id: str,
        data: str,
        is_complete: bool = False,
    ) -> int:
        """
        Write an SSE chunk to the buffer for a specific run.

        Args:
            run_id: The run ID to write to
            data: SSE-formatted chunk data
            is_complete: Whether this is the final chunk

        Returns:
            The sequence ID assigned to this chunk
        """
        seq_id = self.seq_counters[run_id]
        self.seq_counters[run_id] += 1

        chunk = {
            "seq_id": seq_id,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }

        if is_complete:
            chunk["complete"] = "true"

        self.buffer[run_id].append(chunk)

        should_flush = (
            len(self.buffer[run_id]) >= self.flush_size or is_complete or (time.time() - self.last_flush[run_id]) > self.flush_interval
        )

        if should_flush:
            await self._flush_run(run_id)

        return seq_id

    async def _flush_run(self, run_id: str):
        """Flush buffered chunks for a specific run to Redis."""
        if not self.buffer[run_id]:
            return

        chunks = self.buffer[run_id]
        self.buffer[run_id] = []
        stream_key = f"sse:run:{run_id}"

        try:
            client = await self.redis.get_client()

            async with client.pipeline(transaction=False) as pipe:
                for chunk in chunks:
                    await pipe.xadd(stream_key, chunk, maxlen=self.max_stream_length, approximate=True)

                await pipe.expire(stream_key, self.stream_ttl)

                await pipe.execute()

            self.last_flush[run_id] = time.time()

            logger.debug(f"Flushed {len(chunks)} chunks to Redis stream {stream_key}, seq_ids {chunks[0]['seq_id']}-{chunks[-1]['seq_id']}")

            if chunks[-1].get("complete") == "true":
                self._cleanup_run(run_id)

        except Exception as e:
            logger.error(f"Failed to flush chunks for run {run_id}: {e}")
            # Put chunks back in buffer to retry
            self.buffer[run_id] = chunks + self.buffer[run_id]
            raise

    async def _periodic_flush(self):
        """Background task to periodically flush buffers."""
        while self._running:
            try:
                await asyncio.sleep(self.flush_interval)

                # Check each run for time-based flush
                current_time = time.time()
                runs_to_flush = [
                    run_id
                    for run_id, last_flush in self.last_flush.items()
                    if (current_time - last_flush) > self.flush_interval and self.buffer[run_id]
                ]

                for run_id in runs_to_flush:
                    await self._flush_run(run_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic flush: {e}")

    def _cleanup_run(self, run_id: str):
        """Clean up tracking data for a completed run."""
        self.buffer.pop(run_id, None)
        self.seq_counters.pop(run_id, None)
        self.last_flush.pop(run_id, None)

    async def mark_complete(self, run_id: str):
        """Mark a stream as complete and flush."""
        # Add a [DONE] marker
        await self.write_chunk(run_id, "data: [DONE]\n\n", is_complete=True)


async def create_background_stream_processor(
    stream_generator,
    redis_client: AsyncRedisClient,
    run_id: str,
    writer: Optional[RedisSSEStreamWriter] = None,
    run_manager: Optional[RunManager] = None,
    actor: Optional[User] = None,
) -> None:
    """
    Process a stream in the background and store chunks to Redis.

    This function consumes the stream generator and writes all chunks
    to Redis for later retrieval.

    Args:
        stream_generator: The async generator yielding SSE chunks
        redis_client: Redis client instance
        run_id: The run ID to store chunks under
        writer: Optional pre-configured writer (creates new if not provided)
        run_manager: Optional run manager for updating run status
        actor: Optional actor for run status updates
    """
    stop_reason = None
    saw_done = False
    saw_error = False

    if writer is None:
        writer = RedisSSEStreamWriter(redis_client)
        await writer.start()
        should_stop_writer = True
    else:
        should_stop_writer = False

    try:
        async for chunk in stream_generator:
            if isinstance(chunk, tuple):
                chunk = chunk[0]

            # Track terminal events
            if isinstance(chunk, str):
                if "data: [DONE]" in chunk:
                    saw_done = True
                if "event: error" in chunk:
                    saw_error = True

            is_done = saw_done or saw_error

            await writer.write_chunk(run_id=run_id, data=chunk, is_complete=is_done)

            if is_done:
                break

            try:
                # Extract stop_reason from stop_reason chunks
                maybe_json_chunk = chunk.split("data: ")[1]
                maybe_stop_reason = json.loads(maybe_json_chunk) if maybe_json_chunk and maybe_json_chunk[0] == "{" else None
                if maybe_stop_reason and maybe_stop_reason.get("message_type") == "stop_reason":
                    stop_reason = maybe_stop_reason.get("stop_reason")
            except:
                pass

        # Stream ended naturally - check if we got a proper terminal
        if not saw_done and not saw_error:
            # Stream ended without terminal event - synthesize one
            logger.warning(
                f"Stream for run {run_id} ended without terminal event (no [DONE] or event:error). "
                f"Last stop_reason seen: {stop_reason}. Synthesizing terminal."
            )
            if stop_reason:
                # We have a stop_reason, send [DONE]
                await writer.write_chunk(run_id=run_id, data="data: [DONE]\n\n", is_complete=True)
                saw_done = True
            else:
                # No stop_reason and no terminal - this is an error condition
                error_chunk = {"error": "Stream ended unexpectedly without stop_reason", "code": "STREAM_INCOMPLETE"}
                await writer.write_chunk(run_id=run_id, data=f"event: error\ndata: {json.dumps(error_chunk)}\n\n", is_complete=False)
                await writer.write_chunk(run_id=run_id, data="data: [DONE]\n\n", is_complete=True)
                saw_error = True
                saw_done = True
                # Set a default stop_reason so run status can be mapped in finally
                stop_reason = StopReasonType.error.value

    except RunCancelledException as e:
        # Handle cancellation gracefully - don't write error chunk, cancellation event was already sent
        logger.info(f"Stream processing stopped due to cancellation for run {run_id}")
        # The cancellation event was already yielded by cancellation_aware_stream_wrapper
        # Write [DONE] marker to properly close the stream for clients reading from Redis
        await writer.write_chunk(run_id=run_id, data="data: [DONE]\n\n", is_complete=True)
        saw_done = True
    except Exception as e:
        logger.error(f"Error processing stream for run {run_id}: {e}")
        # Write error chunk
        error_chunk = {"error": str(e), "code": "INTERNAL_SERVER_ERROR"}
        await writer.write_chunk(run_id=run_id, data=f"event: error\ndata: {json.dumps(error_chunk)}\n\n", is_complete=False)
        await writer.write_chunk(run_id=run_id, data="data: [DONE]\n\n", is_complete=True)
        saw_error = True
        saw_done = True

        # Mark run as failed immediately
        if run_manager and actor:
            await run_manager.update_run_by_id_async(
                run_id=run_id,
                update=RunUpdate(status=RunStatus.failed, stop_reason=StopReasonType.error.value, metadata={"error": str(e)}),
                actor=actor,
            )
    finally:
        if should_stop_writer:
            await writer.stop()

        # Derive a final stop_reason if one wasn't observed explicitly
        final_stop_reason = stop_reason
        if final_stop_reason is None:
            if saw_error:
                final_stop_reason = StopReasonType.error.value
            elif saw_done:
                # Treat DONE without an explicit stop_reason as an error to avoid masking failures
                final_stop_reason = StopReasonType.error.value

        # Update run status to reflect terminal outcome
        if run_manager and actor and final_stop_reason:
            # Map stop_reason to run status
            if final_stop_reason in [
                StopReasonType.error.value,
                StopReasonType.llm_api_error.value,
                StopReasonType.invalid_tool_call.value,
                StopReasonType.invalid_llm_response.value,
                StopReasonType.no_tool_call.value,
            ]:
                run_status = RunStatus.failed
            elif final_stop_reason == StopReasonType.cancelled.value:
                run_status = RunStatus.cancelled
            elif final_stop_reason in [
                StopReasonType.end_turn.value,
                StopReasonType.max_steps.value,
                StopReasonType.tool_rule.value,
                StopReasonType.requires_approval.value,
            ]:
                run_status = RunStatus.completed
            else:
                logger.warning(f"Unknown stop_reason '{final_stop_reason}' for run {run_id}, defaulting to completed")
                run_status = RunStatus.completed

            await run_manager.update_run_by_id_async(
                run_id=run_id,
                update=RunUpdate(status=run_status, stop_reason=final_stop_reason),
                actor=actor,
            )

        # Belt-and-suspenders: always append a terminal [DONE] chunk to ensure clients terminate
        # Even if a previous chunk set `complete`, an extra [DONE] is harmless and ensures SDKs that
        # rely on explicit [DONE] will exit.
        logger.warning(
            "[Stream Finalizer] Appending forced [DONE] for run=%s (saw_error=%s, saw_done=%s, final_stop_reason=%s)",
            run_id,
            saw_error,
            saw_done,
            final_stop_reason,
        )
        try:
            await writer.mark_complete(run_id)
        except Exception as e:
            logger.warning(f"Failed to append terminal [DONE] for run {run_id}: {e}")


async def redis_sse_stream_generator(
    redis_client: AsyncRedisClient,
    run_id: str,
    starting_after: Optional[int] = None,
    poll_interval: float = 0.1,
    batch_size: int = 100,
) -> AsyncIterator[str]:
    """
    Generate SSE events from Redis stream chunks.

    This generator reads chunks stored in Redis streams and yields them as SSE events.
    It supports cursor-based recovery by allowing you to start from a specific seq_id.

    Args:
        redis_client: Redis client instance
        run_id: The run ID to read chunks for
        starting_after: Sequential ID (integer) to start reading from (default: None for beginning)
        poll_interval: Seconds to wait between polls when no new data (default: 0.1)
        batch_size: Number of entries to read per batch (default: 100)

    Yields:
        SSE-formatted chunks from the Redis stream
    """
    stream_key = f"sse:run:{run_id}"
    last_redis_id = "-"
    cursor_seq_id = starting_after or 0

    logger.debug(f"Starting redis_sse_stream_generator for run_id={run_id}, stream_key={stream_key}")

    while True:
        entries = await redis_client.xrange(stream_key, start=last_redis_id, count=batch_size)

        if entries:
            yielded_any = False
            for entry_id, fields in entries:
                if entry_id == last_redis_id:
                    continue

                chunk_seq_id = int(fields.get("seq_id", 0))
                if chunk_seq_id > cursor_seq_id:
                    data = fields.get("data", "")
                    if not data:
                        logger.debug(f"No data found for chunk {chunk_seq_id} in run {run_id}")
                        continue

                    if '"run_id":null' in data:
                        data = data.replace('"run_id":null', f'"run_id":"{run_id}"')

                    if '"seq_id":null' in data:
                        data = data.replace('"seq_id":null', f'"seq_id":{chunk_seq_id}')

                    yield data
                    yielded_any = True

                    if fields.get("complete") == "true":
                        return

                last_redis_id = entry_id

            if not yielded_any and len(entries) > 1:
                continue

        if not entries or (len(entries) == 1 and entries[0][0] == last_redis_id):
            await asyncio.sleep(poll_interval)
