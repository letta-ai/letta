from typing import NamedTuple, Optional

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse

from letta.schemas.enums import AgentStepStatus, JobStatus


class BatchPollingResult(NamedTuple):
    batch_id: str
    request_status: JobStatus
    batch_response: Optional[BetaMessageBatch]


class ItemUpdateInfo(NamedTuple):
    batch_id: str
    agent_id: str
    request_status: JobStatus
    batch_request_result: Optional[BetaMessageBatchIndividualResponse]


class StepStatusUpdateInfo(NamedTuple):
    batch_id: str
    agent_id: str
    step_status: AgentStepStatus


class RequestStatusUpdateInfo(NamedTuple):
    batch_id: str
    agent_id: str
    request_status: JobStatus
