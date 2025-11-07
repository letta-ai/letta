from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from letta.schemas.enums import PrimitiveType

if TYPE_CHECKING:
    from letta.schemas.letta_request import LettaRequest

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.enums import JobStatus, JobType
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_stop_reason import StopReasonType


class JobBase(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.JOB.value
    status: JobStatus = Field(default=JobStatus.created, description="The status of the job.")
    created_at: datetime = Field(default_factory=get_utc_time, description="The unix timestamp of when the job was created.")

    # completion related
    completed_at: Optional[datetime] = Field(None, description="The unix timestamp of when the job was completed.")
    stop_reason: Optional[StopReasonType] = Field(None, description="The reason why the job was stopped.")

    # metadata
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="The metadata of the job.")
    job_type: JobType = Field(default=JobType.JOB, description="The type of the job.")

    # Run-specific fields
    background: Optional[bool] = Field(None, description="Whether the job was created in background mode.")
    agent_id: Optional[str] = Field(None, description="The agent associated with this job/run.")

    callback_url: Optional[str] = Field(None, description="If set, POST to this URL when the job completes.")
    callback_sent_at: Optional[datetime] = Field(None, description="Timestamp when the callback was last attempted.")
    callback_status_code: Optional[int] = Field(None, description="HTTP status code returned by the callback endpoint.")
    callback_error: Optional[str] = Field(None, description="Optional error message from attempting to POST the callback endpoint.")

    # Timing metrics (in nanoseconds for precision)
    ttft_ns: int | None = Field(None, description="Time to first token for a run in nanoseconds")
    total_duration_ns: int | None = Field(None, description="Total run duration in nanoseconds")


class Job(JobBase):
    """Representation of offline jobs, used for tracking status of data loading tasks (involving parsing and embedding files)."""

    id: str = JobBase.generate_id_field()
    user_id: Optional[str] = Field(None, description="The unique identifier of the user associated with the job.")


class BatchJob(JobBase):
    id: str = JobBase.generate_id_field()
    user_id: Optional[str] = Field(None, description="The unique identifier of the user associated with the job.")
    job_type: JobType = JobType.BATCH

    @classmethod
    def from_job(cls, job: Job) -> "BatchJob":
        """
        Convert a Job instance to a BatchJob instance by replacing the ID prefix.
        All other fields are copied as-is.

        Args:
            job: The Job instance to convert

        Returns:
            A new Run instance with the same data but 'run-' prefix in ID
        """
        # Convert job dict to exclude None values
        job_data = job.model_dump(exclude_none=True)

        # Create new Run instance with converted data
        return cls(**job_data)

    def to_job(self) -> Job:
        """
        Convert this BatchJob instance to a Job instance by replacing the ID prefix.
        All other fields are copied as-is.

        Returns:
            A new Job instance with the same data but 'job-' prefix in ID
        """
        run_data = self.model_dump(exclude_none=True)
        return Job(**run_data)


class JobUpdate(JobBase):
    status: Optional[JobStatus] = Field(None, description="The status of the job.")

    model_config = ConfigDict(extra="ignore")  # Ignores extra fields


class LettaRequestConfig(BaseModel):
    use_assistant_message: bool = Field(
        default=True,
        description="Whether the server should parse specific tool call arguments (default `send_message`) as `AssistantMessage` objects.",
    )
    assistant_message_tool_name: str = Field(
        default=DEFAULT_MESSAGE_TOOL,
        description="The name of the designated message tool.",
    )
    assistant_message_tool_kwarg: str = Field(
        default=DEFAULT_MESSAGE_TOOL_KWARG,
        description="The name of the message argument in the designated message tool.",
    )
    include_return_message_types: Optional[List[MessageType]] = Field(
        default=None, description="Only return specified message types in the response. If `None` (default) returns all messages."
    )

    @classmethod
    def from_letta_request(cls, request: "LettaRequest") -> "LettaRequestConfig":
        """Create a LettaRequestConfig from a LettaRequest."""
        return cls(
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
            include_return_message_types=request.include_return_message_types,
        )
