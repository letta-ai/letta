import json
import logging
import os
import random
import re
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import List
from unittest.mock import AsyncMock, Mock, patch

import pytest
from _pytest.python_api import approx
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.messages import BetaMessageBatchIndividualResponse, BetaMessageBatchSucceededResult

# Import shared fixtures and constants from conftest
from conftest import (
    CREATE_DELAY_SQLITE,
    DEFAULT_EMBEDDING_CONFIG,
    USING_SQLITE,
)
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall, Function as OpenAIFunction
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm.exc import StaleDataError

from letta.config import LettaConfig
from letta.constants import (
    BASE_MEMORY_TOOLS,
    BASE_SLEEPTIME_TOOLS,
    BASE_TOOLS,
    BASE_VOICE_SLEEPTIME_CHAT_TOOLS,
    BASE_VOICE_SLEEPTIME_TOOLS,
    BUILTIN_TOOLS,
    DEFAULT_ORG_ID,
    DEFAULT_ORG_NAME,
    FILES_TOOLS,
    LETTA_TOOL_EXECUTION_DIR,
    LETTA_TOOL_SET,
    LOCAL_ONLY_MULTI_AGENT_TOOLS,
    MCP_TOOL_TAG_NAME_PREFIX,
    MULTI_AGENT_TOOLS,
)
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import LettaAgentNotFoundError
from letta.functions.functions import derive_openai_json_schema, parse_source_code
from letta.functions.mcp_client.types import MCPTool
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import AsyncTimer
from letta.jobs.types import ItemUpdateInfo, RequestStatusUpdateInfo, StepStatusUpdateInfo
from letta.orm import Base, Block
from letta.orm.block_history import BlockHistory
from letta.orm.errors import NoResultFound, UniqueConstraintViolationError
from letta.orm.file import FileContent as FileContentModel, FileMetadata as FileMetadataModel
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.block import Block as PydanticBlock, BlockUpdate, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import (
    ActorType,
    AgentStepStatus,
    FileProcessingStatus,
    JobStatus,
    JobType,
    MessageRole,
    ProviderType,
    SandboxType,
    StepStatus,
    TagMatchMode,
    ToolType,
    VectorDBProvider,
)
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate, SandboxEnvironmentVariableUpdate
from letta.schemas.file import FileMetadata, FileMetadata as PydanticFileMetadata
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityPropertyType, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.job import BatchJob, Job, Job as PydanticJob, JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import UpdateAssistantMessage, UpdateReasoningMessage, UpdateSystemMessage, UpdateUserMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.llm_batch_job import AgentStepState, LLMBatchItem
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage, MessageCreate, MessageUpdate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.organization import Organization, Organization as PydanticOrganization, OrganizationUpdate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.run import Run as PydanticRun
from letta.schemas.sandbox_config import E2BSandboxConfig, LocalSandboxConfig, SandboxConfigCreate, SandboxConfigUpdate
from letta.schemas.source import Source as PydanticSource, SourceUpdate
from letta.schemas.tool import Tool as PydanticTool, ToolCreate, ToolUpdate
from letta.schemas.tool_rule import InitToolRule
from letta.schemas.user import User as PydanticUser, UserUpdate
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import calculate_base_tools, calculate_multi_agent_tools, validate_agent_exists_async
from letta.services.step_manager import FeedbackType
from letta.settings import settings, tool_settings
from letta.utils import calculate_file_defaults_based_on_context_window
from tests.helpers.utils import comprehensive_agent_checks, validate_context_window_overview
from tests.utils import random_string

# ======================================================================================================================
# AgentManager Tests - Messages Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_reset_messages_no_messages(server: SyncServer, sarah_agent, default_user):
    """
    Test that resetting messages on an agent that has zero messages
    does not fail and clears out message_ids if somehow it's non-empty.
    """
    assert len(sarah_agent.message_ids) == 4
    og_message_ids = sarah_agent.message_ids

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert og_message_ids[0] == reset_agent.message_ids[0]
    # Double check that physically no messages exist
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_default_messages(server: SyncServer, sarah_agent, default_user):
    """
    Test that resetting messages on an agent that has zero messages
    does not fail and clears out message_ids if somehow it's non-empty.
    """
    assert len(sarah_agent.message_ids) == 4
    og_message_ids = sarah_agent.message_ids

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(
        agent_id=sarah_agent.id, actor=default_user, add_default_initial_messages=True
    )
    assert len(reset_agent.message_ids) == 4
    assert og_message_ids[0] == reset_agent.message_ids[0]
    assert og_message_ids[1] != reset_agent.message_ids[1]
    assert og_message_ids[2] != reset_agent.message_ids[2]
    assert og_message_ids[3] != reset_agent.message_ids[3]
    # Double check that physically no messages exist
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 4


@pytest.mark.asyncio
async def test_reset_messages_with_existing_messages(server: SyncServer, sarah_agent, default_user):
    """
    Test that resetting messages on an agent with actual messages
    deletes them from the database and clears message_ids.
    """
    # 1. Create multiple messages for the agent
    msg1 = await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role="user",
                content=[TextContent(text="Hello, Sarah!")],
            ),
        ],
        actor=default_user,
    )
    msg1 = msg1[0]

    msg2 = await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role="assistant",
                content=[TextContent(text="Hello, user!")],
            ),
        ],
        actor=default_user,
    )
    msg2 = msg2[0]

    # Verify the messages were created
    agent_before = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    # This is 4 because creating the message does not necessarily add it to the in context message ids
    assert len(agent_before.message_ids) == 4
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 6

    # 2. Reset all messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # 3. Verify the agent now has zero message_ids
    assert len(reset_agent.message_ids) == 1

    # 4. Verify the messages are physically removed
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_idempotency(server: SyncServer, sarah_agent, default_user):
    """
    Test that calling reset_messages multiple times has no adverse effect.
    """
    # Clear messages first
    await server.message_manager.delete_messages_by_ids_async(message_ids=sarah_agent.message_ids[1:], actor=default_user)

    # Create a single message
    await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role="user",
                content=[TextContent(text="Hello, Sarah!")],
            ),
        ],
        actor=default_user,
    )
    # First reset
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1

    # Second reset should do nothing new
    reset_agent_again = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(reset_agent.message_ids) == 1
    assert await server.message_manager.size_async(agent_id=sarah_agent.id, actor=default_user) == 1


@pytest.mark.asyncio
async def test_reset_messages_preserves_system_message_id(server: SyncServer, sarah_agent, default_user):
    """
    Test that resetting messages preserves the original system message ID.
    """
    # Get the original system message ID
    original_agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    original_system_message_id = original_agent.message_ids[0]

    # Add some user messages
    await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role="user",
                content=[TextContent(text="Hello!")],
            ),
        ],
        actor=default_user,
    )

    # Reset messages
    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # Verify the system message ID is preserved
    assert len(reset_agent.message_ids) == 1
    assert reset_agent.message_ids[0] == original_system_message_id

    # Verify the system message still exists in the database
    system_message = await server.message_manager.get_message_by_id_async(message_id=original_system_message_id, actor=default_user)
    assert system_message.role == "system"


@pytest.mark.asyncio
async def test_reset_messages_preserves_system_message_content(server: SyncServer, sarah_agent, default_user):
    """
    Test that resetting messages preserves the original system message content.
    """
    # Get the original system message
    original_agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, default_user)
    original_system_message = await server.message_manager.get_message_by_id_async(
        message_id=original_agent.message_ids[0], actor=default_user
    )

    # Add some messages and reset
    await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role="user",
                content=[TextContent(text="Hello!")],
            ),
        ],
        actor=default_user,
    )

    reset_agent = await server.agent_manager.reset_messages_async(agent_id=sarah_agent.id, actor=default_user)

    # Verify the system message content is unchanged
    preserved_system_message = await server.message_manager.get_message_by_id_async(
        message_id=reset_agent.message_ids[0], actor=default_user
    )

    assert preserved_system_message.content == original_system_message.content
    assert preserved_system_message.role == "system"
    assert preserved_system_message.id == original_system_message.id


@pytest.mark.asyncio
async def test_modify_letta_message(server: SyncServer, sarah_agent, default_user):
    """
    Test updating a message.
    """

    messages = await server.message_manager.list_messages(agent_id=sarah_agent.id, actor=default_user)
    letta_messages = PydanticMessage.to_letta_messages_from_list(messages=messages)

    system_message = [msg for msg in letta_messages if msg.message_type == "system_message"][0]
    assistant_message = [msg for msg in letta_messages if msg.message_type == "assistant_message"][0]
    user_message = [msg for msg in letta_messages if msg.message_type == "user_message"][0]
    reasoning_message = [msg for msg in letta_messages if msg.message_type == "reasoning_message"][0]

    # user message
    update_user_message = UpdateUserMessage(content="Hello, Sarah!")
    original_user_message = await server.message_manager.get_message_by_id_async(message_id=user_message.id, actor=default_user)
    assert original_user_message.content[0].text != update_user_message.content
    await server.message_manager.update_message_by_letta_message_async(
        message_id=user_message.id, letta_message_update=update_user_message, actor=default_user
    )
    updated_user_message = await server.message_manager.get_message_by_id_async(message_id=user_message.id, actor=default_user)
    assert updated_user_message.content[0].text == update_user_message.content

    # system message
    update_system_message = UpdateSystemMessage(content="You are a friendly assistant!")
    original_system_message = await server.message_manager.get_message_by_id_async(message_id=system_message.id, actor=default_user)
    assert original_system_message.content[0].text != update_system_message.content
    await server.message_manager.update_message_by_letta_message_async(
        message_id=system_message.id, letta_message_update=update_system_message, actor=default_user
    )
    updated_system_message = await server.message_manager.get_message_by_id_async(message_id=system_message.id, actor=default_user)
    assert updated_system_message.content[0].text == update_system_message.content

    # reasoning message
    update_reasoning_message = UpdateReasoningMessage(reasoning="I am thinking")
    original_reasoning_message = await server.message_manager.get_message_by_id_async(message_id=reasoning_message.id, actor=default_user)
    assert original_reasoning_message.content[0].text != update_reasoning_message.reasoning
    await server.message_manager.update_message_by_letta_message_async(
        message_id=reasoning_message.id, letta_message_update=update_reasoning_message, actor=default_user
    )
    updated_reasoning_message = await server.message_manager.get_message_by_id_async(message_id=reasoning_message.id, actor=default_user)
    assert updated_reasoning_message.content[0].text == update_reasoning_message.reasoning

    # assistant message
    def parse_send_message(tool_call):
        import json

        function_call = tool_call.function
        arguments = json.loads(function_call.arguments)
        return arguments["message"]

    update_assistant_message = UpdateAssistantMessage(content="I am an agent!")
    original_assistant_message = await server.message_manager.get_message_by_id_async(message_id=assistant_message.id, actor=default_user)
    print("ORIGINAL", original_assistant_message.tool_calls)
    print("MESSAGE", parse_send_message(original_assistant_message.tool_calls[0]))
    assert parse_send_message(original_assistant_message.tool_calls[0]) != update_assistant_message.content
    await server.message_manager.update_message_by_letta_message_async(
        message_id=assistant_message.id, letta_message_update=update_assistant_message, actor=default_user
    )
    updated_assistant_message = await server.message_manager.get_message_by_id_async(message_id=assistant_message.id, actor=default_user)
    print("UPDATED", updated_assistant_message.tool_calls)
    print("MESSAGE", parse_send_message(updated_assistant_message.tool_calls[0]))
    assert parse_send_message(updated_assistant_message.tool_calls[0]) == update_assistant_message.content

    # TODO: tool calls/responses


@pytest.mark.asyncio
async def test_message_create(server: SyncServer, hello_world_message_fixture, default_user):
    """Test creating a message using hello_world_message_fixture fixture"""
    assert hello_world_message_fixture.id is not None
    assert hello_world_message_fixture.content[0].text == "Hello, world!"
    assert hello_world_message_fixture.role == "user"

    # Verify we can retrieve it
    retrieved = await server.message_manager.get_message_by_id_async(
        hello_world_message_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == hello_world_message_fixture.id
    assert retrieved.content[0].text == hello_world_message_fixture.content[0].text
    assert retrieved.role == hello_world_message_fixture.role


@pytest.mark.asyncio
async def test_message_get_by_id(server: SyncServer, hello_world_message_fixture, default_user):
    """Test retrieving a message by ID"""
    retrieved = await server.message_manager.get_message_by_id_async(hello_world_message_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == hello_world_message_fixture.id
    assert retrieved.content[0].text == hello_world_message_fixture.content[0].text


@pytest.mark.asyncio
async def test_message_update(server: SyncServer, hello_world_message_fixture, default_user, other_user):
    """Test updating a message"""
    new_text = "Updated text"
    updated = await server.message_manager.update_message_by_id_async(
        hello_world_message_fixture.id, MessageUpdate(content=new_text), actor=other_user
    )
    assert updated is not None
    assert updated.content[0].text == new_text
    retrieved = await server.message_manager.get_message_by_id_async(hello_world_message_fixture.id, actor=default_user)
    assert retrieved.content[0].text == new_text

    # Assert that orm metadata fields are populated
    assert retrieved.created_by_id == default_user.id
    assert retrieved.last_updated_by_id == other_user.id


@pytest.mark.asyncio
async def test_message_delete(server: SyncServer, hello_world_message_fixture, default_user):
    """Test deleting a message"""
    await server.message_manager.delete_message_by_id_async(hello_world_message_fixture.id, actor=default_user)
    retrieved = await server.message_manager.get_message_by_id_async(hello_world_message_fixture.id, actor=default_user)
    assert retrieved is None


@pytest.mark.asyncio
async def test_message_size(server: SyncServer, hello_world_message_fixture, default_user):
    """Test counting messages with filters"""
    base_message = hello_world_message_fixture

    # Create additional test messages
    messages = [
        PydanticMessage(
            agent_id=base_message.agent_id,
            role=base_message.role,
            content=[TextContent(text=f"Test message {i}")],
        )
        for i in range(4)
    ]
    await server.message_manager.create_many_messages_async(messages, actor=default_user)

    # Test total count
    total = await server.message_manager.size_async(actor=default_user, role=MessageRole.user)
    assert total == 6  # login message + base message + 4 test messages
    # TODO: change login message to be a system not user message

    # Test count with agent filter
    agent_count = await server.message_manager.size_async(actor=default_user, agent_id=base_message.agent_id, role=MessageRole.user)
    assert agent_count == 6

    # Test count with role filter
    role_count = await server.message_manager.size_async(actor=default_user, role=base_message.role)
    assert role_count == 6

    # Test count with non-existent filter
    empty_count = await server.message_manager.size_async(actor=default_user, agent_id="non-existent", role=MessageRole.user)
    assert empty_count == 0


async def create_test_messages(server: SyncServer, base_message: PydanticMessage, default_user) -> list[PydanticMessage]:
    """Helper function to create test messages for all tests"""
    messages = [
        PydanticMessage(
            agent_id=base_message.agent_id,
            role=base_message.role,
            content=[TextContent(text=f"Test message {i}")],
        )
        for i in range(4)
    ]
    await server.message_manager.create_many_messages_async(messages, actor=default_user)
    return messages


@pytest.mark.asyncio
async def test_get_messages_by_ids(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test basic message listing with limit"""
    messages = await create_test_messages(server, hello_world_message_fixture, default_user)
    message_ids = [m.id for m in messages]

    results = await server.message_manager.get_messages_by_ids_async(message_ids=message_ids, actor=default_user)
    assert sorted(message_ids) == sorted([r.id for r in results])


@pytest.mark.asyncio
async def test_message_listing_basic(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test basic message listing with limit"""
    await create_test_messages(server, hello_world_message_fixture, default_user)

    results = await server.message_manager.list_user_messages_for_agent_async(agent_id=sarah_agent.id, limit=3, actor=default_user)
    assert len(results) == 3


@pytest.mark.asyncio
async def test_message_listing_cursor(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test cursor-based pagination functionality"""
    await create_test_messages(server, hello_world_message_fixture, default_user)

    # Make sure there are 6 messages
    assert await server.message_manager.size_async(actor=default_user, role=MessageRole.user) == 6

    # Get first page
    first_page = await server.message_manager.list_user_messages_for_agent_async(agent_id=sarah_agent.id, actor=default_user, limit=3)
    assert len(first_page) == 3

    last_id_on_first_page = first_page[-1].id

    # Get second page
    second_page = await server.message_manager.list_user_messages_for_agent_async(
        agent_id=sarah_agent.id, actor=default_user, after=last_id_on_first_page, limit=3
    )
    assert len(second_page) == 3  # Should have 3 remaining messages
    assert all(r1.id != r2.id for r1 in first_page for r2 in second_page)

    # Get the middle
    middle_page = await server.message_manager.list_user_messages_for_agent_async(
        agent_id=sarah_agent.id, actor=default_user, before=second_page[1].id, after=first_page[0].id
    )
    assert len(middle_page) == 3
    assert middle_page[0].id == first_page[1].id
    assert middle_page[1].id == first_page[-1].id
    assert middle_page[-1].id == second_page[0].id

    middle_page_desc = await server.message_manager.list_user_messages_for_agent_async(
        agent_id=sarah_agent.id, actor=default_user, before=second_page[1].id, after=first_page[0].id, ascending=False
    )
    assert len(middle_page_desc) == 3
    assert middle_page_desc[0].id == second_page[0].id
    assert middle_page_desc[1].id == first_page[-1].id
    assert middle_page_desc[-1].id == first_page[1].id


@pytest.mark.asyncio
async def test_message_listing_filtering(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test filtering messages by agent ID"""
    await create_test_messages(server, hello_world_message_fixture, default_user)

    agent_results = await server.message_manager.list_user_messages_for_agent_async(agent_id=sarah_agent.id, actor=default_user, limit=10)
    assert len(agent_results) == 6  # login message + base message + 4 test messages
    assert all(msg.agent_id == hello_world_message_fixture.agent_id for msg in agent_results)


@pytest.mark.asyncio
async def test_message_listing_text_search(server: SyncServer, hello_world_message_fixture, default_user, sarah_agent):
    """Test searching messages by text content"""
    await create_test_messages(server, hello_world_message_fixture, default_user)

    search_results = await server.message_manager.list_user_messages_for_agent_async(
        agent_id=sarah_agent.id, actor=default_user, query_text="Test message", limit=10
    )
    assert len(search_results) == 4
    assert all("Test message" in msg.content[0].text for msg in search_results)

    # Test no results
    search_results = await server.message_manager.list_user_messages_for_agent_async(
        agent_id=sarah_agent.id, actor=default_user, query_text="Letta", limit=10
    )
    assert len(search_results) == 0


@pytest.mark.asyncio
async def test_create_many_messages_async_basic(server: SyncServer, sarah_agent, default_user):
    """Test basic batch creation of messages"""
    message_manager = server.message_manager

    messages = []
    for i in range(5):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Test message {i}")],
            name=None,
            tool_calls=None,
            tool_call_id=None,
        )
        messages.append(msg)

    created_messages = await message_manager.create_many_messages_async(pydantic_msgs=messages, actor=default_user)

    assert len(created_messages) == 5
    for i, msg in enumerate(created_messages):
        assert msg.id is not None
        assert msg.content[0].text == f"Test message {i}"
        assert msg.agent_id == sarah_agent.id


@pytest.mark.asyncio
async def test_create_many_messages_async_allow_partial_false(server: SyncServer, sarah_agent, default_user):
    """Test that allow_partial=False (default) fails on duplicate IDs"""
    message_manager = server.message_manager

    initial_msg = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Initial message")],
    )

    created = await message_manager.create_many_messages_async(pydantic_msgs=[initial_msg], actor=default_user)
    assert len(created) == 1
    created_msg = created[0]

    duplicate_msg = PydanticMessage(
        id=created_msg.id,
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Duplicate message")],
    )

    with pytest.raises(UniqueConstraintViolationError):
        await message_manager.create_many_messages_async(pydantic_msgs=[duplicate_msg], actor=default_user, allow_partial=False)


@pytest.mark.asyncio
async def test_create_many_messages_async_allow_partial_true_some_duplicates(server: SyncServer, sarah_agent, default_user):
    """Test that allow_partial=True handles partial duplicates correctly"""
    message_manager = server.message_manager

    initial_messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Existing message {i}")],
        )
        initial_messages.append(msg)

    created_initial = await message_manager.create_many_messages_async(pydantic_msgs=initial_messages, actor=default_user)
    assert len(created_initial) == 3
    existing_ids = [msg.id for msg in created_initial]

    mixed_messages = []
    for created_msg in created_initial:
        duplicate_msg = PydanticMessage(
            id=created_msg.id,
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=created_msg.content,
        )
        mixed_messages.append(duplicate_msg)
    for i in range(3, 6):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"New message {i}")],
        )
        mixed_messages.append(msg)

    result = await message_manager.create_many_messages_async(pydantic_msgs=mixed_messages, actor=default_user, allow_partial=True)

    assert len(result) == 6

    result_ids = {msg.id for msg in result}
    for existing_id in existing_ids:
        assert existing_id in result_ids


@pytest.mark.asyncio
async def test_create_many_messages_async_allow_partial_true_all_duplicates(server: SyncServer, sarah_agent, default_user):
    """Test that allow_partial=True handles all duplicates correctly"""
    message_manager = server.message_manager

    initial_messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Message {i}")],
        )
        initial_messages.append(msg)

    created_initial = await message_manager.create_many_messages_async(pydantic_msgs=initial_messages, actor=default_user)
    assert len(created_initial) == 3

    duplicate_messages = []
    for created_msg in created_initial:
        duplicate_msg = PydanticMessage(
            id=created_msg.id,
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=created_msg.content,
        )
        duplicate_messages.append(duplicate_msg)

    result = await message_manager.create_many_messages_async(pydantic_msgs=duplicate_messages, actor=default_user, allow_partial=True)

    assert len(result) == 3
    for i, msg in enumerate(result):
        assert msg.id == created_initial[i].id
        assert msg.content[0].text == f"Message {i}"


@pytest.mark.asyncio
async def test_create_many_messages_async_empty_list(server: SyncServer, default_user):
    """Test that empty list returns empty list"""
    message_manager = server.message_manager

    result = await message_manager.create_many_messages_async(pydantic_msgs=[], actor=default_user)

    assert result == []


@pytest.mark.asyncio
async def test_check_existing_message_ids(server: SyncServer, sarah_agent, default_user):
    """Test the check_existing_message_ids convenience function"""
    message_manager = server.message_manager

    messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Message {i}")],
        )
        messages.append(msg)

    created_messages = await message_manager.create_many_messages_async(pydantic_msgs=messages, actor=default_user)
    existing_ids = [msg.id for msg in created_messages]

    non_existent_ids = [f"message-{uuid.uuid4().hex[:8]}" for _ in range(3)]
    all_ids = existing_ids + non_existent_ids

    existing = await message_manager.check_existing_message_ids(message_ids=all_ids, actor=default_user)

    assert existing == set(existing_ids)
    for non_existent_id in non_existent_ids:
        assert non_existent_id not in existing


@pytest.mark.asyncio
async def test_filter_existing_messages(server: SyncServer, sarah_agent, default_user):
    """Test the filter_existing_messages helper function"""
    message_manager = server.message_manager

    initial_messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Existing {i}")],
        )
        initial_messages.append(msg)

    created_existing = await message_manager.create_many_messages_async(pydantic_msgs=initial_messages, actor=default_user)

    existing_messages = []
    for created_msg in created_existing:
        msg = PydanticMessage(
            id=created_msg.id,
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=created_msg.content,
        )
        existing_messages.append(msg)

    new_messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"New {i}")],
        )
        new_messages.append(msg)

    all_messages = existing_messages + new_messages

    new_filtered, existing_filtered = await message_manager.filter_existing_messages(messages=all_messages, actor=default_user)

    assert len(new_filtered) == 3
    assert len(existing_filtered) == 3

    existing_filtered_ids = {msg.id for msg in existing_filtered}
    for created_msg in created_existing:
        assert created_msg.id in existing_filtered_ids

    for msg in new_filtered:
        assert msg.id not in existing_filtered_ids


@pytest.mark.asyncio
async def test_create_many_messages_async_with_turbopuffer(server: SyncServer, sarah_agent, default_user):
    """Test batch creation with turbopuffer embedding (if enabled)"""
    message_manager = server.message_manager

    messages = []
    for i in range(3):
        msg = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Important information about topic {i}")],
        )
        messages.append(msg)

    created_messages = await message_manager.create_many_messages_async(
        pydantic_msgs=messages, actor=default_user, strict_mode=True, project_id="test_project", template_id="test_template"
    )

    assert len(created_messages) == 3
    for msg in created_messages:
        assert msg.id is not None
        assert msg.agent_id == sarah_agent.id


# ======================================================================================================================
# Pydantic Object Tests - Tool Call Message Conversion
# ======================================================================================================================


@pytest.mark.asyncio
async def test_convert_tool_call_messages_no_assistant_mode(server: SyncServer, sarah_agent, default_user):
    """Test that when assistant mode is off, all tool calls go into a single ToolCallMessage"""
    from letta.schemas.letta_message import ToolCall

    # create a message with multiple tool calls
    tool_calls = [
        OpenAIToolCall(
            id="call_1", type="function", function=OpenAIFunction(name="archival_memory_insert", arguments='{"content": "test memory 1"}')
        ),
        OpenAIToolCall(
            id="call_2", type="function", function=OpenAIFunction(name="conversation_search", arguments='{"query": "test search"}')
        ),
        OpenAIToolCall(id="call_3", type="function", function=OpenAIFunction(name="send_message", arguments='{"message": "Hello there!"}')),
    ]

    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.assistant,
        content=[TextContent(text="Let me help you with that.")],
        tool_calls=tool_calls,
    )

    # convert without assistant mode (reverse=True by default)
    letta_messages = message.to_letta_messages(use_assistant_message=False)

    # should have 2 messages in reverse order: tool call message, then reasoning message
    assert len(letta_messages) == 2
    assert letta_messages[0].message_type == "tool_call_message"
    assert letta_messages[1].message_type == "reasoning_message"

    # check the tool call message has all tool calls in the new field
    tool_call_msg = letta_messages[0]
    assert tool_call_msg.tool_calls is not None
    assert len(tool_call_msg.tool_calls) == 3

    # check backwards compatibility - first tool call in deprecated field
    assert tool_call_msg.tool_call is not None
    assert tool_call_msg.tool_call.name == "archival_memory_insert"
    assert tool_call_msg.tool_call.tool_call_id == "call_1"

    # verify all tool calls are present in the list
    tool_names = [tc.name for tc in tool_call_msg.tool_calls]
    assert "archival_memory_insert" in tool_names
    assert "conversation_search" in tool_names
    assert "send_message" in tool_names


@pytest.mark.asyncio
async def test_convert_tool_call_messages_with_assistant_mode(server: SyncServer, sarah_agent, default_user):
    """Test that with assistant mode, send_message becomes AssistantMessage and others are grouped"""

    # create a message with tool calls including send_message
    tool_calls = [
        OpenAIToolCall(
            id="call_1", type="function", function=OpenAIFunction(name="archival_memory_insert", arguments='{"content": "test memory 1"}')
        ),
        OpenAIToolCall(id="call_2", type="function", function=OpenAIFunction(name="send_message", arguments='{"message": "Hello there!"}')),
        OpenAIToolCall(
            id="call_3", type="function", function=OpenAIFunction(name="conversation_search", arguments='{"query": "test search"}')
        ),
    ]

    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.assistant,
        content=[TextContent(text="Let me help you with that.")],
        tool_calls=tool_calls,
    )

    # convert with assistant mode (reverse=True by default)
    letta_messages = message.to_letta_messages(use_assistant_message=True)

    # should have 4 messages in reverse order:
    # conversation_search tool call, assistant message, archival_memory tool call, reasoning
    assert len(letta_messages) == 4
    assert letta_messages[0].message_type == "tool_call_message"
    assert letta_messages[1].message_type == "assistant_message"
    assert letta_messages[2].message_type == "tool_call_message"
    assert letta_messages[3].message_type == "reasoning_message"

    # check first tool call message (actually the last in forward order) has conversation_search
    first_tool_msg = letta_messages[0]
    assert len(first_tool_msg.tool_calls) == 1
    assert first_tool_msg.tool_calls[0].name == "conversation_search"
    assert first_tool_msg.tool_call.name == "conversation_search"  # backwards compat

    # check assistant message content
    assistant_msg = letta_messages[1]
    assert assistant_msg.content == "Hello there!"

    # check last tool call message (actually the first in forward order) has archival_memory_insert
    last_tool_msg = letta_messages[2]
    assert len(last_tool_msg.tool_calls) == 1
    assert last_tool_msg.tool_calls[0].name == "archival_memory_insert"
    assert last_tool_msg.tool_call.name == "archival_memory_insert"  # backwards compat


@pytest.mark.asyncio
async def test_convert_tool_call_messages_multiple_non_assistant_tools(server: SyncServer, sarah_agent, default_user):
    """Test that multiple non-assistant tools are batched together until assistant tool is reached"""

    tool_calls = [
        OpenAIToolCall(
            id="call_1", type="function", function=OpenAIFunction(name="archival_memory_insert", arguments='{"content": "memory 1"}')
        ),
        OpenAIToolCall(
            id="call_2", type="function", function=OpenAIFunction(name="conversation_search", arguments='{"query": "search 1"}')
        ),
        OpenAIToolCall(
            id="call_3", type="function", function=OpenAIFunction(name="archival_memory_search", arguments='{"query": "archive search"}')
        ),
        OpenAIToolCall(
            id="call_4", type="function", function=OpenAIFunction(name="send_message", arguments='{"message": "Results found!"}')
        ),
    ]

    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.assistant,
        content=[TextContent(text="Processing...")],
        tool_calls=tool_calls,
    )

    # convert with assistant mode (reverse=True by default)
    letta_messages = message.to_letta_messages(use_assistant_message=True)

    # should have 3 messages in reverse order: assistant, tool call (with 3 tools), reasoning
    assert len(letta_messages) == 3
    assert letta_messages[0].message_type == "assistant_message"
    assert letta_messages[1].message_type == "tool_call_message"
    assert letta_messages[2].message_type == "reasoning_message"

    # check the tool call message has all 3 non-assistant tools
    tool_msg = letta_messages[1]
    assert len(tool_msg.tool_calls) == 3
    tool_names = [tc.name for tc in tool_msg.tool_calls]
    assert "archival_memory_insert" in tool_names
    assert "conversation_search" in tool_names
    assert "archival_memory_search" in tool_names

    # check backwards compat field has first tool
    assert tool_msg.tool_call.name == "archival_memory_insert"

    # check assistant message
    assert letta_messages[0].content == "Results found!"


@pytest.mark.asyncio
async def test_convert_single_tool_call_both_fields(server: SyncServer, sarah_agent, default_user):
    """Test that a single tool call is written to both tool_call and tool_calls fields"""

    tool_calls = [
        OpenAIToolCall(
            id="call_1",
            type="function",
            function=OpenAIFunction(name="archival_memory_insert", arguments='{"content": "single tool call"}'),
        ),
    ]

    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.assistant,
        content=[TextContent(text="Saving to memory...")],
        tool_calls=tool_calls,
    )

    # test without assistant mode (reverse=True by default)
    letta_messages = message.to_letta_messages(use_assistant_message=False)

    assert len(letta_messages) == 2  # tool call + reasoning (reversed)
    tool_msg = letta_messages[0]  # tool call is first due to reverse

    # both fields should be populated
    assert tool_msg.tool_call is not None
    assert tool_msg.tool_call.name == "archival_memory_insert"

    assert tool_msg.tool_calls is not None
    assert len(tool_msg.tool_calls) == 1
    assert tool_msg.tool_calls[0].name == "archival_memory_insert"
    assert tool_msg.tool_calls[0].tool_call_id == "call_1"

    # test with assistant mode (reverse=True by default)
    letta_messages_assist = message.to_letta_messages(use_assistant_message=True)

    assert len(letta_messages_assist) == 2  # tool call + reasoning (reversed)
    tool_msg_assist = letta_messages_assist[0]  # tool call is first due to reverse

    # both fields should still be populated
    assert tool_msg_assist.tool_call is not None
    assert tool_msg_assist.tool_calls is not None
    assert len(tool_msg_assist.tool_calls) == 1


@pytest.mark.asyncio
async def test_convert_tool_calls_only_assistant_tools(server: SyncServer, sarah_agent, default_user):
    """Test that only send_message tools are converted to AssistantMessages"""

    tool_calls = [
        OpenAIToolCall(
            id="call_1", type="function", function=OpenAIFunction(name="send_message", arguments='{"message": "First message"}')
        ),
        OpenAIToolCall(
            id="call_2", type="function", function=OpenAIFunction(name="send_message", arguments='{"message": "Second message"}')
        ),
    ]

    message = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.assistant,
        content=[TextContent(text="Sending messages...")],
        tool_calls=tool_calls,
    )

    # convert with assistant mode (reverse=True by default)
    letta_messages = message.to_letta_messages(use_assistant_message=True)

    # should have 3 messages in reverse order: 2 assistant messages, then reasoning
    assert len(letta_messages) == 3
    assert letta_messages[0].message_type == "assistant_message"
    assert letta_messages[1].message_type == "assistant_message"
    assert letta_messages[2].message_type == "reasoning_message"

    # check assistant messages content (they appear in reverse order)
    assert letta_messages[0].content == "Second message"
    assert letta_messages[1].content == "First message"
