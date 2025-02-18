import json

import pytest

from letta import create_client
from letta.config import LettaConfig
from letta.orm import Base
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.server.server import SyncServer


def _clear_tables():
    from letta.server.db import db_context

    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            session.execute(table.delete())  # Truncate table
        session.commit()


@pytest.fixture(autouse=True)
def clear_tables():
    _clear_tables()


@pytest.fixture(scope="module")
def local_client():
    client = create_client()
    client.set_default_llm_config(LLMConfig.default_config("gpt-4o-mini"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))
    yield client


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=False)
    return server


@pytest.fixture
def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_default_organization()
    yield org


@pytest.fixture
def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = server.user_manager.create_default_user(org_id=default_organization.id)
    yield user


@pytest.fixture
def sarah_agent(server: SyncServer, default_user, default_organization):
    """Fixture to create and return a sample agent within the default organization."""
    agent_state = server.agent_manager.create_agent(
        agent_create=CreateAgent(
            name="sarah_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        ),
        actor=default_user,
    )
    yield agent_state


def test_agent_serialization(server, sarah_agent, default_user):
    """Test serializing an Agent instance to JSON."""
    result = server.agent_manager.serialize(agent_id=sarah_agent.id, actor=default_user)

    # Assert that the result is a dictionary (JSON object)
    assert isinstance(result, dict), "Expected a dictionary result"

    # Assert that the 'id' field is present and matches the agent's ID
    assert "id" in result, "Agent 'id' is missing in the serialized result"
    assert result["id"] == sarah_agent.id, f"Expected agent 'id' to be {sarah_agent.id}, but got {result['id']}"

    # Assert that the 'llm_config' and 'embedding_config' fields exist
    assert "llm_config" in result, "'llm_config' is missing in the serialized result"
    assert "embedding_config" in result, "'embedding_config' is missing in the serialized result"

    # Assert that 'messages' is a list
    assert isinstance(result.get("messages", []), list), "'messages' should be a list"

    # Assert that the 'tool_exec_environment_variables' field is a list (empty or populated)
    assert isinstance(result.get("tool_exec_environment_variables", []), list), "'tool_exec_environment_variables' should be a list"

    # Assert that the 'agent_type' is a valid string
    assert isinstance(result.get("agent_type"), str), "'agent_type' should be a string"

    # Assert that the 'tool_rules' field is a list (even if empty)
    assert isinstance(result.get("tool_rules", []), list), "'tool_rules' should be a list"

    # Check that all necessary fields are present in the 'messages' section, focusing on core elements
    if "messages" in result:
        for message in result["messages"]:
            assert "id" in message, "Message 'id' is missing"
            assert "text" in message, "Message 'text' is missing"
            assert "role" in message, "Message 'role' is missing"
            assert "created_at" in message, "Message 'created_at' is missing"
            assert "updated_at" in message, "Message 'updated_at' is missing"

    # Optionally check that 'created_at' and 'updated_at' are in ISO 8601 format
    assert isinstance(result["created_at"], str), "Expected 'created_at' to be a string"
    assert isinstance(result["updated_at"], str), "Expected 'updated_at' to be a string"

    # Optionally check for presence of any required metadata or ensure it is null if expected
    assert "metadata_" in result, "'metadata_' field is missing"
    assert result["metadata_"] is None, "'metadata_' should be null"

    # Assert that the agent name is as expected (if defined)
    assert result.get("name") == sarah_agent.name, "Expected agent 'name' to not be None, but found something else"

    print(json.dumps(result, indent=4))


def test_agent_deserialization_basic(local_client, server, sarah_agent, default_user):
    """Test deserializing JSON into an Agent instance."""
    # Send a message first
    sarah_agent = server.agent_manager.get_agent_by_id(agent_id=sarah_agent.id, actor=default_user)
    result = server.agent_manager.serialize(agent_id=sarah_agent.id, actor=default_user)

    # Delete the agent
    server.agent_manager.delete_agent(sarah_agent.id, actor=default_user)

    agent_state = server.agent_manager.deserialize(serialized_agent=result, actor=default_user)

    assert agent_state.name == sarah_agent.name
    assert len(agent_state.message_ids) == len(sarah_agent.message_ids)
