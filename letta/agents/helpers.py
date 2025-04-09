from typing import List, Tuple

from letta.schemas.agent import AgentState
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_input_messages
from letta.services.message_manager import MessageManager


def _create_letta_response(new_in_context_messages: list[Message], use_assistant_message: bool) -> LettaResponse:
    """
    Converts the newly created/persisted messages into a LettaResponse.
    """
    response_messages = []
    for msg in new_in_context_messages:
        response_messages.extend(msg.to_letta_message(use_assistant_message=use_assistant_message))
    return LettaResponse(messages=response_messages, usage=LettaUsageStatistics())


def _prepare_in_context_messages(
    input_messages: List[MessageCreate], agent_state: AgentState, message_manager: MessageManager, actor: User
) -> Tuple[List[Message], List[Message]]:
    """
    Prepares in-context messages for an agent, based on the current state and a new user input.

    Args:
        input_messages (List[MessageCreate]): The new user input messages to process.
        agent_state (AgentState): The current state of the agent, including message buffer config.
        message_manager (MessageManager): The manager used to retrieve and create messages.
        actor (User): The user performing the action, used for access control and attribution.

    Returns:
        Tuple[List[Message], List[Message]]: A tuple containing:
            - The current in-context messages (existing context for the agent).
            - The new in-context messages (messages created from the new input).
    """

    if agent_state.message_buffer_autoclear:
        # If autoclear is enabled, only include the most recent system message (usually at index 0)
        current_in_context_messages = [message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=actor)[0]]
    else:
        # Otherwise, include the full list of messages by ID for context
        current_in_context_messages = message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=actor)

    # Create a new user message from the input and store it
    new_in_context_messages = message_manager.create_many_messages(
        create_input_messages(input_messages=input_messages, agent_id=agent_state.id, actor=actor), actor=actor
    )

    return current_in_context_messages, new_in_context_messages
