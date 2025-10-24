import asyncio
from typing import Literal

from letta.log import get_logger

logger = get_logger(__name__)

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class GoogleAIProvider(Provider):
    provider_type: Literal[ProviderType.google_ai] = Field(ProviderType.google_ai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the Google AI API.")
    base_url: str = "https://generativelanguage.googleapis.com"

    async def check_api_key(self):
        from letta.llm_api.google_ai_client import google_ai_check_valid_api_key

        api_key = self.get_api_key_secret().get_plaintext()
        google_ai_check_valid_api_key(api_key)

    async def list_llm_models_async(self):
        from letta.llm_api.google_ai_client import google_ai_get_model_list_async

        # Get and filter the model list
        api_key = self.get_api_key_secret().get_plaintext()
        model_options = await google_ai_get_model_list_async(base_url=self.base_url, api_key=api_key)
        model_options = [mo for mo in model_options if "generateContent" in mo["supportedGenerationMethods"]]
        model_options = [str(m["name"]) for m in model_options]

        # filter by model names
        model_options = [mo[len("models/") :] if mo.startswith("models/") else mo for mo in model_options]

        # Add support for all gemini models
        model_options = [mo for mo in model_options if str(mo).startswith("gemini-")]

        # Prepare tasks for context window lookups in parallel
        async def create_config(model):
            context_window = await self.get_model_context_window_async(model)
            return LLMConfig(
                model=model,
                model_endpoint_type="google_ai",
                model_endpoint=self.base_url,
                context_window=context_window,
                handle=self.get_handle(model),
                max_tokens=8192,
                provider_name=self.name,
                provider_category=self.provider_category,
            )

        # Execute all config creation tasks concurrently
        configs = await asyncio.gather(*[create_config(model) for model in model_options])

        return configs

    async def list_embedding_models_async(self):
        from letta.llm_api.google_ai_client import google_ai_get_model_list_async

        # TODO: use base_url instead
        api_key = self.get_api_key_secret().get_plaintext()
        model_options = await google_ai_get_model_list_async(base_url=self.base_url, api_key=api_key)
        return self._list_embedding_models(model_options)

    def _list_embedding_models(self, model_options):
        # filter by 'generateContent' models
        model_options = [mo for mo in model_options if "embedContent" in mo["supportedGenerationMethods"]]
        model_options = [str(m["name"]) for m in model_options]
        model_options = [mo[len("models/") :] if mo.startswith("models/") else mo for mo in model_options]

        configs = []
        for model in model_options:
            configs.append(
                EmbeddingConfig(
                    embedding_model=model,
                    embedding_endpoint_type="google_ai",
                    embedding_endpoint=self.base_url,
                    embedding_dim=768,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # NOTE: max is 2048
                    handle=self.get_handle(model, is_embedding=True),
                    batch_size=1024,
                )
            )
        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        import warnings

        logger.warning("This is deprecated, use get_model_context_window_async when possible.")
        from letta.llm_api.google_ai_client import google_ai_get_model_context_window

        if model_name in LLM_MAX_TOKENS:
            return LLM_MAX_TOKENS[model_name]
        else:
            api_key = self.get_api_key_secret().get_plaintext()
            return google_ai_get_model_context_window(self.base_url, api_key, model_name)

    async def get_model_context_window_async(self, model_name: str) -> int | None:
        from letta.llm_api.google_ai_client import google_ai_get_model_context_window_async

        if model_name in LLM_MAX_TOKENS:
            return LLM_MAX_TOKENS[model_name]
        else:
            api_key = self.get_api_key_secret().get_plaintext()
            return await google_ai_get_model_context_window_async(self.base_url, api_key, model_name)
