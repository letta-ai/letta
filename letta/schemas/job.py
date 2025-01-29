from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.orm.enums import JobType
from letta.schemas.enums import JobStatus
from letta.schemas.letta_base import OrmMetadataBase


class JobBase(OrmMetadataBase):
    __id_prefix__ = "job"
    status: JobStatus = Field(default=JobStatus.created, description="The status of the job.")
    completed_at: Optional[datetime] = Field(None, description="The unix timestamp of when the job was completed.")
    metadata: Optional[dict] = Field(None, validation_alias="metadata_", description="The metadata of the job.")
    job_type: JobType = Field(default=JobType.JOB, description="The type of the job.")


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
