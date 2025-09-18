"""
Note: this consolidates the vLLM provider for completions (deprecated by openai)
and chat completions. Support is provided primarily for the chat completions endpoint,
but to utilize the completions endpoint, set the proper `base_url` and
`default_prompt_formatter`.
"""

from typing import Literal

from pydantic import Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class VLLMProvider(Provider):
    provider_type: Literal[ProviderType.vllm] = Field(ProviderType.vllm, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field(..., description="Base URL for the vLLM API.")
    api_key: str | None = Field(None, description="API key for the vLLM API.")
    default_prompt_formatter: str | None = Field(
        default=None, description="Default prompt formatter (aka model wrapper) to use on a /completions style API."
    )

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        base_url = self.base_url.rstrip("/") + "/v1" if not self.base_url.endswith("/v1") else self.base_url
        response = await openai_get_model_list_async(base_url, api_key=self.api_key)
        data = response.get("data", response)

        configs = []

        for model in data:
            model_name = model["id"]

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="openai",  # TODO (cliandy): this was previous vllm for the completions provider, why?
                    model_endpoint=base_url,
                    model_wrapper=self.default_prompt_formatter,
                    context_window=model["max_model_len"],
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        # Note: vLLM technically can support embedding models though may require multiple instances
        # for now, we will not support embedding models for vLLM.
        return []
