from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase

if TYPE_CHECKING:
    from letta.orm.organization import Organization
    from letta.orm.passage import ArchivalPassage


class PassageTag(SqlalchemyBase, OrganizationMixin):
    """Junction table for tags associated with passages.

    Design: dual storage approach where tags are stored both in:
    1. JSON column in passages table (fast retrieval with passage data)
    2. This junction table (efficient DISTINCT/COUNT queries and filtering)
    """

    __tablename__ = "passage_tags"

    __table_args__ = (
        # ensure uniqueness of tag per passage
        UniqueConstraint("passage_id", "tag", name="uq_passage_tag"),
        # indexes for efficient queries
        Index("ix_passage_tags_tag", "tag"),
        Index("ix_passage_tags_org_archive", "organization_id", "archive_id"),
    )

    # primary key
    id: Mapped[str] = mapped_column(String, primary_key=True, doc="Unique identifier for the tag entry")

    # tag value
    tag: Mapped[str] = mapped_column(String, nullable=False, doc="The tag value")

    # foreign keys
    passage_id: Mapped[str] = mapped_column(
        String, ForeignKey("archival_passages.id", ondelete="CASCADE"), nullable=False, doc="ID of the passage this tag belongs to"
    )

    archive_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("archives.id", ondelete="CASCADE"),
        nullable=False,
        doc="ID of the archive this passage belongs to (denormalized for efficient queries)",
    )

    # relationships
    passage: Mapped["ArchivalPassage"] = relationship("ArchivalPassage", back_populates="passage_tags", lazy="noload")

    organization: Mapped["Organization"] = relationship("Organization", back_populates="passage_tags", lazy="selectin")
