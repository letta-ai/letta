from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.provider_model import ProviderModel as PydanticProviderModel

if TYPE_CHECKING:
    from letta.orm.organization import Organization
    from letta.orm.provider import Provider


class ProviderModel(SqlalchemyBase):
    """ProviderModel ORM class - represents individual models available from providers"""

    __tablename__ = "provider_models"
    __pydantic_model__ = PydanticProviderModel
    __table_args__ = (
        UniqueConstraint(
            "handle",
            "organization_id",
            "model_type",
            name="unique_handle_per_org_and_type",
        ),
        UniqueConstraint(
            "name",
            "provider_id",
            "model_type",
            name="unique_model_per_provider_and_type",
        ),
    )

    # The unique handle used in the API (e.g., "openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet")
    # Format: {provider_name}/{display_name}
    handle: Mapped[str] = mapped_column(String, nullable=False, index=True, doc="Unique handle for API reference")

    # Display name shown in the UI for the model
    display_name: Mapped[str] = mapped_column(String, nullable=False, doc="Display name for the model")

    # The actual model name used by the provider (e.g., "gpt-4o-mini", "openai/gpt-4" for OpenRouter)
    name: Mapped[str] = mapped_column(String, nullable=False, doc="The actual model name used by the provider")

    # Foreign key to the provider
    provider_id: Mapped[str] = mapped_column(
        String, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False, index=True, doc="Provider ID reference"
    )

    # Optional organization ID - NULL for global models, set for org-scoped models
    organization_id: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Organization ID if org-scoped, NULL if global",
    )

    # Model type: llm or embedding
    model_type: Mapped[str] = mapped_column(String, nullable=False, index=True, doc="Type of model (llm or embedding)")

    # Whether the model is enabled (default True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="TRUE", doc="Whether the model is enabled")

    # Model endpoint type (e.g., "openai", "anthropic", etc.)
    model_endpoint_type: Mapped[str] = mapped_column(String, nullable=False, doc="The endpoint type for the model")

    # Additional metadata fields
    max_context_window: Mapped[int] = mapped_column(nullable=True, doc="Context window size for the model")
    supports_token_streaming: Mapped[bool] = mapped_column(Boolean, nullable=True, doc="Whether streaming is supported")
    supports_tool_calling: Mapped[bool] = mapped_column(Boolean, nullable=True, doc="Whether tool calling is supported")
    embedding_dim: Mapped[Optional[int]] = mapped_column(nullable=True, doc="Embedding dimension for embedding models")

    # relationships
    provider: Mapped["Provider"] = relationship("Provider", back_populates="models")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="provider_models")
