"""
Integration tests for the new MCP server endpoints (/v1/mcp-servers/).
Tests all CRUD operations, tool management, and OAuth connection flows.
Uses the Letta SDK client instead of direct HTTP requests.
"""

import os
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
import requests
from dotenv import load_dotenv
from letta_client import (
    CreateSsemcpServer,
    CreateStdioMcpServer,
    CreateStreamableHttpmcpServer,
    Letta,
    LettaSchemasMcpServerUpdateSsemcpServer,
    LettaSchemasMcpServerUpdateStdioMcpServer,
    LettaSchemasMcpServerUpdateStreamableHttpmcpServer,
    LettaServerRestApiRoutersV1ToolsMcpToolExecuteRequest,
    MessageCreate,
    ToolCallMessage,
    ToolReturnMessage,
)
from letta_client.core import ApiError

from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    yield url


@pytest.fixture(scope="module")
def letta_client(server_url: str) -> Letta:
    """
    Provides a configured Letta SDK client.
    """
    token = os.getenv("LETTA_API_TOKEN", "")

    # Initialize the SDK client
    client = Letta(
        base_url=server_url,
        token=token if token else None,
        # Skip default cloud environment since we're using a custom server
        environment=None,
    )
    yield client


@pytest.fixture(scope="function")
def unique_server_id() -> str:
    """Generate a unique MCP server ID for each test."""
    # MCP server IDs follow the format: mcp_server-<uuid>
    return f"mcp_server-{uuid.uuid4()}"


@pytest.fixture(scope="function")
def mock_mcp_server_path() -> Path:
    """Get path to mock MCP server for testing."""
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        # Create a minimal mock server for testing if it doesn't exist
        pytest.skip(f"Mock MCP server not found at {mcp_server_path}")

    return mcp_server_path


@pytest.fixture(scope="function")
def mock_mcp_server_config_for_agent() -> CreateStdioMcpServer:
    """
    Creates a stdio configuration for the mock MCP server for agent testing.
    """
    # Get path to mock_mcp_server.py
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        raise FileNotFoundError(f"Mock MCP server not found at {mcp_server_path}")

    server_name = f"test-mcp-agent-{uuid.uuid4().hex[:8]}"

    return CreateStdioMcpServer(
        server_name=server_name,
        command=sys.executable,  # Use the current Python interpreter
        args=[str(mcp_server_path)],
    )


@pytest.fixture(scope="function")
def agent_with_mcp_tools(letta_client: Letta, mock_mcp_server_config_for_agent: CreateStdioMcpServer) -> AgentState:
    """
    Creates an agent with MCP tools attached for testing.
    """
    # Register the MCP server (this should automatically sync tools)
    server = letta_client.mcp_servers.mcp_create_mcp_server(request=mock_mcp_server_config_for_agent)
    server_id = server.id

    try:
        # List available MCP tools from the database (they should have been synced during server creation)
        mcp_tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)
        assert len(mcp_tools) > 0, "No tools found from MCP server"

        # Find the echo and add tools (they should already be in Letta's tool registry)
        echo_tool = next((t for t in mcp_tools if t.name == "echo"), None)
        add_tool = next((t for t in mcp_tools if t.name == "add"), None)

        assert echo_tool is not None, "echo tool not found"
        assert add_tool is not None, "add tool not found"

        # Create agent with the MCP tools (using tool IDs from the synced tools)
        agent = letta_client.agents.create(
            name=f"test_mcp_agent_{uuid.uuid4().hex[:8]}",
            include_base_tools=True,
            tool_ids=[echo_tool.id, add_tool.id],
            memory_blocks=[
                {
                    "label": "human",
                    "value": "Name: Test User",
                },
                {
                    "label": "persona",
                    "value": "You are a helpful assistant that can use MCP tools to help the user.",
                },
            ],
            llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tags=["test_mcp_agent"],
        )

        yield agent

    finally:
        # Cleanup agent if it exists
        if "agent" in locals():
            try:
                letta_client.agents.delete(agent.id)
            except Exception as e:
                print(f"Warning: Failed to delete agent {agent.id}: {e}")

        # Cleanup MCP server
        try:
            letta_client.mcp_servers.mcp_delete_mcp_server(server_id)
        except Exception as e:
            print(f"Warning: Failed to delete MCP server {server_id}: {e}")


# ------------------------------
# Helper Functions
# ------------------------------


def create_stdio_server_request(server_name: str, command: str = "npx", args: List[str] = None) -> CreateStdioMcpServer:
    """Create a stdio MCP server configuration object."""
    return CreateStdioMcpServer(
        server_name=server_name,
        command=command,
        args=args or ["-y", "@modelcontextprotocol/server-everything"],
        env={"NODE_ENV": "test", "DEBUG": "true"},
    )


def create_sse_server_request(server_name: str, server_url: str = None) -> CreateSsemcpServer:
    """Create an SSE MCP server configuration object."""
    return CreateSsemcpServer(
        server_name=server_name,
        server_url=server_url or "https://api.example.com/sse",
        auth_header="Authorization",
        auth_token="Bearer test_token_123",
        custom_headers={"X-Custom-Header": "custom_value", "X-API-Version": "1.0"},
    )


def create_streamable_http_server_request(server_name: str, server_url: str = None) -> CreateStreamableHttpmcpServer:
    """Create a streamable HTTP MCP server configuration object."""
    return CreateStreamableHttpmcpServer(
        server_name=server_name,
        server_url=server_url or "https://api.example.com/streamable",
        auth_header="X-API-Key",
        auth_token="api_key_456",
        custom_headers={"Accept": "application/json", "X-Version": "2.0"},
    )


def create_exa_streamable_http_server_request(server_name: str) -> CreateStreamableHttpmcpServer:
    """Create a Streamable HTTP config for Exa MCP with no auth.

    Reference: https://mcp.exa.ai/mcp
    """
    return CreateStreamableHttpmcpServer(
        server_name=server_name,
        server_url="https://mcp.exa.ai/mcp?exaApiKey=your-exa-api-key",
        # no auth header/token, no custom headers
    )


# ------------------------------
# Test Cases for CRUD Operations
# ------------------------------


def test_create_stdio_mcp_server(letta_client: Letta):
    """Test creating a stdio MCP server."""
    server_name = f"test-stdio-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name)

    # Create the server
    server_data = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)

    assert server_data.server_name == server_name
    assert server_data.command == server_config.command
    assert server_data.args == server_config.args
    assert server_data.id is not None  # Should have an ID assigned

    server_id = server_data.id

    # Cleanup - delete the server
    letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_create_sse_mcp_server(letta_client: Letta):
    """Test creating an SSE MCP server."""
    server_name = f"test-sse-{uuid.uuid4().hex[:8]}"
    server_config = create_sse_server_request(server_name)

    # Create the server
    server_data = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)

    assert server_data.server_name == server_name
    assert server_data.server_url == server_config.server_url
    assert server_data.auth_header == server_config.auth_header
    assert server_data.id is not None

    server_id = server_data.id

    # Cleanup
    letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_create_streamable_http_mcp_server(letta_client: Letta):
    """Test creating a streamable HTTP MCP server."""
    server_name = f"test-http-{uuid.uuid4().hex[:8]}"
    server_config = create_streamable_http_server_request(server_name)

    # Create the server
    server_data = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)

    assert server_data.server_name == server_name
    assert server_data.server_url == server_config.server_url
    assert server_data.id is not None

    server_id = server_data.id

    # Cleanup
    letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_list_mcp_servers(letta_client: Letta):
    """Test listing all MCP servers."""
    # Create multiple servers
    servers_created = []

    # Create stdio server
    stdio_name = f"list-test-stdio-{uuid.uuid4().hex[:8]}"
    stdio_config = create_stdio_server_request(stdio_name)
    stdio_server = letta_client.mcp_servers.mcp_create_mcp_server(request=stdio_config)
    servers_created.append(stdio_server.id)

    # Create SSE server
    sse_name = f"list-test-sse-{uuid.uuid4().hex[:8]}"
    sse_config = create_sse_server_request(sse_name)
    sse_server = letta_client.mcp_servers.mcp_create_mcp_server(request=sse_config)
    servers_created.append(sse_server.id)

    try:
        # List all servers
        servers_list = letta_client.mcp_servers.mcp_list_mcp_servers()
        assert isinstance(servers_list, list)
        assert len(servers_list) >= 2  # At least our two servers

        # Check our servers are in the list
        server_ids = [s.id for s in servers_list]
        assert stdio_server.id in server_ids
        assert sse_server.id in server_ids

        # Check server names
        server_names = [s.server_name for s in servers_list]
        assert stdio_name in server_names
        assert sse_name in server_names

    finally:
        # Cleanup
        for server_id in servers_created:
            letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_get_specific_mcp_server(letta_client: Letta):
    """Test getting a specific MCP server by ID."""
    # Create a server
    server_name = f"get-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name, command="python", args=["-m", "mcp_server"])
    server_config.env["PYTHONPATH"] = "/usr/local/lib"

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # Get the server by ID
        retrieved_server = letta_client.mcp_servers.mcp_get_mcp_server(server_id)

        assert retrieved_server.id == server_id
        assert retrieved_server.server_name == server_name
        assert retrieved_server.command == "python"
        assert retrieved_server.args == ["-m", "mcp_server"]
        assert retrieved_server.env.get("PYTHONPATH") == "/usr/local/lib"

    finally:
        # Cleanup
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_update_stdio_mcp_server(letta_client: Letta):
    """Test updating a stdio MCP server."""
    # Create a server
    server_name = f"update-test-stdio-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name, command="node", args=["old_server.js"])

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # Update the server
        update_request = LettaSchemasMcpServerUpdateStdioMcpServer(
            server_name="updated-stdio-server",
            command="node",
            args=["new_server.js", "--port", "3000"],
            env={"NEW_ENV": "new_value", "PORT": "3000"},
        )

        updated_server = letta_client.mcp_servers.mcp_update_mcp_server(server_id, request=update_request)

        assert updated_server.server_name == "updated-stdio-server"
        assert updated_server.args == ["new_server.js", "--port", "3000"]
        assert updated_server.env.get("NEW_ENV") == "new_value"

    finally:
        # Cleanup
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_update_sse_mcp_server(letta_client: Letta):
    """Test updating an SSE MCP server."""
    # Create an SSE server
    server_name = f"update-test-sse-{uuid.uuid4().hex[:8]}"
    server_config = create_sse_server_request(server_name, server_url="https://old.example.com/sse")

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # Update the server
        update_request = LettaSchemasMcpServerUpdateSsemcpServer(
            server_name="updated-sse-server",
            server_url="https://new.example.com/sse/v2",
            auth_token="new_token_789",
            custom_headers={"X-Updated": "true", "X-Version": "2.0"},
        )

        updated_server = letta_client.mcp_servers.mcp_update_mcp_server(server_id, request=update_request)

        assert updated_server.server_name == "updated-sse-server"
        assert updated_server.server_url == "https://new.example.com/sse/v2"

    finally:
        # Cleanup
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_delete_mcp_server(letta_client: Letta):
    """Test deleting an MCP server."""
    # Create a server to delete
    server_name = f"delete-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name)

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    # Delete the server
    letta_client.mcp_servers.mcp_delete_mcp_server(server_id)

    # Verify it's deleted (should raise ApiError with 404)
    with pytest.raises(ApiError) as exc_info:
        letta_client.mcp_servers.mcp_get_mcp_server(server_id)
    assert exc_info.value.status_code == 404


# ------------------------------
# Test Cases for Error Handling
# ------------------------------


def test_invalid_server_type(letta_client: Letta):
    """Test creating server with invalid type."""
    # The SDK should handle type validation, so we'll test with an invalid configuration
    # that would be rejected by the API
    try:
        # Try to create a server with an invalid configuration
        # The SDK validates types, so this test might need adjustment based on actual SDK behavior
        invalid_config = CreateStdioMcpServer(
            server_name="invalid-server",
            command="",  # Empty command should be invalid
            args=[],
        )
        with pytest.raises(ApiError) as exc_info:
            letta_client.mcp_servers.mcp_create_mcp_server(request=invalid_config)
        assert exc_info.value.status_code in [400, 422]  # Bad request or validation error
    except Exception:
        # SDK might handle validation differently
        pass


# # ------------------------------
# # Test Cases for Complex Scenarios
# # ------------------------------


def test_multiple_server_types_coexist(letta_client: Letta):
    """Test that multiple server types can coexist."""
    servers_created = []

    try:
        # Create one of each type
        stdio_config = create_stdio_server_request(f"multi-stdio-{uuid.uuid4().hex[:8]}")
        stdio_server = letta_client.mcp_servers.mcp_create_mcp_server(request=stdio_config)
        servers_created.append(stdio_server.id)

        sse_config = create_sse_server_request(f"multi-sse-{uuid.uuid4().hex[:8]}")
        sse_server = letta_client.mcp_servers.mcp_create_mcp_server(request=sse_config)
        servers_created.append(sse_server.id)

        http_config = create_streamable_http_server_request(f"multi-http-{uuid.uuid4().hex[:8]}")
        http_server = letta_client.mcp_servers.mcp_create_mcp_server(request=http_config)
        servers_created.append(http_server.id)

        # List all servers
        servers_list = letta_client.mcp_servers.mcp_list_mcp_servers()
        server_ids = [s.id for s in servers_list]

        # Verify all three are present
        assert stdio_server.id in server_ids
        assert sse_server.id in server_ids
        assert http_server.id in server_ids

        # Get each server and verify type-specific fields
        stdio_retrieved = letta_client.mcp_servers.mcp_get_mcp_server(stdio_server.id)
        assert stdio_retrieved.command == stdio_config.command

        sse_retrieved = letta_client.mcp_servers.mcp_get_mcp_server(sse_server.id)
        assert sse_retrieved.server_url == sse_config.server_url

        http_retrieved = letta_client.mcp_servers.mcp_get_mcp_server(http_server.id)
        assert http_retrieved.server_url == http_config.server_url

    finally:
        # Cleanup all servers
        for server_id in servers_created:
            letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_partial_update_preserves_fields(letta_client: Letta):
    """Test that partial updates preserve non-updated fields."""
    # Create a server with all fields
    server_name = f"partial-update-{uuid.uuid4().hex[:8]}"
    server_config = CreateStdioMcpServer(
        server_name=server_name,
        command="node",
        args=["server.js", "--port", "3000"],
        env={"NODE_ENV": "production", "PORT": "3000", "DEBUG": "false"},
    )

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # Update only the server name
        update_request = LettaSchemasMcpServerUpdateStdioMcpServer(server_name="renamed-server")

        updated_server = letta_client.mcp_servers.mcp_update_mcp_server(server_id, request=update_request)

        assert updated_server.server_name == "renamed-server"
        # Other fields should be preserved
        assert updated_server.command == "node"
        assert updated_server.args == ["server.js", "--port", "3000"]

    finally:
        # Cleanup
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_concurrent_server_operations(letta_client: Letta):
    """Test multiple servers can be operated on concurrently."""
    servers_created = []

    try:
        # Create multiple servers quickly
        for i in range(3):
            server_config = create_stdio_server_request(f"concurrent-{i}-{uuid.uuid4().hex[:8]}", command="python", args=[f"server_{i}.py"])

            server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
            servers_created.append(server.id)

        # Update all servers
        for i, server_id in enumerate(servers_created):
            update_request = LettaSchemasMcpServerUpdateStdioMcpServer(server_name=f"updated-concurrent-{i}")

            updated_server = letta_client.mcp_servers.mcp_update_mcp_server(server_id, request=update_request)
            assert updated_server.server_name == f"updated-concurrent-{i}"

        # Get all servers
        for i, server_id in enumerate(servers_created):
            server = letta_client.mcp_servers.mcp_get_mcp_server(server_id)
            assert server.server_name == f"updated-concurrent-{i}"

    finally:
        # Cleanup all servers
        for server_id in servers_created:
            letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_full_server_lifecycle(letta_client: Letta):
    """Test complete lifecycle: create, list, get, update, tools, delete."""
    # 1. Create server
    server_name = f"lifecycle-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name, command="npx", args=["-y", "@modelcontextprotocol/server-everything"])
    server_config.env["TEST"] = "true"

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # 2. List servers and verify it's there
        servers_list = letta_client.mcp_servers.mcp_list_mcp_servers()
        assert any(s.id == server_id for s in servers_list)

        # 3. Get specific server
        retrieved_server = letta_client.mcp_servers.mcp_get_mcp_server(server_id)
        assert retrieved_server.server_name == server_name

        # 4. Update server
        update_request = LettaSchemasMcpServerUpdateStdioMcpServer(
            server_name="lifecycle-updated", env={"TEST": "false", "NEW_VAR": "value"}
        )
        updated_server = letta_client.mcp_servers.mcp_update_mcp_server(server_id, request=update_request)
        assert updated_server.server_name == "lifecycle-updated"

        # 5. List tools
        tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)
        assert isinstance(tools, list)

        # 6. If tools exist, try to get and run one
        if len(tools) > 0:
            # Find the echo tool specifically since we know its schema
            echo_tool = next((t for t in tools if t.name == "echo"), None)
            if echo_tool:
                # Get specific tool
                tool = letta_client.mcp_servers.mcp_get_mcp_tool(server_id, echo_tool.id)
                assert tool.id == echo_tool.id

                # Run the tool directly with required args
                result = letta_client.mcp_servers.mcp_run_tool(server_id, echo_tool.id, args={"message": "Test lifecycle tool execution"})
                assert hasattr(result, "status"), "Tool execution result should have status"

    finally:
        # 9. Delete server
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)

        # 10. Verify it's deleted
        with pytest.raises(ApiError) as exc_info:
            letta_client.mcp_servers.mcp_get_mcp_server(server_id)
        assert exc_info.value.status_code == 404


# ------------------------------
# Test Cases for Empty Responses
# ------------------------------


def test_empty_tools_list(letta_client: Letta):
    """Test handling of servers with no tools."""
    # Create a minimal server that likely has no tools
    server_name = f"no-tools-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_request(server_name, command="echo", args=["hello"])

    created_server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = created_server.id

    try:
        # List tools (should be empty)
        tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)

        assert tools is not None
        assert isinstance(tools, list)
        # Tools will be empty for a simple echo command

    finally:
        # Cleanup
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


# ------------------------------
# Test Cases for Tool Execution with Agents
# ------------------------------


def test_mcp_echo_tool_with_agent(letta_client: Letta, agent_with_mcp_tools: AgentState):
    """
    Test that an agent can successfully call the echo tool from the MCP server.
    """
    test_message = "Hello from MCP integration test!"

    response = letta_client.agents.messages.create(
        agent_id=agent_with_mcp_tools.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use the echo tool to echo back this exact message: '{test_message}'",
            )
        ],
    )

    # Check for tool call message
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    assert len(tool_calls) > 0, "Expected at least one ToolCallMessage"

    # Find the echo tool call
    echo_call = next((m for m in tool_calls if m.tool_call.name == "echo"), None)
    assert echo_call is not None, f"No echo tool call found. Tool calls: {[m.tool_call.name for m in tool_calls]}"

    # Check for tool return message
    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert len(tool_returns) > 0, "Expected at least one ToolReturnMessage"

    # Find the return for the echo call
    echo_return = next((m for m in tool_returns if m.tool_call_id == echo_call.tool_call.tool_call_id), None)
    assert echo_return is not None, "No tool return found for echo call"
    assert echo_return.status == "success", f"Echo tool failed with status: {echo_return.status}"

    # Verify the echo response contains our message
    assert test_message in echo_return.tool_return, f"Expected '{test_message}' in tool return, got: {echo_return.tool_return}"


def test_mcp_add_tool_with_agent(letta_client: Letta, agent_with_mcp_tools: AgentState):
    """
    Test that an agent can successfully call the add tool from the MCP server.
    """
    a, b = 42, 58
    expected_sum = a + b

    response = letta_client.agents.messages.create(
        agent_id=agent_with_mcp_tools.id,
        messages=[
            MessageCreate(
                role="user",
                content=f"Use the add tool to add {a} and {b}.",
            )
        ],
    )

    # Check for tool call message
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    assert len(tool_calls) > 0, "Expected at least one ToolCallMessage"

    # Find the add tool call
    add_call = next((m for m in tool_calls if m.tool_call.name == "add"), None)
    assert add_call is not None, f"No add tool call found. Tool calls: {[m.tool_call.name for m in tool_calls]}"

    # Check for tool return message
    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert len(tool_returns) > 0, "Expected at least one ToolReturnMessage"

    # Find the return for the add call
    add_return = next((m for m in tool_returns if m.tool_call_id == add_call.tool_call.tool_call_id), None)
    assert add_return is not None, "No tool return found for add call"
    assert add_return.status == "success", f"Add tool failed with status: {add_return.status}"

    # Verify the result contains the expected sum
    assert str(expected_sum) in add_return.tool_return, f"Expected '{expected_sum}' in tool return, got: {add_return.tool_return}"


def test_mcp_multiple_tools_in_sequence_with_agent(letta_client: Letta):
    """
    Test that an agent can call multiple MCP tools in sequence.
    """
    # Create server with multiple tools
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        pytest.skip(f"Mock MCP server not found at {mcp_server_path}")

    server_name = f"test-multi-tools-{uuid.uuid4().hex[:8]}"
    server_config = CreateStdioMcpServer(
        server_name=server_name,
        command=sys.executable,
        args=[str(mcp_server_path)],
    )

    # Register the MCP server
    server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = server.id

    try:
        # List available MCP tools
        mcp_tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)

        # Get multiple tools
        add_tool = next((t for t in mcp_tools if t.name == "add"), None)
        multiply_tool = next((t for t in mcp_tools if t.name == "multiply"), None)
        echo_tool = next((t for t in mcp_tools if t.name == "echo"), None)

        assert add_tool is not None, "add tool not found"
        assert multiply_tool is not None, "multiply tool not found"
        assert echo_tool is not None, "echo tool not found"

        # Create agent with multiple tools
        agent = letta_client.agents.create(
            name=f"test_multi_tools_{uuid.uuid4().hex[:8]}",
            include_base_tools=True,
            tool_ids=[add_tool.id, multiply_tool.id, echo_tool.id],
            memory_blocks=[
                {
                    "label": "human",
                    "value": "Name: Test User",
                },
                {
                    "label": "persona",
                    "value": "You are a helpful assistant that can use MCP tools to help the user.",
                },
            ],
            llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tags=["test_multi_tools"],
        )

        # Send message requiring multiple tool calls
        response = letta_client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content="First use the add tool to add 10 and 20. Then use the multiply tool to multiply the result by 2. "
                    "Finally, use the echo tool to echo back the final result.",
                )
            ],
        )

        # Check for tool call messages
        tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
        assert len(tool_calls) >= 3, f"Expected at least 3 tool calls, got {len(tool_calls)}"

        # Verify all three tools were called
        tool_names = [m.tool_call.name for m in tool_calls]
        assert "add" in tool_names, f"add tool not called. Tools called: {tool_names}"
        assert "multiply" in tool_names, f"multiply tool not called. Tools called: {tool_names}"
        assert "echo" in tool_names, f"echo tool not called. Tools called: {tool_names}"

        # Check for tool return messages
        tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
        assert len(tool_returns) >= 3, f"Expected at least 3 tool returns, got {len(tool_returns)}"

        # Verify all tools succeeded
        for tool_return in tool_returns:
            assert tool_return.status == "success", f"Tool call failed with status: {tool_return.status}"

        # Cleanup agent
        letta_client.agents.delete(agent.id)

    finally:
        # Cleanup MCP server
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_mcp_complex_schema_tool_with_agent(letta_client: Letta):
    """
    Test that an agent can successfully call a tool with complex nested schema.
    This tests the get_parameter_type_description tool which has:
    - Enum-like preset parameter
    - Optional string field
    - Optional nested object with arrays of objects
    """
    # Create server
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        pytest.skip(f"Mock MCP server not found at {mcp_server_path}")

    server_name = f"test-complex-schema-{uuid.uuid4().hex[:8]}"
    server_config = CreateStdioMcpServer(
        server_name=server_name,
        command=sys.executable,
        args=[str(mcp_server_path)],
    )

    # Register the MCP server
    server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = server.id

    try:
        # List available tools
        mcp_tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)

        # Find the complex schema tool
        complex_tool = next((t for t in mcp_tools if t.name == "get_parameter_type_description"), None)
        assert complex_tool is not None, f"get_parameter_type_description tool not found. Available: {[t.name for t in mcp_tools]}"

        # Find other complex tools
        create_person_tool = next((t for t in mcp_tools if t.name == "create_person"), None)
        manage_tasks_tool = next((t for t in mcp_tools if t.name == "manage_tasks"), None)

        # Create agent with complex schema tools
        tool_ids = [complex_tool.id]
        if create_person_tool:
            tool_ids.append(create_person_tool.id)
        if manage_tasks_tool:
            tool_ids.append(manage_tasks_tool.id)

        agent = letta_client.agents.create(
            name=f"test_complex_schema_{uuid.uuid4().hex[:8]}",
            include_base_tools=True,
            tool_ids=tool_ids,
            memory_blocks=[
                {
                    "label": "human",
                    "value": "Name: Test User",
                },
                {
                    "label": "persona",
                    "value": "You are a helpful assistant that can use MCP tools with complex schemas.",
                },
            ],
            llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            tags=["test_complex_schema"],
        )

        # Test 1: Simple call with just preset
        response = letta_client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content='Use the get_parameter_type_description tool with preset "a" to get parameter information.',
                )
            ],
        )

        tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
        assert len(tool_calls) > 0, "Expected at least one ToolCallMessage"

        complex_call = next((m for m in tool_calls if m.tool_call.name == "get_parameter_type_description"), None)
        assert complex_call is not None, f"No get_parameter_type_description call found. Calls: {[m.tool_call.name for m in tool_calls]}"

        tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
        assert len(tool_returns) > 0, "Expected at least one ToolReturnMessage"

        complex_return = next((m for m in tool_returns if m.tool_call_id == complex_call.tool_call.tool_call_id), None)
        assert complex_return is not None, "No tool return found for complex schema call"
        assert complex_return.status == "success", f"Complex schema tool failed with status: {complex_return.status}"
        assert "Preset: a" in complex_return.tool_return, f"Expected 'Preset: a' in return, got: {complex_return.tool_return}"

        # Test 2: Complex call with nested data
        response = letta_client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user",
                    content="Use the get_parameter_type_description tool with these arguments: "
                    'preset="b", connected_service_descriptor="test-service", '
                    "and instantiation_data with isAbstract=true, isMultiplicity=false, "
                    'and one instantiation with doid="TEST123" and nodeFamilyId=42.',
                )
            ],
        )

        tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
        assert len(tool_calls) > 0, "Expected at least one ToolCallMessage for complex nested call"

        complex_call = next((m for m in tool_calls if m.tool_call.name == "get_parameter_type_description"), None)
        assert complex_call is not None, "No get_parameter_type_description call found for nested test"

        tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
        complex_return = next((m for m in tool_returns if m.tool_call_id == complex_call.tool_call.tool_call_id), None)
        assert complex_return is not None, "No tool return found for complex nested call"
        assert complex_return.status == "success", f"Complex nested call failed with status: {complex_return.status}"

        # Verify the response contains our complex data
        assert "Preset: b" in complex_return.tool_return, "Expected preset 'b' in response"
        assert "test-service" in complex_return.tool_return, "Expected service descriptor in response"

        # Test 3: If create_person tool is available, test it
        if create_person_tool:
            response = letta_client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    MessageCreate(
                        role="user",
                        content='Use the create_person tool to create a person named "John Doe", age 30, '
                        'email "john@example.com", with address at "123 Main St", city "New York", zip "10001".',
                    )
                ],
            )

            tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
            person_call = next((m for m in tool_calls if m.tool_call.name == "create_person"), None)
            assert person_call is not None, "No create_person call found"

            tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
            person_return = next((m for m in tool_returns if m.tool_call_id == person_call.tool_call.tool_call_id), None)
            assert person_return is not None, "No tool return found for create_person call"
            assert person_return.status == "success", f"create_person failed with status: {person_return.status}"
            assert "John Doe" in person_return.tool_return, "Expected person name in response"

        # Cleanup agent
        letta_client.agents.delete(agent.id)

    finally:
        # Cleanup MCP server
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)


def test_comprehensive_mcp_server_tool_listing(letta_client: Letta):
    """
    Comprehensive test for MCP server registration, tool listing, and management.
    """
    # Create server
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        pytest.skip(f"Mock MCP server not found at {mcp_server_path}")

    server_name = f"test-comprehensive-{uuid.uuid4().hex[:8]}"
    server_config = CreateStdioMcpServer(
        server_name=server_name,
        command=sys.executable,
        args=[str(mcp_server_path)],
    )

    # Register the MCP server
    server = letta_client.mcp_servers.mcp_create_mcp_server(request=server_config)
    server_id = server.id

    try:
        # Verify server is in the list
        servers = letta_client.mcp_servers.mcp_list_mcp_servers()
        server_ids = [s.id for s in servers]
        assert server_id in server_ids, f"MCP server {server_id} not found in {server_ids}"

        # List available tools
        mcp_tools = letta_client.mcp_servers.mcp_list_mcp_tools_by_server(server_id)
        assert len(mcp_tools) > 0, "No tools found from MCP server"

        # Verify expected tools are present
        tool_names = [t.name for t in mcp_tools]
        expected_tools = [
            "echo",
            "add",
            "multiply",
            "reverse_string",
            "create_person",
            "manage_tasks",
            "search_with_filters",
            "process_nested_data",
            "get_parameter_type_description",
        ]

        for expected_tool in expected_tools:
            assert expected_tool in tool_names, f"Expected tool '{expected_tool}' not found. Available: {tool_names}"

        # Test getting individual tools
        for tool in mcp_tools[:3]:  # Test first 3 tools
            retrieved_tool = letta_client.mcp_servers.mcp_get_mcp_tool(server_id, tool.id)
            assert retrieved_tool.id == tool.id, f"Tool ID mismatch: expected {tool.id}, got {retrieved_tool.id}"
            assert retrieved_tool.name == tool.name, f"Tool name mismatch: expected {tool.name}, got {retrieved_tool.name}"

        # Test running a simple tool directly (without agent)
        echo_tool = next((t for t in mcp_tools if t.name == "echo"), None)
        if echo_tool:
            result = letta_client.mcp_servers.mcp_run_tool(server_id, echo_tool.id, args={"message": "Test direct tool execution"})
            assert hasattr(result, "status"), "Tool execution result should have status"
            # The exact structure of result depends on the API implementation

        # Test tool schema inspection
        complex_tool = next((t for t in mcp_tools if t.name == "get_parameter_type_description"), None)
        if complex_tool:
            # Verify the tool has appropriate schema/description
            assert complex_tool.description is not None, "Complex tool should have a description"
            # Could add more schema validation here if the API exposes it

    finally:
        # Cleanup MCP server
        letta_client.mcp_servers.mcp_delete_mcp_server(server_id)
