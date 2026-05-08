import json
import os
from typing import List, Optional, Tuple

from openai import AsyncAzureOpenAI, AsyncOpenAI, AsyncStream, AzureOpenAI, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk
from openai.types.responses.response_stream_event import ResponseStreamEvent

from letta.helpers.json_helpers import sanitize_unicode_surrogates
from letta.llm_api.openai_client import OpenAIClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.settings import model_settings

logger = get_logger(__name__)


class AzureClient(OpenAIClient):
    @staticmethod
    def _is_v1_endpoint(base_url: str) -> bool:
        if not base_url:
            return False
        return base_url.rstrip("/").endswith("/openai/v1")

    def get_byok_overrides(self, llm_config: LLMConfig) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        if llm_config.provider_category == ProviderCategory.byok:
            from letta.services.provider_manager import ProviderManager

            return ProviderManager().get_azure_credentials(llm_config.provider_name, actor=self.actor)

        return None, None, None

    async def get_byok_overrides_async(self, llm_config: LLMConfig) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        if llm_config.provider_category == ProviderCategory.byok:
            from letta.services.provider_manager import ProviderManager

            return await ProviderManager().get_azure_credentials_async(llm_config.provider_name, actor=self.actor)

        return None, None, None

    def _resolve_credentials(self, api_key, base_url, api_version):
        """Resolve credentials, falling back to env vars. For v1 endpoints, api_version is not required."""
        if not api_key:
            api_key = model_settings.azure_api_key or os.environ.get("AZURE_API_KEY")
        if not base_url:
            base_url = model_settings.azure_base_url or os.environ.get("AZURE_BASE_URL")
        if not api_version and not self._is_v1_endpoint(base_url):
            api_version = model_settings.azure_api_version or os.environ.get("AZURE_API_VERSION")
        return api_key, base_url, api_version

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        api_key, base_url, api_version = self.get_byok_overrides(llm_config)
        api_key, base_url, api_version = self._resolve_credentials(api_key, base_url, api_version)

        if self._is_v1_endpoint(base_url):
            client = OpenAI(api_key=api_key, base_url=base_url)
        else:
            client = AzureOpenAI(api_key=api_key, azure_endpoint=base_url, api_version=api_version)

        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if "input" in request_data and "messages" not in request_data:
            resp = client.responses.create(**request_data)
            return resp.model_dump()
        else:
            response: ChatCompletion = client.chat.completions.create(**request_data)
            return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        request_data = sanitize_unicode_surrogates(request_data)

        api_key, base_url, api_version = await self.get_byok_overrides_async(llm_config)
        api_key, base_url, api_version = self._resolve_credentials(api_key, base_url, api_version)

        try:
            if self._is_v1_endpoint(base_url):
                client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            else:
                client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=base_url, api_version=api_version)

            # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
            if "input" in request_data and "messages" not in request_data:
                resp = await client.responses.create(**request_data)
                return resp.model_dump()
            else:
                response: ChatCompletion = await client.chat.completions.create(**request_data)
                return response.model_dump()
        except Exception as e:
            raise self.handle_llm_error(e, llm_config=llm_config)

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk | ResponseStreamEvent]:
        """
        Performs underlying asynchronous streaming request to Azure/OpenAI and returns the async stream iterator.
        """
        request_data = sanitize_unicode_surrogates(request_data)

        api_key, base_url, api_version = await self.get_byok_overrides_async(llm_config)
        api_key, base_url, api_version = self._resolve_credentials(api_key, base_url, api_version)

        if self._is_v1_endpoint(base_url):
            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        else:
            client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=base_url, api_version=api_version)

        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if "input" in request_data and "messages" not in request_data:
            try:
                response_stream: AsyncStream[ResponseStreamEvent] = await client.responses.create(
                    **request_data,
                    stream=True,
                )
            except Exception as e:
                logger.error(f"Error streaming Azure Responses request: {e} with request data: {json.dumps(request_data)}")
                raise e
        else:
            try:
                response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
                    **request_data,
                    stream=True,
                    stream_options={"include_usage": True},
                )
            except Exception as e:
                logger.error(f"Error streaming Azure Chat Completions request: {e} with request data: {json.dumps(request_data)}")
                raise e
        return response_stream

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config"""
        api_key = model_settings.azure_api_key or os.environ.get("AZURE_API_KEY")
        base_url = model_settings.azure_base_url or os.environ.get("AZURE_BASE_URL")
        api_version = model_settings.azure_api_version or os.environ.get("AZURE_API_VERSION")

        if self._is_v1_endpoint(base_url):
            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        else:
            client = AsyncAzureOpenAI(api_key=api_key, api_version=api_version, azure_endpoint=base_url)

        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)

        # TODO: add total usage
        return [r.embedding for r in response.data]
