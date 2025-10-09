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
# MCPManager Tests
# ======================================================================================================================


@pytest.mark.asyncio
@patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
async def test_create_mcp_server(mock_get_client, server, default_user):
    from letta.schemas.mcp import MCPServer, MCPServerType, SSEServerConfig, StdioServerConfig
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # create mock client with required methods
    mock_client = AsyncMock()
    mock_client.connect_to_server = AsyncMock()
    mock_client.list_tools = AsyncMock(
        return_value=[
            MCPTool(
                name="get_simple_price",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "ids": {"type": "string"},
                        "vs_currencies": {"type": "string"},
                        "include_market_cap": {"type": "boolean"},
                        "include_24hr_vol": {"type": "boolean"},
                        "include_24hr_change": {"type": "boolean"},
                    },
                    "required": ["ids", "vs_currencies"],
                    "additionalProperties": False,
                },
            )
        ]
    )
    mock_client.execute_tool = AsyncMock(
        return_value=(
            '{"bitcoin": {"usd": 50000, "usd_market_cap": 900000000000, "usd_24h_vol": 30000000000, "usd_24h_change": 2.5}}',
            True,
        )
    )
    mock_get_client.return_value = mock_client

    # Test with a valid StdioServerConfig
    server_config = StdioServerConfig(
        server_name="test_server", type=MCPServerType.STDIO, command="echo 'test'", args=["arg1", "arg2"], env={"ENV1": "value1"}
    )
    mcp_server = MCPServer(server_name="test_server", server_type=MCPServerType.STDIO, stdio_config=server_config)
    created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)
    print(created_server)
    assert created_server.server_name == server_config.server_name
    assert created_server.server_type == server_config.type

    # Test with a valid SSEServerConfig
    mcp_server_name = "coingecko"
    server_url = "https://mcp.api.coingecko.com/sse"
    sse_mcp_config = SSEServerConfig(server_name=mcp_server_name, server_url=server_url)
    mcp_sse_server = MCPServer(server_name=mcp_server_name, server_type=MCPServerType.SSE, server_url=server_url)
    created_server = await server.mcp_manager.create_or_update_mcp_server(mcp_sse_server, actor=default_user)
    print(created_server)
    assert created_server.server_name == mcp_server_name
    assert created_server.server_type == MCPServerType.SSE

    # list mcp servers
    servers = await server.mcp_manager.list_mcp_servers(actor=default_user)
    print(servers)
    assert len(servers) > 0, "No MCP servers found"

    # list tools from sse server
    tools = await server.mcp_manager.list_mcp_server_tools(created_server.server_name, actor=default_user)
    print(tools)

    # call a tool from the sse server
    tool_name = "get_simple_price"
    tool_args = {
        "ids": "bitcoin",
        "vs_currencies": "usd",
        "include_market_cap": True,
        "include_24hr_vol": True,
        "include_24hr_change": True,
    }
    result = await server.mcp_manager.execute_mcp_server_tool(
        created_server.server_name, tool_name=tool_name, tool_args=tool_args, actor=default_user, environment_variables={}
    )
    print(result)

    # add a tool
    tool = await server.mcp_manager.add_tool_from_mcp_server(created_server.server_name, tool_name, actor=default_user)
    print(tool)
    assert tool.name == tool_name
    assert f"mcp:{created_server.server_name}" in tool.tags, f"Expected tag {f'mcp:{created_server.server_name}'}, got {tool.tags}"
    print("TAGS", tool.tags)


@patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
async def test_create_mcp_server_with_tools(mock_get_client, server, default_user):
    """Test that creating an MCP server automatically syncs and persists its tools."""
    from letta.functions.mcp_client.types import MCPToolHealth
    from letta.schemas.mcp import MCPServer, MCPServerType, SSEServerConfig
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Create mock tools with different health statuses
    mock_tools = [
        MCPTool(
            name="valid_tool_1",
            description="A valid tool",
            inputSchema={
                "type": "object",
                "properties": {
                    "param1": {"type": "string"},
                },
                "required": ["param1"],
            },
            health=MCPToolHealth(status="VALID", reasons=[]),
        ),
        MCPTool(
            name="valid_tool_2",
            description="Another valid tool",
            inputSchema={
                "type": "object",
                "properties": {
                    "param2": {"type": "number"},
                },
            },
            health=MCPToolHealth(status="VALID", reasons=[]),
        ),
        MCPTool(
            name="invalid_tool",
            description="An invalid tool that should be skipped",
            inputSchema={
                "type": "invalid_type",  # Invalid schema
            },
            health=MCPToolHealth(status="INVALID", reasons=["Invalid schema type"]),
        ),
        MCPTool(
            name="warning_tool",
            description="A tool with warnings but should still be persisted",
            inputSchema={
                "type": "object",
                "properties": {},
            },
            health=MCPToolHealth(status="WARNING", reasons=["No properties defined"]),
        ),
    ]

    # Create mock client
    mock_client = AsyncMock()
    mock_client.connect_to_server = AsyncMock()
    mock_client.list_tools = AsyncMock(return_value=mock_tools)
    mock_client.cleanup = AsyncMock()
    mock_get_client.return_value = mock_client

    # Create MCP server config
    server_name = f"test_server_{uuid.uuid4().hex[:8]}"
    server_url = "https://test-with-tools.example.com/sse"
    mcp_server = MCPServer(server_name=server_name, server_type=MCPServerType.SSE, server_url=server_url)

    # Create server with tools using the new method
    created_server = await server.mcp_manager.create_mcp_server_with_tools(mcp_server, actor=default_user)

    # Verify server was created
    assert created_server.server_name == server_name
    assert created_server.server_type == MCPServerType.SSE
    assert created_server.server_url == server_url

    # Verify tools were persisted (all except the invalid one)
    # Get all tools and filter by checking metadata
    all_tools = await server.tool_manager.list_tools_async(
        actor=default_user, names=["valid_tool_1", "valid_tool_2", "warning_tool", "invalid_tool"]
    )

    # Filter tools that belong to our MCP server
    persisted_tools = [
        tool
        for tool in all_tools
        if tool.metadata_
        and MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_
        and tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX].get("server_name") == server_name
    ]

    # Should have 3 tools (2 valid + 1 warning, but not the invalid one)
    assert len(persisted_tools) == 3, f"Expected 3 tools, got {len(persisted_tools)}"

    # Check tool names
    tool_names = {tool.name for tool in persisted_tools}
    assert "valid_tool_1" in tool_names
    assert "valid_tool_2" in tool_names
    assert "warning_tool" in tool_names
    assert "invalid_tool" not in tool_names  # Invalid tool should be filtered out

    # Verify each tool has correct metadata
    for tool in persisted_tools:
        assert tool.metadata_ is not None
        assert MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_
        assert tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_name"] == server_name
        assert tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX]["server_id"] == created_server.id
        assert tool.tool_type == ToolType.EXTERNAL_MCP

    # Clean up - delete the server
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    # Verify tools were also deleted (cascade) by trying to get them again
    remaining_tools = await server.tool_manager.list_tools_async(actor=default_user, names=["valid_tool_1", "valid_tool_2", "warning_tool"])

    # Filter to see if any still belong to our deleted server
    remaining_mcp_tools = [
        tool
        for tool in remaining_tools
        if tool.metadata_
        and MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_
        and tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX].get("server_name") == server_name
    ]
    assert len(remaining_mcp_tools) == 0, "Tools should be deleted when server is deleted"


@pytest.mark.asyncio
@patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
async def test_complex_schema_normalization(mock_get_client, server, default_user):
    """Test that complex MCP schemas with nested objects are normalized and accepted."""
    from letta.functions.mcp_client.types import MCPTool, MCPToolHealth
    from letta.schemas.mcp import MCPServer, MCPServerType
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Create mock tools with complex schemas that would normally be INVALID
    # These schemas have: nested $defs, $ref references, missing additionalProperties
    mock_tools = [
        # 1. Nested object with $ref (like create_person)
        MCPTool(
            name="create_person",
            description="Create a person with nested address",
            inputSchema={
                "$defs": {
                    "Address": {
                        "type": "object",
                        "properties": {
                            "street": {"type": "string"},
                            "city": {"type": "string"},
                            "zip_code": {"type": "string"},
                        },
                        "required": ["street", "city", "zip_code"],
                    },
                    "Person": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "age": {"type": "integer"},
                            "address": {"$ref": "#/$defs/Address"},
                        },
                        "required": ["name", "age"],
                    },
                },
                "type": "object",
                "properties": {"person": {"$ref": "#/$defs/Person"}},
                "required": ["person"],
            },
            health=MCPToolHealth(
                status="INVALID",
                reasons=["root: 'additionalProperties' not explicitly set", "root.properties.person: Missing 'type'"],
            ),
        ),
        # 2. List of objects (like manage_tasks)
        MCPTool(
            name="manage_tasks",
            description="Manage multiple tasks",
            inputSchema={
                "$defs": {
                    "TaskItem": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "priority": {"type": "integer", "default": 1},
                            "completed": {"type": "boolean", "default": False},
                            "tags": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["title"],
                    }
                },
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "items": {"$ref": "#/$defs/TaskItem"},
                    }
                },
                "required": ["tasks"],
            },
            health=MCPToolHealth(
                status="INVALID",
                reasons=["root: 'additionalProperties' not explicitly set", "root.properties.tasks.items: Missing 'type'"],
            ),
        ),
        # 3. Complex filter object with optional fields
        MCPTool(
            name="search_with_filters",
            description="Search with complex filters",
            inputSchema={
                "$defs": {
                    "SearchFilter": {
                        "type": "object",
                        "properties": {
                            "keywords": {"type": "array", "items": {"type": "string"}},
                            "min_score": {"type": "number"},
                            "categories": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["keywords"],
                    }
                },
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "filters": {"$ref": "#/$defs/SearchFilter"},
                },
                "required": ["query", "filters"],
            },
            health=MCPToolHealth(
                status="INVALID",
                reasons=["root: 'additionalProperties' not explicitly set", "root.properties.filters: Missing 'type'"],
            ),
        ),
    ]

    # Create mock client
    mock_client = AsyncMock()
    mock_client.connect_to_server = AsyncMock()
    mock_client.list_tools = AsyncMock(return_value=mock_tools)
    mock_client.cleanup = AsyncMock()
    mock_get_client.return_value = mock_client

    # Create MCP server
    server_name = f"test_complex_schema_{uuid.uuid4().hex[:8]}"
    server_url = "https://test-complex.example.com/sse"
    mcp_server = MCPServer(server_name=server_name, server_type=MCPServerType.SSE, server_url=server_url)

    try:
        # Create server (this will auto-sync tools)
        created_server = await server.mcp_manager.create_mcp_server_with_tools(mcp_server, actor=default_user)

        assert created_server.server_name == server_name

        # Now attempt to add each tool - they should be normalized from INVALID to acceptable
        # The normalization happens in add_tool_from_mcp_server

        # Test 1: create_person should normalize successfully
        person_tool = await server.mcp_manager.add_tool_from_mcp_server(server_name, "create_person", actor=default_user)
        assert person_tool is not None
        assert person_tool.name == "create_person"
        # Verify the schema has additionalProperties set
        assert person_tool.json_schema["parameters"]["additionalProperties"] == False
        # Verify nested $defs have additionalProperties
        if "$defs" in person_tool.json_schema["parameters"]:
            for def_name, def_schema in person_tool.json_schema["parameters"]["$defs"].items():
                if def_schema.get("type") == "object":
                    assert "additionalProperties" in def_schema, f"$defs.{def_name} missing additionalProperties after normalization"

        # Test 2: manage_tasks should normalize successfully
        tasks_tool = await server.mcp_manager.add_tool_from_mcp_server(server_name, "manage_tasks", actor=default_user)
        assert tasks_tool is not None
        assert tasks_tool.name == "manage_tasks"
        # Verify array items have explicit type
        tasks_prop = tasks_tool.json_schema["parameters"]["properties"]["tasks"]
        assert "items" in tasks_prop
        assert "type" in tasks_prop["items"], "Array items should have explicit type after normalization"

        # Test 3: search_with_filters should normalize successfully
        search_tool = await server.mcp_manager.add_tool_from_mcp_server(server_name, "search_with_filters", actor=default_user)
        assert search_tool is not None
        assert search_tool.name == "search_with_filters"

        # Verify all tools were persisted
        all_tools = await server.tool_manager.list_tools_async(
            actor=default_user, names=["create_person", "manage_tasks", "search_with_filters"]
        )

        # Filter to tools from our MCP server
        mcp_tools = [
            tool
            for tool in all_tools
            if tool.metadata_
            and MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_
            and tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX].get("server_name") == server_name
        ]

        # All 3 complex schema tools should have been normalized and persisted
        assert len(mcp_tools) == 3, f"Expected 3 normalized tools, got {len(mcp_tools)}"

        # Verify they all have the correct MCP metadata
        for tool in mcp_tools:
            assert tool.tool_type == ToolType.EXTERNAL_MCP
            assert f"mcp:{server_name}" in tool.tags

    finally:
        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)


@patch("letta.services.mcp_manager.MCPManager.get_mcp_client")
async def test_create_mcp_server_with_tools_connection_failure(mock_get_client, server, default_user):
    """Test that MCP server creation succeeds even when tool sync fails (optimistic approach)."""
    from letta.schemas.mcp import MCPServer, MCPServerType
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Create mock client that fails to connect
    mock_client = AsyncMock()
    mock_client.connect_to_server = AsyncMock(side_effect=Exception("Connection failed"))
    mock_client.cleanup = AsyncMock()
    mock_get_client.return_value = mock_client

    # Create MCP server config
    server_name = f"test_server_fail_{uuid.uuid4().hex[:8]}"
    server_url = "https://test-fail.example.com/sse"
    mcp_server = MCPServer(server_name=server_name, server_type=MCPServerType.SSE, server_url=server_url)

    # Create server with tools - should succeed despite connection failure
    created_server = await server.mcp_manager.create_mcp_server_with_tools(mcp_server, actor=default_user)

    # Verify server was created successfully
    assert created_server.server_name == server_name
    assert created_server.server_type == MCPServerType.SSE
    assert created_server.server_url == server_url

    # Verify no tools were persisted (due to connection failure)
    # Try to get tools by the names we would have expected
    all_tools = await server.tool_manager.list_tools_async(
        actor=default_user,
        names=["tool1", "tool2", "tool3"],  # Generic names since we don't know what tools would have been listed
    )

    # Filter to see if any belong to our server (there shouldn't be any)
    persisted_tools = [
        tool
        for tool in all_tools
        if tool.metadata_
        and MCP_TOOL_TAG_NAME_PREFIX in tool.metadata_
        and tool.metadata_[MCP_TOOL_TAG_NAME_PREFIX].get("server_name") == server_name
    ]
    assert len(persisted_tools) == 0, "No tools should be persisted when connection fails"

    # Clean up
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)


async def test_get_mcp_servers_by_ids(server, default_user):
    from letta.schemas.mcp import MCPServer, MCPServerType, SSEServerConfig, StdioServerConfig
    from letta.settings import tool_settings

    if tool_settings.mcp_read_from_config:
        return

    # Create multiple MCP servers for testing
    servers_data = [
        {
            "name": "test_server_1",
            "config": StdioServerConfig(
                server_name="test_server_1", type=MCPServerType.STDIO, command="echo 'test1'", args=["arg1"], env={"ENV1": "value1"}
            ),
            "type": MCPServerType.STDIO,
        },
        {
            "name": "test_server_2",
            "config": SSEServerConfig(server_name="test_server_2", server_url="https://test2.example.com/sse"),
            "type": MCPServerType.SSE,
        },
        {
            "name": "test_server_3",
            "config": SSEServerConfig(server_name="test_server_3", server_url="https://test3.example.com/mcp"),
            "type": MCPServerType.STREAMABLE_HTTP,
        },
    ]

    created_servers = []
    for server_data in servers_data:
        if server_data["type"] == MCPServerType.STDIO:
            mcp_server = MCPServer(server_name=server_data["name"], server_type=server_data["type"], stdio_config=server_data["config"])
        else:
            mcp_server = MCPServer(
                server_name=server_data["name"], server_type=server_data["type"], server_url=server_data["config"].server_url
            )

        created = await server.mcp_manager.create_or_update_mcp_server(mcp_server, actor=default_user)
        created_servers.append(created)

    # Test fetching multiple servers by IDs
    server_ids = [s.id for s in created_servers]
    fetched_servers = await server.mcp_manager.get_mcp_servers_by_ids(server_ids, actor=default_user)

    assert len(fetched_servers) == len(created_servers)
    fetched_ids = {s.id for s in fetched_servers}
    expected_ids = {s.id for s in created_servers}
    assert fetched_ids == expected_ids

    # Test fetching subset of servers
    subset_ids = server_ids[:2]
    subset_servers = await server.mcp_manager.get_mcp_servers_by_ids(subset_ids, actor=default_user)
    assert len(subset_servers) == 2
    assert all(s.id in subset_ids for s in subset_servers)

    # Test fetching with empty list
    empty_result = await server.mcp_manager.get_mcp_servers_by_ids([], actor=default_user)
    assert empty_result == []

    # Test fetching with non-existent ID mixed with valid IDs
    mixed_ids = [server_ids[0], "non-existent-id", server_ids[1]]
    mixed_result = await server.mcp_manager.get_mcp_servers_by_ids(mixed_ids, actor=default_user)
    # Should only return the existing servers
    assert len(mixed_result) == 2
    assert all(s.id in server_ids for s in mixed_result)

    # Test that servers from different organizations are not returned
    # This would require creating another user/org, but for now we'll just verify
    # that the function respects the actor's organization
    all_servers = await server.mcp_manager.list_mcp_servers(actor=default_user)
    all_server_ids = [s.id for s in all_servers]
    bulk_fetched = await server.mcp_manager.get_mcp_servers_by_ids(all_server_ids, actor=default_user)

    # All fetched servers should belong to the same organization
    assert all(s.organization_id == default_user.organization_id for s in bulk_fetched)


# Additional MCPManager OAuth session tests
@pytest.mark.asyncio
async def test_mcp_server_deletion_cascades_oauth_sessions(server, default_organization, default_user):
    """Deleting an MCP server deletes associated OAuth sessions (same user + URL)."""

    from letta.schemas.mcp import MCPOAuthSessionCreate, MCPServer as PydanticMCPServer, MCPServerType

    test_server_url = "https://test.example.com/mcp"

    # Create orphaned OAuth sessions (no server id) for same user and URL
    created_session_ids: list[str] = []
    for i in range(3):
        session = await server.mcp_manager.create_oauth_session(
            MCPOAuthSessionCreate(
                server_url=test_server_url,
                server_name=f"test_mcp_server_{i}",
                user_id=default_user.id,
                organization_id=default_organization.id,
            ),
            actor=default_user,
        )
        created_session_ids.append(session.id)

    # Create the MCP server with the same URL
    created_server = await server.mcp_manager.create_mcp_server(
        PydanticMCPServer(
            server_name=f"test_mcp_server_{str(uuid.uuid4().hex[:8])}",  # ensure unique name
            server_type=MCPServerType.SSE,
            server_url=test_server_url,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Now delete the server via manager
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    # Verify all sessions are gone
    for sid in created_session_ids:
        session = await server.mcp_manager.get_oauth_session_by_id(sid, actor=default_user)
        assert session is None, f"OAuth session {sid} should be deleted"


@pytest.mark.asyncio
async def test_oauth_sessions_with_different_url_persist(server, default_organization, default_user):
    """Sessions with different URL should not be deleted when deleting the server for another URL."""

    from letta.schemas.mcp import MCPOAuthSessionCreate, MCPServer as PydanticMCPServer, MCPServerType

    server_url = "https://test.example.com/mcp"
    other_url = "https://other.example.com/mcp"

    # Create a session for other_url (should persist)
    other_session = await server.mcp_manager.create_oauth_session(
        MCPOAuthSessionCreate(
            server_url=other_url,
            server_name="standalone_oauth",
            user_id=default_user.id,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Create the MCP server at server_url
    created_server = await server.mcp_manager.create_mcp_server(
        PydanticMCPServer(
            server_name=f"test_mcp_server_{str(uuid.uuid4().hex[:8])}",
            server_type=MCPServerType.SSE,
            server_url=server_url,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Delete the server at server_url
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    # Verify the session at other_url still exists
    persisted = await server.mcp_manager.get_oauth_session_by_id(other_session.id, actor=default_user)
    assert persisted is not None, "OAuth session with different URL should persist"


@pytest.mark.asyncio
async def test_mcp_server_creation_links_orphaned_sessions(server, default_organization, default_user):
    """Creating a server should link any existing orphaned sessions (same user + URL)."""

    from letta.schemas.mcp import MCPOAuthSessionCreate, MCPServer as PydanticMCPServer, MCPServerType

    server_url = "https://test-atomic-create.example.com/mcp"

    # Pre-create orphaned sessions (no server_id) for same user + URL
    orphaned_ids: list[str] = []
    for i in range(3):
        session = await server.mcp_manager.create_oauth_session(
            MCPOAuthSessionCreate(
                server_url=server_url,
                server_name=f"atomic_session_{i}",
                user_id=default_user.id,
                organization_id=default_organization.id,
            ),
            actor=default_user,
        )
        orphaned_ids.append(session.id)

    # Create server
    created_server = await server.mcp_manager.create_mcp_server(
        PydanticMCPServer(
            server_name=f"test_atomic_server_{str(uuid.uuid4().hex[:8])}",
            server_type=MCPServerType.SSE,
            server_url=server_url,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Sessions should still be retrievable via manager API
    for sid in orphaned_ids:
        s = await server.mcp_manager.get_oauth_session_by_id(sid, actor=default_user)
        assert s is not None

    # Indirect verification: deleting the server removes sessions for that URL+user
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)
    for sid in orphaned_ids:
        assert await server.mcp_manager.get_oauth_session_by_id(sid, actor=default_user) is None


@pytest.mark.asyncio
async def test_mcp_server_delete_removes_all_sessions_for_url_and_user(server, default_organization, default_user):
    """Deleting a server removes both linked and orphaned sessions for same user+URL."""

    from letta.schemas.mcp import MCPOAuthSessionCreate, MCPServer as PydanticMCPServer, MCPServerType

    server_url = "https://test-atomic-cleanup.example.com/mcp"

    # Create orphaned session
    orphaned = await server.mcp_manager.create_oauth_session(
        MCPOAuthSessionCreate(
            server_url=server_url,
            server_name="orphaned",
            user_id=default_user.id,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Create server
    created_server = await server.mcp_manager.create_mcp_server(
        PydanticMCPServer(
            server_name=f"cleanup_server_{str(uuid.uuid4().hex[:8])}",
            server_type=MCPServerType.SSE,
            server_url=server_url,
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )

    # Delete server
    await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)

    # Both orphaned and any linked sessions for that URL+user should be gone
    assert await server.mcp_manager.get_oauth_session_by_id(orphaned.id, actor=default_user) is None


@pytest.mark.asyncio
async def test_mcp_server_resync_tools(server, default_user, default_organization):
    """Test that resyncing MCP server tools correctly handles added, deleted, and updated tools."""
    from unittest.mock import AsyncMock, MagicMock, patch

    from letta.functions.mcp_client.types import MCPTool, MCPToolHealth
    from letta.schemas.mcp import MCPServer as PydanticMCPServer, MCPServerType
    from letta.schemas.tool import ToolCreate

    # Create MCP server
    mcp_server = await server.mcp_manager.create_mcp_server(
        PydanticMCPServer(
            server_name=f"test_resync_{uuid.uuid4().hex[:8]}",
            server_type=MCPServerType.SSE,
            server_url="https://test-resync.example.com/mcp",
            organization_id=default_organization.id,
        ),
        actor=default_user,
    )
    mcp_server_id = mcp_server.id

    try:
        # Create initial persisted tools (simulating previously added tools)
        # Use sync method like in the existing mcp_tool fixture
        tool1_create = ToolCreate.from_mcp(
            mcp_server_name=mcp_server.server_name,
            mcp_tool=MCPTool(
                name="tool1",
                description="Tool 1",
                inputSchema={"type": "object", "properties": {"param1": {"type": "string"}}},
            ),
        )
        tool1 = await server.tool_manager.create_or_update_mcp_tool_async(
            tool_create=tool1_create,
            mcp_server_name=mcp_server.server_name,
            mcp_server_id=mcp_server_id,
            actor=default_user,
        )

        tool2_create = ToolCreate.from_mcp(
            mcp_server_name=mcp_server.server_name,
            mcp_tool=MCPTool(
                name="tool2",
                description="Tool 2 to be deleted",
                inputSchema={"type": "object", "properties": {"param2": {"type": "number"}}},
            ),
        )
        tool2 = await server.tool_manager.create_or_update_mcp_tool_async(
            tool_create=tool2_create,
            mcp_server_name=mcp_server.server_name,
            mcp_server_id=mcp_server_id,
            actor=default_user,
        )

        # Mock the list_mcp_server_tools to return updated tools from server
        # tool1 is updated, tool2 is deleted, tool3 is added
        updated_tools = [
            MCPTool(
                name="tool1",
                description="Tool 1 Updated",
                inputSchema={"type": "object", "properties": {"param1": {"type": "string"}, "param1b": {"type": "boolean"}}},
                health=MCPToolHealth(status="VALID", reasons=[]),
            ),
            MCPTool(
                name="tool3",
                description="Tool 3 New",
                inputSchema={"type": "object", "properties": {"param3": {"type": "array"}}},
                health=MCPToolHealth(status="VALID", reasons=[]),
            ),
        ]

        with patch.object(server.mcp_manager, "list_mcp_server_tools", new_callable=AsyncMock) as mock_list_tools:
            mock_list_tools.return_value = updated_tools

            # Run resync
            result = await server.mcp_manager.resync_mcp_server_tools(
                mcp_server_name=mcp_server.server_name,
                actor=default_user,
            )

        # Verify the resync result
        assert len(result.deleted) == 1
        assert "tool2" in result.deleted

        assert len(result.updated) == 1
        assert "tool1" in result.updated

        assert len(result.added) == 1
        assert "tool3" in result.added

        # Verify tool2 was actually deleted
        try:
            deleted_tool = await server.tool_manager.get_tool_by_id_async(tool_id=tool2.id, actor=default_user)
            assert False, "Tool2 should have been deleted"
        except Exception:
            pass  # Expected - tool should be deleted

        # Verify tool1 was updated with new schema
        updated_tool1 = await server.tool_manager.get_tool_by_id_async(tool_id=tool1.id, actor=default_user)
        assert "param1b" in updated_tool1.json_schema["parameters"]["properties"]

        # Verify tool3 was added
        tools = await server.tool_manager.list_tools_async(actor=default_user, names=["tool3"])
        assert len(tools) == 1
        assert tools[0].name == "tool3"

    finally:
        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(mcp_server_id, actor=default_user)


# ======================================================================================================================
# MCPManager Tests - Encryption
# ======================================================================================================================


@pytest.fixture
def encryption_key():
    """Fixture to ensure encryption key is set for tests."""
    original_key = settings.encryption_key
    # Set a test encryption key if not already set
    if not settings.encryption_key:
        settings.encryption_key = "test-encryption-key-32-bytes!!"
    yield settings.encryption_key
    # Restore original
    settings.encryption_key = original_key


@pytest.mark.asyncio
async def test_mcp_server_token_encryption_on_create(server, default_user, encryption_key):
    """Test that creating an MCP server encrypts the token in the database."""
    from letta.functions.mcp_client.types import MCPServerType
    from letta.orm.mcp_server import MCPServer as MCPServerModel
    from letta.schemas.mcp import MCPServer
    from letta.schemas.secret import Secret

    # Create MCP server with token
    mcp_server = MCPServer(
        server_name="test-encrypted-server",
        server_type=MCPServerType.STREAMABLE_HTTP,
        server_url="https://api.example.com/mcp",
        token="sk-test-secret-token-12345",
    )

    created_server = await server.mcp_manager.create_mcp_server(mcp_server, actor=default_user)

    try:
        # Verify server was created
        assert created_server is not None
        assert created_server.server_name == "test-encrypted-server"

        # Verify plaintext token is accessible (dual-write during migration)
        assert created_server.token == "sk-test-secret-token-12345"

        # Verify token_enc is a Secret object
        assert created_server.token_enc is not None
        assert isinstance(created_server.token_enc, Secret)

        # Read directly from database to verify encryption
        async with db_registry.async_session() as session:
            server_orm = await MCPServerModel.read_async(
                db_session=session,
                identifier=created_server.id,
                actor=default_user,
            )

            # Verify plaintext column has the value (dual-write)
            assert server_orm.token == "sk-test-secret-token-12345"

            # Verify encrypted column is populated and different from plaintext
            assert server_orm.token_enc is not None
            assert server_orm.token_enc != "sk-test-secret-token-12345"
            # Encrypted value should be longer
            assert len(server_orm.token_enc) > len("sk-test-secret-token-12345")

    finally:
        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)


@pytest.mark.asyncio
async def test_mcp_server_token_decryption_on_read(server, default_user, encryption_key):
    """Test that reading an MCP server decrypts the token correctly."""
    from letta.functions.mcp_client.types import MCPServerType
    from letta.schemas.mcp import MCPServer
    from letta.schemas.secret import Secret

    # Create MCP server
    mcp_server = MCPServer(
        server_name="test-decrypt-server",
        server_type=MCPServerType.STREAMABLE_HTTP,
        server_url="https://api.example.com/mcp",
        token="sk-test-decrypt-token-67890",
    )

    created_server = await server.mcp_manager.create_mcp_server(mcp_server, actor=default_user)
    server_id = created_server.id

    try:
        # Read the server back
        retrieved_server = await server.mcp_manager.get_mcp_server_by_id_async(server_id, actor=default_user)

        # Verify the token is decrypted correctly
        assert retrieved_server.token == "sk-test-decrypt-token-67890"

        # Verify we can get the decrypted token through the secret getter
        token_secret = retrieved_server.get_token_secret()
        assert isinstance(token_secret, Secret)
        decrypted_token = token_secret.get_plaintext()
        assert decrypted_token == "sk-test-decrypt-token-67890"

    finally:
        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(server_id, actor=default_user)


@pytest.mark.asyncio
async def test_mcp_server_custom_headers_encryption(server, default_user, encryption_key):
    """Test that custom headers are encrypted as JSON strings."""
    from letta.functions.mcp_client.types import MCPServerType
    from letta.orm.mcp_server import MCPServer as MCPServerModel
    from letta.schemas.mcp import MCPServer
    from letta.schemas.secret import Secret

    # Create MCP server with custom headers
    custom_headers = {"Authorization": "Bearer token123", "X-API-Key": "secret-key-456"}
    mcp_server = MCPServer(
        server_name="test-headers-server",
        server_type=MCPServerType.STREAMABLE_HTTP,
        server_url="https://api.example.com/mcp",
        custom_headers=custom_headers,
    )

    created_server = await server.mcp_manager.create_mcp_server(mcp_server, actor=default_user)

    try:
        # Verify custom_headers are accessible
        assert created_server.custom_headers == custom_headers

        # Verify custom_headers_enc is a Secret object (stores JSON string)
        assert created_server.custom_headers_enc is not None
        assert isinstance(created_server.custom_headers_enc, Secret)

        # Verify the getter method returns a Secret (JSON string)
        headers_secret = created_server.get_custom_headers_secret()
        assert isinstance(headers_secret, Secret)
        # Verify the Secret contains JSON string
        json_str = headers_secret.get_plaintext()
        assert json_str is not None
        import json

        assert json.loads(json_str) == custom_headers

        # Verify the convenience method returns dict directly
        headers_dict = created_server.get_custom_headers_dict()
        assert headers_dict == custom_headers

        # Read from DB to verify encryption
        async with db_registry.async_session() as session:
            server_orm = await MCPServerModel.read_async(
                db_session=session,
                identifier=created_server.id,
                actor=default_user,
            )

            # Verify encrypted column contains encrypted JSON string
            assert server_orm.custom_headers_enc is not None
            # Decrypt and verify it's valid JSON matching original headers
            decrypted_json = Secret.from_encrypted(server_orm.custom_headers_enc).get_plaintext()
            import json

            decrypted_headers = json.loads(decrypted_json)
            assert decrypted_headers == custom_headers

    finally:
        # Clean up
        await server.mcp_manager.delete_mcp_server_by_id(created_server.id, actor=default_user)


@pytest.mark.asyncio
async def test_oauth_session_tokens_encryption(server, default_user, encryption_key):
    """Test that OAuth session tokens are encrypted in the database."""
    from letta.orm.mcp_oauth import MCPOAuth as MCPOAuthModel
    from letta.schemas.mcp import MCPOAuthSessionCreate, MCPOAuthSessionUpdate
    from letta.schemas.secret import Secret

    # Create OAuth session
    session_create = MCPOAuthSessionCreate(
        server_url="https://oauth.example.com",
        server_name="test-oauth-server",
        organization_id=default_user.organization_id,
        user_id=default_user.id,
    )

    created_session = await server.mcp_manager.create_oauth_session(session_create, actor=default_user)
    session_id = created_session.id

    try:
        # Update with OAuth tokens
        session_update = MCPOAuthSessionUpdate(
            access_token="access-token-abc123",
            refresh_token="refresh-token-xyz789",
            client_secret="client-secret-def456",
            authorization_code="auth-code-ghi012",
        )

        updated_session = await server.mcp_manager.update_oauth_session(session_id, session_update, actor=default_user)

        # Verify tokens are accessible
        assert updated_session.access_token == "access-token-abc123"
        assert updated_session.refresh_token == "refresh-token-xyz789"
        assert updated_session.client_secret == "client-secret-def456"
        assert updated_session.authorization_code == "auth-code-ghi012"

        # Verify encrypted fields are Secret objects
        assert isinstance(updated_session.access_token_enc, Secret)
        assert isinstance(updated_session.refresh_token_enc, Secret)
        assert isinstance(updated_session.client_secret_enc, Secret)
        assert isinstance(updated_session.authorization_code_enc, Secret)

        # Read from DB to verify all tokens are encrypted
        async with db_registry.async_session() as session:
            oauth_orm = await MCPOAuthModel.read_async(
                db_session=session,
                identifier=session_id,
                actor=default_user,
            )

            # Verify all encrypted columns are populated and encrypted
            assert oauth_orm.access_token_enc is not None
            assert oauth_orm.refresh_token_enc is not None
            assert oauth_orm.client_secret_enc is not None
            assert oauth_orm.authorization_code_enc is not None

            # Decrypt and verify
            assert Secret.from_encrypted(oauth_orm.access_token_enc).get_plaintext() == "access-token-abc123"
            assert Secret.from_encrypted(oauth_orm.refresh_token_enc).get_plaintext() == "refresh-token-xyz789"
            assert Secret.from_encrypted(oauth_orm.client_secret_enc).get_plaintext() == "client-secret-def456"
            assert Secret.from_encrypted(oauth_orm.authorization_code_enc).get_plaintext() == "auth-code-ghi012"

    finally:
        # Clean up
        await server.mcp_manager.delete_oauth_session(session_id, actor=default_user)
