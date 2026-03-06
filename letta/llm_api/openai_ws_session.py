"""
WebSocket session manager for OpenAI Responses API.

Maintains a persistent WebSocket connection across multiple agent steps within
a single run, avoiding the per-step TCP+TLS handshake overhead of HTTP SSE.

Usage:
    session = OpenAIWSSessionManager(client_kwargs)
    try:
        async for event in session.stream_responses(request_data):
            ...  # same event types as SSE (ResponseStreamEvent)
        # can call stream_responses() again for the next step
    finally:
        await session.aclose()
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from openai import AsyncOpenAI
from openai.types.responses import (
    ResponseCompletedEvent,
    ResponseFailedEvent,
    ResponseIncompleteEvent,
)
from openai.types.responses.response_stream_event import ResponseStreamEvent

logger = logging.getLogger(__name__)


class AsyncStreamCompat:
    """
    Wraps an ``AsyncIterator[ResponseStreamEvent]`` so that it satisfies the
    ``async with stream:`` / ``async for event in stream:`` pattern expected
    by ``SimpleOpenAIResponsesStreamingInterface.process()``.

    The openai SDK's ``AsyncStream`` is a context manager; our WebSocket
    generator is not.  This thin shim bridges the gap.
    """

    def __init__(self, ait: AsyncIterator[ResponseStreamEvent]) -> None:
        self._ait = ait

    async def __aenter__(self) -> "AsyncStreamCompat":
        return self

    async def __aexit__(self, *exc: object) -> None:
        # Nothing to clean up — WS lifecycle is managed by the session manager
        pass

    def __aiter__(self) -> AsyncIterator[ResponseStreamEvent]:
        return self._ait

    async def __anext__(self) -> ResponseStreamEvent:
        return await self._ait.__anext__()


class OpenAIWSSessionManager:
    """
    Manages a persistent WebSocket connection to the OpenAI Responses API.

    The connection is established lazily on the first call to ``stream_responses``
    and reused for subsequent calls (i.e. subsequent agent steps within the same run).
    """

    def __init__(self, client_kwargs: dict[str, Any]) -> None:
        """
        Args:
            client_kwargs: keyword arguments forwarded to ``AsyncOpenAI(...)``
                           (api_key, base_url, default_headers, …).
        """
        self._client_kwargs = client_kwargs
        self._client: AsyncOpenAI | None = None
        self._connection: Any | None = None  # AsyncResponsesConnection
        self._connection_manager: Any | None = None  # AsyncResponsesConnectionManager (for __aexit__)
        self._closed = False

    # ------------------------------------------------------------------ #
    #  Connection lifecycle
    # ------------------------------------------------------------------ #

    async def _ensure_connected(self) -> Any:
        """Lazily open the WebSocket connection, reusing it across steps."""
        if self._closed:
            raise RuntimeError("OpenAIWSSessionManager has been closed")

        if self._connection is not None:
            return self._connection

        self._client = AsyncOpenAI(**self._client_kwargs)
        self._connection_manager = self._client.responses.connect()
        self._connection = await self._connection_manager.__aenter__()
        logger.info("OpenAI Responses WebSocket connection established")
        return self._connection

    async def aclose(self) -> None:
        """Close the WebSocket connection and release resources."""
        if self._closed:
            return
        self._closed = True

        if self._connection_manager is not None:
            try:
                await self._connection_manager.__aexit__(None, None, None)
            except Exception:
                logger.warning("Error closing WebSocket connection", exc_info=True)
            self._connection_manager = None
            self._connection = None

        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                logger.warning("Error closing AsyncOpenAI client", exc_info=True)
            self._client = None

    # ------------------------------------------------------------------ #
    #  Streaming
    # ------------------------------------------------------------------ #

    async def stream_responses(
        self,
        request_data: dict[str, Any],
    ) -> AsyncIterator[ResponseStreamEvent]:
        """
        Send a ``response.create`` message and yield events until the response
        reaches a terminal state (completed / failed / incomplete).

        The yielded events are the same typed objects as from the HTTP SSE stream
        (``AsyncStream[ResponseStreamEvent]``), so callers (e.g.
        ``SimpleOpenAIResponsesStreamingInterface.process``) can consume them
        identically.

        Args:
            request_data: The request payload (same dict that would be passed to
                ``client.responses.create(**request_data, stream=True)``).

        Yields:
            ``ResponseStreamEvent`` instances.
        """
        connection = await self._ensure_connected()

        # Send the response.create message via WebSocket
        await connection.response.create(**request_data, stream=True)

        # Consume events for this response
        async for event in connection:
            yield event

            # Terminal events — the response is done after one of these
            if isinstance(event, (ResponseCompletedEvent, ResponseFailedEvent, ResponseIncompleteEvent)):
                break

            # The SDK may also surface a `response.done` type in WS mode
            event_type = getattr(event, "type", None)
            if event_type == "response.done":
                break
