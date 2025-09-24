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
# FileAgent Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_creates_association(server, default_user, sarah_agent, default_file):
    assoc, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="hello",
        max_files_open=sarah_agent.max_files_open,
    )

    assert assoc.file_id == default_file.id
    assert assoc.is_open is True
    assert assoc.visible_content == "hello"

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == assoc.visible_content
    assert file_blocks[0].label == default_file.file_name


async def test_attach_is_idempotent(server, default_user, sarah_agent, default_file):
    a1, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        visible_content="first",
        max_files_open=sarah_agent.max_files_open,
    )

    # second attach with different params
    a2, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        is_open=False,
        visible_content="second",
        max_files_open=sarah_agent.max_files_open,
    )

    assert a1.id == a2.id
    assert a2.is_open is False
    assert a2.visible_content == "second"

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == ""  # not open
    assert file_blocks[0].label == default_file.file_name


async def test_update_file_agent(server, file_attachment, default_user):
    updated = await server.file_agent_manager.update_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
        is_open=False,
        visible_content="updated",
    )
    assert updated.is_open is False
    assert updated.visible_content == "updated"


async def test_update_file_agent_by_file_name(server, file_attachment, default_user):
    updated = await server.file_agent_manager.update_file_agent_by_name(
        agent_id=file_attachment.agent_id,
        file_name=file_attachment.file_name,
        actor=default_user,
        is_open=False,
        visible_content="updated",
    )
    assert updated.is_open is False
    assert updated.visible_content == "updated"
    assert updated.start_line is None  # start_line should default to None
    assert updated.end_line is None  # end_line should default to None


@pytest.mark.asyncio
async def test_file_agent_line_tracking(server, default_user, sarah_agent, default_source):
    """Test that line information is captured when opening files with line ranges"""
    from letta.schemas.file import FileMetadata as PydanticFileMetadata

    # Create a test file with multiple lines
    test_content = "line 1\nline 2\nline 3\nline 4\nline 5"
    file_metadata = PydanticFileMetadata(
        file_name="test_lines.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=test_content)

    # Test opening with line range using enforce_max_open_files_and_open
    closed_files, was_already_open, previous_ranges = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="2: line 2\n3: line 3",
        max_files_open=sarah_agent.max_files_open,
        start_line=2,  # 1-indexed
        end_line=4,  # exclusive
    )

    # Retrieve and verify line tracking
    retrieved = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id,
        file_id=file.id,
        actor=default_user,
    )

    assert retrieved.start_line == 2
    assert retrieved.end_line == 4
    assert previous_ranges == {}  # No previous range since it wasn't open before

    # Test opening without line range - should clear line info and capture previous range
    closed_files, was_already_open, previous_ranges = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="full file content",
        max_files_open=sarah_agent.max_files_open,
        start_line=None,
        end_line=None,
    )

    # Retrieve and verify line info is cleared
    retrieved = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id,
        file_id=file.id,
        actor=default_user,
    )

    assert retrieved.start_line is None
    assert retrieved.end_line is None
    assert previous_ranges == {file.file_name: (2, 4)}  # Should capture the previous range


async def test_mark_access(server, file_attachment, default_user):
    old_ts = file_attachment.last_accessed_at
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    else:
        await asyncio.sleep(0.01)

    await server.file_agent_manager.mark_access(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    refreshed = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    assert refreshed.last_accessed_at > old_ts


async def test_list_files_and_agents(
    server,
    default_user,
    sarah_agent,
    charles_agent,
    default_file,
    another_file,
):
    # default_file ↔ charles  (open)
    await server.file_agent_manager.attach_file(
        agent_id=charles_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=charles_agent.max_files_open,
    )
    # default_file ↔ sarah    (open)
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )
    # another_file ↔ sarah    (closed)
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=another_file.id,
        file_name=another_file.file_name,
        source_id=another_file.source_id,
        actor=default_user,
        is_open=False,
        max_files_open=sarah_agent.max_files_open,
    )

    files_for_sarah = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert {f.file_id for f in files_for_sarah} == {default_file.id, another_file.id}

    open_only = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert {f.file_id for f in open_only} == {default_file.id}

    agents_for_default = await server.file_agent_manager.list_agents_for_file(default_file.id, actor=default_user)
    assert {a.agent_id for a in agents_for_default} == {sarah_agent.id, charles_agent.id}

    sarah_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    file_blocks = sarah_agent.memory.file_blocks
    assert len(file_blocks) == 2
    charles_agent = await server.agent_manager.get_agent_by_id_async(agent_id=charles_agent.id, actor=default_user)
    file_blocks = charles_agent.memory.file_blocks
    assert len(file_blocks) == 1
    assert file_blocks[0].value == ""
    assert file_blocks[0].label == default_file.file_name


@pytest.mark.asyncio
async def test_list_files_for_agent_paginated_basic(
    server,
    default_user,
    sarah_agent,
    default_source,
):
    """Test basic pagination functionality."""
    # create 5 files and attach them to sarah
    for i in range(5):
        file_metadata = PydanticFileMetadata(
            file_name=f"paginated_file_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=sarah_agent.max_files_open,
        )

    # get first page
    page1, cursor1, has_more1 = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        limit=3,
    )
    assert len(page1) == 3
    assert has_more1 is True
    assert cursor1 is not None

    # get second page using cursor
    page2, cursor2, has_more2 = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        cursor=cursor1,
        limit=3,
    )
    assert len(page2) == 2  # only 2 files left (5 total - 3 already fetched)
    assert has_more2 is False
    assert cursor2 is not None

    # verify no overlap between pages
    page1_ids = {fa.id for fa in page1}
    page2_ids = {fa.id for fa in page2}
    assert page1_ids.isdisjoint(page2_ids)


@pytest.mark.asyncio
async def test_list_files_for_agent_paginated_filter_open(
    server,
    default_user,
    sarah_agent,
    default_source,
):
    """Test pagination with is_open=True filter."""
    # create files: 3 open, 2 closed
    for i in range(5):
        file_metadata = PydanticFileMetadata(
            file_name=f"filter_file_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            is_open=(i < 3),  # first 3 are open
            max_files_open=sarah_agent.max_files_open,
        )

    # get only open files
    open_files, cursor, has_more = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        is_open=True,
        limit=10,
    )
    assert len(open_files) == 3
    assert has_more is False
    assert all(fa.is_open for fa in open_files)


@pytest.mark.asyncio
async def test_list_files_for_agent_paginated_filter_closed(
    server,
    default_user,
    sarah_agent,
    default_source,
):
    """Test pagination with is_open=False filter."""
    # create files: 2 open, 4 closed
    for i in range(6):
        file_metadata = PydanticFileMetadata(
            file_name=f"closed_file_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            is_open=(i < 2),  # first 2 are open, rest are closed
            max_files_open=sarah_agent.max_files_open,
        )

    # paginate through closed files
    page1, cursor1, has_more1 = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        is_open=False,
        limit=2,
    )
    assert len(page1) == 2
    assert has_more1 is True
    assert all(not fa.is_open for fa in page1)

    # get second page of closed files
    page2, cursor2, has_more2 = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        is_open=False,
        cursor=cursor1,
        limit=3,
    )
    assert len(page2) == 2  # only 2 closed files left
    assert has_more2 is False
    assert all(not fa.is_open for fa in page2)


@pytest.mark.asyncio
async def test_list_files_for_agent_paginated_empty(
    server,
    default_user,
    charles_agent,
):
    """Test pagination with agent that has no files."""
    # charles_agent has no files attached in this test
    result, cursor, has_more = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=charles_agent.id,
        actor=default_user,
        limit=10,
    )
    assert len(result) == 0
    assert cursor is None
    assert has_more is False


@pytest.mark.asyncio
async def test_list_files_for_agent_paginated_large_limit(
    server,
    default_user,
    sarah_agent,
    default_source,
):
    """Test that large limit returns all files without pagination."""
    # create 3 files
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"all_files_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=sarah_agent.max_files_open,
        )

    # request with large limit
    all_files, cursor, has_more = await server.file_agent_manager.list_files_for_agent_paginated(
        agent_id=sarah_agent.id,
        actor=default_user,
        limit=100,
    )
    assert len(all_files) == 3
    assert has_more is False
    assert cursor is not None  # cursor is still set to last item


@pytest.mark.asyncio
async def test_detach_file(server, file_attachment, default_user):
    await server.file_agent_manager.detach_file(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    res = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=file_attachment.agent_id,
        file_id=file_attachment.file_id,
        actor=default_user,
    )
    assert res is None


async def test_detach_file_bulk(
    server,
    default_user,
    sarah_agent,
    charles_agent,
    default_source,
):
    """Test bulk deletion of multiple agent-file associations."""
    # Create multiple files
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"test_file_{i}.txt",
            source_id=default_source.id,
            organization_id=default_user.organization_id,
        )
        file = await server.file_manager.create_file(file_metadata, actor=default_user)
        files.append(file)

    # Attach all files to both agents
    for file in files:
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=sarah_agent.max_files_open,
        )
        await server.file_agent_manager.attach_file(
            agent_id=charles_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            max_files_open=charles_agent.max_files_open,
        )

    # Verify all files are attached to both agents
    sarah_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    charles_files = await server.file_agent_manager.list_files_for_agent(
        charles_agent.id, per_file_view_window_char_limit=charles_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(sarah_files) == 3
    assert len(charles_files) == 3

    # Test 1: Bulk delete specific files from specific agents
    agent_file_pairs = [
        (sarah_agent.id, files[0].id),  # Remove file 0 from sarah
        (sarah_agent.id, files[1].id),  # Remove file 1 from sarah
        (charles_agent.id, files[1].id),  # Remove file 1 from charles
    ]

    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=default_user)
    assert deleted_count == 3

    # Verify the correct files were deleted
    sarah_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    charles_files = await server.file_agent_manager.list_files_for_agent(
        charles_agent.id, per_file_view_window_char_limit=charles_agent.per_file_view_window_char_limit, actor=default_user
    )

    # Sarah should only have file 2 left
    assert len(sarah_files) == 1
    assert sarah_files[0].file_id == files[2].id

    # Charles should have files 0 and 2 left
    assert len(charles_files) == 2
    charles_file_ids = {f.file_id for f in charles_files}
    assert charles_file_ids == {files[0].id, files[2].id}

    # Test 2: Empty list should return 0 and not fail
    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=[], actor=default_user)
    assert deleted_count == 0

    # Test 3: Attempting to delete already deleted associations should return 0
    agent_file_pairs = [
        (sarah_agent.id, files[0].id),  # Already deleted
        (sarah_agent.id, files[1].id),  # Already deleted
    ]
    deleted_count = await server.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=default_user)
    assert deleted_count == 0


async def test_org_scoping(
    server,
    default_user,
    other_user_different_org,
    sarah_agent,
    default_file,
):
    # attach as default_user
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=default_file.id,
        file_name=default_file.file_name,
        source_id=default_file.source_id,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # other org should see nothing
    files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=other_user_different_org
    )
    assert files == []


# ======================================================================================================================
# LRU File Management Tests
# ======================================================================================================================


async def test_mark_access_bulk(server, default_user, sarah_agent, default_source):
    """Test that mark_access_bulk updates last_accessed_at for multiple files."""
    import time

    # Create multiple files and attach them
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach all files (they'll be open by default)
    attached_files = []
    for file in files:
        file_agent, closed_files = await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )
        attached_files.append(file_agent)

    # Get initial timestamps
    initial_times = {}
    for file_agent in attached_files:
        fa = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file_agent.file_id, actor=default_user)
        initial_times[fa.file_name] = fa.last_accessed_at

    # Wait a moment to ensure timestamp difference
    time.sleep(1.1)

    # Use mark_access_bulk on subset of files
    file_names_to_mark = [files[0].file_name, files[2].file_name]
    await server.file_agent_manager.mark_access_bulk(agent_id=sarah_agent.id, file_names=file_names_to_mark, actor=default_user)

    # Check that only marked files have updated timestamps
    for i, file in enumerate(files):
        fa = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)

        if file.file_name in file_names_to_mark:
            assert fa.last_accessed_at > initial_times[file.file_name], f"File {file.file_name} should have updated timestamp"
        else:
            assert fa.last_accessed_at == initial_times[file.file_name], f"File {file.file_name} should not have updated timestamp"


async def test_lru_eviction_on_attach(server, default_user, sarah_agent, default_source):
    """Test that attaching files beyond max_files_open triggers LRU eviction."""
    import time

    # Use the agent's configured max_files_open
    max_files_open = sarah_agent.max_files_open

    # Create more files than the limit
    files = []
    for i in range(max_files_open + 2):  # e.g., 7 files for max_files_open=5
        file_metadata = PydanticFileMetadata(
            file_name=f"lru_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach files one by one with small delays to ensure different timestamps
    attached_files = []
    all_closed_files = []

    for i, file in enumerate(files):
        if i > 0:
            time.sleep(0.1)  # Small delay to ensure different timestamps

        file_agent, closed_files = await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )
        attached_files.append(file_agent)
        all_closed_files.extend(closed_files)

        # Check that we never exceed max_files_open
        open_files = await server.file_agent_manager.list_files_for_agent(
            sarah_agent.id,
            per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit,
            actor=default_user,
            is_open_only=True,
        )
        assert len(open_files) <= max_files_open, f"Should never exceed {max_files_open} open files"

    # Should have closed exactly 2 files (e.g., 7 - 5 = 2 for max_files_open=5)
    expected_closed_count = len(files) - max_files_open
    assert len(all_closed_files) == expected_closed_count, (
        f"Should have closed {expected_closed_count} files, but closed: {all_closed_files}"
    )

    # Check that the oldest files were closed (first N files attached)
    expected_closed = [files[i].file_name for i in range(expected_closed_count)]
    assert set(all_closed_files) == set(expected_closed), f"Wrong files closed. Expected {expected_closed}, got {all_closed_files}"

    # Check that exactly max_files_open files are open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Check that the most recently attached files are still open
    open_file_names = {f.file_name for f in open_files}
    expected_open = {files[i].file_name for i in range(expected_closed_count, len(files))}  # last max_files_open files
    assert open_file_names == expected_open


async def test_lru_eviction_on_open_file(server, default_user, sarah_agent, default_source):
    """Test that opening a file beyond max_files_open triggers LRU eviction."""
    import time

    max_files_open = sarah_agent.max_files_open

    # Create files equal to the limit
    files = []
    for i in range(max_files_open + 1):  # 6 files for max_files_open=5
        file_metadata = PydanticFileMetadata(
            file_name=f"open_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach first max_files_open files
    for i in range(max_files_open):
        time.sleep(0.1)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=files[i].id,
            file_name=files[i].file_name,
            source_id=files[i].source_id,
            actor=default_user,
            visible_content=f"content for {files[i].file_name}",
            max_files_open=sarah_agent.max_files_open,
        )

    # Attach the last file as closed
    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        is_open=False,
        visible_content=f"content for {files[-1].file_name}",
        max_files_open=sarah_agent.max_files_open,
    )

    # All files should be attached but only max_files_open should be open
    all_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(all_files) == max_files_open + 1
    assert len(open_files) == max_files_open

    # Wait a moment
    time.sleep(0.1)

    # Now "open" the last file using the efficient method
    closed_files, was_already_open, _ = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        visible_content="updated content",
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed 1 file (the oldest one)
    assert len(closed_files) == 1, f"Should have closed 1 file, got: {closed_files}"
    assert closed_files[0] == files[0].file_name, f"Should have closed oldest file {files[0].file_name}"

    # Check that exactly max_files_open files are still open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Check that the newly opened file is open and the oldest is closed
    last_file_agent = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=files[-1].id, actor=default_user
    )
    first_file_agent = await server.file_agent_manager.get_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=files[0].id, actor=default_user
    )

    assert last_file_agent.is_open is True, "Last file should be open"
    assert first_file_agent.is_open is False, "First file should be closed"


async def test_lru_no_eviction_when_reopening_same_file(server, default_user, sarah_agent, default_source):
    """Test that reopening an already open file doesn't trigger unnecessary eviction."""
    import time

    max_files_open = sarah_agent.max_files_open

    # Create files equal to the limit
    files = []
    for i in range(max_files_open):
        file_metadata = PydanticFileMetadata(
            file_name=f"reopen_test_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"test content {i}")
        files.append(file)

    # Attach all files (they'll be open)
    for i, file in enumerate(files):
        time.sleep(0.1)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"content for {file.file_name}",
            max_files_open=sarah_agent.max_files_open,
        )

    # All files should be open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open
    initial_open_names = {f.file_name for f in open_files}

    # Wait a moment
    time.sleep(0.1)

    # "Reopen" the last file (which is already open)
    closed_files, was_already_open, _ = await server.file_agent_manager.enforce_max_open_files_and_open(
        agent_id=sarah_agent.id,
        file_id=files[-1].id,
        file_name=files[-1].file_name,
        source_id=files[-1].source_id,
        actor=default_user,
        visible_content="updated content",
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not have closed any files since we're within the limit
    assert len(closed_files) == 0, f"Should not have closed any files when reopening, got: {closed_files}"
    assert was_already_open is True, "File should have been detected as already open"

    # All the same files should still be open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open
    final_open_names = {f.file_name for f in open_files}
    assert initial_open_names == final_open_names, "Same files should remain open"


async def test_last_accessed_at_updates_correctly(server, default_user, sarah_agent, default_source):
    """Test that last_accessed_at is updated in the correct scenarios."""
    import time

    # Create and attach a file
    file_metadata = PydanticFileMetadata(
        file_name="timestamp_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text="test content")

    file_agent, closed_files = await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=file.id,
        file_name=file.file_name,
        source_id=file.source_id,
        actor=default_user,
        visible_content="initial content",
        max_files_open=sarah_agent.max_files_open,
    )

    initial_time = file_agent.last_accessed_at
    time.sleep(1.1)

    # Test update_file_agent_by_id updates timestamp
    updated_agent = await server.file_agent_manager.update_file_agent_by_id(
        agent_id=sarah_agent.id, file_id=file.id, actor=default_user, visible_content="updated content"
    )
    assert updated_agent.last_accessed_at > initial_time, "update_file_agent_by_id should update timestamp"

    time.sleep(1.1)
    prev_time = updated_agent.last_accessed_at

    # Test update_file_agent_by_name updates timestamp
    updated_agent2 = await server.file_agent_manager.update_file_agent_by_name(
        agent_id=sarah_agent.id, file_name=file.file_name, actor=default_user, is_open=False
    )
    assert updated_agent2.last_accessed_at > prev_time, "update_file_agent_by_name should update timestamp"

    time.sleep(1.1)
    prev_time = updated_agent2.last_accessed_at

    # Test mark_access updates timestamp
    await server.file_agent_manager.mark_access(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)

    final_agent = await server.file_agent_manager.get_file_agent_by_id(agent_id=sarah_agent.id, file_id=file.id, actor=default_user)
    assert final_agent.last_accessed_at > prev_time, "mark_access should update timestamp"


async def test_attach_files_bulk_basic(server, default_user, sarah_agent, default_source):
    """Test basic functionality of attach_files_bulk method."""
    # Create multiple files
    files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"bulk_test_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"content {i}")
        files.append(file)

    # Create visible content map
    visible_content_map = {f"bulk_test_{i}.txt": f"visible content {i}" for i in range(3)}

    # Bulk attach files
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not close any files since we're under the limit
    assert closed_files == []

    # Verify all files are attached and open
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(attached_files) == 3

    attached_file_names = {f.file_name for f in attached_files}
    expected_names = {f"bulk_test_{i}.txt" for i in range(3)}
    assert attached_file_names == expected_names

    # Verify visible content is set correctly
    for i, attached_file in enumerate(attached_files):
        if attached_file.file_name == f"bulk_test_{i}.txt":
            assert attached_file.visible_content == f"visible content {i}"


async def test_attach_files_bulk_deduplication(server, default_user, sarah_agent, default_source):
    """Test that attach_files_bulk properly deduplicates files with same names."""
    # Create files with same name (different IDs)
    file_metadata_1 = PydanticFileMetadata(
        file_name="duplicate_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file1 = await server.file_manager.create_file(file_metadata=file_metadata_1, actor=default_user, text="content 1")

    file_metadata_2 = PydanticFileMetadata(
        file_name="duplicate_test.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    file2 = await server.file_manager.create_file(file_metadata=file_metadata_2, actor=default_user, text="content 2")

    # Try to attach both files (same name, different IDs)
    files_to_attach = [file1, file2]
    visible_content_map = {"duplicate_test.txt": "visible content"}

    # Bulk attach should deduplicate
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files_to_attach,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should only attach one file (deduplicated)
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(attached_files) == 1
    assert attached_files[0].file_name == "duplicate_test.txt"


async def test_attach_files_bulk_lru_eviction(server, default_user, sarah_agent, default_source):
    """Test that attach_files_bulk properly handles LRU eviction without duplicates."""
    import time

    max_files_open = sarah_agent.max_files_open

    # First, fill up to the max with individual files
    existing_files = []
    for i in range(max_files_open):
        file_metadata = PydanticFileMetadata(
            file_name=f"existing_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"existing {i}")
        existing_files.append(file)

        time.sleep(0.05)  # Small delay for different timestamps
        await server.file_agent_manager.attach_file(
            agent_id=sarah_agent.id,
            file_id=file.id,
            file_name=file.file_name,
            source_id=file.source_id,
            actor=default_user,
            visible_content=f"existing content {i}",
            max_files_open=sarah_agent.max_files_open,
        )

    # Verify we're at the limit
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == max_files_open

    # Now bulk attach 3 new files (should trigger LRU eviction)
    new_files = []
    for i in range(3):
        file_metadata = PydanticFileMetadata(
            file_name=f"new_bulk_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"new content {i}")
        new_files.append(file)

    visible_content_map = {f"new_bulk_{i}.txt": f"new visible {i}" for i in range(3)}

    # Bulk attach should evict oldest files
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=new_files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed exactly 3 files (oldest ones)
    assert len(closed_files) == 3

    # CRITICAL: Verify no duplicates in closed_files list
    assert len(closed_files) == len(set(closed_files)), f"Duplicate file names in closed_files: {closed_files}"

    # Verify expected files were closed (oldest 3)
    expected_closed = {f"existing_{i}.txt" for i in range(3)}
    actual_closed = set(closed_files)
    assert actual_closed == expected_closed

    # Verify we still have exactly max_files_open files open
    open_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files_after) == max_files_open

    # Verify the new files are open
    open_file_names = {f.file_name for f in open_files_after}
    for i in range(3):
        assert f"new_bulk_{i}.txt" in open_file_names


async def test_attach_files_bulk_mixed_existing_new(server, default_user, sarah_agent, default_source):
    """Test bulk attach with mix of existing and new files."""
    # Create and attach one file individually first
    existing_file_metadata = PydanticFileMetadata(
        file_name="existing_file.txt",
        organization_id=default_user.organization_id,
        source_id=default_source.id,
    )
    existing_file = await server.file_manager.create_file(file_metadata=existing_file_metadata, actor=default_user, text="existing")

    await server.file_agent_manager.attach_file(
        agent_id=sarah_agent.id,
        file_id=existing_file.id,
        file_name=existing_file.file_name,
        source_id=existing_file.source_id,
        actor=default_user,
        visible_content="old content",
        is_open=False,  # Start as closed
        max_files_open=sarah_agent.max_files_open,
    )

    # Create new files
    new_files = []
    for i in range(2):
        file_metadata = PydanticFileMetadata(
            file_name=f"new_file_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"new {i}")
        new_files.append(file)

    # Bulk attach: existing file + new files
    files_to_attach = [existing_file] + new_files
    visible_content_map = {
        "existing_file.txt": "updated content",
        "new_file_0.txt": "new content 0",
        "new_file_1.txt": "new content 1",
    }

    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=files_to_attach,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should not close any files
    assert closed_files == []

    # Verify all files are now open
    open_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files) == 3

    # Verify existing file was updated
    existing_file_agent = await server.file_agent_manager.get_file_agent_by_file_name(
        agent_id=sarah_agent.id, file_name="existing_file.txt", actor=default_user
    )
    assert existing_file_agent.is_open is True
    assert existing_file_agent.visible_content == "updated content"


async def test_attach_files_bulk_empty_list(server, default_user, sarah_agent):
    """Test attach_files_bulk with empty file list."""
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id, files_metadata=[], visible_content_map={}, actor=default_user, max_files_open=sarah_agent.max_files_open
    )

    assert closed_files == []

    # Verify no files are attached
    attached_files = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(attached_files) == 0


async def test_attach_files_bulk_oversized_bulk(server, default_user, sarah_agent, default_source):
    """Test bulk attach when trying to attach more files than max_files_open allows."""
    max_files_open = sarah_agent.max_files_open

    # Create more files than the limit allows
    oversized_files = []
    for i in range(max_files_open + 3):  # 3 more than limit
        file_metadata = PydanticFileMetadata(
            file_name=f"oversized_{i}.txt",
            organization_id=default_user.organization_id,
            source_id=default_source.id,
        )
        file = await server.file_manager.create_file(file_metadata=file_metadata, actor=default_user, text=f"oversized {i}")
        oversized_files.append(file)

    visible_content_map = {f"oversized_{i}.txt": f"oversized visible {i}" for i in range(max_files_open + 3)}

    # Bulk attach all files (more than limit)
    closed_files = await server.file_agent_manager.attach_files_bulk(
        agent_id=sarah_agent.id,
        files_metadata=oversized_files,
        visible_content_map=visible_content_map,
        actor=default_user,
        max_files_open=sarah_agent.max_files_open,
    )

    # Should have closed exactly 3 files (the excess)
    assert len(closed_files) == 3

    # CRITICAL: Verify no duplicates in closed_files list
    assert len(closed_files) == len(set(closed_files)), f"Duplicate file names in closed_files: {closed_files}"

    # Should have exactly max_files_open files open
    open_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user, is_open_only=True
    )
    assert len(open_files_after) == max_files_open

    # All files should be attached (some open, some closed)
    all_files_after = await server.file_agent_manager.list_files_for_agent(
        sarah_agent.id, per_file_view_window_char_limit=sarah_agent.per_file_view_window_char_limit, actor=default_user
    )
    assert len(all_files_after) == max_files_open + 3
