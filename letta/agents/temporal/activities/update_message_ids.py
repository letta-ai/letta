from temporalio import activity

from letta.agents.temporal.types import UpdateMessageIdsParams, UpdateMessageIdsResult
from letta.services.agent_manager import AgentManager


@activity.defn(name="update_message_ids")
async def update_message_ids(params: UpdateMessageIdsParams) -> UpdateMessageIdsResult:
    """Update agent's message IDs in the database."""
    agent_manager = AgentManager()

    # update message ids in database
    await agent_manager.update_message_ids_async(
        agent_id=params.agent_id,
        message_ids=params.message_ids,
        actor=params.actor,
    )

    return UpdateMessageIdsResult(success=True)
