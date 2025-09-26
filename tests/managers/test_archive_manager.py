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


@pytest.mark.asyncio
async def test_archive_manager_create_archive_async(server: SyncServer, default_user):
    """Test creating a new archive with various parameters."""
    # test creating with name and description
    archive = await server.archive_manager.create_archive_async(
        name="test_archive_basic", description="Test archive description", actor=default_user
    )

    assert archive.name == "test_archive_basic"
    assert archive.description == "Test archive description"
    assert archive.organization_id == default_user.organization_id
    assert archive.id is not None

    # test creating without description
    archive2 = await server.archive_manager.create_archive_async(name="test_archive_no_desc", actor=default_user)

    assert archive2.name == "test_archive_no_desc"
    assert archive2.description is None
    assert archive2.organization_id == default_user.organization_id

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_archive_by_id_async(server: SyncServer, default_user):
    """Test retrieving an archive by its ID."""
    # create an archive
    archive = await server.archive_manager.create_archive_async(
        name="test_get_by_id", description="Archive to test get_by_id", actor=default_user
    )

    # retrieve the archive
    retrieved = await server.archive_manager.get_archive_by_id_async(archive_id=archive.id, actor=default_user)

    assert retrieved.id == archive.id
    assert retrieved.name == "test_get_by_id"
    assert retrieved.description == "Archive to test get_by_id"
    assert retrieved.organization_id == default_user.organization_id

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)

    # test getting non-existent archive should raise
    with pytest.raises(Exception):
        await server.archive_manager.get_archive_by_id_async(archive_id=str(uuid.uuid4()), actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_update_archive_async(server: SyncServer, default_user):
    """Test updating archive name and description."""
    # create an archive
    archive = await server.archive_manager.create_archive_async(
        name="original_name", description="original description", actor=default_user
    )

    # update name only
    updated = await server.archive_manager.update_archive_async(archive_id=archive.id, name="updated_name", actor=default_user)

    assert updated.id == archive.id
    assert updated.name == "updated_name"
    assert updated.description == "original description"

    # update description only
    updated = await server.archive_manager.update_archive_async(
        archive_id=archive.id, description="updated description", actor=default_user
    )

    assert updated.name == "updated_name"
    assert updated.description == "updated description"

    # update both
    updated = await server.archive_manager.update_archive_async(
        archive_id=archive.id, name="final_name", description="final description", actor=default_user
    )

    assert updated.name == "final_name"
    assert updated.description == "final description"

    # verify changes persisted
    retrieved = await server.archive_manager.get_archive_by_id_async(archive_id=archive.id, actor=default_user)

    assert retrieved.name == "final_name"
    assert retrieved.description == "final description"

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_list_archives_async(server: SyncServer, default_user, sarah_agent):
    """Test listing archives with various filters and pagination."""
    # create test archives
    archives = []
    for i in range(5):
        archive = await server.archive_manager.create_archive_async(
            name=f"list_test_archive_{i}", description=f"Description {i}", actor=default_user
        )
        archives.append(archive)

    # test basic listing
    result = await server.archive_manager.list_archives_async(actor=default_user, limit=10)
    assert len(result) >= 5

    # test with limit
    result = await server.archive_manager.list_archives_async(actor=default_user, limit=3)
    assert len(result) == 3

    # test filtering by name
    result = await server.archive_manager.list_archives_async(actor=default_user, name="list_test_archive_2")
    assert len(result) == 1
    assert result[0].name == "list_test_archive_2"

    # attach an archive to agent and test agent_id filter
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=sarah_agent.id, archive_id=archives[0].id, is_owner=True, actor=default_user
    )

    result = await server.archive_manager.list_archives_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(result) >= 1
    assert archives[0].id in [a.id for a in result]

    # test pagination with after
    all_archives = await server.archive_manager.list_archives_async(actor=default_user, limit=100)
    if len(all_archives) > 2:
        first_batch = await server.archive_manager.list_archives_async(actor=default_user, limit=2)
        second_batch = await server.archive_manager.list_archives_async(actor=default_user, after=first_batch[-1].id, limit=2)
        assert len(second_batch) <= 2
        assert first_batch[-1].id not in [a.id for a in second_batch]

    # cleanup
    for archive in archives:
        await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_attach_agent_to_archive_async(server: SyncServer, default_user, sarah_agent):
    """Test attaching agents to archives with ownership settings."""
    # create archives
    archive1 = await server.archive_manager.create_archive_async(name="archive_for_attachment_1", actor=default_user)
    archive2 = await server.archive_manager.create_archive_async(name="archive_for_attachment_2", actor=default_user)

    # create another agent
    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_attach_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # attach agent as owner
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=sarah_agent.id, archive_id=archive1.id, is_owner=True, actor=default_user
    )

    # verify attachment
    agent_ids = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert sarah_agent.id in agent_ids

    # attach agent as non-owner
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive1.id, is_owner=False, actor=default_user
    )

    agent_ids = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert len(agent_ids) == 2
    assert agent2.id in agent_ids

    # test updating ownership (attach again with different is_owner)
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive1.id, is_owner=True, actor=default_user
    )

    # verify still only 2 agents (no duplicate)
    agent_ids = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert len(agent_ids) == 2

    # cleanup
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive1.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_default_archive_for_agent_async(server: SyncServer, default_user):
    """Test getting default archive for an agent."""
    # create agent without archive
    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_default_archive_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # should return None when no archive exists
    archive = await server.archive_manager.get_default_archive_for_agent_async(agent_id=agent.id, actor=default_user)
    assert archive is None

    # create and attach an archive
    created_archive = await server.archive_manager.create_archive_async(name="default_archive", actor=default_user)

    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent.id, archive_id=created_archive.id, is_owner=True, actor=default_user
    )

    # should now return the archive
    archive = await server.archive_manager.get_default_archive_for_agent_async(agent_id=agent.id, actor=default_user)
    assert archive is not None
    assert archive.id == created_archive.id

    # cleanup
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
    await server.archive_manager.delete_archive_async(created_archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_or_set_vector_db_namespace_async(server: SyncServer, default_user):
    """Test getting or setting vector database namespace for an archive."""
    # create an archive
    archive = await server.archive_manager.create_archive_async(name="test_vector_namespace", actor=default_user)

    # get/set namespace for the first time
    namespace = await server.archive_manager.get_or_set_vector_db_namespace_async(archive_id=archive.id)

    assert namespace is not None
    assert archive.id in namespace

    # verify it returns the same namespace on subsequent calls
    namespace2 = await server.archive_manager.get_or_set_vector_db_namespace_async(archive_id=archive.id)

    assert namespace == namespace2

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)
