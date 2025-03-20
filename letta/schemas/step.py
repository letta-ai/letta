from typing import Dict, List, Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase
from letta.schemas.message import Message


class StepBase(LettaBase):
    __id_prefix__ = "step"


class Step(StepBase):
    id: str = Field(..., description="The id of the step. Assigned by the database.")
    origin: Optional[str] = Field(None, description="The surface that this agent step was initiated from.")
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the step.")
    provider_id: Optional[str] = Field(None, description="The unique identifier of the provider that was configured for this step")
    job_id: Optional[str] = Field(
        None, description="The unique identifier of the job that this step belongs to. Only included for async calls."
    )
    agent_id: Optional[str] = Field(None, description="The ID of the agent that performed the step.")
    provider_name: Optional[str] = Field(None, description="The name of the provider used for this step.")
    model: Optional[str] = Field(None, description="The name of the model used for this step.")
    model_endpoint: Optional[str] = Field(None, description="The model endpoint url used for this step.")
    context_window_limit: Optional[int] = Field(None, description="The context window limit configured for this step.")
    completion_tokens: Optional[int] = Field(None, description="The number of tokens generated by the agent during this step.")
    prompt_tokens: Optional[int] = Field(None, description="The number of tokens in the prompt during this step.")
    total_tokens: Optional[int] = Field(None, description="The total number of tokens processed by the agent during this step.")
    completion_tokens_details: Optional[Dict] = Field(None, description="Metadata for the agent.")
    tags: List[str] = Field([], description="Metadata tags.")
    tid: Optional[str] = Field(None, description="The unique identifier of the transaction that processed this step.")
    trace_id: Optional[str] = Field(None, description="The trace id of the agent step.")
    messages: List[Message] = Field([], description="The messages generated during this step.")
