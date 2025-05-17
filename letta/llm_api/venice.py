import json
from typing import Dict, List, Optional, Union
import uuid
import time
import logging
import asyncio

import aiohttp
import requests
from openai import AsyncStream, Stream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.errors import (
    ErrorCode,
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMUnprocessableEntityError,
)
from letta.llm_api.helpers import (
    add_inner_thoughts_to_functions,
    convert_to_structured_output,
    make_post_request,
    unpack_all_inner_thoughts_from_kwargs,
)
from letta.llm_api.llm_client_base import LLMClientBase, LLMError
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION
from letta.log import get_logger
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.tracing import log_event

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create console handler if none exists
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

class VeniceClient(LLMClientBase):
    """Venice AI LLM client implementation."""

    def __init__(
        self,
        llm_config: LLMConfig,
        put_inner_thoughts_first: Optional[bool] = True,
        use_tool_naming: bool = True,
    ):
        super().__init__(llm_config, put_inner_thoughts_first, use_tool_naming)
        self.api_key = llm_config.api_key
        self.base_url = llm_config.model_endpoint.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def build_request_data(
        self,
        messages: List[Message],
        llm_config: Optional[LLMConfig] = None,
        force_tool_call: Optional[str] = None,
        **kwargs
    ) -> dict:
        """Build request data for Venice API."""
        if not messages:
            raise ValueError("Messages list cannot be empty")
            
        request_data = {
            "messages": [msg.dict() for msg in messages],
            "max_tokens": kwargs.get("max_tokens", 1000),
            "temperature": kwargs.get("temperature", 0.7),
            "model": kwargs.get("model", "llama-3.3-70b")
        }
        
        if force_tool_call:
            request_data["tool_choice"] = {"type": "function", "function": {"name": force_tool_call}}
            
        print(f"\nBuilt request data: {json.dumps(request_data, indent=2)}")
        return request_data

    def request(
        self,
        messages: List[Message],
        llm_config: Optional[LLMConfig] = None,
        **kwargs,
    ) -> Dict:
        """
        Send a synchronous request to the Venice API.
        
        Args:
            messages: List of messages to send
            llm_config: Optional configuration for the request
            **kwargs: Additional keyword arguments
            
        Returns:
            Dict containing the API response
            
        Raises:
            LLMError: For various error conditions (auth, rate limits, etc)
        """
        logger.debug("Preparing Venice API request")
        try:
            # Build request data
            request_data = self.build_request_data(messages, llm_config, **kwargs)
            logger.debug(f"Request data: {json.dumps(request_data, indent=2)}")

            # Send request
            logger.info(f"Sending request to Venice API endpoint: {self.chat_completions_url}")
            response = requests.post(
                self.chat_completions_url,
                headers=self.headers,
                json=request_data,
                timeout=30,  # 30 second timeout
            )

            # Log response status
            logger.debug(f"Received response with status code: {response.status_code}")

            # Handle non-200 responses
            if response.status_code != 200:
                logger.error(f"Error response from Venice API: {response.text}")
                self.handle_llm_error(response)

            # Parse response
            try:
                response_json = response.json()
                logger.debug(f"Response JSON: {json.dumps(response_json, indent=2)}")
                return response_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to decode JSON response: {response.text}")
                raise LLMError(f"Invalid JSON response from Venice API: {str(e)}")

        except requests.exceptions.Timeout:
            logger.error("Request to Venice API timed out")
            raise LLMError("Request timed out")
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error when calling Venice API: {str(e)}")
            raise LLMError(f"Connection error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during Venice API request: {str(e)}")
            raise LLMError(f"Unexpected error: {str(e)}")

    def convert_response_to_chat_completion(
        self, 
        response: dict,
        messages: List[Message],
        llm_config: Optional[LLMConfig] = None,
        **kwargs
    ) -> dict:
        """Convert Venice API response to OpenAI-compatible format."""
        try:
            print(f"\nConverting Venice response to chat completion format:")
            print(f"Input response: {json.dumps(response, indent=2)}")
            
            if not isinstance(response, dict):
                raise LLMError(f"Expected dict response, got {type(response)}")
                
            # Extract the completion text
            completion = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not completion:
                raise LLMError("No completion text found in response")
                
            # Build the standardized response format
            chat_completion = {
                "id": response.get("id", str(uuid.uuid4())),
                "object": "chat.completion",
                "created": int(time.time()),
                "model": response.get("model", "venice-default"),
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": completion
                    },
                    "finish_reason": response.get("choices", [{}])[0].get("finish_reason", "stop")
                }],
                "usage": response.get("usage", {
                    "prompt_tokens": -1,
                    "completion_tokens": -1,
                    "total_tokens": -1
                })
            }
            
            # Handle function calls if present
            tool_calls = response.get("choices", [{}])[0].get("message", {}).get("tool_calls", [])
            if tool_calls:
                chat_completion["choices"][0]["message"]["tool_calls"] = tool_calls
                
            print(f"\nConverted response: {json.dumps(chat_completion, indent=2)}")
            return chat_completion
            
        except Exception as e:
            print(f"Error converting response: {str(e)}")
            raise LLMError(f"Failed to convert Venice response: {str(e)}")

    def stream(self, request_data: dict) -> Stream[ChatCompletionChunk]:
        """Make synchronous streaming request to Venice AI."""
        url = f"{self.base_url}/api/v1/chat/completions"
        request_data["stream"] = True
        
        with requests.post(url, headers=self.headers, json=request_data, stream=True) as response:
            if response.status_code != 200:
                error_data = response.json()
                raise self.handle_llm_error(Exception(f"HTTP {response.status_code}: {error_data}"))
            
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith("data: "):
                        data = line[len("data: "):]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            yield ChatCompletionChunk(**chunk)
                        except json.JSONDecodeError:
                            continue

    async def stream_async(self, request_data: dict) -> AsyncStream[ChatCompletionChunk]:
        """Make asynchronous streaming request to Venice AI."""
        url = f"{self.base_url}/api/v1/chat/completions"
        request_data["stream"] = True
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=request_data) as response:
                if response.status != 200:
                    error_data = await response.json()
                    raise self.handle_llm_error(Exception(f"HTTP {response.status}: {error_data}"))
                
                async for line in response.content:
                    line = line.decode('utf-8')
                    if line.startswith("data: "):
                        data = line[len("data: "):]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            yield ChatCompletionChunk(**chunk)
                        except json.JSONDecodeError:
                            continue

    def handle_llm_error(self, e: Exception) -> Exception:
        """Map Venice AI errors to common LLMError types."""
        if isinstance(e, requests.exceptions.ConnectionError) or isinstance(e, aiohttp.ClientConnectionError):
            logger.warning(f"[Venice] Connection error: {e}")
            return LLMConnectionError(
                message=f"Failed to connect to Venice AI: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if hasattr(e, "__cause__") else None},
            )

        if isinstance(e, requests.exceptions.HTTPError) or isinstance(e, aiohttp.ClientResponseError):
            try:
                error_data = e.response.json() if hasattr(e, "response") else {}
                error_code = error_data.get("error", {}).get("code", "")
                error_message = error_data.get("error", {}).get("message", "")
                status_code = e.response.status_code if hasattr(e, "response") else 500

                if status_code == 401:
                    logger.error(f"[Venice] Authentication error: {error_message}")
                    return LLMAuthenticationError(
                        message=f"Authentication failed with Venice AI: {error_message}",
                        code=ErrorCode.UNAUTHENTICATED,
                        details=error_data,
                    )
                elif status_code == 403:
                    logger.error(f"[Venice] Permission denied: {error_message}")
                    return LLMPermissionDeniedError(
                        message=f"Permission denied by Venice AI: {error_message}",
                        code=ErrorCode.PERMISSION_DENIED,
                        details=error_data,
                    )
                elif status_code == 404:
                    logger.warning(f"[Venice] Resource not found: {error_message}")
                    return LLMNotFoundError(
                        message=f"Resource not found in Venice AI: {error_message}",
                        code=ErrorCode.NOT_FOUND,
                        details=error_data,
                    )
                elif status_code == 429:
                    logger.warning(f"[Venice] Rate limited: {error_message}")
                    return LLMRateLimitError(
                        message=f"Rate limited by Venice AI: {error_message}",
                        code=ErrorCode.RATE_LIMIT_EXCEEDED,
                        details=error_data,
                    )
                elif status_code >= 500:
                    logger.warning(f"[Venice] Server error: {error_message}")
                    return LLMServerError(
                        message=f"Venice AI server error: {error_message}",
                        code=ErrorCode.INTERNAL_SERVER_ERROR,
                        details=error_data,
                    )
                else:
                    logger.warning(f"[Venice] Bad request: {error_message}")
                    return LLMBadRequestError(
                        message=f"Bad request to Venice AI: {error_message}",
                        code=ErrorCode.INVALID_ARGUMENT,
                        details=error_data,
                    )
            except:
                return LLMServerError(
                    message=f"Venice AI error: {str(e)}",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                    details={"error": str(e)},
                )

        return LLMServerError(
            message=f"Unknown Venice AI error: {str(e)}",
            code=ErrorCode.INTERNAL_SERVER_ERROR,
            details={"error": str(e)},
        )

    async def request_async(
        self,
        messages: List[Message],
        llm_config: Optional[LLMConfig] = None,
        **kwargs,
    ) -> Dict:
        """
        Send an asynchronous request to the Venice API.
        
        Args:
            messages: List of messages to send
            llm_config: Optional configuration for the request
            **kwargs: Additional keyword arguments
            
        Returns:
            Dict containing the API response
            
        Raises:
            LLMError: For various error conditions (auth, rate limits, etc)
        """
        logger.debug("Preparing async Venice API request")
        try:
            # Build request data
            request_data = self.build_request_data(messages, llm_config, **kwargs)
            logger.debug(f"Request data: {json.dumps(request_data, indent=2)}")

            # Send request
            logger.info(f"Sending async request to Venice API endpoint: {self.chat_completions_url}")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.chat_completions_url,
                    headers=self.headers,
                    json=request_data,
                    timeout=aiohttp.ClientTimeout(total=30),  # 30 second timeout
                ) as response:
                    # Log response status
                    logger.debug(f"Received async response with status code: {response.status}")

                    # Handle non-200 responses
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Error response from Venice API: {error_text}")
                        self.handle_llm_error(response)

                    # Parse response
                    try:
                        response_json = await response.json()
                        logger.debug(f"Response JSON: {json.dumps(response_json, indent=2)}")
                        return response_json
                    except json.JSONDecodeError as e:
                        response_text = await response.text()
                        logger.error(f"Failed to decode JSON response: {response_text}")
                        raise LLMError(f"Invalid JSON response from Venice API: {str(e)}")

        except asyncio.TimeoutError:
            logger.error("Async request to Venice API timed out")
            raise LLMError("Request timed out")
        except aiohttp.ClientError as e:
            logger.error(f"Connection error when calling Venice API: {str(e)}")
            raise LLMError(f"Connection error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during async Venice API request: {str(e)}")
            raise LLMError(f"Unexpected error: {str(e)}")

def venice_get_model_list(base_url: str, api_key: str) -> dict:
    """
    Get list of available models from Venice AI API.
    
    Args:
        base_url: Base URL for the Venice AI API
        api_key: API key for authentication
        
    Returns:
        Dict containing the model list response
        
    Raises:
        LLMError: For various error conditions
    """
    logger.debug("Fetching model list from Venice AI API")
    try:
        url = f"{base_url}/api/v1/models"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        logger.debug(f"Model list response status: {response.status_code}")
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Error fetching model list: {error_text}")
            raise LLMError(f"Failed to fetch model list: {error_text}")
            
        try:
            response_json = response.json()
            logger.debug(f"Model list response: {json.dumps(response_json, indent=2)}")
            return response_json
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode model list response: {response.text}")
            raise LLMError(f"Invalid JSON response from Venice AI API: {str(e)}")
            
    except requests.exceptions.Timeout:
        logger.error("Request to Venice AI API timed out")
        raise LLMError("Request timed out")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error when calling Venice AI API: {str(e)}")
        raise LLMError(f"Connection error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during Venice AI API request: {str(e)}")
        raise LLMError(f"Unexpected error: {str(e)}") 