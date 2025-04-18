from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.enums import JobType
from letta.orm.mixins import UserMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import JobStatus
from letta.schemas.job import Job as PydanticJob
from letta.schemas.job import LettaRequestConfig

if TYPE_CHECKING:
    from letta.orm.job_messages import JobMessage
    from letta.orm.message import Message
    from letta.orm.step import Step
    from letta.orm.user import User


class Job(SqlalchemyBase, UserMixin):
    """Jobs run in the background and are owned by a user.
    Typical jobs involve loading and processing sources etc.
    """

    __tablename__ = "jobs"
    __pydantic_model__ = PydanticJob
    __table_args__ = (Index("ix_jobs_created_at", "created_at", "id"),)

    status: Mapped[JobStatus] = mapped_column(String, default=JobStatus.created, doc="The current status of the job.")
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="The unix timestamp of when the job was completed.")
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, doc="The metadata of the job.")
    job_type: Mapped[JobType] = mapped_column(
        String,
        default=JobType.JOB,
        doc="The type of job. This affects whether or not we generate json_schema and source_code on the fly.",
    )
    request_config: Mapped[Optional[LettaRequestConfig]] = mapped_column(
        JSON, nullable=True, doc="The request configuration for the job, stored as JSON."
    )

    # callback related columns
    callback_url: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="When set, POST to this URL after job completion.")
    callback_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="Timestamp when the callback was last attempted.")
    callback_status_code: Mapped[Optional[int]] = mapped_column(nullable=True, doc="HTTP status code returned by the callback endpoint.")

    # relationships
    user: Mapped["User"] = relationship("User", back_populates="jobs")
    job_messages: Mapped[List["JobMessage"]] = relationship("JobMessage", back_populates="job", cascade="all, delete-orphan")
    steps: Mapped[List["Step"]] = relationship("Step", back_populates="job", cascade="save-update")

    @property
    def messages(self) -> List["Message"]:
        """Get all messages associated with this job."""
        return [jm.message for jm in self.job_messages]
