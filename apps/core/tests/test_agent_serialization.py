import difflib
import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Mapping

import pytest
from fastapi.testclient import TestClient
from rich.console import Console
from rich.syntax import Syntax

from letta import create_client
from letta.config import LettaConfig
from letta.orm import Base
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.block import Block, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.user import User
from letta.server.rest_api.app import app
from letta.server.server import SyncServer

console = Console()


def _clear_tables():
    from letta.server.db import db_context

    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            session.execute(table.delete())  # Truncate table
        session.commit()


@pytest.fixture
def fastapi_client():
    """Fixture to create a FastAPI test client."""
    return TestClient(app)


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
def other_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_organization(pydantic_org=Organization(name="letta"))
    yield org


@pytest.fixture
def other_user(server: SyncServer, other_organization):
    """Fixture to create and return the default user within the default organization."""
    user = server.user_manager.create_user(pydantic_user=User(organization_id=other_organization.id, name="sarah"))
    yield user


@pytest.fixture
def weather_tool(local_client, weather_tool_func):
    weather_tool = local_client.create_or_update_tool(func=weather_tool_func)
    yield weather_tool


@pytest.fixture
def print_tool(local_client, print_tool_func):
    print_tool = local_client.create_or_update_tool(func=print_tool_func)
    yield print_tool


@pytest.fixture
def default_block(server: SyncServer, default_user):
    """Fixture to create and return a default block."""
    block_data = Block(
        label="default_label",
        value="Default Block Content",
        description="A default test block",
        limit=1000,
        metadata={"type": "test"},
    )
    block = server.block_manager.create_or_update_block(block_data, actor=default_user)
    yield block


@pytest.fixture
def serialize_test_agent(server: SyncServer, default_user, default_organization, default_block, weather_tool):
    """Fixture to create and return a sample agent within the default organization."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    f"serialize_test_agent_{timestamp}"

    server.tool_manager.upsert_base_tools(actor=default_user)

    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[weather_tool.id],
        tags=["a", "b"],
        description="test_description",
        metadata={"test_key": "test_value"},
        initial_message_sequence=[MessageCreate(role=MessageRole.user, content="hello world")],
        tool_exec_environment_variables={"test_env_var_key_a": "test_env_var_value_a", "test_env_var_key_b": "test_env_var_value_b"},
        message_buffer_autoclear=True,
    )

    agent_state = server.agent_manager.create_agent(
        agent_create=create_agent_request,
        actor=default_user,
    )
    yield agent_state


# Helper functions below


def dict_to_pretty_json(d: Dict[str, Any]) -> str:
    """Convert a dictionary to a pretty JSON string with sorted keys, handling datetime objects."""
    return json.dumps(d, indent=2, sort_keys=True, default=_json_serializable)


def _json_serializable(obj: Any) -> Any:
    """Convert non-serializable objects (like datetime) to a JSON-friendly format."""
    if isinstance(obj, datetime):
        return obj.isoformat()  # Convert datetime to ISO 8601 format
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


def print_dict_diff(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> None:
    """Prints a detailed colorized diff between two dictionaries."""
    json1 = dict_to_pretty_json(dict1).splitlines()
    json2 = dict_to_pretty_json(dict2).splitlines()

    diff = list(difflib.unified_diff(json1, json2, fromfile="Expected", tofile="Actual", lineterm=""))

    if diff:
        console.print("\n🔍 [bold red]Dictionary Diff:[/bold red]")
        diff_text = "\n".join(diff)
        syntax = Syntax(diff_text, "diff", theme="monokai", line_numbers=False)
        console.print(syntax)
    else:
        console.print("\n✅ [bold green]No differences found in dictionaries.[/bold green]")


def has_same_prefix(value1: Any, value2: Any) -> bool:
    """Check if two string values have the same major prefix (before the second hyphen)."""
    if not isinstance(value1, str) or not isinstance(value2, str):
        return False

    prefix1 = value1.split("-")[0]
    prefix2 = value2.split("-")[0]

    return prefix1 == prefix2


def compare_lists(list1: List[Any], list2: List[Any]) -> bool:
    """Compare lists while handling unordered dictionaries inside."""
    if len(list1) != len(list2):
        return False

    if all(isinstance(item, Mapping) for item in list1) and all(isinstance(item, Mapping) for item in list2):
        return all(any(_compare_agent_state_model_dump(i1, i2, log=False) for i2 in list2) for i1 in list1)

    return sorted(list1) == sorted(list2)


def strip_datetime_fields(d: Dict[str, Any]) -> Dict[str, Any]:
    """Remove datetime fields from a dictionary before comparison."""
    return {k: v for k, v in d.items() if not isinstance(v, datetime)}


def _log_mismatch(key: str, expected: Any, actual: Any, log: bool) -> None:
    """Log detailed information about a mismatch."""
    if log:
        print(f"\n🔴 Mismatch Found in Key: '{key}'")
        print(f"Expected: {expected}")
        print(f"Actual:   {actual}")

        if isinstance(expected, str) and isinstance(actual, str):
            print("\n🔍 String Diff:")
            diff = difflib.ndiff(expected.splitlines(), actual.splitlines())
            print("\n".join(diff))


def _compare_agent_state_model_dump(d1: Dict[str, Any], d2: Dict[str, Any], log: bool = True) -> bool:
    """
    Compare two dictionaries with special handling:
    - Keys in `ignore_prefix_fields` should match only by prefix.
    - 'message_ids' lists should match in length only.
    - Datetime fields are ignored.
    - Order-independent comparison for lists of dicts.
    """
    ignore_prefix_fields = {"id", "last_updated_by_id", "organization_id", "created_by_id", "agent_id"}

    # Remove datetime fields upfront
    d1 = strip_datetime_fields(d1)
    d2 = strip_datetime_fields(d2)

    if d1.keys() != d2.keys():
        _log_mismatch("dict_keys", set(d1.keys()), set(d2.keys()))
        return False

    for key, v1 in d1.items():
        v2 = d2[key]

        if key in ignore_prefix_fields:
            if v1 and v2 and not has_same_prefix(v1, v2):
                _log_mismatch(key, v1, v2, log)
                return False
        elif key == "message_ids":
            if not isinstance(v1, list) or not isinstance(v2, list) or len(v1) != len(v2):
                _log_mismatch(key, v1, v2, log)
                return False
        elif isinstance(v1, Dict) and isinstance(v2, Dict):
            if not _compare_agent_state_model_dump(v1, v2):
                _log_mismatch(key, v1, v2, log)
                return False
        elif isinstance(v1, list) and isinstance(v2, list):
            if not compare_lists(v1, v2):
                _log_mismatch(key, v1, v2, log)
                return False
        elif v1 != v2:
            _log_mismatch(key, v1, v2, log)
            return False

    return True


def compare_agent_state(original: AgentState, copy: AgentState, append_copy_suffix: bool) -> bool:
    """Wrapper function that provides a default set of ignored prefix fields."""
    if not append_copy_suffix:
        assert original.name == copy.name

    return _compare_agent_state_model_dump(original.model_dump(exclude="name"), copy.model_dump(exclude="name"))


# Sanity tests for our agent model_dump verifier helpers


def test_sanity_identical_dicts():
    d1 = {"name": "Alice", "age": 30, "details": {"city": "New York"}}
    d2 = {"name": "Alice", "age": 30, "details": {"city": "New York"}}
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_different_dicts():
    d1 = {"name": "Alice", "age": 30}
    d2 = {"name": "Bob", "age": 30}
    assert not _compare_agent_state_model_dump(d1, d2)


def test_sanity_ignored_id_fields():
    d1 = {"id": "user-abc123", "name": "Alice"}
    d2 = {"id": "user-xyz789", "name": "Alice"}  # Different ID, same prefix
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_different_id_prefix_fails():
    d1 = {"id": "user-abc123"}
    d2 = {"id": "admin-xyz789"}  # Different prefix
    assert not _compare_agent_state_model_dump(d1, d2)


def test_sanity_nested_dicts():
    d1 = {"user": {"id": "user-123", "name": "Alice"}}
    d2 = {"user": {"id": "user-456", "name": "Alice"}}  # ID changes, but prefix matches
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_list_handling():
    d1 = {"items": [1, 2, 3]}
    d2 = {"items": [1, 2, 3]}
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_list_mismatch():
    d1 = {"items": [1, 2, 3]}
    d2 = {"items": [1, 2, 4]}
    assert not _compare_agent_state_model_dump(d1, d2)


def test_sanity_message_ids_length_check():
    d1 = {"message_ids": ["msg-123", "msg-456", "msg-789"]}
    d2 = {"message_ids": ["msg-abc", "msg-def", "msg-ghi"]}  # Same length, different values
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_message_ids_different_length():
    d1 = {"message_ids": ["msg-123", "msg-456"]}
    d2 = {"message_ids": ["msg-123"]}
    assert not _compare_agent_state_model_dump(d1, d2)


def test_sanity_datetime_fields():
    d1 = {"created_at": datetime(2025, 3, 4, 18, 25, 37, tzinfo=timezone.utc)}
    d2 = {"created_at": datetime(2025, 3, 4, 18, 25, 37, tzinfo=timezone.utc)}
    assert _compare_agent_state_model_dump(d1, d2)


def test_sanity_datetime_mismatch():
    d1 = {"created_at": datetime(2025, 3, 4, 18, 25, 37, tzinfo=timezone.utc)}
    d2 = {"created_at": datetime(2025, 3, 4, 18, 25, 38, tzinfo=timezone.utc)}  # One second difference
    assert _compare_agent_state_model_dump(d1, d2)  # Should ignore


# Agent serialize/deserialize tests


@pytest.mark.parametrize("append_copy_suffix", [True, False])
def test_append_copy_suffix_simple(local_client, server, serialize_test_agent, default_user, other_user, append_copy_suffix):
    """Test deserializing JSON into an Agent instance."""
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, append_copy_suffix=append_copy_suffix)


@pytest.mark.parametrize("override_existing_tools", [True, False])
def test_deserialize_override_existing_tools(
    local_client, server, serialize_test_agent, default_user, weather_tool, print_tool, override_existing_tools
):
    """
    Test deserializing an agent with tools and ensure correct behavior for overriding existing tools.
    """
    append_copy_suffix = False
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Extract tools before upload
    tool_data_list = result.get("tools", [])
    tool_names = {tool["name"]: tool for tool in tool_data_list}

    # Rewrite all the tool source code to the print_tool source code
    for tool in result["tools"]:
        tool["source_code"] = print_tool.source_code

    # Deserialize the agent with different override settings
    server.agent_manager.deserialize(
        serialized_agent=result, actor=default_user, append_copy_suffix=append_copy_suffix, override_existing_tools=override_existing_tools
    )

    # Verify tool behavior
    for tool_name, expected_tool_data in tool_names.items():
        existing_tool = server.tool_manager.get_tool_by_name(tool_name, actor=default_user)

        if existing_tool.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MULTI_AGENT_CORE, ToolType.LETTA_MEMORY_CORE}:
            assert existing_tool.source_code != print_tool.source_code
        elif override_existing_tools:
            if existing_tool.name == weather_tool.name:
                assert existing_tool.source_code == print_tool.source_code, f"Tool {tool_name} should be overridden"
            else:
                assert existing_tool.source_code == weather_tool.source_code, f"Tool {tool_name} should NOT be overridden"


def test_in_context_message_id_remapping(local_client, server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Check remapping on message_ids and messages is consistent
    assert sorted([m["id"] for m in result["messages"]]) == sorted(result["message_ids"])

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user)

    # Make sure all the messages are able to be retrieved
    in_context_messages = server.agent_manager.get_in_context_messages(agent_id=agent_copy.id, actor=other_user)
    assert len(in_context_messages) == len(result["message_ids"])
    assert sorted([m.id for m in in_context_messages]) == sorted(result["message_ids"])


def test_agent_serialize_with_user_messages(local_client, server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    server.send_messages(
        actor=default_user, agent_id=serialize_test_agent.id, messages=[MessageCreate(role=MessageRole.user, content="hello")]
    )
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, append_copy_suffix=append_copy_suffix)

    # Make sure both agents can receive messages after
    server.send_messages(
        actor=default_user, agent_id=serialize_test_agent.id, messages=[MessageCreate(role=MessageRole.user, content="and hello again")]
    )
    server.send_messages(
        actor=other_user, agent_id=agent_copy.id, messages=[MessageCreate(role=MessageRole.user, content="and hello again")]
    )


def test_agent_serialize_tool_calls(mock_e2b_api_key_none, local_client, server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in San Francisco?")],
    )
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, append_copy_suffix=append_copy_suffix)

    # Make sure both agents can receive messages after
    original_agent_response = server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in Seattle?")],
    )
    copy_agent_response = server.send_messages(
        actor=other_user,
        agent_id=agent_copy.id,
        messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in Seattle?")],
    )

    assert original_agent_response.completion_tokens > 0 and original_agent_response.step_count > 0
    assert copy_agent_response.completion_tokens > 0 and copy_agent_response.step_count > 0


# FastAPI endpoint tests


@pytest.mark.parametrize("append_copy_suffix", [True])
def test_agent_download_upload_flow(fastapi_client, server, serialize_test_agent, default_user, other_user, append_copy_suffix):
    """
    Test the full E2E serialization and deserialization flow using FastAPI endpoints.
    """
    agent_id = serialize_test_agent.id

    # Step 1: Download the serialized agent
    response = fastapi_client.get(f"/v1/agents/{agent_id}/download", headers={"user_id": default_user.id})
    assert response.status_code == 200, f"Download failed: {response.text}"

    agent_json = response.json()

    # Step 2: Upload the serialized agent as a copy
    agent_bytes = BytesIO(json.dumps(agent_json).encode("utf-8"))
    files = {"file": ("agent.json", agent_bytes, "application/json")}
    upload_response = fastapi_client.post(
        "/v1/agents/upload",
        headers={"user_id": other_user.id},
        params={"append_copy_suffix": append_copy_suffix, "override_existing_tools": False},
        files=files,
    )
    assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"

    # Sanity checks
    copied_agent = upload_response.json()
    copied_agent_id = copied_agent["id"]
    assert copied_agent_id != agent_id, "Copied agent should have a different ID"
    assert copied_agent["name"] == serialize_test_agent.name + "_copy", "Copied agent name should have '_copy' suffix"

    # Step 3: Retrieve the copied agent
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)
    agent_copy = server.agent_manager.get_agent_by_id(agent_id=copied_agent_id, actor=other_user)
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, append_copy_suffix=append_copy_suffix)

    # Step 4: Ensure copied agent receives messages correctly
    server.send_messages(
        actor=other_user,
        agent_id=copied_agent_id,
        messages=[MessageCreate(role=MessageRole.user, content="Hello copied agent!")],
    )
