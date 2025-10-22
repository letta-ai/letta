"""VoyageAI provider for text, contextual, and multimodal embeddings."""

from typing import List, Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class VoyageAIProvider(Provider):
    """VoyageAI provider with support for text, contextual, and multimodal embeddings."""

    provider_type: Literal[ProviderType.voyageai] = Field(ProviderType.voyageai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    name: str = "voyageai"
    api_key: str = Field(..., description="API key for the VoyageAI API.")
    base_url: str = "https://api.voyageai.com/v1"

    def list_llm_models(self) -> List[LLMConfig]:
        """VoyageAI doesn't provide LLM models, only embeddings."""
        return []

    def list_embedding_models(self) -> List[EmbeddingConfig]:
        """
        List available VoyageAI embedding models.

        Returns hardcoded list of models since VoyageAI doesn't provide a GET /models endpoint.
        Includes text, contextual, and multimodal models.
        """
        # Format: (model_name, embedding_dim)
        # Note: All VoyageAI models accept max 1000 texts per request
        # Token limits per batch are handled in the batching logic (voyageai_embedder.py)
        voyageai_model_config = [
            # Text embedding models
            ("voyage-3-large", 1024),
            ("voyage-3.5", 1024),
            ("voyage-3.5-lite", 512),
            ("voyage-3", 1024),
            ("voyage-3-lite", 512),
            ("voyage-code-3", 1024),
            ("voyage-finance-2", 1024),
            ("voyage-law-2", 1024),
            ("voyage-code-2", 1536),
            ("voyage-2", 1024),
            ("voyage-large-2", 1536),
            ("voyage-large-2-instruct", 1024),
            ("voyage-multilingual-2", 1024),
            # Contextual embedding models
            ("voyage-context-3", 1024),
            # Multimodal embedding models
            ("voyage-multimodal-3", 1024),
        ]
        return [
            EmbeddingConfig(
                embedding_model=model[0],
                embedding_endpoint_type="voyageai",
                embedding_endpoint=self.base_url,
                embedding_dim=model[1],
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,  # Standard chunk size for document splitting
                handle=self.get_handle(model[0], True),
                batch_size=1000,  # VoyageAI API constraint: max 1000 texts per request (all models)
            )
            for model in voyageai_model_config
        ]
