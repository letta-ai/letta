import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.archive import Archive as PydanticArchive
from letta.settings import DatabaseChoice, settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import Session

    from letta.orm.archives_agents import ArchivesAgents
    from letta.orm.organization import Organization
    from letta.schemas.user import User


class Archive(SqlalchemyBase, OrganizationMixin):
    """An archive represents a collection of archival passages that can be shared between agents"""

    __tablename__ = "archives"
    __pydantic_model__ = PydanticArchive

    __table_args__ = (
        Index("ix_archives_created_at", "created_at", "id"),
        Index("ix_archives_organization_id", "organization_id"),
    )

    # archive generates its own id
    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"archive-{uuid.uuid4()}")

    # archive-specific fields
    name: Mapped[str] = mapped_column(String, nullable=False, doc="The name of the archive")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="A description of the archive")
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="Additional metadata for the archive")

    # relationships
    archives_agents: Mapped[List["ArchivesAgents"]] = relationship(
        "ArchivesAgents",
        back_populates="archive",
        cascade="all, delete-orphan",  # this will delete junction entries when archive is deleted
        lazy="noload",
    )

    organization: Mapped["Organization"] = relationship("Organization", back_populates="archives", lazy="selectin")

    def create(
        self,
        db_session: "Session",
        actor: Optional["User"] = None,
        no_commit: bool = False,
    ) -> "Archive":
        """Override create to handle SQLite timestamp issues"""
        # For SQLite, explicitly set timestamps as server_default may not work
        if settings.database_engine == DatabaseChoice.SQLITE:
            now = datetime.now(timezone.utc)
            if not self.created_at:
                self.created_at = now
            if not self.updated_at:
                self.updated_at = now

        return super().create(db_session, actor=actor, no_commit=no_commit)

    async def create_async(
        self,
        db_session: "AsyncSession",
        actor: Optional["User"] = None,
        no_commit: bool = False,
        no_refresh: bool = False,
    ) -> "Archive":
        """Override create_async to handle SQLite timestamp issues"""
        # For SQLite, explicitly set timestamps as server_default may not work
        if settings.database_engine == DatabaseChoice.SQLITE:
            now = datetime.now(timezone.utc)
            if not self.created_at:
                self.created_at = now
            if not self.updated_at:
                self.updated_at = now

        return await super().create_async(db_session, actor=actor, no_commit=no_commit, no_refresh=no_refresh)
