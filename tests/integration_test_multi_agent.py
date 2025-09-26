import asyncio
import json
import os
import threading
import time

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta

from letta.config import LettaConfig
from letta.functions.functions import derive_openai_json_schema, parse_source_code
from letta.schemas.letta_message import SystemMessage, ToolReturnMessage
from letta.schemas.tool import Tool
from letta.server.server import SyncServer
from letta.services.agent_manager import AgentManager
from tests.helpers.utils import retry_until_success


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it’s accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    yield url


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    server = SyncServer()
    return server


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    client_instance.tools.upsert_base_tools()
    yield client_instance


@pytest.fixture(autouse=True)
def remove_stale_agents(client):
    stale_agents = client.agents.list(limit=300)
    for agent in stale_agents:
        client.agents.delete(agent_id=agent.id)


@pytest.fixture(scope="function")
def agent_obj(client):
    """Create a test agent that we can call functions on"""
    send_message_to_agent_tool = client.tools.list(name="send_message_to_agent_and_wait_for_reply")[0]
    agent_state_instance = client.agents.create(
        include_base_tools=True,
        tool_ids=[send_message_to_agent_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        context_window_limit=32000,
    )
    yield agent_state_instance

    # client.agents.delete(agent_state_instance.id)


@pytest.fixture(scope="function")
def other_agent_obj(client):
    """Create another test agent that we can call functions on"""
    agent_state_instance = client.agents.create(
        include_base_tools=True,
        include_multi_agent_tools=False,
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        context_window_limit=32000,
    )

    yield agent_state_instance

    # client.agents.delete(agent_state_instance.id)


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

    tool = client.tools.upsert_from_function(func=roll_dice)

    # Yield the created tool
    yield tool


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agent(client, server, agent_obj, other_agent_obj):
    secret_word = "banana"
    actor = asyncio.run(server.user_manager.get_actor_or_default_async())

    # Encourage the agent to send a message to the other agent_obj with the secret string
    response = client.agents.messages.create(
        agent_id=agent_obj.id,
        messages=[
            {
                "role": "user",
                "content": f"Use your tool to send a message to another agent with id {other_agent_obj.id} to share the secret word: {secret_word}!",
            }
        ],
    )

    # Conversation search the other agent
    messages = asyncio.run(
        server.get_agent_recall(
            user_id=actor.id,
            agent_id=other_agent_obj.id,
            reverse=True,
            return_message_object=False,
        )
    )

    # Check for the presence of system message
    for m in reversed(messages):
        print(f"\n\n {other_agent_obj.id} -> {m.model_dump_json(indent=4)}")
        if isinstance(m, SystemMessage):
            assert secret_word in m.content
            break

    # Search the sender agent for the response from another agent
    in_context_messages = asyncio.run(AgentManager().get_in_context_messages(agent_id=agent_obj.id, actor=actor))
    found = False
    target_snippet = f"'agent_id': '{other_agent_obj.id}', 'response': ["

    for m in in_context_messages:
        if target_snippet in m.content[0].text:
            found = True
            break

    joined = "\n".join([m.content[0].text for m in in_context_messages[1:]])
    print(f"In context messages of the sender agent (without system):\n\n{joined}")
    if not found:
        raise Exception(f"Was not able to find an instance of the target snippet: {target_snippet}")

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=agent_obj.id,
        messages=[
            {
                "role": "user",
                "content": "So what did the other agent say?",
            }
        ],
    )
    print(response.messages)


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agents_with_tags_simple(client):
    worker_tags_123 = ["worker", "user-123"]
    worker_tags_456 = ["worker", "user-456"]

    secret_word = "banana"

    # Create "manager" agent
    send_message_to_agents_matching_tags_tool_id = client.tools.list(name="send_message_to_agents_matching_tags")[0].id
    manager_agent_state = client.agents.create(
        name="manager_agent",
        tool_ids=[send_message_to_agents_matching_tags_tool_id],
        model="openai/gpt-4o-mini",
        embedding="letta/letta-free",
    )

    # Create 3 non-matching worker agents (These should NOT get the message)
    worker_agents_123 = []
    for idx in range(2):
        worker_agent_state = client.agents.create(
            name=f"not_worker_{idx}",
            include_multi_agent_tools=False,
            tags=worker_tags_123,
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
        )
        worker_agents_123.append(worker_agent_state)

    # Create 3 worker agents that should get the message
    worker_agents_456 = []
    for idx in range(2):
        worker_agent_state = client.agents.create(
            name=f"worker_{idx}",
            include_multi_agent_tools=False,
            tags=worker_tags_456,
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
        )
        worker_agents_456.append(worker_agent_state)

    # Encourage the manager to send a message to the other agent_obj with the secret string
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            {
                "role": "user",
                "content": f"Send a message to all agents with tags {worker_tags_456} informing them of the secret word: {secret_word}!",
            }
        ],
    )

    for m in response.messages:
        if isinstance(m, ToolReturnMessage):
            tool_response = eval(json.loads(m.tool_return)["message"])
            print(f"\n\nManager agent tool response: \n{tool_response}\n\n")
            assert len(tool_response) == len(worker_agents_456)

            # We can break after this, the ToolReturnMessage after is not related
            break

    # Conversation search the worker agents
    for agent_state in worker_agents_456:
        messages = client.agents.messages.list(agent_state.id)
        # Check for the presence of system message
        for m in reversed(messages):
            print(f"\n\n {agent_state.id} -> {m.model_dump_json(indent=4)}")
            if isinstance(m, SystemMessage):
                assert secret_word in m.content
                break

    # Ensure it's NOT in the non matching worker agents
    for agent_state in worker_agents_123:
        messages = client.agents.messages.list(agent_state.id)
        # Check for the presence of system message
        for m in reversed(messages):
            print(f"\n\n {agent_state.id} -> {m.model_dump_json(indent=4)}")
            if isinstance(m, SystemMessage):
                assert secret_word not in m.content

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            {
                "role": "user",
                "content": "So what did the other agent say?",
            }
        ],
    )
    print("Manager agent followup message: \n\n" + "\n".join([str(m) for m in response.messages]))


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agents_with_tags_complex_tool_use(client, roll_dice_tool):
    # Create "manager" agent
    send_message_to_agents_matching_tags_tool_id = client.tools.list(name="send_message_to_agents_matching_tags")[0].id
    manager_agent_state = client.agents.create(
        tool_ids=[send_message_to_agents_matching_tags_tool_id],
        model="openai/gpt-4o-mini",
        embedding="letta/letta-free",
    )

    # Create 3 worker agents
    worker_agents = []
    worker_tags = ["dice-rollers"]
    for _ in range(2):
        worker_agent_state = client.agents.create(
            include_multi_agent_tools=False,
            tags=worker_tags,
            tool_ids=[roll_dice_tool.id],
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
        )
        worker_agents.append(worker_agent_state)

    # Encourage the manager to send a message to the other agent_obj with the secret string
    broadcast_message = f"Send a message to all agents with tags {worker_tags} asking them to roll a dice for you!"
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            {
                "role": "user",
                "content": broadcast_message,
            }
        ],
    )

    for m in response.messages:
        if isinstance(m, ToolReturnMessage):
            tool_response = eval(json.loads(m.tool_return)["message"])
            print(f"\n\nManager agent tool response: \n{tool_response}\n\n")
            assert len(tool_response) == len(worker_agents)

            # We can break after this, the ToolReturnMessage after is not related
            break

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            {
                "role": "user",
                "content": "So what did the other agent say?",
            }
        ],
    )
    print("Manager agent followup message: \n\n" + "\n".join([str(m) for m in response.messages]))
