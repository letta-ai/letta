import uuid
import xml.etree.ElementTree as ET
from typing import List, Tuple

from letta.schemas.agent import AgentState
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_input_messages
from letta.services.message_manager import MessageManager


def _create_letta_response(
    new_in_context_messages: list[Message], use_assistant_message: bool, usage: LettaUsageStatistics
) -> LettaResponse:
    """
    Converts the newly created/persisted messages into a LettaResponse.
    """
    # NOTE: hacky solution to avoid returning heartbeat messages and the original user message
    filter_user_messages = [m for m in new_in_context_messages if m.role != "user"]
    response_messages = Message.to_letta_messages_from_list(
        messages=filter_user_messages, use_assistant_message=use_assistant_message, reverse=False
    )
    return LettaResponse(messages=response_messages, usage=usage)


def _prepare_in_context_messages(
    input_messages: List[MessageCreate],
    agent_state: AgentState,
    message_manager: MessageManager,
    actor: User,
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


async def _prepare_in_context_messages_async(
    input_messages: List[MessageCreate],
    agent_state: AgentState,
    message_manager: MessageManager,
    actor: User,
) -> Tuple[List[Message], List[Message]]:
    """
    Prepares in-context messages for an agent, based on the current state and a new user input.
    Async version of _prepare_in_context_messages.

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
        current_in_context_messages = [
            (await message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor))[0]
        ]
    else:
        # Otherwise, include the full list of messages by ID for context
        current_in_context_messages = await message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor)

    # Create a new user message from the input and store it
    new_in_context_messages = await message_manager.create_many_messages_async(
        create_input_messages(input_messages=input_messages, agent_id=agent_state.id, actor=actor), actor=actor
    )

    return current_in_context_messages, new_in_context_messages


def serialize_message_history(messages: List[str], context: str) -> str:
    """
    Produce an XML document like:

    <memory>
      <messages>
        <message>…</message>
        <message>…</message>
        …
      </messages>
      <context>…</context>
    </memory>
    """
    root = ET.Element("memory")

    msgs_el = ET.SubElement(root, "messages")
    for msg in messages:
        m = ET.SubElement(msgs_el, "message")
        m.text = msg

    sum_el = ET.SubElement(root, "context")
    sum_el.text = context

    # ET.tostring will escape reserved chars for you
    return ET.tostring(root, encoding="unicode")


def deserialize_message_history(xml_str: str) -> Tuple[List[str], str]:
    """
    Parse the XML back into (messages, context). Raises ValueError if tags are missing.
    """
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    msgs_el = root.find("messages")
    if msgs_el is None:
        raise ValueError("Missing <messages> section")

    messages = []
    for m in msgs_el.findall("message"):
        # .text may be None if empty, so coerce to empty string
        messages.append(m.text or "")

    sum_el = root.find("context")
    if sum_el is None:
        raise ValueError("Missing <context> section")
    context = sum_el.text or ""

    return messages, context


def generate_step_id():
    return f"step-{uuid.uuid4()}"
