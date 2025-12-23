from typing import Optional

from pydantic import Field

from letta.schemas.enums import ActorType, PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class BlockHistoryEntryBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.BLOCK_HISTORY.value


class BlockHistoryEntry(BlockHistoryEntryBase):
    """Snapshot of a block at a specific checkpoint."""

    id: str = BlockHistoryEntryBase.generate_id_field()
    block_id: str = Field(..., description="The id of the block this snapshot belongs to.")
    sequence_number: int = Field(..., description="Monotonically increasing checkpoint sequence number for the block.")
    description: Optional[str] = Field(None, description="Description of the block at this checkpoint.")
    label: str = Field(..., description="Label of the block at this checkpoint.")
    value: str = Field(..., description="Value of the block at this checkpoint.")
    limit: int = Field(..., description="Character limit of the block at this checkpoint.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="Metadata of the block at this checkpoint.")
    actor_type: Optional[ActorType] = Field(None, description="Actor type that created this checkpoint.")
    actor_id: Optional[str] = Field(None, description="Actor id that created this checkpoint.")
