import asyncio
from typing import TYPE_CHECKING, List

from letta.functions.helpers import (
    _send_message_to_agents_matching_tags_async,
    _send_message_to_all_agents_in_group_async,
    execute_send_message_to_agent,
    fire_and_forget_send_to_agent,
)
from letta.schemas.enums import MessageRole
from letta.schemas.message import MessageCreate

if TYPE_CHECKING:
    from letta.agent import Agent


def send_message_to_agent_and_wait_for_reply(self: "Agent", message: str, other_agent_id: str) -> str:
    """
    Sends a message to a specific Letta agent within the same organization and waits for a response. The sender's identity is automatically included, so no explicit introduction is needed in the message. This function is designed for two-way communication where a reply is expected.

    Args:
        message (str): The content of the message to be sent to the target agent.
        other_agent_id (str): The unique identifier of the target Letta agent.

    Returns:
        str: The response from the target agent.
    """
    augmented_message = (
        f"[Incoming message from agent with ID '{self.agent_state.id}' - to reply to this message, "
        f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
        f"{message}"
    )
    messages = [MessageCreate(role=MessageRole.system, content=augmented_message, name=self.agent_state.name)]

    return execute_send_message_to_agent(
        sender_agent=self,
        messages=messages,
        other_agent_id=other_agent_id,
        log_prefix="[send_message_to_agent_and_wait_for_reply]",
    )


def send_message_to_agent_async(self: "Agent", message: str, other_agent_id: str) -> str:
    """
    Sends a message to a specific Letta agent within the same organization. The sender's identity is automatically included, so no explicit introduction is required in the message. This function does not expect a response from the target agent, making it suitable for notifications or one-way communication.

    Args:
        message (str): The content of the message to be sent to the target agent.
        other_agent_id (str): The unique identifier of the target Letta agent.

    Returns:
        str: A confirmation message indicating the message was successfully sent.
    """
    message = (
        f"[Incoming message from agent with ID '{self.agent_state.id}' - to reply to this message, "
        f"make sure to use the 'send_message_to_agent_async' tool, or the agent will not receive your message] "
        f"{message}"
    )
    messages = [MessageCreate(role=MessageRole.system, content=message, name=self.agent_state.name)]

    # Do the actual fire-and-forget
    fire_and_forget_send_to_agent(
        sender_agent=self,
        messages=messages,
        other_agent_id=other_agent_id,
        log_prefix="[send_message_to_agent_async]",
        use_retries=False,  # or True if you want to use async_send_message_with_retries
    )

    # Immediately return to caller
    return "Successfully sent message"


def send_message_to_agents_matching_tags(self: "Agent", message: str, match_all: List[str], match_some: List[str]) -> List[str]:
    """
    Sends a message to all agents within the same organization that match the specified tag criteria. Agents must possess *all* of the tags in `match_all` and *at least one* of the tags in `match_some` to receive the message.

    Args:
        message (str): The content of the message to be sent to each matching agent.
        match_all (List[str]): A list of tags that an agent must possess to receive the message.
        match_some (List[str]): A list of tags where an agent must have at least one to qualify.

    Returns:
        List[str]: A list of responses from the agents that matched the filtering criteria. Each
        response corresponds to a single agent. Agents that do not respond will not have an entry
        in the returned list.
    """

    return asyncio.run(_send_message_to_agents_matching_tags_async(self, message, match_all, match_some))


def send_message_to_all_agents_in_group(self: "Agent", message: str) -> List[str]:
    """
    Sends a message to all agents within the same multi-agent group.

    Args:
        message (str): The content of the message to be sent to each matching agent.

    Returns:
        List[str]: A list of responses from the agents that matched the filtering criteria. Each
        response corresponds to a single agent. Agents that do not respond will not have an entry
        in the returned list.
    """

    return asyncio.run(_send_message_to_all_agents_in_group_async(self, message))
