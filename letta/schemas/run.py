from typing import Optional

from pydantic import Field

from letta.orm.enums import JobType
from letta.schemas.job import Job, JobBase, LettaRequestConfig


class RunBase(JobBase):
    """Base class for Run schemas that inherits from JobBase but uses 'run' prefix for IDs"""

    __id_prefix__ = "run"
    job_type: JobType = JobType.RUN


class Run(RunBase):
    """
    Representation of a run, which is a job with a 'run' prefix in its ID.
    Inherits all fields and behavior from Job except for the ID prefix.

    Parameters:
        id (str): The unique identifier of the run (prefixed with 'run-').
        status (JobStatus): The status of the run.
        created_at (datetime): The unix timestamp of when the run was created.
        completed_at (datetime): The unix timestamp of when the run was completed.
        user_id (str): The unique identifier of the user associated with the run.
    """

    id: str = RunBase.generate_id_field()
    user_id: Optional[str] = Field(None, description="The unique identifier of the user associated with the run.")
    request_config: Optional[LettaRequestConfig] = Field(None, description="The request configuration for the run.")

    @classmethod
    def from_job(cls, job: Job) -> "Run":
        """
        Convert a Job instance to a Run instance by replacing the ID prefix.
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
        Convert this Run instance to a Job instance by replacing the ID prefix.
        All other fields are copied as-is.

        Returns:
            A new Job instance with the same data but 'job-' prefix in ID
        """
        run_data = self.model_dump(exclude_none=True)
        return Job(**run_data)
