"""ClickHouse writer for LLM analytics traces.

Writes LLM traces to ClickHouse with denormalized columns for cost analytics.
Uses ClickHouse's async_insert feature for server-side batching.
"""

from __future__ import annotations

import asyncio
import atexit
from typing import TYPE_CHECKING, Optional
from urllib.parse import urlparse

from letta.helpers.singleton import singleton
from letta.log import get_logger
from letta.settings import settings

if TYPE_CHECKING:
    from letta.schemas.llm_trace import LLMTrace

logger = get_logger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1.0

_background_tasks: set[asyncio.Task] = set()


def _parse_clickhouse_endpoint(endpoint: str) -> tuple[str, int, bool]:
    """Return (host, port, secure) for clickhouse_connect.get_client.

    Supports:
    - http://host:port -> (host, port, False)
    - https://host:port -> (host, port, True)
    - host:port -> (host, port, False)  # Default to insecure for local dev
    - host -> (host, 8123, False)  # Default HTTP port, insecure
    """
    parsed = urlparse(endpoint)

    if parsed.scheme in ("http", "https"):
        host = parsed.hostname or ""
        port = parsed.port or (8443 if parsed.scheme == "https" else 8123)
        secure = parsed.scheme == "https"
        return host, port, secure

    # Fallback: accept raw hostname (possibly with :port)
    # Default to insecure (HTTP) for local development
    if ":" in endpoint:
        host, port_str = endpoint.rsplit(":", 1)
        return host, int(port_str), False

    return endpoint, 8123, False


@singleton
class LLMTraceWriter:
    """
    Direct ClickHouse writer for raw LLM traces.

    Uses ClickHouse's async_insert feature for server-side batching.
    Each trace is inserted directly and ClickHouse handles batching
    for optimal write performance.

    Usage:
        writer = LLMTraceWriter()
        await writer.write_async(trace)

    Configuration (via settings):
        - store_llm_traces: Enable/disable (default: False)
    """

    def __init__(self):
        self._client = None
        self._shutdown = False

        # Check if ClickHouse is configured - if not, writing is disabled
        self._enabled = bool(settings.clickhouse_endpoint and settings.clickhouse_password)

        # Register shutdown handler
        atexit.register(self._sync_shutdown)

    def _get_client(self):
        """Initialize ClickHouse client on first use (lazy loading)."""
        if self._client is not None:
            return self._client

        # Import lazily so OSS users who never enable this don't pay import cost
        import clickhouse_connect

        host, port, secure = _parse_clickhouse_endpoint(settings.clickhouse_endpoint)
        database = settings.clickhouse_database or "otel"
        username = settings.clickhouse_username or "default"

        self._client = clickhouse_connect.get_client(
            host=host,
            port=port,
            username=username,
            password=settings.clickhouse_password,
            database=database,
            secure=secure,
            verify=True,
            settings={
                # Enable server-side batching
                "async_insert": 1,
                # Don't wait for server-side flush acknowledgment — fire and forget.
                # Waiting (value=1) caused each insert to hold an asyncio.Lock for ~1s,
                # creating unbounded task queues that saturated the event loop under load.
                "wait_for_async_insert": 0,
                # Flush after 1 second if batch not full
                "async_insert_busy_timeout_ms": 1000,
            },
        )
        logger.info(f"LLMTraceWriter: Connected to ClickHouse at {host}:{port}/{database} (async_insert enabled)")
        return self._client

    async def write_async(self, trace: "LLMTrace") -> None:
        """
        Write a trace to ClickHouse (fire-and-forget with retry).

        ClickHouse's async_insert handles batching server-side for optimal
        write performance. This method retries on failure with exponential
        backoff.

        Args:
            trace: The LLMTrace to write
        """
        if not self._enabled or self._shutdown:
            return

        try:
            task = asyncio.create_task(self._write_with_retry(trace))
            _background_tasks.add(task)
            task.add_done_callback(_background_tasks.discard)
        except RuntimeError:
            pass

    async def _write_with_retry(self, trace: "LLMTrace") -> None:
        """Write a single trace with retry on failure."""
        from letta.schemas.llm_trace import LLMTrace

        for attempt in range(MAX_RETRIES):
            try:
                client = self._get_client()
                row = trace.to_clickhouse_row()
                columns = LLMTrace.clickhouse_columns()

                # Run synchronous insert in thread pool. clickhouse-connect supports
                # multithreaded use via a thread-safe connection pool:
                # https://clickhouse.com/docs/integrations/language-clients/python/advanced-usage#multithreaded-multiprocess-and-asyncevent-driven-use-cases
                await asyncio.to_thread(
                    client.insert,
                    "llm_traces",
                    [row],
                    column_names=columns,
                )
                return  # Success

            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    backoff = INITIAL_BACKOFF_SECONDS * (2**attempt)
                    logger.warning(f"LLMTraceWriter: Retry {attempt + 1}/{MAX_RETRIES}, backoff {backoff}s: {e}")
                    await asyncio.sleep(backoff)
                else:
                    logger.error(f"LLMTraceWriter: Dropping trace after {MAX_RETRIES} retries: {e}")

    async def shutdown_async(self) -> None:
        """Gracefully shutdown the writer."""
        self._shutdown = True

        # Close client
        if self._client:
            try:
                self._client.close()
            except Exception as e:
                logger.warning(f"LLMTraceWriter: Error closing client: {e}")
            self._client = None

        logger.info("LLMTraceWriter: Shutdown complete")

    def _sync_shutdown(self) -> None:
        """Synchronous shutdown handler for atexit."""
        if not self._enabled or self._shutdown:
            return

        self._shutdown = True

        if self._client:
            try:
                self._client.close()
            except Exception:
                pass


# Module-level instance for easy access
_writer_instance: Optional[LLMTraceWriter] = None


def get_llm_trace_writer() -> LLMTraceWriter:
    """Get the singleton LLMTraceWriter instance."""
    global _writer_instance
    if _writer_instance is None:
        _writer_instance = LLMTraceWriter()
    return _writer_instance
