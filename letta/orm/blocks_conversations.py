from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.base import Base


class BlocksConversations(Base):
    """Tracks conversation-specific blocks that override agent defaults for isolated memory."""

    __tablename__ = "blocks_conversations"
    __table_args__ = (
        UniqueConstraint("conversation_id", "block_label", name="unique_label_per_conversation"),
        UniqueConstraint("conversation_id", "block_id", name="unique_conversation_block"),
        Index("ix_blocks_conversations_block_id", "block_id"),
    )

    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    block_id: Mapped[str] = mapped_column(String, ForeignKey("block.id", ondelete="CASCADE"), primary_key=True)
    block_label: Mapped[str] = mapped_column(String, primary_key=True)
