import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.provider_trace import ProviderTraceMetadata as PydanticProviderTraceMetadata


class ProviderTraceMetadata(SqlalchemyBase, OrganizationMixin):
    """Metadata-only provider trace storage (no request/response JSON)."""

    __tablename__ = "provider_trace_metadata"
    __pydantic_model__ = PydanticProviderTraceMetadata
    __table_args__ = (
        Index("ix_provider_trace_metadata_step_id", "step_id"),
        UniqueConstraint("id", name="uq_provider_trace_metadata_id"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now(), doc="Timestamp when the trace was created"
    )
    id: Mapped[str] = mapped_column(
        String, primary_key=True, doc="Unique provider trace identifier", default=lambda: f"provider_trace-{uuid.uuid4()}"
    )
    step_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="ID of the step that this trace is associated with")

    # Telemetry context fields
    agent_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="ID of the agent that generated this trace")
    agent_tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, doc="Tags associated with the agent for filtering")
    call_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="Type of call (agent_step, summarization, etc.)")
    run_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="ID of the run this trace is associated with")
    source: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, doc="Source service that generated this trace (memgpt-server, lettuce-py)"
    )

    # v2 protocol fields
    org_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="ID of the organization")
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="ID of the user who initiated the request")

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", lazy="selectin")
