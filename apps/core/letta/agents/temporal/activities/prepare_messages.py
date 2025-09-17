from temporalio import activity

from letta.agents.helpers import _prepare_in_context_messages_no_persist_async
from letta.agents.temporal.types import PreparedMessages, WorkflowInputParams
from letta.services.message_manager import MessageManager


@activity.defn(name="prepare_messages")
async def prepare_messages(input_: WorkflowInputParams) -> PreparedMessages:
    """Prepare in-context and new input messages without persisting.

    Mirrors `_prepare_in_context_messages_no_persist_async` from the v2 agent, but
    runs as a Temporal activity so the workflow stays deterministic.
    """
    message_manager = MessageManager()
    in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
        input_messages=input_.messages,
        agent_state=input_.agent_state,
        message_manager=message_manager,
        actor=input_.actor,
    )

    return PreparedMessages(
        in_context_messages=in_context_messages,
        input_messages_to_persist=input_messages_to_persist,
    )
