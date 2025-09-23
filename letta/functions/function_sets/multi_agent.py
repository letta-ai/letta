import asyncio
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TYPE_CHECKING, List

from letta.functions.helpers import (
    _send_message_to_all_agents_in_group_async,
    execute_send_message_to_agent,
    extract_send_message_from_steps_messages,
    fire_and_forget_send_to_agent,
)
from letta.schemas.enums import MessageRole
from letta.schemas.message import MessageCreate
from letta.server.rest_api.dependencies import get_letta_server
from letta.settings import settings


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
    server = get_letta_server()
    augmented_message = (
        f"[Incoming message from external Letta agent - to reply to this message, "
        f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
        f"{message}"
    )

    # Find matching agents
    matching_agents = server.agent_manager.list_agents_matching_tags(actor=self.user, match_all=match_all, match_some=match_some)
    if not matching_agents:
        return []

    def process_agent(agent_id: str) -> str:
        """Loads an agent, formats the message, and executes .step()"""
        actor = self.user  # Ensure correct actor context
        agent = server.load_agent(agent_id=agent_id, interface=None, actor=actor)

        # Prepare the message
        messages = [MessageCreate(role=MessageRole.system, content=augmented_message, name=self.agent_state.name)]

        # Run .step() and return the response
        usage_stats = agent.step(
            input_messages=messages,
            chaining=True,
            max_chaining_steps=None,
            stream=False,
            skip_verify=True,
            metadata=None,
            put_inner_thoughts_first=True,
        )

        send_messages = extract_send_message_from_steps_messages(usage_stats.steps_messages, logger=agent.logger)
        response_data = {
            "agent_id": agent_id,
            "response_messages": send_messages if send_messages else ["<no response>"],
        }

        return json.dumps(response_data, indent=2)

    # Use ThreadPoolExecutor for parallel execution
    results = []
    with ThreadPoolExecutor(max_workers=settings.multi_agent_concurrent_sends) as executor:
        future_to_agent = {executor.submit(process_agent, agent_state.id): agent_state for agent_state in matching_agents}

        for future in as_completed(future_to_agent):
            try:
                results.append(future.result())  # Collect results
            except Exception as e:
                # Log or handle failure for specific agents if needed
                self.logger.exception(f"Error processing agent {future_to_agent[future]}: {e}")

    return results


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


def send_message_to_agent_async(self: "Agent", message: str, other_agent_id: str) -> str:
    """
    Sends a message to a specific Letta agent within the same organization. The sender's identity is automatically included, so no explicit introduction is required in the message. This function does not expect a response from the target agent, making it suitable for notifications or one-way communication.
    Args:
        message (str): The content of the message to be sent to the target agent.
        other_agent_id (str): The unique identifier of the target Letta agent.
    Returns:
        str: A confirmation message indicating the message was successfully sent.
    """
    if settings.environment == "PRODUCTION":
        raise RuntimeError("This tool is not allowed to be run on Letta Cloud.")

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
        use_retries=False,  # or True if you want to use _async_send_message_with_retries
    )

    # Immediately return to caller
    return "Successfully sent message"
