import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.conversation import Conversation as PydanticConversation

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.block import Block
    from letta.orm.conversation_messages import ConversationMessage


class Conversation(SqlalchemyBase, OrganizationMixin):
    """Conversations that can be created on an agent for concurrent messaging."""

    __tablename__ = "conversations"
    __pydantic_model__ = PydanticConversation
    __table_args__ = (
        Index("ix_conversations_agent_id", "agent_id"),
        Index("ix_conversations_org_agent", "organization_id", "agent_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"conv-{uuid.uuid4()}")
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="Summary of the conversation")

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="conversations", lazy="raise")
    message_associations: Mapped[List["ConversationMessage"]] = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    isolated_blocks: Mapped[List["Block"]] = relationship(
        "Block",
        secondary="blocks_conversations",
        lazy="selectin",
        passive_deletes=True,
        doc="Conversation-specific blocks that override agent defaults for isolated memory.",
    )

    def to_pydantic(self) -> PydanticConversation:
        """Converts the SQLAlchemy model to its Pydantic counterpart."""
        return self.__pydantic_model__(
            id=self.id,
            agent_id=self.agent_id,
            summary=self.summary,
            created_at=self.created_at,
            updated_at=self.updated_at,
            created_by_id=self.created_by_id,
            last_updated_by_id=self.last_updated_by_id,
            isolated_block_ids=[b.id for b in self.isolated_blocks] if self.isolated_blocks else [],
        )
