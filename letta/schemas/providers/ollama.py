from typing import Literal

import aiohttp
from pydantic import Field

from letta.constants import DEFAULT_CONTEXT_WINDOW, DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider

logger = get_logger(__name__)


class OllamaProvider(OpenAIProvider):
    """Ollama provider that uses the native /api/generate endpoint

    See: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion
    """

    provider_type: Literal[ProviderType.ollama] = Field(ProviderType.ollama, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field(..., description="Base URL for the Ollama API.")
    api_key: str | None = Field(None, description="API key for the Ollama API (default: `None`).")
    default_prompt_formatter: str = Field(
        ..., description="Default prompt formatter (aka model wrapper) to use on a /completions style API."
    )

    @property
    def raw_base_url(self) -> str:
        """Base URL for native Ollama /api endpoints (no trailing /v1)."""
        if self.base_url.endswith("/v1"):
            return self.base_url[: -len("/v1")]
        return self.base_url

    @property
    def openai_compat_base_url(self) -> str:
        """Base URL with /v1 appended for OpenAI-compatible clients if ever needed.

        Note: We do not use OpenAI chat completions for Ollama, but expose this
        helper to clarify intent and avoid duplicating logic elsewhere.
        """
        return self.base_url if self.base_url.endswith("/v1") else f"{self.base_url.rstrip('/')}" + "/v1"

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """List available LLM Models from Ollama.

        Note: Older Ollama versions do not expose a "capabilities" field on /api/show.
        We therefore avoid filtering on capabilities and instead infer support from
        /api/show model_info (falling back to safe defaults).

        https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models
        """
        endpoint = f"{self.raw_base_url}/api/tags"
        async with aiohttp.ClientSession() as session:
            async with session.get(endpoint) as response:
                if response.status != 200:
                    # aiohttp: .text() is async
                    error_text = await response.text()
                    raise Exception(f"Failed to list Ollama models: {response.status} - {error_text}")
                response_json = await response.json()

        configs: list[LLMConfig] = []
        for m in response_json.get("models", []):
            model_name = m.get("name")
            if not model_name:
                continue

            # Use /api/show to check capabilities, specifically tools support
            details = await self._get_model_details_async(model_name)
            if not details:
                # If details cannot be fetched, skip to avoid tool errors later
                continue
            caps = details.get("capabilities") or []
            if not isinstance(caps, list):
                caps = []
            if "tools" not in [str(c).lower() for c in caps]:
                # Only include models that declare tools support
                continue

            # Derive context window from /api/show model_info if available
            context_window = None
            model_info = details.get("model_info", {}) if isinstance(details, dict) else {}
            architecture = model_info.get("general.architecture") if isinstance(model_info, dict) else None
            if architecture:
                ctx_len = model_info.get(f"{architecture}.context_length")
                if ctx_len is not None:
                    try:
                        context_window = int(ctx_len)
                    except Exception:
                        context_window = None
            if context_window is None:
                logger.warning(f"Ollama model {model_name} has no context window in /api/show, using default {DEFAULT_CONTEXT_WINDOW}")
                context_window = DEFAULT_CONTEXT_WINDOW

            # === Capability stubs ===
            # Compute support flags from /api/show capabilities. These are not
            # yet plumbed through LLMConfig, but are captured here for later use.
            caps_lower = [str(c).lower() for c in caps]
            supports_tools = "tools" in caps_lower
            supports_thinking = "thinking" in caps_lower
            supports_vision = "vision" in caps_lower
            supports_completion = "completion" in caps_lower
            _ = (supports_tools, supports_thinking, supports_vision, supports_completion)

            configs.append(
                # Legacy Ollama using raw generate
                # LLMConfig(
                #     model=model_name,
                #     model_endpoint_type="ollama",
                #     model_endpoint=self.openai_compat_base_url,
                #     model_wrapper=self.default_prompt_formatter,
                #     context_window=context_window,
                #     # Ollama specific
                #     handle=self.get_handle(model_name),
                #     provider_name=self.name,
                #     provider_category=self.provider_category,
                # )
                # New "trust Ollama" version w/ pure OpenAI proxy
                LLMConfig(
                    model=model_name,
                    model_endpoint_type="openai",
                    model_endpoint=self.openai_compat_base_url,
                    # model_wrapper=self.default_prompt_formatter,
                    context_window=context_window,
                    handle=self.get_handle(model_name),
                    provider_name=self.name,
                    provider_category=self.provider_category,
                    # put_inner_thoughts_in_kwargs=True,
                    # enable_reasoner=supports_thinking,
                )
            )
        return configs

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        """List available embedding models from Ollama.

        We infer embedding support via model_info.*.embedding_length when available.

        https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models
        """
        endpoint = f"{self.raw_base_url}/api/tags"
        async with aiohttp.ClientSession() as session:
            async with session.get(endpoint) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Failed to list Ollama models: {response.status} - {error_text}")
                response_json = await response.json()

        configs: list[EmbeddingConfig] = []
        for model in response_json.get("models", []):
            model_name = model["name"]
            model_details = await self._get_model_details_async(model_name)

            if not model_details:
                continue

            # Filter to true embedding models via capabilities
            caps = model_details.get("capabilities") or []
            if not isinstance(caps, list):
                caps = []
            if "embedding" not in [str(c).lower() for c in caps]:
                continue

            embedding_dim = None
            model_info = model_details.get("model_info", {})
            architecture = model_info.get("general.architecture")
            if architecture:
                embedding_length = model_info.get(f"{architecture}.embedding_length")
                if embedding_length is not None:
                    try:
                        embedding_dim = int(embedding_length)
                    except Exception:
                        pass

            if not embedding_dim:
                # Skip models without a reported embedding dimension to avoid DB dimension mismatches
                continue

            configs.append(
                EmbeddingConfig(
                    embedding_model=model_name,
                    # Use OpenAI-compatible proxy for embeddings
                    embedding_endpoint_type=ProviderType.openai,
                    embedding_endpoint=self.openai_compat_base_url,
                    embedding_dim=embedding_dim,
                    embedding_chunk_size=DEFAULT_EMBEDDING_CHUNK_SIZE,
                    handle=self.get_handle(model_name, is_embedding=True),
                )
            )
        return configs

    async def _get_model_details_async(self, model_name: str) -> dict | None:
        """Get detailed information for a specific model from /api/show."""
        endpoint = f"{self.raw_base_url}/api/show"
        payload = {"name": model_name}

        try:
            timeout = aiohttp.ClientTimeout(total=2.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(endpoint, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.warning(f"Failed to get model info for {model_name}: {response.status} - {error_text}")
                        return None
                    return await response.json()
        except Exception as e:
            logger.warning(f"Failed to get model details for {model_name} with error: {e}")
            return None
