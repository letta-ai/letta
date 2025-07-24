import warnings
from typing import Literal

from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider


class AnthropicProvider(Provider):
    provider_type: Literal[ProviderType.anthropic] = Field(ProviderType.anthropic, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the Anthropic API.")
    base_url: str = "https://api.anthropic.com/v1"

    async def check_api_key(self):
        from letta.llm_api.anthropic import anthropic_check_valid_api_key

        anthropic_check_valid_api_key(self.api_key)

    async def list_llm_models_async(self) -> list[LLMConfig]:
        from letta.llm_api.anthropic import anthropic_get_model_list_async

        models = await anthropic_get_model_list_async(api_key=self.api_key)
        return self._list_llm_models(models)

    def _list_llm_models(self, models) -> list[LLMConfig]:
        from letta.llm_api.anthropic import MODEL_LIST

        configs = []
        for model in models:
            if any((model.get("type") != "model", "id" not in model, model.get("id").startswith("claude-2"))):
                continue

            # Anthropic doesn't return the context window in their API
            if "context_window" not in model:
                # Remap list to name: context_window
                model_library = {m["name"]: m["context_window"] for m in MODEL_LIST}
                # Attempt to look it up in a hardcoded list
                if model["id"] in model_library:
                    model["context_window"] = model_library[model["id"]]
                else:
                    # On fallback, we can set 200k (generally safe), but we should warn the user
                    warnings.warn(f"Couldn't find context window size for model {model['id']}, defaulting to 200,000")
                    model["context_window"] = 200000

            max_tokens = 8192
            if "claude-3-opus" in model["id"]:
                max_tokens = 4096
            if "claude-3-haiku" in model["id"]:
                max_tokens = 4096
            # TODO: set for 3-7 extended thinking mode

            # NOTE: from 2025-02
            # We set this to false by default, because Anthropic can
            # natively support <thinking> tags inside of content fields
            # However, putting COT inside of tool calls can make it more
            # reliable for tool calling (no chance of a non-tool call step)
            # Since tool_choice_type 'any' doesn't work with in-content COT
            # NOTE For Haiku, it can be flaky if we don't enable this by default
            # inner_thoughts_in_kwargs = True if "haiku" in model["id"] else False
            inner_thoughts_in_kwargs = True  # we no longer support thinking tags

            configs.append(
                LLMConfig(
                    model=model["id"],
                    model_endpoint_type="anthropic",
                    model_endpoint=self.base_url,
                    context_window=model["context_window"],
                    handle=self.get_handle(model["id"]),
                    put_inner_thoughts_in_kwargs=inner_thoughts_in_kwargs,
                    max_tokens=max_tokens,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                )
            )
        return configs
