import uuid
from typing import Optional, Union

from anthropic.types.beta.messages import BetaMessageBatchIndividualResponse
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.custom_columns import AgentStepStateColumn, BatchRequestResultColumn, LLMConfigColumn
from letta.orm.mixins import AgentMixin, OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.agent import AgentStepState
from letta.schemas.enums import AgentStepStatus, JobStatus
from letta.schemas.llm_batch_job import LLMBatchItem as PydanticLLMBatchItem
from letta.schemas.llm_config import LLMConfig


class LLMBatchItem(SqlalchemyBase, OrganizationMixin, AgentMixin):
    """Represents a single agent's LLM request within a batch"""

    __tablename__ = "llm_batch_items"
    __pydantic_model__ = PydanticLLMBatchItem
    __table_args__ = (
        Index("ix_llm_batch_items_llm_batch_id", "llm_batch_id"),
        Index("ix_llm_batch_items_agent_id", "agent_id"),
        Index("ix_llm_batch_items_status", "request_status"),
    )

    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    # TODO: Some still rely on the Pydantic object to do this
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"batch_item-{uuid.uuid4()}")

    llm_batch_id: Mapped[str] = mapped_column(
        ForeignKey("llm_batch_job.id", ondelete="CASCADE"), doc="Foreign key to the LLM provider batch this item belongs to"
    )

    llm_config: Mapped[LLMConfig] = mapped_column(LLMConfigColumn, nullable=False, doc="LLM configuration specific to this request")

    request_status: Mapped[JobStatus] = mapped_column(
        String, default=JobStatus.created, doc="Status of the LLM request in the batch (PENDING, SUBMITTED, DONE, ERROR)"
    )

    step_status: Mapped[AgentStepStatus] = mapped_column(String, default=AgentStepStatus.paused, doc="Status of the agent's step execution")

    step_state: Mapped[AgentStepState] = mapped_column(
        AgentStepStateColumn, doc="Execution metadata for resuming the agent step (e.g., tool call ID, timestamps)"
    )

    batch_request_result: Mapped[Optional[Union[BetaMessageBatchIndividualResponse]]] = mapped_column(
        BatchRequestResultColumn, nullable=True, doc="Raw JSON response from the LLM for this item"
    )

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="llm_batch_items")
    batch: Mapped["LLMBatchJob"] = relationship("LLMBatchJob", back_populates="items", lazy="selectin")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="batch_items", lazy="selectin")
