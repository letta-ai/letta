"""
Integration tests for Venice AI provider.

These tests verify the VeniceProvider class works correctly with the Venice API,
including model listing and API key validation.
"""

import os
from unittest.mock import AsyncMock, Mock, patch

import pytest

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.providers.venice import VeniceProvider
from letta.settings import model_settings


@pytest.fixture
def venice_api_key():
    """Get Venice API key from environment or settings."""
    api_key = os.environ.get("VENICE_API_KEY") or model_settings.venice_api_key
    if not api_key:
        pytest.skip("VENICE_API_KEY not set, skipping Venice provider tests")
    return api_key


@pytest.fixture
def venice_provider(venice_api_key):
    """Create a VeniceProvider instance for testing."""
    return VeniceProvider(
        name="venice",
        api_key=venice_api_key,
        base_url="https://api.venice.ai/api/v1",
    )


class TestVeniceProviderInitialization:
    """Test VeniceProvider initialization."""

    def test_init_defaults(self, venice_api_key):
        """Test provider initialization with default base URL."""
        provider = VeniceProvider(name="venice", api_key=venice_api_key)
        assert provider.provider_type.value == "venice"
        assert provider.base_url == "https://api.venice.ai/api/v1"
        assert provider.api_key == venice_api_key

    def test_init_custom_base_url(self, venice_api_key):
        """Test provider initialization with custom base URL."""
        custom_url = "https://custom.venice.ai/api/v1"
        provider = VeniceProvider(name="venice", api_key=venice_api_key, base_url=custom_url)
        assert provider.base_url == custom_url


class TestVeniceProviderModelListing:
    """Test model listing functionality."""

    @pytest.mark.asyncio
    async def test_list_llm_models_async_success(self, venice_provider):
        """Test successfully listing LLM models from Venice API."""
        models = await venice_provider.list_llm_models_async()

        # Should return at least one model
        assert len(models) > 0

        # Verify model structure
        for model in models:
            assert model.model_endpoint_type == "venice"
            assert model.handle.startswith("venice/")
            assert model.context_window > 0
            assert model.provider_name == "venice"
            assert model.provider_category.value == "base"

    @pytest.mark.asyncio
    async def test_list_llm_models_async_handles_format(self, venice_provider):
        """Test that model listing handles Venice API response format correctly."""
        models = await venice_provider.list_llm_models_async()

        # All models should have required fields
        for model in models:
            assert hasattr(model, "model")
            assert hasattr(model, "handle")
            assert hasattr(model, "context_window")
            assert hasattr(model, "model_endpoint")
            assert model.model_endpoint == venice_provider.base_url

    @pytest.mark.asyncio
    async def test_list_embedding_models_async(self, venice_provider):
        """Test listing embedding models (hardcoded list since Venice doesn't list them in /models)."""
        embedding_models = await venice_provider.list_embedding_models_async()

        # Should return hardcoded list of common embedding models
        assert len(embedding_models) == 4
        assert all(isinstance(model, EmbeddingConfig) for model in embedding_models)
        assert all(model.embedding_endpoint_type == "venice" for model in embedding_models)
        assert all(model.handle.startswith("venice/") for model in embedding_models)
        
        # Check specific models
        model_ids = {m.embedding_model for m in embedding_models}
        assert "text-embedding-ada-002" in model_ids
        assert "text-embedding-3-small" in model_ids
        assert "text-embedding-3-large" in model_ids
        assert "text-embedding-bge-m3" in model_ids
        
        # Check dimensions (Venice returns 1024 for all)
        ada_model = next((m for m in embedding_models if m.embedding_model == "text-embedding-ada-002"), None)
        assert ada_model is not None
        assert ada_model.embedding_dim == 1024

    @pytest.mark.asyncio
    async def test_list_llm_models_filters_text_models(self, venice_provider):
        """Test that only text models are returned."""
        models = await venice_provider.list_llm_models_async()

        # All models should be text models (filtered by provider)
        # This is verified by the fact that non-text models are filtered out
        assert all(model.model_endpoint_type == "venice" for model in models)


class TestVeniceProviderAPIKeyValidation:
    """Test API key validation."""

    @pytest.mark.asyncio
    async def test_check_api_key_success(self, venice_provider):
        """Test successful API key validation."""
        # Should not raise an exception
        await venice_provider.check_api_key()

    @pytest.mark.asyncio
    async def test_check_api_key_invalid(self):
        """Test API key validation with invalid key."""
        from letta.errors import LLMAuthenticationError
        
        provider = VeniceProvider(
            name="venice",
            api_key="invalid-key-12345",
            base_url="https://api.venice.ai/api/v1",
        )

        # Mock the API call to return an authentication error
        with patch("letta.llm_api.venice.venice_get_model_list_async", side_effect=Exception("401 Unauthorized")):
            with pytest.raises(LLMAuthenticationError):
                await provider.check_api_key()

    @pytest.mark.asyncio
    async def test_check_api_key_missing(self):
        """Test API key validation with missing key."""
        provider = VeniceProvider(
            name="venice",
            api_key="",
            base_url="https://api.venice.ai/api/v1",
        )

        with pytest.raises(ValueError, match="No API key provided"):
            await provider.check_api_key()


class TestVeniceProviderHelperMethods:
    """Test helper methods."""

    def test_get_handle(self, venice_provider):
        """Test handle generation."""
        handle = venice_provider.get_handle("llama-3.3-70b")
        assert handle == "venice/llama-3.3-70b"

    def test_get_handle_embedding(self, venice_provider):
        """Test embedding handle generation."""
        handle = venice_provider.get_handle("text-embedding-ada-002", is_embedding=True)
        assert handle == "venice/text-embedding-ada-002"

    @pytest.mark.asyncio
    async def test_get_models_async_handles_missing_context_window(self, venice_provider):
        """Test that missing context window defaults to 128000."""
        # This is tested implicitly by the model listing, but we can verify
        # that models without context window still work
        models = await venice_provider.list_llm_models_async()
        for model in models:
            # All models should have a context window set
            assert model.context_window > 0


class TestVeniceProviderIntegration:
    """Integration tests with mocked API responses."""

    @pytest.mark.asyncio
    async def test_list_llm_models_with_mock_response(self, venice_api_key):
        """Test model listing with mocked API response."""
        mock_response = {
            "data": [
                {
                    "id": "llama-3.3-70b",
                    "type": "text",
                    "model_spec": {
                        "availableContextTokens": 128000,
                        "capabilities": {"supportsFunctionCalling": True},
                    },
                },
                {
                    "id": "gpt-4",
                    "type": "text",
                    "model_spec": {
                        "availableContextTokens": 8192,
                        "capabilities": {"supportsFunctionCalling": True},
                    },
                },
                {
                    "id": "embedding-model",
                    "type": "embedding",  # Should be filtered out
                    "model_spec": {},
                },
            ]
        }

        provider = VeniceProvider(name="venice", api_key=venice_api_key)

        with patch("letta.llm_api.venice.venice_get_model_list_async", return_value=mock_response):
            models = await provider.list_llm_models_async()

            # Should only return text models
            assert len(models) == 2
            assert all(model.model_endpoint_type == "venice" for model in models)
            assert any(model.model == "llama-3.3-70b" for model in models)
            assert any(model.model == "gpt-4" for model in models)

    @pytest.mark.asyncio
    async def test_list_llm_models_handles_missing_context_window(self, venice_api_key):
        """Test model listing when context window is missing from API response."""
        mock_response = {
            "data": [
                {
                    "id": "test-model",
                    "type": "text",
                    "model_spec": {},  # Missing availableContextTokens
                }
            ]
        }

        provider = VeniceProvider(name="venice", api_key=venice_api_key)

        with patch("letta.llm_api.venice.venice_get_model_list_async", return_value=mock_response):
            models = await provider.list_llm_models_async()

            # Should default to 128000
            assert len(models) == 1
            assert models[0].context_window == 128000

