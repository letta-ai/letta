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
    RunStatus,
    SandboxType,
    StepStatus,
    TagMatchMode,
    ToolType,
    VectorDBProvider,
)
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate, SandboxEnvironmentVariableUpdate
from letta.schemas.file import FileMetadata, FileMetadata as PydanticFileMetadata
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityPropertyType, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.job import Job as PydanticJob, LettaRequestConfig
from letta.schemas.letta_message import UpdateAssistantMessage, UpdateReasoningMessage, UpdateSystemMessage, UpdateUserMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, Message as PydanticMessage, MessageCreate, MessageUpdate, ToolReturn
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.organization import Organization, Organization as PydanticOrganization, OrganizationUpdate
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.run import Run as PydanticRun, RunUpdate
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
# RunManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_run(server: SyncServer, sarah_agent, default_user):
    """Test creating a run."""
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )

    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Assertions to ensure the created run matches the expected values
    assert created_run.agent_id == sarah_agent.id
    assert created_run.created_at
    assert created_run.status == RunStatus.created
    assert created_run.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_get_run_by_id(server: SyncServer, sarah_agent, default_user):
    """Test fetching a run by ID."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Fetch the run by ID
    fetched_run = await server.run_manager.get_run_by_id(created_run.id, actor=default_user)

    # Assertions to ensure the fetched run matches the created run
    assert fetched_run.id == created_run.id
    assert fetched_run.status == RunStatus.created
    assert fetched_run.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_list_runs(server: SyncServer, sarah_agent, default_user):
    """Test listing runs."""
    # Create multiple runs
    for i in range(3):
        run_data = PydanticRun(
            metadata={"type": f"test-{i}"},
            agent_id=sarah_agent.id,
        )
        await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # List runs
    runs = await server.run_manager.list_runs(actor=default_user)

    # Assertions to check that the created runs are listed
    assert len(runs) == 3
    assert all(run.agent_id == sarah_agent.id for run in runs)
    assert all(run.metadata["type"].startswith("test") for run in runs)


@pytest.mark.asyncio
async def test_list_runs_with_metadata(server: SyncServer, sarah_agent, default_user):
    for i in range(3):
        run_data = PydanticRun(agent_id=sarah_agent.id)
        created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)
        if i == 1:
            await server.run_manager.update_run_by_id_async(created_run.id, RunUpdate(status=RunStatus.completed), actor=default_user)

    runs = await server.run_manager.list_runs(actor=default_user, statuses=[RunStatus.completed])
    assert len(runs) == 1
    assert runs[0].status == RunStatus.completed

    runs = await server.run_manager.list_runs(actor=default_user)
    assert len(runs) == 3


@pytest.mark.asyncio
async def test_update_run_by_id(server: SyncServer, sarah_agent, default_user):
    """Test updating a run by its ID."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Update the run
    updated_run = await server.run_manager.update_run_by_id_async(created_run.id, RunUpdate(status=RunStatus.completed), actor=default_user)

    # Assertions to ensure the run was updated
    assert updated_run.status == RunStatus.completed


@pytest.mark.asyncio
async def test_update_run_metadata_persistence(server: SyncServer, sarah_agent, default_user):
    """Test that metadata is properly persisted when updating a run."""
    # Create a run with initial metadata
    run_data = PydanticRun(
        metadata={"type": "test", "initial": "value"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Verify initial metadata
    assert created_run.metadata == {"type": "test", "initial": "value"}

    # Update the run with error metadata (simulating what happens in streaming service)
    error_data = {
        "error": {"type": "llm_timeout", "message": "The LLM request timed out. Please try again.", "detail": "Timeout after 30s"}
    }
    updated_run = await server.run_manager.update_run_by_id_async(
        created_run.id,
        RunUpdate(status=RunStatus.failed, stop_reason=StopReasonType.llm_api_error, metadata=error_data),
        actor=default_user,
    )

    # Verify metadata was properly updated
    assert updated_run.status == RunStatus.failed
    assert updated_run.stop_reason == StopReasonType.llm_api_error
    assert updated_run.metadata == error_data
    assert "error" in updated_run.metadata
    assert updated_run.metadata["error"]["type"] == "llm_timeout"

    # Fetch the run again to ensure it's persisted in DB
    fetched_run = await server.run_manager.get_run_by_id(created_run.id, actor=default_user)
    assert fetched_run.metadata == error_data
    assert "error" in fetched_run.metadata
    assert fetched_run.metadata["error"]["type"] == "llm_timeout"


@pytest.mark.asyncio
async def test_update_run_updates_agent_last_stop_reason(server: SyncServer, sarah_agent, default_user):
    """Test that completing a run updates the agent's last_stop_reason."""

    # Verify agent starts with no last_stop_reason
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    initial_stop_reason = agent.last_stop_reason

    # Create a run
    run_data = PydanticRun(agent_id=sarah_agent.id)
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Complete the run with end_turn stop reason
    await server.run_manager.update_run_by_id_async(
        created_run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Verify agent's last_stop_reason was updated to end_turn
    updated_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert updated_agent.last_stop_reason == StopReasonType.end_turn

    # Create another run and complete with different stop reason
    run_data2 = PydanticRun(agent_id=sarah_agent.id)
    created_run2 = await server.run_manager.create_run(pydantic_run=run_data2, actor=default_user)

    # Complete with error stop reason
    await server.run_manager.update_run_by_id_async(
        created_run2.id, RunUpdate(status=RunStatus.failed, stop_reason=StopReasonType.error), actor=default_user
    )

    # Verify agent's last_stop_reason was updated to error
    final_agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert final_agent.last_stop_reason == StopReasonType.error


@pytest.mark.asyncio
async def test_delete_run_by_id(server: SyncServer, sarah_agent, default_user):
    """Test deleting a run by its ID."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)
    print("created_run to delete", created_run.id)

    # Delete the run
    await server.run_manager.delete_run(created_run.id, actor=default_user)

    # Fetch the run by ID
    with pytest.raises(NoResultFound):
        await server.run_manager.get_run_by_id(created_run.id, actor=default_user)

    # List runs to ensure the run was deleted
    runs = await server.run_manager.list_runs(actor=default_user)
    assert len(runs) == 0


@pytest.mark.asyncio
async def test_update_run_auto_complete(server: SyncServer, default_user, sarah_agent):
    """Test that updating a run's status to 'completed' automatically sets completed_at."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)
    assert created_run.completed_at is None

    # Update the run to completed status
    updated_run = await server.run_manager.update_run_by_id_async(created_run.id, RunUpdate(status=RunStatus.completed), actor=default_user)

    # Check that completed_at was automatically set
    assert updated_run.completed_at is not None
    assert isinstance(updated_run.completed_at, datetime)


@pytest.mark.asyncio
async def test_get_run_not_found(server: SyncServer, default_user):
    """Test fetching a non-existent run."""
    non_existent_run_id = "nonexistent-id"
    with pytest.raises(LettaInvalidArgumentError):
        await server.run_manager.get_run_by_id(non_existent_run_id, actor=default_user)


@pytest.mark.asyncio
async def test_delete_run_not_found(server: SyncServer, default_user):
    """Test deleting a non-existent run."""
    non_existent_run_id = "nonexistent-id"
    with pytest.raises(LettaInvalidArgumentError):
        await server.run_manager.delete_run(non_existent_run_id, actor=default_user)


@pytest.mark.asyncio
async def test_list_runs_pagination(server: SyncServer, sarah_agent, default_user):
    """Test listing runs with pagination."""
    # Create multiple runs
    for i in range(10):
        run_data = PydanticRun(agent_id=sarah_agent.id)
        await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # List runs with a limit
    runs = await server.run_manager.list_runs(actor=default_user, limit=5)
    assert len(runs) == 5
    assert all(run.agent_id == sarah_agent.id for run in runs)

    # Test cursor-based pagination
    first_page = await server.run_manager.list_runs(actor=default_user, limit=3, ascending=True)
    assert len(first_page) == 3
    assert first_page[0].created_at <= first_page[1].created_at <= first_page[2].created_at

    last_page = await server.run_manager.list_runs(actor=default_user, limit=3, ascending=False)
    assert len(last_page) == 3
    assert last_page[0].created_at >= last_page[1].created_at >= last_page[2].created_at
    first_page_ids = set(run.id for run in first_page)
    last_page_ids = set(run.id for run in last_page)
    assert first_page_ids.isdisjoint(last_page_ids)

    # Test pagination with "before" cursor in descending order (UI's default behavior)
    # This is the critical scenario that was broken - clicking "Next" in the UI
    second_page_desc = await server.run_manager.list_runs(
        actor=default_user,
        before=last_page[-1].id,  # Use last (oldest) item from first page as cursor
        limit=3,
        ascending=False,
    )
    assert len(second_page_desc) == 3
    # CRITICAL: Verify no overlap with first page (this was the bug - there was overlap before)
    second_page_desc_ids = set(run.id for run in second_page_desc)
    assert second_page_desc_ids.isdisjoint(last_page_ids), "Second page should not overlap with first page"
    # Verify descending order is maintained
    assert second_page_desc[0].created_at >= second_page_desc[1].created_at >= second_page_desc[2].created_at
    # Verify second page contains older items than first page
    assert second_page_desc[0].created_at < last_page[-1].created_at


@pytest.mark.asyncio
async def test_list_runs_by_status(server: SyncServer, default_user, sarah_agent):
    """Test listing runs filtered by status."""
    # Create multiple runs with different statuses
    run_data_created = PydanticRun(
        status=RunStatus.created,
        metadata={"type": "test-created"},
        agent_id=sarah_agent.id,
    )
    run_data_in_progress = PydanticRun(
        status=RunStatus.running,
        metadata={"type": "test-running"},
        agent_id=sarah_agent.id,
    )
    run_data_completed = PydanticRun(
        status=RunStatus.completed,
        metadata={"type": "test-completed"},
        agent_id=sarah_agent.id,
    )

    await server.run_manager.create_run(pydantic_run=run_data_created, actor=default_user)
    await server.run_manager.create_run(pydantic_run=run_data_in_progress, actor=default_user)
    await server.run_manager.create_run(pydantic_run=run_data_completed, actor=default_user)

    # List runs filtered by status
    created_runs = await server.run_manager.list_runs(actor=default_user, statuses=[RunStatus.created])
    in_progress_runs = await server.run_manager.list_runs(actor=default_user, statuses=[RunStatus.running])
    completed_runs = await server.run_manager.list_runs(actor=default_user, statuses=[RunStatus.completed])

    # Assertions
    assert len(created_runs) == 1
    assert created_runs[0].metadata["type"] == run_data_created.metadata["type"]

    assert len(in_progress_runs) == 1
    assert in_progress_runs[0].metadata["type"] == run_data_in_progress.metadata["type"]

    assert len(completed_runs) == 1
    assert completed_runs[0].metadata["type"] == run_data_completed.metadata["type"]


@pytest.mark.asyncio
async def test_list_runs_by_stop_reason(server: SyncServer, sarah_agent, default_user):
    """Test listing runs by stop reason."""

    run_pydantic = PydanticRun(
        agent_id=sarah_agent.id,
        stop_reason=StopReasonType.requires_approval,
        background=True,
    )
    run = await server.run_manager.create_run(pydantic_run=run_pydantic, actor=default_user)
    assert run.stop_reason == StopReasonType.requires_approval
    assert run.background == True
    assert run.agent_id == sarah_agent.id

    # list runs by stop reason
    runs = await server.run_manager.list_runs(actor=default_user, stop_reason=StopReasonType.requires_approval)
    assert len(runs) == 1
    assert runs[0].id == run.id

    # list runs by background
    runs = await server.run_manager.list_runs(actor=default_user, background=True)
    assert len(runs) == 1
    assert runs[0].id == run.id

    # list runs by agent_id
    runs = await server.run_manager.list_runs(actor=default_user, agent_ids=[sarah_agent.id])
    assert len(runs) == 1
    assert runs[0].id == run.id


@pytest.mark.asyncio
async def test_list_runs_by_tools_used(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by tools used."""
    # Seed tools first
    from letta.services.tool_manager import ToolManager

    tool_manager = ToolManager()
    await tool_manager.upsert_base_tools_async(default_user)

    web_search_tool_id = await tool_manager.get_tool_id_by_name_async("web_search", default_user)
    run_code_tool_id = await tool_manager.get_tool_id_by_name_async("run_code", default_user)

    if not web_search_tool_id or not run_code_tool_id:
        pytest.skip("Required tools (web_search, run_code) are not available in the database")

    # Create run with web_search tool
    run_web = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id),
        actor=default_user,
    )
    await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role=MessageRole.assistant,
                content=[TextContent(text="Using web search")],
                tool_calls=[
                    OpenAIToolCall(
                        id="call_web",
                        type="function",
                        function=OpenAIFunction(name="web_search", arguments="{}"),
                    )
                ],
                run_id=run_web.id,
            )
        ],
        actor=default_user,
    )

    # Create run with run_code tool
    run_code = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id),
        actor=default_user,
    )
    await server.message_manager.create_many_messages_async(
        [
            PydanticMessage(
                agent_id=sarah_agent.id,
                role=MessageRole.assistant,
                content=[TextContent(text="Using run code")],
                tool_calls=[
                    OpenAIToolCall(
                        id="call_code",
                        type="function",
                        function=OpenAIFunction(name="run_code", arguments="{}"),
                    )
                ],
                run_id=run_code.id,
            )
        ],
        actor=default_user,
    )

    # Complete runs to populate tools_used
    await server.run_manager.update_run_by_id_async(
        run_web.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )
    await server.run_manager.update_run_by_id_async(
        run_code.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Test filtering by single tool
    runs_web = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        tools_used=[web_search_tool_id],
    )
    assert len(runs_web) == 1
    assert runs_web[0].id == run_web.id

    # Test filtering by multiple tools
    runs_multi = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        tools_used=[web_search_tool_id, run_code_tool_id],
    )
    assert len(runs_multi) == 2
    assert {r.id for r in runs_multi} == {run_web.id, run_code.id}


@pytest.mark.asyncio
async def test_list_runs_by_step_count(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by step count."""
    from letta.schemas.enums import ComparisonOperator

    # Create runs with different numbers of steps
    runs_data = []

    # Run with 0 steps
    run_0 = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=sarah_agent.id,
            metadata={"steps": 0},
        ),
        actor=default_user,
    )
    runs_data.append((run_0, 0))

    # Run with 2 steps
    run_2 = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=sarah_agent.id,
            metadata={"steps": 2},
        ),
        actor=default_user,
    )
    for i in range(2):
        await server.step_manager.log_step_async(
            agent_id=sarah_agent.id,
            provider_name="openai",
            provider_category="base",
            model="gpt-4o-mini",
            model_endpoint="https://api.openai.com/v1",
            context_window_limit=8192,
            usage=UsageStatistics(
                completion_tokens=100,
                prompt_tokens=50,
                total_tokens=150,
            ),
            run_id=run_2.id,
            actor=default_user,
            project_id=sarah_agent.project_id,
        )
    runs_data.append((run_2, 2))

    # Run with 5 steps
    run_5 = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=sarah_agent.id,
            metadata={"steps": 5},
        ),
        actor=default_user,
    )
    for i in range(5):
        await server.step_manager.log_step_async(
            agent_id=sarah_agent.id,
            provider_name="openai",
            provider_category="base",
            model="gpt-4o-mini",
            model_endpoint="https://api.openai.com/v1",
            context_window_limit=8192,
            usage=UsageStatistics(
                completion_tokens=100,
                prompt_tokens=50,
                total_tokens=150,
            ),
            run_id=run_5.id,
            actor=default_user,
            project_id=sarah_agent.project_id,
        )
    runs_data.append((run_5, 5))

    # Update all runs to trigger metrics update
    for run, _ in runs_data:
        await server.run_manager.update_run_by_id_async(
            run.id,
            RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn),
            actor=default_user,
        )

    # Test EQ operator - exact match
    runs_eq_2 = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        step_count=2,
        step_count_operator=ComparisonOperator.EQ,
    )
    assert len(runs_eq_2) == 1
    assert runs_eq_2[0].id == run_2.id

    # Test GTE operator - greater than or equal
    runs_gte_2 = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        step_count=2,
        step_count_operator=ComparisonOperator.GTE,
    )
    assert len(runs_gte_2) == 2
    run_ids_gte = {run.id for run in runs_gte_2}
    assert run_2.id in run_ids_gte
    assert run_5.id in run_ids_gte

    # Test LTE operator - less than or equal
    runs_lte_2 = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        step_count=2,
        step_count_operator=ComparisonOperator.LTE,
    )
    assert len(runs_lte_2) == 2
    run_ids_lte = {run.id for run in runs_lte_2}
    assert run_0.id in run_ids_lte
    assert run_2.id in run_ids_lte

    # Test GTE with 0 - should return all runs
    runs_gte_0 = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        step_count=0,
        step_count_operator=ComparisonOperator.GTE,
    )
    assert len(runs_gte_0) == 3

    # Test LTE with 0 - should return only run with 0 steps
    runs_lte_0 = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        step_count=0,
        step_count_operator=ComparisonOperator.LTE,
    )
    assert len(runs_lte_0) == 1
    assert runs_lte_0[0].id == run_0.id


@pytest.mark.asyncio
async def test_list_runs_by_base_template_id(server: SyncServer, sarah_agent, default_user):
    """Test listing runs by template family."""
    run_data = PydanticRun(
        agent_id=sarah_agent.id,
        base_template_id="test-template-family",
    )

    await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)
    runs = await server.run_manager.list_runs(actor=default_user, template_family="test-template-family")
    assert len(runs) == 1


async def test_e2e_run_callback(monkeypatch, server: SyncServer, default_user, sarah_agent):
    """Test that run callbacks are properly dispatched when a run is completed."""
    captured = {}

    # Create a simple mock for the async HTTP client
    class MockAsyncResponse:
        status_code = 202

    async def mock_post(url, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return MockAsyncResponse()

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, json, timeout):
            return await mock_post(url, json, timeout)

    # Patch the AsyncClient
    import letta.services.run_manager as run_manager_module

    monkeypatch.setattr(run_manager_module, "AsyncClient", MockAsyncClient)

    run_in = PydanticRun(
        status=RunStatus.created, metadata={"foo": "bar"}, agent_id=sarah_agent.id, callback_url="http://example.test/webhook/runs"
    )
    created = await server.run_manager.create_run(pydantic_run=run_in, actor=default_user)
    assert created.callback_url == "http://example.test/webhook/runs"

    # Update the run status to completed, which should trigger the callback
    updated = await server.run_manager.update_run_by_id_async(
        created.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Verify the callback was triggered with the correct parameters
    assert captured["url"] == created.callback_url, "Callback URL doesn't match"
    assert captured["json"]["run_id"] == created.id, "Run ID in callback doesn't match"
    assert captured["json"]["status"] == RunStatus.completed.value, "Run status in callback doesn't match"

    # Verify the completed_at timestamp is reasonable
    actual_dt = datetime.fromisoformat(captured["json"]["completed_at"]).replace(tzinfo=None)
    # Remove timezone from updated.completed_at for comparison (it comes from DB as timezone-aware)
    assert abs((actual_dt - updated.completed_at).total_seconds()) < 1, "Timestamp difference is too large"

    assert isinstance(updated.callback_sent_at, datetime)
    assert updated.callback_status_code == 202


@pytest.mark.asyncio
async def test_run_callback_only_on_terminal_status(server: SyncServer, sarah_agent, default_user, monkeypatch):
    """
    Regression: ensure a non-terminal update (running) does NOT set completed_at or trigger callback,
    and that a subsequent terminal update (completed) does trigger the callback exactly once.
    """

    # Capture callback invocations
    captured = {"count": 0, "url": None, "json": None}

    class MockAsyncResponse:
        status_code = 202

    async def mock_post(url, json, timeout):
        captured["count"] += 1
        captured["url"] = url
        captured["json"] = json
        return MockAsyncResponse()

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, json, timeout):
            return await mock_post(url, json, timeout)

    # Patch the AsyncClient in run_manager module
    import letta.services.run_manager as run_manager_module

    monkeypatch.setattr(run_manager_module, "AsyncClient", MockAsyncClient)

    # Create run with a callback URL
    run_in = PydanticRun(
        status=RunStatus.created,
        metadata={"foo": "bar"},
        agent_id=sarah_agent.id,
        callback_url="http://example.test/webhook/runs",
    )
    created = await server.run_manager.create_run(pydantic_run=run_in, actor=default_user)
    assert created.callback_url == "http://example.test/webhook/runs"

    # 1) Non-terminal update: running
    updated_running = await server.run_manager.update_run_by_id_async(created.id, RunUpdate(status=RunStatus.running), actor=default_user)

    # Should not set completed_at or trigger callback
    assert updated_running.completed_at is None
    assert captured["count"] == 0

    # 2) Terminal update: completed
    updated_completed = await server.run_manager.update_run_by_id_async(
        created.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Should trigger exactly one callback with expected payload
    assert captured["count"] == 1
    assert captured["url"] == created.callback_url
    assert captured["json"]["run_id"] == created.id
    assert captured["json"]["status"] == RunStatus.completed.value

    # completed_at should be set and align closely with callback payload
    assert updated_completed.completed_at is not None
    actual_dt = datetime.fromisoformat(captured["json"]["completed_at"]).replace(tzinfo=None)
    assert abs((actual_dt - updated_completed.completed_at).total_seconds()) < 1

    assert isinstance(updated_completed.callback_sent_at, datetime)
    assert updated_completed.callback_status_code == 202


# ======================================================================================================================
# RunManager Tests - Messages
# ======================================================================================================================


@pytest.mark.asyncio
async def test_run_messages_pagination(server: SyncServer, default_run, default_user, sarah_agent):
    """Test pagination of run messages."""

    # create the run
    run_pydantic = PydanticRun(
        agent_id=sarah_agent.id,
        status=RunStatus.created,
        metadata={"foo": "bar"},
    )
    run = await server.run_manager.create_run(pydantic_run=run_pydantic, actor=default_user)
    assert run.status == RunStatus.created

    # Create multiple messages
    message_ids = []
    for i in range(5):
        message = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Test message {i}")],
            run_id=run.id,
        )
        msg = await server.message_manager.create_many_messages_async([message], actor=default_user)
        message_ids.append(msg[0].id)

    # Test pagination with limit
    messages = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        limit=2,
    )
    assert len(messages) == 2
    assert messages[0].id == message_ids[0]
    assert messages[1].id == message_ids[1]

    # Test pagination with cursor
    first_page = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        limit=2,
        ascending=True,  # [M0, M1]
    )
    assert len(first_page) == 2
    assert first_page[0].id == message_ids[0]
    assert first_page[1].id == message_ids[1]
    assert first_page[0].created_at <= first_page[1].created_at

    last_page = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        limit=2,
        ascending=False,  # [M4, M3]
    )
    assert len(last_page) == 2
    assert last_page[0].id == message_ids[4]
    assert last_page[1].id == message_ids[3]
    assert last_page[0].created_at >= last_page[1].created_at

    first_page_ids = set(msg.id for msg in first_page)
    last_page_ids = set(msg.id for msg in last_page)
    assert first_page_ids.isdisjoint(last_page_ids)

    # Test middle page using both before and after
    middle_page = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        before=last_page[-1].id,  # M3
        after=first_page[0].id,  # M0
        ascending=True,  # [M1, M2]
    )
    assert len(middle_page) == 2  # Should include message between first and last pages
    assert middle_page[0].id == message_ids[1]
    assert middle_page[1].id == message_ids[2]
    head_tail_msgs = first_page_ids.union(last_page_ids)
    assert middle_page[1].id not in head_tail_msgs
    assert middle_page[0].id in first_page_ids

    # Test descending order for middle page
    middle_page = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        before=last_page[-1].id,  # M3
        after=first_page[0].id,  # M0
        ascending=False,  # [M2, M1]
    )
    assert len(middle_page) == 2  # Should include message between first and last pages
    assert middle_page[0].id == message_ids[2]
    assert middle_page[1].id == message_ids[1]

    # Test getting earliest messages
    msg_3 = last_page[-1].id
    earliest_msgs = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        ascending=False,
        before=msg_3,  # Get messages after M3 in descending order
    )
    assert len(earliest_msgs) == 3  # Should get M2, M1, M0
    assert all(m.id not in last_page_ids for m in earliest_msgs)
    assert earliest_msgs[0].created_at > earliest_msgs[1].created_at > earliest_msgs[2].created_at

    # Test getting earliest messages with ascending order
    earliest_msgs_ascending = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        ascending=True,
        before=msg_3,  # Get messages before M3 in ascending order
    )
    assert len(earliest_msgs_ascending) == 3  # Should get M0, M1, M2
    assert all(m.id not in last_page_ids for m in earliest_msgs_ascending)
    assert earliest_msgs_ascending[0].created_at < earliest_msgs_ascending[1].created_at < earliest_msgs_ascending[2].created_at


@pytest.mark.asyncio
async def test_run_messages_ordering(server: SyncServer, default_run, default_user, sarah_agent):
    """Test that messages are ordered by created_at."""
    # Create messages with different timestamps
    base_time = datetime.now(timezone.utc)
    message_times = [
        base_time - timedelta(minutes=2),
        base_time - timedelta(minutes=1),
        base_time,
    ]

    # create the run
    run_pydantic = PydanticRun(
        agent_id=sarah_agent.id,
    )
    run = await server.run_manager.create_run(pydantic_run=run_pydantic, actor=default_user)
    assert run.status == RunStatus.created

    for i, created_at in enumerate(message_times):
        message = PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Test message")],
            agent_id=sarah_agent.id,
            created_at=created_at,
            run_id=run.id,
        )
        msg = await server.message_manager.create_many_messages_async([message], actor=default_user)

    # Verify messages are returned in chronological order
    returned_messages = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at < returned_messages[1].created_at
    assert returned_messages[1].created_at < returned_messages[2].created_at

    # Verify messages are returned in descending order
    returned_messages = await server.message_manager.list_messages(
        run_id=run.id,
        actor=default_user,
        ascending=False,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at > returned_messages[1].created_at
    assert returned_messages[1].created_at > returned_messages[2].created_at


@pytest.mark.asyncio
async def test_job_messages_empty(server: SyncServer, default_run, default_user):
    """Test getting messages for a job with no messages."""
    messages = await server.message_manager.list_messages(
        run_id=default_run.id,
        actor=default_user,
    )
    assert len(messages) == 0


@pytest.mark.asyncio
async def test_job_messages_filter(server: SyncServer, default_run, default_user, sarah_agent):
    """Test getting messages associated with a job."""
    # Create the run
    run_pydantic = PydanticRun(
        agent_id=sarah_agent.id,
    )
    run = await server.run_manager.create_run(pydantic_run=run_pydantic, actor=default_user)
    assert run.status == RunStatus.created

    # Create test messages with different roles and tool calls
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Hello")],
            agent_id=sarah_agent.id,
            run_id=default_run.id,
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(text="Hi there!")],
            agent_id=sarah_agent.id,
            run_id=default_run.id,
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(text="Let me help you with that")],
            agent_id=sarah_agent.id,
            tool_calls=[
                OpenAIToolCall(
                    id="call_1",
                    type="function",
                    function=OpenAIFunction(
                        name="test_tool",
                        arguments='{"arg1": "value1"}',
                    ),
                )
            ],
            run_id=default_run.id,
        ),
    ]
    await server.message_manager.create_many_messages_async(messages, actor=default_user)

    # Test getting all messages
    all_messages = await server.message_manager.list_messages(
        run_id=default_run.id,
        actor=default_user,
    )
    assert len(all_messages) == 3

    # Test filtering by role
    user_messages = await server.message_manager.list_messages(run_id=default_run.id, actor=default_user, roles=[MessageRole.user])
    assert len(user_messages) == 1
    assert user_messages[0].role == MessageRole.user

    # Test limit
    limited_messages = await server.message_manager.list_messages(run_id=default_run.id, actor=default_user, limit=2)
    assert len(limited_messages) == 2


@pytest.mark.asyncio
async def test_get_run_messages(server: SyncServer, default_user: PydanticUser, sarah_agent):
    """Test getting messages for a run with request config."""
    # Create a run with custom request config
    run = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=sarah_agent.id,
            status=RunStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=False, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = []
    for i in range(4):
        if i % 2 == 0:
            # tool return message
            messages.append(
                PydanticMessage(
                    agent_id=sarah_agent.id,
                    role=MessageRole.tool,
                    content=[TextContent(text='{"status": "OK"}')],
                    tool_call_id=f"call_{i // 2}",
                    tool_returns=[
                        ToolReturn(
                            tool_call_id=f"call_{i // 2}",
                            status="success",
                            func_response='{"status": "OK", "message": "Tool executed successfully"}',
                        )
                    ],
                    run_id=run.id,
                )
            )
        else:
            # assistant message with tool call
            messages.append(
                PydanticMessage(
                    agent_id=sarah_agent.id,
                    role=MessageRole.assistant,
                    content=[TextContent(text=f"Test message {i}")],
                    tool_calls=[
                        {
                            "type": "function",
                            "id": f"call_{i // 2}",
                            "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'},
                        }
                    ],
                    run_id=run.id,
                )
            )

    created_msg = await server.message_manager.create_many_messages_async(messages, actor=default_user)

    # Get messages and verify they're converted correctly
    result = await server.message_manager.list_messages(run_id=run.id, actor=default_user)
    result = Message.to_letta_messages_from_list(result)

    # Verify correct number of messages. Assistant messages should be parsed
    assert len(result) == 6

    # Verify assistant messages are parsed according to request config
    tool_call_messages = [msg for msg in result if msg.message_type == "tool_call_message"]
    reasoning_messages = [msg for msg in result if msg.message_type == "reasoning_message"]
    assert len(tool_call_messages) == 2
    assert len(reasoning_messages) == 2
    for msg in tool_call_messages:
        assert msg.tool_call is not None
        assert msg.tool_call.name == "custom_tool"


@pytest.mark.asyncio
async def test_get_run_messages_with_assistant_message(server: SyncServer, default_user: PydanticUser, sarah_agent):
    """Test getting messages for a run with request config."""
    # Create a run with custom request config
    run = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            agent_id=sarah_agent.id,
            status=RunStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=True, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = []
    for i in range(4):
        if i % 2 == 0:
            # tool return message
            messages.append(
                PydanticMessage(
                    agent_id=sarah_agent.id,
                    role=MessageRole.tool,
                    content=[TextContent(text='{"status": "OK"}')],
                    tool_call_id=f"call_{i // 2}",
                    tool_returns=[
                        ToolReturn(
                            tool_call_id=f"call_{i // 2}",
                            status="success",
                            func_response='{"status": "OK", "message": "Tool executed successfully"}',
                        )
                    ],
                    run_id=run.id,
                )
            )
        else:
            # assistant message with tool call
            messages.append(
                PydanticMessage(
                    agent_id=sarah_agent.id,
                    role=MessageRole.assistant,
                    content=[TextContent(text=f"Test message {i}")],
                    tool_calls=[
                        {
                            "type": "function",
                            "id": f"call_{i // 2}",
                            "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'},
                        }
                    ],
                    run_id=run.id,
                )
            )

    created_msg = await server.message_manager.create_many_messages_async(messages, actor=default_user)

    # Get messages and verify they're converted correctly
    result = await server.message_manager.list_messages(run_id=run.id, actor=default_user)
    result = Message.to_letta_messages_from_list(
        result, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
    )

    # Verify correct number of messages. Assistant messages should be parsed
    assert len(result) == 4

    # Verify assistant messages are parsed according to request config
    assistant_messages = [msg for msg in result if msg.message_type == "assistant_message"]
    reasoning_messages = [msg for msg in result if msg.message_type == "reasoning_message"]
    assert len(assistant_messages) == 2
    assert len(reasoning_messages) == 2
    for msg in assistant_messages:
        assert msg.content == "test"
    for msg in reasoning_messages:
        assert "Test message" in msg.reasoning


# ======================================================================================================================
# RunManager Tests - Usage Statistics -
# ======================================================================================================================


@pytest.mark.asyncio
async def test_run_usage_stats_add_and_get(server: SyncServer, sarah_agent, default_run, default_user):
    """Test adding and retrieving run usage statistics."""
    run_manager = server.run_manager
    step_manager = server.step_manager

    # Add usage statistics
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        run_id=default_run.id,
        usage=UsageStatistics(
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
    )

    # Get usage statistics
    usage_stats = await run_manager.get_run_usage(run_id=default_run.id, actor=default_user)

    # Verify the statistics
    assert usage_stats.completion_tokens == 100
    assert usage_stats.prompt_tokens == 50
    assert usage_stats.total_tokens == 150

    # get steps
    steps = await step_manager.list_steps_async(run_id=default_run.id, actor=default_user)
    assert len(steps) == 1


@pytest.mark.asyncio
async def test_run_usage_stats_get_no_stats(server: SyncServer, default_run, default_user):
    """Test getting usage statistics for a job with no stats."""
    run_manager = server.run_manager

    # Get usage statistics for a job with no stats
    usage_stats = await run_manager.get_run_usage(run_id=default_run.id, actor=default_user)

    # Verify default values
    assert usage_stats.completion_tokens == 0
    assert usage_stats.prompt_tokens == 0
    assert usage_stats.total_tokens == 0

    # get steps
    steps = await server.step_manager.list_steps_async(run_id=default_run.id, actor=default_user)
    assert len(steps) == 0


@pytest.mark.asyncio
async def test_run_usage_stats_add_multiple(server: SyncServer, sarah_agent, default_run, default_user):
    """Test adding multiple usage statistics entries for a job."""
    run_manager = server.run_manager
    step_manager = server.step_manager

    # Add first usage statistics entry
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        usage=UsageStatistics(
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
        run_id=default_run.id,
    )

    # Add second usage statistics entry
    await step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        usage=UsageStatistics(
            completion_tokens=200,
            prompt_tokens=100,
            total_tokens=300,
        ),
        actor=default_user,
        project_id=sarah_agent.project_id,
        run_id=default_run.id,
    )

    # Get usage statistics (should return the latest entry)
    usage_stats = await run_manager.get_run_usage(run_id=default_run.id, actor=default_user)

    # Verify we get the most recent statistics
    assert usage_stats.completion_tokens == 300
    assert usage_stats.prompt_tokens == 150
    assert usage_stats.total_tokens == 450
    assert usage_stats.step_count == 2

    # get steps
    steps = await step_manager.list_steps_async(run_id=default_run.id, actor=default_user)
    assert len(steps) == 2

    # get agent steps
    steps = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(steps) == 2

    # add step feedback
    step_manager = server.step_manager

    # Add feedback to first step
    await step_manager.add_feedback_async(step_id=steps[0].id, feedback=FeedbackType.POSITIVE, actor=default_user)

    # Test has_feedback filtering
    steps_with_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, has_feedback=True, actor=default_user)
    assert len(steps_with_feedback) == 1

    steps_without_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(steps_without_feedback) == 2


@pytest.mark.asyncio
async def test_run_usage_stats_get_nonexistent_run(server: SyncServer, default_user):
    """Test getting usage statistics for a nonexistent run."""
    run_manager = server.run_manager

    with pytest.raises(LettaInvalidArgumentError):
        await run_manager.get_run_usage(run_id="nonexistent_run", actor=default_user)


@pytest.mark.asyncio
async def test_get_run_request_config(server: SyncServer, sarah_agent, default_user):
    """Test getting request config from a run."""
    request_config = LettaRequestConfig(
        use_assistant_message=True, assistant_message_tool_name="send_message", assistant_message_tool_kwarg="message"
    )

    run_data = PydanticRun(
        agent_id=sarah_agent.id,
        request_config=request_config,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    retrieved_config = await server.run_manager.get_run_request_config(created_run.id, actor=default_user)

    assert retrieved_config is not None
    assert retrieved_config.use_assistant_message == request_config.use_assistant_message
    assert retrieved_config.assistant_message_tool_name == request_config.assistant_message_tool_name
    assert retrieved_config.assistant_message_tool_kwarg == request_config.assistant_message_tool_kwarg


@pytest.mark.asyncio
async def test_get_run_request_config_none(server: SyncServer, sarah_agent, default_user):
    """Test getting request config from a run with no config."""
    run_data = PydanticRun(agent_id=sarah_agent.id)
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    retrieved_config = await server.run_manager.get_run_request_config(created_run.id, actor=default_user)

    assert retrieved_config is None


@pytest.mark.asyncio
async def test_get_run_request_config_nonexistent_run(server: SyncServer, default_user):
    """Test getting request config for a nonexistent run."""
    with pytest.raises(LettaInvalidArgumentError):
        await server.run_manager.get_run_request_config("nonexistent_run", actor=default_user)


# ======================================================================================================================
# RunManager Tests - Run Metrics
# ======================================================================================================================


@pytest.mark.asyncio
async def test_run_metrics_creation(server: SyncServer, sarah_agent, default_user):
    """Test that run metrics are created when a run is created."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_metrics"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Get the run metrics
    metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Assertions
    assert metrics is not None
    assert metrics.id == created_run.id
    assert metrics.agent_id == sarah_agent.id
    assert metrics.organization_id == default_user.organization_id
    # project_id may be None or set from the agent
    assert metrics.run_start_ns is not None
    assert metrics.run_start_ns > 0
    assert metrics.run_ns is None  # Should be None until run completes
    assert metrics.num_steps is not None
    assert metrics.num_steps == 0  # Should be 0 initially


@pytest.mark.asyncio
async def test_run_metrics_timestamp_tracking(server: SyncServer, sarah_agent, default_user):
    """Test that run_start_ns is properly tracked."""
    import time

    # Record time before creation
    before_ns = int(time.time() * 1e9)

    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_timestamp"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Record time after creation
    after_ns = int(time.time() * 1e9)

    # Get the run metrics
    metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Verify timestamp is within expected range
    assert metrics.run_start_ns is not None
    assert before_ns <= metrics.run_start_ns <= after_ns, f"Expected {before_ns} <= {metrics.run_start_ns} <= {after_ns}"


@pytest.mark.asyncio
async def test_run_metrics_duration_calculation(server: SyncServer, sarah_agent, default_user):
    """Test that run duration (run_ns) is calculated when run completes."""
    import asyncio

    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_duration"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Get initial metrics
    initial_metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)
    assert initial_metrics.run_ns is None  # Should be None initially
    assert initial_metrics.run_start_ns is not None

    # Wait a bit to ensure there's measurable duration
    await asyncio.sleep(0.1)  # Wait 100ms

    # Update the run to completed
    updated_run = await server.run_manager.update_run_by_id_async(
        created_run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Get updated metrics
    final_metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Assertions
    assert final_metrics.run_ns is not None
    assert final_metrics.run_ns > 0
    # Duration should be at least 100ms (100_000_000 nanoseconds)
    assert final_metrics.run_ns >= 100_000_000, f"Expected run_ns >= 100_000_000, got {final_metrics.run_ns}"
    # Duration should be reasonable (less than 10 seconds)
    assert final_metrics.run_ns < 10_000_000_000, f"Expected run_ns < 10_000_000_000, got {final_metrics.run_ns}"


@pytest.mark.asyncio
async def test_run_metrics_num_steps_tracking(server: SyncServer, sarah_agent, default_user):
    """Test that num_steps is properly tracked in run metrics."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_num_steps"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Initial metrics should have 0 steps
    initial_metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)
    assert initial_metrics.num_steps == 0

    # Add some steps
    for i in range(3):
        await server.step_manager.log_step_async(
            agent_id=sarah_agent.id,
            provider_name="openai",
            provider_category="base",
            model="gpt-4o-mini",
            model_endpoint="https://api.openai.com/v1",
            context_window_limit=8192,
            usage=UsageStatistics(
                completion_tokens=100 + i * 10,
                prompt_tokens=50 + i * 5,
                total_tokens=150 + i * 15,
            ),
            run_id=created_run.id,
            actor=default_user,
            project_id=sarah_agent.project_id,
        )

    # Update the run to trigger metrics update
    await server.run_manager.update_run_by_id_async(
        created_run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Get updated metrics
    final_metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Verify num_steps was updated
    assert final_metrics.num_steps == 3


@pytest.mark.asyncio
async def test_run_metrics_not_found(server: SyncServer, default_user):
    """Test getting metrics for non-existent run."""
    with pytest.raises(LettaInvalidArgumentError):
        await server.run_manager.get_run_metrics_async(run_id="nonexistent_run", actor=default_user)


@pytest.mark.asyncio
async def test_run_metrics_partial_update(server: SyncServer, sarah_agent, default_user):
    """Test that non-terminal updates don't calculate run_ns."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_partial"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Add a step
    await server.step_manager.log_step_async(
        agent_id=sarah_agent.id,
        provider_name="openai",
        provider_category="base",
        model="gpt-4o-mini",
        model_endpoint="https://api.openai.com/v1",
        context_window_limit=8192,
        usage=UsageStatistics(
            completion_tokens=100,
            prompt_tokens=50,
            total_tokens=150,
        ),
        run_id=created_run.id,
        actor=default_user,
        project_id=sarah_agent.project_id,
    )

    # Update to running (non-terminal)
    await server.run_manager.update_run_by_id_async(created_run.id, RunUpdate(status=RunStatus.running), actor=default_user)

    # Get metrics
    metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Verify run_ns is still None (not calculated for non-terminal updates)
    assert metrics.run_ns is None
    # But num_steps should be updated
    assert metrics.num_steps == 1


@pytest.mark.asyncio
async def test_run_metrics_integration_with_run_steps(server: SyncServer, sarah_agent, default_user):
    """Test integration between run metrics and run steps."""
    # Create a run
    run_data = PydanticRun(
        metadata={"type": "test_integration"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Add multiple steps
    step_ids = []
    for i in range(5):
        step = await server.step_manager.log_step_async(
            agent_id=sarah_agent.id,
            provider_name="openai",
            provider_category="base",
            model="gpt-4o-mini",
            model_endpoint="https://api.openai.com/v1",
            context_window_limit=8192,
            usage=UsageStatistics(
                completion_tokens=100,
                prompt_tokens=50,
                total_tokens=150,
            ),
            run_id=created_run.id,
            actor=default_user,
            project_id=sarah_agent.project_id,
        )
        step_ids.append(step.id)

    # Get run steps
    run_steps = await server.run_manager.get_run_steps(run_id=created_run.id, actor=default_user)

    # Verify steps are returned correctly
    assert len(run_steps) == 5
    assert all(step.run_id == created_run.id for step in run_steps)

    # Update run to completed
    await server.run_manager.update_run_by_id_async(
        created_run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Get final metrics
    metrics = await server.run_manager.get_run_metrics_async(run_id=created_run.id, actor=default_user)

    # Verify metrics reflect the steps
    assert metrics.num_steps == 5
    assert metrics.run_ns is not None


# TODO: add back once metrics are added

# @pytest.mark.asyncio
# async def test_record_ttft(server: SyncServer, default_user):
#    """Test recording time to first token for a job."""
#    # Create a job
#    job_data = PydanticJob(
#        status=RunStatus.created,
#        metadata={"type": "test_timing"},
#    )
#    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
#
#    # Record TTFT
#    ttft_ns = 1_500_000_000  # 1.5 seconds in nanoseconds
#    await server.job_manager.record_ttft(created_job.id, ttft_ns, default_user)
#
#    # Fetch the job and verify TTFT was recorded
#    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
#    assert updated_job.ttft_ns == ttft_ns
#
#
# @pytest.mark.asyncio
# async def test_record_response_duration(server: SyncServer, default_user):
#    """Test recording total response duration for a job."""
#    # Create a job
#    job_data = PydanticJob(
#        status=RunStatus.created,
#        metadata={"type": "test_timing"},
#    )
#    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
#
#    # Record response duration
#    duration_ns = 5_000_000_000  # 5 seconds in nanoseconds
#    await server.job_manager.record_response_duration(created_job.id, duration_ns, default_user)
#
#    # Fetch the job and verify duration was recorded
#    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
#    assert updated_job.total_duration_ns == duration_ns
#
#
# @pytest.mark.asyncio
# async def test_record_timing_metrics_together(server: SyncServer, default_user):
#    """Test recording both TTFT and response duration for a job."""
#    # Create a job
#    job_data = PydanticJob(
#        status=RunStatus.created,
#        metadata={"type": "test_timing_combined"},
#    )
#    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
#
#    # Record both metrics
#    ttft_ns = 2_000_000_000  # 2 seconds in nanoseconds
#    duration_ns = 8_500_000_000  # 8.5 seconds in nanoseconds
#
#    await server.job_manager.record_ttft(created_job.id, ttft_ns, default_user)
#    await server.job_manager.record_response_duration(created_job.id, duration_ns, default_user)
#
#    # Fetch the job and verify both metrics were recorded
#    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
#    assert updated_job.ttft_ns == ttft_ns
#    assert updated_job.total_duration_ns == duration_ns
#
#
# @pytest.mark.asyncio
# async def test_record_timing_invalid_job(server: SyncServer, default_user):
#    """Test recording timing metrics for non-existent job fails gracefully."""
#    # Try to record TTFT for non-existent job - should not raise exception but log warning
#    await server.job_manager.record_ttft("nonexistent_job_id", 1_000_000_000, default_user)
#
#    # Try to record response duration for non-existent job - should not raise exception but log warning
#    await server.job_manager.record_response_duration("nonexistent_job_id", 2_000_000_000, default_user)
#


# ======================================================================================================================
# convert_statuses_to_enum Tests
# ======================================================================================================================


def test_convert_statuses_to_enum_with_none():
    """Test that convert_statuses_to_enum returns None when input is None."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    result = convert_statuses_to_enum(None)
    assert result is None


def test_convert_statuses_to_enum_with_single_status():
    """Test converting a single status string to RunStatus enum."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    result = convert_statuses_to_enum(["completed"])
    assert result == [RunStatus.completed]
    assert len(result) == 1


def test_convert_statuses_to_enum_with_multiple_statuses():
    """Test converting multiple status strings to RunStatus enums."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    result = convert_statuses_to_enum(["created", "running", "completed"])
    assert result == [RunStatus.created, RunStatus.running, RunStatus.completed]
    assert len(result) == 3


def test_convert_statuses_to_enum_with_all_statuses():
    """Test converting all possible status strings."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    all_statuses = ["created", "running", "completed", "failed", "cancelled"]
    result = convert_statuses_to_enum(all_statuses)
    assert result == [RunStatus.created, RunStatus.running, RunStatus.completed, RunStatus.failed, RunStatus.cancelled]
    assert len(result) == 5


def test_convert_statuses_to_enum_with_empty_list():
    """Test converting an empty list."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    result = convert_statuses_to_enum([])
    assert result == []


def test_convert_statuses_to_enum_with_invalid_status():
    """Test that invalid status strings raise ValueError."""
    from letta.server.rest_api.routers.v1.runs import convert_statuses_to_enum

    with pytest.raises(ValueError):
        convert_statuses_to_enum(["invalid_status"])


@pytest.mark.asyncio
async def test_list_runs_with_multiple_statuses(server: SyncServer, sarah_agent, default_user):
    """Test listing runs with multiple status filters."""
    # Create runs with different statuses
    run_created = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            status=RunStatus.created,
            agent_id=sarah_agent.id,
            metadata={"type": "created"},
        ),
        actor=default_user,
    )
    run_running = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            status=RunStatus.running,
            agent_id=sarah_agent.id,
            metadata={"type": "running"},
        ),
        actor=default_user,
    )
    run_completed = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            status=RunStatus.completed,
            agent_id=sarah_agent.id,
            metadata={"type": "completed"},
        ),
        actor=default_user,
    )
    run_failed = await server.run_manager.create_run(
        pydantic_run=PydanticRun(
            status=RunStatus.failed,
            agent_id=sarah_agent.id,
            metadata={"type": "failed"},
        ),
        actor=default_user,
    )

    # Test filtering by multiple statuses
    active_runs = await server.run_manager.list_runs(
        actor=default_user, statuses=[RunStatus.created, RunStatus.running], agent_id=sarah_agent.id
    )
    assert len(active_runs) == 2
    assert all(run.status in [RunStatus.created, RunStatus.running] for run in active_runs)

    # Test filtering by terminal statuses
    terminal_runs = await server.run_manager.list_runs(
        actor=default_user, statuses=[RunStatus.completed, RunStatus.failed], agent_id=sarah_agent.id
    )
    assert len(terminal_runs) == 2
    assert all(run.status in [RunStatus.completed, RunStatus.failed] for run in terminal_runs)


@pytest.mark.asyncio
async def test_list_runs_with_no_status_filter_returns_all(server: SyncServer, sarah_agent, default_user):
    """Test that not providing statuses parameter returns all runs."""
    # Create runs with different statuses
    await server.run_manager.create_run(pydantic_run=PydanticRun(status=RunStatus.created, agent_id=sarah_agent.id), actor=default_user)
    await server.run_manager.create_run(pydantic_run=PydanticRun(status=RunStatus.running, agent_id=sarah_agent.id), actor=default_user)
    await server.run_manager.create_run(pydantic_run=PydanticRun(status=RunStatus.completed, agent_id=sarah_agent.id), actor=default_user)
    await server.run_manager.create_run(pydantic_run=PydanticRun(status=RunStatus.failed, agent_id=sarah_agent.id), actor=default_user)
    await server.run_manager.create_run(pydantic_run=PydanticRun(status=RunStatus.cancelled, agent_id=sarah_agent.id), actor=default_user)

    # List all runs without status filter
    all_runs = await server.run_manager.list_runs(actor=default_user, agent_id=sarah_agent.id)

    # Should return all 5 runs
    assert len(all_runs) >= 5

    # Verify we have all statuses represented
    statuses_found = {run.status for run in all_runs}
    assert RunStatus.created in statuses_found
    assert RunStatus.running in statuses_found
    assert RunStatus.completed in statuses_found
    assert RunStatus.failed in statuses_found
    assert RunStatus.cancelled in statuses_found


# ======================================================================================================================
# RunManager Tests - Duration Filtering
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_runs_by_duration_gt(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by duration greater than a threshold."""
    import asyncio

    # Create runs with different durations
    runs_data = []

    # Fast run (< 100ms)
    run_fast = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"speed": "fast"}),
        actor=default_user,
    )
    await asyncio.sleep(0.05)  # 50ms
    await server.run_manager.update_run_by_id_async(
        run_fast.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )
    runs_data.append(run_fast)

    # Medium run (~150ms)
    run_medium = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"speed": "medium"}),
        actor=default_user,
    )
    await asyncio.sleep(0.15)  # 150ms
    await server.run_manager.update_run_by_id_async(
        run_medium.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )
    runs_data.append(run_medium)

    # Slow run (~250ms)
    run_slow = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"speed": "slow"}),
        actor=default_user,
    )
    await asyncio.sleep(0.25)  # 250ms
    await server.run_manager.update_run_by_id_async(
        run_slow.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )
    runs_data.append(run_slow)

    # Filter runs with duration > 100ms (100,000,000 ns)
    filtered_runs = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        duration_filter={"value": 100_000_000, "operator": "gt"},
    )

    # Should return medium and slow runs
    assert len(filtered_runs) >= 2
    run_ids = {run.id for run in filtered_runs}
    assert run_medium.id in run_ids
    assert run_slow.id in run_ids


@pytest.mark.asyncio
async def test_list_runs_by_duration_lt(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by duration less than a threshold."""
    import asyncio

    # Create runs with different durations
    # Fast run
    run_fast = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"speed": "fast"}),
        actor=default_user,
    )
    await asyncio.sleep(0.05)  # 50ms
    await server.run_manager.update_run_by_id_async(
        run_fast.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Slow run
    run_slow = await server.run_manager.create_run(
        pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"speed": "slow"}),
        actor=default_user,
    )
    await asyncio.sleep(0.30)  # 300ms
    await server.run_manager.update_run_by_id_async(
        run_slow.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
    )

    # Get actual durations to set a threshold between them
    fast_metrics = await server.run_manager.get_run_metrics_async(run_id=run_fast.id, actor=default_user)
    slow_metrics = await server.run_manager.get_run_metrics_async(run_id=run_slow.id, actor=default_user)

    # Set threshold between the two durations
    threshold = (fast_metrics.run_ns + slow_metrics.run_ns) // 2

    # Filter runs with duration < threshold
    filtered_runs = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        duration_filter={"value": threshold, "operator": "lt"},
    )

    # Should return only the fast run
    assert len(filtered_runs) >= 1
    assert run_fast.id in [run.id for run in filtered_runs]
    # Verify slow run is not included
    assert run_slow.id not in [run.id for run in filtered_runs]


@pytest.mark.asyncio
async def test_list_runs_by_duration_percentile(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by duration percentile."""
    import asyncio

    # Create runs with varied durations
    run_ids = []
    durations_ms = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]

    for i, duration_ms in enumerate(durations_ms):
        run = await server.run_manager.create_run(
            pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"index": i}),
            actor=default_user,
        )
        await asyncio.sleep(duration_ms / 1000.0)  # Convert to seconds
        await server.run_manager.update_run_by_id_async(
            run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
        )
        run_ids.append(run.id)

    # Filter runs in top 20% (80th percentile)
    # This should return approximately the slowest 20% of runs
    filtered_runs = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        duration_percentile=80,
    )

    # Should return at least 2 runs (approximately 20% of 10)
    assert len(filtered_runs) >= 2
    # Verify the slowest run is definitely included
    filtered_ids = {run.id for run in filtered_runs}
    assert run_ids[-1] in filtered_ids  # Slowest run (500ms)

    # Verify that filtered runs are among the slower runs
    # At least one should be from the slowest 3
    slowest_3_ids = set(run_ids[-3:])
    assert len(filtered_ids & slowest_3_ids) >= 2, "Expected at least 2 of the slowest 3 runs"


@pytest.mark.asyncio
async def test_list_runs_by_duration_with_order_by(server: SyncServer, sarah_agent, default_user):
    """Test listing runs filtered by duration with different order_by options."""
    import asyncio

    # Create runs with different durations
    runs = []
    for i, duration_ms in enumerate([100, 200, 300]):
        run = await server.run_manager.create_run(
            pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"index": i}),
            actor=default_user,
        )
        await asyncio.sleep(duration_ms / 1000.0)
        await server.run_manager.update_run_by_id_async(
            run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
        )
        runs.append(run)

    # Test order_by="duration" with ascending order
    filtered_runs_asc = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        order_by="duration",
        ascending=True,
    )

    # Should be ordered from fastest to slowest
    assert len(filtered_runs_asc) >= 3
    # Get metrics to verify ordering
    metrics_asc = []
    for run in filtered_runs_asc[:3]:
        metrics = await server.run_manager.get_run_metrics_async(run_id=run.id, actor=default_user)
        metrics_asc.append(metrics.run_ns)
    # Verify ascending order
    assert metrics_asc[0] <= metrics_asc[1] <= metrics_asc[2]

    # Test order_by="duration" with descending order (default)
    filtered_runs_desc = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        order_by="duration",
        ascending=False,
    )

    # Should be ordered from slowest to fastest
    assert len(filtered_runs_desc) >= 3
    # Get metrics to verify ordering
    metrics_desc = []
    for run in filtered_runs_desc[:3]:
        metrics = await server.run_manager.get_run_metrics_async(run_id=run.id, actor=default_user)
        metrics_desc.append(metrics.run_ns)
    # Verify descending order
    assert metrics_desc[0] >= metrics_desc[1] >= metrics_desc[2]


@pytest.mark.asyncio
async def test_list_runs_combined_duration_filter_and_percentile(server: SyncServer, sarah_agent, default_user):
    """Test combining duration filter with percentile filter."""
    import asyncio

    # Create runs with varied durations
    runs = []
    for i, duration_ms in enumerate([50, 100, 150, 200, 250, 300, 350, 400]):
        run = await server.run_manager.create_run(
            pydantic_run=PydanticRun(agent_id=sarah_agent.id, metadata={"index": i}),
            actor=default_user,
        )
        await asyncio.sleep(duration_ms / 1000.0)
        await server.run_manager.update_run_by_id_async(
            run.id, RunUpdate(status=RunStatus.completed, stop_reason=StopReasonType.end_turn), actor=default_user
        )
        runs.append(run)

    # Filter runs that are:
    # 1. In top 50% slowest (duration_percentile=50)
    # 2. AND greater than 200ms (duration_filter > 200_000_000 ns)
    filtered_runs = await server.run_manager.list_runs(
        actor=default_user,
        agent_id=sarah_agent.id,
        duration_percentile=50,
        duration_filter={"value": 200_000_000, "operator": "gt"},
    )

    # Should return runs that satisfy both conditions
    assert len(filtered_runs) >= 2
    # Verify all returned runs meet both criteria
    for run in filtered_runs:
        metrics = await server.run_manager.get_run_metrics_async(run_id=run.id, actor=default_user)
        # Should be greater than 200ms
        assert metrics.run_ns > 200_000_000


@pytest.mark.asyncio
async def test_get_run_with_status_no_lettuce(server: SyncServer, sarah_agent, default_user):
    """Test getting a run without Lettuce metadata."""
    # Create a run without Lettuce metadata
    run_data = PydanticRun(
        metadata={"type": "test"},
        agent_id=sarah_agent.id,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Get run with status
    fetched_run = await server.run_manager.get_run_with_status(run_id=created_run.id, actor=default_user)

    # Verify run is returned correctly without Lettuce status check
    assert fetched_run.id == created_run.id
    assert fetched_run.status == RunStatus.created
    assert fetched_run.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_get_run_with_status_lettuce_success(server: SyncServer, sarah_agent, default_user, monkeypatch):
    """Test getting a run with Lettuce metadata and successful status fetch."""
    # Create a run with Lettuce metadata
    run_data = PydanticRun(
        metadata={"lettuce": True},
        agent_id=sarah_agent.id,
        status=RunStatus.running,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Mock LettuceClient
    mock_client = AsyncMock()
    mock_client.get_status = AsyncMock(return_value="COMPLETED")

    mock_lettuce_class = AsyncMock()
    mock_lettuce_class.create = AsyncMock(return_value=mock_client)

    # Patch LettuceClient where it's imported from
    with patch("letta.services.lettuce.LettuceClient", mock_lettuce_class):
        # Get run with status
        fetched_run = await server.run_manager.get_run_with_status(run_id=created_run.id, actor=default_user)

    # Verify status was updated from Lettuce
    assert fetched_run.id == created_run.id
    assert fetched_run.status == RunStatus.completed
    mock_client.get_status.assert_called_once_with(run_id=created_run.id)


@pytest.mark.asyncio
async def test_get_run_with_status_lettuce_failure(server: SyncServer, sarah_agent, default_user, monkeypatch):
    """Test getting a run when Lettuce status fetch fails."""
    # Create a run with Lettuce metadata
    run_data = PydanticRun(
        metadata={"lettuce": True},
        agent_id=sarah_agent.id,
        status=RunStatus.running,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Mock LettuceClient to raise an exception
    mock_lettuce_class = AsyncMock()
    mock_lettuce_class.create = AsyncMock(side_effect=Exception("Lettuce connection failed"))

    # Patch LettuceClient where it's imported from
    with patch("letta.services.lettuce.LettuceClient", mock_lettuce_class):
        # Get run with status - should gracefully handle error
        fetched_run = await server.run_manager.get_run_with_status(run_id=created_run.id, actor=default_user)

    # Verify run is returned with DB status (error was logged but not raised)
    assert fetched_run.id == created_run.id
    assert fetched_run.status == RunStatus.running  # Original status from DB


@pytest.mark.asyncio
async def test_get_run_with_status_lettuce_terminal_status(server: SyncServer, sarah_agent, default_user, monkeypatch):
    """Test that Lettuce status is not fetched for runs with terminal status."""
    # Create a run with Lettuce metadata but terminal status
    run_data = PydanticRun(
        metadata={"lettuce": True},
        agent_id=sarah_agent.id,
        status=RunStatus.completed,
    )
    created_run = await server.run_manager.create_run(pydantic_run=run_data, actor=default_user)

    # Mock LettuceClient - should not be called
    mock_client = AsyncMock()
    mock_client.get_status = AsyncMock()

    mock_lettuce_class = AsyncMock()
    mock_lettuce_class.create = AsyncMock(return_value=mock_client)

    # Patch LettuceClient where it's imported from
    with patch("letta.services.lettuce.LettuceClient", mock_lettuce_class):
        # Get run with status
        fetched_run = await server.run_manager.get_run_with_status(run_id=created_run.id, actor=default_user)

    # Verify status remains unchanged and Lettuce was not called
    assert fetched_run.id == created_run.id
    assert fetched_run.status == RunStatus.completed
    mock_client.get_status.assert_not_called()


@pytest.mark.asyncio
async def test_get_run_with_status_not_found(server: SyncServer, default_user):
    """Test getting a non-existent run with get_run_with_status."""
    # Use properly formatted run ID that doesn't exist
    non_existent_run_id = f"run-{uuid.uuid4()}"
    with pytest.raises(NoResultFound):
        await server.run_manager.get_run_with_status(run_id=non_existent_run_id, actor=default_user)
