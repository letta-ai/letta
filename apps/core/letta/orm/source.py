from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm import FileMetadata
from letta.orm.custom_columns import EmbeddingConfigColumn
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.source import Source as PydanticSource

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.file import FileMetadata
    from letta.orm.organization import Organization
    from letta.orm.passage import SourcePassage


class Source(SqlalchemyBase, OrganizationMixin):
    """A source represents an embedded text passage"""

    __tablename__ = "sources"
    __pydantic_model__ = PydanticSource

    __table_args__ = (
        Index(f"source_created_at_id_idx", "created_at", "id"),
        UniqueConstraint("name", "organization_id", name="uq_source_name_organization"),
        {"extend_existing": True},
    )

    name: Mapped[str] = mapped_column(doc="the name of the source, must be unique within the org", nullable=False)
    description: Mapped[str] = mapped_column(nullable=True, doc="a human-readable description of the source")
    instructions: Mapped[str] = mapped_column(nullable=True, doc="instructions for how to use the source")
    embedding_config: Mapped[EmbeddingConfig] = mapped_column(EmbeddingConfigColumn, doc="Configuration settings for embedding.")
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="metadata for the source.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="sources")
    files: Mapped[List["FileMetadata"]] = relationship("FileMetadata", back_populates="source", cascade="all, delete-orphan")
    passages: Mapped[List["SourcePassage"]] = relationship("SourcePassage", back_populates="source", cascade="all, delete-orphan")
    agents: Mapped[List["Agent"]] = relationship(
        "Agent",
        secondary="sources_agents",
        back_populates="sources",
        lazy="selectin",
        cascade="save-update",  # Only propagate save and update operations
        passive_deletes=True,  # Let the database handle deletions
    )
