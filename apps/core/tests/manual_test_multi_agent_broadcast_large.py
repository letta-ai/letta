import json
import os

import pytest
from tqdm import tqdm

from letta import create_client
from letta.functions.functions import derive_openai_json_schema, parse_source_code
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool import Tool
from tests.integration_test_summarizer import LLM_CONFIG_DIR


@pytest.fixture(scope="function")
def client():
    filename = os.path.join(LLM_CONFIG_DIR, "claude-3-5-haiku.json")
    config_data = json.load(open(filename, "r"))
    llm_config = LLMConfig(**config_data)
    client = create_client()
    client.set_default_llm_config(llm_config)
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))

    yield client


@pytest.fixture
def roll_dice_tool(client):
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        return "Rolled a 5!"

    # Set up tool details
    source_code = parse_source_code(roll_dice)
    source_type = "python"
    description = "test_description"
    tags = ["test"]

    tool = Tool(description=description, tags=tags, source_code=source_code, source_type=source_type)
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)

    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    tool = client.server.tool_manager.create_or_update_tool(tool, actor=client.user)

    # Yield the created tool
    yield tool


@pytest.mark.parametrize("num_workers", [50])
def test_multi_agent_large(client, roll_dice_tool, num_workers):
    manager_tags = ["manager"]
    worker_tags = ["helpers"]

    # Clean up first from possibly failed tests
    prev_worker_agents = client.server.agent_manager.list_agents(client.user, tags=worker_tags + manager_tags, match_all_tags=True)
    for agent in prev_worker_agents:
        client.delete_agent(agent.id)

    # Create "manager" agent
    send_message_to_agents_matching_all_tags_tool_id = client.get_tool_id(name="send_message_to_agents_matching_all_tags")
    manager_agent_state = client.create_agent(
        name="manager", tool_ids=[send_message_to_agents_matching_all_tags_tool_id], tags=manager_tags
    )
    manager_agent = client.server.load_agent(agent_id=manager_agent_state.id, actor=client.user)

    # Create 3 worker agents
    worker_agents = []
    for idx in tqdm(range(num_workers)):
        worker_agent_state = client.create_agent(
            name=f"worker-{idx}", include_multi_agent_tools=False, tags=worker_tags, tool_ids=[roll_dice_tool.id]
        )
        worker_agent = client.server.load_agent(agent_id=worker_agent_state.id, actor=client.user)
        worker_agents.append(worker_agent)

    # Encourage the manager to send a message to the other agent_obj with the secret string
    broadcast_message = f"Send a message to all agents with tags {worker_tags} asking them to roll a dice for you!"
    client.send_message(
        agent_id=manager_agent.agent_state.id,
        role="user",
        message=broadcast_message,
    )

    # Please manually inspect the agent results
