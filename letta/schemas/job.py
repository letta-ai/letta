from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.enums import JobStatus, JobType
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.letta_message import MessageType


class JobBase(OrmMetadataBase):
    __id_prefix__ = "job"
    status: JobStatus = Field(default=JobStatus.created, description="The status of the job.")
    completed_at: Optional[datetime] = Field(None, description="The unix timestamp of when the job was completed.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="The metadata of the job.")
    job_type: JobType = Field(default=JobType.JOB, description="The type of the job.")

    callback_url: Optional[str] = Field(None, description="If set, POST to this URL when the job completes.")
    callback_sent_at: Optional[datetime] = Field(None, description="Timestamp when the callback was last attempted.")
    callback_status_code: Optional[int] = Field(None, description="HTTP status code returned by the callback endpoint.")
    callback_error: Optional[str] = Field(None, description="Optional error message from attempting to POST the callback endpoint.")


class Job(JobBase):
    """
    Representation of offline jobs, used for tracking status of data loading tasks (involving parsing and embedding files).

    Parameters:
        id (str): The unique identifier of the job.
        status (JobStatus): The status of the job.
        created_at (datetime): The unix timestamp of when the job was created.
        completed_at (datetime): The unix timestamp of when the job was completed.
        user_id (str): The unique identifier of the user associated with the.

    """

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

    class Config:
        extra = "ignore"  # Ignores extra fields


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
