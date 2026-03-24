from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.helpers.json_helpers import sanitize_unicode_surrogates
from letta.llm_api.openai_client import OpenAIClient
from letta.llm_api.zai_client import is_zai_reasoning_model
from letta.otel.tracing import trace_method
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.settings import model_settings


class FireworksClient(OpenAIClient):
    """Fireworks AI client — serves GLM-5 via OpenAI-compatible API."""

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return False

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return is_zai_reasoning_model(llm_config.model)

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
        system: Optional[str] = None,
    ) -> dict:
        data = super().build_request_data(
            agent_type,
            messages,
            llm_config,
            tools,
            force_tool_call,
            requires_subsequent_tool_call,
            tool_return_truncation_chars,
            system,
        )

        # Add thinking configuration for reasoning models
        if self.is_reasoning_model(llm_config):
            if llm_config.enable_reasoner:
                data["extra_body"] = {
                    "thinking": {
                        "type": "enabled",
                        "clear_thinking": False,
                    }
                }
            else:
                data["extra_body"] = {
                    "thinking": {
                        "type": "disabled",
                    }
                }

        # Fireworks (like Z.ai) uses max_tokens, not max_completion_tokens
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

        # Fireworks uses strict validation (additionalProperties: false) and rejects
        # reasoning fields that are not in their schema.
        if "messages" in data:
            for msg in data["messages"]:
                for field in ("reasoning_content_signature", "redacted_reasoning_content", "omitted_reasoning_content"):
                    msg.pop(field, None)

        return data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        api_key = model_settings.fireworks_api_key
        client = OpenAI(api_key=api_key, base_url=llm_config.model_endpoint)
        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        request_data = sanitize_unicode_surrogates(request_data)
        api_key = model_settings.fireworks_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)
        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        request_data = sanitize_unicode_surrogates(request_data)
        api_key = model_settings.fireworks_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)
        response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
            **request_data, stream=True, stream_options={"include_usage": True}
        )
        return response_stream

    @trace_method
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        chat_completion_response = await super().convert_response_to_chat_completion(response_data, input_messages, llm_config)

        # Handle reasoning_content from response
        if (
            chat_completion_response.choices
            and len(chat_completion_response.choices) > 0
            and chat_completion_response.choices[0].message
            and not chat_completion_response.choices[0].message.reasoning_content
        ):
            if "choices" in response_data and len(response_data["choices"]) > 0:
                choice_data = response_data["choices"][0]
                if "message" in choice_data and "reasoning_content" in choice_data["message"]:
                    reasoning_content = choice_data["message"]["reasoning_content"]
                    if reasoning_content:
                        chat_completion_response.choices[0].message.reasoning_content = reasoning_content
                        chat_completion_response.choices[0].message.reasoning_content_signature = None

        if self.is_reasoning_model(llm_config) and llm_config.enable_reasoner:
            chat_completion_response.choices[0].message.omitted_reasoning_content = True

        return chat_completion_response
