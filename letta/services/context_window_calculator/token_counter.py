import hashlib
import json
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from letta.helpers.decorators import async_redis_cache
from letta.llm_api.anthropic_client import AnthropicClient
from letta.llm_api.google_vertex_client import GoogleVertexClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import ProviderType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_request import Tool as OpenAITool

if TYPE_CHECKING:
    from letta.schemas.llm_config import LLMConfig
    from letta.schemas.user import User

logger = get_logger(__name__)


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
        key_func=lambda self,
        messages: f"anthropic_message_tokens:{self.model}:{hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        if not messages:
            return 0
        return await self.client.count_tokens(model=self.model, messages=messages)

    @trace_method
    @async_redis_cache(
        key_func=lambda self,
        tools: f"anthropic_tool_tokens:{self.model}:{hashlib.sha256(json.dumps([t.model_dump() for t in tools], sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_tool_tokens(self, tools: List[OpenAITool]) -> int:
        if not tools:
            return 0
        return await self.client.count_tokens(model=self.model, tools=tools)

    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        return Message.to_anthropic_dicts_from_list(messages, current_model=self.model)


class ApproxTokenCounter(TokenCounter):
    """Fast approximate token counter using byte-based heuristic (bytes / 4).

    This is the same approach codex-cli uses - a simple approximation that assumes
    ~4 bytes per token on average for English text. Much faster than tiktoken
    and doesn't require loading tokenizer models into memory.

    Just serializes the input to JSON and divides byte length by 4.
    """

    APPROX_BYTES_PER_TOKEN = 4

    def __init__(self, model: str | None = None):
        # Model is optional since we don't actually use a tokenizer
        self.model = model

    def _approx_token_count(self, text: str) -> int:
        """Approximate token count: ceil(byte_len / 4)"""
        if not text:
            return 0
        byte_len = len(text.encode("utf-8"))
        return (byte_len + self.APPROX_BYTES_PER_TOKEN - 1) // self.APPROX_BYTES_PER_TOKEN

    async def count_text_tokens(self, text: str) -> int:
        if not text:
            return 0
        return self._approx_token_count(text)

    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        if not messages:
            return 0
        return self._approx_token_count(json.dumps(messages))

    async def count_tool_tokens(self, tools: List[OpenAITool]) -> int:
        if not tools:
            return 0
        functions = [t.model_dump() for t in tools]
        return self._approx_token_count(json.dumps(functions))

    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        return Message.to_openai_dicts_from_list(messages)


class GeminiTokenCounter(TokenCounter):
    """Token counter using Google's Gemini token counting API"""

    def __init__(self, gemini_client: GoogleVertexClient, model: str):
        self.client = gemini_client
        self.model = model

    @trace_method
    @async_redis_cache(
        key_func=lambda self, text: f"gemini_text_tokens:{self.model}:{hashlib.sha256(text.encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_text_tokens(self, text: str) -> int:
        if not text:
            return 0
        # For text counting, wrap in a simple user message format for Google
        return await self.client.count_tokens(model=self.model, messages=[{"role": "user", "parts": [{"text": text}]}])

    @trace_method
    @async_redis_cache(
        key_func=lambda self,
        messages: f"gemini_message_tokens:{self.model}:{hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        if not messages:
            return 0
        return await self.client.count_tokens(model=self.model, messages=messages)

    @trace_method
    @async_redis_cache(
        key_func=lambda self,
        tools: f"gemini_tool_tokens:{self.model}:{hashlib.sha256(json.dumps([t.model_dump() for t in tools], sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_tool_tokens(self, tools: List[OpenAITool]) -> int:
        if not tools:
            return 0
        return await self.client.count_tokens(model=self.model, tools=tools)

    def convert_messages(self, messages: List[Any]) -> List[Dict[str, Any]]:
        google_messages = Message.to_google_dicts_from_list(messages, current_model=self.model)
        return google_messages


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
        from letta.log import get_logger

        logger = get_logger(__name__)

        if not text:
            return 0

        text_length = len(text)
        text_preview = text[:100] + "..." if len(text) > 100 else text
        logger.debug(f"TiktokenCounter.count_text_tokens: model={self.model}, text_length={text_length}, preview={repr(text_preview)}")

        try:
            import tiktoken

            try:
                encoding = tiktoken.encoding_for_model(self.model)
            except KeyError:
                logger.debug(f"Model {self.model} not found in tiktoken. Using cl100k_base encoding.")
                encoding = tiktoken.get_encoding("cl100k_base")
            result = len(encoding.encode(text))
            logger.debug(f"TiktokenCounter.count_text_tokens: completed successfully, tokens={result}")
            return result
        except Exception as e:
            logger.error(f"TiktokenCounter.count_text_tokens: FAILED with {type(e).__name__}: {e}, text_length={text_length}")
            raise

    @trace_method
    @async_redis_cache(
        key_func=lambda self,
        messages: f"tiktoken_message_tokens:{self.model}:{hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()[:16]}",
        prefix="token_counter",
        ttl_s=3600,  # cache for 1 hour
    )
    async def count_message_tokens(self, messages: List[Dict[str, Any]]) -> int:
        from letta.log import get_logger

        logger = get_logger(__name__)

        if not messages:
            return 0

        num_messages = len(messages)
        total_content_length = sum(len(str(m.get("content", ""))) for m in messages)
        logger.debug(
            f"TiktokenCounter.count_message_tokens: model={self.model}, num_messages={num_messages}, total_content_length={total_content_length}"
        )

        try:
            from letta.local_llm.utils import num_tokens_from_messages

            result = num_tokens_from_messages(messages=messages, model=self.model)
            logger.debug(f"TiktokenCounter.count_message_tokens: completed successfully, tokens={result}")
            return result
        except Exception as e:
            logger.error(f"TiktokenCounter.count_message_tokens: FAILED with {type(e).__name__}: {e}, num_messages={num_messages}")
            raise

    @trace_method
    @async_redis_cache(
        key_func=lambda self,
        tools: f"tiktoken_tool_tokens:{self.model}:{hashlib.sha256(json.dumps([t.model_dump() for t in tools], sort_keys=True).encode()).hexdigest()[:16]}",
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
        return Message.to_openai_dicts_from_list(messages)


def create_token_counter(
    model_endpoint_type: ProviderType,
    model: Optional[str] = None,
    actor: "User" = None,
    agent_id: Optional[str] = None,
) -> "TokenCounter":
    """
    Factory function to create the appropriate token counter based on model configuration.

    Returns:
        The appropriate TokenCounter instance
    """
    from letta.llm_api.llm_client import LLMClient
    from letta.settings import model_settings, settings

    # Use Gemini token counter for Google Vertex and Google AI
    use_gemini = model_endpoint_type in ("google_vertex", "google_ai")

    # Use Anthropic token counter if:
    # 1. The model endpoint type is anthropic, OR
    # 2. We're in PRODUCTION and anthropic_api_key is available (and not using Gemini)
    use_anthropic = model_endpoint_type == "anthropic"

    if use_gemini:
        client = LLMClient.create(provider_type=model_endpoint_type, actor=actor)
        token_counter = GeminiTokenCounter(client, model)
        logger.debug(
            f"Using GeminiTokenCounter for agent_id={agent_id}, model={model}, "
            f"model_endpoint_type={model_endpoint_type}, "
            f"environment={settings.environment}"
        )
    elif use_anthropic:
        anthropic_client = LLMClient.create(provider_type=ProviderType.anthropic, actor=actor)
        counter_model = model if model_endpoint_type == "anthropic" else None
        token_counter = AnthropicTokenCounter(anthropic_client, counter_model)
        logger.debug(
            f"Using AnthropicTokenCounter for agent_id={agent_id}, model={counter_model}, "
            f"model_endpoint_type={model_endpoint_type}, "
            f"environment={settings.environment}"
        )
    else:
        token_counter = ApproxTokenCounter()
        logger.debug(
            f"Using ApproxTokenCounter for agent_id={agent_id}, model={model}, "
            f"model_endpoint_type={model_endpoint_type}, "
            f"environment={settings.environment}"
        )

    return token_counter
