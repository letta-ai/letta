from typing import List, Optional

from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from sqlalchemy import BigInteger, FetchedValue, ForeignKey, Index, event, text
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from letta.orm.custom_columns import MessageContentColumn, ToolCallColumn, ToolReturnColumn
from letta.orm.mixins import AgentMixin, OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.letta_message_content import MessageContent
from letta.schemas.letta_message_content import TextContent as PydanticTextContent
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.message import ToolReturn
from letta.settings import settings


class Message(SqlalchemyBase, OrganizationMixin, AgentMixin):
    """Defines data model for storing Message objects"""

    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_agent_created_at", "agent_id", "created_at"),
        Index("ix_messages_created_at", "created_at", "id"),
        Index("ix_messages_agent_sequence", "agent_id", "sequence_id"),
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
    sender_id: Mapped[Optional[str]] = mapped_column(
        nullable=True, doc="The id of the sender of the message, can be an identity id or agent id"
    )
    batch_item_id: Mapped[Optional[str]] = mapped_column(
        nullable=True,
        doc="The id of the LLMBatchItem that this message is associated with",
    )

    # Monotonically increasing sequence for efficient/correct listing
    sequence_id: Mapped[int] = mapped_column(
        BigInteger,
        server_default=FetchedValue(),
        unique=True,
        nullable=False,
    )

    # Relationships
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
        # If there are no tool calls, set tool_calls to None
        if len(self.tool_calls) == 0:
            model.tool_calls = None
        return model


# listener


@event.listens_for(Message, "before_insert")
def set_sequence_id_for_sqlite(mapper, connection, target):
    # TODO: Kind of hacky, used to detect if we are using sqlite or not
    if not settings.letta_pg_uri_no_default:
        session = Session.object_session(target)

        if not hasattr(session, "_sequence_id_counter"):
            # Initialize counter for this flush
            max_seq = connection.scalar(text("SELECT MAX(sequence_id) FROM messages"))
            session._sequence_id_counter = max_seq or 0

        session._sequence_id_counter += 1
        target.sequence_id = session._sequence_id_counter
