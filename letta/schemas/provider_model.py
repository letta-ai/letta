from datetime import datetime
from typing import Optional

from pydantic import Field

from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class ProviderModelBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.PROVIDER_MODEL.value


class ProviderModel(ProviderModelBase):
    """
    Pydantic model for provider models.

    This represents individual models available from providers with a unique handle
    that decouples the user-facing API from provider-specific implementation details.
    """

    id: str = ProviderModelBase.generate_id_field()

    # The unique handle used in the API (e.g., "openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet")
    # Format: {provider_display_name}/{model_display_name}
    handle: str = Field(..., description="Unique handle for API reference (format: provider_display_name/model_display_name)")

    # Display name shown in the UI for the model
    name: str = Field(..., description="The actual model name used by the provider")
    display_name: str = Field(..., description="Display name for the model shown in UI")

    # Foreign key to the provider
    provider_id: str = Field(..., description="Provider ID reference")

    # Optional organization ID - NULL for global models, set for org-scoped models
    organization_id: Optional[str] = Field(None, description="Organization ID if org-scoped, NULL if global")

    # Model type: llm or embedding
    model_type: str = Field(..., description="Type of model (llm or embedding)")

    # Whether the model is enabled (default True)
    enabled: bool = Field(default=True, description="Whether the model is enabled")

    # Model endpoint type (e.g., "openai", "anthropic", etc.)
    model_endpoint_type: str = Field(..., description="The endpoint type for the model (e.g., 'openai', 'anthropic')")

    # Additional metadata fields
    max_context_window: Optional[int] = Field(None, description="Context window size for the model")
    supports_token_streaming: Optional[bool] = Field(None, description="Whether token streaming is supported")
    supports_tool_calling: Optional[bool] = Field(None, description="Whether tool calling is supported")
    embedding_dim: Optional[int] = Field(None, description="Embedding dimension for embedding models")


class ProviderModelCreate(ProviderModelBase):
    """Schema for creating a new provider model"""

    handle: str = Field(..., description="Unique handle for API reference (format: provider_display_name/model_display_name)")
    display_name: str = Field(..., description="Display name for the model shown in UI")
    model_name: str = Field(..., description="The actual model name used by the provider")
    model_display_name: str = Field(..., description="Model display name used in the handle")
    provider_display_name: str = Field(..., description="Display name for the provider")
    provider_id: str = Field(..., description="Provider ID reference")
    model_type: str = Field(..., description="Type of model (llm or embedding)")
    enabled: bool = Field(default=True, description="Whether the model is enabled")
    context_window: Optional[int] = Field(None, description="Context window size for the model")
    supports_streaming: Optional[bool] = Field(None, description="Whether streaming is supported")
    supports_function_calling: Optional[bool] = Field(None, description="Whether function calling is supported")


class ProviderModelUpdate(ProviderModelBase):
    """Schema for updating a provider model"""

    display_name: Optional[str] = Field(None, description="Display name for the model shown in UI")
    enabled: Optional[bool] = Field(None, description="Whether the model is enabled")
    context_window: Optional[int] = Field(None, description="Context window size for the model")
    supports_streaming: Optional[bool] = Field(None, description="Whether streaming is supported")
    supports_function_calling: Optional[bool] = Field(None, description="Whether function calling is supported")
