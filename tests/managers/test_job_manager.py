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
# JobManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_job(server: SyncServer, default_user):
    """Test creating a job."""
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )

    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Assertions to ensure the created job matches the expected values
    assert created_job.user_id == default_user.id
    assert created_job.status == JobStatus.created
    assert created_job.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_get_job_by_id(server: SyncServer, default_user):
    """Test fetching a job by ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Fetch the job by ID
    fetched_job = await server.job_manager.get_job_by_id_async(created_job.id, actor=default_user)

    # Assertions to ensure the fetched job matches the created job
    assert fetched_job.id == created_job.id
    assert fetched_job.status == JobStatus.created
    assert fetched_job.metadata == {"type": "test"}


@pytest.mark.asyncio
async def test_list_jobs(server: SyncServer, default_user):
    """Test listing jobs."""
    # Create multiple jobs
    for i in range(3):
        job_data = PydanticJob(
            status=JobStatus.created,
            metadata={"type": f"test-{i}"},
        )
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # List jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user)

    # Assertions to check that the created jobs are listed
    assert len(jobs) == 3
    assert all(job.user_id == default_user.id for job in jobs)
    assert all(job.metadata["type"].startswith("test") for job in jobs)


@pytest.mark.asyncio
async def test_list_jobs_with_metadata(server: SyncServer, default_user):
    for i in range(3):
        job_data = PydanticJob(status=JobStatus.created, metadata={"source_id": f"source-test-{i}"})
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
    jobs = await server.job_manager.list_jobs_async(actor=default_user, source_id="source-test-2")
    assert len(jobs) == 1
    assert jobs[0].metadata["source_id"] == "source-test-2"


@pytest.mark.asyncio
async def test_update_job_by_id(server: SyncServer, default_user):
    """Test updating a job by its ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)
    assert created_job.metadata == {"type": "test"}

    # Update the job
    update_data = JobUpdate(status=JobStatus.completed, metadata={"type": "updated"})
    updated_job = await server.job_manager.update_job_by_id_async(created_job.id, update_data, actor=default_user)

    # Assertions to ensure the job was updated
    assert updated_job.status == JobStatus.completed
    assert updated_job.metadata == {"type": "updated"}
    assert updated_job.completed_at is not None


@pytest.mark.asyncio
async def test_delete_job_by_id(server: SyncServer, default_user):
    """Test deleting a job by its ID."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Delete the job
    await server.job_manager.delete_job_by_id_async(created_job.id, actor=default_user)

    # List jobs to ensure the job was deleted
    jobs = await server.job_manager.list_jobs_async(actor=default_user)
    assert len(jobs) == 0


@pytest.mark.asyncio
async def test_update_job_auto_complete(server: SyncServer, default_user):
    """Test that updating a job's status to 'completed' automatically sets completed_at."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Update the job's status to 'completed'
    update_data = JobUpdate(status=JobStatus.completed)
    updated_job = await server.job_manager.update_job_by_id_async(created_job.id, update_data, actor=default_user)

    # Assertions to check that completed_at was set
    assert updated_job.status == JobStatus.completed
    assert updated_job.completed_at is not None


@pytest.mark.asyncio
async def test_get_job_not_found(server: SyncServer, default_user):
    """Test fetching a non-existent job."""
    non_existent_job_id = "nonexistent-id"
    with pytest.raises(NoResultFound):
        await server.job_manager.get_job_by_id_async(non_existent_job_id, actor=default_user)


@pytest.mark.asyncio
async def test_delete_job_not_found(server: SyncServer, default_user):
    """Test deleting a non-existent job."""
    non_existent_job_id = "nonexistent-id"
    with pytest.raises(NoResultFound):
        await server.job_manager.delete_job_by_id_async(non_existent_job_id, actor=default_user)


@pytest.mark.asyncio
async def test_list_jobs_pagination(server: SyncServer, default_user):
    """Test listing jobs with pagination."""
    # Create multiple jobs
    for i in range(10):
        job_data = PydanticJob(
            status=JobStatus.created,
            metadata={"type": f"test-{i}"},
        )
        await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # List jobs with a limit
    jobs = await server.job_manager.list_jobs_async(actor=default_user, limit=5)
    assert len(jobs) == 5
    assert all(job.user_id == default_user.id for job in jobs)

    # Test cursor-based pagination
    first_page = await server.job_manager.list_jobs_async(actor=default_user, limit=3, ascending=True)  # [J0, J1, J2]
    assert len(first_page) == 3
    assert first_page[0].created_at <= first_page[1].created_at <= first_page[2].created_at

    last_page = await server.job_manager.list_jobs_async(actor=default_user, limit=3, ascending=False)  # [J9, J8, J7]
    assert len(last_page) == 3
    assert last_page[0].created_at >= last_page[1].created_at >= last_page[2].created_at
    first_page_ids = set(job.id for job in first_page)
    last_page_ids = set(job.id for job in last_page)
    assert first_page_ids.isdisjoint(last_page_ids)

    # Test middle page using both before and after
    middle_page = await server.job_manager.list_jobs_async(
        actor=default_user, before=last_page[-1].id, after=first_page[-1].id, ascending=True
    )  # [J3, J4, J5, J6]
    assert len(middle_page) == 4  # Should include jobs between first and second page
    head_tail_jobs = first_page_ids.union(last_page_ids)
    assert all(job.id not in head_tail_jobs for job in middle_page)

    # Test descending order
    middle_page_desc = await server.job_manager.list_jobs_async(
        actor=default_user, before=last_page[-1].id, after=first_page[-1].id, ascending=False
    )  # [J6, J5, J4, J3]
    assert len(middle_page_desc) == 4
    assert middle_page_desc[0].id == middle_page[-1].id
    assert middle_page_desc[1].id == middle_page[-2].id
    assert middle_page_desc[2].id == middle_page[-3].id
    assert middle_page_desc[3].id == middle_page[-4].id

    # BONUS
    job_7 = last_page[-1].id
    earliest_jobs = await server.job_manager.list_jobs_async(actor=default_user, ascending=False, before=job_7)
    assert len(earliest_jobs) == 7
    assert all(j.id not in last_page_ids for j in earliest_jobs)
    assert all(earliest_jobs[i].created_at >= earliest_jobs[i + 1].created_at for i in range(len(earliest_jobs) - 1))


@pytest.mark.asyncio
async def test_list_jobs_by_status(server: SyncServer, default_user):
    """Test listing jobs filtered by status."""
    # Create multiple jobs with different statuses
    job_data_created = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test-created"},
    )
    job_data_in_progress = PydanticJob(
        status=JobStatus.running,
        metadata={"type": "test-running"},
    )
    job_data_completed = PydanticJob(
        status=JobStatus.completed,
        metadata={"type": "test-completed"},
    )

    await server.job_manager.create_job_async(pydantic_job=job_data_created, actor=default_user)
    await server.job_manager.create_job_async(pydantic_job=job_data_in_progress, actor=default_user)
    await server.job_manager.create_job_async(pydantic_job=job_data_completed, actor=default_user)

    # List jobs filtered by status
    created_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.created])
    in_progress_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.running])
    completed_jobs = await server.job_manager.list_jobs_async(actor=default_user, statuses=[JobStatus.completed])

    # Assertions
    assert len(created_jobs) == 1
    assert created_jobs[0].metadata["type"] == job_data_created.metadata["type"]

    assert len(in_progress_jobs) == 1
    assert in_progress_jobs[0].metadata["type"] == job_data_in_progress.metadata["type"]

    assert len(completed_jobs) == 1
    assert completed_jobs[0].metadata["type"] == job_data_completed.metadata["type"]


@pytest.mark.asyncio
async def test_list_jobs_filter_by_type(server: SyncServer, default_user, default_job):
    """Test that list_jobs correctly filters by job_type."""
    # Create a run job
    run_pydantic = PydanticJob(
        user_id=default_user.id,
        status=JobStatus.pending,
        job_type=JobType.RUN,
    )
    run = await server.job_manager.create_job_async(pydantic_job=run_pydantic, actor=default_user)

    # List only regular jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user)
    assert len(jobs) == 1
    assert jobs[0].id == default_job.id

    # List only run jobs
    jobs = await server.job_manager.list_jobs_async(actor=default_user, job_type=JobType.RUN)
    assert len(jobs) == 1
    assert jobs[0].id == run.id


@pytest.mark.asyncio
async def test_list_jobs_by_stop_reason(server: SyncServer, sarah_agent, default_user):
    """Test listing jobs by stop reason."""

    run_pydantic = PydanticRun(
        user_id=default_user.id,
        status=JobStatus.pending,
        job_type=JobType.RUN,
        stop_reason=StopReasonType.requires_approval,
        agent_id=sarah_agent.id,
        background=True,
    )
    run = await server.job_manager.create_job_async(pydantic_job=run_pydantic, actor=default_user)
    assert run.stop_reason == StopReasonType.requires_approval
    assert run.background == True
    assert run.agent_id == sarah_agent.id

    # list jobs by stop reason
    jobs = await server.job_manager.list_jobs_async(actor=default_user, job_type=JobType.RUN, stop_reason=StopReasonType.requires_approval)
    assert len(jobs) == 1
    assert jobs[0].id == run.id

    # list jobs by background
    jobs = await server.job_manager.list_jobs_async(actor=default_user, job_type=JobType.RUN, background=True)
    assert len(jobs) == 1
    assert jobs[0].id == run.id

    # list jobs by agent_id
    jobs = await server.job_manager.list_jobs_async(actor=default_user, job_type=JobType.RUN, agent_ids=[sarah_agent.id])
    assert len(jobs) == 1
    assert jobs[0].id == run.id


async def test_e2e_job_callback(monkeypatch, server: SyncServer, default_user):
    """Test that job callbacks are properly dispatched when a job is completed."""
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
    import letta.services.job_manager as job_manager_module

    monkeypatch.setattr(job_manager_module, "AsyncClient", MockAsyncClient)

    job_in = PydanticJob(status=JobStatus.created, metadata={"foo": "bar"}, callback_url="http://example.test/webhook/jobs")
    created = await server.job_manager.create_job_async(pydantic_job=job_in, actor=default_user)
    assert created.callback_url == "http://example.test/webhook/jobs"

    # Update the job status to completed, which should trigger the callback
    update = JobUpdate(status=JobStatus.completed)
    updated = await server.job_manager.update_job_by_id_async(created.id, update, actor=default_user)

    # Verify the callback was triggered with the correct parameters
    assert captured["url"] == created.callback_url, "Callback URL doesn't match"
    assert captured["json"]["job_id"] == created.id, "Job ID in callback doesn't match"
    assert captured["json"]["status"] == JobStatus.completed.value, "Job status in callback doesn't match"

    # Verify the completed_at timestamp is reasonable
    actual_dt = datetime.fromisoformat(captured["json"]["completed_at"]).replace(tzinfo=None)
    assert abs((actual_dt - updated.completed_at).total_seconds()) < 1, "Timestamp difference is too large"

    assert isinstance(updated.callback_sent_at, datetime)
    assert updated.callback_status_code == 202


# ======================================================================================================================
# JobManager Tests - Messages
# ======================================================================================================================


@pytest.mark.asyncio
async def test_job_messages_add(server: SyncServer, default_run, hello_world_message_fixture, default_user):
    """Test adding a message to a job."""
    # Add message to job
    await server.job_manager.add_messages_to_job_async(
        job_id=default_run.id,
        message_ids=[hello_world_message_fixture.id],
        actor=default_user,
    )

    # Verify message was added
    messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )
    assert len(messages) == 1
    assert messages[0].id == hello_world_message_fixture.id
    assert messages[0].content[0].text == hello_world_message_fixture.content[0].text


@pytest.mark.asyncio
async def test_job_messages_pagination(server: SyncServer, default_run, default_user, sarah_agent):
    """Test pagination of job messages."""
    # Create multiple messages
    message_ids = []
    for i in range(5):
        message = PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.user,
            content=[TextContent(text=f"Test message {i}")],
        )
        msg = await server.message_manager.create_many_messages_async([message], actor=default_user)
        message_ids.append(msg[0].id)

        # Add message to job
        await server.job_manager.add_messages_to_job_async(
            job_id=default_run.id,
            message_ids=[msg[0].id],
            actor=default_user,
        )

    # Test pagination with limit
    messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        limit=2,
    )
    assert len(messages) == 2
    assert messages[0].id == message_ids[0]
    assert messages[1].id == message_ids[1]

    # Test pagination with cursor
    first_page = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        limit=2,
        ascending=True,  # [M0, M1]
    )
    assert len(first_page) == 2
    assert first_page[0].id == message_ids[0]
    assert first_page[1].id == message_ids[1]
    assert first_page[0].created_at <= first_page[1].created_at

    last_page = await server.job_manager.get_job_messages(
        job_id=default_run.id,
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
    middle_page = await server.job_manager.get_job_messages(
        job_id=default_run.id,
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
    middle_page = await server.job_manager.get_job_messages(
        job_id=default_run.id,
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
    earliest_msgs = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=False,
        before=msg_3,  # Get messages after M3 in descending order
    )
    assert len(earliest_msgs) == 3  # Should get M2, M1, M0
    assert all(m.id not in last_page_ids for m in earliest_msgs)
    assert earliest_msgs[0].created_at > earliest_msgs[1].created_at > earliest_msgs[2].created_at

    # Test getting earliest messages with ascending order
    earliest_msgs_ascending = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=True,
        before=msg_3,  # Get messages before M3 in ascending order
    )
    assert len(earliest_msgs_ascending) == 3  # Should get M0, M1, M2
    assert all(m.id not in last_page_ids for m in earliest_msgs_ascending)
    assert earliest_msgs_ascending[0].created_at < earliest_msgs_ascending[1].created_at < earliest_msgs_ascending[2].created_at


@pytest.mark.asyncio
async def test_job_messages_ordering(server: SyncServer, default_run, default_user, sarah_agent):
    """Test that messages are ordered by created_at."""
    # Create messages with different timestamps
    base_time = datetime.now(timezone.utc)
    message_times = [
        base_time - timedelta(minutes=2),
        base_time - timedelta(minutes=1),
        base_time,
    ]

    for i, created_at in enumerate(message_times):
        message = PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Test message")],
            agent_id=sarah_agent.id,
            created_at=created_at,
        )
        msg = await server.message_manager.create_many_messages_async([message], actor=default_user)

        # Add message to job
        await server.job_manager.add_messages_to_job_async(
            job_id=default_run.id,
            message_ids=[msg[0].id],
            actor=default_user,
        )

    # Verify messages are returned in chronological order
    returned_messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at < returned_messages[1].created_at
    assert returned_messages[1].created_at < returned_messages[2].created_at

    # Verify messages are returned in descending order
    returned_messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
        ascending=False,
    )

    assert len(returned_messages) == 3
    assert returned_messages[0].created_at > returned_messages[1].created_at
    assert returned_messages[1].created_at > returned_messages[2].created_at


@pytest.mark.asyncio
async def test_job_messages_empty(server: SyncServer, default_run, default_user):
    """Test getting messages for a job with no messages."""
    messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )
    assert len(messages) == 0


@pytest.mark.asyncio
async def test_job_messages_add_duplicate(server: SyncServer, default_run, hello_world_message_fixture, default_user):
    """Test adding the same message to a job twice."""
    # Add message to job first time
    await server.job_manager.add_messages_to_job_async(
        job_id=default_run.id,
        message_ids=[hello_world_message_fixture.id],
        actor=default_user,
    )

    # Attempt to add same message again
    with pytest.raises(IntegrityError):
        await server.job_manager.add_messages_to_job_async(
            job_id=default_run.id,
            message_ids=[hello_world_message_fixture.id],
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_job_messages_filter(server: SyncServer, default_run, default_user, sarah_agent):
    """Test getting messages associated with a job."""
    # Create test messages with different roles and tool calls
    messages = [
        PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Hello")],
            agent_id=sarah_agent.id,
        ),
        PydanticMessage(
            role=MessageRole.assistant,
            content=[TextContent(text="Hi there!")],
            agent_id=sarah_agent.id,
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
        ),
    ]

    # Add messages to job
    for msg in messages:
        created_msg = await server.message_manager.create_many_messages_async([msg], actor=default_user)
        await server.job_manager.add_messages_to_job_async(
            job_id=default_run.id,
            message_ids=[created_msg[0].id],
            actor=default_user,
        )

    # Test getting all messages
    all_messages = await server.job_manager.get_job_messages(
        job_id=default_run.id,
        actor=default_user,
    )
    assert len(all_messages) == 3

    # Test filtering by role
    user_messages = await server.job_manager.get_job_messages(job_id=default_run.id, actor=default_user, role=MessageRole.user)
    assert len(user_messages) == 1
    assert user_messages[0].role == MessageRole.user

    # Test limit
    limited_messages = await server.job_manager.get_job_messages(job_id=default_run.id, actor=default_user, limit=2)
    assert len(limited_messages) == 2


@pytest.mark.asyncio
async def test_get_run_messages(server: SyncServer, default_user: PydanticUser, sarah_agent):
    """Test getting messages for a run with request config."""
    # Create a run with custom request config
    run = await server.job_manager.create_job_async(
        pydantic_job=PydanticRun(
            user_id=default_user.id,
            status=JobStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=False, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.tool if i % 2 == 0 else MessageRole.assistant,
            content=[TextContent(text=f"Test message {i}" if i % 2 == 1 else '{"status": "OK"}')],
            tool_calls=(
                [{"type": "function", "id": f"call_{i // 2}", "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'}}]
                if i % 2 == 1
                else None
            ),
            tool_call_id=f"call_{i // 2}" if i % 2 == 0 else None,
        )
        for i in range(4)
    ]

    created_msg = await server.message_manager.create_many_messages_async(messages, actor=default_user)
    for msg in created_msg:
        await server.job_manager.add_messages_to_job_async(
            job_id=run.id,
            message_ids=[msg.id],
            actor=default_user,
        )

    # Get messages and verify they're converted correctly
    result = await server.job_manager.get_run_messages(run_id=run.id, actor=default_user)

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
    run = await server.job_manager.create_job_async(
        pydantic_job=PydanticRun(
            user_id=default_user.id,
            status=JobStatus.created,
            request_config=LettaRequestConfig(
                use_assistant_message=True, assistant_message_tool_name="custom_tool", assistant_message_tool_kwarg="custom_arg"
            ),
        ),
        actor=default_user,
    )

    # Add some messages
    messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role=MessageRole.tool if i % 2 == 0 else MessageRole.assistant,
            content=[TextContent(text=f"Test message {i}" if i % 2 == 1 else '{"status": "OK"}')],
            tool_calls=(
                [{"type": "function", "id": f"call_{i // 2}", "function": {"name": "custom_tool", "arguments": '{"custom_arg": "test"}'}}]
                if i % 2 == 1
                else None
            ),
            tool_call_id=f"call_{i // 2}" if i % 2 == 0 else None,
        )
        for i in range(4)
    ]

    created_msg = await server.message_manager.create_many_messages_async(messages, actor=default_user)
    for msg in created_msg:
        await server.job_manager.add_messages_to_job_async(
            job_id=run.id,
            message_ids=[msg.id],
            actor=default_user,
        )

    # Get messages and verify they're converted correctly
    result = await server.job_manager.get_run_messages(run_id=run.id, actor=default_user)

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
# JobManager Tests - Usage Statistics -
# ======================================================================================================================

# TODO: add these back after runs refactor

# @pytest.mark.asyncio
# async def test_job_usage_stats_add_and_get(server: SyncServer, sarah_agent, default_job, default_user):
#    """Test adding and retrieving job usage statistics."""
#    job_manager = server.job_manager
#    step_manager = server.step_manager
#
#    # Add usage statistics
#    await step_manager.log_step_async(
#        agent_id=sarah_agent.id,
#        provider_name="openai",
#        provider_category="base",
#        model="gpt-4o-mini",
#        model_endpoint="https://api.openai.com/v1",
#        context_window_limit=8192,
#        job_id=default_job.id,
#        usage=UsageStatistics(
#            completion_tokens=100,
#            prompt_tokens=50,
#            total_tokens=150,
#        ),
#        actor=default_user,
#        project_id=sarah_agent.project_id,
#    )
#
#    # Get usage statistics
#    usage_stats = await job_manager.get_job_usage_async(job_id=default_job.id, actor=default_user)
#
#    # Verify the statistics
#    assert usage_stats.completion_tokens == 100
#    assert usage_stats.prompt_tokens == 50
#    assert usage_stats.total_tokens == 150
#
#    # get steps
#    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
#    assert len(steps) == 1
#
#
# @pytest.mark.asyncio
# async def test_job_usage_stats_get_no_stats(server: SyncServer, default_job, default_user):
#    """Test getting usage statistics for a job with no stats."""
#    job_manager = server.job_manager
#
#    # Get usage statistics for a job with no stats
#    usage_stats = await job_manager.get_job_usage(job_id=default_job.id, actor=default_user)
#
#    # Verify default values
#    assert usage_stats.completion_tokens == 0
#    assert usage_stats.prompt_tokens == 0
#    assert usage_stats.total_tokens == 0
#
#    # get steps
#    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
#    assert len(steps) == 0
#
#
# @pytest.mark.asyncio
# async def test_job_usage_stats_add_multiple(server: SyncServer, sarah_agent, default_job, default_user):
#    """Test adding multiple usage statistics entries for a job."""
#    job_manager = server.job_manager
#    step_manager = server.step_manager
#
#    # Add first usage statistics entry
#    await step_manager.log_step_async(
#        agent_id=sarah_agent.id,
#        provider_name="openai",
#        provider_category="base",
#        model="gpt-4o-mini",
#        model_endpoint="https://api.openai.com/v1",
#        context_window_limit=8192,
#        job_id=default_job.id,
#        usage=UsageStatistics(
#            completion_tokens=100,
#            prompt_tokens=50,
#            total_tokens=150,
#        ),
#        actor=default_user,
#        project_id=sarah_agent.project_id,
#    )
#
#    # Add second usage statistics entry
#    await step_manager.log_step_async(
#        agent_id=sarah_agent.id,
#        provider_name="openai",
#        provider_category="base",
#        model="gpt-4o-mini",
#        model_endpoint="https://api.openai.com/v1",
#        context_window_limit=8192,
#        job_id=default_job.id,
#        usage=UsageStatistics(
#            completion_tokens=200,
#            prompt_tokens=100,
#            total_tokens=300,
#        ),
#        actor=default_user,
#        project_id=sarah_agent.project_id,
#    )
#
#    # Get usage statistics (should return the latest entry)
#    usage_stats = job_manager.get_job_usage(job_id=default_job.id, actor=default_user)
#
#    # Verify we get the most recent statistics
#    assert usage_stats.completion_tokens == 300
#    assert usage_stats.prompt_tokens == 150
#    assert usage_stats.total_tokens == 450
#    assert usage_stats.step_count == 2
#
#    # get steps
#    steps = job_manager.get_job_steps(job_id=default_job.id, actor=default_user)
#    assert len(steps) == 2
#
#    # get agent steps
#    steps = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
#    assert len(steps) == 2
#
#    # add step feedback
#    step_manager = server.step_manager
#
#    # Add feedback to first step
#    await step_manager.add_feedback_async(step_id=steps[0].id, feedback=FeedbackType.POSITIVE, actor=default_user)
#
#    # Test has_feedback filtering
#    steps_with_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, has_feedback=True, actor=default_user)
#    assert len(steps_with_feedback) == 1
#
#    steps_without_feedback = await step_manager.list_steps_async(agent_id=sarah_agent.id, actor=default_user)
#    assert len(steps_without_feedback) == 2
#


# @pytest.mark.asyncio
# async def test_job_usage_stats_get_nonexistent_job(server: SyncServer, default_user):
#    """Test getting usage statistics for a nonexistent job."""
#    job_manager = server.job_manager
#
#    with pytest.raises(NoResultFound):
#        job_manager.get_job_usage(job_id="nonexistent_job", actor=default_user)


@pytest.mark.asyncio
async def test_record_ttft(server: SyncServer, default_user):
    """Test recording time to first token for a job."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test_timing"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Record TTFT
    ttft_ns = 1_500_000_000  # 1.5 seconds in nanoseconds
    await server.job_manager.record_ttft(created_job.id, ttft_ns, default_user)

    # Fetch the job and verify TTFT was recorded
    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
    assert updated_job.ttft_ns == ttft_ns


@pytest.mark.asyncio
async def test_record_response_duration(server: SyncServer, default_user):
    """Test recording total response duration for a job."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test_timing"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Record response duration
    duration_ns = 5_000_000_000  # 5 seconds in nanoseconds
    await server.job_manager.record_response_duration(created_job.id, duration_ns, default_user)

    # Fetch the job and verify duration was recorded
    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
    assert updated_job.total_duration_ns == duration_ns


@pytest.mark.asyncio
async def test_record_timing_metrics_together(server: SyncServer, default_user):
    """Test recording both TTFT and response duration for a job."""
    # Create a job
    job_data = PydanticJob(
        status=JobStatus.created,
        metadata={"type": "test_timing_combined"},
    )
    created_job = await server.job_manager.create_job_async(pydantic_job=job_data, actor=default_user)

    # Record both metrics
    ttft_ns = 2_000_000_000  # 2 seconds in nanoseconds
    duration_ns = 8_500_000_000  # 8.5 seconds in nanoseconds

    await server.job_manager.record_ttft(created_job.id, ttft_ns, default_user)
    await server.job_manager.record_response_duration(created_job.id, duration_ns, default_user)

    # Fetch the job and verify both metrics were recorded
    updated_job = await server.job_manager.get_job_by_id_async(created_job.id, default_user)
    assert updated_job.ttft_ns == ttft_ns
    assert updated_job.total_duration_ns == duration_ns


@pytest.mark.asyncio
async def test_record_timing_invalid_job(server: SyncServer, default_user):
    """Test recording timing metrics for non-existent job fails gracefully."""
    # Try to record TTFT for non-existent job - should not raise exception but log warning
    await server.job_manager.record_ttft("nonexistent_job_id", 1_000_000_000, default_user)

    # Try to record response duration for non-existent job - should not raise exception but log warning
    await server.job_manager.record_response_duration("nonexistent_job_id", 2_000_000_000, default_user)
