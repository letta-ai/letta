import logging
import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from letta_client import AsyncLetta
from letta_client.types import MessageCreateParam

from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.services.llm_router.llm_router_client import (
    AUTO_CHAT_MODE_FALLBACK,
    AUTO_CHAT_MODE_PRIMARY,
    AUTO_MODE_FALLBACK,
    AUTO_MODE_PRIMARY,
    FALLBACK_ROUTES,
)
from letta.services.provider_manager import AUTO_MODE_HANDLES

logger = logging.getLogger(__name__)


class TestAutoModeConstants:
    def test_handles_defined(self):
        assert "letta/auto" in AUTO_MODE_HANDLES
        assert "letta/auto-fast" in AUTO_MODE_HANDLES
        assert "letta/auto-chat" in AUTO_MODE_HANDLES
        assert isinstance(AUTO_MODE_HANDLES, list)

    def test_fallback_defined(self):
        assert AUTO_MODE_FALLBACK == "zai/glm-5"

    def test_auto_chat_constants_defined(self):
        assert AUTO_CHAT_MODE_PRIMARY == "minimax/MiniMax-M2.7"
        assert AUTO_CHAT_MODE_FALLBACK == "minimax/MiniMax-M2.5"


class TestAutoModeGetLLMConfig:
    """Test auto mode handling in provider_manager.get_llm_config_from_handle."""

    @pytest.mark.asyncio
    async def test_returns_config_when_enabled(self):
        from letta.services.provider_manager import ProviderManager
        from letta.settings import model_settings

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            pm = ProviderManager()
            actor = MagicMock()
            actor.organization_id = "org-test"

            config = await pm.get_llm_config_from_handle("letta/auto", actor)
            assert config.handle == "letta/auto"
            assert config.model == "auto"
            assert config.provider_name == "letta"
            assert config.context_window == 180000
            assert config.max_tokens == 8192
        finally:
            model_settings.auto_mode_enabled = original

    @pytest.mark.asyncio
    async def test_returns_config_for_auto_fast(self):
        from letta.services.provider_manager import ProviderManager
        from letta.settings import model_settings

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            pm = ProviderManager()
            actor = MagicMock()
            actor.organization_id = "org-test"

            config = await pm.get_llm_config_from_handle("letta/auto-fast", actor)
            assert config.handle == "letta/auto-fast"
            assert config.model == "auto-fast"
            assert config.provider_name == "letta"
            assert config.context_window == 180000
            assert config.max_tokens == 8192
        finally:
            model_settings.auto_mode_enabled = original

    @pytest.mark.asyncio
    async def test_returns_config_for_auto_chat(self):
        from letta.services.provider_manager import ProviderManager
        from letta.settings import model_settings

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            pm = ProviderManager()
            actor = MagicMock()
            actor.organization_id = "org-test"

            config = await pm.get_llm_config_from_handle("letta/auto-chat", actor)
            assert config.handle == "letta/auto-chat"
            assert config.model == "auto-chat"
            assert config.provider_name == "letta"
            assert config.context_window == 180000
            assert config.max_tokens == 8192
        finally:
            model_settings.auto_mode_enabled = original

    @pytest.mark.asyncio
    async def test_raises_when_disabled(self):
        from letta.orm.errors import NoResultFound
        from letta.services.provider_manager import ProviderManager

        pm = ProviderManager()
        actor = MagicMock()
        actor.organization_id = "org-test"

        with pytest.raises(NoResultFound):
            await pm.get_llm_config_from_handle("letta/auto", actor)


class TestAutoModeResolution:
    """Test resolve_auto_mode_config method on LLMRoutingClient."""

    def _make_config(self, handle="letta/auto"):
        return LLMConfig(
            model="auto",
            model_endpoint_type="openai",
            model_endpoint="",
            context_window=180000,
            handle=handle,
            max_tokens=8192,
            provider_name="letta",
            provider_category=ProviderCategory.base,
        )

    @pytest.mark.asyncio
    async def test_resolves_primary_when_healthy(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient
        from letta.settings import model_settings

        stored_config = self._make_config()
        actor = MagicMock()
        actor.organization_id = "org-test"

        primary_config = LLMConfig(
            model="glm-5",
            model_endpoint_type="openai",
            model_endpoint="http://proxy",
            context_window=128000,
            handle=AUTO_MODE_PRIMARY,
            max_tokens=4096,
        )

        mock_redis = AsyncMock()
        routing_client = LLMRoutingClient(mock_redis)

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            with (
                patch.object(routing_client, "_is_healthy", return_value=True),
                patch("letta.services.provider_manager.ProviderManager") as MockPM,
            ):
                mock_pm = AsyncMock()
                mock_pm.get_llm_config_from_handle = AsyncMock(return_value=primary_config)
                MockPM.return_value = mock_pm

                config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                    stored_llm_config=stored_config,
                    actor=actor,
                )

                assert is_primary is True
                assert config.context_window == 180000
                assert config.max_tokens == 8192
        finally:
            model_settings.auto_mode_enabled = original

    @pytest.mark.asyncio
    async def test_resolves_fallback_when_unhealthy(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient
        from letta.settings import model_settings

        stored_config = self._make_config()
        actor = MagicMock()
        actor.organization_id = "org-test"

        fallback_config = LLMConfig(
            model="glm-5",
            model_endpoint_type="zai",
            model_endpoint="https://api.zai.com",
            context_window=128000,
            handle=AUTO_MODE_FALLBACK,
            max_tokens=4096,
        )

        mock_redis = AsyncMock()
        routing_client = LLMRoutingClient(mock_redis)

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            with (
                patch.object(routing_client, "_is_healthy", return_value=False),
                patch("letta.services.provider_manager.ProviderManager") as MockPM,
            ):
                mock_pm = AsyncMock()
                mock_pm.get_llm_config_from_handle = AsyncMock(return_value=fallback_config)
                MockPM.return_value = mock_pm

                config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                    stored_llm_config=stored_config,
                    actor=actor,
                )

                assert is_primary is False
                assert config.context_window == 128000
                assert config.max_tokens == 4096
        finally:
            model_settings.auto_mode_enabled = original


class TestAutoChatModeResolution:
    """Test resolve_auto_mode_config for letta/auto-chat handle."""

    def _make_config(self):
        return LLMConfig(
            model="auto-chat",
            model_endpoint_type="openai",
            model_endpoint="",
            context_window=180000,
            handle="letta/auto-chat",
            max_tokens=8192,
            provider_name="letta",
            provider_category=ProviderCategory.base,
        )

    @pytest.mark.asyncio
    async def test_resolves_minimax_primary_when_healthy(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient
        from letta.settings import model_settings

        stored_config = self._make_config()
        actor = MagicMock()
        actor.organization_id = "org-test"

        primary_config = LLMConfig(
            model="MiniMax-M2.7",
            model_endpoint_type="minimax",
            model_endpoint="https://api.minimax.io/anthropic",
            context_window=180000,
            handle="minimax/MiniMax-M2.7",
            max_tokens=8192,
        )

        mock_redis = AsyncMock()
        routing_client = LLMRoutingClient(mock_redis)

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            with (
                patch.object(routing_client, "_is_healthy", return_value=True),
                patch("letta.services.provider_manager.ProviderManager") as MockPM,
            ):
                mock_pm = AsyncMock()
                mock_pm.get_llm_config_from_handle = AsyncMock(return_value=primary_config)
                MockPM.return_value = mock_pm

                config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                    stored_llm_config=stored_config,
                    actor=actor,
                )

                assert is_primary is True
                assert primary_handle == "minimax/MiniMax-M2.7"
                assert config.handle == "minimax/MiniMax-M2.7"
                assert config.model_endpoint_type == "minimax"
        finally:
            model_settings.auto_mode_enabled = original

    @pytest.mark.asyncio
    async def test_resolves_minimax_fallback_when_unhealthy(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient
        from letta.settings import model_settings

        stored_config = self._make_config()
        actor = MagicMock()
        actor.organization_id = "org-test"

        fallback_config = LLMConfig(
            model="MiniMax-M2.5",
            model_endpoint_type="minimax",
            model_endpoint="https://api.minimax.io/anthropic",
            context_window=180000,
            handle="minimax/MiniMax-M2.5",
            max_tokens=8192,
        )

        mock_redis = AsyncMock()
        routing_client = LLMRoutingClient(mock_redis)

        original = model_settings.auto_mode_enabled
        model_settings.auto_mode_enabled = True
        try:
            with (
                patch.object(routing_client, "_is_healthy", return_value=False),
                patch("letta.services.provider_manager.ProviderManager") as MockPM,
            ):
                mock_pm = AsyncMock()
                mock_pm.get_llm_config_from_handle = AsyncMock(return_value=fallback_config)
                MockPM.return_value = mock_pm

                config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                    stored_llm_config=stored_config,
                    actor=actor,
                )

                assert is_primary is False
                assert config.handle == "minimax/MiniMax-M2.5"
                assert config.model_endpoint_type == "minimax"
        finally:
            model_settings.auto_mode_enabled = original


class TestFallbackRoutes:
    """Test generic fallback routing."""

    def test_auto_mode_in_fallback_routes(self):
        assert AUTO_MODE_PRIMARY in FALLBACK_ROUTES
        assert FALLBACK_ROUTES[AUTO_MODE_PRIMARY] == AUTO_MODE_FALLBACK

    def test_auto_chat_mode_in_fallback_routes(self):
        assert AUTO_CHAT_MODE_PRIMARY in FALLBACK_ROUTES
        assert FALLBACK_ROUTES[AUTO_CHAT_MODE_PRIMARY] == AUTO_CHAT_MODE_FALLBACK

    def test_get_fallback_handle_exists(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient

        mock_redis = AsyncMock()
        client = LLMRoutingClient(mock_redis)
        assert client.get_fallback_handle(AUTO_MODE_PRIMARY) == AUTO_MODE_FALLBACK

    def test_get_fallback_handle_missing(self):
        from letta.services.llm_router.llm_router_client import LLMRoutingClient

        mock_redis = AsyncMock()
        client = LLMRoutingClient(mock_redis)
        assert client.get_fallback_handle("nonexistent/model") is None

    def test_base_client_returns_none(self):
        from letta.services.llm_router.llm_router_client_base import LLMRoutingClient as LLMRoutingClientBase

        client = LLMRoutingClientBase()
        assert client.get_fallback_handle(AUTO_MODE_PRIMARY) is None


class TestAutoModeStepFields:
    """Integration test: verify that auto mode steps have resolved model info
    but preserve model_handle as 'letta/auto'."""

    @pytest.mark.asyncio
    async def test_auto_mode_step_has_resolved_model_info(self, server_url: str):
        client = AsyncLetta(base_url=server_url)

        try:
            agent = await client.agents.create(
                agent_type="letta_v1_agent",
                name=f"test_auto_mode_{uuid.uuid4().hex[:8]}",
                include_base_tools=False,
                model="letta/auto",
                embedding=os.getenv("EMBEDDING_HANDLE", "openai/text-embedding-3-small"),
                tags=["test_auto_mode"],
            )
        except Exception as e:
            if "not found" in str(e).lower() or "auto" in str(e).lower():
                pytest.skip("Auto mode not enabled on this server")
            raise

        try:
            response = await client.agents.messages.send_message(
                agent_id=agent.id,
                messages=[
                    MessageCreateParam(
                        role="user",
                        content="Reply with exactly: hello",
                    )
                ],
            )

            steps = await client.runs.list_steps(run_id=response.id)
            assert len(steps) > 0, "Should have at least one step"

            step = steps[0]
            logger.info(
                f"Auto mode step: model={step.model}, model_endpoint={step.model_endpoint}, "
                f"model_handle={step.model_handle}, provider_name={step.provider_name}"
            )

            # model_handle should be preserved as letta/auto
            assert step.model_handle == "letta/auto", f"model_handle should be 'letta/auto', got '{step.model_handle}'"

            # Resolved fields should NOT be the placeholder values
            assert step.model and step.model != "auto", f"model should be resolved (not 'auto'), got '{step.model}'"
            assert step.model_endpoint and step.model_endpoint != "", (
                f"model_endpoint should be resolved (not empty), got '{step.model_endpoint}'"
            )
            assert step.provider_name and step.provider_name != "letta", (
                f"provider_name should be resolved (not 'letta'), got '{step.provider_name}'"
            )

        finally:
            await client.agents.delete(agent.id)
