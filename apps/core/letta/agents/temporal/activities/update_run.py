from temporalio import activity

from letta.agents.temporal.types import UpdateRunParams
from letta.schemas.enums import JobStatus
from letta.schemas.letta_stop_reason import StopReasonType
from letta.services.job_manager import JobManager


@activity.defn(name="update_run")
async def update_run(params: UpdateRunParams) -> None:
    """
    Update run status and add messages to job.
    """
    job_manager = JobManager()

    # Update job status
    await job_manager.safe_update_job_status_async(
        job_id=params.run_id,
        new_status=JobStatus.completed,
        actor=params.actor,
        stop_reason=params.stop_reason.stop_reason if params.stop_reason else StopReasonType.end_turn,
    )

    # Add messages to job
    await job_manager.add_messages_to_job_async(
        job_id=params.run_id,
        message_ids=[m.id for m in params.persisted_messages if m.role != "user"],
        actor=params.actor,
    )
    return
