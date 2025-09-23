from temporalio import activity

from letta.agents.temporal.types import UpdateRunParams
from letta.schemas.enums import JobStatus
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.usage import LettaUsageStatistics
from letta.services.job_manager import JobManager


@activity.defn(name="update_run")
async def update_run(params: UpdateRunParams) -> None:
    """
    Update run status and add messages to job.
    """
    job_manager = JobManager()

    # TODO: actually thread through usage, this is a hotfix for callback not including message data
    if params.stop_reason is None:
        params.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
    messages = Message.to_letta_messages_from_list(params.persisted_messages, use_assistant_message=True, reverse=False)
    result = LettaResponse(messages=messages, stop_reason=params.stop_reason, usage=LettaUsageStatistics())

    # Update job status
    await job_manager.safe_update_job_status_async(
        job_id=params.run_id,
        new_status=params.job_status,
        actor=params.actor,
        stop_reason=params.stop_reason.stop_reason if params.stop_reason else None,
        metadata={"result": result.model_dump(mode="json")},
    )

    # TODO: we shouldn't have a try / catch here and fix idempotency thoroughly, fixing to enable re-running jobs
    # Add messages to job
    try:
        if params.persisted_messages:
            await job_manager.add_messages_to_job_async(
                job_id=params.run_id,
                message_ids=[m.id for m in params.persisted_messages if m.role != "user"],
                actor=params.actor,
            )
    except Exception as e:
        print(f"Error adding messages to job: {e}")

    return
