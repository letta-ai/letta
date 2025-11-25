"""
Venice AI LLM client implementation for Letta.

This client integrates Venice AI's API into Letta's LLM provider system.
It extracts and adapts code from the venice-ai-sdk to work within Letta's architecture.
"""

import asyncio
import json
import os
import time
from typing import TYPE_CHECKING, AsyncGenerator, List, Optional

import aiohttp
import requests
from openai import AsyncStream
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
from letta.llm_api.llm_client_base import LLMClientBase
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    Choice,
    Message as ChoiceMessage,
    UsageStatistics,
)

if TYPE_CHECKING:
    from letta.orm import User

logger = get_logger(__name__)

# Venice API constants
VENICE_API_BASE_URL = "https://api.venice.ai/api/v1"
VENICE_DEFAULT_TIMEOUT = 30
VENICE_DEFAULT_MAX_RETRIES = 3
VENICE_DEFAULT_RETRY_DELAY = 1


class VeniceClient(LLMClientBase):
    """
    Venice AI LLM client implementation.
    
    This client handles communication with Venice AI's API, including:
    - Chat completions (sync and async)
    - Streaming responses
    - Error handling and retries
    - Tool/function calling support
    """

    def __init__(
        self,
        put_inner_thoughts_first: Optional[bool] = True,
        use_tool_naming: bool = True,
        actor: Optional["User"] = None,
    ):
        super().__init__(
            put_inner_thoughts_first=put_inner_thoughts_first,
            use_tool_naming=use_tool_naming,
            actor=actor,
        )

    def _get_api_key(self, llm_config: LLMConfig) -> str:
        """
        Get the API key for Venice from BYOK overrides or environment.
        
        Args:
            llm_config: The LLM configuration
            
        Returns:
            The API key string
            
        Raises:
            LLMAuthenticationError: If no API key is found
        """
        api_key, _, _ = self.get_byok_overrides(llm_config)
        
        if not api_key:
            api_key = os.environ.get("VENICE_API_KEY")
        
        if not api_key:
            raise LLMAuthenticationError(
                "Venice API key not found. Set VENICE_API_KEY environment variable or configure BYOK provider."
            )
        
        return api_key

    async def _get_api_key_async(self, llm_config: LLMConfig) -> str:
        """
        Get the API key for Venice from BYOK overrides or environment (async).
        
        Args:
            llm_config: The LLM configuration
            
        Returns:
            The API key string
            
        Raises:
            LLMAuthenticationError: If no API key is found
        """
        api_key, _, _ = await self.get_byok_overrides_async(llm_config)
        
        if not api_key:
            api_key = os.environ.get("VENICE_API_KEY")
        
        if not api_key:
            raise LLMAuthenticationError(
                "Venice API key not found. Set VENICE_API_KEY environment variable or configure BYOK provider."
            )
        
        return api_key

    def _get_base_url(self, llm_config: LLMConfig) -> str:
        """
        Get the base URL for Venice API.
        
        Args:
            llm_config: The LLM configuration
            
        Returns:
            The base URL string
        """
        if llm_config.model_endpoint:
            return llm_config.model_endpoint.rstrip("/")
        return VENICE_API_BASE_URL

    @trace_method
    def build_request_data(
        self,
        agent_type: AgentType,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: List[dict],
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict:
        """
        Construct request payload in OpenAI-compatible format for Venice API.
        
        Venice API uses OpenAI-compatible request format, so we leverage Letta's
        OpenAI message conversion utilities. Converts Letta messages to OpenAI format,
        handles image content, and supports tool/function calling.
        
        Venice-specific notes:
        - Does not support inner thoughts in kwargs (put_inner_thoughts_in_kwargs=False)
        - Does not support developer role (use_developer_message=False)
        - Uses OpenAI-compatible tool format
        
        Args:
            agent_type: Type of agent making the request (affects message formatting)
            messages: List of Letta PydanticMessage objects to convert
            llm_config: LLM configuration (model, temperature, max_tokens, etc.)
            tools: List of tool definition dictionaries (OpenAI function format)
            force_tool_call: Optional tool name to force a specific tool call
            requires_subsequent_tool_call: If True, sets tool_choice to "required"
            tool_return_truncation_chars: Optional truncation length (not used by Venice directly)
            
        Returns:
            dict: Request payload dictionary with keys: model, messages, temperature,
            max_tokens, tools, tool_choice (if tools provided)
        """
        # Convert messages to OpenAI-compatible format (Venice uses OpenAI format)
        # Venice doesn't support inner thoughts in kwargs, so set to False
        venice_messages = PydanticMessage.to_openai_dicts_from_list(
            messages,
            put_inner_thoughts_in_kwargs=False,
            use_developer_message=False,  # Venice doesn't support developer role
        )
        
        # Handle image content if present
        from letta.llm_api.openai_client import fill_image_content_in_messages
        venice_messages = fill_image_content_in_messages(venice_messages, messages)
        
        request_data = {
            "model": llm_config.model or "llama-3.3-70b",
            "messages": venice_messages,
        }
        
        # Add temperature if specified
        if llm_config.temperature is not None:
            request_data["temperature"] = llm_config.temperature
        
        # Add max_tokens if specified
        if llm_config.max_tokens is not None:
            request_data["max_tokens"] = llm_config.max_tokens
        
        # Add tools if provided
        if tools:
            # Convert tools to OpenAI format
            from letta.schemas.openai.chat_completion_request import Tool as OpenAITool
            typed_tools = [OpenAITool(type="function", function=f) for f in tools]
            request_data["tools"] = [tool.model_dump(exclude_unset=True) for tool in typed_tools]
            
            # Handle tool_choice
            if force_tool_call:
                request_data["tool_choice"] = {"type": "function", "function": {"name": force_tool_call}}
            elif requires_subsequent_tool_call:
                request_data["tool_choice"] = "required"
            else:
                request_data["tool_choice"] = "auto"
        
        return request_data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs synchronous HTTP POST request to Venice API chat completions endpoint.
        
        Implements retry logic with exponential backoff for rate limits (429) and server errors (5xx).
        Retries up to VENICE_DEFAULT_MAX_RETRIES times with increasing delays.
        
        Args:
            request_data: Request payload dictionary (model, messages, tools, etc.)
            llm_config: LLM configuration containing API key and endpoint settings
            
        Returns:
            Dictionary containing raw Venice API response (OpenAI-compatible format)
            
        Raises:
            LLMAuthenticationError: If API key is missing or invalid (401)
            LLMRateLimitError: If rate limit exceeded after retries (429)
            LLMTimeoutError: If request times out after retries
            LLMConnectionError: If connection fails after retries
            LLMServerError: If server error occurs after retries (5xx)
            LLMBadRequestError: For client errors (400, 422)
        """
        api_key = self._get_api_key(llm_config)
        base_url = self._get_base_url(llm_config)
        endpoint = f"{base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        # Retry configuration: exponential backoff for rate limits and server errors
        max_retries = VENICE_DEFAULT_MAX_RETRIES
        retry_delay = VENICE_DEFAULT_RETRY_DELAY
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    endpoint,
                    json=request_data,
                    headers=headers,
                    timeout=VENICE_DEFAULT_TIMEOUT,
                )
                
                # Handle HTTP errors (4xx, 5xx) - may trigger retry for rate limits/server errors
                if response.status_code >= 400:
                    error_data = self._parse_error_response(response)
                    self._handle_http_error(response.status_code, error_data, attempt, max_retries, retry_delay)
                    continue  # Retry if applicable (rate limit or server error)
                
                # Success: return parsed JSON response
                return response.json()
                
            except requests.exceptions.Timeout:
                # Timeout: retry with exponential backoff unless last attempt
                if attempt == max_retries - 1:
                    raise LLMTimeoutError("Request to Venice API timed out")
                time.sleep(retry_delay * (2 ** attempt))  # Exponential backoff: 1s, 2s, 4s...
                continue
                
            except requests.exceptions.ConnectionError as e:
                # Connection error: retry with exponential backoff unless last attempt
                if attempt == max_retries - 1:
                    raise LLMConnectionError(f"Failed to connect to Venice API: {str(e)}")
                time.sleep(retry_delay * (2 ** attempt))
                continue
                
            except requests.exceptions.RequestException as e:
                # Other request exceptions: don't retry, fail immediately
                raise LLMConnectionError(f"Request to Venice API failed: {str(e)}")
        
        # Fallback: should not reach here if retry logic works correctly
        raise LLMServerError("Request to Venice API failed after retries")

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs asynchronous request to Venice API and returns raw response.
        
        Args:
            request_data: The request data dictionary
            llm_config: LLM configuration
            
        Returns:
            Dictionary containing the raw API response
            
        Raises:
            LLMError: If the request fails
        """
        api_key = await self._get_api_key_async(llm_config)
        base_url = self._get_base_url(llm_config)
        endpoint = f"{base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        # Make request with retry logic
        max_retries = VENICE_DEFAULT_MAX_RETRIES
        retry_delay = VENICE_DEFAULT_RETRY_DELAY
        
        timeout = aiohttp.ClientTimeout(total=VENICE_DEFAULT_TIMEOUT)
        
        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        endpoint,
                        json=request_data,
                        headers=headers,
                    ) as response:
                        # Handle errors
                        if response.status >= 400:
                            error_data = await self._parse_error_response_async(response)
                            await self._handle_http_error_async(
                                response.status, error_data, attempt, max_retries, retry_delay
                            )
                            continue  # Retry if applicable
                        
                        # Success
                        return await response.json()
                        
            except aiohttp.ClientError as e:
                if attempt == max_retries - 1:
                    raise LLMConnectionError(f"Failed to connect to Venice API: {str(e)}")
                await asyncio.sleep(retry_delay * (2 ** attempt))
                continue
        
        # Should not reach here, but just in case
        raise LLMServerError("Request to Venice API failed after retries")

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs asynchronous streaming request to Venice API using Server-Sent Events (SSE).
        
        Parses SSE format responses (`data: {...}`) and converts to OpenAI ChatCompletionChunk format.
        Handles both SSE-prefixed lines and raw JSON lines for compatibility.
        
        Args:
            request_data: Request payload dictionary (will have stream=True added)
            llm_config: LLM configuration containing API key and endpoint settings
            
        Returns:
            AsyncStream[ChatCompletionChunk]: Async context manager and iterator for streaming chunks
            
        Raises:
            LLMAuthenticationError: If API key is missing or invalid (401)
            LLMBadRequestError: For client errors (400, 422)
            LLMConnectionError: If connection fails during streaming
        """
        # Enable streaming mode in request
        request_data["stream"] = True
        
        api_key = await self._get_api_key_async(llm_config)
        base_url = self._get_base_url(llm_config)
        endpoint = f"{base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        timeout = aiohttp.ClientTimeout(total=VENICE_DEFAULT_TIMEOUT)
        
        async def _stream_generator() -> AsyncGenerator[ChatCompletionChunk, None]:
            """
            Internal async generator that parses SSE stream and yields ChatCompletionChunk objects.
            
            Handles two formats:
            1. SSE format: `data: {...}` - strips "data: " prefix before parsing
            2. Raw JSON: Direct JSON lines (fallback for non-SSE responses)
            
            Skips empty lines and invalid JSON gracefully.
            Stops on `[DONE]` marker or end of stream.
            """
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        endpoint,
                        json=request_data,
                        headers=headers,
                    ) as response:
                        # Check for HTTP errors before parsing stream
                        if response.status >= 400:
                            error_data = await self._parse_error_response_async(response)
                            self._map_venice_error_to_letta_error(response.status, error_data)
                        
                        # Parse SSE stream line by line
                        async for line in response.content:
                            line_str = line.decode("utf-8").strip()
                            
                            # Skip empty lines
                            if not line_str:
                                continue
                            
                            # Handle Server-Sent Events format: "data: {...}"
                            if line_str.startswith("data: "):
                                data_content = line_str[6:]  # Remove "data: " prefix
                                # Check for stream termination marker
                                if data_content.strip() == "[DONE]":
                                    break
                                
                                try:
                                    chunk_data = json.loads(data_content)
                                    # Convert Venice chunk format to OpenAI ChatCompletionChunk
                                    chunk = self._convert_chunk_to_openai_format(chunk_data)
                                    yield chunk
                                except json.JSONDecodeError:
                                    # Skip invalid JSON gracefully
                                    continue
                            else:
                                # Fallback: try parsing as raw JSON (for non-SSE responses)
                                try:
                                    chunk_data = json.loads(line_str)
                                    chunk = self._convert_chunk_to_openai_format(chunk_data)
                                    yield chunk
                                except json.JSONDecodeError:
                                    # Skip invalid JSON gracefully
                                    continue
                                    
            except aiohttp.ClientError as e:
                raise LLMConnectionError(f"Failed to stream from Venice API: {str(e)}")
        
        # Return AsyncStream-compatible wrapper that implements both async context manager
        # and async iterator protocols (required by OpenAI's AsyncStream interface)
        class VeniceAsyncStream:
            """
            Wrapper class that makes the async generator compatible with OpenAI's AsyncStream interface.
            
            Implements both async context manager (`__aenter__`, `__aexit__`) and async iterator
            (`__aiter__`, `__anext__`) protocols for seamless integration with Letta's streaming infrastructure.
            """
            def __init__(self, generator: AsyncGenerator[ChatCompletionChunk, None]):
                self._generator = generator
                self._iter = None  # Lazy initialization of iterator
            
            async def __aenter__(self):
                """Initialize iterator when entering async context."""
                self._iter = self._generator.__aiter__()
                return self
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                """Clean up iterator when exiting async context."""
                self._iter = None
                return False
            
            def __aiter__(self):
                """Return self as async iterator."""
                return self
            
            async def __anext__(self):
                """Get next chunk from stream, initializing iterator if needed."""
                if self._iter is None:
                    self._iter = self._generator.__aiter__()
                try:
                    return await self._iter.__anext__()
                except StopAsyncIteration:
                    raise
        
        return VeniceAsyncStream(_stream_generator())

    @trace_method
    async def request_embeddings(self, texts: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts using Venice API.
        
        Uses OpenAI-compatible embeddings endpoint. Returns embeddings sorted by index
        to maintain input order. Supports batch processing of multiple texts in a single request.
        
        Args:
            texts: List of text strings to generate embeddings for
            embedding_config: Embedding configuration containing model and endpoint settings
            
        Returns:
            List[List[float]]: List of embedding vectors, each vector is a list of floats.
            Order matches input texts order (sorted by index from API response).
            
        Raises:
            LLMAuthenticationError: If API key is missing or invalid (401)
            LLMBadRequestError: For client errors (400, 422)
            LLMServerError: For server errors (5xx) or invalid response format
            LLMConnectionError: If connection fails
        """
        if not texts:
            return []
        
        api_key = await self._get_api_key_async_from_embedding_config(embedding_config)
        base_url = embedding_config.embedding_endpoint or VENICE_API_BASE_URL
        
        # Ensure URL ends with /api/v1
        if not base_url.endswith("/api/v1"):
            if base_url.endswith("/"):
                base_url = base_url.rstrip("/")
            base_url = f"{base_url}/api/v1" if not base_url.endswith("/api/v1") else base_url
        
        endpoint = f"{base_url}/embeddings"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        # Venice uses OpenAI-compatible format
        request_data = {
            "model": embedding_config.embedding_model,
            "input": texts,
        }
        
        timeout = aiohttp.ClientTimeout(total=VENICE_DEFAULT_TIMEOUT)
        
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    endpoint,
                    json=request_data,
                    headers=headers,
                ) as response:
                    if response.status >= 400:
                        error_data = await self._parse_error_response_async(response)
                        self._map_venice_error_to_letta_error(response.status, error_data)
                    
                    result = await response.json()
                    
                    # Venice returns OpenAI-compatible format: {"data": [{"embedding": [...], "index": 0}, ...]}
                    if "data" not in result:
                        raise LLMServerError("Invalid embeddings response format from Venice API")
                    
                    # Extract embeddings and sort by index to maintain order
                    embeddings_data = result["data"]
                    embeddings_data.sort(key=lambda x: x.get("index", 0))
                    return [item["embedding"] for item in embeddings_data]
                    
        except aiohttp.ClientError as e:
            raise LLMConnectionError(f"Failed to get embeddings from Venice API: {str(e)}")
    
    async def _get_api_key_async_from_embedding_config(self, embedding_config: EmbeddingConfig) -> str:
        """
        Get API key for embeddings request from embedding config.
        
        Args:
            embedding_config: The embedding configuration
            
        Returns:
            The API key string
            
        Raises:
            LLMAuthenticationError: If no API key is found
        """
        # For embeddings, we need to check if there's a BYOK override
        # Since embeddings use EmbeddingConfig, we need to construct a temporary LLMConfig
        # to use get_byok_overrides_async
        from letta.schemas.llm_config import LLMConfig
        
        # Create a temporary LLMConfig from embedding_config for BYOK lookup
        temp_llm_config = LLMConfig(
            model=embedding_config.embedding_model,
            model_endpoint_type="venice",
            model_endpoint=embedding_config.embedding_endpoint,
            context_window=128000,  # Default context window for embeddings
            provider_name=getattr(embedding_config, "provider_name", None),
            provider_category=getattr(embedding_config, "provider_category", None),
        )
        
        api_key, _, _ = await self.get_byok_overrides_async(temp_llm_config)
        
        if not api_key:
            api_key = os.environ.get("VENICE_API_KEY")
        
        if not api_key:
            raise LLMAuthenticationError(
                "Venice API key not found. Set VENICE_API_KEY environment variable or configure BYOK provider."
            )
        
        return api_key

    @trace_method
    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Convert Venice API response (OpenAI-compatible format) to Letta ChatCompletionResponse.
        
        Venice API uses OpenAI-compatible response format, so conversion is straightforward.
        Extracts choices, messages, tool calls, and usage statistics from response.
        
        Args:
            response_data: Raw JSON response dictionary from Venice API
            input_messages: Original input messages (used for context, not directly in conversion)
            llm_config: LLM configuration (used for model name fallback)
            
        Returns:
            ChatCompletionResponse: Standardized Letta response object with choices, usage, etc.
        """
        # Venice API uses OpenAI-compatible format, so conversion should be straightforward
        choices = []
        for choice_data in response_data.get("choices", []):
            message_data = choice_data.get("message", {})
            choice = Choice(
                index=choice_data.get("index", 0),
                message=ChoiceMessage(
                    role=message_data.get("role", "assistant"),
                    content=message_data.get("content"),
                    tool_calls=self._convert_tool_calls(message_data.get("tool_calls")),
                ),
                finish_reason=choice_data.get("finish_reason"),
            )
            choices.append(choice)
        
        usage_data = response_data.get("usage", {})
        usage = UsageStatistics(
            prompt_tokens=usage_data.get("prompt_tokens", 0),
            completion_tokens=usage_data.get("completion_tokens", 0),
            total_tokens=usage_data.get("total_tokens", 0),
        )
        
        return ChatCompletionResponse(
            id=response_data.get("id", ""),
            object=response_data.get("object", "chat.completion"),
            created=response_data.get("created", int(time.time())),
            model=response_data.get("model", llm_config.model),
            choices=choices,
            usage=usage,
        )

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        """
        Check if the Venice model supports native reasoning capabilities.
        
        Queries the Venice API to get model metadata and checks the model's traits
        to determine if it supports reasoning. Models with reasoning capabilities
        will have relevant traits in their model_spec.traits field.
        
        Args:
            llm_config: LLM configuration containing model information
            
        Returns:
            bool: True if the model supports reasoning, False otherwise
        """
        # Extract model ID from handle (format: venice/{model_id}) or use model directly
        model_id = llm_config.model
        if "/" in model_id:
            model_id = model_id.split("/", 1)[1]
        
        try:
            # Get API key and base URL
            api_key = self._get_api_key(llm_config)
            base_url = self._get_base_url(llm_config)
            
            # Normalize base URL to ensure it ends with /api/v1
            if not base_url.endswith("/api/v1"):
                if base_url.endswith("/"):
                    base_url = base_url.rstrip("/")
                base_url = f"{base_url}/api/v1" if not base_url.endswith("/api/v1") else base_url
            
            # Query Venice API synchronously to get model metadata
            models_url = f"{base_url}/models"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            response = requests.get(models_url, headers=headers, timeout=VENICE_DEFAULT_TIMEOUT)
            response.raise_for_status()
            response_data = response.json()
            
            # Find the specific model in the response
            models = response_data.get("data", [])
            for model in models:
                if model.get("id") == model_id:
                    # Check model_spec.traits for reasoning indicators
                    model_spec = model.get("model_spec", {})
                    traits = model_spec.get("traits", [])
                    
                    # Check if any trait indicates reasoning capabilities
                    # Common indicators: "reasoning", "reasoner", "thinking", "o1", "o3"
                    reasoning_indicators = ["reasoning", "reasoner", "thinking", "o1", "o3", "o4"]
                    for trait in traits:
                        if isinstance(trait, str):
                            trait_lower = trait.lower()
                            if any(indicator in trait_lower for indicator in reasoning_indicators):
                                return True
                    
                    return False
            
            # Model not found in API response
            logger.warning(f"Venice model {model_id} not found in API response, defaulting to False")
            return False
            
        except Exception as e:
            # If we can't query the API, log and default to False
            logger.warning(f"Failed to check reasoning model status for {model_id}: {e}, defaulting to False")
            return False

    def handle_llm_error(self, e: Exception) -> Exception:
        """
        Map generic exceptions to appropriate Letta LLMError types.
        
        Handles common exception types (timeouts, connection errors) and maps them
        to specific LLMError subclasses. If exception is already an LLMError, returns
        it unchanged.
        
        Args:
            e: Original exception from Venice API or HTTP client
            
        Returns:
            Exception: LLMError subclass (LLMTimeoutError, LLMConnectionError, or LLMError)
        """
        # If it's already an LLMError, return as-is
        from letta.errors import LLMError
        
        if isinstance(e, LLMError):
            return e
        
        # Map common exceptions
        error_str = str(e).lower()
        
        if "timeout" in error_str or isinstance(e, requests.exceptions.Timeout):
            return LLMTimeoutError(f"Venice API timeout: {str(e)}")
        
        if "connection" in error_str or isinstance(e, (requests.exceptions.ConnectionError, aiohttp.ClientError)):
            return LLMConnectionError(f"Venice API connection error: {str(e)}")
        
        # Default to generic error
        return LLMError(f"Venice API error: {str(e)}")

    # Helper methods

    def _parse_error_response(self, response: requests.Response) -> dict:
        """
        Parse error response from synchronous requests.Response object.
        
        Attempts to parse JSON error response. Falls back to text response if JSON
        parsing fails. Always returns a dict with "error" key for consistent error handling.
        
        Args:
            response: requests.Response object from failed HTTP request
            
        Returns:
            dict: Error data dictionary with "error" key containing error details
        """
        try:
            return response.json() or {}
        except Exception:
            # Fallback: use response text if JSON parsing fails
            return {"error": {"message": response.text or "Unknown error"}}

    async def _parse_error_response_async(self, response: aiohttp.ClientResponse) -> dict:
        """
        Parse error response from asynchronous aiohttp.ClientResponse object.
        
        Attempts to parse JSON error response. Falls back to text response if JSON
        parsing fails. Always returns a dict with "error" key for consistent error handling.
        
        Args:
            response: aiohttp.ClientResponse object from failed HTTP request
            
        Returns:
            dict: Error data dictionary with "error" key containing error details
        """
        try:
            return await response.json() or {}
        except Exception:
            # Fallback: use response text if JSON parsing fails
            text = await response.text()
            return {"error": {"message": text or "Unknown error"}}

    def _handle_http_error(
        self,
        status_code: int,
        error_data: dict,
        attempt: int,
        max_retries: int,
        retry_delay: int,
    ) -> None:
        """
        Handle HTTP errors with exponential backoff retry logic.
        
        Retries are attempted for:
        - Rate limit errors (429): May include retry_after header from API
        - Server errors (5xx): Transient errors that may resolve on retry
        
        Uses exponential backoff: delay = retry_delay * (2 ** attempt)
        If API provides retry_after value, uses that instead.
        
        Args:
            status_code: HTTP status code from response
            error_data: Error response dictionary (may contain retry_after)
            attempt: Current retry attempt number (0-indexed)
            max_retries: Maximum number of retry attempts
            retry_delay: Base delay in seconds for exponential backoff
            
        Raises:
            LLMError: If retries exhausted or error is not retryable (4xx except 429)
        """
        is_rate_limited = status_code == 429
        is_server_error = status_code >= 500
        
        # Retry on rate limit or server errors if attempts remain
        if (is_rate_limited or is_server_error) and attempt < max_retries - 1:
            # Calculate retry delay: prefer API's retry_after, otherwise exponential backoff
            retry_after = error_data.get("error", {}).get("retry_after")
            if retry_after:
                delay = int(retry_after)  # Use API-specified delay
            else:
                delay = retry_delay * (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s...
            time.sleep(delay)
            return  # Continue to retry
        
        # No retry or attempts exhausted: map to appropriate error and raise
        self._map_venice_error_to_letta_error(status_code, error_data)

    async def _handle_http_error_async(
        self,
        status_code: int,
        error_data: dict,
        attempt: int,
        max_retries: int,
        retry_delay: int,
    ) -> None:
        """
        Handle HTTP errors with exponential backoff retry logic (async version).
        
        Retries are attempted for:
        - Rate limit errors (429): May include retry_after header from API
        - Server errors (5xx): Transient errors that may resolve on retry
        
        Uses exponential backoff: delay = retry_delay * (2 ** attempt)
        If API provides retry_after value, uses that instead.
        
        Args:
            status_code: HTTP status code from response
            error_data: Error response dictionary (may contain retry_after)
            attempt: Current retry attempt number (0-indexed)
            max_retries: Maximum number of retry attempts
            retry_delay: Base delay in seconds for exponential backoff
            
        Raises:
            LLMError: If retries exhausted or error is not retryable (4xx except 429)
        """
        import asyncio
        
        is_rate_limited = status_code == 429
        is_server_error = status_code >= 500
        
        # Retry on rate limit or server errors if attempts remain
        if (is_rate_limited or is_server_error) and attempt < max_retries - 1:
            # Calculate retry delay
            retry_after = error_data.get("error", {}).get("retry_after")
            if retry_after:
                delay = int(retry_after)
            else:
                delay = retry_delay * (2 ** attempt)
            await asyncio.sleep(delay)
            return  # Continue to retry
        
        # No retry or attempts exhausted: raise error
        self._map_venice_error_to_letta_error(status_code, error_data)

    def _map_venice_error_to_letta_error(self, status_code: int, error_data: dict) -> None:
        """
        Map Venice API HTTP status codes to appropriate Letta LLMError subclasses.
        
        Error mapping follows standard HTTP status code conventions:
        - 4xx: Client errors (authentication, bad request, not found, etc.)
        - 5xx: Server errors (internal server error, service unavailable, etc.)
        - 429: Rate limiting (special case, may trigger retries)
        
        Args:
            status_code: HTTP status code from Venice API response
            error_data: Error response dictionary from Venice API
            
        Raises:
            LLMAuthenticationError: For 401 Unauthorized
            LLMPermissionDeniedError: For 403 Forbidden
            LLMNotFoundError: For 404 Not Found
            LLMRateLimitError: For 429 Too Many Requests
            LLMBadRequestError: For 400 Bad Request or unknown 4xx errors
            LLMUnprocessableEntityError: For 422 Unprocessable Entity
            LLMServerError: For 5xx Server Errors
        """
        error_obj = error_data.get("error", {})
        # Handle both string and dict error formats from Venice API
        if isinstance(error_obj, str):
            error_message = error_obj
        else:
            error_message = error_obj.get("message", "Unknown error")
        
        # Map status codes to Letta error types
        if status_code == 401:
            raise LLMAuthenticationError(f"Venice API authentication failed: {error_message}")
        elif status_code == 403:
            raise LLMPermissionDeniedError(f"Venice API permission denied: {error_message}")
        elif status_code == 404:
            raise LLMNotFoundError(f"Venice API resource not found: {error_message}")
        elif status_code == 429:
            raise LLMRateLimitError(f"Venice API rate limit exceeded: {error_message}")
        elif status_code == 400:
            raise LLMBadRequestError(f"Venice API bad request: {error_message}")
        elif status_code == 422:
            raise LLMUnprocessableEntityError(f"Venice API unprocessable entity: {error_message}")
        elif status_code >= 500:
            raise LLMServerError(f"Venice API server error: {error_message}")
        else:
            # Default fallback for unknown status codes
            raise LLMBadRequestError(f"Venice API error ({status_code}): {error_message}")

    def _convert_tool_calls(self, tool_calls: Optional[List[dict]]) -> Optional[List]:
        """
        Convert Venice API tool calls format to Letta's OpenAI-compatible ToolCall format.
        
        Venice API uses OpenAI-compatible tool call format, so conversion extracts
        function name, arguments, and tool call ID from Venice response.
        
        Args:
            tool_calls: List of tool call dictionaries from Venice API response, or None
            
        Returns:
            Optional[List[ToolCall]]: List of ToolCall objects, or None if no tool calls
        """
        if not tool_calls:
            return None
        
        from letta.schemas.openai.chat_completion_response import ToolCall, FunctionCall
        
        result = []
        for tool_call_data in tool_calls:
            function_data = tool_call_data.get("function", {})
            tool_call = ToolCall(
                id=tool_call_data.get("id", ""),
                type=tool_call_data.get("type", "function"),
                function=FunctionCall(
                    name=function_data.get("name", ""),
                    arguments=function_data.get("arguments", ""),
                ),
            )
            result.append(tool_call)
        
        return result if result else None

    def _convert_chunk_to_openai_format(self, chunk_data: dict) -> ChatCompletionChunk:
        """
        Convert Venice streaming chunk dictionary to OpenAI ChatCompletionChunk object.
        
        Venice API uses OpenAI-compatible streaming format, so conversion extracts
        chunk ID, choices with deltas, and metadata from Venice response.
        
        Args:
            chunk_data: Dictionary containing streaming chunk data from Venice API
            
        Returns:
            ChatCompletionChunk: OpenAI-compatible chunk object for Letta's streaming infrastructure
        """
        # This is a simplified conversion - may need adjustment based on actual Venice format
        choices = []
        for choice_data in chunk_data.get("choices", []):
            delta = choice_data.get("delta", {})
            choices.append({
                "index": choice_data.get("index", 0),
                "delta": delta,
                "finish_reason": choice_data.get("finish_reason"),
            })
        
        return ChatCompletionChunk(
            id=chunk_data.get("id", ""),
            object=chunk_data.get("object", "chat.completion.chunk"),
            created=chunk_data.get("created", int(time.time())),
            model=chunk_data.get("model", ""),
            choices=choices,
        )

