from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, BigInteger, Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import UserMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import JobStatus, JobType
from letta.schemas.job import Job as PydanticJob, LettaRequestConfig
from letta.schemas.letta_stop_reason import StopReasonType

if TYPE_CHECKING:
    from letta.orm.message import Message
    from letta.orm.organization import Organization
    from letta.orm.user import User


class Job(SqlalchemyBase, UserMixin):
    """Jobs run in the background and are owned by a user.
    Typical jobs involve loading and processing sources etc.
    """

    __tablename__ = "jobs"
    __pydantic_model__ = PydanticJob
    __table_args__ = (Index("ix_jobs_user_id", "user_id"),)

    status: Mapped[JobStatus] = mapped_column(String, default=JobStatus.created, doc="The current status of the job.")
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="The unix timestamp of when the job was completed.")
    stop_reason: Mapped[Optional[StopReasonType]] = mapped_column(String, nullable=True, doc="The reason why the job was stopped.")
    background: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False, doc="Whether the job was created in background mode."
    )
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, doc="The metadata of the job.")
    job_type: Mapped[JobType] = mapped_column(
        String,
        default=JobType.JOB,
        doc="The type of job. This affects whether or not we generate json_schema and source_code on the fly.",
    )
    request_config: Mapped[Optional[LettaRequestConfig]] = mapped_column(
        JSON, nullable=True, doc="The request configuration for the job, stored as JSON."
    )
    organization_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("organizations.id"))

    # callback related columns
    callback_url: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="When set, POST to this URL after job completion.")
    callback_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, doc="Timestamp when the callback was last attempted.")
    callback_status_code: Mapped[Optional[int]] = mapped_column(nullable=True, doc="HTTP status code returned by the callback endpoint.")
    callback_error: Mapped[Optional[str]] = mapped_column(
        nullable=True, doc="Optional error message from attempting to POST the callback endpoint."
    )

    # timing metrics (in nanoseconds for precision)
    ttft_ns: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, doc="Time to first token in nanoseconds")
    total_duration_ns: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, doc="Total run duration in nanoseconds")

    # relationships
    user: Mapped["User"] = relationship("User", back_populates="jobs")
    # organization relationship (nullable for backward compatibility)
    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="jobs")

    @property
    def messages(self) -> List["Message"]:
        """Get all messages associated with this job."""
        return [jm.message for jm in self.job_messages]
