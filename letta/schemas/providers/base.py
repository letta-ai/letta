from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.embedding_config_overrides import EMBEDDING_HANDLE_OVERRIDES
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.letta_base import LettaBase
from letta.schemas.llm_config import LLMConfig
from letta.schemas.llm_config_overrides import LLM_HANDLE_OVERRIDES
from letta.settings import model_settings


class ProviderBase(LettaBase):
    __id_prefix__ = "provider"


class Provider(ProviderBase):
    id: str | None = Field(None, description="The id of the provider, lazily created by the database manager.")
    name: str = Field(..., description="The name of the provider")
    provider_type: ProviderType = Field(..., description="The type of the provider")
    provider_category: ProviderCategory = Field(..., description="The category of the provider (base or byok)")
    api_key: str | None = Field(None, description="API key or secret key used for requests to the provider.")
    base_url: str | None = Field(None, description="Base URL for the provider.")
    access_key: str | None = Field(None, description="Access key used for requests to the provider.")
    region: str | None = Field(None, description="Region used for requests to the provider.")
    api_version: str | None = Field(None, description="API version used for requests to the provider.")
    organization_id: str | None = Field(None, description="The organization id of the user")
    updated_at: datetime | None = Field(None, description="The last update timestamp of the provider.")

    @model_validator(mode="after")
    def default_base_url(self):
        if self.provider_type == ProviderType.openai and self.base_url is None:
            self.base_url = model_settings.openai_api_base
        return self

    def resolve_identifier(self):
        if not self.id:
            self.id = ProviderBase.generate_id(prefix=ProviderBase.__id_prefix__)

    async def check_api_key(self):
        """Check if the API key is valid for the provider"""
        raise NotImplementedError

    def list_llm_models(self) -> list[LLMConfig]:
        """List available LLM models (deprecated: use list_llm_models_async)"""
        import asyncio
        import warnings

        warnings.warn("list_llm_models is deprecated, use list_llm_models_async instead", DeprecationWarning, stacklevel=2)

        # Simplified asyncio handling - just use asyncio.run()
        # This works in most contexts and avoids complex event loop detection
        try:
            return asyncio.run(self.list_llm_models_async())
        except RuntimeError as e:
            # If we're in an active event loop context, use a thread pool
            if "cannot be called from a running event loop" in str(e):
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.list_llm_models_async())
                    return future.result()
            else:
                raise

    async def list_llm_models_async(self) -> list[LLMConfig]:
        return []

    def list_embedding_models(self) -> list[EmbeddingConfig]:
        """List available embedding models (deprecated: use list_embedding_models_async)"""
        import asyncio
        import warnings

        warnings.warn("list_embedding_models is deprecated, use list_embedding_models_async instead", DeprecationWarning, stacklevel=2)

        # Simplified asyncio handling - just use asyncio.run()
        # This works in most contexts and avoids complex event loop detection
        try:
            return asyncio.run(self.list_embedding_models_async())
        except RuntimeError as e:
            # If we're in an active event loop context, use a thread pool
            if "cannot be called from a running event loop" in str(e):
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.list_embedding_models_async())
                    return future.result()
            else:
                raise

    async def list_embedding_models_async(self) -> list[EmbeddingConfig]:
        """List available embedding models. The following do not have support for embedding models:
        Anthropic, Bedrock, Cerebras, Deepseek, Groq, Mistral, xAI
        """
        return []

    def get_model_context_window(self, model_name: str) -> int | None:
        raise NotImplementedError

    async def get_model_context_window_async(self, model_name: str) -> int | None:
        raise NotImplementedError

    def get_handle(self, model_name: str, is_embedding: bool = False, base_name: str | None = None) -> str:
        """
        Get the handle for a model, with support for custom overrides.

        Args:
            model_name (str): The name of the model.
            is_embedding (bool, optional): Whether the handle is for an embedding model. Defaults to False.

        Returns:
            str: The handle for the model.
        """
        base_name = base_name if base_name else self.name

        overrides = EMBEDDING_HANDLE_OVERRIDES if is_embedding else LLM_HANDLE_OVERRIDES
        if base_name in overrides and model_name in overrides[base_name]:
            model_name = overrides[base_name][model_name]

        return f"{base_name}/{model_name}"

    def cast_to_subtype(self):
        # Import here to avoid circular imports
        from letta.schemas.providers import (
            AnthropicProvider,
            AzureProvider,
            BedrockProvider,
            CerebrasProvider,
            DeepSeekProvider,
            GoogleAIProvider,
            GoogleVertexProvider,
            GroqProvider,
            LettaProvider,
            LMStudioOpenAIProvider,
            MistralProvider,
            OllamaProvider,
            OpenAIProvider,
            TogetherProvider,
            VLLMProvider,
            XAIProvider,
        )

        if self.base_url == "":
            self.base_url = None

        match self.provider_type:
            case ProviderType.letta:
                return LettaProvider(**self.model_dump(exclude_none=True))
            case ProviderType.openai:
                return OpenAIProvider(**self.model_dump(exclude_none=True))
            case ProviderType.anthropic:
                return AnthropicProvider(**self.model_dump(exclude_none=True))
            case ProviderType.google_ai:
                return GoogleAIProvider(**self.model_dump(exclude_none=True))
            case ProviderType.google_vertex:
                return GoogleVertexProvider(**self.model_dump(exclude_none=True))
            case ProviderType.azure:
                return AzureProvider(**self.model_dump(exclude_none=True))
            case ProviderType.groq:
                return GroqProvider(**self.model_dump(exclude_none=True))
            case ProviderType.together:
                return TogetherProvider(**self.model_dump(exclude_none=True))
            case ProviderType.ollama:
                return OllamaProvider(**self.model_dump(exclude_none=True))
            case ProviderType.vllm:
                return VLLMProvider(**self.model_dump(exclude_none=True))  # Removed support for CompletionsProvider
            case ProviderType.mistral:
                return MistralProvider(**self.model_dump(exclude_none=True))
            case ProviderType.deepseek:
                return DeepSeekProvider(**self.model_dump(exclude_none=True))
            case ProviderType.cerebras:
                return CerebrasProvider(**self.model_dump(exclude_none=True))
            case ProviderType.xai:
                return XAIProvider(**self.model_dump(exclude_none=True))
            case ProviderType.lmstudio_openai:
                return LMStudioOpenAIProvider(**self.model_dump(exclude_none=True))
            case ProviderType.bedrock:
                return BedrockProvider(**self.model_dump(exclude_none=True))
            case _:
                raise ValueError(f"Unknown provider type: {self.provider_type}")


class ProviderCreate(ProviderBase):
    name: str = Field(..., description="The name of the provider.")
    provider_type: ProviderType = Field(..., description="The type of the provider.")
    api_key: str = Field(..., description="API key or secret key used for requests to the provider.")
    access_key: str | None = Field(None, description="Access key used for requests to the provider.")
    region: str | None = Field(None, description="Region used for requests to the provider.")
    base_url: str | None = Field(None, description="Base URL used for requests to the provider.")
    api_version: str | None = Field(None, description="API version used for requests to the provider.")


class ProviderUpdate(ProviderBase):
    api_key: str = Field(..., description="API key or secret key used for requests to the provider.")
    access_key: str | None = Field(None, description="Access key used for requests to the provider.")
    region: str | None = Field(None, description="Region used for requests to the provider.")
    base_url: str | None = Field(None, description="Base URL used for requests to the provider.")
    api_version: str | None = Field(None, description="API version used for requests to the provider.")


class ProviderCheck(BaseModel):
    provider_type: ProviderType = Field(..., description="The type of the provider.")
    api_key: str = Field(..., description="API key or secret key used for requests to the provider.")
    access_key: str | None = Field(None, description="Access key used for requests to the provider.")
    region: str | None = Field(None, description="Region used for requests to the provider.")
    base_url: str | None = Field(None, description="Base URL used for requests to the provider.")
    api_version: str | None = Field(None, description="API version used for requests to the provider.")
