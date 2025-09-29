from temporalio import activity

from letta.agents.temporal.types import UpdateRunParams
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.run import RunUpdate
from letta.schemas.usage import LettaUsageStatistics
from letta.services.run_manager import RunManager


@activity.defn(name="update_run")
async def update_run(params: UpdateRunParams) -> None:
    """
    Update run status and add messages to run.
    """
    run_manager = RunManager()

    # TODO: actually thread through usage, this is a hotfix for callback not including message data
    if params.stop_reason is None:
        params.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
    messages = Message.to_letta_messages_from_list(params.persisted_messages, use_assistant_message=True, reverse=False)
    result = LettaResponse(messages=messages, stop_reason=params.stop_reason, usage=LettaUsageStatistics())

    # Update run status
    update = RunUpdate(
        status=params.run_status,
        stop_reason=params.stop_reason.stop_reason if params.stop_reason else None,
        metadata_={"result": result.model_dump(mode="json")},
    )

    await run_manager.update_run_by_id_async(
        run_id=params.run_id,
        update=update,
        actor=params.actor,
    )

    # TODO: we shouldn't have a try / catch here and fix idempotency thoroughly, fixing to enable re-running jobs
    # Note: RunManager doesn't have an add_messages method
    # Messages are typically associated with the run through steps
    # This functionality may need to be handled differently

    return
