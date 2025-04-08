import uuid
from datetime import datetime
from typing import List, Optional, Union

from anthropic.types.beta.messages import BetaMessageBatch
from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.custom_columns import CreateBatchResponseColumn, PollBatchResponseColumn
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import JobStatus, ProviderType
from letta.schemas.llm_batch_job import LLMBatchJob as PydanticLLMBatchJob


class LLMBatchJob(SqlalchemyBase, OrganizationMixin):
    """Represents a single LLM batch request made to a provider like Anthropic"""

    __tablename__ = "llm_batch_job"
    __table_args__ = (
        Index("ix_llm_batch_job_created_at", "created_at"),
        Index("ix_llm_batch_job_status", "status"),
    )

    __pydantic_model__ = PydanticLLMBatchJob

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"batch_req-{uuid.uuid4()}")

    status: Mapped[JobStatus] = mapped_column(String, default=JobStatus.created, doc="The current status of the batch.")

    llm_provider: Mapped[ProviderType] = mapped_column(String, doc="LLM provider used (e.g., 'Anthropic')")

    create_batch_response: Mapped[Union[BetaMessageBatch]] = mapped_column(
        CreateBatchResponseColumn, doc="Full JSON response from initial batch creation"
    )
    latest_polling_response: Mapped[Union[BetaMessageBatch]] = mapped_column(
        PollBatchResponseColumn, nullable=True, doc="Last known polling result from LLM provider"
    )

    last_polled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, doc="Last time we polled the provider for status"
    )

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="llm_batch_jobs")
    items: Mapped[List["LLMBatchItem"]] = relationship("LLMBatchItem", back_populates="batch", lazy="selectin")
