from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import AgentMixin, ProjectMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.step_metrics import StepMetrics as PydanticStepMetrics

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.job import Job
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
    job_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
        doc="The unique identifier of the job",
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
    job: Mapped[Optional["Job"]] = relationship("Job")
    agent: Mapped[Optional["Agent"]] = relationship("Agent")
