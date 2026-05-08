import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from pydantic import TypeAdapter
from sqlalchemy import JSON, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.conversation import Conversation as PydanticConversation
from letta.schemas.model import ModelSettingsUnion

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.block import Block
    from letta.orm.conversation_messages import ConversationMessage

_model_settings_adapter = TypeAdapter(ModelSettingsUnion)


class Conversation(SqlalchemyBase, OrganizationMixin):
    """Conversations that can be created on an agent for concurrent messaging."""

    __tablename__ = "conversations"
    __pydantic_model__ = PydanticConversation
    __table_args__ = (
        Index("ix_conversations_agent_id", "agent_id"),
        Index("ix_conversations_org_agent", "organization_id", "agent_id"),
        Index("ix_conversations_org_agent_last_message_at", "organization_id", "agent_id", "last_message_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"conv-{uuid.uuid4()}")
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="Summary of the conversation")
    model: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, doc="Model handle override for this conversation (format: provider/model-name)"
    )
    model_settings: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, doc="Model settings override for this conversation (provider-specific settings)"
    )
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, doc="Timestamp of the most recent message request to this conversation"
    )

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="conversations", lazy="raise")
    message_associations: Mapped[List["ConversationMessage"]] = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        lazy="raise",
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
            model=self.model,
            model_settings=_model_settings_adapter.validate_python(self.model_settings) if self.model_settings else None,
            last_message_at=self.last_message_at,
        )
