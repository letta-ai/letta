from typing import Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import DEFAULT_EMBEDDING_BATCH_SIZE, OpenAIProvider

logger = get_logger(__name__)


class OpenRouterProvider(OpenAIProvider):
    provider_type: Literal[ProviderType.openai] = Field(ProviderType.openai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the OpenRouter API.")
    base_url: str = Field("https://openrouter.ai/api/v1", description="Base URL for the OpenRouter API.")

    def _list_llm_models(self, data: list[dict]) -> list[LLMConfig]:
        """
        This handles filtering out LLM Models by provider that meet Letta's requirements.
        """
        configs = []
        for model in data:
            check = self._do_model_checks_for_name_and_context_size(model)
            if check is None:
                continue
            model_name, context_window_size = check

            handle = self.get_handle(model_name)

            config = LLMConfig(
                model=model_name,
                model_endpoint_type="openai",
                model_endpoint=self.base_url,
                context_window=context_window_size,
                handle=handle,
                provider_name=self.name,
                provider_category=self.provider_category,
            )

            config = self._set_model_parameter_tuned_defaults(model_name, config)
            configs.append(config)

        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        """
        Return hardcoded OpenRouter embedding models.

        OpenRouter's /models endpoint doesn't list embedding models,
        but they support OpenAI's embedding models via the /embeddings endpoint.
        """
        return [
            EmbeddingConfig(
                embedding_model="openai/text-embedding-3-small",
                embedding_endpoint_type="openai",
                embedding_endpoint=self.base_url,
                embedding_dim=1536,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                handle=self.get_handle("openai/text-embedding-3-small", is_embedding=True),
                batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
            ),
            EmbeddingConfig(
                embedding_model="openai/text-embedding-3-large",
                embedding_endpoint_type="openai",
                embedding_endpoint=self.base_url,
                embedding_dim=3072,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                handle=self.get_handle("openai/text-embedding-3-large", is_embedding=True),
                batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
            ),
        ]
