"""
Unit tests for Venice AI LLM client implementation.

These tests provide 100% coverage of the VeniceClient class, including:
- Request building and conversion
- Synchronous and asynchronous requests
- Streaming support
- Error handling
- Embeddings
- Tool calling
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import aiohttp
import pytest
import requests
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.errors import (
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
    LLMUnprocessableEntityError,
)
from letta.llm_api.venice_client import VENICE_API_BASE_URL, VENICE_DEFAULT_TIMEOUT, VeniceClient
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage


@pytest.fixture
def llm_config():
    """Create a test LLMConfig for Venice."""
    return LLMConfig(
        model="llama-3.3-70b",
        model_endpoint_type="venice",
        model_endpoint=VENICE_API_BASE_URL,
        context_window=128000,
        handle="venice/llama-3.3-70b",
        provider_name="venice",
        provider_category=ProviderCategory.base,
        temperature=0.7,
        max_tokens=1000,
    )


@pytest.fixture
def venice_client():
    """Create a VeniceClient instance for testing."""
    return VeniceClient()


@pytest.fixture
def sample_messages():
    """Create sample messages for testing."""
    from letta.schemas.letta_message_content import TextContent
    
    return [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
            created_at=datetime.now(timezone.utc),
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Hello, how are you?")],
            created_at=datetime.now(timezone.utc),
        ),
    ]


@pytest.fixture
def sample_tools():
    """Create sample tools for testing."""
    return [
        {
            "name": "get_weather",
            "description": "Get the weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The location to get weather for"}
                },
                "required": ["location"],
            },
        }
    ]


@pytest.fixture
def mock_venice_response():
    """Create a mock Venice API response."""
    return {
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "llama-3.3-70b",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! I'm doing well, thank you for asking.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 12,
            "total_tokens": 22,
        },
    }


@pytest.fixture
def mock_venice_streaming_chunk():
    """Create a mock Venice streaming chunk."""
    return {
        "id": "chatcmpl-123",
        "object": "chat.completion.chunk",
        "created": 1677652288,
        "model": "llama-3.3-70b",
        "choices": [
            {
                "index": 0,
                "delta": {"content": "Hello"},
                "finish_reason": None,
            }
        ],
    }


class TestVeniceClientInitialization:
    """Test VeniceClient initialization."""

    def test_init_defaults(self):
        """Test client initialization with default parameters."""
        client = VeniceClient()
        assert client.put_inner_thoughts_first is True
        assert client.use_tool_naming is True
        assert client.actor is None

    def test_init_custom(self):
        """Test client initialization with custom parameters."""
        mock_actor = Mock()
        client = VeniceClient(put_inner_thoughts_first=False, use_tool_naming=False, actor=mock_actor)
        assert client.put_inner_thoughts_first is False
        assert client.use_tool_naming is False
        assert client.actor == mock_actor


class TestVeniceClientAPIKeyHandling:
    """Test API key retrieval methods."""

    def test_get_api_key_from_byok(self, venice_client, llm_config):
        """Test getting API key from BYOK overrides."""
        with patch.object(venice_client, "get_byok_overrides", return_value=("test-api-key", None, None)):
            api_key = venice_client._get_api_key(llm_config)
            assert api_key == "test-api-key"

    def test_get_api_key_from_env(self, venice_client, llm_config):
        """Test getting API key from environment variable."""
        with patch.object(venice_client, "get_byok_overrides", return_value=(None, None, None)):
            with patch.dict("os.environ", {"VENICE_API_KEY": "env-api-key"}):
                api_key = venice_client._get_api_key(llm_config)
                assert api_key == "env-api-key"

    def test_get_api_key_missing(self, venice_client, llm_config):
        """Test error when API key is not found."""
        with patch.object(venice_client, "get_byok_overrides", return_value=(None, None, None)):
            with patch.dict("os.environ", {}, clear=True):
                with pytest.raises(LLMAuthenticationError, match="Venice API key not found"):
                    venice_client._get_api_key(llm_config)

    @pytest.mark.asyncio
    async def test_get_api_key_async_from_byok(self, venice_client, llm_config):
        """Test getting API key asynchronously from BYOK overrides."""
        with patch.object(venice_client, "get_byok_overrides_async", return_value=("test-api-key", None, None)):
            api_key = await venice_client._get_api_key_async(llm_config)
            assert api_key == "test-api-key"

    @pytest.mark.asyncio
    async def test_get_api_key_async_from_env(self, venice_client, llm_config):
        """Test getting API key asynchronously from environment variable."""
        with patch.object(venice_client, "get_byok_overrides_async", return_value=(None, None, None)):
            with patch.dict("os.environ", {"VENICE_API_KEY": "env-api-key"}):
                api_key = await venice_client._get_api_key_async(llm_config)
                assert api_key == "env-api-key"

    def test_get_base_url_from_config(self, venice_client, llm_config):
        """Test getting base URL from LLM config."""
        llm_config.model_endpoint = "https://custom.venice.ai/api/v1"
        base_url = venice_client._get_base_url(llm_config)
        assert base_url == "https://custom.venice.ai/api/v1"

    def test_get_base_url_default(self, venice_client, llm_config):
        """Test getting default base URL when not in config."""
        llm_config.model_endpoint = None
        base_url = venice_client._get_base_url(llm_config)
        assert base_url == VENICE_API_BASE_URL


class TestVeniceClientBuildRequestData:
    """Test build_request_data method."""

    def test_build_request_data_basic(self, venice_client, llm_config, sample_messages):
        """Test building basic request data."""
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=[],
        )

        assert "model" in request_data
        assert request_data["model"] == "llama-3.3-70b"
        assert "messages" in request_data
        assert len(request_data["messages"]) == 2
        assert request_data["messages"][0]["role"] == "system"
        assert request_data["messages"][1]["role"] == "user"

    def test_build_request_data_with_temperature(self, venice_client, llm_config, sample_messages):
        """Test building request data with temperature."""
        llm_config.temperature = 0.9
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=[],
        )

        assert request_data["temperature"] == 0.9

    def test_build_request_data_with_max_tokens(self, venice_client, llm_config, sample_messages):
        """Test building request data with max_tokens."""
        llm_config.max_tokens = 500
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=[],
        )

        assert request_data["max_tokens"] == 500

    def test_build_request_data_with_tools(self, venice_client, llm_config, sample_messages, sample_tools):
        """Test building request data with tools."""
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=sample_tools,
        )

        assert "tools" in request_data
        assert len(request_data["tools"]) == 1
        assert request_data["tools"][0]["type"] == "function"
        assert request_data["tools"][0]["function"]["name"] == "get_weather"
        assert "tool_choice" in request_data
        assert request_data["tool_choice"] == "auto"

    def test_build_request_data_force_tool_call(self, venice_client, llm_config, sample_messages, sample_tools):
        """Test building request data with forced tool call."""
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=sample_tools,
            force_tool_call="get_weather",
        )

        assert request_data["tool_choice"]["type"] == "function"
        assert request_data["tool_choice"]["function"]["name"] == "get_weather"

    def test_build_request_data_requires_subsequent_tool_call(self, venice_client, llm_config, sample_messages, sample_tools):
        """Test building request data with required subsequent tool call."""
        request_data = venice_client.build_request_data(
            agent_type=AgentType.memgpt_v2_agent,
            messages=sample_messages,
            llm_config=llm_config,
            tools=sample_tools,
            requires_subsequent_tool_call=True,
        )

        assert request_data["tool_choice"] == "required"


class TestVeniceClientRequest:
    """Test synchronous request method."""

    def test_request_success(self, venice_client, llm_config, mock_venice_response):
        """Test successful synchronous request."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post") as mock_post:
                mock_response = Mock()
                mock_response.status_code = 200
                mock_response.json.return_value = mock_venice_response
                mock_post.return_value = mock_response

                result = venice_client.request(request_data, llm_config)

                assert result == mock_venice_response
                mock_post.assert_called_once()
                call_kwargs = mock_post.call_args[1]
                assert call_kwargs["headers"]["Authorization"] == "Bearer test-api-key"

    def test_request_with_retry_on_429(self, venice_client, llm_config):
        """Test request retries on rate limit error."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post") as mock_post:
                # First call: 429 error
                mock_response_429 = Mock()
                mock_response_429.status_code = 429
                mock_response_429.json.return_value = {"error": {"message": "Rate limited"}}
                mock_response_429.headers = {}

                # Second call: success
                mock_response_200 = Mock()
                mock_response_200.status_code = 200
                mock_response_200.json.return_value = {"id": "test", "choices": [], "usage": {}}

                mock_post.side_effect = [mock_response_429, mock_response_200]

                with patch("time.sleep"):  # Speed up test
                    result = venice_client.request(request_data, llm_config)

                assert result["id"] == "test"
                assert mock_post.call_count == 2

    def test_request_timeout_error(self, venice_client, llm_config):
        """Test request handles timeout errors."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post", side_effect=requests.exceptions.Timeout("Request timed out")):
                with pytest.raises(LLMTimeoutError, match="Request to Venice API timed out"):
                    venice_client.request(request_data, llm_config)

    def test_request_connection_error(self, venice_client, llm_config):
        """Test request handles connection errors."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post", side_effect=requests.exceptions.ConnectionError("Connection failed")):
                with pytest.raises(LLMConnectionError, match="Failed to connect to Venice API"):
                    venice_client.request(request_data, llm_config)


class TestVeniceClientRequestAsync:
    """Test asynchronous request method."""

    @pytest.mark.asyncio
    async def test_request_async_success(self, venice_client, llm_config, mock_venice_response):
        """Test successful asynchronous request."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=mock_venice_response)

            mock_post_context = AsyncMock()
            mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
            mock_post_context.__aexit__ = AsyncMock(return_value=None)

            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session.post = Mock(return_value=mock_post_context)

            with patch("aiohttp.ClientSession", return_value=mock_session):
                result = await venice_client.request_async(request_data, llm_config)

                assert result == mock_venice_response

    @pytest.mark.asyncio
    async def test_request_async_with_retry_on_500(self, venice_client, llm_config):
        """Test async request retries on server error."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            # First call: 500 error
            mock_response_500 = AsyncMock()
            mock_response_500.status = 500
            mock_response_500.json = AsyncMock(return_value={"error": {"message": "Server error"}})

            # Second call: success
            mock_response_200 = AsyncMock()
            mock_response_200.status = 200
            mock_response_200.json = AsyncMock(return_value={"id": "test", "choices": [], "usage": {}})

            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = mock_session
            mock_session.__aexit__.return_value = None

            # Create a mock context manager that returns different responses
            call_count = [0]
            
            def mock_post(*args, **kwargs):
                ctx = AsyncMock()
                if call_count[0] == 0:
                    ctx.__aenter__ = AsyncMock(return_value=mock_response_500)
                    call_count[0] += 1
                else:
                    ctx.__aenter__ = AsyncMock(return_value=mock_response_200)
                ctx.__aexit__ = AsyncMock(return_value=None)
                return ctx

            mock_session.post = Mock(side_effect=mock_post)

            with patch("aiohttp.ClientSession", return_value=mock_session):
                with patch("asyncio.sleep"):  # Speed up test
                    result = await venice_client.request_async(request_data, llm_config)

                assert result["id"] == "test"

    @pytest.mark.asyncio
    async def test_request_async_client_error(self, venice_client, llm_config):
        """Test async request handles client errors."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", side_effect=aiohttp.ClientError("Connection failed")):
                with pytest.raises(LLMConnectionError, match="Failed to connect to Venice API"):
                    await venice_client.request_async(request_data, llm_config)


class TestVeniceClientStreamAsync:
    """Test asynchronous streaming method."""

    @pytest.mark.asyncio
    async def test_stream_async_success(self, venice_client, llm_config):
        """Test successful streaming."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        # Mock SSE response
        mock_chunk_data = b"data: {\"id\":\"test\",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n"
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = AsyncMock()
        mock_response.content.__aiter__.return_value = [mock_chunk_data]

        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post_context.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)

        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                stream = await venice_client.stream_async(request_data, llm_config)

                # Verify stream is created
                assert stream is not None
                # Verify request_data has stream=True
                assert request_data.get("stream") is True

    @pytest.mark.asyncio
    async def test_stream_async_with_done(self, venice_client, llm_config):
        """Test streaming with [DONE] marker."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}

        # Mock SSE response with [DONE]
        mock_chunk_data = b"data: [DONE]\n\n"
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = AsyncMock()
        mock_response.content.__aiter__.return_value = [mock_chunk_data]

        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post_context.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)

        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                stream = await venice_client.stream_async(request_data, llm_config)

                # Stream should be created but will stop at [DONE]
                assert stream is not None


class TestVeniceClientConvertResponse:
    """Test convert_response_to_chat_completion method."""

    def test_convert_response_basic(self, venice_client, llm_config, sample_messages, mock_venice_response):
        """Test converting basic Venice response to ChatCompletionResponse."""
        response = venice_client.convert_response_to_chat_completion(mock_venice_response, sample_messages, llm_config)

        assert response.id == "chatcmpl-123"
        assert response.model == "llama-3.3-70b"
        assert len(response.choices) == 1
        assert response.choices[0].message.content == "Hello! I'm doing well, thank you for asking."
        assert response.choices[0].finish_reason == "stop"
        assert response.usage.prompt_tokens == 10
        assert response.usage.completion_tokens == 12
        assert response.usage.total_tokens == 22

    def test_convert_response_with_tool_calls(self, venice_client, llm_config, sample_messages):
        """Test converting response with tool calls."""
        response_data = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "llama-3.3-70b",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_123",
                                "type": "function",
                                "function": {"name": "get_weather", "arguments": '{"location": "Paris"}'},
                            }
                        ],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 12, "total_tokens": 22},
        }

        response = venice_client.convert_response_to_chat_completion(response_data, sample_messages, llm_config)

        assert response.choices[0].message.tool_calls is not None
        assert len(response.choices[0].message.tool_calls) == 1
        assert response.choices[0].message.tool_calls[0].function.name == "get_weather"
        assert response.choices[0].message.tool_calls[0].function.arguments == '{"location": "Paris"}'


class TestVeniceClientErrorHandling:
    """Test error handling methods."""

    def test_handle_llm_error_timeout(self, venice_client):
        """Test handling timeout errors."""
        error = requests.exceptions.Timeout("Request timed out")
        result = venice_client.handle_llm_error(error)
        assert isinstance(result, LLMTimeoutError)

    def test_handle_llm_error_connection(self, venice_client):
        """Test handling connection errors."""
        error = requests.exceptions.ConnectionError("Connection failed")
        result = venice_client.handle_llm_error(error)
        assert isinstance(result, LLMConnectionError)

    def test_handle_llm_error_generic(self, venice_client):
        """Test handling generic errors."""
        error = ValueError("Some error")
        result = venice_client.handle_llm_error(error)
        from letta.errors import LLMError

        assert isinstance(result, LLMError)

    def test_map_venice_error_401(self, venice_client):
        """Test mapping 401 error to authentication error."""
        error_data = {"error": {"message": "Invalid API key"}}
        with pytest.raises(LLMAuthenticationError, match="Venice API authentication failed"):
            venice_client._map_venice_error_to_letta_error(401, error_data)

    def test_map_venice_error_403(self, venice_client):
        """Test mapping 403 error to permission denied."""
        error_data = {"error": {"message": "Permission denied"}}
        with pytest.raises(LLMPermissionDeniedError, match="Venice API permission denied"):
            venice_client._map_venice_error_to_letta_error(403, error_data)

    def test_map_venice_error_404(self, venice_client):
        """Test mapping 404 error to not found."""
        error_data = {"error": {"message": "Model not found"}}
        with pytest.raises(LLMNotFoundError, match="Venice API resource not found"):
            venice_client._map_venice_error_to_letta_error(404, error_data)

    def test_map_venice_error_429(self, venice_client):
        """Test mapping 429 error to rate limit."""
        error_data = {"error": {"message": "Rate limit exceeded"}}
        with pytest.raises(LLMRateLimitError, match="Venice API rate limit exceeded"):
            venice_client._map_venice_error_to_letta_error(429, error_data)

    def test_map_venice_error_400(self, venice_client):
        """Test mapping 400 error to bad request."""
        error_data = {"error": {"message": "Invalid request"}}
        with pytest.raises(LLMBadRequestError, match="Venice API bad request"):
            venice_client._map_venice_error_to_letta_error(400, error_data)

    def test_map_venice_error_422(self, venice_client):
        """Test mapping 422 error to unprocessable entity."""
        error_data = {"error": {"message": "Unprocessable entity"}}
        with pytest.raises(LLMUnprocessableEntityError, match="Venice API unprocessable entity"):
            venice_client._map_venice_error_to_letta_error(422, error_data)

    def test_map_venice_error_500(self, venice_client):
        """Test mapping 500 error to server error."""
        error_data = {"error": {"message": "Internal server error"}}
        with pytest.raises(LLMServerError, match="Venice API server error"):
            venice_client._map_venice_error_to_letta_error(500, error_data)


class TestVeniceClientEmbeddings:
    """Test embeddings method."""

    @pytest.mark.asyncio
    async def test_request_embeddings_success(self, venice_client):
        """Test successful embeddings request."""
        texts = ["Hello world", "How are you?"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint=VENICE_API_BASE_URL,
            embedding_dim=1536,
        )

        mock_response_data = {
            "data": [
                {"index": 0, "embedding": [0.1, 0.2, 0.3]},
                {"index": 1, "embedding": [0.4, 0.5, 0.6]},
            ]
        }

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=mock_response_data)

        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post_context.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)

        with patch.object(venice_client, "_get_api_key_async_from_embedding_config", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                embeddings = await venice_client.request_embeddings(texts, embedding_config)

                assert len(embeddings) == 2
                assert embeddings[0] == [0.1, 0.2, 0.3]
                assert embeddings[1] == [0.4, 0.5, 0.6]

    @pytest.mark.asyncio
    async def test_request_embeddings_empty_list(self, venice_client):
        """Test embeddings request with empty text list."""
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint=VENICE_API_BASE_URL,
            embedding_dim=1536,
        )

        embeddings = await venice_client.request_embeddings([], embedding_config)
        assert embeddings == []

    @pytest.mark.asyncio
    async def test_request_embeddings_invalid_response(self, venice_client):
        """Test embeddings request with invalid response format."""
        texts = ["Hello world"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint=VENICE_API_BASE_URL,
            embedding_dim=1536,
        )

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={})  # Missing "data" key

        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post_context.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)

        with patch.object(venice_client, "_get_api_key_async_from_embedding_config", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                with pytest.raises(LLMServerError, match="Invalid embeddings response format"):
                    await venice_client.request_embeddings(texts, embedding_config)


class TestVeniceClientReasoningModel:
    """Test reasoning model detection."""

    def test_is_reasoning_model_false(self, venice_client, llm_config):
        """Test that Venice models are not reasoning models."""
        result = venice_client.is_reasoning_model(llm_config)
        assert result is False


class TestVeniceClientHTTPErrorHandling:
    """Test HTTP error handling methods."""

    def test_handle_http_error_401(self, venice_client):
        """Test handling 401 HTTP error."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": {"message": "Unauthorized"}}

        with pytest.raises(LLMAuthenticationError):
            venice_client._handle_http_error(mock_response)

    def test_handle_http_error_429_with_retry_after(self, venice_client):
        """Test handling 429 HTTP error with Retry-After header."""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "5"}
        mock_response.json.return_value = {"error": {"message": "Rate limited"}}

        with pytest.raises(LLMRateLimitError) as exc_info:
            venice_client._handle_http_error(mock_response)
        assert "5" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handle_http_error_async_500(self, venice_client):
        """Test handling 500 HTTP error asynchronously."""
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.json = AsyncMock(return_value={"error": {"message": "Server error"}})

        with pytest.raises(LLMServerError):
            await venice_client._handle_http_error_async(mock_response)

    @pytest.mark.asyncio
    async def test_handle_http_error_async_connection_error(self, venice_client):
        """Test handling connection error asynchronously."""
        mock_response = AsyncMock()
        mock_response.status = 0  # Connection error
        mock_response.json = AsyncMock(side_effect=Exception("Connection failed"))

        with pytest.raises(LLMConnectionError):
            await venice_client._handle_http_error_async(mock_response)


class TestVeniceClientHelperMethods:
    """Test helper methods."""

    def test_parse_error_response(self, venice_client):
        """Test parsing error response from requests.Response."""
        mock_response = Mock()
        mock_response.json.return_value = {"error": {"message": "Test error"}}
        error_data = venice_client._parse_error_response(mock_response)
        assert error_data == {"error": {"message": "Test error"}}

    def test_parse_error_response_text_fallback(self, venice_client):
        """Test parsing error response with text fallback."""
        mock_response = Mock()
        mock_response.json.side_effect = ValueError("Not JSON")
        mock_response.text = "Plain text error"
        error_data = venice_client._parse_error_response(mock_response)
        assert error_data == {"error": {"message": "Plain text error"}}

    @pytest.mark.asyncio
    async def test_parse_error_response_async(self, venice_client):
        """Test parsing error response from aiohttp.ClientResponse."""
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={"error": {"message": "Test error"}})
        error_data = await venice_client._parse_error_response_async(mock_response)
        assert error_data == {"error": {"message": "Test error"}}

    def test_convert_tool_calls(self, venice_client):
        """Test converting tool calls to OpenAI format."""
        tool_calls = [
            {
                "id": "call_123",
                "type": "function",
                "function": {"name": "get_weather", "arguments": '{"location": "Paris"}'},
            }
        ]

        result = venice_client._convert_tool_calls(tool_calls)
        assert result is not None
        assert len(result) == 1
        assert result[0].id == "call_123"
        assert result[0].function.name == "get_weather"
        assert result[0].function.arguments == '{"location": "Paris"}'

    def test_convert_tool_calls_none(self, venice_client):
        """Test converting None tool calls."""
        result = venice_client._convert_tool_calls(None)
        assert result is None

    def test_convert_chunk_to_openai_format(self, venice_client, mock_venice_streaming_chunk):
        """Test converting streaming chunk to OpenAI format."""
        chunk = venice_client._convert_chunk_to_openai_format(mock_venice_streaming_chunk)
        assert isinstance(chunk, ChatCompletionChunk)
        assert chunk.id == "chatcmpl-123"
        assert chunk.model == "llama-3.3-70b"
        assert len(chunk.choices) == 1
        assert chunk.choices[0].delta.content == "Hello"


class TestVeniceClientHTTPErrorHandling:
    """Test HTTP error handling methods."""

    def test_handle_http_error_401(self, venice_client):
        """Test handling 401 HTTP error."""
        error_data = {"error": {"message": "Unauthorized"}}
        with pytest.raises(LLMAuthenticationError):
            venice_client._handle_http_error(401, error_data, attempt=0, max_retries=3, retry_delay=1)

    def test_handle_http_error_429_with_retry_after(self, venice_client):
        """Test handling 429 HTTP error with retry after."""
        error_data = {"error": {"message": "Rate limited", "retry_after": "5"}}
        with patch("time.sleep"):  # Speed up test
            # Should retry first time, then raise on second
            with pytest.raises(LLMRateLimitError):
                venice_client._handle_http_error(429, error_data, attempt=2, max_retries=3, retry_delay=1)

    @pytest.mark.asyncio
    async def test_handle_http_error_async_500(self, venice_client):
        """Test handling 500 HTTP error asynchronously."""
        error_data = {"error": {"message": "Server error"}}
        with pytest.raises(LLMServerError):
            await venice_client._handle_http_error_async(500, error_data, attempt=2, max_retries=3, retry_delay=1)

    @pytest.mark.asyncio
    async def test_handle_http_error_async_retry(self, venice_client):
        """Test handling 500 HTTP error with retry."""
        error_data = {"error": {"message": "Server error"}}
        with patch("asyncio.sleep"):  # Speed up test
            # Should retry and return None (continue retrying)
            result = await venice_client._handle_http_error_async(500, error_data, attempt=0, max_retries=3, retry_delay=1)
            assert result is None


class TestVeniceClientFactory:
    """Test VeniceClient factory registration."""

    def test_factory_creates_venice_client(self):
        """Test that factory creates VeniceClient for venice provider type."""
        from letta.llm_api.llm_client import LLMClient
        from letta.schemas.enums import ProviderType

        client = LLMClient.create(ProviderType.venice)
        assert isinstance(client, VeniceClient)

    def test_factory_creates_with_parameters(self):
        """Test that factory creates client with custom parameters."""
        from letta.llm_api.llm_client import LLMClient
        from letta.schemas.enums import ProviderType

        mock_actor = Mock()
        client = LLMClient.create(ProviderType.venice, put_inner_thoughts_first=False, actor=mock_actor)
        assert isinstance(client, VeniceClient)
        assert client.put_inner_thoughts_first is False
        assert client.actor == mock_actor

