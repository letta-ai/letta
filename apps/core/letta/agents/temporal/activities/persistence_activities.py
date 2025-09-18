from temporalio import activity

from letta.agents.temporal.types import PersistMessagesParams, PersistMessagesResult
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager


@activity.defn(name="persist_messages")
async def persist_messages_activity(
    input_: PersistMessagesParams,
    message_manager: MessageManager,
    job_manager: JobManager,
) -> PersistMessagesResult:
    """
    Persist messages to the database and update job messages if run_id is present.
    Returns the persisted messages with generated IDs.
    """
    persisted_messages = await message_manager.create_many_messages_async(
        input_.messages,
        actor=input_.actor,
        project_id=input_.project_id,
        template_id=input_.template_id,
    )

    if input_.run_id:
        await job_manager.add_messages_to_job_async(
            job_id=input_.run_id,
            message_ids=[m.id for m in persisted_messages if m.role != "user"],
            actor=input_.actor,
        )

    return PersistMessagesResult(persisted_messages=persisted_messages)
