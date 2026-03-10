from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.helpers.json_helpers import sanitize_unicode_surrogates
from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.settings import model_settings


def _build_base_url(model_endpoint: str) -> str:
    """Build the Baseten endpoint URL.

    For custom deployments, model_endpoint is a model ID (e.g. '3m5zok9w').
    For serverless, model_endpoint is a full URL (e.g. 'https://inference.baseten.co/v1').
    """
    if model_endpoint.startswith("https://"):
        return model_endpoint
    return f"https://model-{model_endpoint}.api.baseten.co/environments/production/sync/v1"


class BasetenClient(OpenAIClient):
    """Baseten client — serves models via OpenAI-compatible Engine-Builder API."""

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return True  # hardcode for now

    @trace_method
    def build_request_data(
        self,
        agent_type: AgentType,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict:
        data = super().build_request_data(agent_type, messages, llm_config, tools, force_tool_call, requires_subsequent_tool_call)

        # model field is passed through from llm_config.model

        # Baseten uses max_tokens, not max_completion_tokens
        if "max_completion_tokens" in data:
            data["max_tokens"] = data.pop("max_completion_tokens")

        # Sanitize empty text content — rejects empty text blocks
        if "messages" in data:
            for msg in data["messages"]:
                content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", None)
                if isinstance(content, str) and not content.strip():
                    role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", None)
                    has_tool_calls = msg.get("tool_calls") if isinstance(msg, dict) else getattr(msg, "tool_calls", None)
                    if role == "assistant" and has_tool_calls:
                        if isinstance(msg, dict):
                            msg["content"] = None
                        else:
                            msg.content = None
                    else:
                        if isinstance(msg, dict):
                            msg["content"] = "."
                        else:
                            msg.content = "."
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            if not block.get("text", "").strip():
                                block["text"] = "."

        # Strip reasoning fields that are not in the Baseten schema
        if "messages" in data:
            for msg in data["messages"]:
                for field in ("reasoning_content_signature", "redacted_reasoning_content", "omitted_reasoning_content"):
                    msg.pop(field, None)

        # Special tokens are used as turn delimiters; stop generation before the model
        # starts predicting the next turn (prevents "<|user|>" leaking into responses)
        data["stop"] = ["<|user|>", "<|assistant|>", "<|observation|>"]

        return data

    def _build_client_kwargs(self, llm_config: LLMConfig) -> dict:
        """Build OpenAI client kwargs for Baseten.

        Custom deployments use Api-Key header auth.
        Serverless uses standard Bearer token auth.
        """
        api_key = model_settings.baseten_api_key
        base_url = _build_base_url(llm_config.model_endpoint)
        is_serverless = llm_config.model_endpoint.startswith("https://")

        if is_serverless:
            return {"api_key": api_key, "base_url": base_url}
        return {"api_key": "unused", "base_url": base_url, "default_headers": {"Authorization": f"Api-Key {api_key}"}}

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        client = OpenAI(**self._build_client_kwargs(llm_config))
        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        request_data = sanitize_unicode_surrogates(request_data)
        client = AsyncOpenAI(**self._build_client_kwargs(llm_config))
        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        request_data = sanitize_unicode_surrogates(request_data)
        client = AsyncOpenAI(**self._build_client_kwargs(llm_config))
        response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
            **request_data, stream=True, stream_options={"include_usage": True}
        )
        return response_stream
