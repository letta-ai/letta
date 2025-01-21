import asyncio
from typing import TYPE_CHECKING, List, Optional

from letta.constants import MULTI_AGENT_SEND_MESSAGE_MAX_RETRIES, MULTI_AGENT_SEND_MESSAGE_TIMEOUT
from letta.functions.helpers import async_send_message_with_retries
from letta.orm.errors import NoResultFound
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.agent import Agent


def send_message_to_specific_agent(self: "Agent", message: str, other_agent_id: str) -> Optional[str]:
    """
    Send a message to a specific Letta agent within the same organization.

    Args:
        message (str): The message to be sent to the target Letta agent.
        other_agent_id (str): The identifier of the target Letta agent.

    Returns:
        Optional[str]: The response from the Letta agent. It's possible that the agent does not respond.
    """
    server = get_letta_server()

    # Ensure the target agent is in the same org
    try:
        server.agent_manager.get_agent_by_id(agent_id=other_agent_id, actor=self.user)
    except NoResultFound:
        raise ValueError(
            f"The passed-in agent_id {other_agent_id} either does not exist, "
            f"or does not belong to the same org ({self.user.organization_id})."
        )

    # Async logic to send a message with retries and timeout
    async def async_send_single_agent():
        return await async_send_message_with_retries(
            server=server,
            sender_agent=self,
            target_agent_id=other_agent_id,
            message_text=message,
            max_retries=MULTI_AGENT_SEND_MESSAGE_MAX_RETRIES,  # or your chosen constants
            timeout=MULTI_AGENT_SEND_MESSAGE_TIMEOUT,  # e.g., 1200 for 20 min
            logging_prefix="[send_message_to_specific_agent]",
        )

    # Run in the current event loop or create one if needed
    try:
        return asyncio.run(async_send_single_agent())
    except RuntimeError:
        # e.g., in case there's already an active loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return loop.run_until_complete(async_send_single_agent())
        else:
            raise


def send_message_to_agents_matching_all_tags(self: "Agent", message: str, tags: List[str]) -> List[str]:
    """
    Send a message to all agents in the same organization that match ALL of the given tags.

    Messages are sent in parallel for improved performance, with retries on flaky calls and timeouts for long-running requests.
    This function does not use a cursor (pagination) and enforces a limit of 100 agents.

    Args:
        message (str): The message to be sent to each matching agent.
        tags (List[str]): The list of tags that each agent must have (match_all_tags=True).

    Returns:
        List[str]: A list of responses from the agents that match all tags.
                   Each response corresponds to one agent.
    """
    server = get_letta_server()

    # Retrieve agents that match ALL specified tags
    matching_agents = server.agent_manager.list_agents(actor=self.user, tags=tags, match_all_tags=True, cursor=None, limit=100)

    async def send_messages_to_all_agents():
        tasks = [
            async_send_message_with_retries(
                server=server,
                sender_agent=self,
                target_agent_id=agent_state.id,
                message_text=message,
                max_retries=MULTI_AGENT_SEND_MESSAGE_MAX_RETRIES,
                timeout=MULTI_AGENT_SEND_MESSAGE_TIMEOUT,
                logging_prefix="[send_message_to_agents_matching_all_tags]",
            )
            for agent_state in matching_agents
        ]
        # Run all tasks in parallel
        return await asyncio.gather(*tasks)

    # Run the async function and return results
    return asyncio.run(send_messages_to_all_agents())
