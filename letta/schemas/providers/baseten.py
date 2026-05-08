from typing import Literal

import httpx
from pydantic import Field

from letta.log import get_logger
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.openai import OpenAIProvider
from letta.utils import smart_urljoin

logger = get_logger(__name__)


class BasetenProvider(OpenAIProvider):
    """Baseten serverless provider — OpenAI-compatible inference."""

    provider_type: Literal[ProviderType.baseten] = Field(ProviderType.baseten, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    base_url: str = Field("https://inference.baseten.co/v1", description="Base URL for the Baseten serverless API.")

    async def check_api_key(self):
        """Validate API key by listing models (uses Api-Key auth)."""
        try:
            data = await self._get_models_async()
            if not data:
                raise ValueError("Baseten returned no models — check API key")
        except httpx.HTTPStatusError as e:
            from letta.errors import ErrorCode, LLMAuthenticationError

            if e.response.status_code in (401, 403):
                raise LLMAuthenticationError(message=f"Failed to authenticate with Baseten: {e}", code=ErrorCode.UNAUTHENTICATED)
            raise

    async def _get_models_async(self) -> list[dict]:
        """Fetch models from the Baseten serverless API.

        Overrides OpenAIProvider to use Api-Key auth (Baseten's /models
        endpoint does not accept Bearer tokens).
        """
        api_key = await self.api_key_enc.get_plaintext_async() if self.api_key_enc else None
        url = smart_urljoin(self.base_url, "models")
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Api-Key {api_key}"

        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()

        return data.get("data", data)

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """List models from the Baseten serverless API.

        Uses context_length and supported_features directly from the API response
        rather than litellm lookups, since Baseten provides rich model metadata.
        """
        data = await self._get_models_async()

        configs = []
        for model in data:
            model_name = model.get("id")
            if not model_name:
                continue

            # Only include models that support tool calling
            features = model.get("supported_features", [])
            if "tools" not in features:
                continue

            context_length = model.get("context_length")
            if not context_length:
                continue

            max_tokens = model.get("max_completion_tokens", 16384)

            configs.append(
                LLMConfig(
                    model=model_name,
                    model_endpoint_type=self.provider_type.value,
                    model_endpoint=self.base_url,
                    context_window=context_length,
                    handle=self.get_handle(model_name),
                    max_tokens=max_tokens,
                    provider_name=self.name,
                    provider_category=self.provider_category,
                    strict=True,
                    parallel_tool_calls=True,
                )
            )

        return configs
