from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider


class DeepSeekProvider(OpenAIProvider):
    """
    DeepSeek ChatCompletions API is similar to OpenAI's reasoning API,
    but with slight differences:
    * For example, DeepSeek's API requires perfect interleaving of user/assistant
    * It also does not support native function calling
    """

    provider_type: Literal[ProviderType.deepseek] = Field(ProviderType.deepseek, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field("https://api.deepseek.com/v1", description="Base URL for the DeepSeek API.")
    api_key: str = Field(..., description="API key for the DeepSeek API.")

    # TODO (cliandy): this may need to be updated to reflect current models
    def get_model_context_window_size(self, model_name: str) -> int | None:
        # DeepSeek doesn't return context window in the model listing,
        # so these are hardcoded from their website
        if model_name == "deepseek-reasoner":
            return 64000
        elif model_name == "deepseek-chat":
            return 64000
        else:
            return None

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.openai import openai_get_model_list_async

        response = await openai_get_model_list_async(self.base_url, api_key=self.api_key)
        data = response.get("data", response)

        configs = []
        for model in data:
            check = self._do_model_checks_for_name_and_context_size(model)
            if check is None:
                continue
            model_name, context_window_size = check

            # Not used for deepseek-reasoner, but otherwise is true
            put_inner_thoughts_in_kwargs = False if model_name == "deepseek-reasoner" else True

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="deepseek",
                    model_endpoint=self.base_url,
                    context_window=context_window_size,
                    handle=self.get_handle(model_name),
                    put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )

        return configs
