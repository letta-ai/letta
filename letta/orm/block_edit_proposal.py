import uuid
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.block_edit_proposal import BlockEditProposal as PydanticBlockEditProposal
from letta.schemas.enums import ActorType


class BlockEditProposal(OrganizationMixin, SqlalchemyBase):
    """Stores a proposed edit to a Block that can be approved or rejected."""

    __tablename__ = "block_edit_proposals"
    __pydantic_model__ = PydanticBlockEditProposal

    __table_args__ = (Index("ix_block_edit_proposals_block_id_status", "block_id", "status"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"block_proposal-{uuid.uuid4()}")

    block_id: Mapped[str] = mapped_column(String, ForeignKey("block.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    proposed_update: Mapped[dict] = mapped_column(JSON, nullable=False)

    actor_type: Mapped[Optional[ActorType]] = mapped_column(String, nullable=True)
    actor_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    base_block_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    base_history_entry_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("block_history.id", ondelete="SET NULL"), nullable=True)
