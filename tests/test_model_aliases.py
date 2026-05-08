from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.google_vertex import GoogleVertexProvider
from letta.schemas.user import User as PydanticUser
from letta.services.provider_manager import ProviderManager


def test_llm_config_redirects_deprecated_google_model():
    config = LLMConfig(
        model="gemini-3-pro-preview",
        model_endpoint_type="google_ai",
        handle="google_ai/gemini-3-pro-preview",
        context_window=1048576,
    )

    assert config.model == "gemini-3.1-pro-preview"
    assert config.handle == "google_ai/gemini-3.1-pro-preview"


@pytest.mark.asyncio
async def test_provider_manager_redirects_deprecated_google_handle(monkeypatch):
    provider_manager = ProviderManager()
    actor = PydanticUser(
        id="user-00000000-0000-0000-0000-000000000000",
        organization_id="org-00000000-0000-0000-0000-000000000000",
        name="Test User",
    )
    lookup_calls: list[str] = []

    async def mock_get_model_by_handle_async(handle: str, actor, model_type: str):
        lookup_calls.append(handle)
        if handle == "google_ai/gemini-3.1-pro-preview":
            return SimpleNamespace(
                provider_id="provider-00000000-0000-0000-0000-000000000000",
                name="gemini-3.1-pro-preview",
                model_endpoint_type="google_ai",
                max_context_window=1048576,
                handle="google_ai/gemini-3.1-pro-preview",
            )
        return None

    typed_provider = SimpleNamespace(
        base_url="https://generativelanguage.googleapis.com",
        get_default_max_output_tokens=lambda _model: 65536,
    )
    provider = SimpleNamespace(
        name="google_ai",
        provider_type=ProviderType.google_ai,
        provider_category=ProviderCategory.base,
        cast_to_subtype=lambda: typed_provider,
    )

    monkeypatch.setattr(provider_manager, "get_model_by_handle_async", mock_get_model_by_handle_async)
    monkeypatch.setattr(provider_manager, "get_provider_async", AsyncMock(return_value=provider))
    monkeypatch.setattr(provider_manager, "list_providers_async", AsyncMock(return_value=[]))

    llm_config = await provider_manager.get_llm_config_from_handle(
        handle="google_ai/gemini-3-pro-preview",
        actor=actor,
    )

    assert lookup_calls == ["google_ai/gemini-3-pro-preview", "google_ai/gemini-3.1-pro-preview"]
    assert llm_config.model == "gemini-3.1-pro-preview"
    assert llm_config.handle == "google_ai/gemini-3.1-pro-preview"


@pytest.mark.asyncio
async def test_google_vertex_provider_does_not_surface_deprecated_gemini_3_pro_preview():
    provider = GoogleVertexProvider(
        name="google_vertex",
        google_cloud_project="test-project",
        google_cloud_location="us-central1",
    )

    models = await provider.list_llm_models_async()

    assert {model.model for model in models}.isdisjoint({"gemini-3-pro-preview"})
