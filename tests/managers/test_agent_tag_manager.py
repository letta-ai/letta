import asyncio
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
# AgentManager Tests - Tags Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_agents_matching_all_tags(server: SyncServer, default_user, agent_with_tags):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "benefit_1"],
        match_some=[],
    )
    assert len(agents) == 2  # agent1 and agent3 match
    assert {a.name for a in agents} == {"agent1", "agent3"}


@pytest.mark.asyncio
async def test_list_agents_matching_some_tags(server: SyncServer, default_user, agent_with_tags):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent"],
        match_some=["benefit_1", "benefit_2"],
    )
    assert len(agents) == 3  # All agents match
    assert {a.name for a in agents} == {"agent1", "agent2", "agent3"}


@pytest.mark.asyncio
async def test_list_agents_matching_all_and_some_tags(server: SyncServer, default_user, agent_with_tags):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "benefit_1"],
        match_some=["benefit_2", "nonexistent"],
    )
    assert len(agents) == 1  # Only agent3 matches
    assert agents[0].name == "agent3"


@pytest.mark.asyncio
async def test_list_agents_matching_no_tags(server: SyncServer, default_user, agent_with_tags):
    agents = await server.agent_manager.list_agents_matching_tags_async(
        actor=default_user,
        match_all=["primary_agent", "nonexistent_tag"],
        match_some=["benefit_1", "benefit_2"],
    )
    assert len(agents) == 0  # No agent should match


@pytest.mark.asyncio
async def test_list_agents_by_tags_match_all(server: SyncServer, sarah_agent, charles_agent, default_user):
    """Test listing agents that have ALL specified tags."""
    # Create agents with multiple tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["test", "production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["test", "development", "gpt4"]), actor=default_user)

    # Search for agents with all specified tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["test", "gpt4"], match_all_tags=True)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert sarah_agent.id in agent_ids
    assert charles_agent.id in agent_ids

    # Search for tags that only sarah_agent has
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["test", "production"], match_all_tags=True)
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_match_any(server: SyncServer, sarah_agent, charles_agent, default_user):
    """Test listing agents that have ANY of the specified tags."""
    # Create agents with different tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["development", "gpt3"]), actor=default_user)

    # Search for agents with any of the specified tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["production", "development"], match_all_tags=False)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert sarah_agent.id in agent_ids
    assert charles_agent.id in agent_ids

    # Search for tags where only sarah_agent matches
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["production", "nonexistent"], match_all_tags=False)
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_no_matches(server: SyncServer, sarah_agent, charles_agent, default_user):
    """Test listing agents when no tags match."""
    # Create agents with tags
    await server.agent_manager.update_agent_async(sarah_agent.id, UpdateAgent(tags=["production", "gpt4"]), actor=default_user)
    await server.agent_manager.update_agent_async(charles_agent.id, UpdateAgent(tags=["development", "gpt3"]), actor=default_user)

    # Search for nonexistent tags
    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["nonexistent1", "nonexistent2"], match_all_tags=True)
    assert len(agents) == 0

    agents = await server.agent_manager.list_agents_async(actor=default_user, tags=["nonexistent1", "nonexistent2"], match_all_tags=False)
    assert len(agents) == 0


@pytest.mark.asyncio
async def test_list_agents_by_tags_with_other_filters(server: SyncServer, sarah_agent, charles_agent, default_user):
    """Test combining tag search with other filters."""
    # Create agents with specific names and tags
    await server.agent_manager.update_agent_async(
        sarah_agent.id, UpdateAgent(name="production_agent", tags=["production", "gpt4"]), actor=default_user
    )
    await server.agent_manager.update_agent_async(
        charles_agent.id, UpdateAgent(name="test_agent", tags=["production", "gpt3"]), actor=default_user
    )

    # List agents with specific tag and name pattern
    agents = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["production"], match_all_tags=True, name="production_agent"
    )
    assert len(agents) == 1
    assert agents[0].id == sarah_agent.id


@pytest.mark.asyncio
async def test_list_agents_by_tags_pagination(server: SyncServer, default_user, default_organization):
    """Test pagination when listing agents by tags."""
    # Create first agent
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent1",
            tags=["pagination_test", "tag1"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)  # Ensure distinct created_at timestamps

    # Create second agent
    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent2",
            tags=["pagination_test", "tag2"],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            memory_blocks=[],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Get first page
    first_page = await server.agent_manager.list_agents_async(actor=default_user, tags=["pagination_test"], match_all_tags=True, limit=1)
    assert len(first_page) == 1
    first_agent_id = first_page[0].id

    # Get second page using cursor
    second_page = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["pagination_test"], match_all_tags=True, after=first_agent_id, limit=1
    )
    assert len(second_page) == 1
    assert second_page[0].id != first_agent_id

    # Get previous page using before
    prev_page = await server.agent_manager.list_agents_async(
        actor=default_user, tags=["pagination_test"], match_all_tags=True, before=second_page[0].id, limit=1
    )
    assert len(prev_page) == 1
    assert prev_page[0].id == first_agent_id

    # Verify we got both agents with no duplicates
    all_ids = {first_page[0].id, second_page[0].id}
    assert len(all_ids) == 2
    assert agent1.id in all_ids
    assert agent2.id in all_ids


@pytest.mark.asyncio
async def test_list_agents_query_text_pagination(server: SyncServer, default_user, default_organization):
    """Test listing agents with query text filtering and pagination."""
    # Create test agents with specific names and descriptions
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Search Agent One",
            memory_blocks=[],
            description="This is a search agent for testing",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # at least 1 second to force unique timestamps in sqlite for deterministic pagination assertions
    await asyncio.sleep(1.1)

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Search Agent Two",
            memory_blocks=[],
            description="Another search agent for testing",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # at least 1 second to force unique timestamps in sqlite for deterministic pagination assertions
    await asyncio.sleep(1.1)

    agent3 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Different Agent",
            memory_blocks=[],
            description="This is a different agent",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Test query text filtering
    search_results = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent")
    assert len(search_results) == 2
    search_agent_ids = {agent.id for agent in search_results}
    assert agent1.id in search_agent_ids
    assert agent2.id in search_agent_ids
    assert agent3.id not in search_agent_ids

    different_results = await server.agent_manager.list_agents_async(actor=default_user, query_text="different agent")
    assert len(different_results) == 1
    assert different_results[0].id == agent3.id

    # Test pagination with query text
    first_page = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent", limit=1)
    assert len(first_page) == 1
    first_agent_id = first_page[0].id

    # Get second page using cursor
    second_page = await server.agent_manager.list_agents_async(actor=default_user, query_text="search agent", after=first_agent_id, limit=1)
    assert len(second_page) == 1
    assert second_page[0].id != first_agent_id

    # Test before and after
    all_agents = await server.agent_manager.list_agents_async(actor=default_user, query_text="agent")
    assert len(all_agents) == 3
    first_agent, second_agent, third_agent = all_agents
    middle_agent = await server.agent_manager.list_agents_async(
        actor=default_user, query_text="search agent", before=third_agent.id, after=first_agent.id
    )
    assert len(middle_agent) == 1
    assert middle_agent[0].id == second_agent.id

    # Verify we got both search agents with no duplicates
    all_ids = {first_page[0].id, second_page[0].id}
    assert len(all_ids) == 2
    assert all_ids == {agent1.id, agent2.id}


@pytest.mark.asyncio
async def test_list_tags(server: SyncServer, default_user, default_organization):
    """Test listing tags functionality."""
    # Create multiple agents with different tags
    agents = []
    tags = ["alpha", "beta", "gamma", "delta", "epsilon"]

    # Create agents with different combinations of tags
    for i in range(3):
        agent = await server.agent_manager.create_agent_async(
            actor=default_user,
            agent_create=CreateAgent(
                name="tag_agent_" + str(i),
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                tags=tags[i : i + 3],  # Each agent gets 3 consecutive tags
                include_base_tools=False,
            ),
        )
        agents.append(agent)

    # Test basic listing - should return all unique tags in alphabetical order
    all_tags = await server.agent_manager.list_tags_async(actor=default_user)
    assert all_tags == sorted(tags[:5])  # All tags should be present and sorted

    # Test pagination with limit
    limited_tags = await server.agent_manager.list_tags_async(actor=default_user, limit=2)
    assert limited_tags == tags[:2]  # Should return first 2 tags

    # Test pagination with cursor
    cursor_tags = await server.agent_manager.list_tags_async(actor=default_user, after="beta")
    assert cursor_tags == ["delta", "epsilon", "gamma"]  # Tags after "beta"

    # Test text search
    search_tags = await server.agent_manager.list_tags_async(actor=default_user, query_text="ta")
    assert search_tags == ["beta", "delta"]  # Only tags containing "ta"

    # Test with non-matching search
    no_match_tags = await server.agent_manager.list_tags_async(actor=default_user, query_text="xyz")
    assert no_match_tags == []  # Should return empty list

    # Test with different organization
    other_org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="Other Org"))
    other_user = await server.user_manager.create_actor_async(PydanticUser(name="Other User", organization_id=other_org.id))

    # Other org's tags should be empty
    other_org_tags = await server.agent_manager.list_tags_async(actor=other_user)
    assert other_org_tags == []

    # Cleanup
    for agent in agents:
        await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
