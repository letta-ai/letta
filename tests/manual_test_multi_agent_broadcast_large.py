import pytest
from tqdm import tqdm

from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent
from letta.schemas.message import MessageCreate
from letta.server.server import SyncServer
from tests.utils import create_tool_from_func


@pytest.fixture(scope="module")
def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=True)
    yield server


@pytest.fixture
def default_user(server):
    actor = server.user_manager.get_user_or_default()
    yield actor


@pytest.fixture
def roll_dice_tool(server, default_user):
    def roll_dice():
        """
        Rolls a 6-sided die.

        Returns:
            str: Result of the die roll.
        """
        return "Rolled a 5!"

    tool = create_tool_from_func(func=roll_dice)
    created_tool = server.tool_manager.create_or_update_tool(tool, actor=default_user)
    yield created_tool


@pytest.mark.parametrize("num_workers", [50])
def test_multi_agent_large(server, default_user, roll_dice_tool, num_workers):
    manager_tags = ["manager"]
    worker_tags = ["helpers"]

    # Cleanup any pre-existing agents with both tags
    prev_agents = server.agent_manager.list_agents(actor=default_user, tags=worker_tags + manager_tags, match_all_tags=True)
    for agent in prev_agents:
        server.agent_manager.delete_agent(agent.id, actor=default_user)

    # Create "manager" agent with multi-agent broadcast tool
    send_message_tool_id = server.tool_manager.get_tool_id(tool_name="send_message_to_agents_matching_tags", actor=default_user)
    manager_agent_state = server.create_agent(
        CreateAgent(
            name="manager",
            tool_ids=[send_message_tool_id],
            include_base_tools=True,
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
            tags=manager_tags,
        ),
        actor=default_user,
    )

    manager_agent = server.load_agent(agent_id=manager_agent_state.id, actor=default_user)

    # Create N worker agents
    worker_agents = []
    for idx in tqdm(range(num_workers)):
        worker_agent_state = server.create_agent(
            CreateAgent(
                name=f"worker-{idx}",
                tool_ids=[roll_dice_tool.id],
                include_multi_agent_tools=False,
                include_base_tools=True,
                model="openai/gpt-4o-mini",
                embedding="letta/letta-free",
                tags=worker_tags,
            ),
            actor=default_user,
        )
        worker_agent = server.load_agent(agent_id=worker_agent_state.id, actor=default_user)
        worker_agents.append(worker_agent)

    # Manager sends broadcast message
    broadcast_message = f"Send a message to all agents with tags {worker_tags} asking them to roll a dice for you!"
    server.send_messages(
        actor=default_user,
        agent_id=manager_agent.agent_state.id,
        input_messages=[MessageCreate(role="user", content=broadcast_message)],
    )
