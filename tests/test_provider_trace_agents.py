"""
Unit tests for provider trace telemetry across agent versions and adapters.

Tests verify that telemetry context is correctly passed through:
- Tool generation endpoint
- LettaAgent (v1), LettaAgentV2, LettaAgentV3
- Streaming and non-streaming paths
- Different stream adapters
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.llm_config import LLMConfig


@pytest.fixture
def mock_llm_config():
    """Create a mock LLM config."""
    return LLMConfig(
        model="gpt-4o-mini",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=8000,
    )


class TestToolGenerationTelemetry:
    """Tests for tool generation endpoint telemetry."""

    @pytest.mark.asyncio
    async def test_generate_tool_sets_call_type(self, mock_llm_config):
        """Verify generate_tool endpoint sets call_type='tool_generation'."""
        from letta.llm_api.llm_client import LLMClient
        from letta.schemas.user import User

        mock_actor = User(
            id=f"user-{uuid.uuid4()}",
            organization_id=f"org-{uuid.uuid4()}",
            name="test_user",
        )

        captured_telemetry = {}

        def capture_telemetry(**kwargs):
            captured_telemetry.update(kwargs)

        with patch.object(LLMClient, "create") as mock_create:
            mock_client = MagicMock()
            mock_client.set_telemetry_context = capture_telemetry
            mock_client.build_request_data = MagicMock(return_value={})
            mock_client.request_async_with_telemetry = AsyncMock(return_value={})
            mock_client.convert_response_to_chat_completion = AsyncMock(
                return_value=MagicMock(
                    choices=[
                        MagicMock(
                            message=MagicMock(
                                tool_calls=[
                                    MagicMock(
                                        function=MagicMock(
                                            arguments='{"raw_source_code": "def test(): pass", "sample_args_json": "{}", "pip_requirements_json": "{}"}'
                                        )
                                    )
                                ],
                                content=None,
                            )
                        )
                    ]
                )
            )
            mock_create.return_value = mock_client

            from letta.server.rest_api.routers.v1.tools import GenerateToolInput, generate_tool_from_prompt

            mock_server = MagicMock()
            mock_server.user_manager.get_actor_or_default_async = AsyncMock(return_value=mock_actor)
            mock_server.get_llm_config_from_handle_async = AsyncMock(return_value=mock_llm_config)

            mock_headers = MagicMock()
            mock_headers.actor_id = mock_actor.id

            request = GenerateToolInput(
                prompt="Create a function that adds two numbers",
                tool_name="add_numbers",
                validation_errors=[],
            )

            with patch("letta.server.rest_api.routers.v1.tools.derive_openai_json_schema") as mock_schema:
                mock_schema.return_value = {"name": "add_numbers", "parameters": {}}
                try:
                    await generate_tool_from_prompt(request=request, server=mock_server, headers=mock_headers)
                except Exception:
                    pass

            assert captured_telemetry.get("call_type") == "tool_generation"

    @pytest.mark.asyncio
    async def test_generate_tool_has_no_agent_context(self, mock_llm_config):
        """Verify generate_tool doesn't have agent_id since it's not agent-bound."""
        from letta.llm_api.llm_client import LLMClient
        from letta.schemas.user import User

        mock_actor = User(
            id=f"user-{uuid.uuid4()}",
            organization_id=f"org-{uuid.uuid4()}",
            name="test_user",
        )

        captured_telemetry = {}

        def capture_telemetry(**kwargs):
            captured_telemetry.update(kwargs)

        with patch.object(LLMClient, "create") as mock_create:
            mock_client = MagicMock()
            mock_client.set_telemetry_context = capture_telemetry
            mock_client.build_request_data = MagicMock(return_value={})
            mock_client.request_async_with_telemetry = AsyncMock(return_value={})
            mock_client.convert_response_to_chat_completion = AsyncMock(
                return_value=MagicMock(
                    choices=[
                        MagicMock(
                            message=MagicMock(
                                tool_calls=[
                                    MagicMock(
                                        function=MagicMock(
                                            arguments='{"raw_source_code": "def test(): pass", "sample_args_json": "{}", "pip_requirements_json": "{}"}'
                                        )
                                    )
                                ],
                                content=None,
                            )
                        )
                    ]
                )
            )
            mock_create.return_value = mock_client

            from letta.server.rest_api.routers.v1.tools import GenerateToolInput, generate_tool_from_prompt

            mock_server = MagicMock()
            mock_server.user_manager.get_actor_or_default_async = AsyncMock(return_value=mock_actor)
            mock_server.get_llm_config_from_handle_async = AsyncMock(return_value=mock_llm_config)

            mock_headers = MagicMock()
            mock_headers.actor_id = mock_actor.id

            request = GenerateToolInput(
                prompt="Create a function",
                tool_name="test_func",
                validation_errors=[],
            )

            with patch("letta.server.rest_api.routers.v1.tools.derive_openai_json_schema") as mock_schema:
                mock_schema.return_value = {"name": "test_func", "parameters": {}}
                try:
                    await generate_tool_from_prompt(request=request, server=mock_server, headers=mock_headers)
                except Exception:
                    pass

            assert captured_telemetry.get("agent_id") is None
            assert captured_telemetry.get("step_id") is None
            assert captured_telemetry.get("run_id") is None


class TestLLMClientTelemetryContext:
    """Tests for LLMClient telemetry context methods."""

    def test_llm_client_has_set_telemetry_context_method(self):
        """Verify LLMClient exposes set_telemetry_context."""
        from letta.llm_api.llm_client import LLMClient

        client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)
        assert hasattr(client, "set_telemetry_context")
        assert callable(client.set_telemetry_context)

    def test_llm_client_set_telemetry_context_accepts_all_fields(self):
        """Verify set_telemetry_context accepts all telemetry fields."""
        from letta.llm_api.llm_client import LLMClient

        client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)

        client.set_telemetry_context(
            agent_id=f"agent-{uuid.uuid4()}",
            agent_tags=["tag1", "tag2"],
            run_id=f"run-{uuid.uuid4()}",
            step_id=f"step-{uuid.uuid4()}",
            call_type="summarization",
        )


class TestAdapterTelemetryAttributes:
    """Tests for adapter telemetry attribute support."""

    def test_base_adapter_has_telemetry_attributes(self, mock_llm_config):
        """Verify base LettaLLMAdapter has telemetry attributes."""
        from letta.adapters.letta_llm_adapter import LettaLLMAdapter
        from letta.llm_api.llm_client import LLMClient

        mock_client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)

        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["test-tag"]
        run_id = f"run-{uuid.uuid4()}"

        class TestAdapter(LettaLLMAdapter):
            async def invoke_llm(self, *args, **kwargs):
                pass

        adapter = TestAdapter(
            llm_client=mock_client,
            llm_config=mock_llm_config,
            agent_id=agent_id,
            agent_tags=agent_tags,
            run_id=run_id,
        )

        assert adapter.agent_id == agent_id
        assert adapter.agent_tags == agent_tags
        assert adapter.run_id == run_id

    def test_request_adapter_inherits_telemetry_attributes(self, mock_llm_config):
        """Verify LettaLLMRequestAdapter inherits telemetry attributes."""
        from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
        from letta.llm_api.llm_client import LLMClient

        mock_client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)

        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["request-tag"]
        run_id = f"run-{uuid.uuid4()}"

        adapter = LettaLLMRequestAdapter(
            llm_client=mock_client,
            llm_config=mock_llm_config,
            agent_id=agent_id,
            agent_tags=agent_tags,
            run_id=run_id,
        )

        assert adapter.agent_id == agent_id
        assert adapter.agent_tags == agent_tags
        assert adapter.run_id == run_id

    def test_stream_adapter_inherits_telemetry_attributes(self, mock_llm_config):
        """Verify LettaLLMStreamAdapter inherits telemetry attributes."""
        from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
        from letta.llm_api.llm_client import LLMClient

        mock_client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)

        agent_id = f"agent-{uuid.uuid4()}"
        agent_tags = ["stream-tag"]
        run_id = f"run-{uuid.uuid4()}"

        adapter = LettaLLMStreamAdapter(
            llm_client=mock_client,
            llm_config=mock_llm_config,
            agent_id=agent_id,
            agent_tags=agent_tags,
            run_id=run_id,
        )

        assert adapter.agent_id == agent_id
        assert adapter.agent_tags == agent_tags
        assert adapter.run_id == run_id

    def test_request_and_stream_adapters_have_consistent_interface(self, mock_llm_config):
        """Verify both adapter types have the same telemetry interface."""
        from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
        from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
        from letta.llm_api.llm_client import LLMClient

        mock_client = LLMClient.create(provider_type="openai", put_inner_thoughts_first=True)

        request_adapter = LettaLLMRequestAdapter(llm_client=mock_client, llm_config=mock_llm_config)
        stream_adapter = LettaLLMStreamAdapter(llm_client=mock_client, llm_config=mock_llm_config)

        for attr in ["agent_id", "agent_tags", "run_id"]:
            assert hasattr(request_adapter, attr), f"LettaLLMRequestAdapter missing {attr}"
            assert hasattr(stream_adapter, attr), f"LettaLLMStreamAdapter missing {attr}"


class TestSummarizerTelemetry:
    """Tests for Summarizer class telemetry context."""

    def test_summarizer_stores_telemetry_context(self):
        """Verify Summarizer stores telemetry context from constructor."""
        from letta.schemas.user import User
        from letta.services.summarizer.enums import SummarizationMode
        from letta.services.summarizer.summarizer import Summarizer

        mock_actor = User(
            id=f"user-{uuid.uuid4()}",
            organization_id=f"org-{uuid.uuid4()}",
            name="test_user",
        )

        agent_id = f"agent-{uuid.uuid4()}"
        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"

        summarizer = Summarizer(
            mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=100,
            message_buffer_min=10,
            partial_evict_summarizer_percentage=0.5,
            agent_manager=MagicMock(),
            message_manager=MagicMock(),
            actor=mock_actor,
            agent_id=agent_id,
            run_id=run_id,
            step_id=step_id,
        )

        assert summarizer.agent_id == agent_id
        assert summarizer.run_id == run_id
        assert summarizer.step_id == step_id

    @pytest.mark.asyncio
    async def test_summarize_method_accepts_runtime_telemetry(self):
        """Verify summarize() method accepts runtime run_id/step_id."""
        from letta.schemas.enums import MessageRole
        from letta.schemas.message import Message
        from letta.schemas.user import User
        from letta.services.summarizer.enums import SummarizationMode
        from letta.services.summarizer.summarizer import Summarizer

        mock_actor = User(
            id=f"user-{uuid.uuid4()}",
            organization_id=f"org-{uuid.uuid4()}",
            name="test_user",
        )

        agent_id = f"agent-{uuid.uuid4()}"
        mock_messages = [
            Message(
                id=f"message-{uuid.uuid4()}",
                role=MessageRole.user,
                content=[{"type": "text", "text": "Hello"}],
                agent_id=agent_id,
            )
        ]

        summarizer = Summarizer(
            mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=100,
            message_buffer_min=10,
            partial_evict_summarizer_percentage=0.5,
            agent_manager=MagicMock(),
            message_manager=MagicMock(),
            actor=mock_actor,
            agent_id=agent_id,
        )

        run_id = f"run-{uuid.uuid4()}"
        step_id = f"step-{uuid.uuid4()}"

        result = await summarizer.summarize(
            in_context_messages=mock_messages,
            new_letta_messages=[],
            force=False,
            run_id=run_id,
            step_id=step_id,
        )

        assert result is not None


class TestAgentAdapterInstantiation:
    """Tests verifying agents instantiate adapters with telemetry context."""

    def test_agent_v2_creates_summarizer_with_agent_id(self, mock_llm_config):
        """Verify LettaAgentV2 creates Summarizer with correct agent_id."""
        from letta.agents.letta_agent_v2 import LettaAgentV2
        from letta.schemas.agent import AgentState, AgentType
        from letta.schemas.embedding_config import EmbeddingConfig
        from letta.schemas.memory import Memory
        from letta.schemas.user import User

        mock_actor = User(
            id=f"user-{uuid.uuid4()}",
            organization_id=f"org-{uuid.uuid4()}",
            name="test_user",
        )

        agent_id = f"agent-{uuid.uuid4()}"
        agent_state = AgentState(
            id=agent_id,
            name="test_agent",
            agent_type=AgentType.letta_v1_agent,
            llm_config=mock_llm_config,
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tags=["test"],
            memory=Memory(blocks=[]),
            system="You are a helpful assistant.",
            tools=[],
            sources=[],
            blocks=[],
        )

        agent = LettaAgentV2(agent_state=agent_state, actor=mock_actor)

        assert agent.summarizer.agent_id == agent_id
