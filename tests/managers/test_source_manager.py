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
from letta.errors import LettaAgentNotFoundError, LettaInvalidArgumentError
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


# Helper function for file content tests
async def _count_file_content_rows(session, file_id: str) -> int:
    q = select(func.count()).select_from(FileContentModel).where(FileContentModel.file_id == file_id)
    result = await session.execute(q)
    return result.scalar_one()


# ======================================================================================================================
# AgentManager Tests - Sources Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_source(server: SyncServer, sarah_agent, default_source, default_user):
    """Test attaching a source to an agent."""
    # Attach the source
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify attachment through get_agent_by_id
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id in [s.id for s in agent.sources]

    # Verify that attaching the same source again doesn't cause issues
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len([s for s in agent.sources if s.id == default_source.id]) == 1


@pytest.mark.asyncio
async def test_list_attached_source_ids(server: SyncServer, sarah_agent, default_source, other_source, default_user):
    """Test listing source IDs attached to an agent."""
    # Initially should have no sources
    sources = await server.agent_manager.list_attached_sources_async(sarah_agent.id, actor=default_user)
    assert len(sources) == 0

    # Attach sources
    await server.agent_manager.attach_source_async(sarah_agent.id, default_source.id, actor=default_user)
    await server.agent_manager.attach_source_async(sarah_agent.id, other_source.id, actor=default_user)

    # List sources and verify
    sources = await server.agent_manager.list_attached_sources_async(sarah_agent.id, actor=default_user)
    assert len(sources) == 2
    source_ids = [s.id for s in sources]
    assert default_source.id in source_ids
    assert other_source.id in source_ids


@pytest.mark.asyncio
async def test_detach_source(server: SyncServer, sarah_agent, default_source, default_user):
    """Test detaching a source from an agent."""
    # Attach source
    await server.agent_manager.attach_source_async(sarah_agent.id, default_source.id, actor=default_user)

    # Verify it's attached
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id in [s.id for s in agent.sources]

    # Detach source
    await server.agent_manager.detach_source_async(sarah_agent.id, default_source.id, actor=default_user)

    # Verify it's detached
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert default_source.id not in [s.id for s in agent.sources]

    # Verify that detaching an already detached source doesn't cause issues
    await server.agent_manager.detach_source_async(sarah_agent.id, default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_source_nonexistent_agent(server: SyncServer, default_source, default_user):
    """Test attaching a source to a nonexistent agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_source_async(agent_id=f"agent-{uuid.uuid4()}", source_id=default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_source_nonexistent_source(server: SyncServer, sarah_agent, default_user):
    """Test attaching a nonexistent source to an agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=f"source-{uuid.uuid4()}", actor=default_user)


@pytest.mark.asyncio
async def test_detach_source_nonexistent_agent(server: SyncServer, default_source, default_user):
    """Test detaching a source from a nonexistent agent."""
    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.detach_source_async(agent_id=f"agent-{uuid.uuid4()}", source_id=default_source.id, actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_source_ids_nonexistent_agent(server: SyncServer, default_user):
    """Test listing sources for a nonexistent agent."""
    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.list_attached_sources_async(agent_id="nonexistent-agent-id", actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_agents(server: SyncServer, sarah_agent, charles_agent, default_source, default_user):
    """Test listing agents that have a particular source attached."""
    # Initially should have no attached agents
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 0

    # Attach source to first agent
    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify one agent is now attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 1
    assert sarah_agent.id in [a.id for a in attached_agents]

    # Attach source to second agent
    await server.agent_manager.attach_source_async(agent_id=charles_agent.id, source_id=default_source.id, actor=default_user)

    # Verify both agents are now attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 2
    attached_agent_ids = [a.id for a in attached_agents]
    assert sarah_agent.id in attached_agent_ids
    assert charles_agent.id in attached_agent_ids

    # Detach source from first agent
    await server.agent_manager.detach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    # Verify only second agent remains attached
    attached_agents = await server.source_manager.list_attached_agents(source_id=default_source.id, actor=default_user)
    assert len(attached_agents) == 1
    assert charles_agent.id in [a.id for a in attached_agents]


async def test_list_attached_agents_nonexistent_source(server: SyncServer, default_user):
    """Test listing agents for a nonexistent source."""
    with pytest.raises(LettaInvalidArgumentError):
        await server.source_manager.list_attached_agents(source_id="nonexistent-source-id", actor=default_user)


@pytest.mark.asyncio
async def test_get_agents_for_source_id_pagination(server: SyncServer, default_source, default_user):
    """Test pagination functionality of get_agents_for_source_id."""
    # Create multiple agents
    agents = []
    for i in range(5):
        agent = await server.agent_manager.create_agent_async(
            agent_create=CreateAgent(
                name=f"Test Agent {i}",
                memory_blocks=[],
                llm_config=LLMConfig.default_config("gpt-4o-mini"),
                embedding_config=EmbeddingConfig.default_config(provider="openai"),
                include_base_tools=False,
            ),
            actor=default_user,
        )
        agents.append(agent)
        # Add delay for SQLite to ensure distinct created_at timestamps
        if USING_SQLITE and i < 4:
            time.sleep(CREATE_DELAY_SQLITE)

    # Attach all agents to the source
    for agent in agents:
        await server.agent_manager.attach_source_async(agent_id=agent.id, source_id=default_source.id, actor=default_user)

    # Test 1: Get all agents (no pagination)
    all_agent_ids = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
    )
    assert len(all_agent_ids) == 5

    # Test 2: Pagination with limit
    first_page = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
        limit=2,
    )
    assert len(first_page) == 2

    # Test 3: Get next page using 'after' cursor
    second_page = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
        after=first_page[-1],
        limit=2,
    )
    assert len(second_page) == 2
    # Verify no overlap between pages
    assert first_page[-1] not in second_page
    assert first_page[0] not in second_page

    # Test 4: Get previous page using 'before' cursor
    prev_page = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
        before=second_page[0],
        limit=2,
    )
    assert len(prev_page) == 2
    # The previous page should contain agents from first_page
    assert any(agent_id in first_page for agent_id in prev_page)

    # Test 5: Ascending order (oldest first)
    ascending_ids = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
        ascending=True,
    )
    assert len(ascending_ids) == 5

    # Test 6: Descending order (newest first)
    descending_ids = await server.source_manager.get_agents_for_source_id(
        source_id=default_source.id,
        actor=default_user,
        ascending=False,
    )
    assert len(descending_ids) == 5
    # Descending should be reverse of ascending
    assert descending_ids == list(reversed(ascending_ids))

    # Test 7: Verify all agent IDs are correct
    created_agent_ids = {agent.id for agent in agents}
    assert set(all_agent_ids) == created_agent_ids


# ======================================================================================================================
# SourceManager Tests - Sources
# ======================================================================================================================


@pytest.mark.asyncio
async def test_get_existing_source_names(server: SyncServer, default_user):
    """Test the fast batch check for existing source names."""
    # Create some test sources
    source1 = PydanticSource(
        name="test_source_1",
        embedding_config=EmbeddingConfig(
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_model="text-embedding-ada-002",
            embedding_dim=1536,
            embedding_chunk_size=300,
        ),
    )
    source2 = PydanticSource(
        name="test_source_2",
        embedding_config=EmbeddingConfig(
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_model="text-embedding-ada-002",
            embedding_dim=1536,
            embedding_chunk_size=300,
        ),
    )

    # Create the sources
    created_source1 = await server.source_manager.create_source(source1, default_user)
    created_source2 = await server.source_manager.create_source(source2, default_user)

    # Test batch check - mix of existing and non-existing names
    names_to_check = ["test_source_1", "test_source_2", "non_existent_source", "another_non_existent"]
    existing_names = await server.source_manager.get_existing_source_names(names_to_check, default_user)

    # Verify results
    assert len(existing_names) == 2
    assert "test_source_1" in existing_names
    assert "test_source_2" in existing_names
    assert "non_existent_source" not in existing_names
    assert "another_non_existent" not in existing_names

    # Test with empty list
    empty_result = await server.source_manager.get_existing_source_names([], default_user)
    assert len(empty_result) == 0

    # Test with all non-existing names
    non_existing_result = await server.source_manager.get_existing_source_names(["fake1", "fake2"], default_user)
    assert len(non_existing_result) == 0

    # Cleanup
    await server.source_manager.delete_source(created_source1.id, default_user)
    await server.source_manager.delete_source(created_source2.id, default_user)


@pytest.mark.asyncio
async def test_create_source(server: SyncServer, default_user):
    """Test creating a new source."""
    source_pydantic = PydanticSource(
        name="Test Source",
        description="This is a test source.",
        metadata={"type": "test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Assertions to check the created source
    assert source.name == source_pydantic.name
    assert source.description == source_pydantic.description
    assert source.metadata == source_pydantic.metadata
    assert source.organization_id == default_user.organization_id


async def test_source_vector_db_provider_with_tpuf(server: SyncServer, default_user):
    """Test that vector_db_provider is correctly set based on should_use_tpuf."""
    from letta.settings import settings

    # save original values
    original_use_tpuf = settings.use_tpuf
    original_tpuf_api_key = settings.tpuf_api_key

    try:
        # test when should_use_tpuf returns True (expect TPUF provider)
        settings.use_tpuf = True
        settings.tpuf_api_key = "test_key"

        # need to mock it in source_manager since it's already imported
        with patch("letta.services.source_manager.should_use_tpuf", return_value=True):
            source_pydantic = PydanticSource(
                name="Test Source TPUF",
                description="Source with TPUF provider",
                metadata={"type": "test"},
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                vector_db_provider=VectorDBProvider.TPUF,  # explicitly set it
            )
            assert source_pydantic.vector_db_provider == VectorDBProvider.TPUF

            # create source and verify it's saved with TPUF provider
            source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)
            assert source.vector_db_provider == VectorDBProvider.TPUF

        # test when should_use_tpuf returns False (expect NATIVE provider)
        settings.use_tpuf = False
        settings.tpuf_api_key = None

        with patch("letta.services.source_manager.should_use_tpuf", return_value=False):
            source_pydantic = PydanticSource(
                name="Test Source Native",
                description="Source with Native provider",
                metadata={"type": "test"},
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                vector_db_provider=VectorDBProvider.NATIVE,  # explicitly set it
            )
            assert source_pydantic.vector_db_provider == VectorDBProvider.NATIVE

            # create source and verify it's saved with NATIVE provider
            source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)
            assert source.vector_db_provider == VectorDBProvider.NATIVE
    finally:
        # restore original values
        settings.use_tpuf = original_use_tpuf
        settings.tpuf_api_key = original_tpuf_api_key


async def test_create_sources_with_same_name_raises_error(server: SyncServer, default_user):
    """Test that creating sources with the same name raises an IntegrityError due to unique constraint."""
    name = "Test Source"
    source_pydantic = PydanticSource(
        name=name,
        description="This is a test source.",
        metadata={"type": "medical"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Attempting to create another source with the same name should raise an IntegrityError
    source_pydantic = PydanticSource(
        name=name,
        description="This is a different test source.",
        metadata={"type": "legal"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    with pytest.raises(UniqueConstraintViolationError):
        await server.source_manager.create_source(source=source_pydantic, actor=default_user)


async def test_update_source(server: SyncServer, default_user):
    """Test updating an existing source."""
    source_pydantic = PydanticSource(name="Original Source", description="Original description", embedding_config=DEFAULT_EMBEDDING_CONFIG)
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Update the source
    update_data = SourceUpdate(name="Updated Source", description="Updated description", metadata={"type": "updated"})
    updated_source = await server.source_manager.update_source(source_id=source.id, source_update=update_data, actor=default_user)

    # Assertions to verify update
    assert updated_source.name == update_data.name
    assert updated_source.description == update_data.description
    assert updated_source.metadata == update_data.metadata


async def test_delete_source(server: SyncServer, default_user):
    """Test deleting a source."""
    source_pydantic = PydanticSource(
        name="To Delete", description="This source will be deleted.", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Delete the source
    deleted_source = await server.source_manager.delete_source(source_id=source.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_source.id == source.id

    # Verify that the source no longer appears in list_sources
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 0


@pytest.mark.asyncio
async def test_delete_attached_source(server: SyncServer, sarah_agent, default_user):
    """Test deleting a source."""
    source_pydantic = PydanticSource(
        name="To Delete", description="This source will be deleted.", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=source.id, actor=default_user)

    # Delete the source
    deleted_source = await server.source_manager.delete_source(source_id=source.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_source.id == source.id

    # Verify that the source no longer appears in list_sources
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 0

    # Verify that agent is not deleted
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert agent is not None


async def test_list_sources(server: SyncServer, default_user):
    """Test listing sources with pagination."""
    # Create multiple sources
    await server.source_manager.create_source(
        PydanticSource(name="Source 1", embedding_config=DEFAULT_EMBEDDING_CONFIG), actor=default_user
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.source_manager.create_source(
        PydanticSource(name="Source 2", embedding_config=DEFAULT_EMBEDDING_CONFIG), actor=default_user
    )

    # List sources without pagination
    sources = await server.source_manager.list_sources(actor=default_user)
    assert len(sources) == 2

    # List sources with pagination
    paginated_sources = await server.source_manager.list_sources(actor=default_user, limit=1)
    assert len(paginated_sources) == 1

    # Ensure cursor-based pagination works
    next_page = await server.source_manager.list_sources(actor=default_user, after=paginated_sources[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].name != paginated_sources[0].name


async def test_get_source_by_id(server: SyncServer, default_user):
    """Test retrieving a source by ID."""
    source_pydantic = PydanticSource(
        name="Retrieve by ID", description="Test source for ID retrieval", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Retrieve the source by ID
    retrieved_source = await server.source_manager.get_source_by_id(source_id=source.id, actor=default_user)

    # Assertions to verify the retrieved source matches the created one
    assert retrieved_source.id == source.id
    assert retrieved_source.name == source.name
    assert retrieved_source.description == source.description


async def test_get_source_by_name(server: SyncServer, default_user):
    """Test retrieving a source by name."""
    source_pydantic = PydanticSource(
        name="Unique Source", description="Test source for name retrieval", embedding_config=DEFAULT_EMBEDDING_CONFIG
    )
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Retrieve the source by name
    retrieved_source = await server.source_manager.get_source_by_name(source_name=source.name, actor=default_user)

    # Assertions to verify the retrieved source matches the created one
    assert retrieved_source.name == source.name
    assert retrieved_source.description == source.description


async def test_update_source_no_changes(server: SyncServer, default_user):
    """Test update_source with no actual changes to verify logging and response."""
    source_pydantic = PydanticSource(name="No Change Source", description="No changes", embedding_config=DEFAULT_EMBEDDING_CONFIG)
    source = await server.source_manager.create_source(source=source_pydantic, actor=default_user)

    # Attempt to update the source with identical data
    update_data = SourceUpdate(name="No Change Source", description="No changes")
    updated_source = await server.source_manager.update_source(source_id=source.id, source_update=update_data, actor=default_user)

    # Assertions to ensure the update returned the source but made no modifications
    assert updated_source.id == source.id
    assert updated_source.name == source.name
    assert updated_source.description == source.description


async def test_bulk_upsert_sources_async(server: SyncServer, default_user):
    """Test bulk upserting sources."""
    sources_data = [
        PydanticSource(
            name="Bulk Source 1",
            description="First bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Bulk Source 2",
            description="Second bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Bulk Source 3",
            description="Third bulk source",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Bulk upsert sources
    created_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Verify all sources were created
    assert len(created_sources) == 3

    # Verify source details
    created_names = {source.name for source in created_sources}
    expected_names = {"Bulk Source 1", "Bulk Source 2", "Bulk Source 3"}
    assert created_names == expected_names

    # Verify organization assignment
    for source in created_sources:
        assert source.organization_id == default_user.organization_id


async def test_bulk_upsert_sources_name_conflict(server: SyncServer, default_user):
    """Test bulk upserting sources with name conflicts."""
    # Create an existing source
    existing_source = await server.source_manager.create_source(
        PydanticSource(
            name="Existing Source",
            description="Already exists",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )

    # Try to bulk upsert with the same name
    sources_data = [
        PydanticSource(
            name="Existing Source",  # Same name as existing
            description="Updated description",
            metadata={"updated": True},
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="New Bulk Source",
            description="Completely new",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Bulk upsert should update existing and create new
    result_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Should return 2 sources
    assert len(result_sources) == 2

    # Find the updated source
    updated_source = next(s for s in result_sources if s.name == "Existing Source")

    # Verify the existing source was updated, not replaced
    assert updated_source.id == existing_source.id  # ID should be preserved
    assert updated_source.description == "Updated description"
    assert updated_source.metadata == {"updated": True}

    # Verify new source was created
    new_source = next(s for s in result_sources if s.name == "New Bulk Source")
    assert new_source.description == "Completely new"


async def test_bulk_upsert_sources_mixed_create_update(server: SyncServer, default_user):
    """Test bulk upserting with a mix of creates and updates."""
    # Create some existing sources
    existing1 = await server.source_manager.create_source(
        PydanticSource(
            name="Mixed Source 1",
            description="Original 1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )
    existing2 = await server.source_manager.create_source(
        PydanticSource(
            name="Mixed Source 2",
            description="Original 2",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        default_user,
    )

    # Bulk upsert with updates and new sources
    sources_data = [
        PydanticSource(
            name="Mixed Source 1",  # Update existing
            description="Updated 1",
            instructions="New instructions 1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 3",  # Create new
            description="New 3",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 2",  # Update existing
            description="Updated 2",
            metadata={"version": 2},
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        PydanticSource(
            name="Mixed Source 4",  # Create new
            description="New 4",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
    ]

    # Perform bulk upsert
    result_sources = await server.source_manager.bulk_upsert_sources_async(sources_data, default_user)

    # Should return 4 sources
    assert len(result_sources) == 4

    # Verify updates preserved IDs
    source1 = next(s for s in result_sources if s.name == "Mixed Source 1")
    assert source1.id == existing1.id
    assert source1.description == "Updated 1"
    assert source1.instructions == "New instructions 1"

    source2 = next(s for s in result_sources if s.name == "Mixed Source 2")
    assert source2.id == existing2.id
    assert source2.description == "Updated 2"
    assert source2.metadata == {"version": 2}

    # Verify new sources were created
    source3 = next(s for s in result_sources if s.name == "Mixed Source 3")
    assert source3.description == "New 3"
    assert source3.id != existing1.id and source3.id != existing2.id

    source4 = next(s for s in result_sources if s.name == "Mixed Source 4")
    assert source4.description == "New 4"
    assert source4.id != existing1.id and source4.id != existing2.id


# ======================================================================================================================
# Source Manager Tests - Files
# ======================================================================================================================


async def test_get_file_by_id(server: SyncServer, default_user, default_source):
    """Test retrieving a file by ID."""
    file_metadata = PydanticFileMetadata(
        file_name="Retrieve File",
        file_path="/path/to/retrieve_file.txt",
        file_type="text/plain",
        file_size=2048,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Retrieve the file by ID
    retrieved_file = await server.file_manager.get_file_by_id(file_id=created_file.id, actor=default_user)

    # Assertions to verify the retrieved file matches the created one
    assert retrieved_file.id == created_file.id
    assert retrieved_file.file_name == created_file.file_name
    assert retrieved_file.file_path == created_file.file_path
    assert retrieved_file.file_type == created_file.file_type


async def test_create_and_retrieve_file_with_content(server, default_user, default_source, async_session):
    text_body = "Line 1\nLine 2\nLine 3"

    meta = PydanticFileMetadata(
        file_name="with_body.txt",
        file_path="/tmp/with_body.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )

    created = await server.file_manager.create_file(
        file_metadata=meta,
        actor=default_user,
        text=text_body,
    )

    # -- metadata-only return: content is NOT present
    assert created.content is None

    # body row exists
    assert await _count_file_content_rows(async_session, created.id) == 1

    # -- now fetch WITH the body
    loaded = await server.file_manager.get_file_by_id(created.id, actor=default_user, include_content=True)
    assert loaded.content == text_body


async def test_create_file_without_content(server, default_user, default_source, async_session):
    meta = PydanticFileMetadata(
        file_name="no_body.txt",
        file_path="/tmp/no_body.txt",
        file_type="text/plain",
        file_size=123,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # no content row
    assert await _count_file_content_rows(async_session, created.id) == 0

    # include_content=True still works, returns None
    loaded = await server.file_manager.get_file_by_id(created.id, actor=default_user, include_content=True)
    assert loaded.content is None


async def test_lazy_raise_guard(server, default_user, default_source, async_session):
    text_body = "lazy-raise"

    meta = PydanticFileMetadata(
        file_name="lazy_raise.txt",
        file_path="/tmp/lazy_raise.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user, text=text_body)

    # Grab ORM instance WITHOUT selectinload(FileMetadata.content)
    orm = await async_session.get(FileMetadataModel, created.id)

    # to_pydantic(include_content=True) should raise – guard works
    with pytest.raises(InvalidRequestError):
        await orm.to_pydantic_async(include_content=True)


async def test_list_files_content_none(server, default_user, default_source):
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert all(f.content is None for f in files)


async def test_delete_cascades_to_content(server, default_user, default_source, async_session):
    text_body = "to be deleted"
    meta = PydanticFileMetadata(
        file_name="delete_me.txt",
        file_path="/tmp/delete_me.txt",
        file_type="text/plain",
        file_size=len(text_body),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user, text=text_body)

    # ensure row exists first
    assert await _count_file_content_rows(async_session, created.id) == 1

    # delete
    await server.file_manager.delete_file(created.id, actor=default_user)

    # content row gone
    assert await _count_file_content_rows(async_session, created.id) == 0


async def test_get_file_by_original_name_and_source_found(server: SyncServer, default_user, default_source):
    """Test retrieving a file by original filename and source when it exists."""
    original_filename = "test_original_file.txt"
    file_metadata = PydanticFileMetadata(
        file_name="some_generated_name.txt",
        original_file_name=original_filename,
        file_path="/path/to/test_file.txt",
        file_type="text/plain",
        file_size=1024,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Retrieve the file by original name and source
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Assertions to verify the retrieved file matches the created one
    assert retrieved_file is not None
    assert retrieved_file.id == created_file.id
    assert retrieved_file.original_file_name == original_filename
    assert retrieved_file.source_id == default_source.id


async def test_get_file_by_original_name_and_source_not_found(server: SyncServer, default_user, default_source):
    """Test retrieving a file by original filename and source when it doesn't exist."""
    non_existent_filename = "does_not_exist.txt"

    # Try to retrieve a non-existent file
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=non_existent_filename, source_id=default_source.id, actor=default_user
    )

    # Should return None for non-existent file
    assert retrieved_file is None


async def test_get_file_by_original_name_and_source_different_sources(server: SyncServer, default_user, default_source):
    """Test that files with same original name in different sources are handled correctly."""
    from letta.schemas.source import Source as PydanticSource

    # Create a second source
    second_source_pydantic = PydanticSource(
        name="second_test_source",
        description="This is a test source.",
        metadata={"type": "test"},
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
    )
    second_source = await server.source_manager.create_source(source=second_source_pydantic, actor=default_user)

    original_filename = "shared_filename.txt"

    # Create file in first source
    file_metadata_1 = PydanticFileMetadata(
        file_name="file_in_source_1.txt",
        original_file_name=original_filename,
        file_path="/path/to/file1.txt",
        file_type="text/plain",
        file_size=1024,
        source_id=default_source.id,
    )
    created_file_1 = await server.file_manager.create_file(file_metadata=file_metadata_1, actor=default_user)

    # Create file with same original name in second source
    file_metadata_2 = PydanticFileMetadata(
        file_name="file_in_source_2.txt",
        original_file_name=original_filename,
        file_path="/path/to/file2.txt",
        file_type="text/plain",
        file_size=2048,
        source_id=second_source.id,
    )
    created_file_2 = await server.file_manager.create_file(file_metadata=file_metadata_2, actor=default_user)

    # Retrieve file from first source
    retrieved_file_1 = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Retrieve file from second source
    retrieved_file_2 = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=second_source.id, actor=default_user
    )

    # Should retrieve different files
    assert retrieved_file_1 is not None
    assert retrieved_file_2 is not None
    assert retrieved_file_1.id == created_file_1.id
    assert retrieved_file_2.id == created_file_2.id
    assert retrieved_file_1.id != retrieved_file_2.id
    assert retrieved_file_1.source_id == default_source.id
    assert retrieved_file_2.source_id == second_source.id


async def test_get_file_by_original_name_and_source_ignores_deleted(server: SyncServer, default_user, default_source):
    """Test that deleted files are ignored when searching by original name and source."""
    original_filename = "to_be_deleted.txt"
    file_metadata = PydanticFileMetadata(
        file_name="deletable_file.txt",
        original_file_name=original_filename,
        file_path="/path/to/deletable.txt",
        file_type="text/plain",
        file_size=512,
        source_id=default_source.id,
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Verify file can be found before deletion
    retrieved_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )
    assert retrieved_file is not None
    assert retrieved_file.id == created_file.id

    # Delete the file
    await server.file_manager.delete_file(created_file.id, actor=default_user)

    # Try to retrieve the deleted file
    retrieved_file_after_delete = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=default_source.id, actor=default_user
    )

    # Should return None for deleted file
    assert retrieved_file_after_delete is None


async def test_list_files(server: SyncServer, default_user, default_source):
    """Test listing files with pagination."""
    # Create multiple files
    await server.file_manager.create_file(
        PydanticFileMetadata(file_name="File 1", file_path="/path/to/file1.txt", file_type="text/plain", source_id=default_source.id),
        actor=default_user,
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.file_manager.create_file(
        PydanticFileMetadata(file_name="File 2", file_path="/path/to/file2.txt", file_type="text/plain", source_id=default_source.id),
        actor=default_user,
    )

    # List files without pagination
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert len(files) == 2

    # List files with pagination
    paginated_files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user, limit=1)
    assert len(paginated_files) == 1

    # Ensure cursor-based pagination works
    next_page = await server.file_manager.list_files(source_id=default_source.id, actor=default_user, after=paginated_files[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].file_name != paginated_files[0].file_name


async def test_delete_file(server: SyncServer, default_user, default_source):
    """Test deleting a file."""
    file_metadata = PydanticFileMetadata(
        file_name="Delete File", file_path="/path/to/delete_file.txt", file_type="text/plain", source_id=default_source.id
    )
    created_file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user)

    # Delete the file
    deleted_file = await server.file_manager.delete_file(file_id=created_file.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_file.id == created_file.id

    # Verify that the file no longer appears in list_files
    files = await server.file_manager.list_files(source_id=default_source.id, actor=default_user)
    assert len(files) == 0


async def test_update_file_status_basic(server, default_user, default_source):
    """Update processing status and error message for a file."""
    meta = PydanticFileMetadata(
        file_name="status_test.txt",
        file_path="/tmp/status_test.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Update status only
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING
    assert updated.error_message is None

    # Update both status and error message
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Parse failed",
    )
    assert updated.processing_status == FileProcessingStatus.ERROR
    assert updated.error_message == "Parse failed"


async def test_update_file_status_error_only(server, default_user, default_source):
    """Update just the error message, leave status unchanged."""
    meta = PydanticFileMetadata(
        file_name="error_only.txt",
        file_path="/tmp/error_only.txt",
        file_type="text/plain",
        file_size=123,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        error_message="Timeout while embedding",
    )
    assert updated.error_message == "Timeout while embedding"
    assert updated.processing_status == FileProcessingStatus.PENDING  # default from creation


async def test_update_file_status_with_chunks(server, default_user, default_source):
    """Update chunk progress fields along with status."""
    meta = PydanticFileMetadata(
        file_name="chunks_test.txt",
        file_path="/tmp/chunks_test.txt",
        file_type="text/plain",
        file_size=500,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # First transition: PENDING -> PARSING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # Next transition: PARSING -> EMBEDDING with chunk progress
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
        total_chunks=100,
        chunks_embedded=50,
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING
    assert updated.total_chunks == 100
    assert updated.chunks_embedded == 50

    # Update only chunk progress
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=100,
    )
    assert updated.chunks_embedded == 100
    assert updated.total_chunks == 100  # unchanged
    assert updated.processing_status == FileProcessingStatus.EMBEDDING  # unchanged


@pytest.mark.asyncio
async def test_file_status_valid_transitions(server, default_user, default_source):
    """Test valid state transitions follow the expected flow."""
    meta = PydanticFileMetadata(
        file_name="valid_transitions.txt",
        file_path="/tmp/valid_transitions.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)
    assert created.processing_status == FileProcessingStatus.PENDING

    # PENDING -> PARSING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # PARSING -> EMBEDDING
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING

    # EMBEDDING -> COMPLETED
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.COMPLETED,
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED


@pytest.mark.asyncio
async def test_file_status_invalid_transitions(server, default_user, default_source):
    """Test that invalid state transitions are blocked."""
    # Test PENDING -> COMPLETED (skipping PARSING and EMBEDDING)
    meta = PydanticFileMetadata(
        file_name="invalid_pending_to_completed.txt",
        file_path="/tmp/invalid1.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    with pytest.raises(ValueError, match="Invalid state transition.*pending.*COMPLETED"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.COMPLETED,
        )

    # Test PARSING -> COMPLETED (skipping EMBEDDING)
    meta2 = PydanticFileMetadata(
        file_name="invalid_parsing_to_completed.txt",
        file_path="/tmp/invalid2.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    with pytest.raises(ValueError, match="Invalid state transition.*parsing.*COMPLETED"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            processing_status=FileProcessingStatus.COMPLETED,
        )

    # Test PENDING -> EMBEDDING (skipping PARSING)
    meta3 = PydanticFileMetadata(
        file_name="invalid_pending_to_embedding.txt",
        file_path="/tmp/invalid3.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created3 = await server.file_manager.create_file(file_metadata=meta3, actor=default_user)

    with pytest.raises(ValueError, match="Invalid state transition.*pending.*EMBEDDING"):
        await server.file_manager.update_file_status(
            file_id=created3.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )


@pytest.mark.asyncio
async def test_file_status_terminal_states(server, default_user, default_source):
    """Test that terminal states (COMPLETED and ERROR) cannot be updated."""
    # Test COMPLETED is terminal
    meta = PydanticFileMetadata(
        file_name="completed_terminal.txt",
        file_path="/tmp/completed_terminal.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move through valid transitions to COMPLETED
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)

    # Cannot transition from COMPLETED to any state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )

    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.ERROR,
            error_message="Should not work",
        )

    # Test ERROR is terminal
    meta2 = PydanticFileMetadata(
        file_name="error_terminal.txt",
        file_path="/tmp/error_terminal.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)

    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Test error",
    )

    # Cannot transition from ERROR to any state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PARSING,
        )


@pytest.mark.asyncio
async def test_file_status_error_transitions(server, default_user, default_source):
    """Test that any non-terminal state can transition to ERROR."""
    # PENDING -> ERROR
    meta1 = PydanticFileMetadata(
        file_name="pending_to_error.txt",
        file_path="/tmp/pending_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created1 = await server.file_manager.create_file(file_metadata=meta1, actor=default_user)

    updated1 = await server.file_manager.update_file_status(
        file_id=created1.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at PENDING",
    )
    assert updated1.processing_status == FileProcessingStatus.ERROR
    assert updated1.error_message == "Failed at PENDING"

    # PARSING -> ERROR
    meta2 = PydanticFileMetadata(
        file_name="parsing_to_error.txt",
        file_path="/tmp/parsing_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    updated2 = await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at PARSING",
    )
    assert updated2.processing_status == FileProcessingStatus.ERROR
    assert updated2.error_message == "Failed at PARSING"

    # EMBEDDING -> ERROR
    meta3 = PydanticFileMetadata(
        file_name="embedding_to_error.txt",
        file_path="/tmp/embedding_error.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created3 = await server.file_manager.create_file(file_metadata=meta3, actor=default_user)
    await server.file_manager.update_file_status(file_id=created3.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created3.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)

    updated3 = await server.file_manager.update_file_status(
        file_id=created3.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Failed at EMBEDDING",
    )
    assert updated3.processing_status == FileProcessingStatus.ERROR
    assert updated3.error_message == "Failed at EMBEDDING"


@pytest.mark.asyncio
async def test_file_status_terminal_state_non_status_updates(server, default_user, default_source):
    """Test that terminal states block ALL updates, not just status changes."""
    # Create file and move to COMPLETED
    meta = PydanticFileMetadata(
        file_name="terminal_blocks_all.txt",
        file_path="/tmp/terminal_all.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)

    # Cannot update chunks_embedded in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            chunks_embedded=50,
        )

    # Cannot update total_chunks in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            total_chunks=100,
        )

    # Cannot update error_message in COMPLETED state
    with pytest.raises(ValueError, match="Cannot update.*terminal state completed"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            error_message="This should fail",
        )

    # Test same for ERROR state
    meta2 = PydanticFileMetadata(
        file_name="error_blocks_all.txt",
        file_path="/tmp/error_all.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created2 = await server.file_manager.create_file(file_metadata=meta2, actor=default_user)
    await server.file_manager.update_file_status(
        file_id=created2.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Initial error",
    )

    # Cannot update chunks_embedded in ERROR state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created2.id,
            actor=default_user,
            chunks_embedded=25,
        )


@pytest.mark.asyncio
async def test_file_status_race_condition_prevention(server, default_user, default_source):
    """Test that race conditions are prevented when multiple updates happen."""
    meta = PydanticFileMetadata(
        file_name="race_condition_test.txt",
        file_path="/tmp/race_test.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to PARSING
    await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )

    # Simulate race condition: Try to update from PARSING to PARSING again (stale read)
    # This should now be allowed (same-state transition) to prevent race conditions
    updated_again = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.PARSING,
    )
    assert updated_again.processing_status == FileProcessingStatus.PARSING

    # Move to ERROR
    await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.ERROR,
        error_message="Simulated error",
    )

    # Try to continue with EMBEDDING as if error didn't happen (race condition)
    # This should fail because file is in ERROR state
    with pytest.raises(ValueError, match="Cannot update.*terminal state error"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.EMBEDDING,
        )


@pytest.mark.asyncio
async def test_file_status_backwards_transitions(server, default_user, default_source):
    """Test that backwards transitions are not allowed."""
    meta = PydanticFileMetadata(
        file_name="backwards_transitions.txt",
        file_path="/tmp/backwards.txt",
        file_type="text/plain",
        file_size=100,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to EMBEDDING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)

    # Cannot go back to PARSING
    with pytest.raises(ValueError, match="Invalid state transition.*embedding.*PARSING"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PARSING,
        )

    # Cannot go back to PENDING
    with pytest.raises(ValueError, match="Cannot transition to PENDING state.*PENDING is only valid as initial state"):
        await server.file_manager.update_file_status(
            file_id=created.id,
            actor=default_user,
            processing_status=FileProcessingStatus.PENDING,
        )


@pytest.mark.asyncio
async def test_file_status_update_with_chunks_progress(server, default_user, default_source):
    """Test updating chunk progress during EMBEDDING state."""
    meta = PydanticFileMetadata(
        file_name="chunk_progress.txt",
        file_path="/tmp/chunks.txt",
        file_type="text/plain",
        file_size=1000,
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)

    # Move to EMBEDDING with initial chunk info
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.EMBEDDING,
        total_chunks=100,
        chunks_embedded=0,
    )
    assert updated.total_chunks == 100
    assert updated.chunks_embedded == 0

    # Update chunk progress without changing status
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=50,
    )
    assert updated.chunks_embedded == 50
    assert updated.processing_status == FileProcessingStatus.EMBEDDING

    # Update to completion
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        chunks_embedded=100,
    )
    assert updated.chunks_embedded == 100

    # Move to COMPLETED
    updated = await server.file_manager.update_file_status(
        file_id=created.id,
        actor=default_user,
        processing_status=FileProcessingStatus.COMPLETED,
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED
    assert updated.chunks_embedded == 100  # preserved


@pytest.mark.asyncio
async def test_same_state_transitions_allowed(server, default_user, default_source):
    """Test that same-state transitions are allowed to prevent race conditions."""
    # Create file
    created = await server.file_manager.create_file(
        FileMetadata(
            file_name="same_state_test.txt",
            source_id=default_source.id,
            processing_status=FileProcessingStatus.PENDING,
        ),
        default_user,
    )

    # Test PARSING -> PARSING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.PARSING
    )
    assert updated.processing_status == FileProcessingStatus.PARSING

    # Test EMBEDDING -> EMBEDDING
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.EMBEDDING, chunks_embedded=5
    )
    assert updated.processing_status == FileProcessingStatus.EMBEDDING
    assert updated.chunks_embedded == 5

    # Test COMPLETED -> COMPLETED
    await server.file_manager.update_file_status(file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED)
    updated = await server.file_manager.update_file_status(
        file_id=created.id, actor=default_user, processing_status=FileProcessingStatus.COMPLETED, total_chunks=10
    )
    assert updated.processing_status == FileProcessingStatus.COMPLETED
    assert updated.total_chunks == 10


async def test_upsert_file_content_basic(server: SyncServer, default_user, default_source, async_session):
    """Test creating and updating file content with upsert_file_content()."""
    initial_text = "Initial content"
    updated_text = "Updated content"

    # Step 1: Create file with no content
    meta = PydanticFileMetadata(
        file_name="upsert_body.txt",
        file_path="/tmp/upsert_body.txt",
        file_type="text/plain",
        file_size=len(initial_text),
        source_id=default_source.id,
    )
    created = await server.file_manager.create_file(file_metadata=meta, actor=default_user)
    assert created.content is None

    # Step 2: Insert new content
    file_with_content = await server.file_manager.upsert_file_content(
        file_id=created.id,
        text=initial_text,
        actor=default_user,
    )
    assert file_with_content.content == initial_text

    # Verify body row exists
    count = await _count_file_content_rows(async_session, created.id)
    assert count == 1

    # Step 3: Update existing content
    file_with_updated_content = await server.file_manager.upsert_file_content(
        file_id=created.id,
        text=updated_text,
        actor=default_user,
    )
    assert file_with_updated_content.content == updated_text

    # Ensure still only 1 row in content table
    count = await _count_file_content_rows(async_session, created.id)
    assert count == 1

    # Ensure `updated_at` is bumped
    orm_file = await async_session.get(FileMetadataModel, created.id)
    assert orm_file.updated_at >= orm_file.created_at


async def test_get_organization_sources_metadata(server, default_user):
    """Test getting organization sources metadata with aggregated file information."""
    # Create test sources
    source1 = await server.source_manager.create_source(
        source=PydanticSource(
            name="test_source_1",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    source2 = await server.source_manager.create_source(
        source=PydanticSource(
            name="test_source_2",
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Create test files for source1
    file1_meta = PydanticFileMetadata(
        source_id=source1.id,
        file_name="file1.txt",
        file_type="text/plain",
        file_size=1024,
    )
    file1 = await server.file_manager.create_file(file_metadata=file1_meta, actor=default_user)

    file2_meta = PydanticFileMetadata(
        source_id=source1.id,
        file_name="file2.txt",
        file_type="text/plain",
        file_size=2048,
    )
    file2 = await server.file_manager.create_file(file_metadata=file2_meta, actor=default_user)

    # Create test file for source2
    file3_meta = PydanticFileMetadata(
        source_id=source2.id,
        file_name="file3.txt",
        file_type="text/plain",
        file_size=512,
    )
    file3 = await server.file_manager.create_file(file_metadata=file3_meta, actor=default_user)

    # Test 1: Get organization metadata without detailed per-source metadata (default behavior)
    metadata_summary = await server.file_manager.get_organization_sources_metadata(
        actor=default_user, include_detailed_per_source_metadata=False
    )

    # Verify top-level aggregations are present
    assert metadata_summary.total_sources >= 2  # May have other sources from other tests
    assert metadata_summary.total_files >= 3
    assert metadata_summary.total_size >= 3584

    # Verify sources list is empty when include_detailed_per_source_metadata=False
    assert len(metadata_summary.sources) == 0

    # Test 2: Get organization metadata with detailed per-source metadata
    metadata_detailed = await server.file_manager.get_organization_sources_metadata(
        actor=default_user, include_detailed_per_source_metadata=True
    )

    # Verify top-level aggregations are the same
    assert metadata_detailed.total_sources == metadata_summary.total_sources
    assert metadata_detailed.total_files == metadata_summary.total_files
    assert metadata_detailed.total_size == metadata_summary.total_size

    # Find our test sources in the detailed results
    source1_meta = next((s for s in metadata_detailed.sources if s.source_id == source1.id), None)
    source2_meta = next((s for s in metadata_detailed.sources if s.source_id == source2.id), None)

    assert source1_meta is not None
    assert source1_meta.source_name == "test_source_1"
    assert source1_meta.file_count == 2
    assert source1_meta.total_size == 3072  # 1024 + 2048
    assert len(source1_meta.files) == 2

    # Verify file details in source1
    file1_stats = next((f for f in source1_meta.files if f.file_id == file1.id), None)
    file2_stats = next((f for f in source1_meta.files if f.file_id == file2.id), None)

    assert file1_stats is not None
    assert file1_stats.file_name == "file1.txt"
    assert file1_stats.file_size == 1024

    assert file2_stats is not None
    assert file2_stats.file_name == "file2.txt"
    assert file2_stats.file_size == 2048

    assert source2_meta is not None
    assert source2_meta.source_name == "test_source_2"
    assert source2_meta.file_count == 1
    assert source2_meta.total_size == 512
    assert len(source2_meta.files) == 1

    # Verify file details in source2
    file3_stats = source2_meta.files[0]
    assert file3_stats.file_id == file3.id
    assert file3_stats.file_name == "file3.txt"
    assert file3_stats.file_size == 512
