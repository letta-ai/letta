from typing import Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LETTA_MODEL_ENDPOINT
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class LettaProvider(Provider):
    provider_type: Literal[ProviderType.letta] = Field(ProviderType.letta, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        return [
            LLMConfig(
                model="letta-free",  # NOTE: renamed
                model_endpoint_type="openai",
                model_endpoint=LETTA_MODEL_ENDPOINT,
                context_window=30000,
                handle=self.get_handle("letta-free"),
                provider_name=self.name,
                provider_category=self.provider_category,
            )
        ]

    async def list_embedding_models_async(self):
        return [
            EmbeddingConfig(
                embedding_model="letta-free",  # NOTE: renamed
                embedding_endpoint_type="openai",
                embedding_endpoint="https://embeddings.letta.com/",
                embedding_dim=1536,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                handle=self.get_handle("letta-free", is_embedding=True),
            )
        ]
