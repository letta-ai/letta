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
# AgentManager Tests - Tools Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_tool(server: SyncServer, sarah_agent, print_tool, default_user):
    """Test attaching a tool to an agent."""
    # Attach the tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify attachment through get_agent_by_id
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]

    # Verify that attaching the same tool again doesn't cause duplication
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == print_tool.id]) == 1


@pytest.mark.asyncio
async def test_detach_tool(server: SyncServer, sarah_agent, print_tool, default_user):
    """Test detaching a tool from an agent."""
    # Attach the tool first
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify it's attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]

    # Detach the tool
    await server.agent_manager.detach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Verify it's detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]

    # Verify that detaching an already detached tool doesn't cause issues
    await server.agent_manager.detach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)


@pytest.mark.asyncio
async def test_bulk_detach_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test bulk detaching multiple tools from an agent."""
    # First attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]
    assert other_tool.id in [t.id for t in agent.tools]

    # Bulk detach both tools
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]
    assert other_tool.id not in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_partial(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test bulk detaching tools when some are not attached."""
    # Only attach one tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Try to bulk detach both tools (one attached, one not)
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify the attached tool was detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id not in [t.id for t in agent.tools]
    assert other_tool.id not in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_empty_list(server: SyncServer, sarah_agent, print_tool, default_user):
    """Test bulk detaching empty list of tools."""
    # Attach a tool first
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Bulk detach empty list
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=[], actor=default_user)

    # Verify the tool is still attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert print_tool.id in [t.id for t in agent.tools]


@pytest.mark.asyncio
async def test_bulk_detach_tools_idempotent(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test that bulk detach is idempotent."""
    # Attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Bulk detach once
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify tools are detached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0

    # Bulk detach again (should be no-op, no errors)
    await server.agent_manager.bulk_detach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify still no tools
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_detach_tools_nonexistent_agent(server: SyncServer, print_tool, other_tool, default_user):
    """Test bulk detaching tools from a nonexistent agent."""
    nonexistent_agent_id = "nonexistent-agent-id"
    tool_ids = [print_tool.id, other_tool.id]

    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.bulk_detach_tools_async(agent_id=nonexistent_agent_id, tool_ids=tool_ids, actor=default_user)


async def test_attach_tool_nonexistent_agent(server: SyncServer, print_tool, default_user):
    """Test attaching a tool to a nonexistent agent."""
    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.attach_tool_async(agent_id="nonexistent-agent-id", tool_id=print_tool.id, actor=default_user)


async def test_attach_tool_nonexistent_tool(server: SyncServer, sarah_agent, default_user):
    """Test attaching a nonexistent tool to an agent."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id="nonexistent-tool-id", actor=default_user)


async def test_detach_tool_nonexistent_agent(server: SyncServer, print_tool, default_user):
    """Test detaching a tool from a nonexistent agent."""
    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.detach_tool_async(agent_id="nonexistent-agent-id", tool_id=print_tool.id, actor=default_user)


@pytest.mark.asyncio
async def test_list_attached_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test listing tools attached to an agent."""
    # Initially should have no tools
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0

    # Attach tools
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=other_tool.id, actor=default_user)

    # List tools and verify
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert len(attached_tool_ids) == 2
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids


@pytest.mark.asyncio
async def test_bulk_attach_tools(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test bulk attaching multiple tools to an agent."""
    # Bulk attach both tools
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids


@pytest.mark.asyncio
async def test_bulk_attach_tools_with_duplicates(server: SyncServer, sarah_agent, print_tool, other_tool, default_user):
    """Test bulk attaching tools handles duplicates correctly."""
    # First attach one tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Bulk attach both tools (one already attached)
    tool_ids = [print_tool.id, other_tool.id]
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify both tools are attached and no duplicates
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    attached_tool_ids = [t.id for t in agent.tools]
    assert len(attached_tool_ids) == 2
    assert print_tool.id in attached_tool_ids
    assert other_tool.id in attached_tool_ids
    # Ensure no duplicates
    assert len(set(attached_tool_ids)) == len(attached_tool_ids)


@pytest.mark.asyncio
async def test_bulk_attach_tools_empty_list(server: SyncServer, sarah_agent, default_user):
    """Test bulk attaching empty list of tools."""
    # Bulk attach empty list
    await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=[], actor=default_user)

    # Verify no tools are attached
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_attach_tools_nonexistent_tool(server: SyncServer, sarah_agent, print_tool, default_user):
    """Test bulk attaching tools with a nonexistent tool ID."""
    # Try to bulk attach with one valid and one invalid tool ID
    nonexistent_id = "nonexistent-tool-id"
    tool_ids = [print_tool.id, nonexistent_id]

    with pytest.raises(NoResultFound) as exc_info:
        await server.agent_manager.bulk_attach_tools_async(agent_id=sarah_agent.id, tool_ids=tool_ids, actor=default_user)

    # Verify error message contains the missing tool ID
    assert nonexistent_id in str(exc_info.value)

    # Verify no tools were attached (transaction should have rolled back)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len(agent.tools) == 0


@pytest.mark.asyncio
async def test_bulk_attach_tools_nonexistent_agent(server: SyncServer, print_tool, other_tool, default_user):
    """Test bulk attaching tools to a nonexistent agent."""
    nonexistent_agent_id = "nonexistent-agent-id"
    tool_ids = [print_tool.id, other_tool.id]

    with pytest.raises(LettaAgentNotFoundError):
        await server.agent_manager.bulk_attach_tools_async(agent_id=nonexistent_agent_id, tool_ids=tool_ids, actor=default_user)


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async(server: SyncServer, sarah_agent, default_user):
    """Test attaching missing file tools to an agent."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state (should have no file tools)
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    initial_tool_count = len(agent_state.tools)

    # Attach missing file tools
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are now attached
    file_tool_names = {tool.name for tool in updated_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)

    # Verify the total tool count increased by the number of file tools
    assert len(updated_agent_state.tools) == initial_tool_count + len(FILES_TOOLS)


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async_partial(server: SyncServer, sarah_agent, default_user):
    """Test attaching missing file tools when some are already attached."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get file tool IDs
    all_tools = await server.tool_manager.list_tools_async(actor=default_user)
    file_tools = [tool for tool in all_tools if tool.tool_type == ToolType.LETTA_FILES_CORE and tool.name in FILES_TOOLS]

    # Manually attach just the first file tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=file_tools[0].id, actor=default_user)

    # Get agent state with one file tool already attached
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 1

    # Attach missing file tools
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are now attached
    file_tool_names = {tool.name for tool in updated_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)

    # Verify no duplicates
    all_tool_ids = [tool.id for tool in updated_agent_state.tools]
    assert len(all_tool_ids) == len(set(all_tool_ids))


@pytest.mark.asyncio
async def test_attach_missing_files_tools_async_idempotent(server: SyncServer, sarah_agent, default_user):
    """Test that attach_missing_files_tools is idempotent."""
    # First ensure file tools exist in the system
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)

    # Attach missing file tools the first time
    updated_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)
    first_tool_count = len(updated_agent_state.tools)

    # Call attach_missing_files_tools again (should be no-op)
    final_agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=updated_agent_state, actor=default_user)

    # Verify tool count didn't change
    assert len(final_agent_state.tools) == first_tool_count

    # Verify still have all file tools
    file_tool_names = {tool.name for tool in final_agent_state.tools if tool.tool_type == ToolType.LETTA_FILES_CORE}
    assert file_tool_names == set(FILES_TOOLS)


@pytest.mark.asyncio
async def test_detach_all_files_tools_async(server: SyncServer, sarah_agent, default_user):
    """Test detaching all file tools from an agent."""
    # First ensure file tools exist and attach them
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify file tools are attached
    file_tool_count_before = len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count_before == len(FILES_TOOLS)

    # Detach all file tools
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify all file tools are detached
    file_tool_count_after = len([t for t in updated_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count_after == 0

    # Verify the returned state was modified in-place (no DB reload)
    assert updated_agent_state.id == agent_state.id
    assert len(updated_agent_state.tools) == len(agent_state.tools) - file_tool_count_before


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_empty(server: SyncServer, sarah_agent, default_user):
    """Test detaching all file tools when no file tools are attached."""
    # Get agent state (should have no file tools initially)
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    initial_tool_count = len(agent_state.tools)

    # Verify no file tools attached
    file_tool_count = len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE])
    assert file_tool_count == 0

    # Call detach_all_files_tools (should be no-op)
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify nothing changed
    assert len(updated_agent_state.tools) == initial_tool_count
    assert updated_agent_state == agent_state  # Should be the same object since no changes


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_with_other_tools(server: SyncServer, sarah_agent, print_tool, default_user):
    """Test detaching all file tools preserves non-file tools."""
    # First ensure file tools exist
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Attach a non-file tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=print_tool.id, actor=default_user)

    # Get agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify both file tools and print tool are attached
    file_tools = [t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]
    assert len(file_tools) == len(FILES_TOOLS)
    assert print_tool.id in [t.id for t in agent_state.tools]

    # Detach all file tools
    updated_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify only file tools were removed, print tool remains
    remaining_file_tools = [t for t in updated_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]
    assert len(remaining_file_tools) == 0
    assert print_tool.id in [t.id for t in updated_agent_state.tools]
    assert len(updated_agent_state.tools) == 1


@pytest.mark.asyncio
async def test_detach_all_files_tools_async_idempotent(server: SyncServer, sarah_agent, default_user):
    """Test that detach_all_files_tools is idempotent."""
    # First ensure file tools exist and attach them
    await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={ToolType.LETTA_FILES_CORE})

    # Get initial agent state and attach file tools
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    agent_state = await server.agent_manager.attach_missing_files_tools_async(agent_state=agent_state, actor=default_user)

    # Detach all file tools once
    agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify no file tools
    assert len([t for t in agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 0
    tool_count_after_first = len(agent_state.tools)

    # Detach all file tools again (should be no-op)
    final_agent_state = await server.agent_manager.detach_all_files_tools_async(agent_state=agent_state, actor=default_user)

    # Verify still no file tools and same tool count
    assert len([t for t in final_agent_state.tools if t.tool_type == ToolType.LETTA_FILES_CORE]) == 0
    assert len(final_agent_state.tools) == tool_count_after_first


@pytest.mark.asyncio
async def test_attach_tool_with_default_requires_approval(server: SyncServer, sarah_agent, bash_tool, default_user):
    """Test that attaching a tool with default requires_approval adds associated tool rule."""
    # Attach the tool
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=bash_tool.id, actor=default_user)

    # Verify attachment through get_agent_by_id
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert bash_tool.id in [t.id for t in agent.tools]
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 1
    assert tool_rules[0].type == "requires_approval"

    # Verify that attaching the same tool again doesn't cause duplication
    await server.agent_manager.attach_tool_async(agent_id=sarah_agent.id, tool_id=bash_tool.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == bash_tool.id]) == 1
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 1
    assert tool_rules[0].type == "requires_approval"


@pytest.mark.asyncio
async def test_attach_tool_with_default_requires_approval_on_creation(server: SyncServer, bash_tool, default_user):
    """Test that attaching a tool with default requires_approval adds associated tool rule."""
    # Create agent with tool
    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="agent11",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tools=[bash_tool.name],
            include_base_tools=False,
        ),
        actor=default_user,
    )

    assert bash_tool.id in [t.id for t in agent.tools]
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 1
    assert tool_rules[0].type == "requires_approval"

    # Verify that attaching the same tool again doesn't cause duplication
    await server.agent_manager.attach_tool_async(agent_id=agent.id, tool_id=bash_tool.id, actor=default_user)
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == bash_tool.id]) == 1
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 1
    assert tool_rules[0].type == "requires_approval"

    # Modify approval on tool after attach
    await server.agent_manager.modify_approvals_async(
        agent_id=agent.id, tool_name=bash_tool.name, requires_approval=False, actor=default_user
    )
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == bash_tool.id]) == 1
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 0

    # Revert override
    await server.agent_manager.modify_approvals_async(
        agent_id=agent.id, tool_name=bash_tool.name, requires_approval=True, actor=default_user
    )
    agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
    assert len([t for t in agent.tools if t.id == bash_tool.id]) == 1
    tool_rules = [rule for rule in agent.tool_rules if rule.tool_name == bash_tool.name]
    assert len(tool_rules) == 1
    assert tool_rules[0].type == "requires_approval"


# ======================================================================================================================
# ToolManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_tool(server: SyncServer, print_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert print_tool.created_by_id == default_user.id
    assert print_tool.tool_type == ToolType.CUSTOM


@pytest.mark.asyncio
async def test_create_mcp_tool(server: SyncServer, mcp_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert mcp_tool.created_by_id == default_user.id
    assert mcp_tool.tool_type == ToolType.EXTERNAL_MCP
    assert mcp_tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_name"] == "test"
    assert mcp_tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_id"] == "test-server-id"


# Test should work with both SQLite and PostgreSQL
@pytest.mark.asyncio
async def test_create_tool_duplicate_name(server: SyncServer, print_tool, default_user, default_organization):
    data = print_tool.model_dump(exclude=["id"])
    tool = PydanticTool(**data)

    with pytest.raises(UniqueConstraintViolationError):
        await server.tool_manager.create_tool_async(tool, actor=default_user)


@pytest.mark.asyncio
async def test_create_tool_requires_approval(server: SyncServer, bash_tool, default_user, default_organization):
    # Assertions to ensure the created tool matches the expected values
    assert bash_tool.created_by_id == default_user.id
    assert bash_tool.tool_type == ToolType.CUSTOM
    assert bash_tool.default_requires_approval == True


@pytest.mark.asyncio
async def test_get_tool_by_id(server: SyncServer, print_tool, default_user):
    # Fetch the tool by ID using the manager method
    fetched_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)

    # Assertions to check if the fetched tool matches the created tool
    assert fetched_tool.id == print_tool.id
    assert fetched_tool.name == print_tool.name
    assert fetched_tool.description == print_tool.description
    assert fetched_tool.tags == print_tool.tags
    assert fetched_tool.metadata_ == print_tool.metadata_
    assert fetched_tool.source_code == print_tool.source_code
    assert fetched_tool.source_type == print_tool.source_type
    assert fetched_tool.tool_type == ToolType.CUSTOM


@pytest.mark.asyncio
async def test_get_tool_with_actor(server: SyncServer, print_tool, default_user):
    # Fetch the print_tool by name and organization ID
    fetched_tool = await server.tool_manager.get_tool_by_name_async(print_tool.name, actor=default_user)

    # Assertions to check if the fetched tool matches the created tool
    assert fetched_tool.id == print_tool.id
    assert fetched_tool.name == print_tool.name
    assert fetched_tool.created_by_id == default_user.id
    assert fetched_tool.description == print_tool.description
    assert fetched_tool.tags == print_tool.tags
    assert fetched_tool.source_code == print_tool.source_code
    assert fetched_tool.source_type == print_tool.source_type
    assert fetched_tool.tool_type == ToolType.CUSTOM


@pytest.mark.asyncio
async def test_list_tools(server: SyncServer, print_tool, default_user):
    # List tools (should include the one created by the fixture)
    tools = await server.tool_manager.list_tools_async(actor=default_user, upsert_base_tools=False)

    # Assertions to check that the created tool is listed
    assert len(tools) == 1
    assert any(t.id == print_tool.id for t in tools)


@pytest.mark.asyncio
async def test_list_tools_with_tool_types(server: SyncServer, default_user):
    """Test filtering tools by tool_types parameter."""

    # create tools with different types
    def calculator_tool(a: int, b: int) -> int:
        """Add two numbers.

        Args:
            a: First number
            b: Second number

        Returns:
            Sum of a and b
        """
        return a + b

    def weather_tool(city: str) -> str:
        """Get weather for a city.

        Args:
            city: Name of the city

        Returns:
            Weather information
        """
        return f"Weather in {city}"

    # create custom tools
    custom_tool1 = PydanticTool(
        name="calculator",
        description="Math tool",
        source_code=parse_source_code(calculator_tool),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    custom_tool1.json_schema = derive_openai_json_schema(source_code=custom_tool1.source_code, name=custom_tool1.name)
    custom_tool1 = await server.tool_manager.create_or_update_tool_async(custom_tool1, actor=default_user)

    custom_tool2 = PydanticTool(
        name="weather",
        description="Weather tool",
        source_code=parse_source_code(weather_tool),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    custom_tool2.json_schema = derive_openai_json_schema(source_code=custom_tool2.source_code, name=custom_tool2.name)
    custom_tool2 = await server.tool_manager.create_or_update_tool_async(custom_tool2, actor=default_user)

    # test filtering by single tool type
    tools = await server.tool_manager.list_tools_async(actor=default_user, tool_types=[ToolType.CUSTOM.value], upsert_base_tools=False)
    assert len(tools) == 2
    assert all(t.tool_type == ToolType.CUSTOM for t in tools)

    # test filtering by multiple tool types (should get same result since we only have CUSTOM)
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, tool_types=[ToolType.CUSTOM.value, ToolType.LETTA_CORE.value], upsert_base_tools=False
    )
    assert len(tools) == 2

    # test filtering by non-existent tool type
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, tool_types=[ToolType.EXTERNAL_MCP.value], upsert_base_tools=False
    )
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_list_tools_with_exclude_tool_types(server: SyncServer, default_user, print_tool):
    """Test excluding tools by exclude_tool_types parameter."""
    # we already have print_tool which is CUSTOM type

    # create a tool with a different type (simulate by updating tool type directly)
    def special_tool(msg: str) -> str:
        """Special tool.

        Args:
            msg: Message to return

        Returns:
            The message
        """
        return msg

    special = PydanticTool(
        name="special",
        description="Special tool",
        source_code=parse_source_code(special_tool),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    special.json_schema = derive_openai_json_schema(source_code=special.source_code, name=special.name)
    special = await server.tool_manager.create_or_update_tool_async(special, actor=default_user)

    # test excluding EXTERNAL_MCP (should get all tools since none are MCP)
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, exclude_tool_types=[ToolType.EXTERNAL_MCP.value], upsert_base_tools=False
    )
    assert len(tools) == 2  # print_tool and special

    # test excluding CUSTOM (should get no tools)
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, exclude_tool_types=[ToolType.CUSTOM.value], upsert_base_tools=False
    )
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_list_tools_with_names(server: SyncServer, default_user):
    """Test filtering tools by names parameter."""

    # create tools with specific names
    def alpha_tool() -> str:
        """Alpha tool.

        Returns:
            Alpha string
        """
        return "alpha"

    def beta_tool() -> str:
        """Beta tool.

        Returns:
            Beta string
        """
        return "beta"

    def gamma_tool() -> str:
        """Gamma tool.

        Returns:
            Gamma string
        """
        return "gamma"

    alpha = PydanticTool(name="alpha_tool", description="Alpha", source_code=parse_source_code(alpha_tool), source_type="python")
    alpha.json_schema = derive_openai_json_schema(source_code=alpha.source_code, name=alpha.name)
    alpha = await server.tool_manager.create_or_update_tool_async(alpha, actor=default_user)

    beta = PydanticTool(name="beta_tool", description="Beta", source_code=parse_source_code(beta_tool), source_type="python")
    beta.json_schema = derive_openai_json_schema(source_code=beta.source_code, name=beta.name)
    beta = await server.tool_manager.create_or_update_tool_async(beta, actor=default_user)

    gamma = PydanticTool(name="gamma_tool", description="Gamma", source_code=parse_source_code(gamma_tool), source_type="python")
    gamma.json_schema = derive_openai_json_schema(source_code=gamma.source_code, name=gamma.name)
    gamma = await server.tool_manager.create_or_update_tool_async(gamma, actor=default_user)

    # test filtering by single name
    tools = await server.tool_manager.list_tools_async(actor=default_user, names=["alpha_tool"], upsert_base_tools=False)
    assert len(tools) == 1
    assert tools[0].name == "alpha_tool"

    # test filtering by multiple names
    tools = await server.tool_manager.list_tools_async(actor=default_user, names=["alpha_tool", "gamma_tool"], upsert_base_tools=False)
    assert len(tools) == 2
    assert set(t.name for t in tools) == {"alpha_tool", "gamma_tool"}

    # test filtering by non-existent name
    tools = await server.tool_manager.list_tools_async(actor=default_user, names=["non_existent_tool"], upsert_base_tools=False)
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_list_tools_with_tool_ids(server: SyncServer, default_user):
    """Test filtering tools by tool_ids parameter."""

    # create multiple tools
    def tool1() -> str:
        """Tool 1.

        Returns:
            String 1
        """
        return "1"

    def tool2() -> str:
        """Tool 2.

        Returns:
            String 2
        """
        return "2"

    def tool3() -> str:
        """Tool 3.

        Returns:
            String 3
        """
        return "3"

    t1 = PydanticTool(name="tool1", description="First", source_code=parse_source_code(tool1), source_type="python")
    t1.json_schema = derive_openai_json_schema(source_code=t1.source_code, name=t1.name)
    t1 = await server.tool_manager.create_or_update_tool_async(t1, actor=default_user)

    t2 = PydanticTool(name="tool2", description="Second", source_code=parse_source_code(tool2), source_type="python")
    t2.json_schema = derive_openai_json_schema(source_code=t2.source_code, name=t2.name)
    t2 = await server.tool_manager.create_or_update_tool_async(t2, actor=default_user)

    t3 = PydanticTool(name="tool3", description="Third", source_code=parse_source_code(tool3), source_type="python")
    t3.json_schema = derive_openai_json_schema(source_code=t3.source_code, name=t3.name)
    t3 = await server.tool_manager.create_or_update_tool_async(t3, actor=default_user)

    # test filtering by single id
    tools = await server.tool_manager.list_tools_async(actor=default_user, tool_ids=[t1.id], upsert_base_tools=False)
    assert len(tools) == 1
    assert tools[0].id == t1.id

    # test filtering by multiple ids
    tools = await server.tool_manager.list_tools_async(actor=default_user, tool_ids=[t1.id, t3.id], upsert_base_tools=False)
    assert len(tools) == 2
    assert set(t.id for t in tools) == {t1.id, t3.id}

    # test filtering by non-existent id
    tools = await server.tool_manager.list_tools_async(actor=default_user, tool_ids=["non-existent-id"], upsert_base_tools=False)
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_list_tools_with_search(server: SyncServer, default_user):
    """Test searching tools by partial name match."""

    # create tools with searchable names
    def calculator_add() -> str:
        """Calculator add.

        Returns:
            Add operation
        """
        return "add"

    def calculator_subtract() -> str:
        """Calculator subtract.

        Returns:
            Subtract operation
        """
        return "subtract"

    def weather_forecast() -> str:
        """Weather forecast.

        Returns:
            Forecast data
        """
        return "forecast"

    calc_add = PydanticTool(
        name="calculator_add", description="Add numbers", source_code=parse_source_code(calculator_add), source_type="python"
    )
    calc_add.json_schema = derive_openai_json_schema(source_code=calc_add.source_code, name=calc_add.name)
    calc_add = await server.tool_manager.create_or_update_tool_async(calc_add, actor=default_user)

    calc_sub = PydanticTool(
        name="calculator_subtract", description="Subtract numbers", source_code=parse_source_code(calculator_subtract), source_type="python"
    )
    calc_sub.json_schema = derive_openai_json_schema(source_code=calc_sub.source_code, name=calc_sub.name)
    calc_sub = await server.tool_manager.create_or_update_tool_async(calc_sub, actor=default_user)

    weather = PydanticTool(
        name="weather_forecast", description="Weather", source_code=parse_source_code(weather_forecast), source_type="python"
    )
    weather.json_schema = derive_openai_json_schema(source_code=weather.source_code, name=weather.name)
    weather = await server.tool_manager.create_or_update_tool_async(weather, actor=default_user)

    # test searching for "calculator" (should find both calculator tools)
    tools = await server.tool_manager.list_tools_async(actor=default_user, search="calculator", upsert_base_tools=False)
    assert len(tools) == 2
    assert all("calculator" in t.name for t in tools)

    # test case-insensitive search
    tools = await server.tool_manager.list_tools_async(actor=default_user, search="CALCULATOR", upsert_base_tools=False)
    assert len(tools) == 2

    # test partial match
    tools = await server.tool_manager.list_tools_async(actor=default_user, search="calc", upsert_base_tools=False)
    assert len(tools) == 2

    # test search with no matches
    tools = await server.tool_manager.list_tools_async(actor=default_user, search="nonexistent", upsert_base_tools=False)
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_list_tools_return_only_letta_tools(server: SyncServer, default_user):
    """Test filtering for only Letta tools."""
    # first, upsert base tools to ensure we have Letta tools
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    # create a custom tool
    def custom_tool() -> str:
        """Custom tool.

        Returns:
            Custom string
        """
        return "custom"

    custom = PydanticTool(
        name="custom_tool",
        description="Custom",
        source_code=parse_source_code(custom_tool),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    custom.json_schema = derive_openai_json_schema(source_code=custom.source_code, name=custom.name)
    custom = await server.tool_manager.create_or_update_tool_async(custom, actor=default_user)

    # test without filter (should get custom tool + all letta tools)
    tools = await server.tool_manager.list_tools_async(actor=default_user, return_only_letta_tools=False, upsert_base_tools=False)
    # should have at least the custom tool and some letta tools
    assert len(tools) > 1
    assert any(t.name == "custom_tool" for t in tools)

    # test with filter (should only get letta tools)
    tools = await server.tool_manager.list_tools_async(actor=default_user, return_only_letta_tools=True, upsert_base_tools=False)
    assert len(tools) > 0
    # all tools should have tool_type starting with "letta_"
    assert all(t.tool_type.value.startswith("letta_") for t in tools)
    # custom tool should not be in the list
    assert not any(t.name == "custom_tool" for t in tools)


@pytest.mark.asyncio
async def test_list_tools_combined_filters(server: SyncServer, default_user):
    """Test combining multiple filters."""

    # create various tools
    def calc_add() -> str:
        """Calculator add.

        Returns:
            Add result
        """
        return "add"

    def calc_multiply() -> str:
        """Calculator multiply.

        Returns:
            Multiply result
        """
        return "multiply"

    def weather_tool() -> str:
        """Weather tool.

        Returns:
            Weather data
        """
        return "weather"

    calc1 = PydanticTool(
        name="calculator_add", description="Add", source_code=parse_source_code(calc_add), source_type="python", tool_type=ToolType.CUSTOM
    )
    calc1.json_schema = derive_openai_json_schema(source_code=calc1.source_code, name=calc1.name)
    calc1 = await server.tool_manager.create_or_update_tool_async(calc1, actor=default_user)

    calc2 = PydanticTool(
        name="calculator_multiply",
        description="Multiply",
        source_code=parse_source_code(calc_multiply),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    calc2.json_schema = derive_openai_json_schema(source_code=calc2.source_code, name=calc2.name)
    calc2 = await server.tool_manager.create_or_update_tool_async(calc2, actor=default_user)

    weather = PydanticTool(
        name="weather_current",
        description="Weather",
        source_code=parse_source_code(weather_tool),
        source_type="python",
        tool_type=ToolType.CUSTOM,
    )
    weather.json_schema = derive_openai_json_schema(source_code=weather.source_code, name=weather.name)
    weather = await server.tool_manager.create_or_update_tool_async(weather, actor=default_user)

    # combine search with tool_types
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, search="calculator", tool_types=[ToolType.CUSTOM.value], upsert_base_tools=False
    )
    assert len(tools) == 2
    assert all("calculator" in t.name and t.tool_type == ToolType.CUSTOM for t in tools)

    # combine names with tool_ids
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, names=["calculator_add"], tool_ids=[calc1.id], upsert_base_tools=False
    )
    assert len(tools) == 1
    assert tools[0].id == calc1.id

    # combine search with exclude_tool_types
    tools = await server.tool_manager.list_tools_async(
        actor=default_user, search="calculator", exclude_tool_types=[ToolType.EXTERNAL_MCP.value], upsert_base_tools=False
    )
    assert len(tools) == 2


@pytest.mark.asyncio
async def test_count_tools_async(server: SyncServer, default_user):
    """Test counting tools with various filters."""

    # create multiple tools
    def tool_a() -> str:
        """Tool A.

        Returns:
            String a
        """
        return "a"

    def tool_b() -> str:
        """Tool B.

        Returns:
            String b
        """
        return "b"

    def search_tool() -> str:
        """Search tool.

        Returns:
            Search result
        """
        return "search"

    ta = PydanticTool(
        name="tool_a", description="A", source_code=parse_source_code(tool_a), source_type="python", tool_type=ToolType.CUSTOM
    )
    ta.json_schema = derive_openai_json_schema(source_code=ta.source_code, name=ta.name)
    ta = await server.tool_manager.create_or_update_tool_async(ta, actor=default_user)

    tb = PydanticTool(
        name="tool_b", description="B", source_code=parse_source_code(tool_b), source_type="python", tool_type=ToolType.CUSTOM
    )
    tb.json_schema = derive_openai_json_schema(source_code=tb.source_code, name=tb.name)
    tb = await server.tool_manager.create_or_update_tool_async(tb, actor=default_user)

    # upsert base tools to ensure we have Letta tools for counting
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    # count all tools (should have 2 custom tools + letta tools)
    count = await server.tool_manager.count_tools_async(actor=default_user)
    assert count > 2  # at least our 2 custom tools + letta tools

    # count with tool_types filter
    count = await server.tool_manager.count_tools_async(actor=default_user, tool_types=[ToolType.CUSTOM.value])
    assert count == 2  # only our custom tools

    # count with search filter
    count = await server.tool_manager.count_tools_async(actor=default_user, search="tool")
    # should at least find our 2 tools (tool_a, tool_b)
    assert count >= 2

    # count with names filter
    count = await server.tool_manager.count_tools_async(actor=default_user, names=["tool_a", "tool_b"])
    assert count == 2

    # count with return_only_letta_tools
    count = await server.tool_manager.count_tools_async(actor=default_user, return_only_letta_tools=True)
    assert count > 0  # should have letta tools

    # count with exclude_tool_types (exclude all letta tool types)
    count = await server.tool_manager.count_tools_async(
        actor=default_user,
        exclude_tool_types=[
            ToolType.LETTA_CORE.value,
            ToolType.LETTA_MEMORY_CORE.value,
            ToolType.LETTA_MULTI_AGENT_CORE.value,
            ToolType.LETTA_SLEEPTIME_CORE.value,
            ToolType.LETTA_VOICE_SLEEPTIME_CORE.value,
            ToolType.LETTA_BUILTIN.value,
            ToolType.LETTA_FILES_CORE.value,
        ],
    )
    assert count == 2  # only our custom tools


@pytest.mark.asyncio
async def test_update_tool_by_id(server: SyncServer, print_tool, default_user):
    updated_description = "updated_description"
    return_char_limit = 10000

    # Create a ToolUpdate object to modify the print_tool's description
    tool_update = ToolUpdate(description=updated_description, return_char_limit=return_char_limit)

    # Update the tool using the manager method
    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool to verify the changes
    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)

    # Assertions to check if the update was successful
    assert updated_tool.description == updated_description
    assert updated_tool.return_char_limit == return_char_limit
    assert updated_tool.tool_type == ToolType.CUSTOM

    # Dangerous: we bypass safety to give it another tool type
    await server.tool_manager.update_tool_by_id_async(
        print_tool.id, tool_update, actor=default_user, updated_tool_type=ToolType.EXTERNAL_MCP
    )
    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)
    assert updated_tool.tool_type == ToolType.EXTERNAL_MCP


#@pytest.mark.asyncio
#async def test_update_tool_source_code_refreshes_schema_and_name(server: SyncServer, print_tool, default_user):
#    def counter_tool(counter: int):
#        """
#        Args:
#            counter (int): The counter to count to.
#
#        Returns:
#            bool: If it successfully counted to the counter.
#        """
#        for c in range(counter):
#            print(c)
#
#        return True
#
#    # Test begins
#    og_json_schema = print_tool.json_schema
#
#    source_code = parse_source_code(counter_tool)
#
#    # Create a ToolUpdate object to modify the tool's source_code
#    tool_update = ToolUpdate(source_code=source_code)
#
#    # Update the tool using the manager method
#    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=default_user)
#
#    # Fetch the updated tool to verify the changes
#    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)
#
#    # Assertions to check if the update was successful, and json_schema is updated as well
#    assert updated_tool.source_code == source_code
#    assert updated_tool.json_schema != og_json_schema
#
#    new_schema = derive_openai_json_schema(source_code=updated_tool.source_code)
#    assert updated_tool.json_schema == new_schema
#    assert updated_tool.tool_type == ToolType.CUSTOM


#@pytest.mark.asyncio
#async def test_update_tool_source_code_refreshes_schema_only(server: SyncServer, print_tool, default_user):
#    def counter_tool(counter: int):
#        """
#        Args:
#            counter (int): The counter to count to.
#
#        Returns:
#            bool: If it successfully counted to the counter.
#        """
#        for c in range(counter):
#            print(c)
#
#        return True
#
#    # Test begins
#    og_json_schema = print_tool.json_schema
#
#    source_code = parse_source_code(counter_tool)
#    name = "counter_tool"
#
#    # Create a ToolUpdate object to modify the tool's source_code
#    tool_update = ToolUpdate(source_code=source_code)
#
#    # Update the tool using the manager method
#    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=default_user)
#
#    # Fetch the updated tool to verify the changes
#    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)
#
#    # Assertions to check if the update was successful, and json_schema is updated as well
#    assert updated_tool.source_code == source_code
#    assert updated_tool.json_schema != og_json_schema
#
#    new_schema = derive_openai_json_schema(source_code=updated_tool.source_code, name=updated_tool.name)
#    assert updated_tool.json_schema == new_schema
#    assert updated_tool.name == name
#    assert updated_tool.tool_type == ToolType.CUSTOM


@pytest.mark.asyncio
async def test_update_tool_multi_user(server: SyncServer, print_tool, default_user, other_user):
    updated_description = "updated_description"

    # Create a ToolUpdate object to modify the print_tool's description
    tool_update = ToolUpdate(description=updated_description)

    # Update the print_tool using the manager method, but WITH THE OTHER USER'S ID!
    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=other_user)

    # Check that the created_by and last_updated_by fields are correct
    # Fetch the updated print_tool to verify the changes
    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)

    assert updated_tool.last_updated_by_id == other_user.id
    assert updated_tool.created_by_id == default_user.id


@pytest.mark.asyncio
async def test_delete_tool_by_id(server: SyncServer, print_tool, default_user):
    # Delete the print_tool using the manager method
    await server.tool_manager.delete_tool_by_id_async(print_tool.id, actor=default_user)

    tools = await server.tool_manager.list_tools_async(actor=default_user, upsert_base_tools=False)
    assert len(tools) == 0


@pytest.mark.asyncio
async def test_upsert_base_tools(server: SyncServer, default_user):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)

    # Calculate expected tools accounting for production filtering
    if settings.environment == "PRODUCTION":
        expected_tool_names = sorted(LETTA_TOOL_SET - set(LOCAL_ONLY_MULTI_AGENT_TOOLS))
    else:
        expected_tool_names = sorted(LETTA_TOOL_SET)

    assert sorted([t.name for t in tools]) == expected_tool_names

    # Call it again to make sure it doesn't create duplicates
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user)
    assert sorted([t.name for t in tools]) == expected_tool_names

    # Confirm that the return tools have no source_code, but a json_schema
    for t in tools:
        if t.name in BASE_TOOLS:
            assert t.tool_type == ToolType.LETTA_CORE
        elif t.name in BASE_MEMORY_TOOLS:
            assert t.tool_type == ToolType.LETTA_MEMORY_CORE
        elif t.name in MULTI_AGENT_TOOLS:
            assert t.tool_type == ToolType.LETTA_MULTI_AGENT_CORE
        elif t.name in BASE_SLEEPTIME_TOOLS:
            assert t.tool_type == ToolType.LETTA_SLEEPTIME_CORE
        elif t.name in BASE_VOICE_SLEEPTIME_TOOLS:
            assert t.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE
        elif t.name in BASE_VOICE_SLEEPTIME_CHAT_TOOLS:
            assert t.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE
        elif t.name in BUILTIN_TOOLS:
            assert t.tool_type == ToolType.LETTA_BUILTIN
        elif t.name in FILES_TOOLS:
            assert t.tool_type == ToolType.LETTA_FILES_CORE
        else:
            pytest.fail(f"The tool name is unrecognized as a base tool: {t.name}")
        assert t.source_code is None
        assert t.json_schema


@pytest.mark.parametrize(
    "tool_type,expected_names",
    [
        (ToolType.LETTA_CORE, BASE_TOOLS),
        (ToolType.LETTA_MEMORY_CORE, BASE_MEMORY_TOOLS),
        (ToolType.LETTA_MULTI_AGENT_CORE, MULTI_AGENT_TOOLS),
        (ToolType.LETTA_SLEEPTIME_CORE, BASE_SLEEPTIME_TOOLS),
        (ToolType.LETTA_VOICE_SLEEPTIME_CORE, sorted(set(BASE_VOICE_SLEEPTIME_TOOLS + BASE_VOICE_SLEEPTIME_CHAT_TOOLS) - {"send_message"})),
        (ToolType.LETTA_BUILTIN, BUILTIN_TOOLS),
        (ToolType.LETTA_FILES_CORE, FILES_TOOLS),
    ],
)
async def test_upsert_filtered_base_tools(server: SyncServer, default_user, tool_type, expected_names):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types={tool_type})
    tool_names = sorted([t.name for t in tools])

    # Adjust expected names for multi-agent tools in production
    if tool_type == ToolType.LETTA_MULTI_AGENT_CORE and settings.environment == "PRODUCTION":
        expected_sorted = sorted(set(expected_names) - set(LOCAL_ONLY_MULTI_AGENT_TOOLS))
    else:
        expected_sorted = sorted(expected_names)

    assert tool_names == expected_sorted
    assert all(t.tool_type == tool_type for t in tools)


async def test_upsert_multiple_tool_types(server: SyncServer, default_user):
    allowed = {ToolType.LETTA_CORE, ToolType.LETTA_BUILTIN, ToolType.LETTA_FILES_CORE}
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types=allowed)
    tool_names = {t.name for t in tools}
    expected = set(BASE_TOOLS + BUILTIN_TOOLS + FILES_TOOLS)

    assert tool_names == expected
    assert all(t.tool_type in allowed for t in tools)


async def test_upsert_base_tools_with_empty_type_filter(server: SyncServer, default_user):
    tools = await server.tool_manager.upsert_base_tools_async(actor=default_user, allowed_types=set())
    assert tools == []


async def test_bulk_upsert_tools_async(server: SyncServer, default_user):
    """Test bulk upserting multiple tools at once"""
    # create multiple test tools
    tools_data = []
    for i in range(5):
        tool = PydanticTool(
            name=f"bulk_test_tool_{i}",
            description=f"Test tool {i} for bulk operations",
            tags=["bulk", "test"],
            source_code=f"def bulk_test_tool_{i}():\n    '''Test tool {i} function'''\n    return 'result_{i}'",
            source_type="python",
        )
        tools_data.append(tool)

    # initial bulk upsert - should create all tools
    created_tools = await server.tool_manager.bulk_upsert_tools_async(tools_data, default_user)
    assert len(created_tools) == 5
    assert all(t.name.startswith("bulk_test_tool_") for t in created_tools)
    assert all(t.description for t in created_tools)

    # verify all tools were created
    for i in range(5):
        tool = await server.tool_manager.get_tool_by_name_async(f"bulk_test_tool_{i}", default_user)
        assert tool is not None
        assert tool.description == f"Test tool {i} for bulk operations"

    # modify some tools and upsert again - should update existing tools
    tools_data[0].description = "Updated description for tool 0"
    tools_data[2].tags = ["bulk", "test", "updated"]

    updated_tools = await server.tool_manager.bulk_upsert_tools_async(tools_data, default_user)
    assert len(updated_tools) == 5

    # verify updates were applied
    tool_0 = await server.tool_manager.get_tool_by_name_async("bulk_test_tool_0", default_user)
    assert tool_0.description == "Updated description for tool 0"

    tool_2 = await server.tool_manager.get_tool_by_name_async("bulk_test_tool_2", default_user)
    assert "updated" in tool_2.tags

    # test with empty list
    empty_result = await server.tool_manager.bulk_upsert_tools_async([], default_user)
    assert empty_result == []

    # test with tools missing descriptions (should auto-generate from json schema)
    no_desc_tool = PydanticTool(
        name="no_description_tool",
        tags=["test"],
        source_code="def no_description_tool():\n    '''This is a docstring description'''\n    return 'result'",
        source_type="python",
    )
    result = await server.tool_manager.bulk_upsert_tools_async([no_desc_tool], default_user)
    assert len(result) == 1
    assert result[0].description is not None  # should be auto-generated from docstring


async def test_bulk_upsert_tools_name_conflict(server: SyncServer, default_user):
    """Test bulk upserting tools handles name+org_id unique constraint correctly"""

    # create a tool with a specific name
    original_tool = PydanticTool(
        name="unique_name_tool",
        description="Original description",
        tags=["original"],
        source_code="def unique_name_tool():\n    '''Original function'''\n    return 'original'",
        source_type="python",
    )

    # create it
    created = await server.tool_manager.create_tool_async(original_tool, default_user)
    original_id = created.id

    # now try to bulk upsert with same name but different id
    conflicting_tool = PydanticTool(
        name="unique_name_tool",  # same name
        description="Updated via bulk upsert",
        tags=["updated", "bulk"],
        source_code="def unique_name_tool():\n    '''Updated function'''\n    return 'updated'",
        source_type="python",
    )

    # bulk upsert should update the existing tool based on name conflict
    result = await server.tool_manager.bulk_upsert_tools_async([conflicting_tool], default_user)
    assert len(result) == 1
    assert result[0].name == "unique_name_tool"
    assert result[0].description == "Updated via bulk upsert"
    assert "updated" in result[0].tags
    assert "bulk" in result[0].tags

    # verify only one tool exists with this name
    all_tools = await server.tool_manager.list_tools_async(actor=default_user)
    tools_with_name = [t for t in all_tools if t.name == "unique_name_tool"]
    assert len(tools_with_name) == 1

    # the id should remain the same as the original
    assert tools_with_name[0].id == original_id


async def test_bulk_upsert_tools_mixed_create_update(server: SyncServer, default_user):
    """Test bulk upserting with mix of new tools and updates to existing ones"""

    # create some existing tools
    existing_tools = []
    for i in range(3):
        tool = PydanticTool(
            name=f"existing_tool_{i}",
            description=f"Existing tool {i}",
            tags=["existing"],
            source_code=f"def existing_tool_{i}():\n    '''Existing {i}'''\n    return 'existing_{i}'",
            source_type="python",
        )
        created = await server.tool_manager.create_tool_async(tool, default_user)
        existing_tools.append(created)

    # prepare bulk upsert with mix of updates and new tools
    bulk_tools = []

    # update existing tool 0 by name
    bulk_tools.append(
        PydanticTool(
            name="existing_tool_0",  # matches by name
            description="Updated existing tool 0",
            tags=["existing", "updated"],
            source_code="def existing_tool_0():\n    '''Updated 0'''\n    return 'updated_0'",
            source_type="python",
        )
    )

    # update existing tool 1 by name (since bulk upsert matches by name, not id)
    bulk_tools.append(
        PydanticTool(
            name="existing_tool_1",  # matches by name
            description="Updated existing tool 1",
            tags=["existing", "updated"],
            source_code="def existing_tool_1():\n    '''Updated 1'''\n    return 'updated_1'",
            source_type="python",
        )
    )

    # add completely new tools
    for i in range(3, 6):
        bulk_tools.append(
            PydanticTool(
                name=f"new_tool_{i}",
                description=f"New tool {i}",
                tags=["new"],
                source_code=f"def new_tool_{i}():\n    '''New {i}'''\n    return 'new_{i}'",
                source_type="python",
            )
        )

    # perform bulk upsert
    result = await server.tool_manager.bulk_upsert_tools_async(bulk_tools, default_user)
    assert len(result) == 5  # 2 updates + 3 new

    # verify updates
    tool_0 = await server.tool_manager.get_tool_by_name_async("existing_tool_0", default_user)
    assert tool_0.description == "Updated existing tool 0"
    assert "updated" in tool_0.tags
    assert tool_0.id == existing_tools[0].id  # id should remain same

    # verify tool 1 was updated
    tool_1 = await server.tool_manager.get_tool_by_id_async(existing_tools[1].id, default_user)
    assert tool_1.name == "existing_tool_1"  # name stays same
    assert tool_1.description == "Updated existing tool 1"
    assert "updated" in tool_1.tags

    # verify new tools were created
    for i in range(3, 6):
        new_tool = await server.tool_manager.get_tool_by_name_async(f"new_tool_{i}", default_user)
        assert new_tool is not None
        assert new_tool.description == f"New tool {i}"
        assert "new" in new_tool.tags

    # verify existing_tool_2 was not affected
    tool_2 = await server.tool_manager.get_tool_by_id_async(existing_tools[2].id, default_user)
    assert tool_2.name == "existing_tool_2"
    assert tool_2.description == "Existing tool 2"
    assert tool_2.tags == ["existing"]


@pytest.mark.asyncio
async def test_bulk_upsert_tools_override_existing_true(server: SyncServer, default_user):
    """Test bulk_upsert_tools_async with override_existing_tools=True (default behavior)"""

    # create some existing tools
    existing_tool = PydanticTool(
        name="test_override_tool",
        description="Original description",
        tags=["original"],
        source_code="def test_override_tool():\n    '''Original'''\n    return 'original'",
        source_type="python",
    )
    created = await server.tool_manager.create_tool_async(existing_tool, default_user)
    original_id = created.id

    # prepare updated version of the tool
    updated_tool = PydanticTool(
        name="test_override_tool",
        description="Updated description",
        tags=["updated"],
        source_code="def test_override_tool():\n    '''Updated'''\n    return 'updated'",
        source_type="python",
    )

    # bulk upsert with override_existing_tools=True (default)
    result = await server.tool_manager.bulk_upsert_tools_async([updated_tool], default_user, override_existing_tools=True)

    assert len(result) == 1
    assert result[0].id == original_id  # id should remain the same
    assert result[0].description == "Updated description"  # description should be updated
    assert result[0].tags == ["updated"]  # tags should be updated

    # verify the tool was actually updated in the database
    fetched = await server.tool_manager.get_tool_by_id_async(original_id, default_user)
    assert fetched.description == "Updated description"
    assert fetched.tags == ["updated"]


@pytest.mark.asyncio
async def test_bulk_upsert_tools_override_existing_false(server: SyncServer, default_user):
    """Test bulk_upsert_tools_async with override_existing_tools=False (skip existing)"""

    # create some existing tools
    existing_tool = PydanticTool(
        name="test_no_override_tool",
        description="Original description",
        tags=["original"],
        source_code="def test_no_override_tool():\n    '''Original'''\n    return 'original'",
        source_type="python",
    )
    created = await server.tool_manager.create_tool_async(existing_tool, default_user)
    original_id = created.id

    # prepare updated version of the tool
    updated_tool = PydanticTool(
        name="test_no_override_tool",
        description="Should not be updated",
        tags=["should_not_update"],
        source_code="def test_no_override_tool():\n    '''Should not update'''\n    return 'should_not_update'",
        source_type="python",
    )

    # bulk upsert with override_existing_tools=False
    result = await server.tool_manager.bulk_upsert_tools_async([updated_tool], default_user, override_existing_tools=False)

    assert len(result) == 1
    assert result[0].id == original_id  # id should remain the same
    assert result[0].description == "Original description"  # description should NOT be updated
    assert result[0].tags == ["original"]  # tags should NOT be updated

    # verify the tool was NOT updated in the database
    fetched = await server.tool_manager.get_tool_by_id_async(original_id, default_user)
    assert fetched.description == "Original description"
    assert fetched.tags == ["original"]


@pytest.mark.asyncio
async def test_bulk_upsert_tools_override_mixed_scenario(server: SyncServer, default_user):
    """Test bulk_upsert_tools_async with override_existing_tools=False in mixed create/update scenario"""

    # create some existing tools
    existing_tools = []
    for i in range(2):
        tool = PydanticTool(
            name=f"mixed_existing_{i}",
            description=f"Original {i}",
            tags=["original"],
            source_code=f"def mixed_existing_{i}():\n    '''Original {i}'''\n    return 'original_{i}'",
            source_type="python",
        )
        created = await server.tool_manager.create_tool_async(tool, default_user)
        existing_tools.append(created)

    # prepare bulk tools: 2 updates (that should be skipped) + 3 new creations
    bulk_tools = []

    # these should be skipped when override_existing_tools=False
    for i in range(2):
        bulk_tools.append(
            PydanticTool(
                name=f"mixed_existing_{i}",
                description=f"Should not update {i}",
                tags=["should_not_update"],
                source_code=f"def mixed_existing_{i}():\n    '''Should not update {i}'''\n    return 'should_not_update_{i}'",
                source_type="python",
            )
        )

    # these should be created
    for i in range(3):
        bulk_tools.append(
            PydanticTool(
                name=f"mixed_new_{i}",
                description=f"New tool {i}",
                tags=["new"],
                source_code=f"def mixed_new_{i}():\n    '''New {i}'''\n    return 'new_{i}'",
                source_type="python",
            )
        )

    # bulk upsert with override_existing_tools=False
    result = await server.tool_manager.bulk_upsert_tools_async(bulk_tools, default_user, override_existing_tools=False)

    assert len(result) == 5  # 2 existing (not updated) + 3 new

    # verify existing tools were NOT updated
    for i in range(2):
        tool = await server.tool_manager.get_tool_by_name_async(f"mixed_existing_{i}", default_user)
        assert tool.description == f"Original {i}"  # should remain original
        assert tool.tags == ["original"]  # should remain original
        assert tool.id == existing_tools[i].id  # id should remain same

    # verify new tools were created
    for i in range(3):
        new_tool = await server.tool_manager.get_tool_by_name_async(f"mixed_new_{i}", default_user)
        assert new_tool is not None
        assert new_tool.description == f"New tool {i}"
        assert new_tool.tags == ["new"]


@pytest.mark.asyncio
async def test_create_tool_with_pip_requirements(server: SyncServer, default_user, default_organization):
    def test_tool_with_deps():
        """
        A test tool with pip dependencies.

        Returns:
            str: Hello message.
        """
        return "hello"

    # Create pip requirements
    pip_reqs = [
        PipRequirement(name="requests", version="2.28.0"),
        PipRequirement(name="numpy"),  # No version specified
    ]

    # Set up tool details
    source_code = parse_source_code(test_tool_with_deps)
    source_type = "python"
    description = "A test tool with pip dependencies"
    tags = ["test"]
    metadata = {"test": "pip_requirements"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Assertions
    assert created_tool.pip_requirements is not None
    assert len(created_tool.pip_requirements) == 2
    assert created_tool.pip_requirements[0].name == "requests"
    assert created_tool.pip_requirements[0].version == "2.28.0"
    assert created_tool.pip_requirements[1].name == "numpy"
    assert created_tool.pip_requirements[1].version is None


async def test_create_tool_without_pip_requirements(server: SyncServer, print_tool):
    # Verify that tools without pip_requirements have the field as None
    assert print_tool.pip_requirements is None


async def test_update_tool_pip_requirements(server: SyncServer, print_tool, default_user):
    # Add pip requirements to existing tool
    pip_reqs = [
        PipRequirement(name="pandas", version="1.5.0"),
        PipRequirement(name="sumy"),
    ]

    tool_update = ToolUpdate(pip_requirements=pip_reqs)
    await server.tool_manager.update_tool_by_id_async(print_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(print_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.pip_requirements is not None
    assert len(updated_tool.pip_requirements) == 2
    assert updated_tool.pip_requirements[0].name == "pandas"
    assert updated_tool.pip_requirements[0].version == "1.5.0"
    assert updated_tool.pip_requirements[1].name == "sumy"
    assert updated_tool.pip_requirements[1].version is None


async def test_update_tool_clear_pip_requirements(server: SyncServer, default_user, default_organization):
    def test_tool_clear_deps():
        """
        A test tool to clear dependencies.

        Returns:
            str: Hello message.
        """
        return "hello"

    # Create a tool with pip requirements
    pip_reqs = [PipRequirement(name="requests")]

    # Set up tool details
    source_code = parse_source_code(test_tool_clear_deps)
    source_type = "python"
    description = "A test tool to clear dependencies"
    tags = ["test"]
    metadata = {"test": "clear_deps"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Verify it has requirements
    assert created_tool.pip_requirements is not None
    assert len(created_tool.pip_requirements) == 1

    # Clear the requirements
    tool_update = ToolUpdate(pip_requirements=[])
    await server.tool_manager.update_tool_by_id_async(created_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(created_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.pip_requirements == []


async def test_pip_requirements_roundtrip(server: SyncServer, default_user, default_organization):
    def roundtrip_test_tool():
        """
        Test pip requirements roundtrip.

        Returns:
            str: Test message.
        """
        return "test"

    # Create pip requirements with various version formats
    pip_reqs = [
        PipRequirement(name="requests", version="2.28.0"),
        PipRequirement(name="flask", version="2.0"),
        PipRequirement(name="django", version="4.1.0-beta"),
        PipRequirement(name="numpy"),  # No version
    ]

    # Set up tool details
    source_code = parse_source_code(roundtrip_test_tool)
    source_type = "python"
    description = "Test pip requirements roundtrip"
    tags = ["test"]
    metadata = {"test": "roundtrip"}

    tool = PydanticTool(
        description=description, tags=tags, source_code=source_code, source_type=source_type, metadata_=metadata, pip_requirements=pip_reqs
    )
    derived_json_schema = derive_openai_json_schema(source_code=tool.source_code, name=tool.name)
    derived_name = derived_json_schema["name"]
    tool.json_schema = derived_json_schema
    tool.name = derived_name

    created_tool = await server.tool_manager.create_or_update_tool_async(tool, actor=default_user)

    # Fetch by ID
    fetched_tool = await server.tool_manager.get_tool_by_id_async(created_tool.id, actor=default_user)

    # Verify all requirements match exactly
    assert fetched_tool.pip_requirements is not None
    assert len(fetched_tool.pip_requirements) == 4

    # Check each requirement
    reqs_dict = {req.name: req.version for req in fetched_tool.pip_requirements}
    assert reqs_dict["requests"] == "2.28.0"
    assert reqs_dict["flask"] == "2.0"
    assert reqs_dict["django"] == "4.1.0-beta"
    assert reqs_dict["numpy"] is None


async def test_update_default_requires_approval(server: SyncServer, bash_tool, default_user):
    # Update field
    tool_update = ToolUpdate(default_requires_approval=False)
    await server.tool_manager.update_tool_by_id_async(bash_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(bash_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.default_requires_approval == False

    # Revert update
    tool_update = ToolUpdate(default_requires_approval=True)
    await server.tool_manager.update_tool_by_id_async(bash_tool.id, tool_update, actor=default_user)

    # Fetch the updated tool
    updated_tool = await server.tool_manager.get_tool_by_id_async(bash_tool.id, actor=default_user)

    # Assertions
    assert updated_tool.default_requires_approval == True
