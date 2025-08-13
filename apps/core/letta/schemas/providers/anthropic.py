import warnings
from typing import Literal

import anthropic
from pydantic import Field

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

# https://docs.anthropic.com/claude/docs/models-overview
# Sadly hardcoded
MODEL_LIST = [
    ## Opus 4.1
    {
        "name": "claude-opus-4-1-20250805",
        "context_window": 200000,
    },
    ## Opus 3
    {
        "name": "claude-3-opus-20240229",
        "context_window": 200000,
    },
    # 3 latest
    {
        "name": "claude-3-opus-latest",
        "context_window": 200000,
    },
    # 4
    {
        "name": "claude-opus-4-20250514",
        "context_window": 200000,
    },
    ## Sonnet
    # 3.0
    {
        "name": "claude-3-sonnet-20240229",
        "context_window": 200000,
    },
    # 3.5
    {
        "name": "claude-3-5-sonnet-20240620",
        "context_window": 200000,
    },
    # 3.5 new
    {
        "name": "claude-3-5-sonnet-20241022",
        "context_window": 200000,
    },
    # 3.5 latest
    {
        "name": "claude-3-5-sonnet-latest",
        "context_window": 200000,
    },
    # 3.7
    {
        "name": "claude-3-7-sonnet-20250219",
        "context_window": 200000,
    },
    # 3.7 latest
    {
        "name": "claude-3-7-sonnet-latest",
        "context_window": 200000,
    },
    # 4
    {
        "name": "claude-sonnet-4-20250514",
        "context_window": 200000,
    },
    ## Haiku
    # 3.0
    {
        "name": "claude-3-haiku-20240307",
        "context_window": 200000,
    },
    # 3.5
    {
        "name": "claude-3-5-haiku-20241022",
        "context_window": 200000,
    },
    # 3.5 latest
    {
        "name": "claude-3-5-haiku-latest",
        "context_window": 200000,
    },
]


class AnthropicProvider(Provider):
    provider_type: Literal[ProviderType.anthropic] = Field(ProviderType.anthropic, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the Anthropic API.")
    base_url: str = "https://api.anthropic.com/v1"

    async def check_api_key(self):
        if self.api_key:
            anthropic_client = anthropic.Anthropic(api_key=self.api_key)
            try:
                # just use a cheap model to count some tokens - as of 5/7/2025 this is faster than fetching the list of models
                anthropic_client.messages.count_tokens(model=MODEL_LIST[-1]["name"], messages=[{"role": "user", "content": "a"}])
            except anthropic.AuthenticationError as e:
                raise LLMAuthenticationError(message=f"Failed to authenticate with Anthropic: {e}", code=ErrorCode.UNAUTHENTICATED)
            except Exception as e:
                raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)
        else:
            raise ValueError("No API key provided")

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """
        https://docs.anthropic.com/claude/docs/models-overview

        NOTE: currently there is no GET /models, so we need to hardcode
        """
        if self.api_key:
            anthropic_client = anthropic.AsyncAnthropic(api_key=self.api_key)
        elif model_settings.anthropic_api_key:
            anthropic_client = anthropic.AsyncAnthropic()
        else:
            raise ValueError("No API key provided")

        models = await anthropic_client.models.list()
        models_json = models.model_dump()
        assert "data" in models_json, f"Anthropic model query response missing 'data' field: {models_json}"
        models_data = models_json["data"]

        return self._list_llm_models(models_data)

    def _list_llm_models(self, models) -> list[LLMConfig]:
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
