import asyncio
import difflib
import json
import os
import threading
import time
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Mapping

import pytest
import requests
from dotenv import load_dotenv
from rich.console import Console
from rich.syntax import Syntax

from letta.config import LettaConfig
from letta.orm import Base
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.block import Block, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, ToolType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.user import User
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.server.server import SyncServer
from tests.utils import create_tool_from_func

console = Console()

# ------------------------------
# Fixtures
# ------------------------------


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

    return url


def _clear_tables():
    from letta.server.db import db_registry

    async def _clear():
        async with db_registry.async_session() as session:
            for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
                await session.execute(table.delete())  # Truncate table
            await session.commit()

    asyncio.run(_clear())


@pytest.fixture(autouse=True)
def clear_tables():
    _clear_tables()


@pytest.fixture
def server():
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=False)
    yield server


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

    async def create_org():
        return await server.organization_manager.create_organization_async(pydantic_org=Organization(name="letta"))

    org = asyncio.run(create_org())
    yield org


@pytest.fixture
def other_user(server: SyncServer, other_organization):
    """Fixture to create and return the default user within the default organization."""

    async def create_user():
        return await server.user_manager.create_actor_async(pydantic_user=User(organization_id=other_organization.id, name="sarah"))

    user = asyncio.run(create_user())
    yield user


@pytest.fixture
def weather_tool(server, weather_tool_func, default_user):
    weather_tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=weather_tool_func), actor=default_user)
    yield weather_tool


@pytest.fixture
def print_tool(server, print_tool_func, default_user):
    print_tool = server.tool_manager.create_or_update_tool(create_tool_from_func(func=print_tool_func), actor=default_user)
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
        agent_type="memgpt_agent",
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


def _log_mismatch(key: str, expected: Any, actual: Any, log: bool = True) -> None:
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
    - 'tool_exec_environment_variables' ignores values since they're cleared during serialization.
    - 'json_schema' allows extra fields in d2 (from schema normalization during deserialization).
    - Datetime fields are ignored.
    - Order-independent comparison for lists of dicts.
    """
    ignore_prefix_fields = {"id", "last_updated_by_id", "organization_id", "created_by_id", "agent_id", "project_id"}

    # Remove datetime fields upfront
    d1 = strip_datetime_fields(d1)
    d2 = strip_datetime_fields(d2)

    # For json_schema comparison, allow d2 to have extra fields (schema normalization)
    if "json_schema" in d1 and "json_schema" in d2:
        schema1 = d1["json_schema"]
        schema2 = d2["json_schema"]
        if isinstance(schema1, dict) and isinstance(schema2, dict):
            # Check that all fields in schema1 exist in schema2 with same values
            for k, v in schema1.items():
                if k not in schema2 or not _compare_agent_state_model_dump({k: v}, {k: schema2[k]}, log=False):
                    _log_mismatch("json_schema", schema1, schema2, log)
                    return False
            # Don't compare other keys for json_schema
            d1_without_schema = {k: v for k, v in d1.items() if k != "json_schema"}
            d2_without_schema = {k: v for k, v in d2.items() if k != "json_schema"}
            return _compare_agent_state_model_dump(d1_without_schema, d2_without_schema, log)

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
        elif key == "tool_exec_environment_variables" or key == "secrets":
            if not isinstance(v1, list) or not isinstance(v2, list) or len(v1) != len(v2):
                _log_mismatch(key, v1, v2, log)
                return False
            # Compare environment variables ignoring values (cleared during serialization)
            for env1, env2 in zip(v1, v2):
                if isinstance(env1, dict) and isinstance(env2, dict):
                    # Compare all fields except 'value'
                    env1_without_value = {k: v for k, v in env1.items() if k != "value"}
                    env2_without_value = {k: v for k, v in env2.items() if k != "value"}
                    if not _compare_agent_state_model_dump(env1_without_value, env2_without_value, log=False):
                        _log_mismatch(key, v1, v2, log)
                        return False
        elif isinstance(v1, Dict) and isinstance(v2, Dict):
            if not _compare_agent_state_model_dump(v1, v2, log=False):
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


def compare_agent_state(server, original: AgentState, copy: AgentState, append_copy_suffix: bool, og_user: User, copy_user: User) -> bool:
    """Wrapper function that provides a default set of ignored prefix fields."""
    if not append_copy_suffix:
        assert original.name == copy.name

    compare_in_context_message_id_remapping(server, original, copy, og_user, copy_user)

    return _compare_agent_state_model_dump(original.model_dump(exclude="name"), copy.model_dump(exclude="name"))


def compare_in_context_message_id_remapping(server, og_agent: AgentState, copy_agent: AgentState, og_user, copy_user):
    """
    Test deserializing JSON into an Agent instance results in messages with
    remapped IDs but identical relevant content and order.
    """
    # Serialize the original agent state
    result = server.agent_manager.serialize(agent_id=og_agent.id, actor=og_user)

    # Retrieve the in-context messages for both the original and the copy
    # Corrected typo: agent_id instead of agent_id
    in_context_messages_og = server.agent_manager.get_in_context_messages(agent_id=og_agent.id, actor=og_user)
    in_context_messages_copy = server.agent_manager.get_in_context_messages(agent_id=copy_agent.id, actor=copy_user)

    # 1. Check if the number of messages is the same
    assert len(in_context_messages_og) == len(in_context_messages_copy), (
        f"Original message count ({len(in_context_messages_og)}) differs from copy ({len(in_context_messages_copy)})"
    )

    # 2. Iterate and compare messages by order, checking content equality and ID difference
    if not in_context_messages_og:
        # If there are no messages, the test passes trivially for message comparison.
        # Depending on the test case, you might want to assert that messages *should* exist.
        # pytest.fail("Expected messages to exist for comparison, but none were found.")
        pass  # Or skip if empty lists are valid outcomes

    for i, (msg_og, msg_copy) in enumerate(zip(in_context_messages_og, in_context_messages_copy)):
        # --- Assert ID Remapping ---
        assert msg_og.id != msg_copy.id, f"Message ID at index {i} was not remapped: {msg_og.id}"

        # --- Assert Content Equivalence (excluding fields expected to change) ---
        # Fields defining the core message content/intent:
        assert msg_og.role == msg_copy.role, f"Mismatch in 'role' at index {i}"
        assert msg_og.content == msg_copy.content, f"Mismatch in 'content' at index {i}"
        assert msg_og.model == msg_copy.model, f"Mismatch in 'model' at index {i}"
        assert msg_og.name == msg_copy.name, f"Mismatch in 'name' at index {i}"  # Name might be role-based
        assert msg_og.tool_calls == msg_copy.tool_calls, f"Mismatch in 'tool_calls' at index {i}"
        assert msg_og.tool_returns == msg_copy.tool_returns, f"Mismatch in 'tool_returns' at index {i}"
        # Add other fields here if they should be identical across copies

        # --- Assert Context/Ownership Fields (verify they point to the *new* context) ---
        assert msg_copy.agent_id == copy_agent.id, f"Copied message at index {i} has wrong agent_id: {msg_copy.agent_id} != {copy_agent.id}"
        # Assuming organization_id should belong to the 'other_user' context if applicable
        # assert msg_copy.organization_id == other_user.organization_id # If relevant/expected

        # --- Optionally Assert Original Context Fields (verify they point to the *old* context) ---
        assert msg_og.agent_id == og_agent.id, f"Original message at index {i} has wrong agent_id: {msg_og.agent_id} != {og_agent.id}"


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


def test_deserialize_simple(server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(server, serialize_test_agent, agent_copy, append_copy_suffix, default_user, other_user)


@pytest.mark.parametrize("override_existing_tools", [True, False])
def test_deserialize_override_existing_tools(server, serialize_test_agent, default_user, weather_tool, print_tool, override_existing_tools):
    """
    Test deserializing an agent with tools and ensure correct behavior for overriding existing tools.
    """
    append_copy_suffix = False
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Extract tools before upload
    tool_data_list = result.tools
    tool_names = {tool.name: tool for tool in tool_data_list}

    # Rewrite all the tool source code to the print_tool source code
    for tool in result.tools:
        tool.source_code = print_tool.source_code

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


def test_agent_serialize_with_user_messages(server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    server.send_messages(
        actor=default_user, agent_id=serialize_test_agent.id, input_messages=[MessageCreate(role=MessageRole.user, content="hello")]
    )
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(server, serialize_test_agent, agent_copy, append_copy_suffix, default_user, other_user)

    # Make sure both agents can receive messages after
    server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="and hello again")],
    )
    server.send_messages(
        actor=other_user, agent_id=agent_copy.id, input_messages=[MessageCreate(role=MessageRole.user, content="and hello again")]
    )


def test_agent_serialize_tool_calls(disable_e2b_api_key, server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in San Francisco?")],
    )
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(server, serialize_test_agent, agent_copy, append_copy_suffix, default_user, other_user)

    # Make sure both agents can receive messages after
    original_agent_response = server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in Seattle?")],
    )
    copy_agent_response = server.send_messages(
        actor=other_user,
        agent_id=agent_copy.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="What's the weather like in Seattle?")],
    )

    assert original_agent_response.completion_tokens > 0 and original_agent_response.step_count > 0
    assert copy_agent_response.completion_tokens > 0 and copy_agent_response.step_count > 0


def test_agent_serialize_update_blocks(disable_e2b_api_key, server, serialize_test_agent, default_user, other_user):
    """Test deserializing JSON into an Agent instance."""
    append_copy_suffix = False
    server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="Append 'banana' to core_memory.")],
    )
    server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="What do you think about that?")],
    )

    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, append_copy_suffix=append_copy_suffix)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(server, serialize_test_agent, agent_copy, append_copy_suffix, default_user, other_user)

    # Make sure both agents can receive messages after
    original_agent_response = server.send_messages(
        actor=default_user,
        agent_id=serialize_test_agent.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="Hi")],
    )
    copy_agent_response = server.send_messages(
        actor=other_user,
        agent_id=agent_copy.id,
        input_messages=[MessageCreate(role=MessageRole.user, content="Hi")],
    )

    assert original_agent_response.completion_tokens > 0 and original_agent_response.step_count > 0
    assert copy_agent_response.completion_tokens > 0 and copy_agent_response.step_count > 0


# FastAPI endpoint tests


@pytest.mark.parametrize("append_copy_suffix", [True, False])
@pytest.mark.parametrize("project_id", ["project-12345", None])
def test_agent_download_upload_flow(server, server_url, serialize_test_agent, default_user, other_user, append_copy_suffix, project_id):
    """
    Test the full E2E serialization and deserialization flow using FastAPI endpoints.
    """
    agent_id = serialize_test_agent.id

    # Step 1: Download the serialized agent
    response = requests.get(
        f"{server_url}/v1/agents/{agent_id}/export",
        headers={"user_id": default_user.id},
        params={"use_legacy_format": True},
    )
    assert response.status_code == 200, f"Download failed: {response.text}"

    # Ensure response matches expected schema
    response_json = response.json()
    agent_schema = AgentSchema.model_validate(response_json)  # Validate as Pydantic model
    agent_json = agent_schema.model_dump(mode="json")  # Convert back to serializable JSON

    # Step 2: Upload the serialized agent as a copy
    agent_bytes = BytesIO(json.dumps(agent_json).encode("utf-8"))
    files = {"file": ("agent.json", agent_bytes, "application/json")}

    # Send parameters as form data instead of query parameters
    form_data = {
        "append_copy_suffix": str(append_copy_suffix).lower(),  # Convert bool to string 'true'/'false'
        "override_existing_tools": "false",
    }
    if project_id:
        form_data["project_id"] = project_id

    upload_response = requests.post(
        f"{server_url}/v1/agents/import",
        headers={"user_id": other_user.id},
        files=files,
        data=form_data,  # Send as form data
    )
    assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"

    # Sanity checks
    copied_agent = upload_response.json()
    copied_agent_id = copied_agent["agent_ids"][0]
    assert copied_agent_id != agent_id, "Copied agent should have a different ID"

    agent_copy = server.agent_manager.get_agent_by_id(agent_id=copied_agent_id, actor=other_user)
    if append_copy_suffix:
        assert agent_copy.name == serialize_test_agent.name + "_copy", "Copied agent name should have '_copy' suffix"

    # Step 3: Retrieve the copied agent
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(server, serialize_test_agent, agent_copy, append_copy_suffix, default_user, other_user)


@pytest.mark.parametrize(
    "filename",
    [
        "outreach_workflow_agent.af",
        "customer_service.af",
        "deep_research_agent.af",
        "memgpt_agent_with_convo.af",
    ],
)
def test_upload_agentfile_from_disk(server, server_url, disable_e2b_api_key, other_user, filename):
    """
    Test uploading each .af file from the test_agent_files directory via live FastAPI server.
    """
    file_path = os.path.join(os.path.dirname(__file__), "test_agent_files", filename)

    with open(file_path, "rb") as f:
        files = {"file": (filename, f, "application/json")}

        # Send parameters as form data instead of query parameters
        form_data = {
            "append_copy_suffix": "true",
            "override_existing_tools": "false",
        }

        response = requests.post(
            f"{server_url}/v1/agents/import",
            headers={"user_id": other_user.id},
            files=files,
            data=form_data,  # Send as form data
        )

    assert response.status_code == 200, f"Failed to upload {filename}: {response.text}"
    json_response = response.json()

    copied_agent_id = json_response["agent_ids"][0]

    server.send_messages(
        actor=other_user,
        agent_id=copied_agent_id,
        input_messages=[MessageCreate(role=MessageRole.user, content="Hello there!")],
    )


def test_serialize_with_max_steps(server, server_url, default_user, other_user):
    """Test that max_steps parameter correctly limits messages by conversation steps."""
    # load agent from file with pre-populated messages
    file_path = os.path.join(os.path.dirname(__file__), "test_agent_files", "max_messages.af")

    with open(file_path, "rb") as f:
        files = {"file": ("max_messages.af", f, "application/json")}

        form_data = {
            "append_copy_suffix": "false",
            "override_existing_tools": "false",
        }

        response = requests.post(
            f"{server_url}/v1/agents/import",
            headers={"user_id": default_user.id},
            files=files,
            data=form_data,
        )

    assert response.status_code == 200, f"Failed to upload agent: {response.text}"
    agent_data = response.json()
    agent_id = agent_data["agent_ids"][0]

    # test with default max_steps (should use None, returning all messages)
    full_result = server.agent_manager.serialize(agent_id=agent_id, actor=default_user)
    total_messages = len(full_result.messages)
    assert total_messages == 31, f"Expected 31 messages, got {total_messages}"

    # test with max_steps=2 (should return messages from the last 2 user messages onward)
    limited_result = server.agent_manager.serialize(agent_id=agent_id, actor=default_user, max_steps=2)
    limited_user_count = sum(1 for msg in limited_result.messages if msg.role == "user")
    assert limited_user_count == 2, f"Expected 2 user messages (steps), got {limited_user_count}"
    assert len(limited_result.messages) == 2 * 3 + 1

    # verify agent can still receive messages after being deserialized with limited steps
    agent_copy = server.agent_manager.deserialize(limited_result, actor=other_user, append_copy_suffix=True)
    response = server.send_messages(
        actor=other_user, agent_id=agent_copy.id, input_messages=[MessageCreate(role=MessageRole.user, content="Hello!")]
    )
    assert response is not None and response.step_count > 0, "Agent should be able to receive and respond to messages"

    # test with max_steps=0 (should return only system message)
    empty_result = server.agent_manager.serialize(agent_id=agent_id, actor=default_user, max_steps=0)
    assert len(empty_result.messages) == 1, f"Expected 1 message (system), got {len(empty_result.messages)}"
    assert empty_result.messages[0].role == "system", "The only message should be the system message"
