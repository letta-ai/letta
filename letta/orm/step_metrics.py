from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from letta.orm.mixins import AgentMixin, ProjectMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.step_metrics import StepMetrics as PydanticStepMetrics
from letta.schemas.user import User
from letta.settings import DatabaseChoice, settings

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.run import Run
    from letta.orm.step import Step


class StepMetrics(SqlalchemyBase, ProjectMixin, AgentMixin):
    """Tracks performance metrics for agent steps."""

    __tablename__ = "step_metrics"
    __pydantic_model__ = PydanticStepMetrics

    id: Mapped[str] = mapped_column(
        ForeignKey("steps.id", ondelete="CASCADE"),
        primary_key=True,
        doc="The unique identifier of the step this metric belongs to (also serves as PK)",
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True,
        doc="The unique identifier of the organization",
    )
    provider_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("providers.id", ondelete="RESTRICT"),
        nullable=True,
        doc="The unique identifier of the provider",
    )
    run_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("runs.id", ondelete="SET NULL"),
        nullable=True,
        doc="The unique identifier of the run",
    )
    step_start_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="The timestamp of the start of the step in nanoseconds",
    )
    llm_request_start_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="The timestamp of the start of the LLM request in nanoseconds",
    )
    llm_request_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Time spent on the LLM request in nanoseconds",
    )
    tool_execution_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Time spent on tool execution in nanoseconds",
    )
    step_ns: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        doc="Total time for the step in nanoseconds",
    )
    base_template_id: Mapped[Optional[str]] = mapped_column(
        String,
        nullable=True,
        doc="The base template ID for the step",
    )
    template_id: Mapped[Optional[str]] = mapped_column(
        String,
        nullable=True,
        doc="The template ID for the step",
    )

    # Relationships (foreign keys)
    step: Mapped["Step"] = relationship("Step", back_populates="metrics", uselist=False)
    run: Mapped[Optional["Run"]] = relationship("Run")
    agent: Mapped[Optional["Agent"]] = relationship("Agent")

    def create(
        self,
        db_session: Session,
        actor: Optional[User] = None,
        no_commit: bool = False,
    ) -> "StepMetrics":
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
    ) -> "StepMetrics":
        """Override create_async to handle SQLite timestamp issues"""
        # For SQLite, explicitly set timestamps as server_default may not work
        if settings.database_engine == DatabaseChoice.SQLITE:
            now = datetime.now(timezone.utc)
            if not self.created_at:
                self.created_at = now
            if not self.updated_at:
                self.updated_at = now

        return await super().create_async(db_session, actor=actor, no_commit=no_commit, no_refresh=no_refresh)
