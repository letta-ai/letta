"""
Note: this supports completions (deprecated by openai) and chat completions via the OpenAI API.
"""

from typing import Literal, Optional

from pydantic import Field

from letta.constants import MIN_CONTEXT_WINDOW
from letta.errors import ErrorCode, LLMAuthenticationError
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


class TogetherProvider(OpenAIProvider):
    provider_type: Literal[ProviderType.together] = Field(ProviderType.together, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = "https://api.together.xyz/v1"
    api_key: str = Field(..., description="API key for the Together API.")
    default_prompt_formatter: Optional[str] = Field(
        None, description="Default prompt formatter (aka model wrapper) to use on vLLM /completions API."
    )

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        models = await openai_get_model_list_async(self.base_url, api_key=self.api_key)
        return self._list_llm_models(models)

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        import warnings

        warnings.warn(
            "Letta does not currently support listing embedding models for Together. Please "
            "contact support or reach out via GitHub or Discord to get support."
        )
        return []

    # TODO (cliandy): verify this with openai
    def _list_llm_models(self, models) -> list[LLMConfig]:
        pass

        # TogetherAI's response is missing the 'data' field
        # assert "data" in response, f"OpenAI model query response missing 'data' field: {response}"
        if "data" in models:
            data = models["data"]
        else:
            data = models

        configs = []
        for model in data:
            assert "id" in model, f"TogetherAI model missing 'id' field: {model}"
            model_name = model["id"]

            if "context_length" in model:
                # Context length is returned in OpenRouter as "context_length"
                context_window_size = model["context_length"]
            else:
                context_window_size = self.get_model_context_window_size(model_name)

            # We need the context length for embeddings too
            if not context_window_size:
                continue

            # Skip models that are too small for Letta
            if context_window_size <= MIN_CONTEXT_WINDOW:
                continue

            # TogetherAI includes the type, which we can use to filter for embedding models
            if "type" in model and model["type"] not in ["chat", "language"]:
                continue

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="together",
                    model_endpoint=self.base_url,
                    model_wrapper=self.default_prompt_formatter,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    async def check_api_key(self):
        if not self.api_key:
            raise ValueError("No API key provided")

        try:
            await self.list_llm_models_async()
        except Exception as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Together: {e}", code=ErrorCode.UNAUTHENTICATED)
