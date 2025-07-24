from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class MistralProvider(Provider):
    provider_type: Literal[ProviderType.mistral] = Field(ProviderType.mistral, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the Mistral API.")
    base_url: str = "https://api.mistral.ai/v1"

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.mistral import mistral_get_model_list_async

        # Some hardcoded support for OpenRouter (so that we only get models with tool calling support)...
        # See: https://openrouter.ai/docs/requests
        response = await mistral_get_model_list_async(self.base_url, api_key=self.api_key)

        assert "data" in response, f"Mistral model query response missing 'data' field: {response}"

        configs = []
        for model in response["data"]:
            # If model has chat completions and function calling enabled
            if model["capabilities"]["completion_chat"] and model["capabilities"]["function_calling"]:
                configs.append(
                    LLMConfig(
                        model=model["id"],
                        model_endpoint_type="openai",
                        model_endpoint=self.base_url,
                        context_window=model["max_context_length"],
                        handle=self.get_handle(model["id"]),
                        provider_name=self.name,
                        provider_category=self.provider_category,
                    )
                )

        return configs
