import json
import secrets
import string

import pytest

import letta.functions.function_sets.base as base_functions
from letta import LocalClient, create_client
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message import ToolReturnMessage
from letta.schemas.llm_config import LLMConfig
from tests.helpers.utils import retry_until_success


@pytest.fixture(scope="module")
def client():
    client = create_client()
    client.set_default_llm_config(LLMConfig.default_config("gpt-4o-mini"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))

    yield client


@pytest.fixture(scope="module")
def agent_obj(client: LocalClient):
    """Create a test agent that we can call functions on"""
    agent_state = client.create_agent(include_multi_agent_tools=True)

    agent_obj = client.server.load_agent(agent_id=agent_state.id, actor=client.user)
    yield agent_obj

    client.delete_agent(agent_obj.agent_state.id)


@pytest.fixture(scope="module")
def other_agent_obj(client: LocalClient):
    """Create another test agent that we can call functions on"""
    agent_state = client.create_agent(include_multi_agent_tools=False)

    other_agent_obj = client.server.load_agent(agent_id=agent_state.id, actor=client.user)
    yield other_agent_obj

    client.delete_agent(other_agent_obj.agent_state.id)


def query_in_search_results(search_results, query):
    for result in search_results:
        if query.lower() in result["content"].lower():
            return True
    return False


def test_archival(agent_obj):
    """Test archival memory functions comprehensively."""
    # Test 1: Basic insertion and retrieval
    base_functions.archival_memory_insert(agent_obj, "The cat sleeps on the mat")
    base_functions.archival_memory_insert(agent_obj, "The dog plays in the park")
    base_functions.archival_memory_insert(agent_obj, "Python is a programming language")

    # Test exact text search
    results, _ = base_functions.archival_memory_search(agent_obj, "cat")
    assert query_in_search_results(results, "cat")

    # Test semantic search (should return animal-related content)
    results, _ = base_functions.archival_memory_search(agent_obj, "animal pets")
    assert query_in_search_results(results, "cat") or query_in_search_results(results, "dog")

    # Test unrelated search (should not return animal content)
    results, _ = base_functions.archival_memory_search(agent_obj, "programming computers")
    assert query_in_search_results(results, "python")

    # Test 2: Test pagination
    # Insert more items to test pagination
    for i in range(10):
        base_functions.archival_memory_insert(agent_obj, f"Test passage number {i}")

    # Get first page
    page0_results, next_page = base_functions.archival_memory_search(agent_obj, "Test passage", page=0)
    # Get second page
    page1_results, _ = base_functions.archival_memory_search(agent_obj, "Test passage", page=1, start=next_page)

    assert page0_results != page1_results
    assert query_in_search_results(page0_results, "Test passage")
    assert query_in_search_results(page1_results, "Test passage")

    # Test 3: Test complex text patterns
    base_functions.archival_memory_insert(agent_obj, "Important meeting on 2024-01-15 with John")
    base_functions.archival_memory_insert(agent_obj, "Follow-up meeting scheduled for next week")
    base_functions.archival_memory_insert(agent_obj, "Project deadline is approaching")

    # Search for meeting-related content
    results, _ = base_functions.archival_memory_search(agent_obj, "meeting schedule")
    assert query_in_search_results(results, "meeting")
    assert query_in_search_results(results, "2024-01-15") or query_in_search_results(results, "next week")

    # Test 4: Test error handling
    # Test invalid page number
    try:
        base_functions.archival_memory_search(agent_obj, "test", page="invalid")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_recall(client, agent_obj):
    # keyword
    keyword = "banana"

    # Send messages to agent
    client.send_message(agent_id=agent_obj.agent_state.id, role="user", message="hello")
    client.send_message(agent_id=agent_obj.agent_state.id, role="user", message=keyword)
    client.send_message(agent_id=agent_obj.agent_state.id, role="user", message="tell me a fun fact")

    # Conversation search
    result = base_functions.conversation_search(agent_obj, "banana")
    assert keyword in result


# This test is nondeterministic, so we retry until we get the perfect behavior from the LLM
@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agent(client, agent_obj, other_agent_obj):
    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))

    # Encourage the agent to send a message to the other agent_obj with the secret string
    client.send_message(
        agent_id=agent_obj.agent_state.id,
        role="user",
        message=f"Use your tool to send a message to another agent with id {other_agent_obj.agent_state.id} with the secret password={long_random_string}",
    )

    # Conversation search the other agent
    result = base_functions.conversation_search(other_agent_obj, long_random_string)
    assert long_random_string in result

    # Search the sender agent for the response from another agent
    in_context_messages = agent_obj.agent_manager.get_in_context_messages(agent_id=agent_obj.agent_state.id, actor=agent_obj.user)
    found = False
    target_snippet = f"Agent {other_agent_obj.agent_state.id} said "

    for m in in_context_messages:
        if target_snippet in m.text:
            found = True
            break

    print(f"In context messages of the sender agent (without system):\n\n{"\n".join([m.text for m in in_context_messages[1:]])}")
    if not found:
        pytest.fail(f"Was not able to find an instance of the target snippet: {target_snippet}")

    # Test that the agent can still receive messages fine
    response = client.send_message(agent_id=agent_obj.agent_state.id, role="user", message="So what did the other agent say?")
    print(response.messages)


# This test is nondeterministic, so we retry until we get the perfect behavior from the LLM
@retry_until_success(max_attempts=5, sleep_time_seconds=2)
def test_send_message_to_agents_with_tags(client):
    worker_tags = ["worker", "user-456"]

    # Clean up first from possibly failed tests
    prev_worker_agents = client.server.agent_manager.list_agents(client.user, tags=worker_tags, match_all_tags=True)
    for agent in prev_worker_agents:
        client.delete_agent(agent.id)

    long_random_string = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))

    # Create "manager" agent
    manager_agent_state = client.create_agent(include_multi_agent_tools=True)
    manager_agent = client.server.load_agent(agent_id=manager_agent_state.id, actor=client.user)

    # Create 3 worker agents
    worker_agents = []
    worker_tags = ["worker", "user-123"]
    for _ in range(3):
        worker_agent_state = client.create_agent(include_multi_agent_tools=False, tags=worker_tags)
        worker_agent = client.server.load_agent(agent_id=worker_agent_state.id, actor=client.user)
        worker_agents.append(worker_agent)

    # Create 2 worker agents that belong to a different user (These should NOT get the message)
    worker_agents = []
    worker_tags = ["worker", "user-456"]
    for _ in range(3):
        worker_agent_state = client.create_agent(include_multi_agent_tools=False, tags=worker_tags)
        worker_agent = client.server.load_agent(agent_id=worker_agent_state.id, actor=client.user)
        worker_agents.append(worker_agent)

    # Encourage the manager to send a message to the other agent_obj with the secret string
    response = client.send_message(
        agent_id=manager_agent.agent_state.id,
        role="user",
        message=f"Send a message to all agents with tags {worker_tags} informing them of the secret password={long_random_string}",
    )

    for m in response.messages:
        if isinstance(m, ToolReturnMessage):
            tool_response = eval(json.loads(m.tool_return)["message"])
            print(f"\n\nManager agent tool response: \n{tool_response}\n\n")
            assert len(tool_response) == len(worker_agents)

            # We can break after this, the ToolReturnMessage after is not related
            break

    # Conversation search the worker agents
    for agent in worker_agents:
        result = base_functions.conversation_search(agent, long_random_string)
        assert long_random_string in result

    # Test that the agent can still receive messages fine
    response = client.send_message(agent_id=manager_agent.agent_state.id, role="user", message="So what did the other agents say?")
    print("Manager agent followup message: \n\n" + "\n".join([str(m) for m in response.messages]))

    # Clean up agents
    client.delete_agent(manager_agent_state.id)
    for agent in worker_agents:
        client.delete_agent(agent.agent_state.id)
