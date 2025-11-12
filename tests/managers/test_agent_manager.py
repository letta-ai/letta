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
from letta.schemas.agent import CreateAgent, InternalTemplateAgentCreate, UpdateAgent
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


@pytest.mark.asyncio
async def test_update_agent_last_stop_reason(server: SyncServer, comprehensive_test_agent_fixture, default_user):
    """Test updating last_stop_reason field on an existing agent"""

    agent, _ = comprehensive_test_agent_fixture

    assert agent.last_stop_reason is None

    # Update with end_turn stop reason
    update_request = UpdateAgent(
        last_stop_reason=StopReasonType.end_turn,
        last_run_completion=datetime.now(timezone.utc),
        last_run_duration_ms=1500,
    )
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)

    assert updated_agent.last_stop_reason == StopReasonType.end_turn
    assert updated_agent.last_run_completion is not None
    assert updated_agent.last_run_duration_ms == 1500

    # Update with error stop reason
    update_request = UpdateAgent(
        last_stop_reason=StopReasonType.error,
        last_run_completion=datetime.now(timezone.utc),
        last_run_duration_ms=2500,
    )
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)

    assert updated_agent.last_stop_reason == StopReasonType.error
    assert updated_agent.last_run_duration_ms == 2500

    # Update with requires_approval stop reason
    update_request = UpdateAgent(
        last_stop_reason=StopReasonType.requires_approval,
    )
    updated_agent = await server.agent_manager.update_agent_async(agent.id, update_request, actor=default_user)

    assert updated_agent.last_stop_reason == StopReasonType.requires_approval


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
async def test_list_agents_by_last_stop_reason(server: SyncServer, default_user):
    # Create agent with requires_approval stop reason
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_requires_approval",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )
    await server.agent_manager.update_agent_async(
        agent_id=agent1.id,
        agent_update=UpdateAgent(last_stop_reason=StopReasonType.requires_approval),
        actor=default_user,
    )

    # Create agent with error stop reason
    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_error",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )
    await server.agent_manager.update_agent_async(
        agent_id=agent2.id,
        agent_update=UpdateAgent(last_stop_reason=StopReasonType.error),
        actor=default_user,
    )

    # Create agent with no stop reason
    agent3 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_no_stop_reason",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Filter by requires_approval
    approval_agents = await server.agent_manager.list_agents_async(
        actor=default_user, last_stop_reason=StopReasonType.requires_approval.value
    )
    approval_names = {agent.name for agent in approval_agents}
    assert approval_names == {"agent_requires_approval"}

    # Filter by error
    error_agents = await server.agent_manager.list_agents_async(actor=default_user, last_stop_reason=StopReasonType.error.value)
    error_names = {agent.name for agent in error_agents}
    assert error_names == {"agent_error"}

    # No filter - should return all agents
    all_agents = await server.agent_manager.list_agents_async(actor=default_user)
    all_names = {agent.name for agent in all_agents}
    assert {"agent_requires_approval", "agent_error", "agent_no_stop_reason"}.issubset(all_names)


@pytest.mark.asyncio
async def test_count_agents_with_filters(server: SyncServer, default_user):
    """Test count_agents_async with various filters"""
    # Create agents with different attributes
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_requires_approval",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
            tags=["inbox", "test"],
        ),
        actor=default_user,
    )
    await server.agent_manager.update_agent_async(
        agent_id=agent1.id,
        agent_update=UpdateAgent(last_stop_reason=StopReasonType.requires_approval),
        actor=default_user,
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_error",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
            tags=["error", "test"],
        ),
        actor=default_user,
    )
    await server.agent_manager.update_agent_async(
        agent_id=agent2.id,
        agent_update=UpdateAgent(last_stop_reason=StopReasonType.error),
        actor=default_user,
    )

    agent3 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_completed",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
            tags=["completed"],
        ),
        actor=default_user,
    )
    await server.agent_manager.update_agent_async(
        agent_id=agent3.id,
        agent_update=UpdateAgent(last_stop_reason=StopReasonType.end_turn),
        actor=default_user,
    )

    agent4 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_no_stop_reason",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
            tags=["test"],
        ),
        actor=default_user,
    )

    # Test count with no filters - should return total count
    total_count = await server.agent_manager.count_agents_async(actor=default_user)
    assert total_count >= 4

    # Test count by last_stop_reason - requires_approval (inbox use case)
    approval_count = await server.agent_manager.count_agents_async(
        actor=default_user, last_stop_reason=StopReasonType.requires_approval.value
    )
    assert approval_count == 1

    # Test count by last_stop_reason - error
    error_count = await server.agent_manager.count_agents_async(actor=default_user, last_stop_reason=StopReasonType.error.value)
    assert error_count == 1

    # Test count by last_stop_reason - end_turn
    completed_count = await server.agent_manager.count_agents_async(actor=default_user, last_stop_reason=StopReasonType.end_turn.value)
    assert completed_count == 1

    # Test count by tags
    test_tag_count = await server.agent_manager.count_agents_async(actor=default_user, tags=["test"])
    assert test_tag_count == 3

    # Test count by tags with match_all_tags
    inbox_test_count = await server.agent_manager.count_agents_async(actor=default_user, tags=["inbox", "test"], match_all_tags=True)
    assert inbox_test_count == 1

    # Test count by name
    name_count = await server.agent_manager.count_agents_async(actor=default_user, name="agent_requires_approval")
    assert name_count == 1

    # Test count by query_text
    query_count = await server.agent_manager.count_agents_async(actor=default_user, query_text="error")
    assert query_count >= 1

    # Test combined filters: last_stop_reason + tags
    combined_count = await server.agent_manager.count_agents_async(
        actor=default_user, last_stop_reason=StopReasonType.requires_approval.value, tags=["inbox"]
    )
    assert combined_count == 1


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


# ======================================================================================================================
# AgentManager Tests - Environment Variable Encryption
# ======================================================================================================================


@pytest.fixture
def encryption_key():
    """Fixture to ensure encryption key is set for tests."""
    original_key = settings.encryption_key
    # Set a test encryption key if not already set
    if not settings.encryption_key:
        settings.encryption_key = "test-encryption-key-32-bytes!!"
    yield settings.encryption_key
    # Restore original
    settings.encryption_key = original_key


@pytest.mark.asyncio
async def test_agent_environment_variables_encrypt_on_create(server: SyncServer, default_user, encryption_key):
    """Test that creating an agent with secrets encrypts the values in the database."""
    from letta.orm.sandbox_config import AgentEnvironmentVariable as AgentEnvironmentVariableModel
    from letta.schemas.secret import Secret

    # Create agent with secrets
    agent_create = CreateAgent(
        name="test-agent-with-secrets",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        include_base_tools=False,
        secrets={
            "API_KEY": "sk-test-secret-12345",
            "DATABASE_URL": "postgres://user:pass@localhost/db",
        },
    )

    created_agent = await server.agent_manager.create_agent_async(agent_create, actor=default_user)

    # Verify agent has secrets
    assert created_agent.secrets is not None
    assert len(created_agent.secrets) == 2

    # Verify secrets are AgentEnvironmentVariable objects with Secret fields
    for secret_obj in created_agent.secrets:
        assert secret_obj.key in ["API_KEY", "DATABASE_URL"]
        assert secret_obj.value_enc is not None
        assert isinstance(secret_obj.value_enc, Secret)

    # Verify values are encrypted in the database
    async with db_registry.async_session() as session:
        env_vars = await session.execute(
            select(AgentEnvironmentVariableModel).where(AgentEnvironmentVariableModel.agent_id == created_agent.id)
        )
        env_var_list = list(env_vars.scalars().all())

        assert len(env_var_list) == 2
        for env_var in env_var_list:
            # Check that value_enc is not None and is encrypted
            assert env_var.value_enc is not None
            assert isinstance(env_var.value_enc, str)

            # Decrypt and verify
            decrypted = Secret.from_encrypted(env_var.value_enc).get_plaintext()
            if env_var.key == "API_KEY":
                assert decrypted == "sk-test-secret-12345"
            elif env_var.key == "DATABASE_URL":
                assert decrypted == "postgres://user:pass@localhost/db"


@pytest.mark.asyncio
async def test_agent_environment_variables_decrypt_on_read(server: SyncServer, default_user, encryption_key):
    """Test that reading an agent deserializes secrets correctly to AgentEnvironmentVariable objects."""
    from letta.schemas.environment_variables import AgentEnvironmentVariable
    from letta.schemas.secret import Secret

    # Create agent with secrets
    agent_create = CreateAgent(
        name="test-agent-read-secrets",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        include_base_tools=False,
        secrets={
            "TEST_KEY": "test-value-67890",
        },
    )

    created_agent = await server.agent_manager.create_agent_async(agent_create, actor=default_user)
    agent_id = created_agent.id

    # Read the agent back
    retrieved_agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=default_user)

    # Verify secrets are properly deserialized
    assert retrieved_agent.secrets is not None
    assert len(retrieved_agent.secrets) == 1

    secret_obj = retrieved_agent.secrets[0]
    assert isinstance(secret_obj, AgentEnvironmentVariable)
    assert secret_obj.key == "TEST_KEY"
    assert secret_obj.value == "test-value-67890"

    # Verify value_enc is a Secret object (not a string)
    assert secret_obj.value_enc is not None
    assert isinstance(secret_obj.value_enc, Secret)

    # Verify we can decrypt through the Secret object
    decrypted = secret_obj.value_enc.get_plaintext()
    assert decrypted == "test-value-67890"

    # Verify get_value_secret() method works
    value_secret = secret_obj.get_value_secret()
    assert isinstance(value_secret, Secret)
    assert value_secret.get_plaintext() == "test-value-67890"


@pytest.mark.asyncio
async def test_agent_environment_variables_update_encryption(server: SyncServer, default_user, encryption_key):
    """Test that updating agent secrets encrypts new values."""
    from letta.orm.sandbox_config import AgentEnvironmentVariable as AgentEnvironmentVariableModel
    from letta.schemas.secret import Secret

    # Create agent with initial secrets
    agent_create = CreateAgent(
        name="test-agent-update-secrets",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        include_base_tools=False,
        secrets={
            "INITIAL_KEY": "initial-value",
        },
    )

    created_agent = await server.agent_manager.create_agent_async(agent_create, actor=default_user)
    agent_id = created_agent.id

    # Update with new secrets
    agent_update = UpdateAgent(
        secrets={
            "UPDATED_KEY": "updated-value-abc",
            "NEW_KEY": "new-value-xyz",
        },
    )

    updated_agent = await server.agent_manager.update_agent_async(agent_id=agent_id, agent_update=agent_update, actor=default_user)

    # Verify updated secrets
    assert updated_agent.secrets is not None
    assert len(updated_agent.secrets) == 2

    # Verify in database
    async with db_registry.async_session() as session:
        env_vars = await session.execute(select(AgentEnvironmentVariableModel).where(AgentEnvironmentVariableModel.agent_id == agent_id))
        env_var_list = list(env_vars.scalars().all())

        assert len(env_var_list) == 2
        for env_var in env_var_list:
            assert env_var.value_enc is not None

            # Decrypt and verify
            decrypted = Secret.from_encrypted(env_var.value_enc).get_plaintext()
            if env_var.key == "UPDATED_KEY":
                assert decrypted == "updated-value-abc"
            elif env_var.key == "NEW_KEY":
                assert decrypted == "new-value-xyz"
            else:
                pytest.fail(f"Unexpected key: {env_var.key}")


@pytest.mark.asyncio
async def test_agent_state_schema_unchanged(server: SyncServer):
    """
    Test that the AgentState pydantic schema structure has not changed.
    This test validates all fields including nested pydantic objects to ensure
    the schema remains stable across changes.
    """
    from letta.schemas.agent import AgentState, AgentType
    from letta.schemas.block import Block
    from letta.schemas.embedding_config import EmbeddingConfig
    from letta.schemas.environment_variables import AgentEnvironmentVariable
    from letta.schemas.group import Group
    from letta.schemas.llm_config import LLMConfig
    from letta.schemas.memory import Memory
    from letta.schemas.model import ModelSettingsUnion
    from letta.schemas.response_format import ResponseFormatUnion
    from letta.schemas.source import Source
    from letta.schemas.tool import Tool
    from letta.schemas.tool_rule import ToolRule

    # Define the expected schema structure
    expected_schema = {
        # Core identification
        "id": str,
        "name": str,
        # Tool rules
        "tool_rules": (list, type(None)),
        # In-context memory
        "message_ids": (list, type(None)),
        # System prompt
        "system": str,
        # Agent configuration
        "agent_type": AgentType,
        # LLM information
        "llm_config": LLMConfig,
        "model": str,
        "embedding": str,
        "embedding_config": EmbeddingConfig,
        "model_settings": (ModelSettingsUnion, type(None)),
        "response_format": (ResponseFormatUnion, type(None)),
        # State fields
        "description": (str, type(None)),
        "metadata": (dict, type(None)),
        # Memory and tools
        "memory": Memory,  # deprecated
        "blocks": list,
        "tools": list,
        "sources": list,
        "tags": list,
        "tool_exec_environment_variables": list,  # deprecated
        "secrets": list,
        # Project and template fields
        "project_id": (str, type(None)),
        "template_id": (str, type(None)),
        "base_template_id": (str, type(None)),
        "deployment_id": (str, type(None)),
        "entity_id": (str, type(None)),
        "identity_ids": list,
        "identities": list,
        # Advanced configuration
        "message_buffer_autoclear": bool,
        "enable_sleeptime": (bool, type(None)),
        # Multi-agent
        "multi_agent_group": (Group, type(None)),  # deprecated
        "managed_group": (Group, type(None)),
        # Run metrics
        "last_run_completion": (datetime, type(None)),
        "last_run_duration_ms": (int, type(None)),
        "last_stop_reason": (StopReasonType, type(None)),
        # Timezone
        "timezone": (str, type(None)),
        # File controls
        "max_files_open": (int, type(None)),
        "per_file_view_window_char_limit": (int, type(None)),
        # Indexing controls
        "hidden": (bool, type(None)),
        # Metadata fields (from OrmMetadataBase)
        "created_by_id": (str, type(None)),
        "last_updated_by_id": (str, type(None)),
        "created_at": (datetime, type(None)),
        "updated_at": (datetime, type(None)),
    }

    # Get the actual schema fields from AgentState
    agent_state_fields = AgentState.model_fields
    actual_field_names = set(agent_state_fields.keys())
    expected_field_names = set(expected_schema.keys())

    # Check for added fields
    added_fields = actual_field_names - expected_field_names
    if added_fields:
        pytest.fail(
            f"New fields detected in AgentState schema: {sorted(added_fields)}. "
            "This test must be updated to include these fields, and the schema change must be intentional."
        )

    # Check for removed fields
    removed_fields = expected_field_names - actual_field_names
    if removed_fields:
        pytest.fail(
            f"Fields removed from AgentState schema: {sorted(removed_fields)}. "
            "This test must be updated to remove these fields, and the schema change must be intentional."
        )

    # Validate field types
    import typing

    for field_name, expected_type in expected_schema.items():
        field = agent_state_fields[field_name]
        annotation = field.annotation

        # Helper function to check if annotation matches expected type
        def check_type_match(annotation, expected):
            origin = typing.get_origin(annotation)
            args = typing.get_args(annotation)

            # Direct match
            if annotation == expected:
                return True

            # Handle list type (List[X] should match list)
            if expected is list and origin is list:
                return True

            # Handle dict type (Dict[X, Y] should match dict)
            if expected is dict and origin is dict:
                return True

            # Handle Optional types
            if origin is typing.Union:
                # Check if expected type is in the union
                if expected in args:
                    return True
                # Handle list case within Union (e.g., Union[List[X], None])
                if expected is list:
                    for arg in args:
                        if typing.get_origin(arg) is list:
                            return True
                # Handle dict case within Union
                if expected is dict:
                    for arg in args:
                        if typing.get_origin(arg) is dict:
                            return True
                # Handle Annotated types within Union (e.g., Union[Annotated[...], None])
                # This checks if any of the union args is an Annotated type that matches expected
                for arg in args:
                    if typing.get_origin(arg) is typing.Annotated:
                        # For Annotated types, compare the first argument (the actual type)
                        annotated_args = typing.get_args(arg)
                        if annotated_args and annotated_args[0] == expected:
                            return True

            return False

        # Handle tuple of expected types (Optional)
        if isinstance(expected_type, tuple):
            valid = any(check_type_match(annotation, exp_t) for exp_t in expected_type)
            if not valid:
                pytest.fail(
                    f"Field '{field_name}' type changed. Expected one of {expected_type}, "
                    f"but got {annotation}. Schema changes must be intentional."
                )
        else:
            # Single expected type
            valid = check_type_match(annotation, expected_type)
            if not valid:
                pytest.fail(
                    f"Field '{field_name}' type changed. Expected {expected_type}, "
                    f"but got {annotation}. Schema changes must be intentional."
                )

    # Validate nested object schemas
    # Memory schema
    memory_fields = Memory.model_fields
    expected_memory_fields = {"agent_type", "blocks", "file_blocks", "prompt_template"}
    actual_memory_fields = set(memory_fields.keys())
    if actual_memory_fields != expected_memory_fields:
        pytest.fail(
            f"Memory schema changed. Expected fields: {expected_memory_fields}, "
            f"Got: {actual_memory_fields}. Schema changes must be intentional."
        )

    # Block schema
    block_fields = Block.model_fields
    expected_block_fields = {
        "id",
        "value",
        "limit",
        "project_id",
        "template_name",
        "is_template",
        "template_id",
        "base_template_id",
        "deployment_id",
        "entity_id",
        "preserve_on_migration",
        "label",
        "read_only",
        "description",
        "metadata",
        "hidden",
        "created_by_id",
        "last_updated_by_id",
    }
    actual_block_fields = set(block_fields.keys())
    if actual_block_fields != expected_block_fields:
        pytest.fail(
            f"Block schema changed. Expected fields: {expected_block_fields}, "
            f"Got: {actual_block_fields}. Schema changes must be intentional."
        )

    # Tool schema
    tool_fields = Tool.model_fields
    expected_tool_fields = {
        "id",
        "tool_type",
        "description",
        "source_type",
        "name",
        "tags",
        "source_code",
        "json_schema",
        "args_json_schema",
        "return_char_limit",
        "pip_requirements",
        "npm_requirements",
        "default_requires_approval",
        "enable_parallel_execution",
        "created_by_id",
        "last_updated_by_id",
        "metadata_",
    }
    actual_tool_fields = set(tool_fields.keys())
    if actual_tool_fields != expected_tool_fields:
        pytest.fail(
            f"Tool schema changed. Expected fields: {expected_tool_fields}, Got: {actual_tool_fields}. Schema changes must be intentional."
        )

    # Source schema
    source_fields = Source.model_fields
    expected_source_fields = {
        "id",
        "name",
        "description",
        "instructions",
        "metadata",
        "embedding_config",
        "organization_id",
        "vector_db_provider",
        "created_by_id",
        "last_updated_by_id",
        "created_at",
        "updated_at",
    }
    actual_source_fields = set(source_fields.keys())
    if actual_source_fields != expected_source_fields:
        pytest.fail(
            f"Source schema changed. Expected fields: {expected_source_fields}, "
            f"Got: {actual_source_fields}. Schema changes must be intentional."
        )

    # LLMConfig schema
    llm_config_fields = LLMConfig.model_fields
    expected_llm_config_fields = {
        "model",
        "display_name",
        "model_endpoint_type",
        "model_endpoint",
        "provider_name",
        "provider_category",
        "model_wrapper",
        "context_window",
        "put_inner_thoughts_in_kwargs",
        "handle",
        "temperature",
        "max_tokens",
        "enable_reasoner",
        "reasoning_effort",
        "max_reasoning_tokens",
        "frequency_penalty",
        "compatibility_type",
        "verbosity",
        "tier",
        "parallel_tool_calls",
    }
    actual_llm_config_fields = set(llm_config_fields.keys())
    if actual_llm_config_fields != expected_llm_config_fields:
        pytest.fail(
            f"LLMConfig schema changed. Expected fields: {expected_llm_config_fields}, "
            f"Got: {actual_llm_config_fields}. Schema changes must be intentional."
        )

    # EmbeddingConfig schema
    embedding_config_fields = EmbeddingConfig.model_fields
    expected_embedding_config_fields = {
        "embedding_endpoint_type",
        "embedding_endpoint",
        "embedding_model",
        "embedding_dim",
        "embedding_chunk_size",
        "handle",
        "batch_size",
        "azure_endpoint",
        "azure_version",
        "azure_deployment",
    }
    actual_embedding_config_fields = set(embedding_config_fields.keys())
    if actual_embedding_config_fields != expected_embedding_config_fields:
        pytest.fail(
            f"EmbeddingConfig schema changed. Expected fields: {expected_embedding_config_fields}, "
            f"Got: {actual_embedding_config_fields}. Schema changes must be intentional."
        )

    # AgentEnvironmentVariable schema
    agent_env_var_fields = AgentEnvironmentVariable.model_fields
    expected_agent_env_var_fields = {
        "id",
        "key",
        "value",
        "description",
        "organization_id",
        "value_enc",
        "agent_id",
        # From OrmMetadataBase
        "created_by_id",
        "last_updated_by_id",
        "created_at",
        "updated_at",
    }
    actual_agent_env_var_fields = set(agent_env_var_fields.keys())
    if actual_agent_env_var_fields != expected_agent_env_var_fields:
        pytest.fail(
            f"AgentEnvironmentVariable schema changed. Expected fields: {expected_agent_env_var_fields}, "
            f"Got: {actual_agent_env_var_fields}. Schema changes must be intentional."
        )

    # Group schema
    group_fields = Group.model_fields
    expected_group_fields = {
        "id",
        "manager_type",
        "agent_ids",
        "description",
        "project_id",
        "template_id",
        "base_template_id",
        "deployment_id",
        "shared_block_ids",
        "manager_agent_id",
        "termination_token",
        "max_turns",
        "sleeptime_agent_frequency",
        "turns_counter",
        "last_processed_message_id",
        "max_message_buffer_length",
        "min_message_buffer_length",
        "hidden",
    }
    actual_group_fields = set(group_fields.keys())
    if actual_group_fields != expected_group_fields:
        pytest.fail(
            f"Group schema changed. Expected fields: {expected_group_fields}, "
            f"Got: {actual_group_fields}. Schema changes must be intentional."
        )


async def test_agent_state_relationship_loads(server: SyncServer, default_user, print_tool, default_block):
    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    create_agent_request = CreateAgent(
        name="test_default_source_agent",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        include_default_source=True,
        include_base_tools=False,
        tags=["test_tag"],
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Test legacy default include_relationships
    agent_state = await server.agent_manager.get_agent_by_id_async(
        agent_id=created_agent.id,
        actor=default_user,
    )
    assert agent_state.blocks
    assert agent_state.sources
    assert agent_state.tags
    assert agent_state.tools

    # Test include_relationships override
    agent_state = await server.agent_manager.get_agent_by_id_async(
        agent_id=created_agent.id,
        actor=default_user,
        include_relationships=[],
    )
    assert not agent_state.blocks
    assert not agent_state.sources
    assert not agent_state.tags
    assert not agent_state.tools

    # Test include_relationships override with specific relationships
    agent_state = await server.agent_manager.get_agent_by_id_async(
        agent_id=created_agent.id,
        actor=default_user,
        include_relationships=["memory", "sources"],
    )
    assert agent_state.blocks
    assert agent_state.sources
    assert not agent_state.tags
    assert not agent_state.tools

    # Test include override with specific relationships
    agent_state = await server.agent_manager.get_agent_by_id_async(
        agent_id=created_agent.id,
        actor=default_user,
        include_relationships=[],
        include=["agent.blocks", "agent.sources"],
    )
    assert agent_state.blocks
    assert agent_state.sources
    assert not agent_state.tags
    assert not agent_state.tools


async def test_create_template_agent_with_files_from_sources(server: SyncServer, default_user, print_tool, default_block):
    """Test that agents created from templates properly attach files from their sources"""
    from letta.schemas.file import FileMetadata as PydanticFileMetadata

    memory_blocks = [CreateBlock(label="human", value="TestUser"), CreateBlock(label="persona", value="I am a test assistant")]

    # Create a source with files
    source = await server.source_manager.create_source(
        source=PydanticSource(
            name="test_template_source",
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        ),
        actor=default_user,
    )

    # Create files in the source
    file1_metadata = PydanticFileMetadata(
        file_name="template_file_1.txt",
        organization_id=default_user.organization_id,
        source_id=source.id,
    )
    file1 = await server.file_manager.create_file(file_metadata=file1_metadata, actor=default_user, text="content for file 1")

    file2_metadata = PydanticFileMetadata(
        file_name="template_file_2.txt",
        organization_id=default_user.organization_id,
        source_id=source.id,
    )
    file2 = await server.file_manager.create_file(file_metadata=file2_metadata, actor=default_user, text="content for file 2")

    # Create agent using InternalTemplateAgentCreate with the source
    create_agent_request = InternalTemplateAgentCreate(
        name="test_template_agent_with_files",
        system="test system",
        memory_blocks=memory_blocks,
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        block_ids=[default_block.id],
        tool_ids=[print_tool.id],
        source_ids=[source.id],  # Attach the source with files
        include_base_tools=False,
        base_template_id="base_template_123",
        template_id="template_456",
        deployment_id="deployment_789",
        entity_id="entity_012",
    )

    # Create the agent
    created_agent = await server.agent_manager.create_agent_async(
        create_agent_request,
        actor=default_user,
    )

    # Verify agent was created
    assert created_agent is not None
    assert created_agent.name == "test_template_agent_with_files"

    # Verify that the source is attached
    attached_sources = await server.agent_manager.list_attached_sources_async(agent_id=created_agent.id, actor=default_user)
    assert len(attached_sources) == 1
    assert attached_sources[0].id == source.id

    # Verify that files from the source are attached to the agent
    attached_files = await server.file_agent_manager.list_files_for_agent(
        created_agent.id, per_file_view_window_char_limit=created_agent.per_file_view_window_char_limit, actor=default_user
    )

    # Should have both files attached
    assert len(attached_files) == 2
    attached_file_names = {f.file_name for f in attached_files}
    assert "template_file_1.txt" in attached_file_names
    assert "template_file_2.txt" in attached_file_names

    # Verify files are properly linked to the source
    for attached_file in attached_files:
        assert attached_file.source_id == source.id

    # Clean up
    await server.agent_manager.delete_agent_async(created_agent.id, default_user)
    await server.source_manager.delete_source(source.id, default_user)
