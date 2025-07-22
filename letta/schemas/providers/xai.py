import warnings
from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

MODEL_CONTEXT_WINDOWS = {
    "grok-3-fast": 131_072,
    "grok-3": 131_072,
    "grok-3-mini": 131_072,
    "grok-3-mini-fast": 131_072,
    "grok-4-0709": 256_000,
}


class XAIProvider(OpenAIProvider):
    """https://docs.x.ai/docs/api-reference"""

    provider_type: Literal[ProviderType.xai] = Field(ProviderType.xai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the xAI/Grok API.")
    base_url: str = Field("https://api.x.ai/v1", description="Base URL for the xAI/Grok API.")

    def get_model_context_window_size(self, model_name: str) -> int | None:
        # xAI doesn't return context window in the model listing,
        # this is hardcoded from https://docs.x.ai/docs/models
        return MODEL_CONTEXT_WINDOWS.get(model_name)

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.base_url, api_key=self.api_key)

        data = response.get("data", response)

        configs = []
        for model in data:
            assert "id" in model, f"xAI/Grok model missing 'id' field: {model}"
            model_name = model["id"]

            # In case xAI starts supporting it in the future:
            if "context_length" in model:
                context_window_size = model["context_length"]
            else:
                context_window_size = self.get_model_context_window_size(model_name)

            if not context_window_size:
                warnings.warn(f"Couldn't find context window size for model {model_name}")
                continue

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="xai",
                    model_endpoint=self.base_url,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs
