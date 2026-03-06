"""
Unit tests for OpenAI WebSocket session manager and header plumbing.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.llm_api.openai_ws_session import AsyncStreamCompat, OpenAIWSSessionManager
from letta.server.rest_api.dependencies import ExperimentalParams

# ------------------------------------------------------------------ #
#  ExperimentalParams tests
# ------------------------------------------------------------------ #


class TestExperimentalParams:
    """Verify the new openai_responses_websocket field on ExperimentalParams."""

    def test_default_is_none(self):
        params = ExperimentalParams()
        assert params.openai_responses_websocket is None

    def test_explicit_true(self):
        params = ExperimentalParams(openai_responses_websocket=True)
        assert params.openai_responses_websocket is True

    def test_explicit_false(self):
        params = ExperimentalParams(openai_responses_websocket=False)
        assert params.openai_responses_websocket is False


# ------------------------------------------------------------------ #
#  AsyncStreamCompat tests
# ------------------------------------------------------------------ #


class TestAsyncStreamCompat:
    """AsyncStreamCompat should behave as an async context-manager + async-iterator."""

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Can use ``async with``."""

        async def _gen():
            yield "a"
            yield "b"

        async with AsyncStreamCompat(_gen()) as stream:
            items = [item async for item in stream]
        assert items == ["a", "b"]

    @pytest.mark.asyncio
    async def test_iteration_without_context_manager(self):
        """Can also iterate directly."""

        async def _gen():
            yield 1
            yield 2

        compat = AsyncStreamCompat(_gen())
        items = [item async for item in compat]
        assert items == [1, 2]


# ------------------------------------------------------------------ #
#  OpenAIWSSessionManager tests
# ------------------------------------------------------------------ #


class TestOpenAIWSSessionManager:
    """Unit tests for WebSocket session lifecycle and streaming."""

    @pytest.mark.asyncio
    async def test_aclose_is_idempotent(self):
        """Calling aclose() multiple times should not raise."""
        session = OpenAIWSSessionManager(client_kwargs={"api_key": "test"})
        await session.aclose()
        await session.aclose()  # second call should be a no-op

    @pytest.mark.asyncio
    async def test_stream_after_close_raises(self):
        """Using the session after closing should raise RuntimeError."""
        session = OpenAIWSSessionManager(client_kwargs={"api_key": "test"})
        await session.aclose()
        with pytest.raises(RuntimeError, match="has been closed"):
            async for _ in session.stream_responses({"input": "hello", "model": "gpt-5"}):
                pass

    @pytest.mark.asyncio
    async def test_lazy_connect(self):
        """Connection should be established on first stream_responses() call, not on init."""
        session = OpenAIWSSessionManager(client_kwargs={"api_key": "test"})
        assert session._connection is None
        assert session._client is None

    @pytest.mark.asyncio
    async def test_stream_responses_yields_events_and_stops_on_terminal(self):
        """stream_responses should yield events and break on ResponseCompletedEvent."""
        from openai.types.responses import ResponseCompletedEvent, ResponseCreatedEvent

        # Create mock events
        created_event = MagicMock(spec=ResponseCreatedEvent)
        created_event.type = "response.created"

        # Build a minimal ResponseCompletedEvent mock
        completed_event = MagicMock(spec=ResponseCompletedEvent)
        completed_event.type = "response.completed"

        # Build a real async-iterable mock connection
        events = [created_event, completed_event]

        class FakeConnection:
            def __init__(self):
                self.response = AsyncMock()
                self.response.create = AsyncMock()

            async def __aiter__(self):
                for e in events:
                    yield e

        fake_connection = FakeConnection()

        # Mock the connection manager
        class FakeConnectionManager:
            async def __aenter__(self_):
                return fake_connection

            async def __aexit__(self_, *args):
                pass

        session = OpenAIWSSessionManager(client_kwargs={"api_key": "test"})

        with patch("letta.llm_api.openai_ws_session.AsyncOpenAI") as MockClient:
            mock_client_instance = MagicMock()
            mock_client_instance.responses.connect.return_value = FakeConnectionManager()
            mock_client_instance.close = AsyncMock()
            MockClient.return_value = mock_client_instance

            collected = []
            async for event in session.stream_responses({"input": "hello", "model": "gpt-5"}):
                collected.append(event)

            # Should have yielded both events
            assert len(collected) == 2
            assert collected[0] is created_event
            assert collected[1] is completed_event

        await session.aclose()


# ------------------------------------------------------------------ #
#  Adapter flag propagation test
# ------------------------------------------------------------------ #


class TestAdapterWSFlag:
    """Verify that the WS flag flows through the adapter hierarchy."""

    def test_letta_llm_stream_adapter_stores_flag(self):
        from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter

        mock_client = MagicMock()
        mock_config = MagicMock()

        adapter = LettaLLMStreamAdapter.__new__(LettaLLMStreamAdapter)
        adapter.__init__(
            llm_client=mock_client,
            llm_config=mock_config,
            call_type="agent_step",
            use_openai_responses_websocket=True,
        )
        assert adapter.use_openai_responses_websocket is True
        assert adapter._ws_session is None

    def test_default_flag_is_false(self):
        from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter

        mock_client = MagicMock()
        mock_config = MagicMock()

        adapter = LettaLLMStreamAdapter.__new__(LettaLLMStreamAdapter)
        adapter.__init__(
            llm_client=mock_client,
            llm_config=mock_config,
            call_type="agent_step",
        )
        assert adapter.use_openai_responses_websocket is False

    @pytest.mark.asyncio
    async def test_aclose_default_is_noop(self):
        """Base adapter aclose should be a no-op."""
        from letta.adapters.letta_llm_adapter import LettaLLMAdapter

        mock_client = MagicMock()
        mock_config = MagicMock()

        # Create a concrete subclass just for testing
        class ConcreteAdapter(LettaLLMAdapter):
            async def invoke_llm(self, *args, **kwargs):
                pass

            def log_provider_trace(self, *args, **kwargs):
                pass

        adapter = ConcreteAdapter(
            llm_client=mock_client,
            llm_config=mock_config,
            call_type="agent_step",
        )
        # Should not raise
        await adapter.aclose()
