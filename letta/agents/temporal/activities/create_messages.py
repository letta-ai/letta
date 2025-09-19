from temporalio import activity

from letta.agents.temporal.types import CreateMessagesParams, CreateMessagesResult
from letta.services.message_manager import MessageManager


@activity.defn(name="create_messages")
async def create_messages(params: CreateMessagesParams) -> CreateMessagesResult:
    """
    Persist messages to the database.

    This activity saves the messages to the database and returns the persisted messages
    with their assigned IDs and timestamps.
    """
    message_manager = MessageManager()

    # Persist messages to database
    persisted_messages = await message_manager.create_many_messages_async(
        params.messages,
        actor=params.actor,
        project_id=params.project_id,
        template_id=params.template_id,
    )

    return CreateMessagesResult(messages=persisted_messages)
