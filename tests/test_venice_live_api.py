"""
Live API integration tests for Venice AI provider.

These tests make actual API calls to Venice using the real API key.
They test the core functionality without requiring database setup.

To run these tests:
    VENICE_API_KEY=your_key pytest tests/test_venice_live_api.py -v
"""

import os
from typing import Optional

import pytest

from letta.llm_api.venice import venice_get_model_list_async
from letta.llm_api.venice_client import VeniceClient
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.venice import VeniceProvider


@pytest.fixture
def venice_api_key() -> Optional[str]:
    """Get Venice API key from environment."""
    api_key = os.environ.get("VENICE_API_KEY")
    if not api_key:
        pytest.skip("VENICE_API_KEY not set, skipping live API tests")
    return api_key


@pytest.fixture
def venice_provider(venice_api_key: str) -> VeniceProvider:
    """Create a VeniceProvider instance with real API key."""
    return VeniceProvider(
        name="venice",
        api_key=venice_api_key,
        base_url="https://api.venice.ai/api/v1",
    )


@pytest.fixture
def venice_client() -> VeniceClient:
    """Create a VeniceClient instance."""
    return VeniceClient()


class TestVeniceLiveAPI:
    """Live API tests that make real calls to Venice API."""

    @pytest.mark.asyncio
    async def test_list_models_live(self, venice_api_key: str):
        """Test listing models from Venice API with real API key."""
        models = await venice_get_model_list_async(
            url="https://api.venice.ai/api/v1",
            api_key=venice_api_key,
        )
        
        assert "data" in models
        assert isinstance(models["data"], list)
        assert len(models["data"]) > 0
        
        # Verify model structure
        for model in models["data"]:
            assert "id" in model
            assert "type" in model

    @pytest.mark.asyncio
    async def test_provider_list_models_live(self, venice_provider: VeniceProvider):
        """Test VeniceProvider listing models with real API key."""
        models = await venice_provider.list_llm_models_async()
        
        assert len(models) > 0
        
        # Verify model structure
        for model in models:
            assert model.model_endpoint_type == "venice"
            assert model.handle.startswith("venice/")
            assert model.context_window > 0
            assert model.provider_name == "venice"
            assert model.provider_category == ProviderCategory.base

    @pytest.mark.asyncio
    async def test_provider_check_api_key_live(self, venice_provider: VeniceProvider):
        """Test VeniceProvider API key validation with real API key."""
        # Should not raise an exception
        await venice_provider.check_api_key()

    @pytest.mark.asyncio
    async def test_client_chat_completion_live(
        self, venice_client: VeniceClient, venice_api_key: str
    ):
        """Test VeniceClient chat completion with real API key."""
        # Get first available model
        models = await venice_get_model_list_async(
            url="https://api.venice.ai/api/v1",
            api_key=venice_api_key,
        )
        
        if not models["data"]:
            pytest.skip("No Venice models available")
        
        # Find a text model
        text_model = None
        for model in models["data"]:
            if model.get("type") == "text":
                text_model = model["id"]
                break
        
        if not text_model:
            pytest.skip("No text models available")
        
        # Create LLM config
        llm_config = LLMConfig(
            model=text_model,
            model_endpoint_type="venice",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=128000,
            handle=f"venice/{text_model}",
            provider_name="venice",
            provider_category=ProviderCategory.base,
        )
        
        # Build request data
        from letta.schemas.enums import MessageRole
        from letta.schemas.message import Message as PydanticMessage
        from datetime import datetime, timezone
        from letta.schemas.letta_message_content import TextContent
        
        messages = [
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text="Say 'Hello, Venice!' and nothing else.")],
                created_at=datetime.now(timezone.utc),
            )
        ]
        
        request_data = venice_client.build_request_data(
            agent_type=None,
            messages=messages,
            llm_config=llm_config,
            tools=None,
        )
        
        # Make actual API call
        response = await venice_client.request_async(request_data, llm_config)
        
        # Verify response structure
        assert "id" in response
        assert "choices" in response
        assert len(response["choices"]) > 0
        assert "message" in response["choices"][0]
        assert "content" in response["choices"][0]["message"]
        
        # Verify content contains expected response
        content = response["choices"][0]["message"]["content"]
        assert content is not None
        assert len(content) > 0

    @pytest.mark.asyncio
    async def test_client_embeddings_live(
        self, venice_client: VeniceClient, venice_api_key: str
    ):
        """Test VeniceClient embeddings with real API key."""
        from letta.schemas.embedding_config import EmbeddingConfig
        
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",  # Standard embedding model
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
        )
        
        texts = ["Hello, Venice!", "This is a test."]
        
        # Make actual API call
        embeddings = await venice_client.request_embeddings(texts, embedding_config)
        
        # Verify response structure
        assert len(embeddings) == 2
        assert len(embeddings[0]) > 0
        assert len(embeddings[1]) > 0
        assert all(isinstance(x, float) for x in embeddings[0])
        assert all(isinstance(x, float) for x in embeddings[1])

    @pytest.mark.asyncio
    async def test_client_streaming_live(
        self, venice_client: VeniceClient, venice_api_key: str
    ):
        """Test VeniceClient streaming with real API key."""
        # Get first available text model
        models = await venice_get_model_list_async(
            url="https://api.venice.ai/api/v1",
            api_key=venice_api_key,
        )
        
        if not models["data"]:
            pytest.skip("No Venice models available")
        
        text_model = None
        for model in models["data"]:
            if model.get("type") == "text":
                text_model = model["id"]
                break
        
        if not text_model:
            pytest.skip("No text models available")
        
        # Create LLM config
        llm_config = LLMConfig(
            model=text_model,
            model_endpoint_type="venice",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=128000,
            handle=f"venice/{text_model}",
            provider_name="venice",
            provider_category=ProviderCategory.base,
        )
        
        # Build request data with streaming
        from letta.schemas.enums import MessageRole
        from letta.schemas.message import Message as PydanticMessage
        from datetime import datetime, timezone
        from letta.schemas.letta_message_content import TextContent
        
        messages = [
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text="Count from 1 to 5, one number per line.")],
                created_at=datetime.now(timezone.utc),
            )
        ]
        
        request_data = venice_client.build_request_data(
            agent_type=None,
            messages=messages,
            llm_config=llm_config,
            tools=None,
        )
        request_data["stream"] = True
        
        # Make actual streaming API call
        stream = await venice_client.stream_async(request_data, llm_config)
        
        chunks = []
        async with stream:
            async for chunk in stream:
                chunks.append(chunk)
                if len(chunks) >= 5:  # Limit to 5 chunks for testing
                    break
        
        # Verify we got streaming chunks
        assert len(chunks) > 0
        for chunk in chunks:
            assert hasattr(chunk, "id") or "id" in chunk
            assert hasattr(chunk, "choices") or "choices" in chunk

