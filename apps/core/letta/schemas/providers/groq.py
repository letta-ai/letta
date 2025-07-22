from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


class GroqProvider(OpenAIProvider):
    provider_type: Literal[ProviderType.groq] = Field(ProviderType.groq, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = "https://api.groq.com/openai/v1"
    api_key: str = Field(..., description="API key for the Groq API.")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.base_url, api_key=self.api_key)
        configs = []
        for model in response["data"]:
            if "context_window" not in model:
                continue
            configs.append(
                LLMConfig(
                    model=model["id"],
                    model_endpoint_type="groq",
                    model_endpoint=self.base_url,
                    context_window=model["context_window"],
                    handle=self.get_handle(model["id"]),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs
