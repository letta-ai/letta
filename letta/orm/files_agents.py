import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.file import FileAgent as PydanticFileAgent

if TYPE_CHECKING:
    pass


class FileAgent(SqlalchemyBase, OrganizationMixin):
    """
    Join table between File and Agent.

    Tracks whether a file is currently “open” for the agent and
    the specific excerpt (grepped section) the agent is looking at.
    """

    __tablename__ = "files_agents"
    __table_args__ = (Index("ix_files_agents_file_id_agent_id", "file_id", "agent_id"),)
    __pydantic_model__ = PydanticFileAgent

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"file_agent-{uuid.uuid4()}")
    file_id: Mapped[str] = mapped_column(String, ForeignKey("files.id", ondelete="CASCADE"), primary_key=True, doc="ID of the file.")
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True, doc="ID of the agent.")

    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, doc="True if the agent currently has the file open.")
    visible_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Portion of the file the agent is focused on.")
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="UTC timestamp when this agent last accessed the file.",
    )
