import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin, ProjectMixin, TemplateMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.run import Run as PydanticRun

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.message import Message
    from letta.orm.organization import Organization
    from letta.orm.step import Step


class Run(SqlalchemyBase, OrganizationMixin, ProjectMixin, TemplateMixin):
    """Runs are created when agents process messages and represent a conversation or processing session.
    Unlike Jobs, Runs are specifically tied to agent interactions and message processing.
    """

    __tablename__ = "runs"
    __pydantic_model__ = PydanticRun
    __table_args__ = (
        Index("ix_runs_created_at", "created_at", "id"),
        Index("ix_runs_agent_id", "agent_id"),
        Index("ix_runs_organization_id", "organization_id"),
    )

    # Generate run ID with run- prefix
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"run-{uuid.uuid4()}")

    # Core run fields
    status: Mapped[RunStatus] = mapped_column(String, default=RunStatus.created, doc="The current status of the run.")
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="The unix timestamp of when the run was completed.")
    stop_reason: Mapped[Optional[StopReasonType]] = mapped_column(String, nullable=True, doc="The reason why the run was stopped.")
    background: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False, doc="Whether the run was created in background mode."
    )
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, doc="The metadata of the run.")
    request_config: Mapped[Optional[LettaRequestConfig]] = mapped_column(
        JSON, nullable=True, doc="The request configuration for the run, stored as JSON."
    )

    # Agent relationship - A run belongs to one agent
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), nullable=False, doc="The agent that owns this run.")

    # Callback related columns
    callback_url: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="When set, POST to this URL after run completion.")
    callback_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="Timestamp when the callback was last attempted.")
    callback_status_code: Mapped[Optional[int]] = mapped_column(nullable=True, doc="HTTP status code returned by the callback endpoint.")
    callback_error: Mapped[Optional[str]] = mapped_column(
        nullable=True, doc="Optional error message from attempting to POST the callback endpoint."
    )

    # Timing metrics (in nanoseconds for precision)
    ttft_ns: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, doc="Time to first token in nanoseconds")
    total_duration_ns: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, doc="Total run duration in nanoseconds")

    # Relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="runs")
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="runs")

    # Steps that are part of this run
    steps: Mapped[List["Step"]] = relationship("Step", back_populates="run", cascade="all, delete-orphan")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="run", cascade="all, delete-orphan")
