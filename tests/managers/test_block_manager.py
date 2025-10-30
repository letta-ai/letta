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

# ======================================================================================================================
# AgentManager Tests - Blocks Relationship
# ======================================================================================================================


@pytest.mark.asyncio
async def test_attach_block(server: SyncServer, sarah_agent, default_block, default_user):
    """Test attaching a block to an agent."""
    # Attach block
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Verify attachment
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.memory.blocks) == 1
    assert agent.memory.blocks[0].id == default_block.id
    assert agent.memory.blocks[0].label == default_block.label


# Test should work with both SQLite and PostgreSQL
@pytest.mark.asyncio
async def test_attach_block_duplicate_label(server: SyncServer, sarah_agent, default_block, other_block, default_user):
    """Test attempting to attach a block with a duplicate label."""
    # Set up both blocks with same label
    await server.block_manager.update_block_async(default_block.id, BlockUpdate(label="same_label"), actor=default_user)
    await server.block_manager.update_block_async(other_block.id, BlockUpdate(label="same_label"), actor=default_user)

    # Attach first block
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Attempt to attach second block with same label
    with pytest.raises(UniqueConstraintViolationError):
        await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=other_block.id, actor=default_user)


@pytest.mark.asyncio
async def test_detach_block(server: SyncServer, sarah_agent, default_block, default_user):
    """Test detaching a block by ID."""
    # Set up: attach block
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Detach block
    await server.agent_manager.detach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Verify detachment
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    assert len(agent.memory.blocks) == 0

    # Check that block still exists
    block = await server.block_manager.get_block_by_id_async(block_id=default_block.id, actor=default_user)
    assert block


@pytest.mark.asyncio
async def test_detach_nonexistent_block(server: SyncServer, sarah_agent, default_user):
    """Test detaching a block that isn't attached."""
    with pytest.raises(NoResultFound):
        await server.agent_manager.detach_block_async(agent_id=sarah_agent.id, block_id="nonexistent-block-id", actor=default_user)


@pytest.mark.asyncio
async def test_update_block_label(server: SyncServer, sarah_agent, default_block, default_user):
    """Test updating a block's label updates the relationship."""
    # Attach block
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Update block label
    new_label = "new_label"
    await server.block_manager.update_block_async(default_block.id, BlockUpdate(label=new_label), actor=default_user)

    # Verify relationship is updated
    agent = await server.agent_manager.get_agent_by_id_async(sarah_agent.id, actor=default_user)
    block = agent.memory.blocks[0]
    assert block.id == default_block.id
    assert block.label == new_label


@pytest.mark.asyncio
async def test_update_block_label_multiple_agents(server: SyncServer, sarah_agent, charles_agent, default_block, default_user):
    """Test updating a block's label updates relationships for all agents."""
    # Attach block to both agents
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)
    await server.agent_manager.attach_block_async(agent_id=charles_agent.id, block_id=default_block.id, actor=default_user)

    # Update block label
    new_label = "new_label"
    await server.block_manager.update_block_async(default_block.id, BlockUpdate(label=new_label), actor=default_user)

    # Verify both relationships are updated
    for agent_id in [sarah_agent.id, charles_agent.id]:
        agent = await server.agent_manager.get_agent_by_id_async(agent_id, actor=default_user)
        # Find our specific block by ID
        block = next(b for b in agent.memory.blocks if b.id == default_block.id)
        assert block.label == new_label


@pytest.mark.asyncio
async def test_get_block_with_label(server: SyncServer, sarah_agent, default_block, default_user):
    """Test retrieving a block by its label."""
    # Attach block
    await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=default_block.id, actor=default_user)

    # Get block by label
    block = await server.agent_manager.get_block_with_label_async(
        agent_id=sarah_agent.id, block_label=default_block.label, actor=default_user
    )

    assert block.id == default_block.id
    assert block.label == default_block.label


@pytest.mark.asyncio
async def test_refresh_memory_async(server: SyncServer, default_user):
    block = await server.block_manager.create_or_update_block_async(
        PydanticBlock(
            label="test",
            value="test",
            limit=1000,
        ),
        actor=default_user,
    )
    block_human = await server.block_manager.create_or_update_block_async(
        PydanticBlock(
            label="human",
            value="name: caren",
            limit=1000,
        ),
        actor=default_user,
    )
    agent = await server.agent_manager.create_agent_async(
        CreateAgent(
            name="test",
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
            block_ids=[block.id, block_human.id],
        ),
        actor=default_user,
    )
    block = await server.block_manager.update_block_async(
        block_id=block.id,
        block_update=BlockUpdate(
            value="test2",
        ),
        actor=default_user,
    )
    assert len(agent.memory.blocks) == 2
    agent = await server.agent_manager.refresh_memory_async(agent_state=agent, actor=default_user)
    assert len(agent.memory.blocks) == 2
    assert any([block.value == "test2" for block in agent.memory.blocks])


# ======================================================================================================================
# Block Manager Tests - Basic
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_block(server: SyncServer, default_user):
    block_manager = BlockManager()
    block_create = PydanticBlock(
        label="human",
        is_template=True,
        value="Sample content",
        template_name="sample_template_name",
        template_id="sample_template",
        description="A test block",
        limit=1000,
        metadata={"example": "data"},
    )

    block = await block_manager.create_or_update_block_async(block_create, actor=default_user)

    # Assertions to ensure the created block matches the expected values
    assert block.label == block_create.label
    assert block.is_template == block_create.is_template
    assert block.value == block_create.value
    assert block.template_name == block_create.template_name
    assert block.template_id == block_create.template_id
    assert block.description == block_create.description
    assert block.limit == block_create.limit
    assert block.metadata == block_create.metadata


async def test_batch_create_blocks_async(server: SyncServer, default_user):
    """Test batch creating multiple blocks at once"""
    block_manager = BlockManager()

    # create multiple test blocks
    blocks_data = []
    for i in range(5):
        block = PydanticBlock(
            label=f"test_block_{i}",
            is_template=False,
            value=f"Content for block {i}",
            description=f"Test block {i} for batch operations",
            limit=1000 + i * 100,  # varying limits
            metadata={"index": i, "batch": "test"},
        )
        blocks_data.append(block)

    # batch create all blocks at once
    created_blocks = await block_manager.batch_create_blocks_async(blocks_data, default_user)

    # verify all blocks were created
    assert len(created_blocks) == 5
    assert all(b.label.startswith("test_block_") for b in created_blocks)

    # verify block properties were preserved
    for i, block in enumerate(created_blocks):
        assert block.label == f"test_block_{i}"
        assert block.value == f"Content for block {i}"
        assert block.description == f"Test block {i} for batch operations"
        assert block.limit == 1000 + i * 100
        assert block.metadata["index"] == i
        assert block.metadata["batch"] == "test"
        assert block.id is not None  # should have generated ids
        # blocks have organization_id at the orm level, not in the pydantic model

    # verify blocks can be retrieved individually
    for created_block in created_blocks:
        retrieved = await block_manager.get_block_by_id_async(created_block.id, default_user)
        assert retrieved.id == created_block.id
        assert retrieved.label == created_block.label
        assert retrieved.value == created_block.value

    # test with empty list
    empty_result = await block_manager.batch_create_blocks_async([], default_user)
    assert empty_result == []

    # test creating blocks with same labels (should create separate blocks since no unique constraint)
    duplicate_blocks = [
        PydanticBlock(label="duplicate_label", value="Block 1"),
        PydanticBlock(label="duplicate_label", value="Block 2"),
        PydanticBlock(label="duplicate_label", value="Block 3"),
    ]

    created_duplicates = await block_manager.batch_create_blocks_async(duplicate_blocks, default_user)
    assert len(created_duplicates) == 3
    assert all(b.label == "duplicate_label" for b in created_duplicates)
    # all should have different ids
    ids = [b.id for b in created_duplicates]
    assert len(set(ids)) == 3  # all unique ids
    # but different values
    values = [b.value for b in created_duplicates]
    assert set(values) == {"Block 1", "Block 2", "Block 3"}


@pytest.mark.asyncio
async def test_get_blocks(server, default_user):
    block_manager = BlockManager()

    # Create blocks to retrieve later
    await block_manager.create_or_update_block_async(PydanticBlock(label="human", value="Block 1"), actor=default_user)
    await block_manager.create_or_update_block_async(PydanticBlock(label="persona", value="Block 2"), actor=default_user)

    # Retrieve blocks by different filters
    all_blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(all_blocks) == 2

    human_blocks = await block_manager.get_blocks_async(actor=default_user, label="human")
    assert len(human_blocks) == 1
    assert human_blocks[0].label == "human"

    persona_blocks = await block_manager.get_blocks_async(actor=default_user, label="persona")
    assert len(persona_blocks) == 1
    assert persona_blocks[0].label == "persona"


@pytest.mark.asyncio
async def test_get_blocks_comprehensive(server, default_user, other_user_different_org):
    def random_label(prefix="label"):
        return f"{prefix}_{''.join(random.choices(string.ascii_lowercase, k=6))}"

    def random_value():
        return "".join(random.choices(string.ascii_letters + string.digits, k=12))

    block_manager = BlockManager()

    # Create 10 blocks for default_user
    default_user_blocks = []
    for _ in range(10):
        label = random_label("default")
        value = random_value()
        await block_manager.create_or_update_block_async(PydanticBlock(label=label, value=value), actor=default_user)
        default_user_blocks.append((label, value))

    # Create 3 blocks for other_user
    other_user_blocks = []
    for _ in range(3):
        label = random_label("other")
        value = random_value()
        await block_manager.create_or_update_block_async(PydanticBlock(label=label, value=value), actor=other_user_different_org)
        other_user_blocks.append((label, value))

    # Check default_user sees only their blocks
    retrieved_default_blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(retrieved_default_blocks) == 10
    retrieved_labels = {b.label for b in retrieved_default_blocks}
    for label, value in default_user_blocks:
        assert label in retrieved_labels

    # Check individual filtering for default_user
    for label, value in default_user_blocks:
        filtered = await block_manager.get_blocks_async(actor=default_user, label=label)
        assert len(filtered) == 1
        assert filtered[0].label == label
        assert filtered[0].value == value

    # Check other_user sees only their blocks
    retrieved_other_blocks = await block_manager.get_blocks_async(actor=other_user_different_org)
    assert len(retrieved_other_blocks) == 3
    retrieved_labels = {b.label for b in retrieved_other_blocks}
    for label, value in other_user_blocks:
        assert label in retrieved_labels

    # Other user shouldn't see default_user's blocks
    for label, _ in default_user_blocks:
        assert (await block_manager.get_blocks_async(actor=other_user_different_org, label=label)) == []

    # Default user shouldn't see other_user's blocks
    for label, _ in other_user_blocks:
        assert (await block_manager.get_blocks_async(actor=default_user, label=label)) == []


@pytest.mark.asyncio
async def test_update_block(server: SyncServer, default_user):
    block_manager = BlockManager()
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="persona", value="Original Content"), actor=default_user)

    # Update block's content
    update_data = BlockUpdate(value="Updated Content", description="Updated description")
    await block_manager.update_block_async(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block
    updated_block = await block_manager.get_block_by_id_async(actor=default_user, block_id=block.id)

    # Assertions to verify the update
    assert updated_block.value == "Updated Content"
    assert updated_block.description == "Updated description"


@pytest.mark.asyncio
async def test_update_block_limit(server: SyncServer, default_user):
    block_manager = BlockManager()
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="persona", value="Original Content"), actor=default_user)

    limit = len("Updated Content") * 2000
    update_data = BlockUpdate(value="Updated Content" * 2000, description="Updated description")

    # Check that exceeding the block limit raises an exception
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.update_block_async(block_id=block.id, block_update=update_data, actor=default_user)

    # Ensure the update works when within limits
    update_data = BlockUpdate(value="Updated Content" * 2000, description="Updated description", limit=limit)
    await block_manager.update_block_async(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block and validate the update
    updated_block = await block_manager.get_block_by_id_async(actor=default_user, block_id=block.id)

    assert updated_block.value == "Updated Content" * 2000
    assert updated_block.description == "Updated description"


@pytest.mark.asyncio
async def test_update_block_limit_does_not_reset(server: SyncServer, default_user):
    block_manager = BlockManager()
    new_content = "Updated Content" * 2000
    limit = len(new_content)
    block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="persona", value="Original Content", limit=limit), actor=default_user
    )

    # Ensure the update works
    update_data = BlockUpdate(value=new_content)
    await block_manager.update_block_async(block_id=block.id, block_update=update_data, actor=default_user)

    # Retrieve the updated block and validate the update
    updated_block = await block_manager.get_block_by_id_async(actor=default_user, block_id=block.id)
    assert updated_block.value == new_content


@pytest.mark.asyncio
async def test_update_nonexistent_block(server: SyncServer, default_user):
    """Test that updating a non-existent block raises NoResultFound (which maps to 404)."""
    block_manager = BlockManager()

    # Try to update a block that doesn't exist
    nonexistent_block_id = "block-7d73d0a7-6e86-4db7-b53a-411c11ed958a"
    update_data = BlockUpdate(value="Updated Content")

    with pytest.raises(NoResultFound):
        await block_manager.update_block_async(block_id=nonexistent_block_id, block_update=update_data, actor=default_user)


@pytest.mark.asyncio
async def test_delete_block(server: SyncServer, default_user):
    block_manager = BlockManager()

    # Create and delete a block
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="human", value="Sample content"), actor=default_user)
    await block_manager.delete_block_async(block_id=block.id, actor=default_user)

    # Verify that the block was deleted
    blocks = await block_manager.get_blocks_async(actor=default_user)
    assert len(blocks) == 0


@pytest.mark.asyncio
async def test_delete_block_detaches_from_agent(server: SyncServer, sarah_agent, default_user):
    # Create and delete a block
    block = await server.block_manager.create_or_update_block_async(
        PydanticBlock(label="human", value="Sample content"), actor=default_user
    )
    agent_state = await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=block.id, actor=default_user)

    # Check that block has been attached
    assert block.id in [b.id for b in agent_state.memory.blocks]

    # Now attempt to delete the block
    await server.block_manager.delete_block_async(block_id=block.id, actor=default_user)

    # Verify that the block was deleted
    blocks = await server.block_manager.get_blocks_async(actor=default_user)
    assert len(blocks) == 0

    # Check that block has been detached too
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert block.id not in [b.id for b in agent_state.memory.blocks]


@pytest.mark.asyncio
async def test_get_agents_for_block(server: SyncServer, sarah_agent, charles_agent, default_user):
    # Create and delete a block
    block = await server.block_manager.create_or_update_block_async(
        PydanticBlock(label="alien", value="Sample content"), actor=default_user
    )
    sarah_agent = await server.agent_manager.attach_block_async(agent_id=sarah_agent.id, block_id=block.id, actor=default_user)
    charles_agent = await server.agent_manager.attach_block_async(agent_id=charles_agent.id, block_id=block.id, actor=default_user)

    # Check that block has been attached to both
    assert block.id in [b.id for b in sarah_agent.memory.blocks]
    assert block.id in [b.id for b in charles_agent.memory.blocks]

    # Get the agents for that block
    agent_states = await server.block_manager.get_agents_for_block_async(block_id=block.id, actor=default_user)
    assert len(agent_states) == 2

    # Check both agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids


@pytest.mark.asyncio
async def test_batch_create_multiple_blocks(server: SyncServer, default_user):
    block_manager = BlockManager()
    num_blocks = 10

    # Prepare distinct blocks
    blocks_to_create = [PydanticBlock(label=f"batch_label_{i}", value=f"batch_value_{i}") for i in range(num_blocks)]

    # Create the blocks
    created_blocks = await block_manager.batch_create_blocks_async(blocks_to_create, actor=default_user)
    assert len(created_blocks) == num_blocks

    # Map created blocks by label for lookup
    created_by_label = {blk.label: blk for blk in created_blocks}

    # Assert all blocks were created correctly
    for i in range(num_blocks):
        label = f"batch_label_{i}"
        value = f"batch_value_{i}"
        assert label in created_by_label, f"Missing label: {label}"
        blk = created_by_label[label]
        assert blk.value == value
        assert blk.id is not None

    # Confirm all created blocks exist in the full list from get_blocks
    all_labels = {blk.label for blk in await block_manager.get_blocks_async(actor=default_user)}
    expected_labels = {f"batch_label_{i}" for i in range(num_blocks)}
    assert expected_labels.issubset(all_labels)


async def test_bulk_update_skips_missing_and_truncates_then_returns_none(server: SyncServer, default_user: PydanticUser, caplog):
    mgr = BlockManager()

    # create one block with a small limit
    b = await mgr.create_or_update_block_async(
        PydanticBlock(label="human", value="orig", limit=5),
        actor=default_user,
    )

    # prepare updates: one real id with an over‐limit value, plus one missing id
    long_val = random_string(10)  # length > limit==5
    updates = {
        b.id: long_val,
        "nonexistent-id": "whatever",
    }

    caplog.set_level(logging.WARNING)
    result = await mgr.bulk_update_block_values_async(updates, actor=default_user)
    # default return_hydrated=False → should be None
    assert result is None

    # warnings should mention skipping the missing ID and truncation
    assert "skipping during bulk update" in caplog.text
    assert "truncating" in caplog.text

    # confirm the value was truncated to `limit` characters
    reloaded = await mgr.get_block_by_id_async(actor=default_user, block_id=b.id)
    assert len(reloaded.value) == 5
    assert reloaded.value == long_val[:5]


@pytest.mark.skip(reason="TODO: implement for async")
async def test_bulk_update_return_hydrated_true(server: SyncServer, default_user: PydanticUser):
    mgr = BlockManager()

    # create a block
    b = await mgr.create_or_update_block_async(
        PydanticBlock(label="persona", value="foo", limit=20),
        actor=default_user,
    )

    updates = {b.id: "new-val"}
    updated = await mgr.bulk_update_block_values_async(updates, actor=default_user, return_hydrated=True)

    # with return_hydrated=True, we get back a list of schemas
    assert isinstance(updated, list) and len(updated) == 1
    assert updated[0].id == b.id
    assert updated[0].value == "new-val"


async def test_bulk_update_respects_org_scoping(
    server: SyncServer, default_user: PydanticUser, other_user_different_org: PydanticUser, caplog
):
    mgr = BlockManager()

    # one block in each org
    mine = await mgr.create_or_update_block_async(
        PydanticBlock(label="human", value="mine", limit=100),
        actor=default_user,
    )
    theirs = await mgr.create_or_update_block_async(
        PydanticBlock(label="human", value="theirs", limit=100),
        actor=other_user_different_org,
    )

    updates = {
        mine.id: "updated-mine",
        theirs.id: "updated-theirs",
    }

    caplog.set_level(logging.WARNING)
    await mgr.bulk_update_block_values_async(updates, actor=default_user)

    # mine should be updated...
    reloaded_mine = await mgr.get_block_by_id_async(actor=default_user, block_id=mine.id)
    assert reloaded_mine.value == "updated-mine"

    # ...theirs should remain untouched
    reloaded_theirs = await mgr.get_block_by_id_async(actor=other_user_different_org, block_id=theirs.id)
    assert reloaded_theirs.value == "theirs"

    # warning should mention skipping the other-org ID
    assert "skipping during bulk update" in caplog.text


# ======================================================================================================================
# Block Manager Tests - Checkpointing
# ======================================================================================================================


@pytest.mark.asyncio
async def test_checkpoint_creates_history(server: SyncServer, default_user):
    """
    Ensures that calling checkpoint_block creates a BlockHistory row and updates
    the block's current_history_entry_id appropriately.
    """

    block_manager = BlockManager()

    # Create a block
    initial_value = "Initial block content"
    created_block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="test_checkpoint", value=initial_value), actor=default_user
    )

    # Act: checkpoint it
    await block_manager.checkpoint_block_async(block_id=created_block.id, actor=default_user)

    async with db_registry.async_session() as session:
        # Get BlockHistory entries for this block
        from sqlalchemy import select

        stmt = select(BlockHistory).filter(BlockHistory.block_id == created_block.id)
        result = await session.execute(stmt)
        history_entries = list(result.scalars().all())
        assert len(history_entries) == 1, "Exactly one history entry should be created"
        hist = history_entries[0]

        # Fetch ORM block for internal checks
        db_block = await session.get(Block, created_block.id)

        assert hist.sequence_number == 1
        assert hist.value == initial_value
        assert hist.actor_type == ActorType.LETTA_USER
        assert hist.actor_id == default_user.id
        assert db_block.current_history_entry_id == hist.id


@pytest.mark.asyncio
async def test_multiple_checkpoints(server: SyncServer, default_user):
    block_manager = BlockManager()

    # Create a block
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="test_multi_checkpoint", value="v1"), actor=default_user)

    # 1) First checkpoint
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user)

    # 2) Update block content
    updated_block_data = PydanticBlock(**block.model_dump())
    updated_block_data.value = "v2"
    await block_manager.create_or_update_block_async(updated_block_data, actor=default_user)

    # 3) Second checkpoint
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user)

    async with db_registry.async_session() as session:
        from sqlalchemy import select

        stmt = select(BlockHistory).filter(BlockHistory.block_id == block.id).order_by(BlockHistory.sequence_number.asc())
        result = await session.execute(stmt)
        history_entries = list(result.scalars().all())
        assert len(history_entries) == 2, "Should have two history entries"

        # First is seq=1, value='v1'
        assert history_entries[0].sequence_number == 1
        assert history_entries[0].value == "v1"

        # Second is seq=2, value='v2'
        assert history_entries[1].sequence_number == 2
        assert history_entries[1].value == "v2"

        # The block should now point to the second entry
        db_block = await session.get(Block, block.id)
        assert db_block.current_history_entry_id == history_entries[1].id


@pytest.mark.asyncio
async def test_checkpoint_with_agent_id(server: SyncServer, default_user, sarah_agent):
    """
    Ensures that if we pass agent_id to checkpoint_block, we get
    actor_type=LETTA_AGENT, actor_id=<agent.id> in BlockHistory.
    """
    block_manager = BlockManager()

    # Create a block
    block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="test_agent_checkpoint", value="Agent content"), actor=default_user
    )

    # Checkpoint with agent_id
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user, agent_id=sarah_agent.id)

    # Verify
    async with db_registry.async_session() as session:
        from sqlalchemy import select

        stmt = select(BlockHistory).filter(BlockHistory.block_id == block.id)
        result = await session.execute(stmt)
        hist_entry = result.scalar_one()
        assert hist_entry.actor_type == ActorType.LETTA_AGENT
        assert hist_entry.actor_id == sarah_agent.id


@pytest.mark.asyncio
async def test_checkpoint_with_no_state_change(server: SyncServer, default_user):
    """
    If we call checkpoint_block twice without any edits,
    we expect two entries or only one, depending on your policy.
    """
    block_manager = BlockManager()

    # Create block
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="test_no_change", value="original"), actor=default_user)

    # 1) checkpoint
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user)
    # 2) checkpoint again (no changes)
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user)

    async with db_registry.async_session() as session:
        from sqlalchemy import select

        stmt = select(BlockHistory).filter(BlockHistory.block_id == block.id)
        result = await session.execute(stmt)
        all_hist = list(result.scalars().all())
        assert len(all_hist) == 2


@pytest.mark.asyncio
async def test_checkpoint_concurrency_stale(server: SyncServer, default_user):
    block_manager = BlockManager()

    # create block
    block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="test_stale_checkpoint", value="hello"), actor=default_user
    )

    # session1 loads
    async with db_registry.async_session() as s1:
        block_s1 = await s1.get(Block, block.id)  # version=1

    # session2 loads
    async with db_registry.async_session() as s2:
        block_s2 = await s2.get(Block, block.id)  # also version=1

    # session1 checkpoint => version=2
    async with db_registry.async_session() as s1:
        block_s1 = await s1.merge(block_s1)
        await block_manager.checkpoint_block_async(
            block_id=block_s1.id,
            actor=default_user,
            use_preloaded_block=block_s1,  # let manager use the object in memory
        )
        # commits inside checkpoint_block => version goes to 2

    # session2 tries to checkpoint => sees old version=1 => stale error
    with pytest.raises(StaleDataError):
        async with db_registry.async_session() as s2:
            block_s2 = await s2.merge(block_s2)
            await block_manager.checkpoint_block_async(
                block_id=block_s2.id,
                actor=default_user,
                use_preloaded_block=block_s2,
            )


@pytest.mark.asyncio
async def test_checkpoint_no_future_states(server: SyncServer, default_user):
    """
    Ensures that if the block is already at the highest sequence,
    creating a new checkpoint does NOT delete anything.
    """

    block_manager = BlockManager()

    # 1) Create block with "v1" and checkpoint => seq=1
    block_v1 = await block_manager.create_or_update_block_async(PydanticBlock(label="no_future_test", value="v1"), actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # 2) Create "v2" and checkpoint => seq=2
    updated_data = PydanticBlock(**block_v1.model_dump())
    updated_data.value = "v2"
    await block_manager.create_or_update_block_async(updated_data, actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # So we have seq=1: v1, seq=2: v2. No "future" states.
    # 3) Another checkpoint (no changes made) => should become seq=3, not delete anything
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    async with db_registry.async_session() as session:
        # We expect 3 rows in block_history, none removed
        from sqlalchemy import select

        stmt = select(BlockHistory).filter(BlockHistory.block_id == block_v1.id).order_by(BlockHistory.sequence_number.asc())
        result = await session.execute(stmt)
        history_rows = list(result.scalars().all())
        # Should be seq=1, seq=2, seq=3
        assert len(history_rows) == 3
        assert history_rows[0].value == "v1"
        assert history_rows[1].value == "v2"
        # The last is also "v2" if we didn't change it, or the same current fields
        assert history_rows[2].sequence_number == 3
        # There's no leftover row that was deleted


# ======================================================================================================================
# Block Manager Tests - Undo
# ======================================================================================================================


@pytest.mark.asyncio
async def test_undo_checkpoint_block(server: SyncServer, default_user):
    """
    Verifies that we can undo to the previous checkpoint:
      1) Create a block and checkpoint -> sequence_number=1
      2) Update block content and checkpoint -> sequence_number=2
      3) Undo -> should revert block to sequence_number=1's content
    """
    block_manager = BlockManager()

    # 1) Create block
    initial_value = "Version 1 content"
    created_block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="undo_test", value=initial_value), actor=default_user
    )

    # 2) First checkpoint => seq=1
    await block_manager.checkpoint_block_async(block_id=created_block.id, actor=default_user)

    # 3) Update block content to "Version 2"
    updated_data = PydanticBlock(**created_block.model_dump())
    updated_data.value = "Version 2 content"
    await block_manager.create_or_update_block_async(updated_data, actor=default_user)

    # 4) Second checkpoint => seq=2
    await block_manager.checkpoint_block_async(block_id=created_block.id, actor=default_user)

    # 5) Undo => revert to seq=1
    undone_block = await block_manager.undo_checkpoint_block(block_id=created_block.id, actor=default_user)

    # 6) Verify the block is now restored to "Version 1" content
    assert undone_block.value == initial_value, "Block should revert to version 1 content"
    assert undone_block.label == "undo_test", "Label should also revert if changed (or remain the same if unchanged)"


# @pytest.mark.asyncio
# async def test_checkpoint_deletes_future_states_after_undo(server: SyncServer, default_user):
#    """
#    Verifies that once we've undone to an earlier checkpoint, creating a new
#    checkpoint removes any leftover 'future' states that existed beyond that sequence.
#    """
#    block_manager = BlockManager()
#
#    # 1) Create block
#    block_init = PydanticBlock(label="test_truncation", value="v1")
#    block_v1 = await block_manager.create_or_update_block_async(block_init, actor=default_user)
#    # Checkpoint => seq=1
#    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)
#
#    # 2) Update to "v2", checkpoint => seq=2
#    block_v2 = PydanticBlock(**block_v1.model_dump())
#    block_v2.value = "v2"
#    await block_manager.create_or_update_block_async(block_v2, actor=default_user)
#    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)
#
#    # 3) Update to "v3", checkpoint => seq=3
#    block_v3 = PydanticBlock(**block_v1.model_dump())
#    block_v3.value = "v3"
#    await block_manager.create_or_update_block_async(block_v3, actor=default_user)
#    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)
#
#    # We now have three states in history: seq=1 (v1), seq=2 (v2), seq=3 (v3).
#
#    # Undo from seq=3 -> seq=2
#    block_undo_1 = await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
#    assert block_undo_1.value == "v2"
#
#    # Undo from seq=2 -> seq=1
#    block_undo_2 = await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
#    assert block_undo_2.value == "v1"
#
#    # 4) Now we are at seq=1. If we checkpoint again, we should remove the old seq=2,3
#    #    because the new code truncates future states beyond seq=1.
#
#    # Let's do a new edit: "v1.5"
#    block_v1_5 = PydanticBlock(**block_undo_2.model_dump())
#    block_v1_5.value = "v1.5"
#    await block_manager.create_or_update_block_async(block_v1_5, actor=default_user)
#
#    # 5) Checkpoint => new seq=2, removing the old seq=2 and seq=3
#    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)
#
#    async with db_registry.async_session() as session:
#        # Let's see which BlockHistory rows remain
#        from sqlalchemy import select
#
#        stmt = select(BlockHistory).filter(BlockHistory.block_id == block_v1.id).order_by(BlockHistory.sequence_number.asc())
#        result = await session.execute(stmt)
#        history_entries = list(result.scalars().all())
#
#        # We expect two rows: seq=1 => "v1", seq=2 => "v1.5"
#        assert len(history_entries) == 2, f"Expected 2 entries, got {len(history_entries)}"
#        assert history_entries[0].sequence_number == 1
#        assert history_entries[0].value == "v1"
#        assert history_entries[1].sequence_number == 2
#        assert history_entries[1].value == "v1.5"
#
#        # No row should contain "v2" or "v3"
#        existing_values = {h.value for h in history_entries}
#        assert "v2" not in existing_values, "Old seq=2 should have been removed."
#        assert "v3" not in existing_values, "Old seq=3 should have been removed."


@pytest.mark.asyncio
async def test_undo_no_history(server: SyncServer, default_user):
    """
    If a block has never been checkpointed (no current_history_entry_id),
    undo_checkpoint_block should raise a LettaInvalidArgumentError.
    """
    block_manager = BlockManager()

    # Create a block but don't checkpoint it
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="no_history_test", value="initial"), actor=default_user)

    # Attempt to undo
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.undo_checkpoint_block(block_id=block.id, actor=default_user)


@pytest.mark.asyncio
async def test_undo_first_checkpoint(server: SyncServer, default_user):
    """
    If the block is at the first checkpoint (sequence_number=1),
    undo should fail because there's no prior checkpoint.
    """
    block_manager = BlockManager()

    # 1) Create the block
    block_data = PydanticBlock(label="first_checkpoint", value="Version1")
    block = await block_manager.create_or_update_block_async(block_data, actor=default_user)

    # 2) First checkpoint => seq=1
    await block_manager.checkpoint_block_async(block_id=block.id, actor=default_user)

    # Attempt undo -> expect LettaInvalidArgumentError
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.undo_checkpoint_block(block_id=block.id, actor=default_user)


@pytest.mark.asyncio
async def test_undo_multiple_checkpoints(server: SyncServer, default_user):
    """
    Tests multiple checkpoints in a row, then undo repeatedly
    from seq=3 -> seq=2 -> seq=1, verifying each revert.
    """
    block_manager = BlockManager()

    # Step 1: Create block
    block_data = PydanticBlock(label="multi_checkpoint", value="v1")
    block_v1 = await block_manager.create_or_update_block_async(block_data, actor=default_user)
    # checkpoint => seq=1
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # Step 2: Update to v2, checkpoint => seq=2
    block_data_v2 = PydanticBlock(**block_v1.model_dump())
    block_data_v2.value = "v2"
    await block_manager.create_or_update_block_async(block_data_v2, actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # Step 3: Update to v3, checkpoint => seq=3
    block_data_v3 = PydanticBlock(**block_v1.model_dump())
    block_data_v3.value = "v3"
    await block_manager.create_or_update_block_async(block_data_v3, actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # Now we have 3 seq: v1, v2, v3
    # Undo from seq=3 -> seq=2
    undone_block = await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v2"

    # Undo from seq=2 -> seq=1
    undone_block = await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v1"

    # Try once more -> fails because seq=1 is the earliest
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)


@pytest.mark.asyncio
async def test_undo_concurrency_stale(server: SyncServer, default_user):
    """
    Demonstrate concurrency: both sessions start with the block at seq=2,
    one session undoes first -> block now seq=1, version increments,
    the other session tries to undo with stale data -> StaleDataError.
    """
    block_manager = BlockManager()

    # 1) create block
    block_data = PydanticBlock(label="concurrency_undo", value="v1")
    block_v1 = await block_manager.create_or_update_block_async(block_data, actor=default_user)
    # checkpoint => seq=1
    await block_manager.checkpoint_block_async(block_v1.id, actor=default_user)

    # 2) update to v2
    block_data_v2 = PydanticBlock(**block_v1.model_dump())
    block_data_v2.value = "v2"
    await block_manager.create_or_update_block_async(block_data_v2, actor=default_user)
    # checkpoint => seq=2
    await block_manager.checkpoint_block_async(block_v1.id, actor=default_user)

    # Now block is at seq=2

    # session1 preloads the block
    async with db_registry.async_session() as s1:
        block_s1 = await s1.get(Block, block_v1.id)  # version=? let's say 2 in memory

    # session2 also preloads the block
    async with db_registry.async_session() as s2:
        block_s2 = await s2.get(Block, block_v1.id)  # also version=2

    # Session1 -> undo to seq=1
    await block_manager.undo_checkpoint_block(
        block_id=block_v1.id,
        actor=default_user,
        use_preloaded_block=block_s1,  # stale object from session1
    )
    # This commits first => block now points to seq=1, version increments

    # Session2 tries the same undo, but it's stale
    with pytest.raises(StaleDataError):
        await block_manager.undo_checkpoint_block(
            block_id=block_v1.id, actor=default_user, use_preloaded_block=block_s2
        )  # also seq=2 in memory


# ======================================================================================================================
# Block Manager Tests - Redo
# ======================================================================================================================


@pytest.mark.asyncio
async def test_redo_checkpoint_block(server: SyncServer, default_user):
    """
    1) Create a block with value v1 -> checkpoint => seq=1
    2) Update to v2 -> checkpoint => seq=2
    3) Update to v3 -> checkpoint => seq=3
    4) Undo once (seq=3 -> seq=2)
    5) Redo once (seq=2 -> seq=3)
    """

    block_manager = BlockManager()

    # 1) Create block, set value='v1'; checkpoint => seq=1
    block_v1 = await block_manager.create_or_update_block_async(PydanticBlock(label="redo_test", value="v1"), actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # 2) Update to 'v2'; checkpoint => seq=2
    block_v2 = PydanticBlock(**block_v1.model_dump())
    block_v2.value = "v2"
    await block_manager.create_or_update_block_async(block_v2, actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # 3) Update to 'v3'; checkpoint => seq=3
    block_v3 = PydanticBlock(**block_v1.model_dump())
    block_v3.value = "v3"
    await block_manager.create_or_update_block_async(block_v3, actor=default_user)
    await block_manager.checkpoint_block_async(block_id=block_v1.id, actor=default_user)

    # Undo from seq=3 -> seq=2
    undone_block = await block_manager.undo_checkpoint_block(block_v1.id, actor=default_user)
    assert undone_block.value == "v2", "After undo, block should revert to v2"

    # Redo from seq=2 -> seq=3
    redone_block = await block_manager.redo_checkpoint_block(block_v1.id, actor=default_user)
    assert redone_block.value == "v3", "After redo, block should go back to v3"


@pytest.mark.asyncio
async def test_redo_no_history(server: SyncServer, default_user):
    """
    If a block has no current_history_entry_id (never checkpointed),
    then redo_checkpoint_block should raise LettaInvalidArgumentError.
    """
    block_manager = BlockManager()

    # Create block with no checkpoint
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="redo_no_history", value="v0"), actor=default_user)

    # Attempt to redo => expect LettaInvalidArgumentError
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.redo_checkpoint_block(block.id, actor=default_user)


@pytest.mark.asyncio
async def test_redo_at_highest_checkpoint(server: SyncServer, default_user):
    """
    If the block is at the maximum sequence number, there's no higher checkpoint to move to.
    redo_checkpoint_block should raise LettaInvalidArgumentError.
    """
    block_manager = BlockManager()

    # 1) Create block => checkpoint => seq=1
    b_init = await block_manager.create_or_update_block_async(PydanticBlock(label="redo_highest", value="v1"), actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # 2) Another edit => seq=2
    b_next = PydanticBlock(**b_init.model_dump())
    b_next.value = "v2"
    await block_manager.create_or_update_block_async(b_next, actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # We are at seq=2, which is the highest checkpoint.
    # Attempt redo => there's no seq=3
    with pytest.raises(LettaInvalidArgumentError):
        await block_manager.redo_checkpoint_block(b_init.id, actor=default_user)


@pytest.mark.asyncio
async def test_redo_after_multiple_undo(server: SyncServer, default_user):
    """
    1) Create and checkpoint versions: v1 -> seq=1, v2 -> seq=2, v3 -> seq=3, v4 -> seq=4
    2) Undo thrice => from seq=4 to seq=1
    3) Redo thrice => from seq=1 back to seq=4
    """
    block_manager = BlockManager()

    # Step 1: create initial block => seq=1
    b_init = await block_manager.create_or_update_block_async(PydanticBlock(label="redo_multi", value="v1"), actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # seq=2
    b_v2 = PydanticBlock(**b_init.model_dump())
    b_v2.value = "v2"
    await block_manager.create_or_update_block_async(b_v2, actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # seq=3
    b_v3 = PydanticBlock(**b_init.model_dump())
    b_v3.value = "v3"
    await block_manager.create_or_update_block_async(b_v3, actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # seq=4
    b_v4 = PydanticBlock(**b_init.model_dump())
    b_v4.value = "v4"
    await block_manager.create_or_update_block_async(b_v4, actor=default_user)
    await block_manager.checkpoint_block_async(b_init.id, actor=default_user)

    # We have 4 checkpoints: v1...v4. Current is seq=4.

    # 2) Undo thrice => from seq=4 -> seq=1
    for expected_value in ["v3", "v2", "v1"]:
        undone_block = await block_manager.undo_checkpoint_block(b_init.id, actor=default_user)
        assert undone_block.value == expected_value, f"Undo should get us back to {expected_value}"

    # 3) Redo thrice => from seq=1 -> seq=4
    for expected_value in ["v2", "v3", "v4"]:
        redone_block = await block_manager.redo_checkpoint_block(b_init.id, actor=default_user)
        assert redone_block.value == expected_value, f"Redo should get us forward to {expected_value}"


@pytest.mark.asyncio
async def test_redo_concurrency_stale(server: SyncServer, default_user):
    block_manager = BlockManager()

    # 1) Create block => checkpoint => seq=1
    block = await block_manager.create_or_update_block_async(PydanticBlock(label="redo_concurrency", value="v1"), actor=default_user)
    await block_manager.checkpoint_block_async(block.id, actor=default_user)

    # 2) Another edit => checkpoint => seq=2
    block_v2 = PydanticBlock(**block.model_dump())
    block_v2.value = "v2"
    await block_manager.create_or_update_block_async(block_v2, actor=default_user)
    await block_manager.checkpoint_block_async(block.id, actor=default_user)

    # 3) Another edit => checkpoint => seq=3
    block_v3 = PydanticBlock(**block.model_dump())
    block_v3.value = "v3"
    await block_manager.create_or_update_block_async(block_v3, actor=default_user)
    await block_manager.checkpoint_block_async(block.id, actor=default_user)
    # Now the block is at seq=3 in the DB

    # 4) Undo from seq=3 -> seq=2 so that we have a known future state at seq=3
    undone_block = await block_manager.undo_checkpoint_block(block.id, actor=default_user)
    assert undone_block.value == "v2"

    # At this point the block is physically at seq=2 in DB,
    # but there's a valid row for seq=3 in block_history (the 'v3' state).

    # 5) Simulate concurrency: two sessions each read the block at seq=2
    async with db_registry.async_session() as s1:
        block_s1 = await s1.get(Block, block.id)
    async with db_registry.async_session() as s2:
        block_s2 = await s2.get(Block, block.id)

    # 6) Session1 redoes to seq=3 first -> success
    await block_manager.redo_checkpoint_block(block_id=block.id, actor=default_user, use_preloaded_block=block_s1)
    # commits => block is now seq=3 in DB, version increments

    # 7) Session2 tries to do the same from stale version
    # => we expect StaleDataError, because the second session is using
    #    an out-of-date version of the block
    with pytest.raises(StaleDataError):
        await block_manager.redo_checkpoint_block(block_id=block.id, actor=default_user, use_preloaded_block=block_s2)
