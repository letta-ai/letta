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
from letta.settings import DatabaseChoice, settings


class Message(SqlalchemyBase, OrganizationMixin, AgentMixin):
    """Defines data model for storing Message objects"""

    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_agent_created_at", "agent_id", "created_at"),
        Index("ix_messages_created_at", "created_at", "id"),
        Index("ix_messages_agent_sequence", "agent_id", "sequence_id"),
        Index("ix_messages_org_agent", "organization_id", "agent_id"),
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
    is_err: Mapped[Optional[bool]] = mapped_column(
        nullable=True, doc="Whether this message is part of an error step. Used only for debugging purposes."
    )

    # Monotonically increasing sequence for efficient/correct listing
    sequence_id: Mapped[int] = mapped_column(
        BigInteger,
        server_default=FetchedValue(),
        unique=True,
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="messages", lazy="raise")
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
        if self.tool_calls is None or len(self.tool_calls) == 0:
            model.tool_calls = None
        return model


# listener


@event.listens_for(Session, "before_flush")
def set_sequence_id_for_sqlite_bulk(session, flush_context, instances):
    # Handle bulk inserts for SQLite
    if settings.database_engine is DatabaseChoice.SQLITE:
        # Find all new Message objects that need sequence IDs
        new_messages = [obj for obj in session.new if isinstance(obj, Message) and obj.sequence_id is None]

        if new_messages:
            # Create a sequence table if it doesn't exist for atomic increments
            session.execute(
                text(
                    """
                CREATE TABLE IF NOT EXISTS message_sequence (
                    id INTEGER PRIMARY KEY,
                    next_val INTEGER NOT NULL DEFAULT 1
                )
            """
                )
            )

            # Initialize the sequence table if empty
            session.execute(
                text(
                    """
                INSERT OR IGNORE INTO message_sequence (id, next_val)
                SELECT 1, COALESCE(MAX(sequence_id), 0) + 1
                FROM messages
            """
                )
            )

            # Get the number of records being inserted
            records_count = len(new_messages)

            # Atomically reserve a range of sequence values for this batch
            result = session.execute(
                text(
                    """
                UPDATE message_sequence
                SET next_val = next_val + :count
                WHERE id = 1
                RETURNING next_val - :count
            """
                ),
                {"count": records_count},
            )

            start_sequence_id = result.scalar()
            if start_sequence_id is None:
                # Fallback if RETURNING doesn't work (older SQLite versions)
                session.execute(
                    text(
                        """
                    UPDATE message_sequence
                    SET next_val = next_val + :count
                    WHERE id = 1
                """
                    ),
                    {"count": records_count},
                )
                start_sequence_id = session.execute(
                    text(
                        """
                    SELECT next_val - :count FROM message_sequence WHERE id = 1
                """
                    ),
                    {"count": records_count},
                ).scalar()

            # Assign sequential IDs to each record
            for i, obj in enumerate(new_messages):
                obj.sequence_id = start_sequence_id + i


@event.listens_for(Message, "before_insert")
def set_sequence_id_for_sqlite(mapper, connection, target):
    if settings.database_engine is DatabaseChoice.SQLITE:
        # For SQLite, we need to generate sequence_id manually
        # Use a database-level atomic operation to avoid race conditions

        # Create a sequence table if it doesn't exist for atomic increments
        connection.execute(
            text(
                """
            CREATE TABLE IF NOT EXISTS message_sequence (
                id INTEGER PRIMARY KEY,
                next_val INTEGER NOT NULL DEFAULT 1
            )
        """
            )
        )

        # Initialize the sequence table if empty
        connection.execute(
            text(
                """
            INSERT OR IGNORE INTO message_sequence (id, next_val)
            SELECT 1, COALESCE(MAX(sequence_id), 0) + 1
            FROM messages
        """
            )
        )

        # Atomically get the next sequence value
        result = connection.execute(
            text(
                """
            UPDATE message_sequence
            SET next_val = next_val + 1
            WHERE id = 1
            RETURNING next_val - 1
        """
            )
        )

        sequence_id = result.scalar()
        if sequence_id is None:
            # Fallback if RETURNING doesn't work (older SQLite versions)
            connection.execute(
                text(
                    """
                UPDATE message_sequence
                SET next_val = next_val + 1
                WHERE id = 1
            """
                )
            )
            sequence_id = connection.execute(
                text(
                    """
                SELECT next_val - 1 FROM message_sequence WHERE id = 1
            """
                )
            ).scalar()

        target.sequence_id = sequence_id
