from datetime import datetime
from typing import Optional

from pydantic import ConfigDict, Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.enums import PrimitiveType, RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_base import LettaBase
from letta.schemas.letta_stop_reason import StopReasonType


class RunBase(LettaBase):
    __id_prefix__ = PrimitiveType.RUN.value


class Run(RunBase):
    """Representation of a run - a conversation or processing session for an agent. Runs track when agents process messages and maintain the relationship between agents, steps, and messages."""

    id: str = RunBase.generate_id_field()

    # Core run fields
    status: RunStatus = Field(default=RunStatus.created, description="The current status of the run.")
    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the run was created.")
    completed_at: Optional[datetime] = Field(None, description="The timestamp when the run was completed.")

    # Agent relationship
    agent_id: str = Field(..., description="The unique identifier of the agent associated with the run.")

    # Template fields
    base_template_id: Optional[str] = Field(None, description="The base template ID that the run belongs to.")

    # Run configuration
    background: Optional[bool] = Field(None, description="Whether the run was created in background mode.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="Additional metadata for the run.")
    request_config: Optional[LettaRequestConfig] = Field(None, description="The request configuration for the run.")
    stop_reason: Optional[StopReasonType] = Field(None, description="The reason why the run was stopped.")

    # Callback configuration
    callback_url: Optional[str] = Field(None, description="If set, POST to this URL when the run completes.")
    callback_sent_at: Optional[datetime] = Field(None, description="Timestamp when the callback was last attempted.")
    callback_status_code: Optional[int] = Field(None, description="HTTP status code returned by the callback endpoint.")
    callback_error: Optional[str] = Field(None, description="Optional error message from attempting to POST the callback endpoint.")

    # Timing metrics (in nanoseconds for precision)
    ttft_ns: Optional[int] = Field(None, description="Time to first token for a run in nanoseconds")
    total_duration_ns: Optional[int] = Field(None, description="Total run duration in nanoseconds")


class RunUpdate(RunBase):
    """Update model for Run."""

    status: Optional[RunStatus] = Field(None, description="The status of the run.")
    completed_at: Optional[datetime] = Field(None, description="The timestamp when the run was completed.")
    stop_reason: Optional[StopReasonType] = Field(None, description="The reason why the run was stopped.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="Additional metadata for the run.")
    total_duration_ns: Optional[int] = Field(None, description="Total run duration in nanoseconds")
    model_config = ConfigDict(extra="ignore")  # Ignores extra fields
