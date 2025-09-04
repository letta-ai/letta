import os
from typing import List

from openai import AsyncOpenAI

from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.embedding_config import EmbeddingConfig


class OpenAICompatibleClient(OpenAIClient):
    """
    OpenAI-compatible provider that keeps all OpenAI behaviors but allows
    per-embedding API key override via EmbeddingConfig.embedding_api_key.
    """

    def _validate_required_embedding_config(self, embedding_config: EmbeddingConfig) -> None:
        """
        Validate that required fields for openai_compatible embeddings are present.
        Required: embedding_model, embedding_endpoint, embedding_dim (>0)
        Optional: embedding_chunk_size (schema provides default)
        """
        from letta.settings import model_settings

        missing_fields = []
        if not embedding_config.embedding_model:
            missing_fields.append("embedding_model")

        # embedding_endpoint is required only if no embedding base URL is provided via settings/env
        if not (model_settings.openai_embedding_api_base or embedding_config.embedding_endpoint):
            missing_fields.append("embedding_endpoint (or set OPENAI_EMBEDDING_BASE_URL)")
        try:
            dim_valid = isinstance(embedding_config.embedding_dim, int) and embedding_config.embedding_dim > 0
        except Exception:
            dim_valid = False
        if not dim_valid:
            missing_fields.append("embedding_dim")

        if missing_fields:
            raise ValueError(f"Provider 'openai_compatible' requires fields: {', '.join(missing_fields)}")

    def _prepare_client_kwargs_embedding(self, embedding_config: EmbeddingConfig) -> dict:  # type: ignore[override]
        # Validate required fields (chunk size is intentionally optional)
        self._validate_required_embedding_config(embedding_config)

        # Priority (embedding-specific override supported):
        # 1) model_settings.openai_embedding_api_key
        # 2) env OPENAI_EMBEDDING_API_KEY
        # 3) model_settings.openai_api_key
        # 4) env OPENAI_API_KEY
        # 5) DUMMY
        from letta.settings import model_settings

        api_key = (
            model_settings.openai_embedding_api_key
            or os.environ.get("OPENAI_EMBEDDING_API_KEY")
            or model_settings.openai_api_key
            or os.environ.get("OPENAI_API_KEY")
            or "DUMMY_API_KEY"
        )

        # Base URL priority: model_settings.openai_embedding_api_base -> embedding_config.embedding_endpoint
        base_url = model_settings.openai_embedding_api_base or embedding_config.embedding_endpoint
        return {"api_key": api_key, "base_url": base_url}

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:  # type: ignore[override]
        """Request embeddings with per-embedding API key precedence."""
        kwargs = self._prepare_client_kwargs_embedding(embedding_config)
        client = AsyncOpenAI(**kwargs)
        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)
        return [r.embedding for r in response.data]
