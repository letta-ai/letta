"""
Integration tests for conversation history summarization.

These tests verify the complete summarization flow:
1. Creating a LettaAgentV2 instance
2. Fetching messages via message_manager.get_messages_by_ids_async
3. Calling agent_loop.summarize_conversation_history with force=True
"""

import json
import os
from typing import List, Literal

import pytest

from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.agents.letta_agent_v3 import LettaAgentV3
from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.block import BlockUpdate, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import TextContent, ToolCallContent, ToolReturnContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage, MessageCreate
from letta.schemas.run import Run as PydanticRun
from letta.server.server import SyncServer
from letta.services.run_manager import RunManager
from letta.services.summarizer.summarizer import simple_summary
from letta.settings import model_settings

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
    # "claude-4-5-haiku.json",
    # "gemini-2.5-flash.json",
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
    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)

    # Run summarization with force parameter
    summary_message, messages = await agent_loop.compact(messages=in_context_messages)

    return summary_message, messages


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
        summary, result = await run_summarization(server, agent_state, in_context_messages, actor)
        # If it succeeds, verify result
        assert isinstance(result, list)

        # When summarization runs, V3 ensures that in-context messages follow
        # the pattern:
        #   1. System prompt
        #   2. User summary message (system_alert JSON)
        #   3. Remaining messages (which may be empty for this test)

        # We should always keep the original system message at the front.
        assert len(result) >= 1
        assert result[0].role == MessageRole.system

        # If summarization did in fact add a summary message, we expect it to
        # be the second message with user role.
        if len(result) >= 2:
            assert result[1].role == MessageRole.user
    except ValueError as e:
        # It's acceptable for summarization to fail on empty buffer
        assert "No assistant message found" in str(e) or "empty" in str(e).lower()


@pytest.mark.asyncio
@pytest.mark.skipif(
    not model_settings.anthropic_api_key,
    reason="Missing LETTA_ANTHROPIC_API_KEY (or equivalent settings) for Anthropic integration test",
)
async def test_simple_summary_anthropic_uses_streaming_and_returns_summary(actor, monkeypatch):
    """Regression test: Anthropic summarization must use streaming and return real text."""

    # If the summarizer ever falls back to a non-streaming Anthropic call, make it fail fast.
    from letta.llm_api.anthropic_client import AnthropicClient

    async def _nope_request_async(self, *args, **kwargs):
        raise AssertionError("Anthropic summarizer should not call request_async (must use streaming)")

    monkeypatch.setattr(AnthropicClient, "request_async", _nope_request_async)

    # Keep the prompt tiny so this is fast and cheap.
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="I'm planning a trip to Paris in April.")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[
                TextContent(
                    type="text",
                    text="Great—your priorities are museums and cafes, and you want to stay under $200/day.",
                )
            ],
        ),
    ]

    anthropic_config = get_llm_config("claude-4-5-haiku.json")

    summary = await simple_summary(messages=messages, llm_config=anthropic_config, actor=actor)

    assert isinstance(summary, str)
    assert len(summary) > 10
    # Sanity-check that the model is summarizing the right conversation.
    assert any(token in summary.lower() for token in ["paris", "april", "museum", "cafe", "$200", "200"])


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
        summary, result = await run_summarization(server, agent_state, in_context_messages, actor, force=True)

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
        summary, result = await run_summarization(server, agent_state, in_context_messages, actor, force=True)

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
    summary, result = await run_summarization(server, agent_state, in_context_messages, actor)

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
    summary, result = await run_summarization(server, agent_state, in_context_messages, actor)

    # Verify result
    assert isinstance(result, list)
    assert len(result) >= 1

    # Verify that the result contains valid messages
    for msg in result:
        assert hasattr(msg, "role")
        assert hasattr(msg, "content")

    print(f"Summarized {len(in_context_messages)} messages with {total_content_size} chars to {len(result)} messages")


# @pytest.mark.asyncio
# @pytest.mark.parametrize(
#    "llm_config",
#    TESTED_LLM_CONFIGS,
#    ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# async def test_summarize_truncates_large_tool_return(server: SyncServer, actor, llm_config: LLMConfig):
#    """
#    Test that summarization properly truncates very large tool returns.
#    This ensures that oversized tool returns don't consume excessive context.
#    """
#    # Create an extremely large tool return (100k chars)
#    large_return = create_large_tool_return(100000)
#    original_size = len(large_return)
#
#    # Create messages with a large tool return
#    messages = [
#        PydanticMessage(
#            role=MessageRole.user,
#            content=[TextContent(type="text", text="Please run the database query.")],
#        ),
#        PydanticMessage(
#            role=MessageRole.assistant,
#            content=[
#                TextContent(type="text", text="Running query..."),
#                ToolCallContent(
#                    type="tool_call",
#                    id="call_1",
#                    name="run_query",
#                    input={"query": "SELECT * FROM large_table"},
#                ),
#            ],
#        ),
#        PydanticMessage(
#            role=MessageRole.tool,
#            tool_call_id="call_1",
#            content=[
#                ToolReturnContent(
#                    type="tool_return",
#                    tool_call_id="call_1",
#                    content=large_return,
#                    is_error=False,
#                )
#            ],
#        ),
#        PydanticMessage(
#            role=MessageRole.assistant,
#            content=[TextContent(type="text", text="Query completed successfully with many results.")],
#        ),
#    ]
#
#    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)
#
#    # Verify the original tool return is indeed large
#    assert original_size > 90000, f"Expected tool return >90k chars, got {original_size}"
#
#    # Run summarization
#    summary, result = await run_summarization(server, agent_state, in_context_messages, actor)
#
#    # Verify result
#    assert isinstance(result, list)
#    assert len(result) >= 1
#
#    # Find tool return messages in the result and verify truncation occurred
#    tool_returns_found = False
#    for msg in result:
#        if msg.role == MessageRole.tool:
#            for content in msg.content:
#                if isinstance(content, ToolReturnContent):
#                    tool_returns_found = True
#                    result_size = len(content.content)
#                    # Verify that the tool return has been truncated
#                    assert result_size < original_size, (
#                        f"Expected tool return to be truncated from {original_size} chars, but got {result_size} chars"
#                    )
#                    print(f"Tool return successfully truncated from {original_size} to {result_size} chars")
#
#    # If we didn't find any tool returns in the result, that's also acceptable
#    # (they may have been completely removed during aggressive summarization)
#    if not tool_returns_found:
#        print("Tool returns were completely removed during summarization")
#

# ======================================================================================================================
# CompactionSettings Mode Tests - Using LettaAgentV3
# ======================================================================================================================

from unittest.mock import patch

from letta.services.summarizer.summarizer_config import CompactionSettings

# Test both summarizer modes: "all" summarizes entire history, "sliding_window" keeps recent messages
SUMMARIZER_CONFIG_MODES: list[Literal["all", "sliding_window"]] = ["all", "sliding_window"]


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", SUMMARIZER_CONFIG_MODES, ids=SUMMARIZER_CONFIG_MODES)
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS, ids=[c.model for c in TESTED_LLM_CONFIGS])
async def test_summarize_with_mode(server: SyncServer, actor, llm_config: LLMConfig, mode: Literal["all", "sliding_window"]):
    """
    Test summarization with different CompactionSettings modes using LettaAgentV3.

    This test verifies that both summarization modes work correctly:
    - "all": Summarizes the entire conversation history into a single summary
    - "sliding_window": Keeps recent messages and summarizes older ones
    """
    # Create a conversation with enough messages to trigger summarization
    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
        )
    ]
    for i in range(10):
        messages.append(
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text=f"User message {i}: Test message {i}.")],
            )
        )
        messages.append(
            PydanticMessage(
                role=MessageRole.assistant,
                content=[TextContent(type="text", text=f"Assistant response {i}: Acknowledged message {i}.")],
            )
        )

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    # Create new messages that would be added during this step
    new_letta_messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="This is a new user message during this step.")],
            agent_id=agent_state.id,
        )
    ]
    # Persist the new messages
    new_letta_messages = await server.message_manager.create_many_messages_async(new_letta_messages, actor=actor)

    # Override compaction settings directly on the agent state
    handle = llm_config.handle or f"{llm_config.model_endpoint_type}/{llm_config.model}"
    agent_state.compaction_settings = CompactionSettings(model=handle, mode=mode)

    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)

    summary, result = await agent_loop.compact(messages=in_context_messages)

    assert isinstance(result, list)

    # Verify that the result contains valid messages
    for msg in result:
        assert hasattr(msg, "role")
        assert hasattr(msg, "content")

    print()
    print(f"RESULTS {mode} ======")
    for msg in result:
        print(f"MSG: {msg}")

    print()

    if mode == "all":
        # For "all" mode, V3 keeps:
        #   1. System prompt
        #   2. A single user summary message (system_alert JSON)
        # and no remaining historical messages.
        assert len(result) == 2, f"Expected 2 messages for 'all' mode (system + summary), got {len(result)}"
        assert result[0].role == MessageRole.system
        assert result[1].role == MessageRole.user
    else:
        # For "sliding_window" mode, result should include:
        #   1. System prompt
        #   2. User summary message
        #   3+. Recent user/assistant messages inside the window.
        assert len(result) > 2, f"Expected >2 messages for 'sliding_window' mode, got {len(result)}"
        assert result[0].role == MessageRole.system
        assert result[1].role == MessageRole.user


@pytest.mark.asyncio
async def test_v3_compact_uses_compaction_settings_model_and_model_settings(server: SyncServer, actor):
    """Integration test: LettaAgentV3.compact uses the LLMConfig implied by CompactionSettings.

    We set a different summarizer model handle + model_settings and verify that
    the LLMConfig passed into simple_summary reflects both the handle and
    the model_settings overrides.
    """

    from letta.agents.letta_agent_v3 import LettaAgentV3
    from letta.schemas.model import OpenAIModelSettings, OpenAIReasoning
    from letta.services.summarizer import summarizer_all

    base_llm_config = LLMConfig.default_config("gpt-4o-mini")

    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="Hello")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="Hi there")],
        ),
    ]

    # Create agent + messages via helper to get a real AgentState
    agent_state, in_context_messages = await create_agent_with_messages(
        server=server,
        actor=actor,
        llm_config=base_llm_config,
        messages=messages,
    )

    summarizer_handle = "openai/gpt-5-mini"
    summarizer_model_settings = OpenAIModelSettings(
        max_output_tokens=4321,
        temperature=0.05,
        reasoning=OpenAIReasoning(reasoning_effort="high"),
        response_format=None,
    )
    agent_state.compaction_settings = CompactionSettings(
        model=summarizer_handle,
        model_settings=summarizer_model_settings,
        prompt="You are a summarizer.",
        prompt_acknowledgement=True,
        clip_chars=2000,
        mode="all",
        sliding_window_percentage=0.3,
    )

    captured_llm_config: dict = {}

    async def fake_simple_summary(messages, llm_config, actor, include_ack=True, prompt=None):  # type: ignore[override]
        captured_llm_config["value"] = llm_config
        return "summary text"

    # Patch simple_summary so we don't hit the real LLM and can inspect llm_config
    with patch.object(summarizer_all, "simple_summary", new=fake_simple_summary):
        agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)
        summary_msg, compacted = await agent_loop.compact(messages=in_context_messages)

    assert summary_msg is not None
    assert "value" in captured_llm_config
    summarizer_llm_config = captured_llm_config["value"]

    # Agent's llm_config remains the base config
    assert agent_state.llm_config.model == "gpt-4o-mini"

    # Summarizer llm_config should reflect compaction_settings.model and model_settings
    assert summarizer_llm_config.handle == summarizer_handle
    assert summarizer_llm_config.model == "gpt-5-mini"
    assert summarizer_llm_config.max_tokens == 4321
    assert summarizer_llm_config.temperature == 0.05


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS, ids=[c.model for c in TESTED_LLM_CONFIGS])
async def test_v3_summarize_hard_eviction_when_still_over_threshold(
    server: SyncServer,
    actor,
    llm_config: LLMConfig,
    caplog,
):
    """Regression test: ensure V3 summarizer does a hard eviction when
    summarization fails to bring the context size below the proactive
    summarization threshold.

    This test simulates the edge case that previously led to summarization
    loops:

    1. A large pre-summarization token count triggers summarization.
    2. Even after summarization, the (mocked) post-summarization token count
       is still above the trigger threshold.
    3. We verify that LettaAgentV3:
       - Logs an error about summarization failing to reduce context size.
       - Evicts all prior messages, keeping only the system message plus a
         single synthetic user summary message (system_alert).
       - Updates `context_token_estimate` to the token count of the minimal
         context so future steps don't keep re-triggering summarization based
         on a stale, oversized value.
    """

    # Build a small but non-trivial conversation with an explicit system
    # message so that after hard eviction we expect to keep exactly that
    # system message plus a single user summary message.
    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
        ),
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(type="text", text="User message 0: hello")],
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(type="text", text="Assistant response 0: hi there")],
        ),
    ]

    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)

    print("ORIGINAL IN-CONTEXT MESSAGES ======")
    for msg in in_context_messages:
        print(f"MSG: {msg}")

    # Create the V3 agent loop
    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)

    # We don't care which summarizer mode is used here; we just need
    # summarize_conversation_history to run and then hit the branch where the
    # *post*-summarization token count is still above the proactive
    # summarization threshold. We simulate that by patching the
    # letta_agent_v3-level count_tokens helper to report an extremely large
    # token count for the first call (post-summary) and a small count for the
    # second call (after hard eviction).
    with patch("letta.agents.letta_agent_v3.count_tokens") as mock_count_tokens:
        # First call: pretend the summarized context is still huge relative to
        # this model's context window so that we always trigger the
        # hard-eviction path. Second call: minimal context (system only) is
        # small.
        context_limit = llm_config.context_window or 100_000
        huge_tokens = context_limit * 10  # safely above any reasonable trigger
        mock_count_tokens.side_effect = [huge_tokens, 10]

        caplog.set_level("ERROR")

        summary, result = await agent_loop.compact(
            messages=in_context_messages,
            trigger_threshold=context_limit,
        )

    # We should have made exactly two token-count calls: one for the
    # summarized context, one for the hard-evicted minimal context.
    assert mock_count_tokens.call_count == 2

    print("COMPACTED RESULT ======")
    for msg in result:
        print(f"MSG: {msg}")

    # After hard eviction, we keep only:
    #   1. The system prompt
    #   2. The synthetic user summary message.
    assert isinstance(result, list)
    assert len(result) == 2, f"Expected system + summary after hard eviction, got {len(result)} messages"
    assert result[0].role == MessageRole.system
    assert result[1].role == MessageRole.user


# ======================================================================================================================
# Sliding Window Summarizer Unit Tests
# ======================================================================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_sliding_window_cutoff_index_does_not_exceed_message_count(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test that the sliding window summarizer correctly calculates cutoff indices.

    This test verifies the fix for a bug where the cutoff percentage was treated as
    a whole number (10) instead of a decimal (0.10), causing:
      message_cutoff_index = round(10 * 65) = 650
    when there were only 65 messages, resulting in an empty range loop and the error:
      "No assistant message found from indices 650 to 65"

    The fix changed:
      - max(..., 10) -> max(..., 0.10)
      - += 10 -> += 0.10
      - >= 100 -> >= 1.0

    This test uses the real token counter (via create_token_counter) to verify
    the sliding window logic works with actual token counting.
    """
    from letta.services.summarizer.summarizer_config import CompactionSettings
    from letta.services.summarizer.summarizer_sliding_window import summarize_via_sliding_window

    # Create a real summarizer config using the default factory
    # Override sliding_window_percentage to 0.3 for this test
    handle = llm_config.handle or f"{llm_config.model_endpoint_type}/{llm_config.model}"
    summarizer_config = CompactionSettings(model=handle)
    summarizer_config.sliding_window_percentage = 0.3

    # Create 65 messages (similar to the failing case in the bug report)
    # Pattern: system + alternating user/assistant messages
    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
        )
    ]

    # Add 64 more messages (32 user-assistant pairs)
    for i in range(32):
        messages.append(
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text=f"User message {i}")],
            )
        )
        messages.append(
            PydanticMessage(
                role=MessageRole.assistant,
                content=[TextContent(type="text", text=f"Assistant response {i}")],
            )
        )

    assert len(messages) == 65, f"Expected 65 messages, got {len(messages)}"

    # This should NOT raise "No assistant message found from indices 650 to 65"
    # With the fix, message_count_cutoff_percent starts at max(0.7, 0.10) = 0.7
    # So message_cutoff_index = round(0.7 * 65) = 46, which is valid
    try:
        summary, remaining_messages = await summarize_via_sliding_window(
            actor=actor,
            llm_config=llm_config,
            summarizer_config=summarizer_config,
            in_context_messages=messages,
        )

        # Verify the summary was generated (actual LLM response)
        assert summary is not None
        assert len(summary) > 0

        # Verify remaining messages is a valid subset
        assert len(remaining_messages) < len(messages)
        assert len(remaining_messages) > 0

        print(f"Successfully summarized {len(messages)} messages to {len(remaining_messages)} remaining")
        print(f"Summary: {summary[:200]}..." if len(summary) > 200 else f"Summary: {summary}")
        print(f"Using {llm_config.model_endpoint_type} token counter for model {llm_config.model}")

    except ValueError as e:
        if "No assistant message found from indices" in str(e):
            # Extract the indices from the error message
            import re

            match = re.search(r"from indices (\d+) to (\d+)", str(e))
            if match:
                start_idx, end_idx = int(match.group(1)), int(match.group(2))
                pytest.fail(
                    f"Bug detected: cutoff index ({start_idx}) exceeds message count ({end_idx}). "
                    f"This indicates the percentage calculation bug where 10 was used instead of 0.10. "
                    f"Error: {e}"
                )
        raise


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_large_system_prompt_summarization(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test edge case of large system prompt / memory blocks.

    This test verifies that summarization handles the case where the system prompt
    and memory blocks are very large, potentially consuming most of the context window.
    The summarizer should gracefully handle this scenario without errors.
    """

    # Override context window to be small so we trigger summarization
    llm_config.context_window = 10000

    # Create agent with large system prompt and memory blocks
    agent_name = f"test_agent_large_system_prompt_{llm_config.model}".replace(".", "_").replace("/", "_")
    agent_create = CreateAgent(
        name=agent_name,
        llm_config=llm_config,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        system="SYSTEM PROMPT " * 10000,  # Large system prompt
        memory_blocks=[
            CreateBlock(
                label="human",
                limit=200000,
                value="NAME " * 10000,  # Large memory block
            )
        ],
    )
    agent_state = await server.agent_manager.create_agent_async(agent_create, actor=actor)

    # Create a run for the agent using RunManager
    run = PydanticRun(agent_id=agent_state.id)
    run = await RunManager().create_run(pydantic_run=run, actor=actor)

    # Create the agent loop using LettaAgentV3
    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)

    # message the agent
    input_message = MessageCreate(role=MessageRole.user, content="Hello")

    # Call step on the agent - may trigger summarization due to large context
    from letta.errors import SystemPromptTokenExceededError

    with pytest.raises(SystemPromptTokenExceededError):
        response = await agent_loop.step(
            input_messages=[input_message],
            run_id=run.id,
            max_steps=3,
        )

    # Repair the agent by shortening the memory blocks and system prompt
    # Update system prompt to a shorter version
    short_system_prompt = "You are a helpful assistant."
    await server.agent_manager.update_agent_async(
        agent_id=agent_state.id,
        agent_update=UpdateAgent(system=short_system_prompt),
        actor=actor,
    )

    # Update memory block to a shorter version
    short_memory_value = "The user's name is Alice."
    await server.agent_manager.modify_block_by_label_async(
        agent_id=agent_state.id,
        block_label="human",
        block_update=BlockUpdate(value=short_memory_value),
        actor=actor,
    )

    # Reload agent state after repairs
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=agent_state.id, actor=actor)
    print("REPAIRED AGENT STATE ======")
    print(agent_state.system)
    print(agent_state.blocks)

    # Create a new run for the repaired agent
    run = PydanticRun(agent_id=agent_state.id)
    run = await RunManager().create_run(pydantic_run=run, actor=actor)

    # Create a new agent loop with the repaired agent state
    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)

    # Now the agent should be able to respond without context window errors
    response = await agent_loop.step(
        input_messages=[input_message],
        run_id=run.id,
        max_steps=3,
    )

    # Verify we got a valid response after repair
    assert response is not None
    assert response.messages is not None
    print(f"Agent successfully responded after repair with {len(response.messages)} messages")


# @pytest.mark.asyncio
# async def test_context_window_overflow_triggers_summarization_in_streaming(server: SyncServer, actor):
#    """
#    Test that a ContextWindowExceededError during a streaming LLM request
#    properly triggers the summarizer and compacts the in-context messages.
#
#    This test simulates:
#    1. An LLM streaming request that fails with ContextWindowExceededError
#    2. The summarizer being invoked to reduce context size
#    3. Verification that messages are compacted and summary message exists
#
#    Note: This test only runs with OpenAI since it uses OpenAI-specific error handling.
#    """
#    import uuid
#    from unittest.mock import patch
#
#    import openai
#
#    from letta.schemas.message import MessageCreate
#    from letta.schemas.run import Run
#    from letta.services.run_manager import RunManager
#
#    # Use OpenAI config for this test (since we're using OpenAI-specific error handling)
#    llm_config = get_llm_config("openai-gpt-4o-mini.json")
#
#    # Create test messages - enough to have something to summarize
#    messages = []
#    for i in range(15):
#        messages.append(
#            PydanticMessage(
#                role=MessageRole.user,
#                content=[TextContent(type="text", text=f"User message {i}: This is test message number {i}.")],
#            )
#        )
#        messages.append(
#            PydanticMessage(
#                role=MessageRole.assistant,
#                content=[TextContent(type="text", text=f"Assistant response {i}: I acknowledge message {i}.")],
#            )
#        )
#
#    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)
#    original_message_count = len(agent_state.message_ids)
#
#    # Create an input message to trigger the agent
#    input_message = MessageCreate(
#        role=MessageRole.user,
#        content=[TextContent(type="text", text="Hello, please respond.")],
#    )
#
#    # Create a proper run record in the database
#    run_manager = RunManager()
#    test_run_id = f"run-{uuid.uuid4()}"
#    test_run = Run(
#        id=test_run_id,
#        agent_id=agent_state.id,
#    )
#    await run_manager.create_run(test_run, actor)
#
#    # Create the agent loop using LettaAgentV3
#    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)
#
#    # Track how many times stream_async is called
#    call_count = 0
#
#    # Store original stream_async method
#    original_stream_async = agent_loop.llm_client.stream_async
#
#    async def mock_stream_async_with_error(request_data, llm_config):
#        nonlocal call_count
#        call_count += 1
#        if call_count == 1:
#            # First call raises OpenAI BadRequestError with context_length_exceeded error code
#            # This will be properly converted to ContextWindowExceededError by handle_llm_error
#            from unittest.mock import MagicMock
#
#            import httpx
#
#            # Create a mock response with the required structure
#            mock_request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
#            mock_response = httpx.Response(
#                status_code=400,
#                request=mock_request,
#                json={
#                    "error": {
#                        "message": "This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                        "type": "invalid_request_error",
#                        "code": "context_length_exceeded",
#                    }
#                },
#            )
#
#            raise openai.BadRequestError(
#                message="This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                response=mock_response,
#                body={
#                    "error": {
#                        "message": "This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                        "type": "invalid_request_error",
#                        "code": "context_length_exceeded",
#                    }
#                },
#            )
#        # Subsequent calls use the real implementation
#        return await original_stream_async(request_data, llm_config)
#
#    # Patch the llm_client's stream_async to raise ContextWindowExceededError on first call
#    with patch.object(agent_loop.llm_client, "stream_async", side_effect=mock_stream_async_with_error):
#        # Execute a streaming step
#        try:
#            result_chunks = []
#            async for chunk in agent_loop.stream(
#                input_messages=[input_message],
#                max_steps=1,
#                stream_tokens=True,
#                run_id=test_run_id,
#            ):
#                result_chunks.append(chunk)
#        except Exception as e:
#            # Some errors might happen due to real LLM calls after retry
#            print(f"Exception during stream: {e}")
#
#    # Reload agent state to get updated message_ids after summarization
#    updated_agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=agent_state.id, actor=actor)
#    updated_message_count = len(updated_agent_state.message_ids)
#
#    # Fetch the updated in-context messages
#    updated_in_context_messages = await server.message_manager.get_messages_by_ids_async(
#        message_ids=updated_agent_state.message_ids, actor=actor
#    )
#
#    # Convert to LettaMessage format for easier content inspection
#    letta_messages = PydanticMessage.to_letta_messages_from_list(updated_in_context_messages)
#
#    # Verify a summary message exists with the correct format
#    # The summary message has content with type="system_alert" and message containing:
#    # "prior messages ... have been hidden" and "summary of the previous"
#    import json
#
#    summary_message_found = False
#    summary_message_text = None
#    for msg in letta_messages:
#        # Not all message types have a content attribute (e.g., ReasoningMessage)
#        if not hasattr(msg, "content"):
#            continue
#
#        content = msg.content
#        # Content can be a string (JSON) or an object with type/message fields
#        if isinstance(content, str):
#            # Try to parse as JSON
#            try:
#                parsed = json.loads(content)
#                if isinstance(parsed, dict) and parsed.get("type") == "system_alert":
#                    text_to_check = parsed.get("message", "").lower()
#                    if "prior messages" in text_to_check and "hidden" in text_to_check and "summary of the previous" in text_to_check:
#                        summary_message_found = True
#                        summary_message_text = parsed.get("message")
#                        break
#            except (json.JSONDecodeError, TypeError):
#                pass
#        # Check if content has system_alert type with the summary message (object form)
#        elif hasattr(content, "type") and content.type == "system_alert":
#            if hasattr(content, "message") and content.message:
#                text_to_check = content.message.lower()
#                if "prior messages" in text_to_check and "hidden" in text_to_check and "summary of the previous" in text_to_check:
#                    summary_message_found = True
#                    summary_message_text = content.message
#                    break
#
#    assert summary_message_found, (
#        "A summary message should exist in the in-context messages after summarization. "
#        "Expected format containing 'prior messages...hidden' and 'summary of the previous'"
#    )
#
#    # Verify we attempted multiple invocations (the failing one + retry after summarization)
#    assert call_count >= 2, f"Expected at least 2 LLM invocations (initial + retry), got {call_count}"
#
#    # The original messages should have been compacted - the updated count should be less than
#    # original + the new messages added (input + assistant response + tool results)
#    # Since summarization should have removed most of the original 30 messages
#    print("Test passed: Summary message found in context")
#    print(f"Original message count: {original_message_count}, Updated: {updated_message_count}")
#    print(f"Summary message: {summary_message_text[:200] if summary_message_text else 'N/A'}...")
#    print(f"Total LLM invocations: {call_count}")
#
#
# @pytest.mark.asyncio
# async def test_context_window_overflow_triggers_summarization_in_blocking(server: SyncServer, actor):
#    """
#    Test that a ContextWindowExceededError during a blocking (non-streaming) LLM request
#    properly triggers the summarizer and compacts the in-context messages.
#
#    This test is similar to the streaming test but uses the blocking step() method.
#
#    Note: This test only runs with OpenAI since it uses OpenAI-specific error handling.
#    """
#    import uuid
#    from unittest.mock import patch
#
#    import openai
#
#    from letta.schemas.message import MessageCreate
#    from letta.schemas.run import Run
#    from letta.services.run_manager import RunManager
#
#    # Use OpenAI config for this test (since we're using OpenAI-specific error handling)
#    llm_config = get_llm_config("openai-gpt-4o-mini.json")
#
#    # Create test messages
#    messages = []
#    for i in range(15):
#        messages.append(
#            PydanticMessage(
#                role=MessageRole.user,
#                content=[TextContent(type="text", text=f"User message {i}: This is test message number {i}.")],
#            )
#        )
#        messages.append(
#            PydanticMessage(
#                role=MessageRole.assistant,
#                content=[TextContent(type="text", text=f"Assistant response {i}: I acknowledge message {i}.")],
#            )
#        )
#
#    agent_state, in_context_messages = await create_agent_with_messages(server, actor, llm_config, messages)
#    original_message_count = len(agent_state.message_ids)
#
#    # Create an input message to trigger the agent
#    input_message = MessageCreate(
#        role=MessageRole.user,
#        content=[TextContent(type="text", text="Hello, please respond.")],
#    )
#
#    # Create a proper run record in the database
#    run_manager = RunManager()
#    test_run_id = f"run-{uuid.uuid4()}"
#    test_run = Run(
#        id=test_run_id,
#        agent_id=agent_state.id,
#    )
#    await run_manager.create_run(test_run, actor)
#
#    # Create the agent loop using LettaAgentV3
#    agent_loop = LettaAgentV3(agent_state=agent_state, actor=actor)
#
#    # Track how many times request_async is called
#    call_count = 0
#
#    # Store original request_async method
#    original_request_async = agent_loop.llm_client.request_async
#
#    async def mock_request_async_with_error(request_data, llm_config):
#        nonlocal call_count
#        call_count += 1
#        if call_count == 1:
#            # First call raises OpenAI BadRequestError with context_length_exceeded error code
#            # This will be properly converted to ContextWindowExceededError by handle_llm_error
#            import httpx
#
#            # Create a mock response with the required structure
#            mock_request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
#            mock_response = httpx.Response(
#                status_code=400,
#                request=mock_request,
#                json={
#                    "error": {
#                        "message": "This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                        "type": "invalid_request_error",
#                        "code": "context_length_exceeded",
#                    }
#                },
#            )
#
#            raise openai.BadRequestError(
#                message="This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                response=mock_response,
#                body={
#                    "error": {
#                        "message": "This model's maximum context length is 8000 tokens. However, your messages resulted in 12000 tokens.",
#                        "type": "invalid_request_error",
#                        "code": "context_length_exceeded",
#                    }
#                },
#            )
#        # Subsequent calls use the real implementation
#        return await original_request_async(request_data, llm_config)
#
#    # Patch the llm_client's request_async to raise ContextWindowExceededError on first call
#    with patch.object(agent_loop.llm_client, "request_async", side_effect=mock_request_async_with_error):
#        # Execute a blocking step
#        try:
#            result = await agent_loop.step(
#                input_messages=[input_message],
#                max_steps=1,
#                run_id=test_run_id,
#            )
#        except Exception as e:
#            # Some errors might happen due to real LLM calls after retry
#            print(f"Exception during step: {e}")
#
#    # Reload agent state to get updated message_ids after summarization
#    updated_agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=agent_state.id, actor=actor)
#    updated_message_count = len(updated_agent_state.message_ids)
#
#    # Fetch the updated in-context messages
#    updated_in_context_messages = await server.message_manager.get_messages_by_ids_async(
#        message_ids=updated_agent_state.message_ids, actor=actor
#    )
#
#    # Convert to LettaMessage format for easier content inspection
#    letta_messages = PydanticMessage.to_letta_messages_from_list(updated_in_context_messages)
#
#    # Verify a summary message exists with the correct format
#    # The summary message has content with type="system_alert" and message containing:
#    # "prior messages ... have been hidden" and "summary of the previous"
#    import json
#
#    summary_message_found = False
#    summary_message_text = None
#    for msg in letta_messages:
#        # Not all message types have a content attribute (e.g., ReasoningMessage)
#        if not hasattr(msg, "content"):
#            continue
#
#        content = msg.content
#        # Content can be a string (JSON) or an object with type/message fields
#        if isinstance(content, str):
#            # Try to parse as JSON
#            try:
#                parsed = json.loads(content)
#                if isinstance(parsed, dict) and parsed.get("type") == "system_alert":
#                    text_to_check = parsed.get("message", "").lower()
#                    if "prior messages" in text_to_check and "hidden" in text_to_check and "summary of the previous" in text_to_check:
#                        summary_message_found = True
#                        summary_message_text = parsed.get("message")
#                        break
#            except (json.JSONDecodeError, TypeError):
#                pass
#        # Check if content has system_alert type with the summary message (object form)
#        elif hasattr(content, "type") and content.type == "system_alert":
#            if hasattr(content, "message") and content.message:
#                text_to_check = content.message.lower()
#                if "prior messages" in text_to_check and "hidden" in text_to_check and "summary of the previous" in text_to_check:
#                    summary_message_found = True
#                    summary_message_text = content.message
#                    break
#
#    assert summary_message_found, (
#        "A summary message should exist in the in-context messages after summarization. "
#        "Expected format containing 'prior messages...hidden' and 'summary of the previous'"
#    )
#
#    # Verify we attempted multiple invocations (the failing one + retry after summarization)
#    assert call_count >= 2, f"Expected at least 2 LLM invocations (initial + retry), got {call_count}"
#
#    # The original messages should have been compacted - the updated count should be less than
#    # original + the new messages added (input + assistant response + tool results)
#    print("Test passed: Summary message found in context (blocking mode)")
#    print(f"Original message count: {original_message_count}, Updated: {updated_message_count}")
#    print(f"Summary message: {summary_message_text[:200] if summary_message_text else 'N/A'}...")
#    print(f"Total LLM invocations: {call_count}")
#
#


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_summarize_all(server: SyncServer, actor, llm_config: LLMConfig):
    """
    Test the summarize_all function with real LLM calls.

    This test verifies that the 'all' summarization mode works correctly,
    summarizing the entire conversation into a single summary string.
    """
    from letta.services.summarizer.summarizer_all import summarize_all
    from letta.services.summarizer.summarizer_config import CompactionSettings

    # Create a summarizer config with "all" mode
    handle = llm_config.handle or f"{llm_config.model_endpoint_type}/{llm_config.model}"
    summarizer_config = CompactionSettings(model=handle)
    summarizer_config.mode = "all"

    # Create test messages - a simple conversation
    messages = [
        PydanticMessage(
            role=MessageRole.system,
            content=[TextContent(type="text", text="You are a helpful assistant.")],
        )
    ]

    # Add 10 user-assistant pairs
    for i in range(10):
        messages.append(
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(type="text", text=f"User message {i}: What is {i} + {i}?")],
            )
        )
        messages.append(
            PydanticMessage(
                role=MessageRole.assistant,
                content=[TextContent(type="text", text=f"Assistant response {i}: {i} + {i} = {i * 2}.")],
            )
        )

    assert len(messages) == 21, f"Expected 21 messages, got {len(messages)}"

    # Call summarize_all with real LLM
    summary, new_in_context_messages = await summarize_all(
        actor=actor,
        llm_config=llm_config,
        summarizer_config=summarizer_config,
        in_context_messages=messages,
    )

    # Verify the summary was generated
    assert len(new_in_context_messages) == 1
    assert summary is not None
    assert len(summary) > 0
    assert len(summary) <= 2000

    print(f"Successfully summarized {len(messages)} messages using 'all' mode")
    print(f"Summary: {summary[:200]}..." if len(summary) > 200 else f"Summary: {summary}")
    print(f"Using {llm_config.model_endpoint_type} for model {llm_config.model}")
