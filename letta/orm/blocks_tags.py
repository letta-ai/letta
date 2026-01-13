from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.base import Base


class BlocksTags(Base):
    __tablename__ = "blocks_tags"
    __table_args__ = (
        UniqueConstraint("block_id", "tag", name="unique_block_tag"),
        Index("ix_blocks_tags_block_id_tag", "block_id", "tag"),
        Index("ix_blocks_tags_tag_block_id", "tag", "block_id"),
    )

    # Primary key columns
    block_id: Mapped[String] = mapped_column(String, ForeignKey("block.id"), primary_key=True)
    tag: Mapped[str] = mapped_column(String, doc="The name of the tag associated with the block.", primary_key=True)

    # Organization scoping for filtering
    organization_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id"), nullable=False)

    # Timestamps for filtering by date
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Soft delete support
    is_deleted: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))

    # Audit fields
    _created_by_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    _last_updated_by_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    block: Mapped["Block"] = relationship("Block", back_populates="tags")
