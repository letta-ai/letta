import difflib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping

import pytest
from rich.console import Console
from rich.syntax import Syntax

from letta import create_client
from letta.config import LettaConfig
from letta.orm import Base
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.organization import Organization
from letta.schemas.user import User
from letta.server.server import SyncServer

console = Console()


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
def serialize_test_agent(server: SyncServer, default_user, default_organization):
    """Fixture to create and return a sample agent within the default organization."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    agent_name = f"serialize_test_agent_{timestamp}"

    server.tool_manager.upsert_base_tools(actor=default_user)

    agent_state = server.agent_manager.create_agent(
        agent_create=CreateAgent(
            name=agent_name,
            memory_blocks=[
                CreateBlock(
                    value="Name: Caren",
                    label="human",
                ),
            ],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=True,
        ),
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
    ignore_prefix_fields = {"id", "last_updated_by_id", "organization_id", "created_by_id"}

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


def compare_agent_state(original: AgentState, copy: AgentState, mark_as_copy: bool) -> bool:
    """Wrapper function that provides a default set of ignored prefix fields."""
    if not mark_as_copy:
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


@pytest.mark.parametrize("mark_as_copy", [True, False])
def test_mark_as_copy_simple(local_client, server, serialize_test_agent, default_user, other_user, mark_as_copy):
    """Test deserializing JSON into an Agent instance."""
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, mark_as_copy=mark_as_copy)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, mark_as_copy=mark_as_copy)


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
    mark_as_copy = False
    server.send_messages(
        actor=default_user, agent_id=serialize_test_agent.id, messages=[MessageCreate(role=MessageRole.user, content="hello")]
    )
    result = server.agent_manager.serialize(agent_id=serialize_test_agent.id, actor=default_user)

    # Deserialize the agent
    agent_copy = server.agent_manager.deserialize(serialized_agent=result, actor=other_user, mark_as_copy=mark_as_copy)

    # Get most recent original agent instance
    serialize_test_agent = server.agent_manager.get_agent_by_id(agent_id=serialize_test_agent.id, actor=default_user)

    # Compare serialized representations to check for exact match
    print_dict_diff(json.loads(serialize_test_agent.model_dump_json()), json.loads(agent_copy.model_dump_json()))
    assert compare_agent_state(agent_copy, serialize_test_agent, mark_as_copy=mark_as_copy)

    # Make sure both agents can receive messages after
    server.send_messages(
        actor=default_user, agent_id=serialize_test_agent.id, messages=[MessageCreate(role=MessageRole.user, content="and hello again")]
    )
    server.send_messages(
        actor=other_user, agent_id=agent_copy.id, messages=[MessageCreate(role=MessageRole.user, content="and hello again")]
    )
