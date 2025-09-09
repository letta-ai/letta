from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Enum, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.custom_columns import EmbeddingConfigColumn
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import VectorDBProvider
from letta.schemas.source import Source as PydanticSource

if TYPE_CHECKING:
    pass


class Source(SqlalchemyBase, OrganizationMixin):
    """A source represents an embedded text passage"""

    __tablename__ = "sources"
    __pydantic_model__ = PydanticSource

    __table_args__ = (
        Index("source_created_at_id_idx", "created_at", "id"),
        UniqueConstraint("name", "organization_id", name="uq_source_name_organization"),
        {"extend_existing": True},
    )

    name: Mapped[str] = mapped_column(doc="the name of the source, must be unique within the org", nullable=False)
    description: Mapped[str] = mapped_column(nullable=True, doc="a human-readable description of the source")
    instructions: Mapped[str] = mapped_column(nullable=True, doc="instructions for how to use the source")
    embedding_config: Mapped[EmbeddingConfig] = mapped_column(EmbeddingConfigColumn, doc="Configuration settings for embedding.")
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="metadata for the source.")
    vector_db_provider: Mapped[VectorDBProvider] = mapped_column(
        Enum(VectorDBProvider),
        nullable=False,
        default=VectorDBProvider.NATIVE,
        doc="The vector database provider used for this source's passages",
    )
