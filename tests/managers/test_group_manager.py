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


@pytest.mark.asyncio
async def test_create_internal_template_objects(server: SyncServer, default_user):
    """Test creating agents, groups, and blocks with template-related fields."""
    from letta.schemas.agent import InternalTemplateAgentCreate
    from letta.schemas.block import Block, InternalTemplateBlockCreate
    from letta.schemas.group import InternalTemplateGroupCreate, RoundRobinManager

    base_template_id = "base_123"
    template_id = "template_456"
    deployment_id = "deploy_789"
    entity_id = "entity_012"

    # Create agent with template fields (use sarah_agent as base, then create new one)
    agent = await server.agent_manager.create_agent_async(
        InternalTemplateAgentCreate(
            name="template-agent",
            base_template_id=base_template_id,
            template_id=template_id,
            deployment_id=deployment_id,
            entity_id=entity_id,
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    # Verify agent template fields
    assert agent.base_template_id == base_template_id
    assert agent.template_id == template_id
    assert agent.deployment_id == deployment_id
    assert agent.entity_id == entity_id

    # Create block with template fields
    block_create = InternalTemplateBlockCreate(
        label="template_block",
        value="Test block",
        base_template_id=base_template_id,
        template_id=template_id,
        deployment_id=deployment_id,
        entity_id=entity_id,
    )
    block = await server.block_manager.create_or_update_block_async(Block(**block_create.model_dump()), actor=default_user)
    # Verify block template fields
    assert block.base_template_id == base_template_id
    assert block.template_id == template_id
    assert block.deployment_id == deployment_id
    assert block.entity_id == entity_id

    # Create group with template fields (no entity_id for groups)
    group = await server.group_manager.create_group_async(
        InternalTemplateGroupCreate(
            agent_ids=[agent.id],
            description="Template group",
            base_template_id=base_template_id,
            template_id=template_id,
            deployment_id=deployment_id,
            manager_config=RoundRobinManager(),
        ),
        actor=default_user,
    )
    # Verify group template fields and basic functionality
    assert group.description == "Template group"
    assert agent.id in group.agent_ids
    assert group.base_template_id == base_template_id
    assert group.template_id == template_id
    assert group.deployment_id == deployment_id

    # Clean up
    await server.group_manager.delete_group_async(group.id, actor=default_user)
    await server.block_manager.delete_block_async(block.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
