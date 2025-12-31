from enum import Enum
from typing import Optional

from pydantic import Field

from letta.schemas.block import BlockUpdate
from letta.schemas.enums import ActorType, PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class BlockProposalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BlockEditProposalBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.BLOCK_PROPOSAL.value


class BlockEditProposal(BlockEditProposalBase):
    """Proposed edit to a block, pending approval."""

    id: str = BlockEditProposalBase.generate_id_field()
    block_id: str = Field(..., description="The id of the block this proposal targets.")
    status: BlockProposalStatus = Field(..., description="Current proposal status.")
    proposed_update: BlockUpdate = Field(..., description="Proposed block update payload.")
    base_block_version: Optional[int] = Field(
        None, description="Block version observed when the proposal was created (for conflict detection)."
    )
    base_history_entry_id: Optional[str] = Field(
        None, description="Block history entry observed when the proposal was created (for conflict detection)."
    )
    actor_type: Optional[ActorType] = Field(None, description="Actor type that created this proposal.")
    actor_id: Optional[str] = Field(None, description="Actor id that created this proposal.")
