from typing import Literal

from letta.log import get_logger

logger = get_logger(__name__)

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


class LMStudioOpenAIProvider(OpenAIProvider):
    provider_type: Literal[ProviderType.lmstudio_openai] = Field(ProviderType.lmstudio_openai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field(..., description="Base URL for the LMStudio OpenAI API.")
    api_key: str | None = Field(None, description="API key for the LMStudio API.")

    @property
    def model_endpoint_url(self):
        # For LMStudio, we want to hit 'GET /api/v0/models' instead of 'GET /v1/models'
        return f"{self.base_url.strip('/v1')}/api/v0"

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.model_endpoint_url)

        if "data" not in response:
            logger.warning(f"LMStudio OpenAI model query response missing 'data' field: {response}")
            return []

        configs = []
        for model in response["data"]:
            model_type = model.get("type")
            if not model_type:
                logger.warning(f"LMStudio OpenAI model missing 'type' field: {model}")
                continue
            if model_type not in ("vlm", "llm"):
                continue

            # TODO (cliandy): previously we didn't get the backup context size, is this valid?
            check = self._do_model_checks_for_name_and_context_size(model)
            if check is None:
                continue
            model_name, context_window_size = check

            if "compatibility_type" in model:
                compatibility_type = model["compatibility_type"]
            else:
                logger.warning(f"LMStudio OpenAI model missing 'compatibility_type' field: {model}")
                continue

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="openai",
                    model_endpoint=self.model_endpoint_url,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    compatibility_type=compatibility_type,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.model_endpoint_url)

        if "data" not in response:
            logger.warning(f"LMStudio OpenAI model query response missing 'data' field: {response}")
            return []

        configs = []
        for model in response["data"]:
            model_type = model.get("type")
            if not model_type:
                logger.warning(f"LMStudio OpenAI model missing 'type' field: {model}")
                continue
            if model_type not in ("embeddings"):
                continue

            # TODO (cliandy): previously we didn't get the backup context size, is this valid?
            check = self._do_model_checks_for_name_and_context_size(model, length_key="max_context_length")
            if check is None:
                continue
            model_name, context_window_size = check

            configs.append(
                EmbeddingConfig(
                    embedding_model=model_name,
                    embedding_endpoint_type="openai",
                    embedding_endpoint=self.model_endpoint_url,
                    embedding_dim=768,  # Default embedding dimension, not context window
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # NOTE: max is 2048
                    handle=self.get_handle(model_name),
                ),
            )

        return configs
