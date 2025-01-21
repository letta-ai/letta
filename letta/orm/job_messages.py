from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.sqlalchemy_base import SqlalchemyBase

if TYPE_CHECKING:
    from letta.orm.job import Job
    from letta.orm.message import Message


class JobMessage(SqlalchemyBase):
    """Tracks messages that were created during job execution."""

    __tablename__ = "job_messages"
    __table_args__ = (UniqueConstraint("job_id", "message_id", name="unique_job_message"),)

    id: Mapped[int] = mapped_column(primary_key=True, doc="Unique identifier for the job message")
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,  # A job message must belong to a job
        doc="ID of the job that created the message",
    )
    message_id: Mapped[str] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,  # A job message must have a message
        doc="ID of the message created by the job",
    )

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_messages")
    message: Mapped["Message"] = relationship("Message", back_populates="job_message")
