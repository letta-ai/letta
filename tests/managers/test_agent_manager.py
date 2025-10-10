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
# Helper Functions
# ======================================================================================================================


async def _count_file_content_rows(session, file_id: str) -> int:
    q = select(func.count()).select_from(FileContentModel).where(FileContentModel.file_id == file_id)
    result = await session.execute(q)
    return result.scalar_one()


# ======================================================================================================================
# AgentManager Tests - Basic
# ======================================================================================================================
async def test_validate_agent_exists_async(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    """Test the validate_agent_exists_async helper function"""
    created_agent, _ = comprehensive_test_agent_fixture

    # test with valid agent
    async with db_registry.async_session() as session:
        # should not raise exception
        await validate_agent_exists_async(session, created_agent.id, default_user)

    # test with non-existent agent
    async with db_registry.async_session() as session:
        with pytest.raises(LettaAgentNotFoundError):
            await validate_agent_exists_async(session, "non-existent-id", default_user)


@pytest.mark.asyncio
async def test_create_get_list_agent(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    # Test agent creation
    created_agent, create_agent_request = comprehensive_test_agent_fixture
    comprehensive_agent_checks(created_agent, create_agent_request, actor=default_user)

    # Test get agent
    get_agent = await server.agent_manager.get_agent_by_id_async(agent_id=created_agent.id, actor=default_user)
    comprehensive_agent_checks(get_agent, create_agent_request, actor=default_user)

    # Test get agent name
    agents = await server.agent_manager.list_agents_async(name=created_agent.name, actor=default_user)
    get_agent_name = agents[0]
    comprehensive_agent_checks(get_agent_name, create_agent_request, actor=default_user)

    # Test list agent
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 1
    comprehensive_agent_checks(list_agents[0], create_agent_request, actor=default_user)

    # Test deleting the agent
    await server.agent_manager.delete_agent_async(get_agent.id, default_user)
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 0


@pytest.mark.asyncio
async def test_create_agent_include_base_tools(server: SyncServer, default_user):
    """Test agent creation with include_default_source=True"""
    # Upsert base tools
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    create_agent_request = CreateAgent(
        name="test_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        include_base_tools=True,
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Assert the tools exist
    tool_names = [t.name for t in created_agent.tools]
    expected_tools = calculate_base_tools(is_v2=True)
    assert sorted(tool_names) == sorted(expected_tools)


@pytest.mark.asyncio
async def test_create_agent_base_tool_rules_excluded_providers(server: SyncServer, default_user):
    """Test that include_base_tool_rules is overridden to False for excluded providers"""
    # Upsert base tools
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    # Test with excluded provider (openai)
    create_agent_request = CreateAgent(
        name="test_excluded_provider_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),  # This has model_endpoint_type="openai"
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        include_base_tool_rules=False,
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Assert that no base tool rules were added (since include_base_tool_rules was overridden to False)
    print(created_agent.tool_rules)
    assert created_agent.tool_rules is None or len(created_agent.tool_rules) == 0


@pytest.mark.asyncio
async def test_create_agent_base_tool_rules_non_excluded_providers(server: SyncServer, default_user):
    """Test that include_base_tool_rules is NOT overridden for non-excluded providers"""
    # Upsert base tools
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    # Test with non-excluded provider (together)
    create_agent_request = CreateAgent(
        name="test_non_excluded_provider_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig(
            model="llama-3.1-8b-instruct",
            model_endpoint_type="together",  # Model doesn't match EXCLUDE_MODEL_KEYWORDS_FROM_BASE_TOOL_RULES
            model_endpoint="https://api.together.xyz",
            context_window=8192,
        ),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        include_base_tool_rules=True,  # Should remain True
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Assert that base tool rules were added (since include_base_tool_rules remained True)
    assert created_agent.tool_rules is not None
    assert len(created_agent.tool_rules) > 0


@pytest.mark.asyncio
async def test_calculate_multi_agent_tools(set_letta_environment):
    """Test that calculate_multi_agent_tools excludes local-only tools in production."""
    result = calculate_multi_agent_tools()

    if settings.environment == "PRODUCTION":
        # Production environment should exclude local-only tools
        expected_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        assert result == expected_tools, "Production should exclude local-only multi-agent tools"
        assert not set(LOCAL_ONLY_MULTI_AGENT_TOOLS).intersection(result), "Production should not include local-only tools"

        # Verify specific tools
        assert "send_message_to_agent_and_wait_for_reply" in result, "Standard multi-agent tools should be in production"
        assert "send_message_to_agents_matching_tags" in result, "Standard multi-agent tools should be in production"
        assert "send_message_to_agent_async" not in result, "Local-only tools should not be in production"
    else:
        # Non-production environment should include all multi-agent tools
        assert result == set(MULTI_AGENT_TOOLS), "Non-production should include all multi-agent tools"
        assert set(LOCAL_ONLY_MULTI_AGENT_TOOLS).issubset(result), "Non-production should include local-only tools"

        # Verify specific tools
        assert "send_message_to_agent_and_wait_for_reply" in result, "All multi-agent tools should be in non-production"
        assert "send_message_to_agents_matching_tags" in result, "All multi-agent tools should be in non-production"
        assert "send_message_to_agent_async" in result, "Local-only tools should be in non-production"


async def test_upsert_base_tools_excludes_local_only_in_production(server: SyncServer, default_user, set_letta_environment):
    """Test that upsert_base_tools excludes local-only multi-agent tools in production."""
    # Upsert all base tools
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)
    tool_names = {tool.name for tool in tools}

    if settings.environment == "PRODUCTION":
        # Production environment should exclude local-only multi-agent tools
        for local_only_tool in LOCAL_ONLY_MULTI_AGENT_TOOLS:
            assert local_only_tool not in tool_names, f"Local-only tool '{local_only_tool}' should not be upserted in production"

        # But should include standard multi-agent tools
        standard_multi_agent_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        for standard_tool in standard_multi_agent_tools:
            assert standard_tool in tool_names, f"Standard multi-agent tool '{standard_tool}' should be upserted in production"
    else:
        # Non-production environment should include all multi-agent tools
        for tool in MULTI_AGENT_TOOLS:
            assert tool in tool_names, f"Multi-agent tool '{tool}' should be upserted in non-production"


async def test_upsert_multi_agent_tools_only(server: SyncServer, default_user, set_letta_environment):
    """Test that upserting only multi-agent tools respects production filtering."""
    from letta.schemas.enums import ToolType

    # Upsert only multi-agent tools
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_MULTI_AGENT_CORE})
    tool_names = {tool.name for tool in tools}

    if settings.environment == "PRODUCTION":
        # Should only have non-local multi-agent tools
        expected_tools = set(MULTI_AGENT_TOOLS) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS)
        assert tool_names == expected_tools, "Production multi-agent upsert should exclude local-only tools"
        assert "send_message_to_agent_async" not in tool_names, "Local-only async tool should not be upserted in production"
    else:
        # Should have all multi-agent tools
        assert tool_names == set(MULTI_AGENT_TOOLS), "Non-production multi-agent upsert should include all tools"
        assert "send_message_to_agent_async" in tool_names, "Local-only async tool should be upserted in non-production"


@pytest.mark.asyncio
async def test_create_agent_with_default_source(server: SyncServer, default_user, print_tool, default_block):
    """Test agent creation with include_default_source=True"""
    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    create_agent_request = CreateAgent(
        name="test_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        include_default_source=True,  # This is the key field we're testing
        include_base_tools=False,
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Verify agent was created
    assert created_agent is not None
    assert created_agent.name == "test_default_source_agent"

    # Verify that a default source was created and attached
    attached_sources = await server.agent_manager.list_attached_sources_async(agent_id=created_agent.id, actor=default_user)

    # Should have exactly one source (the default one)
    assert len(attached_sources) == 1
    auto_default_source = attached_sources[0]

    # Verify the default source properties
    assert created_agent.name in auto_default_source.name
    assert auto_default_source.embedding_config.embedding_endpoint_type == "openai"

    # Test with include_default_source=False
    create_agent_request_no_source = CreateAgent(
        name="test_no_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        include_default_source=False,  # Explicitly set to False
        include_base_tools=False,
    )

    created_agent_no_source = await server.agent_manager.create_agent_async(
        create_agent_request_no_source,
        actor=default_user,
    )

    # Verify no sources are attached
    attached_sources_no_source = await server.agent_manager.list_attached_sources_async(
        agent_id=created_agent_no_source.id, actor=default_user
    )

    assert len(attached_sources_no_source) == 0

    # Clean up
    await server.agent_manager.delete_agent_async(created_agent.id, default_user)
    await server.agent_manager.delete_agent_async(created_agent_no_source.id, default_user)


async def test_get_context_window_basic(
    server: SyncServer, comprehensive_test_agent_fixture, default_user, default_file, set_letta_environment
):
    # Test agent creation
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Attach a file
    assoc, closed_files = await server.file_agent_manager.attach_file(
        agent_id=created_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="hello",
        max_files_open=created_agent.max_files_open,
    )

    # Get context window and check for basic appearances
    context_window_overview = await server.agent_manager.get_context_window(agent_id=created_agent.id, actor=default_user)
    validate_context_window_overview(created_agent, context_window_overview, assoc)

    # Test deleting the agent
    await server.agent_manager.delete_agent_async(created_agent.id, default_user)
    list_agents = await server.agent_manager.list_agents_async(actor=default_user)
    assert len(list_agents) == 0


@pytest.mark.asyncio
async def test_create_agent_passed_in_initial_messages(server: SyncServer, default_user, default_block):
    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        initial_message_sequence=[MessageCreate(role=MessageRole.user, content="hello world")],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert await server.message_manager.size_async(agent_id=agent_state.id, actor=default_user) == 2
    init_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=default_user)

    # Check that the system appears in the first initial message
    assert create_agent_request.system in init_messages[0].content[0].text
    assert create_agent_request.memory_blocks[0].value in init_messages[0].content[0].text
    # Check that the second message is the passed in initial message seq
    assert create_agent_request.initial_message_sequence[0].role == init_messages[1].role
    assert create_agent_request.initial_message_sequence[0].content in init_messages[1].content[0].text


@pytest.mark.asyncio
async def test_create_agent_default_initial_message(server: SyncServer, default_user, default_block):
    memory_blocks = [CreateBlock(label="human", value="BananaBoy"), CreateBlock(label="persona", value="I am a helpful assistant")]
    create_agent_request = CreateAgent(
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert await server.message_manager.size_async(agent_id=agent_state.id, actor=default_user) == 4
    init_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=default_user)
    # Check that the system appears in the first initial message
    assert create_agent_request.system in init_messages[0].content[0].text
    assert create_agent_request.memory_blocks[0].value in init_messages[0].content[0].text


@pytest.mark.asyncio
async def test_create_agent_with_json_in_system_message(server: SyncServer, default_user, default_block):
    system_prompt = (
        "You are an expert teaching agent with encyclopedic knowledge. "
        "When you receive a topic, query the external database for more "
        "information. Format the queries as a JSON list of queries making "
        "sure to include your reasoning for that query, e.g. "
        "{'query1' : 'reason1', 'query2' : 'reason2'}"
    )
    create_agent_request = CreateAgent(
        system=system_prompt,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tags=["a", "b"],
        description="test_description",
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state is not None
    system_message_id = agent_state.message_ids[0]
    system_message = await server.message_manager.get_message_by_id_async(message_id=system_message_id, actor=default_user)
    assert system_prompt in system_message.content[0].text
    assert default_block.value in system_message.content[0].text
    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)


async def test_update_agent(server: SyncServer, comprehensive_test_agent_fixture, other_tool, other_source, other_block, default_user):
    agent, _ = comprehensive_test_agent_fixture
    update_agent_request = UpdateAgent(
        name="train_agent",
        description="train description",
        tool_ids=[other_tool.id],
        source_ids=[other_source.id],
        block_ids=[other_block.id],
        tool_rules=[InitToolRule(tool_name=other_tool.name)],
        tags=["c", "d"],
        system="train system",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(model_name="letta"),
        message_ids=["10", "20"],
        metadata={"train_key": "train_value"},
        tool_exec_environment_variables={"test_env_var_key_a": "a", "new_tool_exec_key": "n"},
        message_buffer_autoclear=False,
    )

    last_updated_timestamp = agent.updated_at
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_agent_request, actor=default_user)
    comprehensive_agent_checks(updated_agent, update_agent_request, actor=default_user)
    assert updated_agent.message_ids == update_agent_request.message_ids
    assert updated_agent.updated_at > last_updated_timestamp


@pytest.mark.asyncio
async def test_agent_file_defaults_based_on_context_window(server: SyncServer, default_user, default_block):
    """Test that file-related defaults are set based on the model's context window size"""

    # test with small context window model (8k)
    llm_config_small = LLMConfig.default_config("gpt-4o-mini")
    llm_config_small.context_window = 8000
    create_agent_request = CreateAgent(
        name="test_agent_small_context",
        llm_config=llm_config_small,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 3
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_small.context_window)[1]
    )
    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)

    # test with medium context window model (32k)
    llm_config_medium = LLMConfig.default_config("gpt-4o-mini")
    llm_config_medium.context_window = 32000
    create_agent_request = CreateAgent(
        name="test_agent_medium_context",
        llm_config=llm_config_medium,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 5
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_medium.context_window)[1]
    )
    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)

    # test with large context window model (128k)
    llm_config_large = LLMConfig.default_config("gpt-4o-mini")
    llm_config_large.context_window = 128000
    create_agent_request = CreateAgent(
        name="test_agent_large_context",
        llm_config=llm_config_large,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    assert agent_state.max_files_open == 10
    assert (
        agent_state.per_file_view_window_char_limit == calculate_file_defaults_based_on_context_window(llm_config_large.context_window)[1]
    )
    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)


@pytest.mark.asyncio
async def test_agent_file_defaults_explicit_values(server: SyncServer, default_user, default_block):
    """Test that explicitly set file-related values are respected"""

    llm_config_explicit = LLMConfig.default_config("gpt-4o-mini")
    llm_config_explicit.context_window = 32000  # would normally get defaults of 5 and 30k
    create_agent_request = CreateAgent(
        name="test_agent_explicit_values",
        llm_config=llm_config_explicit,
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        include_base_tools=False,
        max_files_open=20,  # explicit value
        per_file_view_window_char_limit=500_000,  # explicit value
    )
    agent_state = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )
    # verify explicit values are used instead of defaults
    assert agent_state.max_files_open == 20
    assert agent_state.per_file_view_window_char_limit == 500_000
    await server.agent_manager.delete_agent_async(agent_id=agent_state.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_agent_file_fields(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    """Test updating file-related fields on an existing agent"""

    agent, _ = comprehensive_test_agent_fixture

    # update file-related fields
    update_request = UpdateAgent(
        max_files_open=15,
        per_file_view_window_char_limit=150_000,
    )
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)

    assert updated_agent.max_files_open == 15
    assert updated_agent.per_file_view_window_char_limit == 150_000


# ======================================================================================================================
# AgentManager Tests - Listing
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_agents_select_fields_empty(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    # Create an agent using the comprehensive fixture.
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # List agents using an empty list for select_fields.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=[])
    # Assert that the agent is returned and basic fields are present.
    assert len(agents) >= 1
    agent = agents[0]
    assert agent.id is not None
    assert agent.name is not None

    # Assert no relationships were loaded
    assert len(agent.tools) == 0
    assert len(agent.tags) == 0


@pytest.mark.asyncio
async def test_list_agents_select_fields_none(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    # Create an agent using the comprehensive fixture.
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # List agents using an empty list for select_fields.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=None)
    # Assert that the agent is returned and basic fields are present.
    assert len(agents) >= 1
    agent = agents[0]
    assert agent.id is not None
    assert agent.name is not None

    # Assert no relationships were loaded
    assert len(agent.tools) > 0
    assert len(agent.tags) > 0


@pytest.mark.asyncio
async def test_list_agents_select_fields_specific(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Choose a subset of valid relationship fields.
    valid_fields = ["tools", "tags"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=valid_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Depending on your to_pydantic() implementation,
    # verify that the fields exist in the returned pydantic model.
    # (Note: These assertions may require that your CreateAgent fixture sets up these relationships.)
    assert agent.tools
    assert sorted(agent.tags) == ["a", "b"]
    assert not agent.memory.blocks


@pytest.mark.asyncio
async def test_list_agents_select_fields_invalid(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Provide field names that are not recognized.
    invalid_fields = ["foobar", "nonexistent_field"]
    # The expectation is that these fields are simply ignored.
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=invalid_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Verify that standard fields are still present.c
    assert agent.id is not None
    assert agent.name is not None


@pytest.mark.asyncio
async def test_list_agents_select_fields_duplicates(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Provide duplicate valid field names.
    duplicate_fields = ["tools", "tools", "tags", "tags"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=duplicate_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Verify that the agent pydantic representation includes the relationships.
    # Even if duplicates were provided, the query should not break.
    assert isinstance(agent.tools, list)
    assert isinstance(agent.tags, list)


@pytest.mark.asyncio
async def test_list_agents_select_fields_mixed(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    created_agent, create_agent_request = comprehensive_test_agent_fixture

    # Mix valid fields with an invalid one.
    mixed_fields = ["tools", "invalid_field"]
    agents = await server.agent_manager.list_agents_async(actor=default_user, include_relationships=mixed_fields)
    assert len(agents) >= 1
    agent = agents[0]
    # Valid fields should be loaded and accessible.
    assert agent.tools
    # Since "invalid_field" is not recognized, it should have no adverse effect.
    # You might optionally check that no extra attribute is created on the pydantic model.
    assert not hasattr(agent, "invalid_field")


@pytest.mark.asyncio
async def test_list_agents_ascending(server: SyncServer, default_user):
    # Create two agents with known names
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_oldest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_newest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agents = await server.agent_manager.list_agents_async(actor=default_user, ascending=True)
    names = [agent.name for agent in agents]
    assert names.index("agent_oldest") < names.index("agent_newest")


@pytest.mark.asyncio
async def test_list_agents_descending(server: SyncServer, default_user):
    # Create two agents with known names
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_oldest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_newest",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agents = await server.agent_manager.list_agents_async(actor=default_user, ascending=False)
    names = [agent.name for agent in agents]
    assert names.index("agent_newest") < names.index("agent_oldest")


@pytest.mark.asyncio
async def test_list_agents_ordering_and_pagination(server: SyncServer, default_user):
    names = ["alpha_agent", "beta_agent", "gamma_agent"]
    created_agents = []

    # Create agents in known order
    for name in names:
        agent = await server.agent_manager.create_agent_async(
            agent_create=CreateAgent(
                name=name,
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                include_base_tools=False,
            ),
            actor=default_user,
        )
        created_agents.append(agent)
        if USING_SQLITE:
            time.sleep(CREATE_DELAY_SQLITE)

    agent_ids = {agent.name: agent.id for agent in created_agents}

    # Ascending (oldest to newest)
    agents_asc = await server.agent_manager.list_agents_async(actor=default_user, ascending=True)
    asc_names = [agent.name for agent in agents_asc]
    assert asc_names.index("alpha_agent") < asc_names.index("beta_agent") < asc_names.index("gamma_agent")

    # Descending (newest to oldest)
    agents_desc = await server.agent_manager.list_agents_async(actor=default_user, ascending=False)
    desc_names = [agent.name for agent in agents_desc]
    assert desc_names.index("gamma_agent") < desc_names.index("beta_agent") < desc_names.index("alpha_agent")

    # After: Get agents after alpha_agent in ascending order (should exclude alpha)
    after_alpha = await server.agent_manager.list_agents_async(actor=default_user, after=agent_ids["alpha_agent"], ascending=True)
    after_names = [a.name for a in after_alpha]
    assert "alpha_agent" not in after_names
    assert "beta_agent" in after_names
    assert "gamma_agent" in after_names
    assert after_names == ["beta_agent", "gamma_agent"]

    # Before: Get agents before gamma_agent in ascending order (should exclude gamma)
    before_gamma = await server.agent_manager.list_agents_async(actor=default_user, before=agent_ids["gamma_agent"], ascending=True)
    before_names = [a.name for a in before_gamma]
    assert "gamma_agent" not in before_names
    assert "alpha_agent" in before_names
    assert "beta_agent" in before_names
    assert before_names == ["alpha_agent", "beta_agent"]

    # After: Get agents after gamma_agent in descending order (should exclude gamma, return beta then alpha)
    after_gamma_desc = await server.agent_manager.list_agents_async(actor=default_user, after=agent_ids["gamma_agent"], ascending=False)
    after_names_desc = [a.name for a in after_gamma_desc]
    assert after_names_desc == ["beta_agent", "alpha_agent"]

    # Before: Get agents before alpha_agent in descending order (should exclude alpha)
    before_alpha_desc = await server.agent_manager.list_agents_async(actor=default_user, before=agent_ids["alpha_agent"], ascending=False)
    before_names_desc = [a.name for a in before_alpha_desc]
    assert before_names_desc == ["gamma_agent", "beta_agent"]
