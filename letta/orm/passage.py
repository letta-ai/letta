from typing import TYPE_CHECKING

from sqlalchemy import JSON, Column, Index
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from letta.config import LettaConfig
from letta.constants import MAX_EMBEDDING_DIM
from letta.orm.custom_columns import CommonVector, EmbeddingConfigColumn
from letta.orm.mixins import ArchiveMixin, FileMixin, OrganizationMixin, SourceMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.passage import Passage as PydanticPassage
from letta.settings import DatabaseChoice, settings

config = LettaConfig()

if TYPE_CHECKING:
    from letta.orm.organization import Organization


class BasePassage(SqlalchemyBase, OrganizationMixin):
    """Base class for all passage types with common fields"""

    __abstract__ = True
    __pydantic_model__ = PydanticPassage

    id: Mapped[str] = mapped_column(primary_key=True, doc="Unique passage identifier")
    text: Mapped[str] = mapped_column(doc="Passage text content")
    embedding_config: Mapped[dict] = mapped_column(EmbeddingConfigColumn, doc="Embedding configuration")
    metadata_: Mapped[dict] = mapped_column(JSON, doc="Additional metadata")

    # Vector embedding field based on database type
    if settings.database_engine is DatabaseChoice.POSTGRES:
        from pgvector.sqlalchemy import Vector

        embedding = mapped_column(Vector(MAX_EMBEDDING_DIM))
    else:
        embedding = Column(CommonVector)

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        """Relationship to organization"""
        return relationship("Organization", back_populates="passages", lazy="selectin")


class SourcePassage(BasePassage, FileMixin, SourceMixin):
    """Passages derived from external files/sources"""

    __tablename__ = "source_passages"

    file_name: Mapped[str] = mapped_column(doc="The name of the file that this passage was derived from")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", back_populates="source_passages", lazy="selectin")

    @declared_attr
    def __table_args__(cls):
        # TODO (cliandy): investigate if this is necessary, may be for SQLite compatability or do we need to add as well?
        if settings.database_engine is DatabaseChoice.POSTGRES:
            return (
                Index("source_passages_org_idx", "organization_id"),
                Index("source_passages_created_at_id_idx", "created_at", "id"),
                Index("source_passages_file_id_idx", "file_id"),
                {"extend_existing": True},
            )
        return (
            Index("source_passages_created_at_id_idx", "created_at", "id"),
            Index("source_passages_file_id_idx", "file_id"),
            {"extend_existing": True},
        )


class ArchivalPassage(BasePassage, ArchiveMixin):
    """Passages stored in archives as archival memories"""

    __tablename__ = "archival_passages"

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", back_populates="archival_passages", lazy="selectin")

    @declared_attr
    def __table_args__(cls):
        if settings.database_engine is DatabaseChoice.POSTGRES:
            return (
                Index("archival_passages_org_idx", "organization_id"),
                Index("ix_archival_passages_org_archive", "organization_id", "archive_id"),
                Index("archival_passages_created_at_id_idx", "created_at", "id"),
                Index("ix_archival_passages_archive_id", "archive_id"),
                {"extend_existing": True},
            )
        return (
            Index("ix_archival_passages_org_archive", "organization_id", "archive_id"),
            Index("archival_passages_created_at_id_idx", "created_at", "id"),
            Index("ix_archival_passages_archive_id", "archive_id"),
            {"extend_existing": True},
        )
