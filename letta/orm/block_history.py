import uuid
from typing import Optional

from sqlalchemy import JSON, BigInteger, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import ActorType


class BlockHistory(OrganizationMixin, SqlalchemyBase):
    """Stores a single historical state of a Block for undo/redo functionality."""

    __tablename__ = "block_history"

    __table_args__ = (
        # PRIMARY lookup index for finding specific history entries & ordering
        Index("ix_block_history_block_id_sequence", "block_id", "sequence_number", unique=True),
    )

    # agent generates its own id
    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"block_hist-{uuid.uuid4()}")

    # Snapshot State Fields (Copied from Block)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    limit: Mapped[BigInteger] = mapped_column(BigInteger, nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Editor info
    # These are not made to be FKs because these may not always exist (e.g. a User be deleted after they made a checkpoint)
    actor_type: Mapped[Optional[ActorType]] = mapped_column(String, nullable=True)
    actor_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    block_id: Mapped[str] = mapped_column(
        String, ForeignKey("block.id", ondelete="CASCADE"), nullable=False  # History deleted if Block is deleted
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer, nullable=False, doc="Monotonically increasing sequence number for the history of a specific block_id, starting from 1."
    )
