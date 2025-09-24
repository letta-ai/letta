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
# User Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_users(server: SyncServer):
    # Create default organization
    org = await server.organization_manager.create_default_organization_async()

    user_name = "user"
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name, organization_id=org.id))

    users = await server.user_manager.list_actors_async()
    assert len(users) == 1
    assert users[0].name == user_name

    # Delete it after
    await server.user_manager.delete_actor_by_id_async(user.id)
    assert len(await server.user_manager.list_actors_async()) == 0


@pytest.mark.asyncio
async def test_create_default_user(server: SyncServer):
    org = await server.organization_manager.create_default_organization_async()
    await server.user_manager.create_default_actor_async(org_id=org.id)
    retrieved = await server.user_manager.get_default_actor_async()
    assert retrieved.name == server.user_manager.DEFAULT_USER_NAME


@pytest.mark.asyncio
async def test_update_user(server: SyncServer):
    # Create default organization
    default_org = await server.organization_manager.create_default_organization_async()
    test_org = await server.organization_manager.create_organization_async(PydanticOrganization(name="test_org"))

    user_name_a = "a"
    user_name_b = "b"

    # Assert it's been created
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name_a, organization_id=default_org.id))
    assert user.name == user_name_a

    # Adjust name
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, name=user_name_b))
    assert user.name == user_name_b
    assert user.organization_id == DEFAULT_ORG_ID

    # Adjust org id
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, organization_id=test_org.id))
    assert user.name == user_name_b
    assert user.organization_id == test_org.id


async def test_user_caching(server: SyncServer, default_user, performance_pct=0.4):
    if isinstance(await get_redis_client(), NoopAsyncRedisClient):
        pytest.skip("redis not available")
    # Invalidate previous cache behavior.
    await server.user_manager._invalidate_actor_cache(default_user.id)
    before_stats = server.user_manager.get_actor_by_id_async.cache_stats
    before_cache_misses = before_stats.misses
    before_cache_hits = before_stats.hits

    # First call (expected to miss the cache)
    async with AsyncTimer() as timer:
        actor = await server.user_manager.get_actor_by_id_async(default_user.id)
    duration_first = timer.elapsed_ns
    print(f"Call 1: {duration_first:.2e}ns")
    assert actor.id == default_user.id
    assert duration_first > 0  # Sanity check: took non-zero time
    cached_hits = 10
    durations = []
    for i in range(cached_hits):
        async with AsyncTimer() as timer:
            actor_cached = await server.user_manager.get_actor_by_id_async(default_user.id)
        duration = timer.elapsed_ns
        durations.append(duration)
        print(f"Call {i + 2}: {duration:.2e}ns")
        assert actor_cached == actor
    for d in durations:
        assert d < duration_first * performance_pct
    stats = server.user_manager.get_actor_by_id_async.cache_stats

    print(f"Before calls: {before_stats}")
    print(f"After calls: {stats}")
    # Assert cache stats
    assert stats.misses - before_cache_misses == 1
    assert stats.hits - before_cache_hits == cached_hits
