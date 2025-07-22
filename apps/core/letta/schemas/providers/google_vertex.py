from typing import Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


# TODO (cliandy): GoogleVertexProvider uses hardcoded models vs Gemini fetches from API
class GoogleVertexProvider(Provider):
    provider_type: Literal[ProviderType.google_vertex] = Field(ProviderType.google_vertex, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    google_cloud_project: str = Field(..., description="GCP project ID for the Google Vertex API.")
    google_cloud_location: str = Field(..., description="GCP region for the Google Vertex API.")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.google_constants import GOOGLE_MODEL_TO_CONTEXT_LENGTH

        configs = []
        for model, context_length in GOOGLE_MODEL_TO_CONTEXT_LENGTH.items():
            configs.append(
                LLMConfig(
                    model=model,
                    model_endpoint_type="google_vertex",
                    model_endpoint=f"https://{self.google_cloud_location}-aiplatform.googleapis.com/v1/projects/{self.google_cloud_project}/locations/{self.google_cloud_location}",
                    context_window=context_length,
                    handle=self.get_handle(model),
                    max_tokens=8192,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        from letta.llm_api.google_constants import GOOGLE_EMBEDING_MODEL_TO_DIM

        configs = []
        for model, dim in GOOGLE_EMBEDING_MODEL_TO_DIM.items():
            configs.append(
                EmbeddingConfig(
                    embedding_model=model,
                    embedding_endpoint_type="google_vertex",
                    embedding_endpoint=f"https://{self.google_cloud_location}-aiplatform.googleapis.com/v1/projects/{self.google_cloud_project}/locations/{self.google_cloud_location}",
                    embedding_dim=dim,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # NOTE: max is 2048
                    handle=self.get_handle(model, is_embedding=True),
                    batch_size=1024,
                )
            )
        return configs
