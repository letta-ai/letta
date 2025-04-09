from anthropic.types.beta.messages import (
    BetaMessageBatchCanceledResult,
    BetaMessageBatchIndividualResponse,
    BetaMessageBatchSucceededResult,
)

from letta.schemas.enums import JobStatus


def map_anthropic_batch_job_status_to_job_status(anthropic_status: str) -> JobStatus:
    mapping = {
        "in_progress": JobStatus.running,
        "canceling": JobStatus.cancelled,
        "ended": JobStatus.completed,
    }
    return mapping.get(anthropic_status, JobStatus.pending)  # fallback just in case


def map_anthropic_individual_batch_item_status_to_job_status(individual_item: BetaMessageBatchIndividualResponse) -> JobStatus:
    if isinstance(individual_item.result, BetaMessageBatchSucceededResult):
        return JobStatus.completed
    elif isinstance(individual_item.result, BetaMessageBatchCanceledResult):
        return JobStatus.cancelled
    else:
        return JobStatus.failed
