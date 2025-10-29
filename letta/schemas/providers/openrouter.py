from typing import Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

logger = get_logger(__name__)

# ALLOWED_PREFIXES = {"gpt-4", "gpt-5", "o1", "o3", "o4"}
# DISALLOWED_KEYWORDS = {"transcribe", "search", "realtime", "tts", "audio", "computer", "o1-mini", "o1-preview", "o1-pro", "chat"}
# DEFAULT_EMBEDDING_BATCH_SIZE = 1024


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
