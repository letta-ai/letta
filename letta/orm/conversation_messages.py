import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase

if TYPE_CHECKING:
    from letta.orm.conversation import Conversation
    from letta.orm.message import Message


class ConversationMessage(SqlalchemyBase, OrganizationMixin):
    """
    Track in-context messages for a conversation.

    This replaces the message_ids JSON list on agents with proper relational modeling.
    - conversation_id=NULL represents the "default" conversation (backward compatible)
    - conversation_id=<id> represents a named conversation for concurrent messaging
    """

    __tablename__ = "conversation_messages"
    __table_args__ = (
        Index("ix_conv_msg_conversation_position", "conversation_id", "position"),
        Index("ix_conv_msg_message_id", "message_id"),
        Index("ix_conv_msg_agent_id", "agent_id"),
        Index("ix_conv_msg_agent_conversation", "agent_id", "conversation_id"),
        UniqueConstraint("conversation_id", "message_id", name="unique_conversation_message"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"conv_msg-{uuid.uuid4()}")
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=True,
        doc="NULL for default conversation, otherwise FK to conversation",
    )
    agent_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        doc="The agent this message association belongs to",
    )
    message_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        doc="The message being tracked",
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Position in conversation (for ordering)",
    )
    in_context: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Whether message is currently in the agent's context window",
    )

    # Relationships
    conversation: Mapped[Optional["Conversation"]] = relationship(
        "Conversation",
        back_populates="message_associations",
        lazy="raise",
    )
    message: Mapped["Message"] = relationship(
        "Message",
        lazy="selectin",
    )
