from typing import NamedTuple, Optional

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse

from letta.schemas.enums import AgentStepStatus, JobStatus


class BatchPollingResult(NamedTuple):
    llm_batch_id: str
    request_status: JobStatus
    batch_response: Optional[BetaMessageBatch]


class ItemUpdateInfo(NamedTuple):
    llm_batch_id: str
    agent_id: str
    request_status: JobStatus
    batch_request_result: Optional[BetaMessageBatchIndividualResponse]


class StepStatusUpdateInfo(NamedTuple):
    llm_batch_id: str
    agent_id: str
    step_status: AgentStepStatus


class RequestStatusUpdateInfo(NamedTuple):
    llm_batch_id: str
    agent_id: str
    request_status: JobStatus
