import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.constants import CORE_MEMORY_SOURCE_CHAR_LIMIT, FILE_IS_TRUNCATED_WARNING
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.file import FileAgent as PydanticFileAgent

if TYPE_CHECKING:
    from letta.orm.file import FileMetadata


class FileAgent(SqlalchemyBase, OrganizationMixin):
    """
    Join table between File and Agent.

    Tracks whether a file is currently “open” for the agent and
    the specific excerpt (grepped section) the agent is looking at.
    """

    __tablename__ = "files_agents"
    __table_args__ = (
        Index("ix_files_agents_file_id_agent_id", "file_id", "agent_id"),
        UniqueConstraint("file_id", "agent_id", name="uq_files_agents_file_agent"),
        UniqueConstraint("agent_id", "file_name", name="uq_files_agents_agent_file_name"),
        Index("ix_files_agents_agent_file_name", "agent_id", "file_name"),
    )
    __pydantic_model__ = PydanticFileAgent

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"file_agent-{uuid.uuid4()}")
    file_id: Mapped[str] = mapped_column(String, ForeignKey("files.id", ondelete="CASCADE"), primary_key=True, doc="ID of the file.")
    file_name: Mapped[str] = mapped_column(String, nullable=False, doc="Denormalized copy of files.file_name; unique per agent.")
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

    # relationships
    agent: Mapped["Agent"] = relationship(
        "Agent",
        back_populates="file_agents",
        lazy="selectin",
    )
    file: Mapped["FileMetadata"] = relationship(
        "FileMetadata",
        foreign_keys=[file_id],
        lazy="selectin",
        back_populates="file_agents",
        passive_deletes=True,  # ← add this
    )

    # TODO: This is temporary as we figure out if we want FileBlock as a first class citizen
    def to_pydantic_block(self) -> PydanticBlock:
        visible_content = self.visible_content if self.visible_content and self.is_open else ""

        # Truncate content and add warnings here when converting from FileAgent to Block
        if len(visible_content) > CORE_MEMORY_SOURCE_CHAR_LIMIT:
            truncated_warning = f"...[TRUNCATED]\n{FILE_IS_TRUNCATED_WARNING}"
            visible_content = visible_content[: CORE_MEMORY_SOURCE_CHAR_LIMIT - len(truncated_warning)]
            visible_content += truncated_warning

        return PydanticBlock(
            organization_id=self.organization_id,
            value=visible_content,
            label=self.file.file_name,
            read_only=True,
        )
