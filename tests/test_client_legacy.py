import os
import threading
import time
import uuid
from typing import List, Union

import pytest
from dotenv import load_dotenv
from sqlalchemy import delete

from letta.client.client import RESTClient
from letta.constants import DEFAULT_PRESET
from letta.helpers.datetime_helpers import get_utc_time
from letta.orm import FileMetadata, Source
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import (
    AssistantMessage,
    LettaMessage,
    ReasoningMessage,
    SystemMessage,
    ToolCallMessage,
    ToolReturnMessage,
    UserMessage,
)
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.services.helpers.agent_manager_helper import initialize_message_sequence
from letta.services.organization_manager import OrganizationManager
from letta.services.user_manager import UserManager

# from tests.utils import create_config

test_agent_name = f"test_client_{str(uuid.uuid4())}"
# test_preset_name = "test_preset"
test_preset_name = DEFAULT_PRESET
test_agent_state = None
client = None

test_agent_state_post_message = None


def run_server():
    load_dotenv()

    # _reset_config()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(
    scope="module",
)
def client():
    # get URL from enviornment
    server_url = os.getenv("LETTA_SERVER_URL")
    if server_url is None:
        # run server in thread
        server_url = "http://localhost:8283"
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)
    print("Running client tests with server:", server_url)
    # create user via admin client
    client = RESTClient(server_url)
    client.set_default_llm_config(LLMConfig.default_config("gpt-4o-mini"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))
    yield client


@pytest.fixture(autouse=True)
def clear_tables():
    """Fixture to clear the organization table before each test."""
    from letta.server.db import db_context

    with db_context() as session:
        session.execute(delete(FileMetadata))
        session.execute(delete(Source))
        session.commit()


# Fixture for test agent
@pytest.fixture(scope="module")
def agent(client: Union[RESTClient]):
    agent_state = client.create_agent(name=test_agent_name)
    yield agent_state

    # delete agent
    client.delete_agent(agent_state.id)


@pytest.fixture
def default_organization():
    """Fixture to create and return the default organization."""
    manager = OrganizationManager()
    org = manager.create_default_organization()
    yield org


@pytest.fixture
def default_user(default_organization):
    """Fixture to create and return the default user within the default organization."""
    manager = UserManager()
    user = manager.create_default_user(org_id=default_organization.id)
    yield user


def test_agent(disable_e2b_api_key, client: RESTClient, agent: AgentState):

    # test client.rename_agent
    new_name = "RenamedTestAgent"
    client.rename_agent(agent_id=agent.id, new_name=new_name)
    renamed_agent = client.get_agent(agent_id=agent.id)
    assert renamed_agent.name == new_name, "Agent renaming failed"

    # get agent id
    agent_id = client.get_agent_id(agent_name=new_name)
    assert agent_id == agent.id, "Agent ID retrieval failed"

    # test client.delete_agent and client.agent_exists
    delete_agent = client.create_agent(name="DeleteTestAgent")
    assert client.agent_exists(agent_id=delete_agent.id), "Agent creation failed"
    client.delete_agent(agent_id=delete_agent.id)
    assert client.agent_exists(agent_id=delete_agent.id) == False, "Agent deletion failed"


def test_memory(disable_e2b_api_key, client: RESTClient, agent: AgentState):
    # _reset_config()

    memory_response = client.get_in_context_memory(agent_id=agent.id)
    print("MEMORY", memory_response.compile())

    updated_memory = {"human": "Updated human memory", "persona": "Updated persona memory"}
    client.update_agent_memory_block(agent_id=agent.id, label="human", value=updated_memory["human"])
    client.update_agent_memory_block(agent_id=agent.id, label="persona", value=updated_memory["persona"])
    updated_memory_response = client.get_in_context_memory(agent_id=agent.id)
    assert (
        updated_memory_response.get_block("human").value == updated_memory["human"]
        and updated_memory_response.get_block("persona").value == updated_memory["persona"]
    ), "Memory update failed"


def test_agent_interactions(disable_e2b_api_key, client: RESTClient, agent: AgentState):
    # test that it is a LettaMessage
    message = "Hello again, agent!"
    print("Sending message", message)
    response = client.user_message(agent_id=agent.id, message=message)
    assert all([isinstance(m, LettaMessage) for m in response.messages]), "All messages should be LettaMessages"

    # We should also check that the types were cast properly
    print("RESPONSE MESSAGES, client type:", type(client))
    print(response.messages)
    for letta_message in response.messages:
        assert type(letta_message) in [
            SystemMessage,
            UserMessage,
            ReasoningMessage,
            ToolCallMessage,
            ToolReturnMessage,
            AssistantMessage,
        ], f"Unexpected message type: {type(letta_message)}"

    # TODO: add streaming tests


def test_archival_memory(disable_e2b_api_key, client: RESTClient, agent: AgentState):
    # _reset_config()

    memory_content = "Archival memory content"
    insert_response = client.insert_archival_memory(agent_id=agent.id, memory=memory_content)[0]
    print("Inserted memory", insert_response.text, insert_response.id)
    assert insert_response, "Inserting archival memory failed"

    archival_memory_response = client.get_archival_memory(agent_id=agent.id, limit=1)
    archival_memories = [memory.text for memory in archival_memory_response]
    assert memory_content in archival_memories, f"Retrieving archival memory failed: {archival_memories}"

    memory_id_to_delete = archival_memory_response[0].id
    client.delete_archival_memory(agent_id=agent.id, memory_id=memory_id_to_delete)

    # add archival memory
    memory_str = "I love chats"
    passage = client.insert_archival_memory(agent.id, memory=memory_str)[0]

    # list archival memory
    passages = client.get_archival_memory(agent.id)
    assert passage.text in [p.text for p in passages], f"Missing passage {passage.text} in {passages}"

    # # get archival memory summary
    # archival_summary = client.get_agent_archival_memory_summary(agent.id)
    # assert archival_summary.size == 1, f"Archival memory summary size is {archival_summary.size}"

    # delete archival memory
    client.delete_archival_memory(agent.id, passage.id)

    # TODO: check deletion
    client.get_archival_memory(agent.id)


def test_core_memory(disable_e2b_api_key, client: RESTClient, agent: AgentState):
    response = client.send_message(agent_id=agent.id, message="Update your core memory to remember that my name is Timber!", role="user")
    print("Response", response)

    memory = client.get_in_context_memory(agent_id=agent.id)
    assert "Timber" in memory.get_block("human").value, f"Updating core memory failed: {memory.get_block('human').value}"


def test_humans_personas(client: RESTClient, agent: AgentState):
    # _reset_config()

    humans_response = client.list_humans()
    print("HUMANS", humans_response)

    personas_response = client.list_personas()
    print("PERSONAS", personas_response)

    persona_name = "TestPersona"
    persona_id = client.get_persona_id(persona_name)
    if persona_id:
        client.delete_persona(persona_id)
    persona = client.create_persona(name=persona_name, text="Persona text")
    assert persona.template_name == persona_name
    assert persona.value == "Persona text", "Creating persona failed"

    human_name = "TestHuman"
    human_id = client.get_human_id(human_name)
    if human_id:
        client.delete_human(human_id)
    human = client.create_human(name=human_name, text="Human text")
    assert human.template_name == human_name
    assert human.value == "Human text", "Creating human failed"


def test_list_tools_pagination(client: RESTClient):
    tools = client.list_tools()
    visited_ids = {t.id: False for t in tools}

    cursor = None
    # Choose 3 for uneven buckets (only 7 default tools)
    num_tools = 3
    # Construct a complete pagination test to see if we can return all the tools eventually
    for _ in range(0, len(tools), num_tools):
        curr_tools = client.list_tools(cursor, num_tools)
        assert len(curr_tools) <= num_tools

        for curr_tool in curr_tools:
            assert curr_tool.id in visited_ids
            visited_ids[curr_tool.id] = True

        cursor = curr_tools[-1].id

    # Assert that everything has been visited
    assert all(visited_ids.values())


def test_organization(client: RESTClient):
    # create an organization
    org_name = "test-org"
    org = client.create_org(org_name)

    # assert the id appears
    orgs = client.list_orgs()
    assert org.id in [o.id for o in orgs]

    org = client.delete_org(org.id)
    assert org.name == org_name

    # assert the id is gone
    orgs = client.list_orgs()
    assert not (org.id in [o.id for o in orgs])


@pytest.fixture
def cleanup_agents(client):
    created_agents = []
    yield created_agents
    # Cleanup will run even if test fails
    for agent_id in created_agents:
        try:
            client.delete_agent(agent_id)
        except Exception as e:
            print(f"Failed to delete agent {agent_id}: {e}")


# NOTE: we need to add this back once agents can also create blocks during agent creation
def test_initial_message_sequence(client: RESTClient, agent: AgentState, cleanup_agents: List[str], default_user):
    """Test that we can set an initial message sequence

    If we pass in None, we should get a "default" message sequence
    If we pass in a non-empty list, we should get that sequence
    If we pass in an empty list, we should get an empty sequence
    """
    # The reference initial message sequence:
    reference_init_messages = initialize_message_sequence(
        agent_state=agent,
        memory_edit_timestamp=get_utc_time(),
        include_initial_boot_message=True,
    )

    # system, login message, send_message test, send_message receipt
    assert len(reference_init_messages) > 0
    assert len(reference_init_messages) == 4, f"Expected 4 messages, got {len(reference_init_messages)}"

    # Test with default sequence
    default_agent_state = client.create_agent(name="test-default-message-sequence", initial_message_sequence=None)
    cleanup_agents.append(default_agent_state.id)
    assert default_agent_state.message_ids is not None
    assert len(default_agent_state.message_ids) > 0
    assert len(default_agent_state.message_ids) == len(
        reference_init_messages
    ), f"Expected {len(reference_init_messages)} messages, got {len(default_agent_state.message_ids)}"

    # Test with empty sequence
    empty_agent_state = client.create_agent(name="test-empty-message-sequence", initial_message_sequence=[])
    cleanup_agents.append(empty_agent_state.id)

    custom_sequence = [MessageCreate(**{"content": "Hello, how are you?", "role": MessageRole.user})]
    custom_agent_state = client.create_agent(name="test-custom-message-sequence", initial_message_sequence=custom_sequence)
    cleanup_agents.append(custom_agent_state.id)
    assert custom_agent_state.message_ids is not None
    assert (
        len(custom_agent_state.message_ids) == len(custom_sequence) + 1
    ), f"Expected {len(custom_sequence) + 1} messages, got {len(custom_agent_state.message_ids)}"
    # assert custom_agent_state.message_ids[1:] == [msg.id for msg in custom_sequence]
    # shoule be contained in second message (after system message)
    assert custom_sequence[0].content in client.get_in_context_messages(custom_agent_state.id)[1].content[0].text


def test_add_and_manage_tags_for_agent(client: RESTClient, agent: AgentState):
    """
    Comprehensive happy path test for adding, retrieving, and managing tags on an agent.
    """

    # Step 1: Add multiple tags to the agent
    tags_to_add = ["test_tag_1", "test_tag_2", "test_tag_3"]
    client.update_agent(agent_id=agent.id, tags=tags_to_add)

    # Step 2: Retrieve tags for the agent and verify they match the added tags
    retrieved_tags = client.get_agent(agent_id=agent.id).tags
    assert set(retrieved_tags) == set(tags_to_add), f"Expected tags {tags_to_add}, but got {retrieved_tags}"

    # Step 3: Retrieve agents by each tag to ensure the agent is associated correctly
    for tag in tags_to_add:
        agents_with_tag = client.list_agents(tags=[tag])
        assert agent.id in [a.id for a in agents_with_tag], f"Expected agent {agent.id} to be associated with tag '{tag}'"

    # Step 4: Delete a specific tag from the agent and verify its removal
    tag_to_delete = tags_to_add.pop()
    client.update_agent(agent_id=agent.id, tags=tags_to_add)

    # Verify the tag is removed from the agent's tags
    remaining_tags = client.get_agent(agent_id=agent.id).tags
    assert tag_to_delete not in remaining_tags, f"Tag '{tag_to_delete}' was not removed as expected"
    assert set(remaining_tags) == set(tags_to_add), f"Expected remaining tags to be {tags_to_add[1:]}, but got {remaining_tags}"

    # Step 5: Delete all remaining tags from the agent
    client.update_agent(agent_id=agent.id, tags=[])

    # Verify all tags are removed
    final_tags = client.get_agent(agent_id=agent.id).tags
    assert len(final_tags) == 0, f"Expected no tags, but found {final_tags}"
