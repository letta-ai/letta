"""
Venice AI provider implementation.
"""

from typing import Literal

from pydantic import Field

from letta.log import get_logger
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers.base import Provider

logger = get_logger(__name__)


class VeniceProvider(Provider):
    """
    Venice AI provider implementation.
    
    Queries the Venice API dynamically to list available models.
    """
    provider_type: Literal[ProviderType.venice] = Field(ProviderType.venice, description="The type of the provider.")
    provider_category: ProviderCategory = Field(ProviderCategory.base, description="The category of the provider (base or byok)")
    api_key: str = Field(..., description="API key for the Venice API.")
    base_url: str = Field("https://api.venice.ai/api/v1", description="Base URL for the Venice API.")

    async def check_api_key(self):
        """
        Validate Venice API key by attempting to list models from the API.
        
        Makes a test request to the Venice models endpoint. If the request succeeds,
        the API key is considered valid. If it fails with 401/authentication error,
        raises LLMAuthenticationError.
        
        Raises:
            ValueError: If no API key is provided
            LLMAuthenticationError: If API key is invalid (401 Unauthorized)
            LLMError: For other validation errors
        """
        from letta.errors import ErrorCode, LLMAuthenticationError, LLMError
        
        api_key = self.get_api_key_secret().get_plaintext()
        if not api_key:
            raise ValueError("No API key provided")
        
        try:
            from letta.llm_api.venice import venice_get_model_list_async
            # Try to list models as a way to validate the API key
            await venice_get_model_list_async(self.base_url, api_key=api_key)
        except Exception as e:
            error_str = str(e).lower()
            if "401" in error_str or "unauthorized" in error_str or "authentication" in error_str:
                raise LLMAuthenticationError(
                    message=f"Failed to authenticate with Venice: {e}",
                    code=ErrorCode.UNAUTHENTICATED
                )
            raise LLMError(message=f"Failed to validate Venice API key: {e}", code=ErrorCode.INTERNAL_SERVER_ERROR)

    async def _get_models_async(self) -> list[dict]:
        """
        Fetch raw model list from Venice API.
        
        Retrieves the complete list of available models from Venice API, including
        both text and embedding models. The API key is decrypted from Secret storage
        before making the request.
        
        Returns:
            list[dict]: List of model dictionaries from Venice API response.
            Each dict contains: id, type, model_spec, capabilities, etc.
            
        Raises:
            AssertionError: If API response format is unexpected (not a list)
        """
        from letta.llm_api.venice import venice_get_model_list_async
        
        # Decrypt API key before using
        api_key = self.get_api_key_secret().get_plaintext()
        
        response = await venice_get_model_list_async(
            self.base_url,
            api_key=api_key,
        )
        
        # Venice API returns {"data": [...]}
        data = response.get("data", response)
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        return data

    async def list_llm_models_async(self) -> list[LLMConfig]:
        """
        List available LLM models from Venice API.
        
        Filters for text models and converts to LLMConfig format.
        
        Returns:
            List of LLMConfig objects for available text models
        """
        data = await self._get_models_async()
        return self._list_llm_models(data)

    def _list_llm_models(self, data: list[dict]) -> list[LLMConfig]:
        """
        Convert Venice API model data to Letta LLMConfig format.
        
        Filters for text models only (skips embedding models), extracts context window
        from model_spec.availableContextTokens, and creates LLMConfig objects with
        proper handles (venice/{model_id}). Models are sorted alphabetically by model ID.
        
        Args:
            data: List of raw model dictionaries from Venice API
            
        Returns:
            list[LLMConfig]: List of LLMConfig objects for text models, sorted by model ID.
            Each config includes: model, handle, context_window, provider_name, etc.
        """
        configs = []
        for model in data:
            # Filter for text models only
            model_type = model.get("type", "")
            if model_type != "text":
                continue
            
            model_id = model.get("id")
            if not model_id:
                logger.warning(f"Venice model missing 'id' field: {model}")
                continue
            
            # Extract context window from model_spec
            model_spec = model.get("model_spec", {})
            capabilities = model_spec.get("capabilities", {})
            
            # Get available context tokens (Venice's term for context window)
            context_window = model_spec.get("availableContextTokens")
            if context_window is None:
                # Default to a safe value if not provided
                logger.warning(f"Venice model {model_id} missing context window, defaulting to 128000")
                context_window = 128000
            
            # Check if model supports function calling
            supports_function_calling = capabilities.get("supportsFunctionCalling", False)
            
            # Create handle: venice/{model_id}
            handle = self.get_handle(model_id)
            
            config = LLMConfig(
                model=model_id,
                model_endpoint_type="venice",
                model_endpoint=self.base_url,
                context_window=context_window,
                handle=handle,
                provider_name=self.name,
                provider_category=self.provider_category,
            )
            
            configs.append(config)
        
        # Sort by model ID for consistency
        configs.sort(key=lambda x: x.model)
        return configs

    async def list_embedding_models_async(self) -> list:
        """
        List available embedding models from Venice API.
        
        Currently Venice may not have a separate embeddings endpoint,
        so this returns an empty list for now.
        
        Returns:
            Empty list (embeddings not yet supported)
        """
        # TODO: Implement when Venice embeddings are available
        return []

