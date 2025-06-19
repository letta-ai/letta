from datetime import datetime
from typing import Optional, Union

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse
from pydantic import BaseModel, Field

from letta.helpers import ToolRulesSolver
from letta.schemas.enums import AgentStepStatus, JobStatus, ProviderType
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.llm_config import LLMConfig


class AgentStepState(BaseModel):
    step_number: int = Field(..., description="The current step number in the agent loop")
    tool_rules_solver: ToolRulesSolver = Field(..., description="The current state of the ToolRulesSolver")


class LLMBatchItemBase(OrmMetadataBase, validate_assignment=True):
    __id_prefix__ = "batch_item"


class LLMBatchItem(LLMBatchItemBase, validate_assignment=True):
    """
    Represents a single agent's LLM request within a batch.

    This object captures the configuration, execution status, and eventual result of one agent's request within a larger LLM batch job.
    """

    id: str = LLMBatchItemBase.generate_id_field()
    llm_batch_id: str = Field(..., description="The id of the parent LLM batch job this item belongs to.")
    agent_id: str = Field(..., description="The id of the agent associated with this LLM request.")

    llm_config: LLMConfig = Field(..., description="The LLM configuration used for this request.")
    request_status: JobStatus = Field(..., description="The current status of the batch item request (e.g., PENDING, DONE, ERROR).")
    step_status: AgentStepStatus = Field(..., description="The current execution status of the agent step.")
    step_state: AgentStepState = Field(..., description="The serialized state for resuming execution at a later point.")

    batch_request_result: Optional[Union[BetaMessageBatchIndividualResponse]] = Field(
        None, description="The raw response received from the LLM provider for this item."
    )


class LLMBatchJob(OrmMetadataBase, validate_assignment=True):
    """
    Represents a single LLM batch request made to a provider like Anthropic.

    Each job corresponds to one API call that sends multiple messages to the LLM provider, and aggregates responses across all agent submissions.
    """

    __id_prefix__ = "batch_req"

    id: Optional[str] = Field(None, description="The id of the batch job. Assigned by the database.")
    status: JobStatus = Field(..., description="The current status of the batch (e.g., created, in_progress, done).")
    llm_provider: ProviderType = Field(..., description="The LLM provider used for the batch (e.g., anthropic, openai).")
    letta_batch_job_id: str = Field(..., description="ID of the Letta batch job")

    create_batch_response: Union[BetaMessageBatch] = Field(..., description="The full JSON response from the initial batch creation.")
    latest_polling_response: Optional[Union[BetaMessageBatch]] = Field(
        None, description="The most recent polling response received from the LLM provider."
    )
    last_polled_at: Optional[datetime] = Field(None, description="The timestamp of the last polling check for the batch status.")
