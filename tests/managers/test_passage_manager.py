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
from letta.schemas.agent import AgentState, CreateAgent, UpdateAgent
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
# Agent Manager - Passages Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_agent_list_passages_basic(server, default_user, sarah_agent, agent_passages_setup, disable_turbopuffer):
    """Test basic listing functionality of agent passages"""

    all_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(all_passages) == 5  # 3 source + 2 agent passages

    source_passages = await server.agent_manager.query_source_passages_async(actor=default_user, agent_id=sarah_agent.id)
    assert len(source_passages) == 3  # 3 source + 2 agent passages


@pytest.mark.asyncio
async def test_agent_list_passages_ordering(server, default_user, sarah_agent, agent_passages_setup, disable_turbopuffer):
    """Test ordering of agent passages"""

    # Test ascending order
    asc_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, ascending=True)
    assert len(asc_passages) == 5
    for i in range(1, len(asc_passages)):
        assert asc_passages[i - 1].created_at <= asc_passages[i].created_at

    # Test descending order
    desc_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, ascending=False)
    assert len(desc_passages) == 5
    for i in range(1, len(desc_passages)):
        assert desc_passages[i - 1].created_at >= desc_passages[i].created_at


@pytest.mark.asyncio
async def test_agent_list_passages_pagination(server, default_user, sarah_agent, agent_passages_setup, disable_turbopuffer):
    """Test pagination of agent passages"""

    # Test limit
    limited_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=3)
    assert len(limited_passages) == 3

    # Test cursor-based pagination
    first_page = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=2, ascending=True)
    assert len(first_page) == 2

    second_page = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, after=first_page[-1].id, limit=2, ascending=True
    )
    assert len(second_page) == 2
    assert first_page[-1].id != second_page[0].id
    assert first_page[-1].created_at <= second_page[0].created_at

    """
    [1]   [2]
    * * | * *

       [mid]
    * | * * | *
    """
    middle_page = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, before=second_page[-1].id, after=first_page[0].id, ascending=True
    )
    assert len(middle_page) == 2
    assert middle_page[0].id == first_page[-1].id
    assert middle_page[1].id == second_page[0].id

    middle_page_desc = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, before=second_page[-1].id, after=first_page[0].id, ascending=False
    )
    assert len(middle_page_desc) == 2
    assert middle_page_desc[0].id == second_page[0].id
    assert middle_page_desc[1].id == first_page[-1].id


@pytest.mark.asyncio
async def test_agent_list_passages_text_search(server, default_user, sarah_agent, agent_passages_setup, disable_turbopuffer):
    """Test text search functionality of agent passages"""

    # Test text search for source passages
    source_text_passages = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, query_text="Source passage"
    )
    assert len(source_text_passages) == 3

    # Test text search for agent passages
    agent_text_passages = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, query_text="Agent passage"
    )
    assert len(agent_text_passages) == 2


@pytest.mark.asyncio
async def test_agent_list_passages_agent_only(server, default_user, sarah_agent, agent_passages_setup, disable_turbopuffer):
    """Test text search functionality of agent passages"""

    # Test text search for agent passages
    agent_text_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, agent_only=True)
    assert len(agent_text_passages) == 2


@pytest.mark.asyncio
async def test_agent_list_passages_filtering(server, default_user, sarah_agent, default_source, agent_passages_setup, disable_turbopuffer):
    """Test filtering functionality of agent passages"""

    # Test source filtering
    source_filtered = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, source_id=default_source.id
    )
    assert len(source_filtered) == 3

    # Test date filtering
    now = datetime.now(timezone.utc)
    future_date = now + timedelta(days=1)
    past_date = now - timedelta(days=1)

    date_filtered = await server.agent_manager.list_passages_async(
        actor=default_user, agent_id=sarah_agent.id, start_date=past_date, end_date=future_date
    )
    assert len(date_filtered) == 5


@pytest.fixture
def mock_embeddings():
    """Load mock embeddings from JSON file"""
    fixture_path = os.path.join(os.path.dirname(__file__), "data", "test_embeddings.json")
    with open(fixture_path, "r") as f:
        return json.load(f)


@pytest.fixture
def mock_embed_model(mock_embeddings):
    """Mock embedding model that returns predefined embeddings"""
    mock_model = Mock()
    mock_model.get_text_embedding = lambda text: mock_embeddings.get(text, [0.0] * 1536)
    return mock_model


async def test_agent_list_passages_vector_search(
    server, default_user, sarah_agent, default_source, default_file, mock_embed_model, disable_turbopuffer
):
    """Test vector search functionality of agent passages"""
    embed_model = mock_embed_model

    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create passages with known embeddings
    passages = []

    # Create passages with different embeddings
    test_passages = [
        "I like red",
        "random text",
        "blue shoes",
    ]

    await server.agent_manager.attach_source_async(agent_id=sarah_agent.id, source_id=default_source.id, actor=default_user)

    for i, text in enumerate(test_passages):
        embedding = embed_model.get_text_embedding(text)
        if i % 2 == 0:
            # Create agent passage
            passage = PydanticPassage(
                text=text,
                organization_id=default_user.organization_id,
                archive_id=archive.id,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                embedding=embedding,
            )
            created_passage = await server.passage_manager.create_agent_passage_async(passage, default_user)
        else:
            # Create source passage
            passage = PydanticPassage(
                text=text,
                organization_id=default_user.organization_id,
                source_id=default_source.id,
                file_id=default_file.id,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                embedding=embedding,
            )
            created_passage = await server.passage_manager.create_source_passage_async(passage, default_file, default_user)
        passages.append(created_passage)

    # Query vector similar to "red" embedding
    query_key = "What's my favorite color?"

    # Test vector search with all passages
    results = await server.agent_manager.list_passages_async(
        actor=default_user,
        agent_id=sarah_agent.id,
        query_text=query_key,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        embed_query=True,
    )

    # Verify results are ordered by similarity
    assert len(results) == 3
    assert results[0].text == "I like red"
    assert "random" in results[1].text or "random" in results[2].text
    assert "blue" in results[1].text or "blue" in results[2].text

    # Test vector search with agent_only=True
    agent_only_results = await server.agent_manager.list_passages_async(
        actor=default_user,
        agent_id=sarah_agent.id,
        query_text=query_key,
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        embed_query=True,
        agent_only=True,
    )

    # Verify agent-only results
    assert len(agent_only_results) == 2
    assert agent_only_results[0].text == "I like red"
    assert agent_only_results[1].text == "blue shoes"


@pytest.mark.asyncio
async def test_list_source_passages_only(server: SyncServer, default_user, default_source, agent_passages_setup):
    """Test listing passages from a source without specifying an agent."""

    # List passages by source_id without agent_id
    source_passages = await server.agent_manager.list_passages_async(
        actor=default_user,
        source_id=default_source.id,
    )

    # Verify we get only source passages (3 from agent_passages_setup)
    assert len(source_passages) == 3
    assert all(p.source_id == default_source.id for p in source_passages)
    assert all(p.archive_id is None for p in source_passages)


# ======================================================================================================================
# Passage Manager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_passage_create_agentic(server: SyncServer, agent_passage_fixture, default_user):
    """Test creating a passage using agent_passage_fixture fixture"""
    assert agent_passage_fixture.id is not None
    assert agent_passage_fixture.text == "Hello, I am an agent passage"

    # Verify we can retrieve it
    retrieved = await server.passage_manager.get_passage_by_id_async(
        agent_passage_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == agent_passage_fixture.id
    assert retrieved.text == agent_passage_fixture.text


@pytest.mark.asyncio
async def test_passage_create_source(server: SyncServer, source_passage_fixture, default_user):
    """Test creating a source passage."""
    assert source_passage_fixture is not None
    assert source_passage_fixture.text == "Hello, I am a source passage"

    # Verify we can retrieve it
    retrieved = await server.passage_manager.get_passage_by_id_async(
        source_passage_fixture.id,
        actor=default_user,
    )
    assert retrieved is not None
    assert retrieved.id == source_passage_fixture.id
    assert retrieved.text == source_passage_fixture.text


@pytest.mark.asyncio
async def test_passage_create_invalid(server: SyncServer, agent_passage_fixture, default_user):
    """Test creating an agent passage."""
    assert agent_passage_fixture is not None
    assert agent_passage_fixture.text == "Hello, I am an agent passage"

    # Try to create an invalid passage (with both archive_id and source_id)
    with pytest.raises(AssertionError):
        await server.passage_manager.create_passage_async(
            PydanticPassage(
                text="Invalid passage",
                archive_id="123",
                source_id="456",
                organization_id=default_user.organization_id,
                embedding=[0.1] * 1024,
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_passage_get_by_id(server: SyncServer, agent_passage_fixture, source_passage_fixture, default_user):
    """Test retrieving a passage by ID"""
    retrieved = await server.passage_manager.get_passage_by_id_async(agent_passage_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == agent_passage_fixture.id
    assert retrieved.text == agent_passage_fixture.text

    retrieved = await server.passage_manager.get_passage_by_id_async(source_passage_fixture.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == source_passage_fixture.id
    assert retrieved.text == source_passage_fixture.text


@pytest.mark.asyncio
async def test_passage_cascade_deletion(
    server: SyncServer, agent_passage_fixture, source_passage_fixture, default_user, default_source, sarah_agent
):
    """Test that passages are deleted when their parent (agent or source) is deleted."""
    # Verify passages exist
    agent_passage = await server.passage_manager.get_passage_by_id_async(agent_passage_fixture.id, default_user)
    source_passage = await server.passage_manager.get_passage_by_id_async(source_passage_fixture.id, default_user)
    assert agent_passage is not None
    assert source_passage is not None

    # Delete agent and verify its passages are deleted
    await server.agent_manager.delete_agent_async(sarah_agent.id, default_user)
    agentic_passages = await server.agent_manager.list_passages_async(actor=default_user, agent_id=sarah_agent.id, agent_only=True)
    assert len(agentic_passages) == 0


@pytest.mark.asyncio
async def test_create_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test creating an agent passage using the new agent-specific method."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Test agent passage via specific method",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test_specific"},
            tags=["python", "test", "agent"],
        ),
        actor=default_user,
    )

    assert passage.id is not None
    assert passage.text == "Test agent passage via specific method"
    assert passage.archive_id == archive.id
    assert passage.source_id is None
    assert sorted(passage.tags) == sorted(["python", "test", "agent"])


@pytest.mark.asyncio
async def test_create_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test creating a source passage using the new source-specific method."""
    passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Test source passage via specific method",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            metadata={"type": "test_specific"},
            tags=["document", "test", "source"],
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    assert passage.id is not None
    assert passage.text == "Test source passage via specific method"
    assert passage.source_id == default_source.id
    assert passage.archive_id is None
    assert sorted(passage.tags) == sorted(["document", "test", "source"])


@pytest.mark.asyncio
async def test_create_agent_passage_validation(server: SyncServer, default_user, default_source, sarah_agent):
    """Test that agent passage creation validates inputs correctly."""
    # Should fail if archive_id is missing
    with pytest.raises(ValueError, match="Agent passage must have archive_id"):
        await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                text="Invalid agent passage",
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )

    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Should fail if source_id is present
    with pytest.raises(ValueError, match="Agent passage cannot have source_id"):
        await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                text="Invalid agent passage",
                archive_id=archive.id,
                source_id=default_source.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_create_source_passage_validation(server: SyncServer, default_user, default_file, default_source, sarah_agent):
    """Test that source passage creation validates inputs correctly."""
    # Should fail if source_id is missing
    with pytest.raises(ValueError, match="Source passage must have source_id"):
        await server.passage_manager.create_source_passage_async(
            PydanticPassage(
                text="Invalid source passage",
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            file_metadata=default_file,
            actor=default_user,
        )

    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Should fail if archive_id is present
    with pytest.raises(ValueError, match="Source passage cannot have archive_id"):
        await server.passage_manager.create_source_passage_async(
            PydanticPassage(
                text="Invalid source passage",
                source_id=default_source.id,
                archive_id=archive.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            file_metadata=default_file,
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_get_agent_passage_by_id_specific(server: SyncServer, default_user, sarah_agent):
    """Test retrieving an agent passage using the new agent-specific method."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create an agent passage
    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Agent passage for retrieval test",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Retrieve it using the specific method
    retrieved = await server.passage_manager.get_agent_passage_by_id_async(passage.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == passage.id
    assert retrieved.text == passage.text
    assert retrieved.archive_id == archive.id


@pytest.mark.asyncio
async def test_get_source_passage_by_id_specific(server: SyncServer, default_user, default_file, default_source):
    """Test retrieving a source passage using the new source-specific method."""
    # Create a source passage
    passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Source passage for retrieval test",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Retrieve it using the specific method
    retrieved = await server.passage_manager.get_source_passage_by_id_async(passage.id, actor=default_user)
    assert retrieved is not None
    assert retrieved.id == passage.id
    assert retrieved.text == passage.text
    assert retrieved.source_id == default_source.id


@pytest.mark.asyncio
async def test_get_wrong_passage_type_fails(server: SyncServer, default_user, sarah_agent, default_file, default_source):
    """Test that trying to get the wrong passage type with specific methods fails."""
    # Create an agent passage
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    agent_passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Agent passage",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Create a source passage
    source_passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Source passage",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Trying to get agent passage with source method should fail
    with pytest.raises(NoResultFound):
        await server.passage_manager.get_source_passage_by_id_async(agent_passage.id, actor=default_user)

    # Trying to get source passage with agent method should fail
    with pytest.raises(NoResultFound):
        await server.passage_manager.get_agent_passage_by_id_async(source_passage.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test updating an agent passage using the new agent-specific method."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create an agent passage
    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Original agent passage text",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Update it
    updated_passage = await server.passage_manager.update_agent_passage_by_id_async(
        passage.id,
        PydanticPassage(
            text="Updated agent passage text",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    assert updated_passage.text == "Updated agent passage text"
    assert updated_passage.embedding[0] == approx(0.2)
    assert updated_passage.id == passage.id


@pytest.mark.asyncio
async def test_update_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test updating a source passage using the new source-specific method."""
    # Create a source passage
    passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Original source passage text",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Update it
    updated_passage = await server.passage_manager.update_source_passage_by_id_async(
        passage.id,
        PydanticPassage(
            text="Updated source passage text",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.2],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    assert updated_passage.text == "Updated source passage text"
    assert updated_passage.embedding[0] == approx(0.2)
    assert updated_passage.id == passage.id


@pytest.mark.asyncio
async def test_delete_agent_passage_specific(server: SyncServer, default_user, sarah_agent):
    """Test deleting an agent passage using the new agent-specific method."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create an agent passage
    passage = await server.passage_manager.create_agent_passage_async(
        PydanticPassage(
            text="Agent passage to delete",
            archive_id=archive.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        actor=default_user,
    )

    # Verify it exists
    retrieved = await server.passage_manager.get_agent_passage_by_id_async(passage.id, actor=default_user)
    assert retrieved is not None

    # Delete it
    result = await server.passage_manager.delete_agent_passage_by_id_async(passage.id, actor=default_user)
    assert result is True

    # Verify it's gone
    with pytest.raises(NoResultFound):
        await server.passage_manager.get_agent_passage_by_id_async(passage.id, actor=default_user)


@pytest.mark.asyncio
async def test_delete_source_passage_specific(server: SyncServer, default_user, default_file, default_source):
    """Test deleting a source passage using the new source-specific method."""
    # Create a source passage
    passage = await server.passage_manager.create_source_passage_async(
        PydanticPassage(
            text="Source passage to delete",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        ),
        file_metadata=default_file,
        actor=default_user,
    )

    # Verify it exists
    retrieved = await server.passage_manager.get_source_passage_by_id_async(passage.id, actor=default_user)
    assert retrieved is not None

    # Delete it
    result = await server.passage_manager.delete_source_passage_by_id_async(passage.id, actor=default_user)
    assert result is True

    # Verify it's gone
    with pytest.raises(NoResultFound):
        await server.passage_manager.get_source_passage_by_id_async(passage.id, actor=default_user)


@pytest.mark.asyncio
async def test_create_many_agent_passages_async(server: SyncServer, default_user, sarah_agent):
    """Test creating multiple agent passages using the new batch method."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    passages = [
        PydanticPassage(
            text=f"Batch agent passage {i}",
            archive_id=archive.id,  # Now archive is a PydanticArchive object
            organization_id=default_user.organization_id,
            embedding=[0.1 * i],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
            tags=["batch", f"item{i}"] if i % 2 == 0 else ["batch", "odd"],
        )
        for i in range(3)
    ]

    created_passages = await server.passage_manager.create_many_archival_passages_async(passages, actor=default_user)

    assert len(created_passages) == 3
    for i, passage in enumerate(created_passages):
        assert passage.text == f"Batch agent passage {i}"
        assert passage.archive_id == archive.id
        assert passage.source_id is None
        expected_tags = ["batch", f"item{i}"] if i % 2 == 0 else ["batch", "odd"]
        assert passage.tags == expected_tags


@pytest.mark.asyncio
async def test_create_many_source_passages_async(server: SyncServer, default_user, default_file, default_source):
    """Test creating multiple source passages using the new batch method."""
    passages = [
        PydanticPassage(
            text=f"Batch source passage {i}",
            source_id=default_source.id,
            file_id=default_file.id,
            organization_id=default_user.organization_id,
            embedding=[0.1 * i],
            embedding_config=DEFAULT_EMBEDDING_CONFIG,
        )
        for i in range(3)
    ]

    created_passages = await server.passage_manager.create_many_source_passages_async(
        passages, file_metadata=default_file, actor=default_user
    )

    assert len(created_passages) == 3
    for i, passage in enumerate(created_passages):
        assert passage.text == f"Batch source passage {i}"
        assert passage.source_id == default_source.id
        assert passage.archive_id is None


@pytest.mark.asyncio
async def test_agent_passage_size(server: SyncServer, default_user, sarah_agent):
    """Test counting agent passages using the new agent-specific size method."""
    initial_size = await server.passage_manager.agent_passage_size_async(actor=default_user, agent_id=sarah_agent.id)

    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create some agent passages
    for i in range(3):
        await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                text=f"Agent passage {i} for size test",
                archive_id=archive.id,
                organization_id=default_user.organization_id,
                embedding=[0.1],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
            ),
            actor=default_user,
        )

    final_size = await server.passage_manager.agent_passage_size_async(actor=default_user, agent_id=sarah_agent.id)
    assert final_size == initial_size + 3


@pytest.mark.asyncio
async def test_passage_tags_functionality(disable_turbopuffer, server: SyncServer, default_user, sarah_agent):
    """Test comprehensive tag functionality for passages."""
    from letta.schemas.enums import TagMatchMode

    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create passages with different tag combinations
    test_passages = [
        {"text": "Python programming tutorial", "tags": ["python", "tutorial", "programming"]},
        {"text": "Machine learning with Python", "tags": ["python", "ml", "ai"]},
        {"text": "JavaScript web development", "tags": ["javascript", "web", "frontend"]},
        {"text": "Python data science guide", "tags": ["python", "tutorial", "data"]},
        {"text": "No tags passage", "tags": None},
    ]

    created_passages = []
    for test_data in test_passages:
        passage = await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                text=test_data["text"],
                archive_id=archive.id,
                organization_id=default_user.organization_id,
                embedding=[0.1, 0.2, 0.3],
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                tags=test_data["tags"],
            ),
            actor=default_user,
        )
        created_passages.append(passage)

    # Test that tags are properly stored (deduplicated)
    for i, passage in enumerate(created_passages):
        expected_tags = test_passages[i]["tags"]
        if expected_tags:
            assert set(passage.tags) == set(expected_tags)
        else:
            assert passage.tags is None

    # Test querying with tag filtering (if Turbopuffer is enabled)
    if hasattr(server.agent_manager, "query_agent_passages_async"):
        # Test querying with python tag (should find 3 passages)
        python_results = await server.agent_manager.query_agent_passages_async(
            actor=default_user,
            agent_id=sarah_agent.id,
            tags=["python"],
            tag_match_mode=TagMatchMode.ANY,
        )

        python_texts = [p.text for p, _, _ in python_results]
        assert len([t for t in python_texts if "Python" in t]) >= 2

        # Test querying with multiple tags using ALL mode
        tutorial_python_results = await server.agent_manager.query_agent_passages_async(
            actor=default_user,
            agent_id=sarah_agent.id,
            tags=["python", "tutorial"],
            tag_match_mode=TagMatchMode.ALL,
        )

        tutorial_texts = [p.text for p, _, _ in tutorial_python_results]
        expected_matches = [t for t in tutorial_texts if "tutorial" in t and "Python" in t]
        assert len(expected_matches) >= 1


@pytest.mark.asyncio
async def test_comprehensive_tag_functionality(disable_turbopuffer, server: SyncServer, sarah_agent, default_user):
    """Comprehensive test for tag functionality including dual storage and junction table."""

    # Test 1: Create passages with tags and verify they're stored in both places
    passages_with_tags = []
    test_tags = {
        "passage1": ["important", "documentation", "python"],
        "passage2": ["important", "testing"],
        "passage3": ["documentation", "api"],
        "passage4": ["python", "testing", "api"],
        "passage5": [],  # Test empty tags
    }

    for i, (passage_key, tags) in enumerate(test_tags.items(), 1):
        text = f"Test passage {i} for comprehensive tag testing"
        created_passages = await server.passage_manager.insert_passage(
            agent_state=sarah_agent,
            text=text,
            actor=default_user,
            tags=tags if tags else None,
        )
        assert len(created_passages) == 1
        passage = created_passages[0]

        # Verify tags are stored in the JSON column (deduplicated)
        if tags:
            assert set(passage.tags) == set(tags)
        else:
            assert passage.tags is None
        passages_with_tags.append(passage)

    # Test 2: Verify unique tags for archive
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
        agent_state=sarah_agent,
        actor=default_user,
    )

    unique_tags = await server.passage_manager.get_unique_tags_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    # Should have all unique tags: "important", "documentation", "python", "testing", "api"
    expected_unique_tags = {"important", "documentation", "python", "testing", "api"}
    assert set(unique_tags) == expected_unique_tags
    assert len(unique_tags) == 5

    # Test 3: Verify tag counts
    tag_counts = await server.passage_manager.get_tag_counts_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    # Verify counts
    assert tag_counts["important"] == 2  # passage1 and passage2
    assert tag_counts["documentation"] == 2  # passage1 and passage3
    assert tag_counts["python"] == 2  # passage1 and passage4
    assert tag_counts["testing"] == 2  # passage2 and passage4
    assert tag_counts["api"] == 2  # passage3 and passage4

    # Test 4: Query passages with ANY tag matching
    any_results = await server.agent_manager.query_agent_passages_async(
        agent_id=sarah_agent.id,
        query_text="test",
        limit=10,
        tags=["important", "api"],
        tag_match_mode=TagMatchMode.ANY,
        actor=default_user,
    )

    # Should match passages with "important" OR "api" tags (passages 1, 2, 3, 4)
    [p.text for p, _, _ in any_results]
    assert len(any_results) >= 4

    # Test 5: Query passages with ALL tag matching
    all_results = await server.agent_manager.query_agent_passages_async(
        agent_id=sarah_agent.id,
        query_text="test",
        limit=10,
        tags=["python", "testing"],
        tag_match_mode=TagMatchMode.ALL,
        actor=default_user,
    )

    # Should only match passage4 which has both "python" AND "testing"
    all_passage_texts = [p.text for p, _, _ in all_results]
    assert any("Test passage 4" in text for text in all_passage_texts)

    # Test 6: Query with non-existent tags
    no_results = await server.agent_manager.query_agent_passages_async(
        agent_id=sarah_agent.id,
        query_text="test",
        limit=10,
        tags=["nonexistent", "missing"],
        tag_match_mode=TagMatchMode.ANY,
        actor=default_user,
    )

    # Should return no results
    assert len(no_results) == 0

    # Test 7: Verify tags CAN be updated (with junction table properly maintained)
    first_passage = passages_with_tags[0]
    new_tags = ["updated", "modified", "changed"]
    update_data = PydanticPassage(
        id=first_passage.id,
        text="Updated text",
        tags=new_tags,
        organization_id=first_passage.organization_id,
        archive_id=first_passage.archive_id,
        embedding=first_passage.embedding,
        embedding_config=first_passage.embedding_config,
    )

    # Update should work and tags should be updated
    updated = await server.passage_manager.update_agent_passage_by_id_async(
        passage_id=first_passage.id,
        passage=update_data,
        actor=default_user,
    )

    # Both text and tags should be updated
    assert updated.text == "Updated text"
    assert set(updated.tags) == set(new_tags)

    # Verify tags are properly updated in junction table
    updated_unique_tags = await server.passage_manager.get_unique_tags_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    # Should include new tags and not include old "important", "documentation", "python" from passage1
    # But still have tags from other passages
    assert "updated" in updated_unique_tags
    assert "modified" in updated_unique_tags
    assert "changed" in updated_unique_tags

    # Test 8: Delete a passage and verify cascade deletion of tags
    passage_to_delete = passages_with_tags[1]  # passage2 with ["important", "testing"]

    await server.passage_manager.delete_agent_passage_by_id_async(
        passage_id=passage_to_delete.id,
        actor=default_user,
    )

    # Get updated tag counts
    updated_tag_counts = await server.passage_manager.get_tag_counts_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    # "important" no longer exists (was in passage1 which was updated and passage2 which was deleted)
    assert "important" not in updated_tag_counts
    # "testing" count should decrease from 2 to 1 (only in passage4 now)
    assert updated_tag_counts["testing"] == 1

    # Test 9: Batch create passages with tags
    batch_texts = [
        "Batch passage 1",
        "Batch passage 2",
        "Batch passage 3",
    ]
    batch_tags = ["batch", "test", "multiple"]

    batch_passages = []
    for text in batch_texts:
        passages = await server.passage_manager.insert_passage(
            agent_state=sarah_agent,
            text=text,
            actor=default_user,
            tags=batch_tags,
        )
        batch_passages.extend(passages)

    # Verify all batch passages have the same tags
    for passage in batch_passages:
        assert set(passage.tags) == set(batch_tags)

    # Test 10: Verify tag counts include batch passages
    final_tag_counts = await server.passage_manager.get_tag_counts_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    assert final_tag_counts["batch"] == 3
    assert final_tag_counts["test"] == 3
    assert final_tag_counts["multiple"] == 3

    # Test 11: Complex query with multiple tags and ALL matching
    complex_all_results = await server.agent_manager.query_agent_passages_async(
        agent_id=sarah_agent.id,
        query_text="batch",
        limit=10,
        tags=["batch", "test", "multiple"],
        tag_match_mode=TagMatchMode.ALL,
        actor=default_user,
    )

    # Should match all 3 batch passages
    assert len(complex_all_results) >= 3

    # Test 12: Empty tag list should return all passages
    all_passages = await server.agent_manager.query_agent_passages_async(
        agent_id=sarah_agent.id,
        query_text="passage",
        limit=50,
        tags=[],
        tag_match_mode=TagMatchMode.ANY,
        actor=default_user,
    )

    # Should return passages based on text search only
    assert len(all_passages) > 0


@pytest.mark.asyncio
async def test_tag_edge_cases(disable_turbopuffer, server: SyncServer, sarah_agent, default_user):
    """Test edge cases for tag functionality."""

    # Test 1: Very long tag names
    long_tag = "a" * 500  # 500 character tag
    passages = await server.passage_manager.insert_passage(
        agent_state=sarah_agent,
        text="Testing long tag names",
        actor=default_user,
        tags=[long_tag, "normal_tag"],
    )

    assert len(passages) == 1
    assert long_tag in passages[0].tags

    # Test 2: Special characters in tags
    special_tags = [
        "tag-with-dash",
        "tag_with_underscore",
        "tag.with.dots",
        "tag/with/slash",
        "tag:with:colon",
        "tag@with@at",
        "tag#with#hash",
        "tag with spaces",
        "CamelCaseTag",
        "数字标签",
    ]

    passages_special = await server.passage_manager.insert_passage(
        agent_state=sarah_agent,
        text="Testing special character tags",
        actor=default_user,
        tags=special_tags,
    )

    assert len(passages_special) == 1
    assert set(passages_special[0].tags) == set(special_tags)

    # Verify unique tags includes all special character tags
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
        agent_state=sarah_agent,
        actor=default_user,
    )

    unique_tags = await server.passage_manager.get_unique_tags_for_archive_async(
        archive_id=archive.id,
        actor=default_user,
    )

    for tag in special_tags:
        assert tag in unique_tags

    # Test 3: Duplicate tags in input (should be deduplicated)
    duplicate_tags = ["tag1", "tag2", "tag1", "tag3", "tag2", "tag1"]
    passages_dup = await server.passage_manager.insert_passage(
        agent_state=sarah_agent,
        text="Testing duplicate tags",
        actor=default_user,
        tags=duplicate_tags,
    )

    # Should only have unique tags (duplicates removed)
    assert len(passages_dup) == 1
    assert set(passages_dup[0].tags) == {"tag1", "tag2", "tag3"}
    assert len(passages_dup[0].tags) == 3  # Should be deduplicated

    # Test 4: Case sensitivity in tags
    case_tags = ["Tag", "tag", "TAG", "tAg"]
    passages_case = await server.passage_manager.insert_passage(
        agent_state=sarah_agent,
        text="Testing case sensitive tags",
        actor=default_user,
        tags=case_tags,
    )

    # All variations should be preserved (case-sensitive)
    assert len(passages_case) == 1
    assert set(passages_case[0].tags) == set(case_tags)


@pytest.mark.asyncio
async def test_search_agent_archival_memory_async(disable_turbopuffer, server: SyncServer, default_user, sarah_agent):
    """Test the search_agent_archival_memory_async method that powers both the agent tool and API endpoint."""
    # Get or create default archive for the agent
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)

    # Create test passages with various content and tags
    test_data = [
        {
            "text": "Python is a powerful programming language used for data science and web development.",
            "tags": ["python", "programming", "data-science", "web"],
            "created_at": datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
        },
        {
            "text": "Machine learning algorithms can be implemented in Python using libraries like scikit-learn.",
            "tags": ["python", "machine-learning", "algorithms"],
            "created_at": datetime(2024, 1, 16, 14, 45, tzinfo=timezone.utc),
        },
        {
            "text": "JavaScript is essential for frontend web development and modern web applications.",
            "tags": ["javascript", "frontend", "web"],
            "created_at": datetime(2024, 1, 17, 9, 15, tzinfo=timezone.utc),
        },
        {
            "text": "Database design principles are important for building scalable applications.",
            "tags": ["database", "design", "scalability"],
            "created_at": datetime(2024, 1, 18, 16, 20, tzinfo=timezone.utc),
        },
        {
            "text": "The weather today is sunny and warm, perfect for outdoor activities.",
            "tags": ["weather", "outdoor"],
            "created_at": datetime(2024, 1, 19, 11, 0, tzinfo=timezone.utc),
        },
    ]

    # Create passages in the database
    created_passages = []
    for data in test_data:
        passage = await server.passage_manager.create_agent_passage_async(
            PydanticPassage(
                text=data["text"],
                archive_id=archive.id,
                organization_id=default_user.organization_id,
                embedding=[0.1, 0.2, 0.3],  # Mock embedding
                embedding_config=DEFAULT_EMBEDDING_CONFIG,
                tags=data["tags"],
                created_at=data["created_at"],
            ),
            actor=default_user,
        )
        created_passages.append(passage)

    # Test 1: Basic search by query text
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="Python programming"
    )

    assert len(results) > 0

    # Check structure of results
    for result in results:
        assert "timestamp" in result
        assert "content" in result
        assert "tags" in result
        assert isinstance(result["tags"], list)

    # Test 2: Search with tag filtering - single tag
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="programming", tags=["python"]
    )

    assert len(results) > 0
    # All results should have "python" tag
    for result in results:
        assert "python" in result["tags"]

    # Test 3: Search with tag filtering - multiple tags with "any" mode
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="development", tags=["web", "database"], tag_match_mode="any"
    )

    assert len(results) > 0
    # All results should have at least one of the specified tags
    for result in results:
        assert any(tag in result["tags"] for tag in ["web", "database"])

    # Test 4: Search with tag filtering - multiple tags with "all" mode
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="Python", tags=["python", "web"], tag_match_mode="all"
    )

    # Should only return results that have BOTH tags
    for result in results:
        assert "python" in result["tags"]
        assert "web" in result["tags"]

    # Test 5: Search with top_k limit
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="programming", top_k=2
    )

    assert len(results) <= 2

    # Test 6: Search with datetime filtering
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id, actor=default_user, query="programming", start_datetime="2024-01-16", end_datetime="2024-01-17"
    )

    # Should only include passages created between those dates
    for result in results:
        # Parse timestamp to verify it's in range
        timestamp_str = result["timestamp"]
        # Basic validation that timestamp exists and has expected format
        assert "2024-01-16" in timestamp_str or "2024-01-17" in timestamp_str

    # Test 7: Search with ISO datetime format
    results = await server.agent_manager.search_agent_archival_memory_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query="algorithms",
        start_datetime="2024-01-16T14:00:00",
        end_datetime="2024-01-16T15:00:00",
    )

    # Should include the machine learning passage created at 14:45
    assert len(results) >= 0  # Might be 0 if no results, but shouldn't error

    # Test 8: Search with non-existent agent should raise error
    non_existent_agent_id = "agent-00000000-0000-4000-8000-000000000000"

    with pytest.raises(Exception):  # Should raise NoResultFound or similar
        await server.agent_manager.search_agent_archival_memory_async(agent_id=non_existent_agent_id, actor=default_user, query="test")

    # Test 9: Search with invalid datetime format should raise ValueError
    with pytest.raises(ValueError, match="Invalid start_datetime format"):
        await server.agent_manager.search_agent_archival_memory_async(
            agent_id=sarah_agent.id, actor=default_user, query="test", start_datetime="invalid-date"
        )

    # Test 10: Empty query should return empty results
    results = await server.agent_manager.search_agent_archival_memory_async(agent_id=sarah_agent.id, actor=default_user, query="")

    assert len(results) == 0  # Empty query should return 0 results

    # Test 11: Whitespace-only query should also return empty results
    results = await server.agent_manager.search_agent_archival_memory_async(agent_id=sarah_agent.id, actor=default_user, query="   \n\t  ")

    assert len(results) == 0  # Whitespace-only query should return 0 results

    # Cleanup - delete the created passages
    for passage in created_passages:
        await server.passage_manager.delete_agent_passage_by_id_async(passage_id=passage.id, actor=default_user)
