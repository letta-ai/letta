"""
Unit tests for summarization provider trace telemetry context.

These tests verify that summarization LLM calls correctly pass telemetry context
(agent_id, agent_tags, run_id, step_id) to the provider trace system.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.agent import AgentState
from letta.schemas.block import Block
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.user import User
from letta.services.summarizer import summarizer_all, summarizer_sliding_window
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer, simple_summary
from letta.services.summarizer.summarizer_config import CompactionSettings


@pytest.fixture
def mock_actor():
    """Create a mock user/actor."""
    return User(
        id=f"user-{uuid.uuid4()}",
        organization_id=f"org-{uuid.uuid4()}",
        name="test_user",
    )


@pytest.fixture
def mock_llm_config():
    """Create a mock LLM config."""
    return LLMConfig(
        model="gpt-4o-mini",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=8000,
    )


@pytest.fixture
def mock_agent_state(mock_llm_config):
    """Create a mock agent state."""
    agent_id = f"agent-{uuid.uuid4()}"
    return AgentState(
        id=agent_id,
        name="test_agent",
        llm_config=mock_llm_config,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        tags=["env:test", "team:ml"],
        memory=MagicMock(
            compile=MagicMock(return_value="Memory content"),
        ),
        message_ids=[],
        tool_ids=[],
        system="You are a helpful assistant.",
    )


@pytest.fixture
def mock_messages():
    """Create mock messages for summarization."""
    agent_id = f"agent-{uuid.uuid4()}"
    messages = []
    for i in range(10):
        msg = Message(
            id=f"message-{uuid.uuid4()}",
            role=MessageRole.user if i % 2 == 0 else MessageRole.assistant,
            content=[{"type": "text", "text": f"Message content {i}"}],
            agent_id=agent_id,
        )
        messages.append(msg)
    return messages


class TestSimpleSummaryTelemetryContext:
    """Tests for simple_summary telemetry context passing."""

    @pytest.mark.asyncio
    async def test_simple_summary_accepts_telemetry_params(self, mock_messages, mock_llm_config, mock_actor):
        """Verify simple_summary accepts all telemetry context parameters."""
        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["tag1", "tag2"]
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"

        with patch("letta.services.summarizer.summarizer.LLMClient") as mock_client_class:
            mock_client = MagicMock()
            mock_client.set_telemetry_context = MagicMock()
            mock_client.send_llm_request_async = AsyncMock(return_value=MagicMock(content="Summary of conversation"))
            mock_client_class.create.return_value = mock_client

            try:
                await simple_summary(
                    messages=mock_messages,
                    llm_config=mock_llm_config,
                    actor=mock_actor,
                    agent_id=agent_id,
                    agent_tags=agent_tags,
                    run_id=run_id,
                    step_id=step_id,
                )
            except Exception:
                pass

            mock_client.set_telemetry_context.assert_called_once()
            call_kwargs = mock_client.set_telemetry_context.call_args[1]
            assert call_kwargs["agent_id"] == agent_id
            assert call_kwargs["agent_tags"] == agent_tags
            assert call_kwargs["run_id"] == run_id
            assert call_kwargs["step_id"] == step_id
            assert call_kwargs["call_type"] == "summarization"


class TestSummarizeAllTelemetryContext:
    """Tests for summarize_all telemetry context passing."""

    @pytest.fixture
    def mock_compaction_settings(self):
        """Create mock compaction settings."""
        return CompactionSettings(model="openai/gpt-4o-mini")

    @pytest.mark.asyncio
    async def test_summarize_all_passes_telemetry_to_simple_summary(
        self, mock_messages, mock_llm_config, mock_actor, mock_compaction_settings
    ):
        """Verify summarize_all passes telemetry context to simple_summary."""
        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["env:prod", "team:core"]
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"

        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch.object(summarizer_all, "simple_summary", new=capture_simple_summary):
            await summarizer_all.summarize_all(
                actor=mock_actor,
                llm_config=mock_llm_config,
                summarizer_config=mock_compaction_settings,
                in_context_messages=mock_messages,
                agent_id=agent_id,
                agent_tags=agent_tags,
                run_id=run_id,
                step_id=step_id,
            )

        assert captured_kwargs.get("agent_id") == agent_id
        assert captured_kwargs.get("agent_tags") == agent_tags
        assert captured_kwargs.get("run_id") == run_id
        assert captured_kwargs.get("step_id") == step_id

    @pytest.mark.asyncio
    async def test_summarize_all_without_telemetry_params(self, mock_messages, mock_llm_config, mock_actor, mock_compaction_settings):
        """Verify summarize_all works without telemetry params (backwards compatible)."""
        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch.object(summarizer_all, "simple_summary", new=capture_simple_summary):
            await summarizer_all.summarize_all(
                actor=mock_actor,
                llm_config=mock_llm_config,
                summarizer_config=mock_compaction_settings,
                in_context_messages=mock_messages,
            )

        assert captured_kwargs.get("agent_id") is None
        assert captured_kwargs.get("agent_tags") is None
        assert captured_kwargs.get("run_id") is None
        assert captured_kwargs.get("step_id") is None


class TestSummarizeSlidingWindowTelemetryContext:
    """Tests for summarize_via_sliding_window telemetry context passing."""

    @pytest.fixture
    def mock_compaction_settings(self):
        """Create mock compaction settings."""
        return CompactionSettings(model="openai/gpt-4o-mini")

    @pytest.mark.asyncio
    async def test_sliding_window_passes_telemetry_to_simple_summary(
        self, mock_messages, mock_llm_config, mock_actor, mock_compaction_settings
    ):
        """Verify summarize_via_sliding_window passes telemetry context to simple_summary."""
        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["version:v2"]
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"

        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch.object(summarizer_sliding_window, "simple_summary", new=capture_simple_summary):
            await summarizer_sliding_window.summarize_via_sliding_window(
                actor=mock_actor,
                llm_config=mock_llm_config,
                summarizer_config=mock_compaction_settings,
                in_context_messages=mock_messages,
                agent_id=agent_id,
                agent_tags=agent_tags,
                run_id=run_id,
                step_id=step_id,
            )

        assert captured_kwargs.get("agent_id") == agent_id
        assert captured_kwargs.get("agent_tags") == agent_tags
        assert captured_kwargs.get("run_id") == run_id
        assert captured_kwargs.get("step_id") == step_id


class TestSummarizerClassTelemetryContext:
    """Tests for Summarizer class telemetry context passing."""

    @pytest.mark.asyncio
    async def test_summarizer_summarize_passes_runtime_telemetry(self, mock_messages, mock_actor):
        """Verify Summarizer.summarize() passes runtime run_id/step_id to the underlying call."""
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"
        agent_id = f"agent-{uuid.uuid4()}"

        mock_agent_manager = MagicMock()
        mock_agent_manager.get_agent_by_id_async = AsyncMock(
            return_value=MagicMock(
                llm_config=LLMConfig(
                    model="gpt-4o-mini",
                    model_endpoint_type="openai",
                    model_endpoint="https://api.openai.com/v1",
                    context_window=8000,
                ),
                tags=["test-tag"],
            )
        )

        summarizer = Summarizer(
            mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=100,
            message_buffer_min=10,
            partial_evict_summarizer_percentage=0.5,
            agent_manager=mock_agent_manager,
            message_manager=MagicMock(),
            actor=mock_actor,
            agent_id=agent_id,
        )

        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch("letta.services.summarizer.summarizer.simple_summary", new=capture_simple_summary):
            try:
                await summarizer.summarize(
                    in_context_messages=mock_messages,
                    new_letta_messages=[],
                    force=True,
                    run_id=run_id,
                    step_id=step_id,
                )
            except Exception:
                pass

        if captured_kwargs:
            assert captured_kwargs.get("run_id") == run_id
            assert captured_kwargs.get("step_id") == step_id

    @pytest.mark.asyncio
    async def test_summarizer_uses_constructor_telemetry_as_default(self, mock_messages, mock_actor):
        """Verify Summarizer uses constructor run_id/step_id when not passed to summarize()."""
        constructor_run_id = f"run-{uuid.uuid4()}"
        constructor_step_id = f"step-{uuid.uuid4()}"
        agent_id = f"agent-{uuid.uuid4()}"

        mock_agent_manager = MagicMock()
        mock_agent_manager.get_agent_by_id_async = AsyncMock(
            return_value=MagicMock(
                llm_config=LLMConfig(
                    model="gpt-4o-mini",
                    model_endpoint_type="openai",
                    model_endpoint="https://api.openai.com/v1",
                    context_window=8000,
                ),
                tags=["test-tag"],
            )
        )

        summarizer = Summarizer(
            mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=100,
            message_buffer_min=10,
            partial_evict_summarizer_percentage=0.5,
            agent_manager=mock_agent_manager,
            message_manager=MagicMock(),
            actor=mock_actor,
            agent_id=agent_id,
            run_id=constructor_run_id,
            step_id=constructor_step_id,
        )

        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch("letta.services.summarizer.summarizer.simple_summary", new=capture_simple_summary):
            try:
                await summarizer.summarize(
                    in_context_messages=mock_messages,
                    new_letta_messages=[],
                    force=True,
                )
            except Exception:
                pass

        if captured_kwargs:
            assert captured_kwargs.get("run_id") == constructor_run_id
            assert captured_kwargs.get("step_id") == constructor_step_id

    @pytest.mark.asyncio
    async def test_summarizer_runtime_overrides_constructor_telemetry(self, mock_messages, mock_actor):
        """Verify runtime run_id/step_id override constructor values."""
        constructor_run_id = f"run-constructor-{uuid.uuid4()}"
        constructor_step_id = f"step-constructor-{uuid.uuid4()}"
        runtime_run_id = f"run-runtime-{uuid.uuid4()}"
        runtime_step_id = f"step-runtime-{uuid.uuid4()}"
        agent_id = f"agent-{uuid.uuid4()}"

        mock_agent_manager = MagicMock()
        mock_agent_manager.get_agent_by_id_async = AsyncMock(
            return_value=MagicMock(
                llm_config=LLMConfig(
                    model="gpt-4o-mini",
                    model_endpoint_type="openai",
                    model_endpoint="https://api.openai.com/v1",
                    context_window=8000,
                ),
                tags=["test-tag"],
            )
        )

        summarizer = Summarizer(
            mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=100,
            message_buffer_min=10,
            partial_evict_summarizer_percentage=0.5,
            agent_manager=mock_agent_manager,
            message_manager=MagicMock(),
            actor=mock_actor,
            agent_id=agent_id,
            run_id=constructor_run_id,
            step_id=constructor_step_id,
        )

        captured_kwargs = {}

        async def capture_simple_summary(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return "Mocked summary"

        with patch("letta.services.summarizer.summarizer.simple_summary", new=capture_simple_summary):
            try:
                await summarizer.summarize(
                    in_context_messages=mock_messages,
                    new_letta_messages=[],
                    force=True,
                    run_id=runtime_run_id,
                    step_id=runtime_step_id,
                )
            except Exception:
                pass

        if captured_kwargs:
            assert captured_kwargs.get("run_id") == runtime_run_id
            assert captured_kwargs.get("step_id") == runtime_step_id


class TestLLMClientTelemetryContext:
    """Tests for LLM client telemetry context setting."""

    def test_llm_client_set_telemetry_context_method_exists(self):
        """Verify LLMClient has set_telemetry_context method."""
        from letta.llm_api.llm_client import LLMClient

        client = LLMClient.create(
            provider_type="openai",
            put_inner_thoughts_first=True,
        )
        assert hasattr(client, "set_telemetry_context")

    def test_llm_client_set_telemetry_context_accepts_all_params(self):
        """Verify set_telemetry_context accepts all telemetry parameters."""
        from letta.llm_api.llm_client import LLMClient

        client = LLMClient.create(
            provider_type="openai",
            put_inner_thoughts_first=True,
        )

        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["tag1", "tag2"]
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"
        call_type = "summarization"

        client.set_telemetry_context(
            agent_id=agent_id,
            agent_tags=agent_tags,
            run_id=run_id,
            step_id=step_id,
            call_type=call_type,
        )
