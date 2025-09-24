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
# Archive Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_archive_manager_delete_archive_async(server: SyncServer, default_user):
    """Test the delete_archive_async function."""
    archive = await server.archive_manager.create_archive_async(
        name="test_archive_to_delete", description="This archive will be deleted", actor=default_user
    )

    retrieved_archive = await server.archive_manager.get_archive_by_id_async(archive_id=archive.id, actor=default_user)
    assert retrieved_archive.id == archive.id

    await server.archive_manager.delete_archive_async(archive_id=archive.id, actor=default_user)

    with pytest.raises(Exception):
        await server.archive_manager.get_archive_by_id_async(archive_id=archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_agents_for_archive_async(server: SyncServer, default_user, sarah_agent):
    """Test getting all agents that have access to an archive."""
    archive = await server.archive_manager.create_archive_async(
        name="shared_archive", description="Archive shared by multiple agents", actor=default_user
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_agent_2",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=sarah_agent.id, archive_id=archive.id, is_owner=True, actor=default_user
    )

    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive.id, is_owner=False, actor=default_user
    )

    agent_ids = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)

    assert len(agent_ids) == 2
    assert sarah_agent.id in agent_ids
    assert agent2.id in agent_ids

    # Cleanup
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_race_condition_handling(server: SyncServer, default_user, sarah_agent):
    """Test that the race condition fix in get_or_create_default_archive_for_agent_async works."""
    from unittest.mock import patch

    from sqlalchemy.exc import IntegrityError

    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_agent_race_condition",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    created_archives = []
    original_create = server.archive_manager.create_archive_async

    async def track_create(*args, **kwargs):
        result = await original_create(*args, **kwargs)
        created_archives.append(result)
        return result

    # First, create an archive that will be attached by a "concurrent" request
    concurrent_archive = await server.archive_manager.create_archive_async(
        name=f"{agent.name}'s Archive", description="Default archive created automatically", actor=default_user
    )

    call_count = 0
    original_attach = server.archive_manager.attach_agent_to_archive_async

    async def failing_attach(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Simulate another request already attached the agent to an archive
            await original_attach(agent_id=agent.id, archive_id=concurrent_archive.id, is_owner=True, actor=default_user)
            # Now raise the IntegrityError as if our attempt failed
            raise IntegrityError("duplicate key value violates unique constraint", None, None)
        # This shouldn't be called since we already have an archive
        raise Exception("Should not reach here")

    with patch.object(server.archive_manager, "create_archive_async", side_effect=track_create):
        with patch.object(server.archive_manager, "attach_agent_to_archive_async", side_effect=failing_attach):
            archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
                agent_id=agent.id, agent_name=agent.name, actor=default_user
            )

    assert archive is not None
    assert archive.id == concurrent_archive.id  # Should return the existing archive
    assert archive.name == f"{agent.name}'s Archive"

    # One archive was created in our attempt (but then deleted)
    assert len(created_archives) == 1

    # Verify only one archive is attached to the agent
    archive_ids = await server.agent_manager.get_agent_archive_ids_async(agent_id=agent.id, actor=default_user)
    assert len(archive_ids) == 1
    assert archive_ids[0] == concurrent_archive.id

    # Cleanup
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
    await server.archive_manager.delete_archive_async(concurrent_archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_agent_from_passage_async(server: SyncServer, default_user, sarah_agent):
    """Test getting the agent ID that owns a passage through its archive."""
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
        agent_id=sarah_agent.id, agent_name=sarah_agent.name, actor=default_user
    )

    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Test passage for agent ownership",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    agent_id = await server.archive_manager.get_agent_from_passage_async(passage_id=passage.id, actor=default_user)

    assert agent_id == sarah_agent.id

    orphan_archive = await server.archive_manager.create_archive_async(
        name="orphan_archive", description="Archive with no agents", actor=default_user
    )

    orphan_passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Orphan passage",
            archive_id=orphan_archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    agent_id = await server.archive_manager.get_agent_from_passage_async(passage_id=orphan_passage.id, actor=default_user)
    assert agent_id is None

    # Cleanup
    await server.passage_manager.delete_passage_by_id_async(passage.id, actor=default_user)
    await server.passage_manager.delete_passage_by_id_async(orphan_passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(orphan_archive.id, actor=default_user)
