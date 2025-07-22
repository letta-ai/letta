import warnings
from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


class CerebrasProvider(OpenAIProvider):
    """
    Cerebras Inference API is OpenAI-compatible and focuses on ultra-fast inference.

    Available Models (as of 2025):
    - llama-4-scout-17b-16e-instruct: Llama 4 Scout (109B params, 10M context, ~2600 tokens/s)
    - llama3.1-8b: Llama 3.1 8B (8B params, 128K context, ~2200 tokens/s)
    - llama-3.3-70b: Llama 3.3 70B (70B params, 128K context, ~2100 tokens/s)
    - qwen-3-32b: Qwen 3 32B (32B params, 131K context, ~2100 tokens/s)
    - deepseek-r1-distill-llama-70b: DeepSeek R1 Distill (70B params, 128K context, ~1700 tokens/s)
    """

    provider_type: Literal[ProviderType.cerebras] = Field(ProviderType.cerebras, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field("https://api.cerebras.ai/v1", description="Base URL for the Cerebras API.")
    api_key: str = Field(..., description="API key for the Cerebras API.")

    def get_model_context_window_size(self, model_name: str) -> int | None:
        """Cerebras has limited context window sizes.

        see https://inference-docs.cerebras.ai/support/pricing for details by plan
        """
        is_free_tier = True
        if is_free_tier:
            return 8192
        return 128000

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.base_url, api_key=self.api_key)

        if "data" in response:
            data = response["data"]
        else:
            data = response

        configs = []
        for model in data:
            assert "id" in model, f"Cerebras model missing 'id' field: {model}"
            model_name = model["id"]

            # Check if model has context_length in response
            if "context_length" in model:
                context_window_size = model["context_length"]
            else:
                context_window_size = self.get_model_context_window_size(model_name)

            if not context_window_size:
                warnings.warn(f"Couldn't find context window size for model {model_name}")
                continue

            # Cerebras supports function calling
            put_inner_thoughts_in_kwargs = True

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="openai",  # Cerebras uses OpenAI-compatible endpoint
                    model_endpoint=self.base_url,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs
