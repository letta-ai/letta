from typing import Literal

from openai import AsyncOpenAI, AuthenticationError, PermissionDeniedError
from pydantic import Field

from letta.constants import DEFAULT_EMBEDDING_CHUNK_SIZE, LLM_MAX_CONTEXT_WINDOW
from letta.errors import ErrorCode, LLMAuthenticationError, LLMError, LLMPermissionDeniedError
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

logger = get_logger(__name__)

ALLOWED_PREFIXES = {"gpt-4", "gpt-5", "o1", "o3", "o4"}
DISALLOWED_KEYWORDS = {"transcribe", "search", "realtime", "tts", "audio", "computer", "o1-mini", "o1-preview", "o1-pro"}
DEFAULT_EMBEDDING_BATCH_SIZE = 1024


class OpenAIProvider(Provider):
    provider_type: Literal[ProviderType.openai] = Field(ProviderType.openai, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str | None = Field(None, description="API key for the OpenAI API.", deprecated=True)
    base_url: str = Field("https://api.openai.com/v1", description="Base URL for the OpenAI API.")

    async def check_api_key(self):
        # Decrypt API key before using
        api_key = await self.api_key_enc.get_plaintext_async() if self.api_key_enc else None

        if not api_key:
            raise ValueError("No API key provided")

        try:
            # Use async OpenAI client to check API key validity
            client = AsyncOpenAI(api_key=api_key, base_url=self.base_url)
            # Just list models to verify API key works
            await client.models.list()
        except AuthenticationError as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with OpenAI: {e}", code=ErrorCode.UNAUTHENTICATED)
        except PermissionDeniedError as e:
            raise LLMPermissionDeniedError(message=f"Permission denied by OpenAI: {e}", code=ErrorCode.PERMISSION_DENIED)
        except AttributeError as e:
            if "_set_private_attributes" in str(e):
                raise LLMError(
                    message=f"OpenAI-compatible endpoint at {self.base_url} returned an unexpected non-JSON response. Verify the base URL and that the endpoint is reachable.",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                )
            raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)
        except Exception as e:
            raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)

    @staticmethod
    def _openai_default_max_output_tokens(model_name: str) -> int:
        """Return a sensible max-output-tokens default for OpenAI models.

        gpt-5.2* / gpt-5.3* / gpt-5.4* support 128k output tokens, except the
        `-chat` variants which are capped at 16k.
        """
        import re

        if re.match(r"^gpt-5\.[234]", model_name) and "-chat" not in model_name:
            return 128000
        return 16384

    def get_default_max_output_tokens(self, model_name: str) -> int:
        """Get the default max output tokens for OpenAI models (sync fallback)."""
        return self._openai_default_max_output_tokens(model_name)

    async def get_default_max_output_tokens_async(self, model_name: str) -> int:
        """Get the default max output tokens for OpenAI models.

        Uses litellm model specifications with a simple fallback.
        """
        from letta.model_specs.litellm_model_specs import get_max_output_tokens

        # Try litellm specs
        max_output = await get_max_output_tokens(model_name)
        if max_output is not None:
            return max_output

        return self._openai_default_max_output_tokens(model_name)

    async def _get_models_async(self) -> list[dict]:
        from letta.llm_api.openai import openai_get_model_list_async

        # Provider-specific extra parameters for model listing
        extra_params = None
        if "openrouter.ai" in self.base_url:
            # OpenRouter: filter for models with tool calling support
            # See: https://openrouter.ai/docs/requests
            extra_params = {"supported_parameters": "tools"}
        elif "nebius.com" in self.base_url:
            # Nebius: use verbose mode for better model info
            extra_params = {"verbose": True}

        # Decrypt API key before using
        api_key = await self.api_key_enc.get_plaintext_async() if self.api_key_enc else None

        try:
            response = await openai_get_model_list_async(
                self.base_url,
                api_key=api_key,
                extra_params=extra_params,
                # fix_url=True,  # NOTE: make sure together ends with /v1
            )

            # TODO (cliandy): this is brittle as TogetherAI seems to result in a list instead of having a 'data' field
            data = response.get("data", response)
            assert isinstance(data, list)
            return data
        except Exception as e:
            # Baseten dedicated deployments don't expose /models — return empty list
            # so the provider can still be used with explicit model handles
            if "baseten.co" in self.base_url:
                logger.info(f"Baseten dedicated endpoint does not support /models listing: {e}")
                return [{"id": "zai-org/GLM-5", "context_length": 180000}]
            raise

    async def list_llm_models_async(self) -> list[LLMConfig]:
        data = await self._get_models_async()
        return await self._list_llm_models(data)

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        """Return known OpenAI embedding models.

        Note: we intentionally do not attempt to fetch embedding models from the remote endpoint here.
        The OpenAI "models" list does not reliably expose embedding metadata needed for filtering,
        and in tests we frequently point OPENAI_BASE_URL at a local mock server.
        """

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
                embedding_dim=1536,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                handle=self.get_handle("text-embedding-3-small", is_embedding=True),
                batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
            ),
            EmbeddingConfig(
                embedding_model="text-embedding-3-large",
                embedding_endpoint_type="openai",
                embedding_endpoint=self.base_url,
                embedding_dim=3072,
                embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                handle=self.get_handle("text-embedding-3-large", is_embedding=True),
                batch_size=DEFAULT_EMBEDDING_BATCH_SIZE,
            ),
        ]

    async def _list_llm_models(self, data: list[dict]) -> list[LLMConfig]:
        """
        This handles filtering out LLM Models by provider that meet Letta's requirements.
        """
        configs = []
        for model in data:
            check = await self._do_model_checks_for_name_and_context_size_async(model)
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
            if self.base_url.endswith("api.baseten.co/environments/production/sync/v1"):
                handle = self.get_handle(model_name, base_name="baseten")
            elif self.base_url != "https://api.openai.com/v1":
                handle = self.get_handle(model_name, base_name="openai-proxy")
            else:
                handle = self.get_handle(model_name)

            config = LLMConfig(
                model=model_name,
                model_endpoint_type="openai",
                model_endpoint=self.base_url,
                context_window=context_window_size,
                handle=handle,
                max_tokens=await self.get_default_max_output_tokens_async(model_name),
                provider_name=self.name,
                provider_category=self.provider_category,
            )

            config = self._set_model_parameter_tuned_defaults(model_name, config)
            configs.append(config)

        # Add synthetic fast variants (e.g. gpt-5.4-fast with service_tier="priority")
        fast_configs = []
        for config in configs:
            if config.model == "gpt-5.4":
                fast_config = config.model_copy(
                    update={
                        "model": "gpt-5.4-fast",
                        "handle": self.get_handle("gpt-5.4-fast"),
                    }
                )
                fast_configs.append(fast_config)
        configs.extend(fast_configs)

        # for OpenAI, sort in reverse order
        if self.base_url == "https://api.openai.com/v1":
            configs.sort(key=lambda x: x.model, reverse=True)
        return configs

    def _do_model_checks_for_name_and_context_size(self, model: dict, length_key: str = "context_length") -> tuple[str, int] | None:
        """Sync version - uses sync get_model_context_window_size (for subclasses with hardcoded values)."""
        if "id" not in model:
            logger.warning("Model missing 'id' field for provider: %s and model: %s", self.provider_type, model)
            return None

        model_name = model["id"]
        context_window_size = self.get_model_context_window_size(model_name)

        if not context_window_size:
            logger.info("No context window size found for model: %s", model_name)
            return None

        return model_name, context_window_size

    async def _do_model_checks_for_name_and_context_size_async(
        self, model: dict, length_key: str = "context_length"
    ) -> tuple[str, int] | None:
        """Async version - uses async get_model_context_window_size_async (for litellm lookup)."""
        if "id" not in model:
            logger.warning("Model missing 'id' field for provider: %s and model: %s", self.provider_type, model)
            return None

        model_name = model["id"]
        context_window_size = await self.get_model_context_window_size_async(model_name)

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

    def get_model_context_window_size(self, model_name: str) -> int | None:
        """Get the context window size for a model (sync fallback)."""
        basename = model_name.rsplit("/", 1)[-1].lower()
        if basename in LLM_MAX_CONTEXT_WINDOW:
            return LLM_MAX_CONTEXT_WINDOW[basename]
        return LLM_MAX_CONTEXT_WINDOW["DEFAULT"]

    async def get_model_context_window_size_async(self, model_name: str) -> int | None:
        """Get the context window size for a model.

        Uses litellm model specifications which covers all OpenAI models.
        Falls back to LLM_MAX_CONTEXT_WINDOW with normalized name matching.
        """
        from letta.model_specs.litellm_model_specs import get_context_window

        context_window = await get_context_window(model_name)
        if context_window is not None:
            return context_window

        # Try matching against LLM_MAX_CONTEXT_WINDOW with basename
        # e.g. "zai-org/GLM-5" -> "glm-5", "accounts/fireworks/models/glm-5" -> "glm-5"
        basename = model_name.rsplit("/", 1)[-1].lower()
        if basename in LLM_MAX_CONTEXT_WINDOW:
            return LLM_MAX_CONTEXT_WINDOW[basename]

        logger.debug(
            "Model %s not found in litellm specs or context window map. Using default of %s",
            model_name,
            LLM_MAX_CONTEXT_WINDOW["DEFAULT"],
        )
        return LLM_MAX_CONTEXT_WINDOW["DEFAULT"]

    def get_model_context_window(self, model_name: str) -> int | None:
        return self.get_model_context_window_size(model_name)

    async def get_model_context_window_async(self, model_name: str) -> int | None:
        return await self.get_model_context_window_size_async(model_name)
