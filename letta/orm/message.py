from typing import List, Optional

from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.custom_columns import MessageContentColumn, ToolCallColumn, ToolReturnColumn
from letta.orm.mixins import AgentMixin, OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.letta_message_content import MessageContent
from letta.schemas.letta_message_content import TextContent as PydanticTextContent
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.message import ToolReturn


class Message(SqlalchemyBase, OrganizationMixin, AgentMixin):
    """Defines data model for storing Message objects"""

    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_agent_created_at", "agent_id", "created_at"),
        Index("ix_messages_created_at", "created_at", "id"),
    )
    __pydantic_model__ = PydanticMessage

    id: Mapped[str] = mapped_column(primary_key=True, doc="Unique message identifier")
    role: Mapped[str] = mapped_column(doc="Message role (user/assistant/system/tool)")
    text: Mapped[Optional[str]] = mapped_column(nullable=True, doc="Message content")
    content: Mapped[List[MessageContent]] = mapped_column(MessageContentColumn, nullable=True, doc="Message content parts")
    model: Mapped[Optional[str]] = mapped_column(nullable=True, doc="LLM model used")
    name: Mapped[Optional[str]] = mapped_column(nullable=True, doc="Name for multi-agent scenarios")
    tool_calls: Mapped[List[OpenAIToolCall]] = mapped_column(ToolCallColumn, doc="Tool call information")
    tool_call_id: Mapped[Optional[str]] = mapped_column(nullable=True, doc="ID of the tool call")
    step_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("steps.id", ondelete="SET NULL"), nullable=True, doc="ID of the step that this message belongs to"
    )
    otid: Mapped[Optional[str]] = mapped_column(nullable=True, doc="The offline threading ID associated with this message")
    tool_returns: Mapped[List[ToolReturn]] = mapped_column(
        ToolReturnColumn, nullable=True, doc="Tool execution return information for prior tool calls"
    )
    group_id: Mapped[Optional[str]] = mapped_column(nullable=True, doc="The multi-agent group that the message was sent in")

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="messages", lazy="selectin")
    organization: Mapped["Organization"] = relationship("Organization", back_populates="messages", lazy="selectin")
    step: Mapped["Step"] = relationship("Step", back_populates="messages", lazy="selectin")

    # Job relationship
    job_message: Mapped[Optional["JobMessage"]] = relationship(
        "JobMessage", back_populates="message", uselist=False, cascade="all, delete-orphan", single_parent=True
    )

    @property
    def job(self) -> Optional["Job"]:
        """Get the job associated with this message, if any."""
        return self.job_message.job if self.job_message else None

    def to_pydantic(self) -> PydanticMessage:
        """Custom pydantic conversion to handle data using legacy text field"""
        model = self.__pydantic_model__.model_validate(self)
        if self.text and not model.content:
            model.content = [PydanticTextContent(text=self.text)]
        return model
