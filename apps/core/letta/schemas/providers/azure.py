from typing import ClassVar, Literal

from pydantic import Field, field_validator

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.llm_api.azure_openai import get_azure_chat_completions_endpoint, get_azure_embeddings_endpoint
from letta.llm_api.azure_openai_constants import AZURE_MODEL_TO_CONTEXT_LENGTH
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class AzureProvider(Provider):
    LATEST_API_VERSION: ClassVar[str] = "2024-09-01-preview"

    provider_type: Literal[ProviderType.azure] = Field(ProviderType.azure, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    # Note: 2024-09-01-preview was set here until 2025-07-16.
    # set manually, see: https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation
    latest_api_version: str = "2025-04-01-preview"
    base_url: str = Field(
        ..., description="Base URL for the Azure API endpoint. This should be specific to your org, e.g. `https://letta.openai.azure.com`."
    )
    api_key: str = Field(..., description="API key for the Azure API.")
    api_version: str = Field(default=LATEST_API_VERSION, description="API version for the Azure API")

    @field_validator("api_version", mode="before")
    def replace_none_with_default(cls, v):
        return v if v is not None else cls.LATEST_API_VERSION

    async def list_llm_models_async(self) -> list[LLMConfig]:
        # TODO (cliandy): asyncify
        from letta.llm_api.azure_openai import azure_openai_get_chat_completion_model_list

        model_options = azure_openai_get_chat_completion_model_list(self.base_url, api_key=self.api_key, api_version=self.api_version)
        configs = []
        for model_option in model_options:
            model_name = model_option["id"]
            context_window_size = self.get_model_context_window(model_name)
            model_endpoint = get_azure_chat_completions_endpoint(self.base_url, model_name, self.api_version)
            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="azure",
                    model_endpoint=model_endpoint,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        # TODO (cliandy): asyncify dependent function calls
        from letta.llm_api.azure_openai import azure_openai_get_embeddings_model_list

        model_options = azure_openai_get_embeddings_model_list(self.base_url, api_key=self.api_key, api_version=self.api_version)
        configs = []
        for model_option in model_options:
            model_name = model_option["id"]
            model_endpoint = get_azure_embeddings_endpoint(self.base_url, model_name, self.api_version)
            configs.append(
                EmbeddingConfig(
                    embedding_model=model_name,
                    embedding_endpoint_type="azure",
                    embedding_endpoint=model_endpoint,
                    embedding_dim=768,  # TODO generated 1536?
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # old note: max is 2048
                    handle=self.get_handle(model_name, is_embedding=True),
                    batch_size=1024,
                )
            )
        return configs

    def get_model_context_window(self, model_name: str) -> int | None:
        # Hard coded as there are no API endpoints for this
        llm_default = LLM_MAX_TOKENS.get(model_name, 4096)
        return AZURE_MODEL_TO_CONTEXT_LENGTH.get(model_name, llm_default)
