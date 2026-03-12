from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.helpers.json_helpers import sanitize_unicode_surrogates
from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.settings import model_settings


def is_zai_reasoning_model(model_name: str) -> bool:
    """Check if the model is a ZAI reasoning model (GLM-4.5+)."""
    return (
        model_name.startswith("glm-4.5")
        or model_name.startswith("glm-4.6")
        or model_name.startswith("glm-4.7")
        or model_name.startswith("glm-5")
    )


class ZAIClient(OpenAIClient):
    """Z.ai (ZhipuAI) client - uses OpenAI-compatible API."""

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return False

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        """Returns True if the model is a ZAI reasoning model (GLM-4.5+)."""
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
    ) -> dict:
        data = super().build_request_data(agent_type, messages, llm_config, tools, force_tool_call, requires_subsequent_tool_call)

        # Add thinking configuration for ZAI GLM-4.5+ models
        # Must explicitly send type: "disabled" when reasoning is off, as GLM-4.7 has thinking on by default
        if self.is_reasoning_model(llm_config):
            if llm_config.enable_reasoner:
                data["extra_body"] = {
                    "thinking": {
                        "type": "enabled",
                        "clear_thinking": False,  # Preserved thinking for agents
                    }
                }
            else:
                data["extra_body"] = {
                    "thinking": {
                        "type": "disabled",
                    }
                }

        # Z.ai's API uses max_tokens, not max_completion_tokens.
        # If max_completion_tokens is sent, Z.ai ignores it and falls back to its
        # default of 65536, silently truncating input to ~137K of the 200K context window.
        if "max_completion_tokens" in data:
            data["max_tokens"] = data.pop("max_completion_tokens")

        # Sanitize empty text content — ZAI rejects empty text blocks
        if "messages" in data:
            for msg in data["messages"]:
                content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", None)
                # String content: replace empty with None (assistant+tool_calls) or "."
                if isinstance(content, str) and not content.strip():
                    role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", None)
                    has_tool_calls = msg.get("tool_calls") if isinstance(msg, dict) else getattr(msg, "tool_calls", None)
                    if role == "assistant" and has_tool_calls:
                        # assistant + tool_calls: null content is valid in OpenAI format
                        if isinstance(msg, dict):
                            msg["content"] = None
                        else:
                            msg.content = None
                    else:
                        if isinstance(msg, dict):
                            msg["content"] = "."
                        else:
                            msg.content = "."
                # List content: fix empty text blocks within arrays
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            if not block.get("text", "").strip():
                                block["text"] = "."

        return data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to Z.ai API and returns raw response dict.
        """
        api_key = model_settings.zai_api_key
        client = OpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to Z.ai API and returns raw response dict.
        """
        request_data = sanitize_unicode_surrogates(request_data)

        api_key = model_settings.zai_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying asynchronous streaming request to Z.ai and returns the async stream iterator.
        """
        request_data = sanitize_unicode_surrogates(request_data)

        api_key = model_settings.zai_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)
        response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
            **request_data, stream=True, stream_options={"include_usage": True}
        )
        return response_stream

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config"""
        api_key = model_settings.zai_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=embedding_config.embedding_endpoint)
        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)

        return [r.embedding for r in response.data]

    @trace_method
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Converts raw ZAI response dict into the ChatCompletionResponse Pydantic model.
        Handles extraction of reasoning_content from ZAI GLM-4.5+ responses.
        """
        # Use parent class conversion first
        chat_completion_response = await super().convert_response_to_chat_completion(response_data, input_messages, llm_config)

        # Parse reasoning_content from ZAI responses (similar to OpenAI pattern)
        # ZAI returns reasoning_content in delta.reasoning_content (streaming) or message.reasoning_content
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

        # If we used a reasoning model, mark that reasoning content was used
        if self.is_reasoning_model(llm_config) and llm_config.enable_reasoner:
            chat_completion_response.choices[0].message.omitted_reasoning_content = True

        return chat_completion_response
