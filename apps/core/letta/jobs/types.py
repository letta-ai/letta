from typing import Optional, Tuple

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse

from letta.schemas.enums import JobStatus

BatchId = str
AgentId = str
BatchPollingResult = Tuple[BatchId, JobStatus, Optional[BetaMessageBatch]]
ItemUpdateInfo = Tuple[BatchId, AgentId, JobStatus, BetaMessageBatchIndividualResponse]
