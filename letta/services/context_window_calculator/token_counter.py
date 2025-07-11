import hashlib
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List

from letta.helpers.decorators import async_redis_cache
from letta.llm_api.anthropic_client import AnthropicClient
from letta.otel.tracing import trace_method
from letta.schemas.openai.chat_completion_request import Tool as OpenAITool
from letta.utils import count_tokens


class TokenCounter(ABC):
    """Abstract base class for token counting strategies"""

    @abstractmethod
    async def count_text_tokens(self, text: str) -> int:
        """Count tokens in a text string"""

    @abstractmethod
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """Count tokens in a list of messages"""

    @abstractmethod
    async def count_tool_tokens(self, tools: List[Any]) -> int:
        """Count tokens in tool definitions"""

    @abstractmethod
    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        """Convert messages to the appropriate format for this counter"""


class AnthropicTokenCounter(TokenCounter):
    """Token counter using Anthropic's API"""

    def __init__(self, anthropic_client: AnthropicClient, model: str):
        self.client = anthropic_client
        self.model = model

    @trace_method
    @async_redis_cache(
        key_func=lambda self, text: f"anthropic_text_tokens:{self.model}:{hashlib.sha256(text.encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_text_tokens(self, text: str) -> int:
        if not text:
            return 0
        return await self.client.count_tokens(model=self.model, messages=[{"role": "user", "content": text}])

    @trace_method
    @async_redis_cache(
        key_func=lambda self, messages: f"anthropic_message_tokens:{self.model}:{hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        if not messages:
            return 0
        return await self.client.count_tokens(model=self.model, messages=messages)

    @trace_method
    @async_redis_cache(
        key_func=lambda self, tools: f"anthropic_tool_tokens:{self.model}:{hashlib.sha256(json.dumps([t.model_dump() for t in tools], sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_tool_tokens(self, tools: List[OpenAITool]) -> int:
        if not tools:
            return 0
        return await self.client.count_tokens(model=self.model, tools=tools)

    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        return [m.to_anthropic_dict() for m in messages]


class TiktokenCounter(TokenCounter):
    """Token counter using tiktoken"""

    def __init__(self, model: str):
        self.model = model

    @trace_method
    @async_redis_cache(
        key_func=lambda self, text: f"tiktoken_text_tokens:{self.model}:{hashlib.sha256(text.encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_text_tokens(self, text: str) -> int:
        if not text:
            return 0
        return count_tokens(text)

    @trace_method
    @async_redis_cache(
        key_func=lambda self, messages: f"tiktoken_message_tokens:{self.model}:{hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        if not messages:
            return 0
        from letta.local_llm.utils import num_tokens_from_messages

        return num_tokens_from_messages(messages=messages, model=self.model)

    @trace_method
    @async_redis_cache(
        key_func=lambda self, tools: f"tiktoken_tool_tokens:{self.model}:{hashlib.sha256(json.dumps([t.model_dump() for t in tools], sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_tool_tokens(self, tools: List[OpenAITool]) -> int:
        if not tools:
            return 0
        from letta.local_llm.utils import num_tokens_from_functions

        # Extract function definitions from OpenAITool objects
        functions = [t.function.model_dump() for t in tools]
        return num_tokens_from_functions(functions=functions, model=self.model)

    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        return [m.to_openai_dict() for m in messages]
