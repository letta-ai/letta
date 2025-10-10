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
# SandboxConfigManager Tests - Sandbox Configs
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_or_update_sandbox_config(server: SyncServer, default_user):
    sandbox_config_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    created_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=default_user)

    # Assertions
    assert created_config.type == SandboxType.E2B
    assert created_config.get_e2b_config() == sandbox_config_create.config
    assert created_config.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_create_local_sandbox_config_defaults(server: SyncServer, default_user):
    sandbox_config_create = SandboxConfigCreate(
        config=LocalSandboxConfig(),
    )
    created_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=default_user)

    # Assertions
    assert created_config.type == SandboxType.LOCAL
    assert created_config.get_local_config() == sandbox_config_create.config
    assert created_config.get_local_config().sandbox_dir in {LETTA_TOOL_EXECUTION_DIR, tool_settings.tool_exec_dir}
    assert created_config.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_default_e2b_settings_sandbox_config(server: SyncServer, default_user):
    created_config = await server.sandbox_config_manager.get_or_create_default_sandbox_config_async(
        sandbox_type=SandboxType.E2B, actor=default_user
    )
    e2b_config = created_config.get_e2b_config()

    # Assertions
    assert e2b_config.timeout == 5 * 60
    assert e2b_config.template == tool_settings.e2b_sandbox_template_id


@pytest.mark.asyncio
async def test_update_existing_sandbox_config(server: SyncServer, sandbox_config_fixture, default_user):
    update_data = SandboxConfigUpdate(config=E2BSandboxConfig(template="template_2", timeout=120))
    updated_config = await server.sandbox_config_manager.update_sandbox_config_async(
        sandbox_config_fixture.id, update_data, actor=default_user
    )

    # Assertions
    assert updated_config.config["template"] == "template_2"
    assert updated_config.config["timeout"] == 120


@pytest.mark.asyncio
async def test_delete_sandbox_config(server: SyncServer, sandbox_config_fixture, default_user):
    deleted_config = await server.sandbox_config_manager.delete_sandbox_config_async(sandbox_config_fixture.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_config.id == sandbox_config_fixture.id

    # Verify it no longer exists
    config_list = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user)
    assert sandbox_config_fixture.id not in [config.id for config in config_list]


@pytest.mark.asyncio
async def test_get_sandbox_config_by_type(server: SyncServer, sandbox_config_fixture, default_user):
    retrieved_config = await server.sandbox_config_manager.get_sandbox_config_by_type_async(sandbox_config_fixture.type, actor=default_user)

    # Assertions to verify correct retrieval
    assert retrieved_config.id == sandbox_config_fixture.id
    assert retrieved_config.type == sandbox_config_fixture.type


@pytest.mark.asyncio
async def test_list_sandbox_configs(server: SyncServer, default_user):
    # Creating multiple sandbox configs
    config_e2b_create = SandboxConfigCreate(
        config=E2BSandboxConfig(),
    )
    config_local_create = SandboxConfigCreate(
        config=LocalSandboxConfig(sandbox_dir=""),
    )
    config_e2b = await server.sandbox_config_manager.create_or_update_sandbox_config_async(config_e2b_create, actor=default_user)
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    config_local = await server.sandbox_config_manager.create_or_update_sandbox_config_async(config_local_create, actor=default_user)

    # List configs without pagination
    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user)
    assert len(configs) >= 2

    # List configs with pagination
    paginated_configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, limit=1)
    assert len(paginated_configs) == 1

    next_page = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, after=paginated_configs[-1].id, limit=1)
    assert len(next_page) == 1
    assert next_page[0].id != paginated_configs[0].id

    # List configs using sandbox_type filter
    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, sandbox_type=SandboxType.E2B)
    assert len(configs) == 1
    assert configs[0].id == config_e2b.id

    configs = await server.sandbox_config_manager.list_sandbox_configs_async(actor=default_user, sandbox_type=SandboxType.LOCAL)
    assert len(configs) == 1
    assert configs[0].id == config_local.id


# ======================================================================================================================
# SandboxConfigManager Tests - Environment Variables
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_sandbox_env_var(server: SyncServer, sandbox_config_fixture, default_user):
    env_var_create = SandboxEnvironmentVariableCreate(key="TEST_VAR", value="test_value", description="A test environment variable.")
    created_env_var = await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )

    # Assertions
    assert created_env_var.key == env_var_create.key
    assert created_env_var.value == env_var_create.value
    assert created_env_var.organization_id == default_user.organization_id


@pytest.mark.asyncio
async def test_update_sandbox_env_var(server: SyncServer, sandbox_env_var_fixture, default_user):
    update_data = SandboxEnvironmentVariableUpdate(value="updated_value")
    updated_env_var = await server.sandbox_config_manager.update_sandbox_env_var_async(
        sandbox_env_var_fixture.id, update_data, actor=default_user
    )

    # Assertions
    assert updated_env_var.value == "updated_value"
    assert updated_env_var.id == sandbox_env_var_fixture.id


@pytest.mark.asyncio
async def test_delete_sandbox_env_var(server: SyncServer, sandbox_config_fixture, sandbox_env_var_fixture, default_user):
    deleted_env_var = await server.sandbox_config_manager.delete_sandbox_env_var_async(sandbox_env_var_fixture.id, actor=default_user)

    # Assertions to verify deletion
    assert deleted_env_var.id == sandbox_env_var_fixture.id

    # Verify it no longer exists
    env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    assert sandbox_env_var_fixture.id not in [env_var.id for env_var in env_vars]


@pytest.mark.asyncio
async def test_list_sandbox_env_vars(server: SyncServer, sandbox_config_fixture, default_user):
    # Creating multiple environment variables
    env_var_create_a = SandboxEnvironmentVariableCreate(key="VAR1", value="value1")
    env_var_create_b = SandboxEnvironmentVariableCreate(key="VAR2", value="value2")
    await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create_a, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    if USING_SQLITE:
        time.sleep(CREATE_DELAY_SQLITE)
    await server.sandbox_config_manager.create_sandbox_env_var_async(
        env_var_create_b, sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )

    # List env vars without pagination
    env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user
    )
    assert len(env_vars) >= 2

    # List env vars with pagination
    paginated_env_vars = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user, limit=1
    )
    assert len(paginated_env_vars) == 1

    next_page = await server.sandbox_config_manager.list_sandbox_env_vars_async(
        sandbox_config_id=sandbox_config_fixture.id, actor=default_user, after=paginated_env_vars[-1].id, limit=1
    )
    assert len(next_page) == 1
    assert next_page[0].id != paginated_env_vars[0].id


@pytest.mark.asyncio
async def test_get_sandbox_env_var_by_key(server: SyncServer, sandbox_env_var_fixture, default_user):
    retrieved_env_var = await server.sandbox_config_manager.get_sandbox_env_var_by_key_and_sandbox_config_id_async(
        sandbox_env_var_fixture.key, sandbox_env_var_fixture.sandbox_config_id, actor=default_user
    )

    # Assertions to verify correct retrieval
    assert retrieved_env_var.id == sandbox_env_var_fixture.id
