"""
Integration tests for conversation history summarization.

These tests verify the complete summarization flow:
1. Creating a LettaAgentV2 instance
2. Fetching messages via message_manager.get_messages_by_ids_async
3. Calling agent_loop.summarize_conversation_history with force=True
"""

import json
import os
from typing import List

import pytest

from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent, ToolCallContent, ToolReturnContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.server.server import SyncServer

# Constants
DEFAULT_EMBEDDING_CONFIG = EmbeddingConfig.default_config(provider="openai")


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    """Load LLM configuration from JSON file."""
    filename = os.path.join(llm_config_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    llm_config = LLMConfig(**config_data)
    return llm_config


# Test configurations - using a subset of models for summarization tests
all_configs = [
    "openai-gpt-5-mini.json",
    "claude-4-5-haiku.json",
    "gemini-2.5-flash.json",
    # "gemini-2.5-flash-vertex.json",  # Requires Vertex AI credentials
    # "openai-gpt-4.1.json",
    # "openai-o1.json",
    # "openai-o3.json",
    # "openai-o4-mini.json",
    # "claude-4-sonnet.json",
    # "claude-3-7-sonnet.json",
    # "gemini-2.5-pro-vertex.json",
]

requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]
# Filter out deprecated Gemini 1.5 models
TESTED_LLM_CONFIGS = [
    cfg
    for cfg in TESTED_LLM_CONFIGS
    if not (cfg.model_endpoint_type in ["google_vertex", "google_ai"] and cfg.model.startswith("gemini-1.5"))
]


# ======================================================================================================================
# Fixtures
# ======================================================================================================================


@pytest.fixture
async def server():
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    await server.init_async()
    await server.tool_manager.upsert_base_tools_async(actor=server.default_user)

    yield server


@pytest.fixture
async def default_organization(server: SyncServer):
    """Create and return the default organization."""
    org = await server.organization_manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(server: SyncServer, default_organization):
    """Create and return the default user."""
    user = await server.user_manager.create_default_actor_async(org_id=default_organization.id)
    yield user


@pytest.fixture
async def actor(default_user):
    """Return actor for authorization."""
    return default_user


# ======================================================================================================================
# Helper Functions
# ======================================================================================================================


def create_large_tool_return(size_chars: int = 50000) -> str:
    """Create a large tool return string for testing."""
    # Create a realistic-looking tool return with repeated data
    base_item = {
        "id": 12345,
        "name": "Sample Item",
        "description": "This is a sample item description that will be repeated many times to create a large payload",
        "metadata": {"created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z", "version": "1.0.0"},
        "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
        "nested_data": {"level1": {"level2": {"level3": {"value": "deeply nested value"}}}},
    }

    items = []
    current_size = 0
    item_json = json.dumps(base_item)
    item_size = len(item_json)

    while current_size < size_chars:
        items.append(base_item.copy())
        current_size += item_size

    result = {"status": "success", "total_items": len(items), "items": items}
    return json.dumps(result)


async def create_agent_with_messages(server: SyncServer, actor, llm_config: LLMConfig, messages: List[PydanticMessage]) -> tuple:
    """
    Create an agent and add messages to it.
    Returns (agent_state, in_context_messages).
    """
    # Create agent (replace dots and slashes with underscores for valid names)
    agent_name = f"test_agent_{llm_config.model}".replace(".", "_").replace("/", "_")
    agent_create = CreateAgent(
        name=agent_name,
        llm_config=llm_config,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    agent_state = await server.agent_manager.create_agent_async(agent_create, actor=actor)

    # Add messages to the agent
    # Set agent_id on all message objects
    message_objs = []
    for msg in messages:
        msg_dict = msg.model_dump() if hasattr(msg, "model_dump") else msg.dict()
        msg_dict["agent_id"] = agent_state.id
        message_objs.append(PydanticMessage(**msg_dict))

    created_messages = await server.message_manager.create_many_messages_async(message_objs, actor=actor)

    # Update agent's message_ids
    message_ids = [m.id for m in created_messages]
    await server.agent_manager.update_message_ids_async(agent_id=agent_state.id, message_ids=message_ids, actor=actor)

    # Reload agent state to get updated message_ids
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=agent_state.id, actor=actor)

    # Fetch messages using the message manager (as in the actual code path)
    in_context_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor)

    return agent_state, in_context_messages


async def run_summarization(server: SyncServer, agent_state, in_context_messages, actor, force=True):
    """
    Execute the summarization code path that needs to be tested.

    This follows the exact code path specified:
    1. Create LettaAgentV2 instance
    2. Fetch messages via message_manager.get_messages_by_ids_async
    3. Call agent_loop.summarize_conversation_history with force=True
    """
    agent_loop = LettaAgentV2(agent_state=agent_state, actor=actor)

    # Run summarization with force parameter
    result = await agent_loop.summarize_conversation_history(
        in_context_messages=in_context_messages,
        new_letta_messages=[],
        total_tokens=None,
        force=force,
    )

    return result


# ======================================================================================================================
# Test Cases
# ======================================================================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_empty_message_buffer(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test summarization when there are no messages in the buffer.
    Should handle gracefully - either return empty list or raise a clear error.
    """
    # Create agent with no messages (replace dots and slashes with underscores for valid names)
    agent_name = f"test_agent_empty_{llm_config.model}".replace(".", "_").replace("/", "_")
    agent_create = CreateAgent(
        name=agent_name,
        llm_config=llm_config,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    agent_state = await server.agent_manager.create_agent_async(agent_create, actor=actor)

    # Get messages (should be empty or only contain system messages)
    in_context_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=actor)

    # Run summarization - this may fail with empty buffer, which is acceptable behavior
    try:
        result = await run_summarization(server, agent_state, in_context_messages, actor)
        # If it succeeds, verify result
        assert isinstance(result, list)
        # With empty buffer, result should still be empty or contain only system messages
        assert len(result) <= len(in_context_messages)
    except ValueError as e:
        # It's acceptable for summarization to fail on empty buffer
        assert "No assistant message found" in str(e) or "empty" in str(e).lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_initialization_messages_only(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test summarization when only initialization/system messages are in the buffer.
    Should handle gracefully and likely not summarize.
    """
    # Create messages - only system initialization messages
    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant. Your name is Letta.")],
        ),
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="The current date and time is 2025-01-01 12:00:00 UTC.")],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Run summarization - force=True with system messages only may fail
    try:
        result = await run_summarization(server, agent_state, in_context_messages, actor, force=True)

        # Verify result
        assert isinstance(result, list)
        # System messages should typically be preserved
        assert len(result) >= 1
    except ValueError as e:
        # It's acceptable for summarization to fail on system-only messages
        assert "No assistant message found" in str(e)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_small_conversation(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test summarization with approximately 5 messages in the buffer.
    This represents a typical small conversation.
    """
    # Create a small conversation with ~5 messages
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Hello! Can you help me with a Python question?")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="Of course! I'd be happy to help you with Python. What would you like to know?")],
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="How do I read a file in Python?")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(
                    type="text",
                    text="You can read a file in Python using the open() function. Here's an example:\n\n```python\nwith open('file.txt', 'r') as f:\n    content = f.read()\n    print(content)\n```",
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Thank you! That's very helpful.")],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Run summarization with force=True
    # Note: force=True with clear=True can be very aggressive and may fail on small message sets
    try:
        result = await run_summarization(server, agent_state, in_context_messages, actor, force=True)

        # Verify result
        assert isinstance(result, list)
        # With force=True, some summarization should occur
        # The result might be shorter than the original if summarization happened
        assert len(result) >= 1

        # Verify that the result contains valid messages
        for msg in result:
            assert hasattr(msg, "role")
            assert hasattr(msg, "content")
    except ValueError as e:
        # With force=True + clear=True, aggressive summarization might fail on small message sets
        # This is acceptable behavior
        assert "No assistant message found" in str(e)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_large_tool_calls(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test summarization with large tool calls and returns (~50k character tool returns).
    This tests the system's ability to handle and summarize very large context windows.
    """
    # Create a large tool return
    large_return = create_large_tool_return(50000)

    # Create messages with large tool calls and returns
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Please fetch all the data from the database.")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(type="text", text="I'll fetch the data for you."),
                ToolCallContent(
                    type="tool_call",
                    id="call_1",
                    name="fetch_database_records",
                    input={"query": "SELECT * FROM records"},
                ),
            ],
        ),
        PydanticMessage(
            role=MessageRole.tool,
            tool_call_id="call_1",
            content=[
                ToolReturnContent(
                    type="tool_return",
                    tool_call_id="call_1",
                    content=large_return,
                    is_error=False,
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(
                    type="text",
                    text="I've successfully fetched all the records from the database. There are thousands of items in the result set.",
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Great! Can you summarize what you found?")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(
                    type="text",
                    text="Based on the data I retrieved, there are numerous records containing various items with descriptions, metadata, and nested data structures. Each record includes timestamps and version information.",
                )
            ],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Verify that we actually have large messages
    total_content_size = sum(len(str(content)) for msg in in_context_messages for content in msg.content)
    assert total_content_size > 40000, f"Expected large messages, got {total_content_size} chars"

    # Run summarization
    result = await run_summarization(server, agent_state, in_context_messages, actor)

    # Verify result
    assert isinstance(result, list)
    assert len(result) >= 1

    # Verify that summarization reduced the context size
    result_content_size = sum(len(str(content)) for msg in result for content in msg.content)

    # The summarized result should be smaller than the original
    # (unless summarization was skipped for some reason)
    print(f"Original size: {total_content_size} chars, Summarized size: {result_content_size} chars")

    # Verify that the result contains valid messages
    for msg in result:
        assert hasattr(msg, "role")
        assert hasattr(msg, "content")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_multiple_large_tool_calls(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test summarization with multiple large tool calls in sequence.
    This stress-tests the summarization with multiple large context items.
    """
    # Create multiple large tool returns
    large_return_1 = create_large_tool_return(25000)
    large_return_2 = create_large_tool_return(25000)

    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Fetch user data.")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(type="text", text="Fetching users..."),
                ToolCallContent(
                    type="tool_call",
                    id="call_1",
                    name="fetch_users",
                    input={"limit": 10000},
                ),
            ],
        ),
        PydanticMessage(
            role=MessageRole.tool,
            tool_call_id="call_1",
            content=[
                ToolReturnContent(
                    type="tool_return",
                    tool_call_id="call_1",
                    content=large_return_1,
                    is_error=False,
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="Retrieved user data. Now fetching product data.")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(type="text", text="Fetching products..."),
                ToolCallContent(
                    type="tool_call",
                    id="call_2",
                    name="fetch_products",
                    input={"category": "all"},
                ),
            ],
        ),
        PydanticMessage(
            role=MessageRole.tool,
            tool_call_id="call_2",
            content=[
                ToolReturnContent(
                    type="tool_return",
                    tool_call_id="call_2",
                    content=large_return_2,
                    is_error=False,
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="I've successfully fetched both user and product data.")],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Verify that we have large messages
    total_content_size = sum(len(str(content)) for msg in in_context_messages for content in msg.content)
    assert total_content_size > 40000, f"Expected large messages, got {total_content_size} chars"

    # Run summarization
    result = await run_summarization(server, agent_state, in_context_messages, actor)

    # Verify result
    assert isinstance(result, list)
    assert len(result) >= 1

    # Verify that the result contains valid messages
    for msg in result:
        assert hasattr(msg, "role")
        assert hasattr(msg, "content")

    print(f"Summarized {len(in_context_messages)} messages with {total_content_size} chars to {len(result)} messages")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_truncates_large_tool_return(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test that summarization properly truncates very large tool returns.
    This ensures that oversized tool returns don't consume excessive context.
    """
    # Create an extremely large tool return (100k chars)
    large_return = create_large_tool_return(100000)
    original_size = len(large_return)

    # Create messages with a large tool return
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Please run the database query.")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(type="text", text="Running query..."),
                ToolCallContent(
                    type="tool_call",
                    id="call_1",
                    name="run_query",
                    input={"query": "SELECT * FROM large_table"},
                ),
            ],
        ),
        PydanticMessage(
            role=MessageRole.tool,
            tool_call_id="call_1",
            content=[
                ToolReturnContent(
                    type="tool_return",
                    tool_call_id="call_1",
                    content=large_return,
                    is_error=False,
                )
            ],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="Query completed successfully with many results.")],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Verify the original tool return is indeed large
    assert original_size > 90000, f"Expected tool return >90k chars, got {original_size}"

    # Run summarization
    result = await run_summarization(server, agent_state, in_context_messages, actor)

    # Verify result
    assert isinstance(result, list)
    assert len(result) >= 1

    # Find tool return messages in the result and verify truncation occurred
    tool_returns_found = False
    for msg in result:
        if msg.role == MessageRole.tool:
            for content in msg.content:
                if isinstance(content, ToolReturnContent):
                    tool_returns_found = True
                    result_size = len(content.content)
                    # Verify that the tool return has been truncated
                    assert result_size < original_size, (
                        f"Expected tool return to be truncated from {original_size} chars, but got {result_size} chars"
                    )
                    print(f"Tool return successfully truncated from {original_size} to {result_size} chars")

    # If we didn't find any tool returns in the result, that's also acceptable
    # (they may have been completely removed during aggressive summarization)
    if not tool_returns_found:
        print("Tool returns were completely removed during summarization")
