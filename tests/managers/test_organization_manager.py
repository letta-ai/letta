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
# Organization Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_organizations(server: SyncServer):
    # Create a new org and confirm that it is created correctly
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))

    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 1
    assert orgs[0].name == org_name

    # Delete it after
    await server.organization_manager.delete_organization_by_id_async(org.id)
    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 0


@pytest.mark.asyncio
async def test_create_default_organization(server: SyncServer):
    await server.organization_manager.create_default_organization_async()
    retrieved = await server.organization_manager.get_default_organization_async()
    assert retrieved.name == DEFAULT_ORG_NAME


@pytest.mark.asyncio
async def test_update_organization_name(server: SyncServer):
    org_name_a = "a"
    org_name_b = "b"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name_a))
    assert org.name == org_name_a
    org = await server.organization_manager.update_organization_name_using_id_async(org_id=org.id, name=org_name_b)
    assert org.name == org_name_b


@pytest.mark.asyncio
async def test_update_organization_privileged_tools(server: SyncServer):
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))
    assert org.privileged_tools == False
    org = await server.organization_manager.update_organization_async(org_id=org.id, org_update=OrganizationUpdate(privileged_tools=True))
    assert org.privileged_tools == True


@pytest.mark.asyncio
async def test_list_organizations_pagination(server: SyncServer):
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="a"))
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="b"))

    orgs_x = await server.organization_manager.list_organizations_async(limit=1)
    assert len(orgs_x) == 1

    orgs_y = await server.organization_manager.list_organizations_async(after=orgs_x[0].id, limit=1)
    assert len(orgs_y) == 1
    assert orgs_y[0].name != orgs_x[0].name

    orgs = await server.organization_manager.list_organizations_async(after=orgs_y[0].id, limit=1)
    assert len(orgs) == 0
