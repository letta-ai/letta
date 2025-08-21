from typing import Literal

from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_TOKENS
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

logger = get_logger(__name__)

ALLOWED_PREFIXES = {"gpt-4", "gpt-5", "o1", "o3", "o4"}
DISALLOWED_KEYWORDS = {"transcribe", "search", "realtime", "tts", "audio", "computer", "o1-mini", "o1-preview", "o1-pro", "chat"}
DEFAULT_EMBEDDING_BATCH_SIZE = 1024


class OpenAIProvider(Provider):
    provider_type: Literal[ProviderType.openai] = Field(ProviderType.openai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the OpenAI API.")
    base_url: str = Field("https://api.openai.com/v1", description="Base URL for the OpenAI API.")

    async def check_api_key(self):
        from letta.llm_api.openai import openai_check_valid_api_key  # TODO: DO NOT USE THIS - old code path

        openai_check_valid_api_key(self.base_url, self.api_key)

    async def _get_models_async(self) -> list[dict]:
        from letta.llm_api.openai import openai_get_model_list_async

        # Some hardcoded support for OpenRouter (so that we only get models with tool calling support)...
        # See: https://openrouter.ai/docs/requests
        extra_params = {"supported_parameters": "tools"} if "openrouter.ai" in self.base_url else None

        # Similar to Nebius
        extra_params = {"verbose": True} if "nebius.com" in self.base_url else None

        response = await openai_get_model_list_async(
            self.base_url,
            api_key=self.api_key,
            extra_params=extra_params,
            # fix_url=True,  # NOTE: make sure together ends with /v1
        )

        # TODO (cliandy): this is brittle as TogetherAI seems to result in a list instead of having a 'data' field
        data = response.get("data", response)
        assert isinstance(data, list)
        return data

    async def list_llm_models_async(self) -> list[LLMConfig]:
        data = await self._get_models_async()
        return self._list_llm_models(data)

    def _list_llm_models(self, data: list[dict]) -> list[LLMConfig]:
        """
        This handles filtering out LLM Models by provider that meet Letta's requirements.
        """
        configs = []
        for model in data:
            check = self._do_model_checks_for_name_and_context_size(model)
            if check is None:
                continue
            model_name, context_window_size = check

            # ===== Provider filtering =====
            # TogetherAI: includes the type, which we can use to filter out embedding models
            if "api.together.ai" in self.base_url or "api.together.xyz" in self.base_url:
                if "type" in model and model["type"] not in ["chat", "language"]:
                    continue

                # for TogetherAI, we need to skip the models that don't support JSON mode / function calling
                # requests.exceptions.HTTPError: HTTP error occurred: 400 Client Error: Bad Request for url: https://api.together.ai/v1/chat/completions | Status code: 400, Message: {
                #   "error": {
                #     "message": "mistralai/Mixtral-8x7B-v0.1 is not supported for JSON mode/function calling",
                #     "type": "invalid_request_error",
                #     "param": null,
                #     "code": "constraints_model"
                #   }
                # }
                if "config" not in model:
                    continue

            # Nebius: includes the type, which we can use to filter for text models
            if "nebius.com" in self.base_url:
                model_type = model.get("architecture", {}).get("modality")
                if model_type not in ["text->text", "text+image->text"]:
                    continue

            # OpenAI
            # NOTE: o1-mini and o1-preview do not support tool calling
            # NOTE: o1-mini does not support system messages
            # NOTE: o1-pro is only available in Responses API
            if self.base_url == "https://api.openai.com/v1":
                if any(keyword in model_name for keyword in DISALLOWED_KEYWORDS) or not any(
                    model_name.startswith(prefix) for prefix in ALLOWED_PREFIXES
                ):
                    continue

            # We'll set the model endpoint based on the base URL
            # Note: openai-proxy just means that the model is using the OpenAIProvider
            if self.base_url != "https://api.openai.com/v1":
                handle = self.get_handle(model_name, base_name="openai-proxy")
            else:
                handle = self.get_handle(model_name)

            config = LLMConfig(
                model=model_name,
                model_endpoint_type="openai",
                model_endpoint=self.base_url,
                context_window=context_window_size,
                handle=handle,
                provider_name=self.name,
                provider_category=self.provider_category,
            )

            config = self._set_model_parameter_tuned_defaults(model_name, config)
            configs.append(config)

        # for OpenAI, sort in reverse order
        if self.base_url == "https://api.openai.com/v1":
            configs.sort(key=lambda x: x.model, reverse=True)
        return configs

    def _do_model_checks_for_name_and_context_size(self, model: dict, length_key: str = "context_length") -> tuple[str, int] | None:
        if "id" not in model:
            logger.warning("Model missing 'id' field for provider: %s and model: %s", self.provider_type, model)
            return None

        model_name = model["id"]
        context_window_size = model.get(length_key) or self.get_model_context_window_size(model_name)

        if not context_window_size:
            logger.info("No context window size found for model: %s", model_name)
            return None

        return model_name, context_window_size

    @staticmethod
    def _set_model_parameter_tuned_defaults(model_name: str, llm_config: LLMConfig):
        """This function is used to tune LLMConfig parameters to improve model performance."""

        # gpt-4o-mini has started to regress with pretty bad emoji spam loops (2025-07)
        if "gpt-4o" in model_name or "gpt-4.1-mini" in model_name or model_name == "letta-free":
            llm_config.frequency_penalty = 1.0
        return llm_config

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        if self.base_url == "https://api.openai.com/v1":
            # TODO: actually automatically list models for OpenAI
            return [
                EmbeddingConfig(
                    embedding_model="text-embedding-ada-002",
                    embedding_endpoint_type="openai",
                    embedding_endpoint=self.base_url,
                    embedding_dim=1536,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle("text-embedding-ada-002", is_embedding=True),
                    batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
                ),
                EmbeddingConfig(
                    embedding_model="text-embedding-3-small",
                    embedding_endpoint_type="openai",
                    embedding_endpoint=self.base_url,
                    embedding_dim=2000,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle("text-embedding-3-small", is_embedding=True),
                    batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
                ),
                EmbeddingConfig(
                    embedding_model="text-embedding-3-large",
                    embedding_endpoint_type="openai",
                    embedding_endpoint=self.base_url,
                    embedding_dim=2000,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle("text-embedding-3-large", is_embedding=True),
                    batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
                ),
            ]
        else:
            # TODO: this has filtering that doesn't apply for embedding models, fix this.
            data = await self._get_models_async()
            return self._list_embedding_models(data)

    def _list_embedding_models(self, data) -> list[EmbeddingConfig]:
        configs = []
        for model in data:
            check = self._do_model_checks_for_name_and_context_size(model)
            if check is None:
                continue
            model_name, context_window_size = check

            # ===== Provider filtering =====
            # TogetherAI: includes the type, which we can use to filter for embedding models
            if "api.together.ai" in self.base_url or "api.together.xyz" in self.base_url:
                if "type" in model and model["type"] not in ["embedding"]:
                    continue
            # Nebius: includes the type, which we can use to filter for text models
            elif "nebius.com" in self.base_url:
                model_type = model.get("architecture", {}).get("modality")
                if model_type not in ["text->embedding"]:
                    continue
            else:
                logger.debug(
                    f"Skipping embedding models for %s by default, as we don't assume embeddings are supported."
                    "Please open an issue on GitHub if support is required.",
                    self.base_url,
                )
                continue

            configs.append(
                EmbeddingConfig(
                    embedding_model=model_name,
                    embedding_endpoint_type=self.provider_type,
                    embedding_endpoint=self.base_url,
                    embedding_dim=context_window_size,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle(model, is_embedding=True),
                )
            )

        return configs

    def get_model_context_window_size(self, model_name: str) -> int | None:
        if model_name in LLM_MAX_TOKENS:
            return LLM_MAX_TOKENS[model_name]
        else:
            logger.debug(
                f"Model %s on %s for provider %s not found in LLM_MAX_TOKENS. Using default of {{LLM_MAX_TOKENS['DEFAULT']}}",
                model_name,
                self.base_url,
                self.__class__.__name__,
            )
            return LLM_MAX_TOKENS["DEFAULT"]

    def get_model_context_window(self, model_name: str) -> int | None:
        return self.get_model_context_window_size(model_name)

    async def get_model_context_window_async(self, model_name: str) -> int | None:
        return self.get_model_context_window_size(model_name)
