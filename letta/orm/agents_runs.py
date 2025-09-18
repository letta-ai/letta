from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.base import Base

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.job import Job


class AgentsRuns(Base):
    __tablename__ = "agents_runs"
    __table_args__ = (
        UniqueConstraint("agent_id", "run_id", name="unique_agent_run"),
        Index("ix_agents_runs_agent_id_run_id", "agent_id", "run_id"),
        Index("ix_agents_runs_run_id_agent_id", "run_id", "agent_id"),
    )

    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), primary_key=True)
    run_id: Mapped[str] = mapped_column(String, ForeignKey("jobs.id"), primary_key=True)

    # relationships
    agent: Mapped["Agent"] = relationship("Agent", back_populates="runs")
    run: Mapped["Job"] = relationship("Job", back_populates="agent")
