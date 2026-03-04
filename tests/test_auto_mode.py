from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.services.llm_router import AUTO_MODE_FALLBACK, AUTO_MODE_PRIMARY
from letta.services.provider_manager import AUTO_MODE_HANDLES


class TestAutoModeConstants:
    def test_handles_defined(self):
        assert "letta/auto" in AUTO_MODE_HANDLES
        assert "letta/auto-fast" in AUTO_MODE_HANDLES
        assert isinstance(AUTO_MODE_HANDLES, list)

    def test_fallback_defined(self):
        assert AUTO_MODE_FALLBACK == "zai/glm-5"


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
        from letta.services.llm_router.client import LLMRoutingClient

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

        with (
            patch.object(routing_client, "_is_healthy", return_value=True),
            patch("letta.services.provider_manager.ProviderManager") as MockPM,
        ):
            mock_pm = AsyncMock()
            mock_pm.get_llm_config_from_handle = AsyncMock(return_value=primary_config)
            MockPM.return_value = mock_pm

            config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                auto_mode_enabled=True,
                stored_llm_config=stored_config,
                actor=actor,
            )

            assert is_primary is True
            assert config.context_window == 180000
            assert config.max_tokens == 8192

    @pytest.mark.asyncio
    async def test_resolves_fallback_when_unhealthy(self):
        from letta.services.llm_router.client import LLMRoutingClient

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

        with (
            patch.object(routing_client, "_is_healthy", return_value=False),
            patch("letta.services.provider_manager.ProviderManager") as MockPM,
        ):
            mock_pm = AsyncMock()
            mock_pm.get_llm_config_from_handle = AsyncMock(return_value=fallback_config)
            MockPM.return_value = mock_pm

            config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                auto_mode_enabled=True,
                stored_llm_config=stored_config,
                actor=actor,
            )

            assert is_primary is False
            assert config.context_window == 180000
            assert config.max_tokens == 8192

    @pytest.mark.asyncio
    async def test_skips_primary_when_auto_mode_disabled(self):
        from letta.services.llm_router.client import LLMRoutingClient

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

        with (
            patch.object(routing_client, "_is_healthy") as mock_is_healthy,
            patch("letta.services.provider_manager.ProviderManager") as MockPM,
        ):
            mock_pm = AsyncMock()
            mock_pm.get_llm_config_from_handle = AsyncMock(return_value=fallback_config)
            MockPM.return_value = mock_pm

            config, is_primary, primary_handle = await routing_client.resolve_auto_mode_config(
                auto_mode_enabled=False,
                stored_llm_config=stored_config,
                actor=actor,
            )

            assert is_primary is False
            mock_is_healthy.assert_not_called()
            assert config.context_window == 180000


class TestExperimentalParamsAutoMode:
    """Test that auto_mode header is parsed correctly."""

    def test_auto_mode_true(self):
        from letta.server.rest_api.dependencies import ExperimentalParams

        params = ExperimentalParams(auto_mode=True)
        assert params.auto_mode is True

    def test_auto_mode_false(self):
        from letta.server.rest_api.dependencies import ExperimentalParams

        params = ExperimentalParams(auto_mode=False)
        assert params.auto_mode is False

    def test_auto_mode_none_default(self):
        from letta.server.rest_api.dependencies import ExperimentalParams

        params = ExperimentalParams()
        assert params.auto_mode is None
