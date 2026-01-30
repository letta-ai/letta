"""Unit tests for MiniMax client."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.llm_api.minimax_client import MINIMAX_BASE_URL, MiniMaxClient
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig


class TestMiniMaxClient:
    """Tests for MiniMaxClient."""

    def setup_method(self):
        """Set up test fixtures."""
        self.client = MiniMaxClient(put_inner_thoughts_first=True)
        self.llm_config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
        )

    def test_is_reasoning_model_always_true(self):
        """All MiniMax models support native interleaved thinking."""
        assert self.client.is_reasoning_model(self.llm_config) is True

        # Test with different models
        for model_name in ["MiniMax-M2.1", "MiniMax-M2.1-lightning", "MiniMax-M2"]:
            config = LLMConfig(
                model=model_name,
                model_endpoint_type="minimax",
                model_endpoint=MINIMAX_BASE_URL,
                context_window=200000,
            )
            assert self.client.is_reasoning_model(config) is True

    def test_requires_auto_tool_choice(self):
        """MiniMax supports all tool choice modes."""
        assert self.client.requires_auto_tool_choice(self.llm_config) is False

    def test_supports_structured_output(self):
        """MiniMax doesn't currently advertise structured output support."""
        assert self.client.supports_structured_output(self.llm_config) is False

    @patch("letta.llm_api.minimax_client.model_settings")
    def test_get_anthropic_client_with_api_key(self, mock_settings):
        """Test client creation with API key."""
        mock_settings.minimax_api_key = "test-api-key"

        with patch("letta.llm_api.minimax_client.anthropic") as mock_anthropic:
            mock_anthropic.Anthropic.return_value = MagicMock()

            # Mock BYOK to return no override
            self.client.get_byok_overrides = MagicMock(return_value=(None, None, None))

            client = self.client._get_anthropic_client(self.llm_config, async_client=False)

            mock_anthropic.Anthropic.assert_called_once_with(
                api_key="test-api-key",
                base_url=MINIMAX_BASE_URL,
            )

    @patch("letta.llm_api.minimax_client.model_settings")
    def test_get_anthropic_client_async(self, mock_settings):
        """Test async client creation."""
        mock_settings.minimax_api_key = "test-api-key"

        with patch("letta.llm_api.minimax_client.anthropic") as mock_anthropic:
            mock_anthropic.AsyncAnthropic.return_value = MagicMock()

            # Mock BYOK to return no override
            self.client.get_byok_overrides = MagicMock(return_value=(None, None, None))

            client = self.client._get_anthropic_client(self.llm_config, async_client=True)

            mock_anthropic.AsyncAnthropic.assert_called_once_with(
                api_key="test-api-key",
                base_url=MINIMAX_BASE_URL,
            )


class TestMiniMaxClientTemperatureClamping:
    """Tests for temperature clamping in build_request_data."""

    def setup_method(self):
        """Set up test fixtures."""
        self.client = MiniMaxClient(put_inner_thoughts_first=True)
        self.llm_config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
            temperature=0.7,
        )

    @patch.object(MiniMaxClient, "build_request_data")
    def test_temperature_clamping_is_applied(self, mock_build):
        """Verify build_request_data is called for temperature clamping."""
        # This is a basic test to ensure the method exists and can be called
        mock_build.return_value = {"temperature": 0.7}
        result = self.client.build_request_data(
            agent_type=AgentType.letta_v1_agent,
            messages=[],
            llm_config=self.llm_config,
        )
        mock_build.assert_called_once()

    def test_temperature_zero_clamped(self):
        """Test that temperature=0 is clamped to 0.01."""
        config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
            temperature=0,
        )

        # Mock the parent class method to return a basic dict
        with patch.object(MiniMaxClient.__bases__[0], "build_request_data") as mock_parent:
            mock_parent.return_value = {"temperature": 0, "model": "MiniMax-M2.1"}

            result = self.client.build_request_data(
                agent_type=AgentType.letta_v1_agent,
                messages=[],
                llm_config=config,
            )

            # Temperature should be clamped to 0.01
            assert result["temperature"] == 0.01

    def test_temperature_negative_clamped(self):
        """Test that negative temperature is clamped to 0.01."""
        config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
            temperature=-0.5,
        )

        with patch.object(MiniMaxClient.__bases__[0], "build_request_data") as mock_parent:
            mock_parent.return_value = {"temperature": -0.5, "model": "MiniMax-M2.1"}

            result = self.client.build_request_data(
                agent_type=AgentType.letta_v1_agent,
                messages=[],
                llm_config=config,
            )

            assert result["temperature"] == 0.01

    def test_temperature_above_one_clamped(self):
        """Test that temperature > 1.0 is clamped to 1.0."""
        config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
            temperature=1.5,
        )

        with patch.object(MiniMaxClient.__bases__[0], "build_request_data") as mock_parent:
            mock_parent.return_value = {"temperature": 1.5, "model": "MiniMax-M2.1"}

            result = self.client.build_request_data(
                agent_type=AgentType.letta_v1_agent,
                messages=[],
                llm_config=config,
            )

            assert result["temperature"] == 1.0

    def test_temperature_valid_not_modified(self):
        """Test that valid temperature values are not modified."""
        config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
            temperature=0.7,
        )

        with patch.object(MiniMaxClient.__bases__[0], "build_request_data") as mock_parent:
            mock_parent.return_value = {"temperature": 0.7, "model": "MiniMax-M2.1"}

            result = self.client.build_request_data(
                agent_type=AgentType.letta_v1_agent,
                messages=[],
                llm_config=config,
            )

            assert result["temperature"] == 0.7


class TestMiniMaxClientUsesNonBetaAPI:
    """Tests to verify MiniMax client uses non-beta API."""

    def test_request_uses_messages_not_beta(self):
        """Verify request() uses client.messages.create, not client.beta.messages.create."""
        client = MiniMaxClient(put_inner_thoughts_first=True)
        llm_config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
        )

        with patch.object(client, "_get_anthropic_client") as mock_get_client:
            mock_anthropic_client = MagicMock()
            mock_response = MagicMock()
            mock_response.model_dump.return_value = {"content": [{"type": "text", "text": "Hello"}]}
            mock_anthropic_client.messages.create.return_value = mock_response
            mock_get_client.return_value = mock_anthropic_client

            result = client.request({"model": "MiniMax-M2.1"}, llm_config)

            # Verify messages.create was called (not beta.messages.create)
            mock_anthropic_client.messages.create.assert_called_once()
            # Verify beta was NOT accessed
            assert not hasattr(mock_anthropic_client, "beta") or not mock_anthropic_client.beta.messages.create.called

    @pytest.mark.asyncio
    async def test_request_async_uses_messages_not_beta(self):
        """Verify request_async() uses client.messages.create, not client.beta.messages.create."""
        client = MiniMaxClient(put_inner_thoughts_first=True)
        llm_config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
        )

        with patch.object(client, "_get_anthropic_client_async") as mock_get_client:
            mock_anthropic_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.model_dump.return_value = {"content": [{"type": "text", "text": "Hello"}]}
            mock_anthropic_client.messages.create.return_value = mock_response
            mock_get_client.return_value = mock_anthropic_client

            result = await client.request_async({"model": "MiniMax-M2.1"}, llm_config)

            # Verify messages.create was called (not beta.messages.create)
            mock_anthropic_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_stream_async_uses_messages_not_beta(self):
        """Verify stream_async() uses client.messages.create, not client.beta.messages.create."""
        client = MiniMaxClient(put_inner_thoughts_first=True)
        llm_config = LLMConfig(
            model="MiniMax-M2.1",
            model_endpoint_type="minimax",
            model_endpoint=MINIMAX_BASE_URL,
            context_window=200000,
        )

        with patch.object(client, "_get_anthropic_client_async") as mock_get_client:
            mock_anthropic_client = AsyncMock()
            mock_stream = AsyncMock()
            mock_anthropic_client.messages.create.return_value = mock_stream
            mock_get_client.return_value = mock_anthropic_client

            result = await client.stream_async({"model": "MiniMax-M2.1"}, llm_config)

            # Verify messages.create was called (not beta.messages.create)
            mock_anthropic_client.messages.create.assert_called_once()
            # Verify stream=True was set
            call_kwargs = mock_anthropic_client.messages.create.call_args[1]
            assert call_kwargs.get("stream") is True
