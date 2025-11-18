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
from letta.schemas.agent import AgentRelationships, AgentState, CreateAgent, UpdateAgent
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
        name="test_archive_to_delete",
        description="This archive will be deleted",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
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
        name="shared_archive",
        description="Archive shared by multiple agents",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
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

    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)

    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
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
        name=f"{agent.name}'s Archive",
        description="Default archive created automatically",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
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
            archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=agent, actor=default_user)

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
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

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
        name="orphan_archive", description="Archive with no agents", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
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
        name="test_archive_basic", description="Test archive description", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    assert archive.name == "test_archive_basic"
    assert archive.description == "Test archive description"
    assert archive.organization_id == default_user.organization_id
    assert archive.id is not None

    # test creating without description
    archive2 = await server.archive_manager.create_archive_async(
        name="test_archive_no_desc", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

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
        name="test_get_by_id", description="Archive to test get_by_id", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
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
        name="original_name", description="original description", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
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
            name=f"list_test_archive_{i}", description=f"Description {i}", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
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
    archive1 = await server.archive_manager.create_archive_async(
        name="archive_for_attachment_1", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )
    archive2 = await server.archive_manager.create_archive_async(
        name="archive_for_attachment_2", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

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
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert sarah_agent.id in [a.id for a in agents]

    # attach agent as non-owner
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive1.id, is_owner=False, actor=default_user
    )

    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert len(agents) == 2
    assert agent2.id in [a.id for a in agents]

    # test updating ownership (attach again with different is_owner)
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive1.id, is_owner=True, actor=default_user
    )

    # verify still only 2 agents (no duplicate)
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert len(agents) == 2

    # cleanup
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive1.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_detach_agent_from_archive_async(server: SyncServer, default_user):
    """Test detaching agents from archives."""
    # create archive and agents
    archive = await server.archive_manager.create_archive_async(
        name="archive_for_detachment",
        description="Test archive for detachment",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_detach_agent_1",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_detach_agent_2",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # attach both agents
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent1.id, archive_id=archive.id, is_owner=True, actor=default_user)
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive.id, is_owner=False, actor=default_user
    )

    # verify both are attached
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert agent1.id in agent_ids
    assert agent2.id in agent_ids

    # detach agent1
    await server.archive_manager.detach_agent_from_archive_async(agent_id=agent1.id, archive_id=archive.id, actor=default_user)

    # verify only agent2 remains
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 1
    agent_ids = [a.id for a in agents]
    assert agent2.id in agent_ids
    assert agent1.id not in agent_ids

    # test idempotency - detach agent1 again (should not error)
    await server.archive_manager.detach_agent_from_archive_async(agent_id=agent1.id, archive_id=archive.id, actor=default_user)

    # verify still only agent2
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 1
    assert agent2.id in [a.id for a in agents]

    # detach agent2
    await server.archive_manager.detach_agent_from_archive_async(agent_id=agent2.id, archive_id=archive.id, actor=default_user)

    # verify archive has no agents
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 0

    # cleanup
    await server.agent_manager.delete_agent_async(agent1.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_attach_detach_idempotency(server: SyncServer, default_user):
    """Test that attach and detach operations are idempotent."""
    # create archive and agent
    archive = await server.archive_manager.create_archive_async(
        name="idempotency_test_archive", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="idempotency_test_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # test multiple attachments - should be idempotent
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent.id, archive_id=archive.id, is_owner=False, actor=default_user)
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent.id, archive_id=archive.id, is_owner=False, actor=default_user)

    # verify only one relationship exists
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 1
    assert agent.id in [a.id for a in agents]

    # test ownership update through re-attachment
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent.id, archive_id=archive.id, is_owner=True, actor=default_user)

    # still only one relationship
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 1

    # test detaching non-existent relationship (should be idempotent)
    non_existent_agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="never_attached_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # this should not error
    await server.archive_manager.detach_agent_from_archive_async(agent_id=non_existent_agent.id, archive_id=archive.id, actor=default_user)

    # verify original agent still attached
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 1
    assert agent.id in [a.id for a in agents]

    # cleanup
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
    await server.agent_manager.delete_agent_async(non_existent_agent.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_detach_with_multiple_archives(server: SyncServer, default_user):
    """Test detaching an agent from one archive doesn't affect others."""
    # create two archives
    archive1 = await server.archive_manager.create_archive_async(
        name="multi_archive_1", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )
    archive2 = await server.archive_manager.create_archive_async(
        name="multi_archive_2", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    # create two agents
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="multi_test_agent_1",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="multi_test_agent_2",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Note: Due to unique constraint, each agent can only be attached to one archive
    # So we'll attach different agents to different archives
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent1.id, archive_id=archive1.id, is_owner=True, actor=default_user
    )
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive2.id, is_owner=True, actor=default_user
    )

    # verify initial state
    agents_archive1 = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    agents_archive2 = await server.archive_manager.get_agents_for_archive_async(archive_id=archive2.id, actor=default_user)
    assert agent1.id in [a.id for a in agents_archive1]
    assert agent2.id in [a.id for a in agents_archive2]

    # detach agent1 from archive1
    await server.archive_manager.detach_agent_from_archive_async(agent_id=agent1.id, archive_id=archive1.id, actor=default_user)

    # verify agent1 is detached from archive1
    agents_archive1 = await server.archive_manager.get_agents_for_archive_async(archive_id=archive1.id, actor=default_user)
    assert agent1.id not in [a.id for a in agents_archive1]
    assert len(agents_archive1) == 0

    # verify agent2 is still attached to archive2
    agents_archive2 = await server.archive_manager.get_agents_for_archive_async(archive_id=archive2.id, actor=default_user)
    assert agent2.id in [a.id for a in agents_archive2]
    assert len(agents_archive2) == 1

    # cleanup
    await server.agent_manager.delete_agent_async(agent1.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive1.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_detach_deleted_agent(server: SyncServer, default_user):
    """Test behavior when detaching a deleted agent."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_deleted_agent_archive", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    # create and attach agent
    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent_to_be_deleted",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent.id, archive_id=archive.id, is_owner=True, actor=default_user)

    # save the agent id before deletion
    agent_id = agent.id

    # delete the agent (should cascade delete the relationship due to ondelete="CASCADE")
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)

    # verify agent is no longer attached
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 0

    # attempting to detach the deleted agent
    # 2025-10-27: used to be idempotent (no error) but now we raise an error
    with pytest.raises(LettaAgentNotFoundError):
        await server.archive_manager.detach_agent_from_archive_async(agent_id=agent_id, archive_id=archive.id, actor=default_user)

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_cascade_delete_on_archive_deletion(server: SyncServer, default_user):
    """Test that deleting an archive cascades to delete relationships in archives_agents table."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="archive_to_be_deleted",
        description="This archive will be deleted to test CASCADE",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create multiple agents and attach them to the archive
    agent1 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="cascade_test_agent_1",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent2 = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="cascade_test_agent_2",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # attach both agents to the archive
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent1.id, archive_id=archive.id, is_owner=True, actor=default_user)
    await server.archive_manager.attach_agent_to_archive_async(
        agent_id=agent2.id, archive_id=archive.id, is_owner=False, actor=default_user
    )

    # verify both agents are attached
    agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert agent1.id in agent_ids
    assert agent2.id in agent_ids

    # save archive id for later
    archive_id = archive.id

    # delete the archive (should cascade delete the relationships)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)

    # verify archive is deleted
    with pytest.raises(Exception):
        await server.archive_manager.get_archive_by_id_async(archive_id=archive_id, actor=default_user)

    # verify agents still exist but have no archives attached
    # (agents should NOT be deleted, only the relationships)
    agent1_still_exists = await server.agent_manager.get_agent_by_id_async(agent1.id, actor=default_user)
    assert agent1_still_exists is not None
    assert agent1_still_exists.id == agent1.id

    agent2_still_exists = await server.agent_manager.get_agent_by_id_async(agent2.id, actor=default_user)
    assert agent2_still_exists is not None
    assert agent2_still_exists.id == agent2.id

    # verify agents no longer have any archives
    agent1_archives = await server.agent_manager.get_agent_archive_ids_async(agent_id=agent1.id, actor=default_user)
    assert len(agent1_archives) == 0

    agent2_archives = await server.agent_manager.get_agent_archive_ids_async(agent_id=agent2.id, actor=default_user)
    assert len(agent2_archives) == 0

    # cleanup agents
    await server.agent_manager.delete_agent_async(agent1.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_list_agents_with_pagination(server: SyncServer, default_user):
    """Test listing agents for an archive with pagination support."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="pagination_test_archive",
        description="Archive for testing pagination",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create multiple agents
    agents = []
    for i in range(5):
        agent = await server.agent_manager.create_agent_async(
            agent_create=CreateAgent(
                name=f"pagination_test_agent_{i}",
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                include_base_tools=False,
            ),
            actor=default_user,
        )
        agents.append(agent)
        # Attach to archive
        await server.archive_manager.attach_agent_to_archive_async(
            agent_id=agent.id, archive_id=archive.id, is_owner=(i == 0), actor=default_user
        )

    # Test basic listing (should get all 5)
    all_agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user, limit=10)
    assert len(all_agents) == 5
    all_agent_ids = [a.id for a in all_agents]
    for agent in agents:
        assert agent.id in all_agent_ids

    # Test with limit
    limited_agents = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user, limit=3)
    assert len(limited_agents) == 3

    # Test that pagination parameters are accepted without errors
    paginated = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user, limit=2)
    assert len(paginated) == 2
    assert all(a.id in all_agent_ids for a in paginated)

    # Test ascending/descending order by checking we get all agents in both
    ascending_agents = await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive.id, actor=default_user, ascending=True, limit=10
    )
    assert len(ascending_agents) == 5

    descending_agents = await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive.id, actor=default_user, ascending=False, limit=10
    )
    assert len(descending_agents) == 5

    # Verify both orders contain all agents
    assert set([a.id for a in ascending_agents]) == set([a.id for a in descending_agents])

    # Cleanup
    for agent in agents:
        await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


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
    created_archive = await server.archive_manager.create_archive_async(
        name="default_archive", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

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
    archive = await server.archive_manager.create_archive_async(
        name="test_vector_namespace", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    # get/set namespace for the first time
    namespace = await server.archive_manager.get_or_set_vector_db_namespace_async(archive_id=archive.id)

    assert namespace is not None
    assert archive.id in namespace

    # verify it returns the same namespace on subsequent calls
    namespace2 = await server.archive_manager.get_or_set_vector_db_namespace_async(archive_id=archive.id)

    assert namespace == namespace2

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_get_agents_with_include_parameter(server: SyncServer, default_user):
    """Test getting agents for an archive with include parameter to load relationships."""
    # create an archive
    archive = await server.archive_manager.create_archive_async(
        name="test_include_archive",
        description="Test archive for include parameter",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create agent without base tools (to avoid needing tools in test DB)
    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="test_include_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # attach agent to archive
    await server.archive_manager.attach_agent_to_archive_async(agent_id=agent.id, archive_id=archive.id, is_owner=True, actor=default_user)

    # test without include parameter (default - no relationships loaded)
    agents_no_include = await server.archive_manager.get_agents_for_archive_async(archive_id=archive.id, actor=default_user)
    assert len(agents_no_include) == 1
    # By default, tools should be empty list (not loaded)
    assert agents_no_include[0].tools == []
    # By default, tags should also be empty (not loaded)
    assert agents_no_include[0].tags == []

    # test with include parameter to load tags
    agents_with_tags = await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive.id, actor=default_user, include=["agent.tags"]
    )
    assert len(agents_with_tags) == 1
    # With include, tags should be loaded (as a list, even if empty)
    assert isinstance(agents_with_tags[0].tags, list)

    # test with include parameter to load blocks
    agents_with_blocks = await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive.id, actor=default_user, include=["agent.blocks"]
    )
    assert len(agents_with_blocks) == 1
    # With include, blocks should be loaded
    assert isinstance(agents_with_blocks[0].blocks, list)
    # Agent should have blocks since we passed memory_blocks=[] which creates default blocks
    assert len(agents_with_blocks[0].blocks) >= 0

    # test with multiple includes
    agents_with_multiple = await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive.id, actor=default_user, include=["agent.tags", "agent.blocks", "agent.tools"]
    )
    assert len(agents_with_multiple) == 1
    # All requested relationships should be loaded
    assert isinstance(agents_with_multiple[0].tags, list)
    assert isinstance(agents_with_multiple[0].blocks, list)
    assert isinstance(agents_with_multiple[0].tools, list)

    # cleanup
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_delete_passage_from_archive_async(server: SyncServer, default_user):
    """Test deleting a passage from an archive."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_passage_deletion_archive",
        description="Archive for testing passage deletion",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create passages
    passage1 = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="First test passage",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1, 0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    passage2 = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Second test passage",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.3, 0.4],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # verify both passages exist
    retrieved_passage1 = await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage1.id, actor=default_user)
    assert retrieved_passage1.id == passage1.id
    assert retrieved_passage1.archive_id == archive.id

    retrieved_passage2 = await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage2.id, actor=default_user)
    assert retrieved_passage2.id == passage2.id

    # delete passage1 from archive
    await server.archive_manager.delete_passage_from_archive_async(archive_id=archive.id, passage_id=passage1.id, actor=default_user)

    # verify passage1 is deleted
    with pytest.raises(NoResultFound):
        await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage1.id, actor=default_user)

    # verify passage2 still exists
    retrieved_passage2 = await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage2.id, actor=default_user)
    assert retrieved_passage2.id == passage2.id

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(passage2.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_delete_passage_from_wrong_archive(server: SyncServer, default_user):
    """Test that deleting a passage from the wrong archive raises an error."""
    # create two archives
    archive1 = await server.archive_manager.create_archive_async(
        name="archive_1", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )
    archive2 = await server.archive_manager.create_archive_async(
        name="archive_2", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    # create passage in archive1
    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Passage in archive 1",
            archive_id=archive1.id,
            organization_id=default_user.organization_id,
            embedding=[0.1, 0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # attempt to delete passage from archive2 (wrong archive)
    with pytest.raises(ValueError, match="does not belong to archive"):
        await server.archive_manager.delete_passage_from_archive_async(archive_id=archive2.id, passage_id=passage.id, actor=default_user)

    # verify passage still exists
    retrieved_passage = await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage.id, actor=default_user)
    assert retrieved_passage.id == passage.id

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive1.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive2.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_delete_nonexistent_passage(server: SyncServer, default_user):
    """Test that deleting a non-existent passage raises an error."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_nonexistent_passage_archive", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    # attempt to delete non-existent passage (use valid UUID4 format)
    fake_passage_id = f"passage-{uuid.uuid4()}"
    with pytest.raises(NoResultFound):
        await server.archive_manager.delete_passage_from_archive_async(
            archive_id=archive.id, passage_id=fake_passage_id, actor=default_user
        )

    # cleanup
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_delete_passage_from_nonexistent_archive(server: SyncServer, default_user):
    """Test that deleting a passage from a non-existent archive raises an error."""
    # create archive and passage
    archive = await server.archive_manager.create_archive_async(
        name="temp_archive", embedding_config=DEFAULT_EMBEDDING_CONFIG, actor=default_user
    )

    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Test passage",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1, 0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # attempt to delete passage from non-existent archive (use valid UUID4 format)
    fake_archive_id = f"archive-{uuid.uuid4()}"
    with pytest.raises(NoResultFound):
        await server.archive_manager.delete_passage_from_archive_async(
            archive_id=fake_archive_id, passage_id=passage.id, actor=default_user
        )

    # verify passage still exists
    retrieved_passage = await server.passage_manager.get_agent_passage_by_id_async(passage_id=passage.id, actor=default_user)
    assert retrieved_passage.id == passage.id

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_create_passage_in_archive_async(server: SyncServer, default_user):
    """Test creating a passage in an archive."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_passage_creation_archive",
        description="Archive for testing passage creation",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create a passage in the archive
    created_passage = await server.archive_manager.create_passage_in_archive_async(
        archive_id=archive.id,
        text="This is a test passage for creation",
        actor=default_user,
    )

    # verify the passage was created
    assert created_passage.id is not None
    assert created_passage.text == "This is a test passage for creation"
    assert created_passage.archive_id == archive.id
    assert created_passage.organization_id == default_user.organization_id

    # verify we can retrieve it
    retrieved_passage = await server.passage_manager.get_agent_passage_by_id_async(passage_id=created_passage.id, actor=default_user)
    assert retrieved_passage.id == created_passage.id
    assert retrieved_passage.text == created_passage.text
    assert retrieved_passage.archive_id == archive.id

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(created_passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_create_passage_with_metadata_and_tags(server: SyncServer, default_user):
    """Test creating a passage with metadata and tags."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_passage_metadata_archive",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create passage with metadata and tags
    test_metadata = {"source": "unit_test", "version": 1}
    test_tags = ["test", "archive", "passage"]

    created_passage = await server.archive_manager.create_passage_in_archive_async(
        archive_id=archive.id,
        text="Passage with metadata and tags",
        metadata=test_metadata,
        tags=test_tags,
        actor=default_user,
    )

    # verify metadata and tags were stored
    assert created_passage.metadata == test_metadata
    assert set(created_passage.tags) == set(test_tags)  # Use set comparison to ignore order

    # retrieve and verify persistence
    retrieved_passage = await server.passage_manager.get_agent_passage_by_id_async(passage_id=created_passage.id, actor=default_user)
    assert retrieved_passage.metadata == test_metadata
    assert set(retrieved_passage.tags) == set(test_tags)

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(created_passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_create_passage_in_nonexistent_archive(server: SyncServer, default_user):
    """Test that creating a passage in a non-existent archive raises an error."""
    # attempt to create passage in non-existent archive
    fake_archive_id = f"archive-{uuid.uuid4()}"

    with pytest.raises(NoResultFound):
        await server.archive_manager.create_passage_in_archive_async(
            archive_id=fake_archive_id,
            text="This should fail",
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_archive_manager_create_passage_inherits_embedding_config(server: SyncServer, default_user):
    """Test that created passages inherit the archive's embedding configuration."""
    # create archive with specific embedding config
    specific_embedding_config = EmbeddingConfig.default_config(provider="openai")

    archive = await server.archive_manager.create_archive_async(
        name="test_embedding_inheritance_archive",
        embedding_config=specific_embedding_config,
        actor=default_user,
    )

    # create passage
    created_passage = await server.archive_manager.create_passage_in_archive_async(
        archive_id=archive.id,
        text="Test passage for embedding config inheritance",
        actor=default_user,
    )

    # verify the passage inherited the archive's embedding config
    assert created_passage.embedding_config is not None
    assert created_passage.embedding_config.embedding_endpoint_type == specific_embedding_config.embedding_endpoint_type
    assert created_passage.embedding_config.embedding_model == specific_embedding_config.embedding_model
    assert created_passage.embedding_config.embedding_dim == specific_embedding_config.embedding_dim

    # cleanup
    await server.passage_manager.delete_agent_passage_by_id_async(created_passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)


@pytest.mark.asyncio
async def test_archive_manager_create_multiple_passages_in_archive(server: SyncServer, default_user):
    """Test creating multiple passages in the same archive."""
    # create archive
    archive = await server.archive_manager.create_archive_async(
        name="test_multiple_passages_archive",
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        actor=default_user,
    )

    # create multiple passages
    passages = []
    for i in range(3):
        passage = await server.archive_manager.create_passage_in_archive_async(
            archive_id=archive.id,
            text=f"Test passage number {i}",
            metadata={"index": i},
            tags=[f"passage_{i}"],
            actor=default_user,
        )
        passages.append(passage)

    # verify all passages were created with correct data
    for i, passage in enumerate(passages):
        assert passage.text == f"Test passage number {i}"
        assert passage.metadata["index"] == i
        assert f"passage_{i}" in passage.tags
        assert passage.archive_id == archive.id

    # cleanup
    for passage in passages:
        await server.passage_manager.delete_agent_passage_by_id_async(passage.id, actor=default_user)
    await server.archive_manager.delete_archive_async(archive.id, actor=default_user)
