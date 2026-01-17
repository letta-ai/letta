import os
from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.settings import model_settings


class ZAIClient(OpenAIClient):
    """Z.ai (ZhipuAI) client - uses OpenAI-compatible API."""

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return False

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
        api_key = model_settings.zai_api_key
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying asynchronous streaming request to Z.ai and returns the async stream iterator.
        """
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
