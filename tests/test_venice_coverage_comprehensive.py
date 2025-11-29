"""
Comprehensive test coverage for Venice AI integration.

This file contains all missing test cases to achieve 100% coverage.
Tests are organized by module and line numbers to ensure complete coverage.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import aiohttp
import pytest
import requests

from letta.errors import (
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMError,
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
    LLMUnprocessableEntityError,
)
from letta.llm_api.venice import venice_get_model_list_async
from letta.llm_api.venice_client import VeniceClient
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.venice import VeniceProvider


# ============================================================================
# venice.py coverage - Missing lines
# ============================================================================

class TestVeniceHelperMissingCoverage:
    """Test missing coverage in venice.py helper function."""
    
    @pytest.mark.asyncio
    async def test_venice_get_model_list_url_normalization_edge_case(self):
        """Test venice.py line 36 - URL normalization edge case."""
        # Test URL that already ends with /api/v1/
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json = Mock(return_value={"data": []})
        mock_response.raise_for_status = Mock()
        
        mock_client = AsyncMock()
        async def mock_get(*args, **kwargs):
            return mock_response
        mock_client.get = mock_get
        mock_client.aclose = AsyncMock()
        
        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await venice_get_model_list_async("https://api.venice.ai/api/v1/", api_key="test-key")
            assert result == {"data": []}
    
    @pytest.mark.asyncio
    async def test_venice_get_model_list_http_error_json_fallback(self):
        """Test venice.py lines 64-65 - HTTPStatusError json parsing fallback."""
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json = Mock(side_effect=ValueError("Not JSON"))
        mock_response.text = "Unauthorized"
        
        # Create httpx.HTTPStatusError
        request = httpx.Request("GET", "https://api.venice.ai/api/v1/models")
        http_err = httpx.HTTPStatusError("401 Unauthorized", request=request, response=mock_response)
        
        mock_client = AsyncMock()
        async def mock_get(*args, **kwargs):
            raise http_err
        mock_client.get = mock_get
        mock_client.aclose = AsyncMock()
        
        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(httpx.HTTPStatusError):
                await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key")
    
    @pytest.mark.asyncio
    async def test_venice_get_model_list_request_error(self):
        """Test venice.py lines 68-71 - RequestError handling."""
        import httpx
        
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.RequestError("Connection failed"))
        mock_client.aclose = AsyncMock()
        
        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(httpx.RequestError):
                await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key")
    
    @pytest.mark.asyncio
    async def test_venice_get_model_list_generic_exception(self):
        """Test venice.py lines 72-75 - Generic Exception handling."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=ValueError("Unexpected error"))
        mock_client.aclose = AsyncMock()
        
        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(ValueError, match="Unexpected error"):
                await venice_get_model_list_async("https://api.venice.ai/api/v1", api_key="test-key")


# ============================================================================
# venice_client.py coverage - Missing lines
# ============================================================================

class TestVeniceClientMissingCoverage:
    """Test missing coverage in venice_client.py."""
    
    @pytest.fixture
    def venice_client(self):
        return VeniceClient()
    
    @pytest.fixture
    def llm_config(self):
        return LLMConfig(
            model="llama-3.3-70b",
            model_endpoint_type="venice",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=128000,
            handle="venice/llama-3.3-70b",
            provider_name="venice",
            provider_category=ProviderCategory.base,
        )
    
    @pytest.mark.asyncio
    async def test_get_api_key_async_error_path(self, venice_client, llm_config):
        """Test venice_client.py line 125 - _get_api_key_async error path."""
        with patch.object(venice_client, "get_byok_overrides_async", return_value=(None, None, None)):
            with patch.dict("os.environ", {}, clear=True):
                with pytest.raises(LLMAuthenticationError):
                    await venice_client._get_api_key_async(llm_config)
    
    def test_build_request_data_with_image_content(self, venice_client, llm_config):
        """Test venice_client.py lines 175-213 - build_request_data with image content and tools."""
        from letta.schemas.enums import MessageRole
        from letta.schemas.message import Message as PydanticMessage
        from datetime import datetime, timezone
        
        from letta.schemas.letta_message_content import TextContent
        
        messages = [
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text="What's in this image?")],
                created_at=datetime.now(timezone.utc),
            )
        ]
        
        # Mock fill_image_content_in_messages to return modified messages
        # It's imported from openai_client, so patch it there
        with patch("letta.llm_api.openai_client.fill_image_content_in_messages", return_value=[{"role": "user", "content": "What's in this image?"}]):
            request_data = venice_client.build_request_data(
                agent_type=AgentType.memgpt_v2_agent,
                messages=messages,
                llm_config=llm_config,
                tools=[{"name": "test_tool", "description": "A test tool"}],
                force_tool_call="test_tool",
            )
            
            assert "tools" in request_data
            assert request_data["tool_choice"]["type"] == "function"
            assert request_data["tool_choice"]["function"]["name"] == "test_tool"
    
    def test_request_request_exception(self, venice_client, llm_config):
        """Test venice_client.py lines 273-277 - RequestException handling."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post", side_effect=requests.exceptions.RequestException("Request failed")):
                with pytest.raises(LLMConnectionError):
                    venice_client.request(request_data, llm_config)
    
    def test_request_final_error_path(self, venice_client, llm_config):
        """Test venice_client.py line 277 - request() final error path when retries exhausted."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Mock response that always returns 500 (exhaust retries)
        # _handle_http_error should return None (indicating retry) for all attempts
        # so we exhaust retries and reach the final error path
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": {"message": "Server error"}}
        mock_response.raise_for_status = Mock()
        
        with patch.object(venice_client, "_get_api_key", return_value="test-api-key"):
            with patch("requests.post", return_value=mock_response):
                with patch("time.sleep"):  # Speed up test
                    # _handle_http_error returns None to indicate retry, but we'll exhaust retries
                    with patch.object(venice_client, "_handle_http_error", return_value=None):
                        # Patch VENICE_DEFAULT_MAX_RETRIES to 1 to exhaust quickly
                        with patch("letta.llm_api.venice_client.VENICE_DEFAULT_MAX_RETRIES", 1):
                            with pytest.raises(LLMServerError, match="Request to Venice API failed after retries"):
                                venice_client.request(request_data, llm_config)
    
    @pytest.mark.asyncio
    async def test_request_async_success_path(self, venice_client, llm_config):
        """Test venice_client.py lines 318-326 - request_async success path."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        mock_response_data = {"id": "test", "choices": [], "usage": {}}
        
        # Create proper async context manager mocks
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
        
        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                result = await venice_client.request_async(request_data, llm_config)
                assert result == mock_response_data
    
    @pytest.mark.asyncio
    async def test_request_async_final_error_path(self, venice_client, llm_config):
        """Test venice_client.py line 335 - request_async final error path."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Create mock that always returns 500 errors (exhaust retries)
        # _handle_http_error_async should return None (indicating retry) for all attempts
        # so we exhaust retries and reach the final error path (line 335)
        mock_response_500 = AsyncMock()
        mock_response_500.status = 500
        mock_response_500.json = AsyncMock(return_value={"error": {"message": "Server error"}})
        
        mock_post_context_500 = AsyncMock()
        mock_post_context_500.__aenter__ = AsyncMock(return_value=mock_response_500)
        mock_post_context_500.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context_500)
        
        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                with patch("asyncio.sleep"):  # Speed up test
                    # _handle_http_error_async returns None to indicate retry, but we'll exhaust retries
                    with patch.object(venice_client, "_handle_http_error_async", return_value=None):
                        with patch.object(venice_client, "_parse_error_response_async", return_value={"error": {"message": "Server error"}}):
                            # Patch VENICE_DEFAULT_MAX_RETRIES to 1 to exhaust quickly
                            with patch("letta.llm_api.venice_client.VENICE_DEFAULT_MAX_RETRIES", 1):
                                with pytest.raises(LLMServerError, match="Request to Venice API failed after retries"):
                                    await venice_client.request_async(request_data, llm_config)
    
    @pytest.mark.asyncio
    async def test_stream_async_full_implementation(self, venice_client, llm_config):
        """Test venice_client.py lines 368-409 - stream_async full implementation."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Create mock SSE stream
        chunks = [
            b'data: {"id":"test","choices":[{"delta":{"content":"Hello"}}]}\n\n',
            b'data: {"id":"test","choices":[{"delta":{"content":" world"}}]}\n\n',
            b'data: [DONE]\n\n',
        ]
        
        async def chunk_generator():
            for chunk in chunks:
                yield chunk
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = chunk_generator()
        
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
                
                # Test async context manager
                async with stream:
                    chunks_received = []
                    async for chunk in stream:
                        chunks_received.append(chunk)
                    
                    assert len(chunks_received) == 2  # [DONE] should stop iteration
    
    @pytest.mark.asyncio
    async def test_stream_async_error_handling(self, venice_client, llm_config):
        """Test venice_client.py lines 408-409 - stream_async error handling."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # The error happens inside the generator, so we need to test it by iterating
        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(side_effect=aiohttp.ClientError("Connection failed"))
        mock_post_context.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)
        
        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                stream = await venice_client.stream_async(request_data, llm_config)
                
                # Error should be raised when we try to use the stream
                with pytest.raises(LLMConnectionError):
                    async with stream:
                        async for _ in stream:
                            pass
    
    @pytest.mark.asyncio
    async def test_stream_async_http_error_status_400(self, venice_client, llm_config):
        """Test venice_client.py lines 376-377 - stream_async HTTP error handling (status >= 400)."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Mock response with 400 status
        mock_response = AsyncMock()
        mock_response.status = 400
        
        mock_post_context = AsyncMock()
        mock_post_context.__aenter__ = AsyncMock(return_value=mock_response)
        mock_post_context.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context)
        
        with patch.object(venice_client, "_get_api_key_async", return_value="test-api-key"):
            with patch.object(venice_client, "_parse_error_response_async", return_value={"error": "Bad request"}):
                with patch.object(venice_client, "_map_venice_error_to_letta_error", side_effect=LLMBadRequestError("Bad request")):
                    with patch("aiohttp.ClientSession", return_value=mock_session):
                        stream = await venice_client.stream_async(request_data, llm_config)
                        
                        # Error should be raised when we try to use the stream
                        with pytest.raises(LLMBadRequestError):
                            async with stream:
                                async for _ in stream:
                                    pass
    
    @pytest.mark.asyncio
    async def test_stream_async_empty_line_skipping(self, venice_client, llm_config):
        """Test venice_client.py line 384 - stream_async empty line skipping."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Create mock SSE stream with empty lines
        chunks = [
            b'\n',  # Empty line (should be skipped)
            b'data: {"id":"test","choices":[{"delta":{"content":"Hello"}}]}\n',
            b'\n',  # Another empty line
            b'data: [DONE]\n',
        ]
        
        async def chunk_generator():
            for chunk in chunks:
                yield chunk
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = chunk_generator()
        
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
                
                async with stream:
                    chunks_received = []
                    async for chunk in stream:
                        chunks_received.append(chunk)
                    
                    # Should have received one chunk (empty lines skipped)
                    assert len(chunks_received) == 1
    
    @pytest.mark.asyncio
    async def test_stream_async_json_decode_errors(self, venice_client, llm_config):
        """Test venice_client.py lines 397-406 - stream_async JSON decode error handling."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Create mock SSE stream with invalid JSON
        chunks = [
            b'data: invalid json\n',  # Invalid JSON (should be skipped)
            b'data: {"id":"test","choices":[{"delta":{"content":"Hello"}}]}\n',  # Valid JSON
            b'not data: also invalid\n',  # Not SSE format, invalid JSON (should be skipped)
            b'data: [DONE]\n',
        ]
        
        async def chunk_generator():
            for chunk in chunks:
                yield chunk
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = chunk_generator()
        
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
                
                async with stream:
                    chunks_received = []
                    async for chunk in stream:
                        chunks_received.append(chunk)
                    
                    # Should have received one valid chunk (invalid JSON skipped)
                    assert len(chunks_received) == 1
    
    @pytest.mark.asyncio
    async def test_stream_async_else_branch_json_parsing(self, venice_client, llm_config):
        """Test venice_client.py lines 403-404 - stream_async else branch (non-SSE JSON parsing)."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        # Create mock stream with a line that doesn't start with "data: " but is valid JSON
        # This should trigger the else branch (lines 399-406)
        chunks = [
            b'{"id":"test","choices":[{"delta":{"content":"Hello"}}]}\n',  # Valid JSON, not SSE format
            b'data: [DONE]\n',
        ]
        
        async def chunk_generator():
            for chunk in chunks:
                yield chunk
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = chunk_generator()
        
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
                
                async with stream:
                    chunks_received = []
                    async for chunk in stream:
                        chunks_received.append(chunk)
                    
                    # Should have received one chunk from the else branch (lines 403-404)
                    assert len(chunks_received) == 1
    
    @pytest.mark.asyncio
    async def test_venice_async_stream_context_manager(self, venice_client, llm_config):
        """Test venice_client.py lines 420-421, 425-426, 429, 432-437 - VeniceAsyncStream."""
        request_data = {"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello"}]}
        
        chunks = [b'data: {"id":"test","choices":[{"delta":{"content":"Hi"}}]}\n\n']
        
        async def chunk_generator():
            for chunk in chunks:
                yield chunk
        
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.content = chunk_generator()
        
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
                
                # Test __aenter__
                async with stream as s:
                    assert s is stream
                    
                    # Test __aiter__ returns self (not awaitable)
                    assert s.__aiter__() is s
                    
                    # Test __anext__ initialization (line 433 - when _iter is None)
                    # _iter is initialized lazily in __anext__, so we need to check before calling it
                    # Actually, looking at the code, _iter is set to None in __aexit__, so after entering
                    # the context manager, _iter should be None initially
                    # But the generator is created when stream_async is called, so _iter might already be set
                    # Let's test that __anext__ handles the case when _iter is None
                    # We'll manually set _iter to None to test that path
                    s._iter = None
                    
                    # First call to __anext__ should initialize _iter (line 433)
                    chunk = await s.__anext__()
                    assert s._iter is not None  # Now initialized
                    
                    # Test StopAsyncIteration
                    with pytest.raises(StopAsyncIteration):
                        await s.__anext__()
    
    @pytest.mark.asyncio
    async def test_request_embeddings_empty_list(self, venice_client):
        """Test venice_client.py line 457 - request_embeddings empty texts."""
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
        )
        
        # This should return immediately without making a request
        result = await venice_client.request_embeddings([], embedding_config)
        assert result == []
    
    @pytest.mark.asyncio
    async def test_request_embeddings_url_normalization(self, venice_client):
        """Test venice_client.py lines 464-466 - request_embeddings URL normalization."""
        texts = ["Hello"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai",  # Missing /api/v1
            embedding_dim=1536,
        )
        
        mock_response_data = {
            "data": [
                {"index": 0, "embedding": [0.1, 0.2, 0.3]},
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
                assert len(embeddings) == 1
    
    @pytest.mark.asyncio
    async def test_request_embeddings_url_normalization_trailing_slash(self, venice_client):
        """Test venice_client.py line 465 - request_embeddings URL normalization when base_url ends with '/'."""
        texts = ["Hello"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/",  # Ends with /
            embedding_dim=1536,
        )
        
        mock_response_data = {
            "data": [
                {"index": 0, "embedding": [0.1, 0.2, 0.3]},
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
                assert len(embeddings) == 1
    
    @pytest.mark.asyncio
    async def test_request_embeddings_error_handling(self, venice_client):
        """Test venice_client.py lines 490-503 - request_embeddings error handling."""
        texts = ["Hello", "World"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
        )
        
        # Test error handling
        mock_response_error = AsyncMock()
        mock_response_error.status = 400
        mock_response_error.json = AsyncMock(return_value={"error": {"message": "Bad request"}})
        
        mock_post_context_error = AsyncMock()
        mock_post_context_error.__aenter__ = AsyncMock(return_value=mock_response_error)
        mock_post_context_error.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context_error)
        
        with patch.object(venice_client, "_get_api_key_async_from_embedding_config", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                with pytest.raises(LLMBadRequestError):
                    await venice_client.request_embeddings(texts, embedding_config)
    
    @pytest.mark.asyncio
    async def test_request_embeddings_sorting(self, venice_client):
        """Test venice_client.py lines 500-503 - request_embeddings sorting by index."""
        texts = ["Hello", "World"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
        )
        
        # Test sorting by index
        mock_response_sorted = AsyncMock()
        mock_response_sorted.status = 200
        # Return out of order to test sorting
        mock_response_sorted.json = AsyncMock(return_value={
            "data": [
                {"index": 1, "embedding": [0.4, 0.5, 0.6]},
                {"index": 0, "embedding": [0.1, 0.2, 0.3]},
            ]
        })
        
        mock_post_context_sorted = AsyncMock()
        mock_post_context_sorted.__aenter__ = AsyncMock(return_value=mock_response_sorted)
        mock_post_context_sorted.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = Mock(return_value=mock_post_context_sorted)
        
        with patch.object(venice_client, "_get_api_key_async_from_embedding_config", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                embeddings = await venice_client.request_embeddings(texts, embedding_config)
                # Should be sorted by index
                assert embeddings[0] == [0.1, 0.2, 0.3]
                assert embeddings[1] == [0.4, 0.5, 0.6]
    
    @pytest.mark.asyncio
    async def test_request_embeddings_client_error(self, venice_client):
        """Test venice_client.py line 506 - request_embeddings ClientError."""
        texts = ["Hello"]
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
        )
        
        # The error happens when creating the session context, so we need to raise it there
        async def mock_session_enter():
            raise aiohttp.ClientError("Connection failed")
        
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(side_effect=aiohttp.ClientError("Connection failed"))
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        with patch.object(venice_client, "_get_api_key_async_from_embedding_config", return_value="test-api-key"):
            with patch("aiohttp.ClientSession", return_value=mock_session):
                with pytest.raises(LLMConnectionError):
                    await venice_client.request_embeddings(texts, embedding_config)
    
    @pytest.mark.asyncio
    async def test_get_api_key_async_from_embedding_config_full(self, venice_client):
        """Test venice_client.py lines 524-546 - _get_api_key_async_from_embedding_config."""
        from letta.schemas.enums import ProviderCategory
        
        embedding_config = EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="venice",
            embedding_endpoint="https://api.venice.ai/api/v1",
            embedding_dim=1536,
            provider_name="venice",
            provider_category=ProviderCategory.base,
        )
        
        # Test BYOK path
        with patch.object(venice_client, "get_byok_overrides_async", return_value=("byok-key", None, None)):
            api_key = await venice_client._get_api_key_async_from_embedding_config(embedding_config)
            assert api_key == "byok-key"
        
        # Test env path
        with patch.object(venice_client, "get_byok_overrides_async", return_value=(None, None, None)):
            with patch.dict("os.environ", {"VENICE_API_KEY": "env-key"}):
                api_key = await venice_client._get_api_key_async_from_embedding_config(embedding_config)
                assert api_key == "env-key"
        
        # Test error path
        with patch.object(venice_client, "get_byok_overrides_async", return_value=(None, None, None)):
            with patch.dict("os.environ", {}, clear=True):
                with pytest.raises(LLMAuthenticationError):
                    await venice_client._get_api_key_async_from_embedding_config(embedding_config)
    
    def test_convert_response_to_chat_completion_full(self, venice_client, llm_config):
        """Test venice_client.py lines 567-588 - convert_response_to_chat_completion full."""
        from letta.schemas.message import Message as PydanticMessage
        from letta.schemas.enums import MessageRole
        from datetime import datetime, timezone
        
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
                        "content": "Hello!",
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
        
        messages = [
            PydanticMessage(
                role=MessageRole.user,
                content=[{"type": "text", "text": "Hello"}],
                created_at=datetime.now(timezone.utc),
            )
        ]
        
        result = venice_client.convert_response_to_chat_completion(response_data, messages, llm_config)
        
        assert result.id == "chatcmpl-123"
        assert result.model == "llama-3.3-70b"
        assert len(result.choices) == 1
        assert result.choices[0].message.content == "Hello!"
        assert result.usage.prompt_tokens == 10
    
    def test_handle_llm_error_llm_error_passthrough(self, venice_client):
        """Test venice_client.py line 624 - handle_llm_error LLMError passthrough."""
        error = LLMError("Already an LLM error")
        result = venice_client.handle_llm_error(error)
        assert result is error
    
    @pytest.mark.asyncio
    async def test_parse_error_response_async_text_fallback(self, venice_client):
        """Test venice_client.py lines 651-653 - _parse_error_response_async text fallback."""
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(side_effect=ValueError("Not JSON"))
        mock_response.text = AsyncMock(return_value="Plain text error")
        
        error_data = await venice_client._parse_error_response_async(mock_response)
        assert error_data == {"error": {"message": "Plain text error"}}
    
    def test_handle_http_error_retry_after(self, venice_client):
        """Test venice_client.py line 672 - _handle_http_error retry_after parsing."""
        error_data = {"error": {"message": "Rate limited", "retry_after": "5"}}
        
        with patch("time.sleep"):  # Speed up test
            # Should retry and return None
            result = venice_client._handle_http_error(429, error_data, attempt=0, max_retries=3, retry_delay=1)
            assert result is None
    
    @pytest.mark.asyncio
    async def test_handle_http_error_async_retry_after(self, venice_client):
        """Test venice_client.py line 700 - _handle_http_error_async retry_after parsing."""
        error_data = {"error": {"message": "Server error", "retry_after": "3"}}
        
        with patch("asyncio.sleep"):  # Speed up test
            result = await venice_client._handle_http_error_async(500, error_data, attempt=0, max_retries=3, retry_delay=1)
            assert result is None
    
    def test_map_venice_error_string_error_obj(self, venice_client):
        """Test venice_client.py line 713 - _map_venice_error_to_letta_error string error_obj."""
        error_data = {"error": "Simple string error"}
        
        with pytest.raises(LLMAuthenticationError, match="Simple string error"):
            venice_client._map_venice_error_to_letta_error(401, error_data)
    
    def test_map_venice_error_default_case(self, venice_client):
        """Test venice_client.py line 732 - _map_venice_error_to_letta_error default case."""
        error_data = {"error": {"message": "Unknown error"}}
        
        # Use a status code that's not covered by any condition (not 400, 401, 403, 404, 422, 429, or >= 500)
        # 418 (I'm a teapot) is perfect for this
        with pytest.raises(LLMBadRequestError):
            venice_client._map_venice_error_to_letta_error(418, error_data)


# ============================================================================
# venice.py provider coverage - Missing lines
# ============================================================================

class TestVeniceProviderMissingCoverage:
    """Test missing coverage in venice.py provider."""
    
    @pytest.fixture
    def venice_provider(self):
        provider = VeniceProvider(
            name="venice",
            api_key="test-api-key",
            base_url="https://api.venice.ai/api/v1",
        )
        return provider
    
    @pytest.mark.asyncio
    async def test_check_api_key_exception_handling(self, venice_provider):
        """Test venice.py provider lines 42-49 - check_api_key exception handling."""
        from letta.errors import LLMError
        from letta.schemas.secret import Secret
        import types
        
        # get_api_key_secret is a method on the base Provider class
        # Create a mock secret that returns plaintext
        mock_secret = Secret.from_plaintext("test-api-key")
        
        # Use object.__setattr__ to bypass Pydantic validation
        original_method = venice_provider.get_api_key_secret
        object.__setattr__(venice_provider, 'get_api_key_secret', lambda: mock_secret)
        
        try:
            # Test 401/unauthorized path
            with patch("letta.llm_api.venice.venice_get_model_list_async", side_effect=Exception("401 Unauthorized")):
                with pytest.raises(LLMAuthenticationError):
                    await venice_provider.check_api_key()
            
            # Test generic error path
            with patch("letta.llm_api.venice.venice_get_model_list_async", side_effect=Exception("Generic error")):
                with pytest.raises(LLMError):
                    await venice_provider.check_api_key()
        finally:
            # Restore original method
            object.__setattr__(venice_provider, 'get_api_key_secret', original_method)
    
    @pytest.mark.asyncio
    async def test_get_models_async_full(self, venice_provider):
        """Test venice.py provider lines 58-71 - _get_models_async full implementation."""
        from letta.schemas.secret import Secret
        
        mock_response = {
            "data": [
                {"id": "llama-3.3-70b", "type": "text"},
                {"id": "gpt-4", "type": "text"},
            ]
        }
        
        from letta.schemas.secret import Secret
        mock_secret = Secret.from_plaintext("test-api-key")
        
        # Use object.__setattr__ to bypass Pydantic validation
        original_method = venice_provider.get_api_key_secret
        object.__setattr__(venice_provider, 'get_api_key_secret', lambda: mock_secret)
        
        try:
            with patch("letta.llm_api.venice.venice_get_model_list_async", return_value=mock_response):
                models = await venice_provider._get_models_async()
                assert len(models) == 2
                assert models[0]["id"] == "llama-3.3-70b"
        finally:
            # Restore original method
            object.__setattr__(venice_provider, 'get_api_key_secret', original_method)
    
    @pytest.mark.asyncio
    async def test_list_llm_models_async(self, venice_provider):
        """Test venice.py provider lines 82-83 - list_llm_models_async."""
        mock_models = [
            {"id": "llama-3.3-70b", "type": "text", "model_spec": {"availableContextTokens": 128000}},
        ]
        
        with patch.object(venice_provider, "_get_models_async", return_value=mock_models):
            configs = await venice_provider.list_llm_models_async()
            assert len(configs) == 1
            assert configs[0].model == "llama-3.3-70b"
            assert configs[0].context_window == 128000
    
    def test_list_llm_models_full(self, venice_provider):
        """Test venice.py provider lines 97-140 - _list_llm_models full implementation."""
        data = [
            {"id": "llama-3.3-70b", "type": "text", "model_spec": {"availableContextTokens": 128000}},
            {"id": "embedding-model", "type": "embedding"},  # Should be filtered out
            {"id": "gpt-4", "type": "text", "model_spec": {"availableContextTokens": 8192}},
            {"id": "no-context-model", "type": "text", "model_spec": {}},  # Should use default context window
        ]
        
        configs = venice_provider._list_llm_models(data)
        
        # Should have 3 models (embedding filtered out)
        assert len(configs) == 3
        assert configs[0].model == "gpt-4"  # Sorted by model name
        assert configs[1].model == "llama-3.3-70b"
        assert configs[2].model == "no-context-model"
        assert configs[2].context_window == 128000  # Default
    
    @pytest.mark.asyncio
    async def test_list_llm_models_missing_id_warning(self, venice_provider):
        """Test venice.py provider lines 106-107 - list_llm_models_async warning when model is missing 'id'."""
        from letta.schemas.secret import Secret
        
        # Model data with missing 'id' field
        models_data = [
            {"type": "text", "model_spec": {"availableContextTokens": 128000}},  # Missing 'id'
            {"id": "valid-model", "type": "text", "model_spec": {"availableContextTokens": 128000}},
        ]
        
        mock_secret = Secret.from_plaintext("test-api-key")
        original_method = venice_provider.get_api_key_secret
        object.__setattr__(venice_provider, 'get_api_key_secret', lambda: mock_secret)
        
        try:
            with patch.object(venice_provider, "_get_models_async", return_value=models_data):
                with patch("logging.Logger.warning") as mock_warning:
                    configs = await venice_provider.list_llm_models_async()
                    
                    # Should have logged a warning for the missing 'id'
                    mock_warning.assert_called_once()
                    assert "missing 'id' field" in str(mock_warning.call_args)
                    
                    # Should only have one model (the valid one)
                    assert len(configs) == 1
                    assert configs[0].model == "valid-model"
        finally:
            # Restore original method
            object.__setattr__(venice_provider, 'get_api_key_secret', original_method)
    
    @pytest.mark.asyncio
    async def test_list_embedding_models_async(self, venice_provider):
        """Test venice.py provider line 153 - list_embedding_models_async."""
        result = await venice_provider.list_embedding_models_async()
        assert result == []

