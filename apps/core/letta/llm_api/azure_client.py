import os
from typing import List

from openai import AsyncAzureOpenAI, AzureOpenAI
from openai.types.chat.chat_completion import ChatCompletion

from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.settings import model_settings


class AzureClient(OpenAIClient):

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        api_key = model_settings.azure_api_key or os.environ.get("AZURE_API_KEY")
        base_url = model_settings.azure_base_url or os.environ.get("AZURE_BASE_URL")
        api_version = model_settings.azure_api_version or os.environ.get("AZURE_API_VERSION")
        client = AzureOpenAI(api_key=api_key, azure_endpoint=base_url, api_version=api_version)

        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        api_key = model_settings.azure_api_key or os.environ.get("AZURE_API_KEY")
        base_url = model_settings.azure_base_url or os.environ.get("AZURE_BASE_URL")
        api_version = model_settings.azure_api_version or os.environ.get("AZURE_API_VERSION")
        client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=base_url, api_version=api_version)

        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config"""
        api_key = model_settings.azure_api_key or os.environ.get("AZURE_API_KEY")
        base_url = model_settings.azure_base_url or os.environ.get("AZURE_BASE_URL")
        api_version = model_settings.azure_api_version or os.environ.get("AZURE_API_VERSION")
        client = AsyncAzureOpenAI(api_key=api_key, api_version=api_version, azure_endpoint=base_url)
        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)

        # TODO: add total usage
        return [r.embedding for r in response.data]
