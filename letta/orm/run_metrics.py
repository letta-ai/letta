from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from letta.orm.mixins import AgentMixin, OrganizationMixin, ProjectMixin, TemplateMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.run_metrics import RunMetrics as PydanticRunMetrics
from letta.schemas.user import User
from letta.settings import DatabaseChoice, settings

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.run import Run
    from letta.orm.step import Step


class RunMetrics(SqlalchemyBase, ProjectMixin, AgentMixin, OrganizationMixin, TemplateMixin):
    """Tracks performance metrics for agent steps."""

    __tablename__ = "run_metrics"
    __pydantic_model__ = PydanticRunMetrics

    id: Mapped[str] = mapped_column(
        ForeignKey("runs.id", ondelete="CASCADE"),
        primary_key=True,
        doc="The unique identifier of the run this metric belongs to (also serves as PK)",
    )
    run_start_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="The timestamp of the start of the run in nanoseconds",
    )
    run_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Total time for the run in nanoseconds",
    )
    num_steps: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        doc="The number of steps in the run",
    )
    tools_used: Mapped[Optional[List[str]]] = mapped_column(
        JSON,
        nullable=True,
        doc="List of tool IDs that were used in this run",
    )
    run: Mapped[Optional["Run"]] = relationship("Run", foreign_keys=[id])
    agent: Mapped[Optional["Agent"]] = relationship("Agent")

    def create(
        self,
        db_session: Session,
        actor: Optional[User] = None,
        no_commit: bool = False,
    ) -> "RunMetrics":
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
        db_session: AsyncSession,
        actor: Optional[User] = None,
        no_commit: bool = False,
        no_refresh: bool = False,
    ) -> "RunMetrics":
        """Override create_async to handle SQLite timestamp issues"""
        # For SQLite, explicitly set timestamps as server_default may not work
        if settings.database_engine == DatabaseChoice.SQLITE:
            now = datetime.now(timezone.utc)
            if not self.created_at:
                self.created_at = now
            if not self.updated_at:
                self.updated_at = now

        return await super().create_async(db_session, actor=actor, no_commit=no_commit, no_refresh=no_refresh)
