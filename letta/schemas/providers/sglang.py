"""
SGLang provider for Letta.

SGLang is a high-performance inference engine that exposes OpenAI-compatible API endpoints.
"""

from typing import Literal

from pydantic import Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class SGLangProvider(Provider):
    provider_type: Literal[ProviderType.sglang] = Field(
        ProviderType.sglang,
        description="The type of the provider."
    )
    provider_category: ProviderCategory = Field(
        ProviderCategory.base,
        description="The category of the provider (base or byok)"
    )
    base_url: str = Field(
        ...,
        description="Base URL for the SGLang API (e.g., http://localhost:30000)."
    )
    api_key: str | None = Field(
        None,
        description="API key for the SGLang API (optional for local instances)."
    )
    default_prompt_formatter: str | None = Field(
        default=None,
        description="Default prompt formatter (aka model wrapper)."
    )
    handle_base: str | None = Field(
        None,
        description="Custom handle base name for model handles."
    )

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        # Ensure base_url ends with /v1 (SGLang uses same convention as vLLM)
        base_url = self.base_url.rstrip("/")
        if not base_url.endswith("/v1"):
            base_url = base_url + "/v1"

        # Decrypt API key before using (may be None for local instances)
        api_key = await self.api_key_enc.get_plaintext_async() if self.api_key_enc else None

        response = await openai_get_model_list_async(base_url, api_key=api_key)
        data = response.get("data", response)

        configs = []

        for model in data:
            model_name = model["id"]

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="openai",  # SGLang is OpenAI-compatible
                    model_endpoint=base_url,
                    model_wrapper=self.default_prompt_formatter,
                    context_window=model.get("max_model_len", 8192),
                    handle=self.get_handle(model_name, base_name=self.handle_base) if self.handle_base else self.get_handle(model_name),
                    max_tokens=self.get_default_max_output_tokens(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        # SGLang embedding support not common for training use cases
        return []
