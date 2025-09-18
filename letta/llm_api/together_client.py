import os
from typing import List

from openai import AsyncOpenAI, OpenAI
from openai.types.chat.chat_completion import ChatCompletion

from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.settings import model_settings


class TogetherClient(OpenAIClient):
    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return True

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        api_key, _, _ = self.get_byok_overrides(llm_config)

        if not api_key:
            api_key = model_settings.together_api_key or os.environ.get("TOGETHER_API_KEY")
        client = OpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        api_key, _, _ = await self.get_byok_overrides_async(llm_config)

        if not api_key:
            api_key = model_settings.together_api_key or os.environ.get("TOGETHER_API_KEY")
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config"""
        api_key = model_settings.together_api_key or os.environ.get("TOGETHER_API_KEY")
        client = AsyncOpenAI(api_key=api_key, base_url=embedding_config.embedding_endpoint)
        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)

        # TODO: add total usage
        return [r.embedding for r in response.data]
