import ast
import json
import os
import threading
import time

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta
from letta_client.types import AgentState, MessageCreateParam, ToolReturnMessage
from letta_client.types.agents import SystemMessage

from tests.helpers.utils import retry_until_success


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
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
def agent_obj(client: Letta) -> AgentState:
    """Create a test agent that we can call functions on"""
    send_message_to_agent_tool = list(client.tools.list(name="send_message_to_agent_and_wait_for_reply"))[0]
    agent_state_instance = client.agents.create(
        agent_type="letta_v1_agent",
        include_base_tools=True,
        tool_ids=[send_message_to_agent_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        context_window_limit=32000,
    )
    yield agent_state_instance


@pytest.fixture(scope="function")
def other_agent_obj(client: Letta) -> AgentState:
    """Create another test agent that we can call functions on"""
    agent_state_instance = client.agents.create(
        agent_type="letta_v1_agent",
        include_base_tools=True,
        include_multi_agent_tools=False,
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        context_window_limit=32000,
    )

    yield agent_state_instance


@pytest.fixture
def roll_dice_tool(client: Letta):
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        return "Rolled a 5!"

    # Use SDK method to create tool from function
    tool = client.tools.upsert_from_function(func=roll_dice)

    # Yield the created tool
    yield tool


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agent(client: Letta, agent_obj: AgentState, other_agent_obj: AgentState):
    secret_word = "banana"

    # Encourage the agent to send a message to the other agent_obj with the secret string
    response = client.agents.messages.create(
        agent_id=agent_obj.id,
        messages=[
            MessageCreateParam(
                role="user",
                content=f"Use your tool to send a message to another agent with id {other_agent_obj.id} to share the secret word: {secret_word}!",
            )
        ],
    )

    # Get messages from the other agent
    messages_page = client.agents.messages.list(agent_id=other_agent_obj.id)
    messages = messages_page.items

    # Check for the presence of system message with secret word
    found_secret = False
    for m in reversed(messages):
        print(f"\n\n {other_agent_obj.id} -> {m.model_dump_json(indent=4)}")
        if isinstance(m, SystemMessage):
            if secret_word in m.content:
                found_secret = True
                break

    assert found_secret, f"Secret word '{secret_word}' not found in system messages of agent {other_agent_obj.id}"

    # Search the sender agent for the response from another agent
    in_context_messages_page = client.agents.messages.list(agent_id=agent_obj.id)
    in_context_messages = in_context_messages_page.items
    found = False
    target_snippet = f"'agent_id': '{other_agent_obj.id}', 'response': ["

    for m in in_context_messages:
        # Check ToolReturnMessage for the response
        if isinstance(m, ToolReturnMessage):
            if target_snippet in m.tool_return:
                found = True
                break
        # Handle different message content structures
        elif hasattr(m, "content"):
            if isinstance(m.content, list) and len(m.content) > 0:
                content_text = m.content[0].text if hasattr(m.content[0], "text") else str(m.content[0])
            else:
                content_text = str(m.content)

            if target_snippet in content_text:
                found = True
                break

    if not found:
        # Print debug info
        joined = "\n".join(
            [
                str(
                    m.content[0].text
                    if hasattr(m, "content") and isinstance(m.content, list) and len(m.content) > 0 and hasattr(m.content[0], "text")
                    else m.content
                    if hasattr(m, "content")
                    else f"<{type(m).__name__}>"
                )
                for m in in_context_messages[1:]
            ]
        )
        print(f"In context messages of the sender agent (without system):\n\n{joined}")
        raise Exception(f"Was not able to find an instance of the target snippet: {target_snippet}")

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=agent_obj.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="So what did the other agent say?",
            )
        ],
    )
    print(response.messages)


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agents_with_tags_simple(client: Letta):
    worker_tags_123 = ["worker", "user-123"]
    worker_tags_456 = ["worker", "user-456"]

    secret_word = "banana"

    # Create "manager" agent
    send_message_to_agents_matching_tags_tool_id = list(client.tools.list(name="send_message_to_agents_matching_tags"))[0].id
    manager_agent_state = client.agents.create(
        agent_type="letta_v1_agent",
        name="manager_agent",
        tool_ids=[send_message_to_agents_matching_tags_tool_id],
        model="openai/gpt-4o-mini",
        embedding="letta/letta-free",
    )

    # Create 2 non-matching worker agents (These should NOT get the message)
    worker_agents_123 = []
    for idx in range(2):
        worker_agent_state = client.agents.create(
            agent_type="letta_v1_agent",
            name=f"not_worker_{idx}",
            include_multi_agent_tools=False,
            tags=worker_tags_123,
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
        )
        worker_agents_123.append(worker_agent_state)

    # Create 2 worker agents that should get the message
    worker_agents_456 = []
    for idx in range(2):
        worker_agent_state = client.agents.create(
            agent_type="letta_v1_agent",
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
            MessageCreateParam(
                role="user",
                content=f"Send a message to all agents with tags {worker_tags_456} informing them of the secret word: {secret_word}!",
            )
        ],
    )

    for m in response.messages:
        if isinstance(m, ToolReturnMessage):
            tool_response = ast.literal_eval(m.tool_return)
            print(f"\n\nManager agent tool response: \n{tool_response}\n\n")
            assert len(tool_response) == len(worker_agents_456)

            # Verify responses from all expected worker agents
            worker_agent_ids = {agent.id for agent in worker_agents_456}
            returned_agent_ids = set()
            for json_str in tool_response:
                response_obj = json.loads(json_str)
                assert response_obj["agent_id"] in worker_agent_ids
                assert response_obj["response_messages"] != ["<no response>"]
                returned_agent_ids.add(response_obj["agent_id"])
            break

    # Check messages in the worker agents that should have received the message
    for agent_state in worker_agents_456:
        messages_page = client.agents.messages.list(agent_state.id)
        messages = messages_page.items
        # Check for the presence of system message
        found_secret = False
        for m in reversed(messages):
            print(f"\n\n {agent_state.id} -> {m.model_dump_json(indent=4)}")
            if isinstance(m, SystemMessage):
                if secret_word in m.content:
                    found_secret = True
                    break
        assert found_secret, f"Secret word not found in messages for agent {agent_state.id}"

    # Ensure it's NOT in the non matching worker agents
    for agent_state in worker_agents_123:
        messages_page = client.agents.messages.list(agent_state.id)
        messages = messages_page.items
        # Check for the presence of system message
        for m in reversed(messages):
            print(f"\n\n {agent_state.id} -> {m.model_dump_json(indent=4)}")
            if isinstance(m, SystemMessage):
                assert secret_word not in m.content, f"Secret word should not be in agent {agent_state.id}"

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="So what did the other agent say?",
            )
        ],
    )
    print("Manager agent followup message: \n\n" + "\n".join([str(m) for m in response.messages]))


@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agents_with_tags_complex_tool_use(client: Letta, roll_dice_tool):
    # Create "manager" agent
    send_message_to_agents_matching_tags_tool_id = list(client.tools.list(name="send_message_to_agents_matching_tags"))[0].id
    manager_agent_state = client.agents.create(
        agent_type="letta_v1_agent",
        tool_ids=[send_message_to_agents_matching_tags_tool_id],
        model="openai/gpt-4o-mini",
        embedding="letta/letta-free",
    )

    # Create 2 worker agents
    worker_agents = []
    worker_tags = ["dice-rollers"]
    for _ in range(2):
        worker_agent_state = client.agents.create(
            agent_type="letta_v1_agent",
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
            MessageCreateParam(
                role="user",
                content=broadcast_message,
            )
        ],
    )

    for m in response.messages:
        if isinstance(m, ToolReturnMessage):
            # Parse tool_return string to get list of responses
            tool_response = ast.literal_eval(m.tool_return)
            print(f"\n\nManager agent tool response: \n{tool_response}\n\n")
            assert len(tool_response) == len(worker_agents)

            # Verify responses from all expected worker agents
            worker_agent_ids = {agent.id for agent in worker_agents}
            returned_agent_ids = set()
            all_responses = []
            for json_str in tool_response:
                response_obj = json.loads(json_str)
                assert response_obj["agent_id"] in worker_agent_ids
                assert response_obj["response_messages"] != ["<no response>"]
                returned_agent_ids.add(response_obj["agent_id"])
                all_responses.extend(response_obj["response_messages"])
            break

    # Test that the agent can still receive messages fine
    response = client.agents.messages.create(
        agent_id=manager_agent_state.id,
        messages=[
            MessageCreateParam(
                role="user",
                content="So what did the other agent say?",
            )
        ],
    )
    print("Manager agent followup message: \n\n" + "\n".join([str(m) for m in response.messages]))
