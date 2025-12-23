from typing import Literal

from letta.log import get_logger

logger = get_logger(__name__)

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

# Z.ai model context windows
# Reference: https://docs.z.ai/
MODEL_CONTEXT_WINDOWS = {
    "glm-4.5": 128000,
    "glm-4.6": 200000,
    "glm-4.7": 200000,
}


class ZAIProvider(OpenAIProvider):
    """Z.ai (ZhipuAI) provider - https://docs.z.ai/"""

    provider_type: Literal[ProviderType.zai] = Field(ProviderType.zai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str | None = Field(None, description="API key for the Z.ai API.", deprecated=True)
    base_url: str = Field("https://api.z.ai/api/paas/v4/", description="Base URL for the Z.ai API.")

    def get_model_context_window_size(self, model_name: str) -> int | None:
        # Z.ai doesn't return context window in the model listing,
        # this is hardcoded from documentation
        return MODEL_CONTEXT_WINDOWS.get(model_name)

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        api_key = await self.api_key_enc.get_plaintext_async() if self.api_key_enc else None
        response = await openai_get_model_list_async(self.base_url, api_key=api_key)

        data = response.get("data", response)

        configs = []
        for model in data:
            assert "id" in model, f"Z.ai model missing 'id' field: {model}"
            model_name = model["id"]

            # In case Z.ai starts supporting it in the future:
            if "context_length" in model:
                context_window_size = model["context_length"]
            else:
                context_window_size = self.get_model_context_window_size(model_name)

            if not context_window_size:
                logger.warning(f"Couldn't find context window size for model {model_name}")
                continue

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type=self.provider_type.value,
                    model_endpoint=self.base_url,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    max_tokens=self.get_default_max_output_tokens(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs
