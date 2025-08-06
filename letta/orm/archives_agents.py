from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.base import Base


class ArchivesAgents(Base):
    """Many-to-many relationship between agents and archives"""

    __tablename__ = "archives_agents"

    # TODO: Remove this unique constraint when we support multiple archives per agent
    # For now, each agent can only have one archive
    __table_args__ = (UniqueConstraint("agent_id", name="unique_agent_archive"),)

    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    archive_id: Mapped[str] = mapped_column(String, ForeignKey("archives.id", ondelete="CASCADE"), primary_key=True)

    # track when the relationship was created and if agent is owner
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False, doc="Whether this agent created/owns the archive")

    # relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="archives_agents")
    archive: Mapped["Archive"] = relationship("Archive", back_populates="archives_agents")
