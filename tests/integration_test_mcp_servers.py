"""
Integration tests for the new MCP server endpoints (/v1/mcp-servers/).
Tests all CRUD operations, tool management, and OAuth connection flows.
Uses plain dictionaries since SDK types are not yet generated.
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
def auth_headers() -> Dict[str, str]:
    """
    Provides authentication headers for API requests.
    """
    # Get auth token from environment or use default
    token = os.getenv("LETTA_API_TOKEN", "")
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


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


# ------------------------------
# Helper Functions
# ------------------------------


def create_stdio_server_dict(server_name: str, command: str = "npx", args: List[str] = None) -> Dict[str, Any]:
    """Create a dictionary representing a stdio MCP server configuration."""
    return {
        "type": "stdio",
        "server_name": server_name,
        "command": command,
        "args": args or ["-y", "@modelcontextprotocol/server-everything"],
        "env": {"NODE_ENV": "test", "DEBUG": "true"},
    }


def create_sse_server_dict(server_name: str, server_url: str = None) -> Dict[str, Any]:
    """Create a dictionary representing an SSE MCP server configuration."""
    return {
        "type": "sse",
        "server_name": server_name,
        "server_url": server_url or "https://api.example.com/sse",
        "auth_header": "Authorization",
        "auth_token": "Bearer test_token_123",
        "custom_headers": {"X-Custom-Header": "custom_value", "X-API-Version": "1.0"},
    }


def create_streamable_http_server_dict(server_name: str, server_url: str = None) -> Dict[str, Any]:
    """Create a dictionary representing a streamable HTTP MCP server configuration."""
    return {
        "type": "streamable_http",
        "server_name": server_name,
        "server_url": server_url or "https://api.example.com/streamable",
        "auth_header": "X-API-Key",
        "auth_token": "api_key_456",
        "custom_headers": {"Accept": "application/json", "X-Version": "2.0"},
    }


# ------------------------------
# Test Cases for CRUD Operations
# ------------------------------


def test_create_stdio_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test creating a stdio MCP server."""
    server_name = f"test-stdio-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    # Create the server
    response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create server: {response.text}"

    server_data = response.json()
    assert server_data["server_name"] == server_name
    assert server_data["command"] == server_config["command"]
    assert server_data["args"] == server_config["args"]
    assert "id" in server_data  # Should have an ID assigned

    server_id = server_data["id"]

    # Cleanup - delete the server
    delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
    assert delete_response.status_code == 204, f"Failed to delete server: {delete_response.text}"


def test_create_sse_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test creating an SSE MCP server."""
    server_name = f"test-sse-{uuid.uuid4().hex[:8]}"
    server_config = create_sse_server_dict(server_name)

    # Create the server
    response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create server: {response.text}"

    server_data = response.json()
    assert server_data["server_name"] == server_name
    assert server_data["server_url"] == server_config["server_url"]
    assert server_data["auth_header"] == server_config["auth_header"]
    assert "id" in server_data

    server_id = server_data["id"]

    # Cleanup
    delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
    assert delete_response.status_code == 204


def test_create_streamable_http_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test creating a streamable HTTP MCP server."""
    server_name = f"test-http-{uuid.uuid4().hex[:8]}"
    server_config = create_streamable_http_server_dict(server_name)

    # Create the server
    response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create server: {response.text}"

    server_data = response.json()
    assert server_data["server_name"] == server_name
    assert server_data["server_url"] == server_config["server_url"]
    assert "id" in server_data

    server_id = server_data["id"]

    # Cleanup
    delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
    assert delete_response.status_code == 204


def test_list_mcp_servers(server_url: str, auth_headers: Dict[str, str]):
    """Test listing all MCP servers."""
    # Create multiple servers
    servers_created = []

    # Create stdio server
    stdio_name = f"list-test-stdio-{uuid.uuid4().hex[:8]}"
    stdio_config = create_stdio_server_dict(stdio_name)
    stdio_response = requests.post(f"{server_url}/v1/mcp-servers/", json=stdio_config, headers=auth_headers)
    assert stdio_response.status_code == 200
    stdio_server = stdio_response.json()
    servers_created.append(stdio_server["id"])

    # Create SSE server
    sse_name = f"list-test-sse-{uuid.uuid4().hex[:8]}"
    sse_config = create_sse_server_dict(sse_name)
    sse_response = requests.post(f"{server_url}/v1/mcp-servers/", json=sse_config, headers=auth_headers)
    assert sse_response.status_code == 200
    sse_server = sse_response.json()
    servers_created.append(sse_server["id"])

    try:
        # List all servers
        list_response = requests.get(f"{server_url}/v1/mcp-servers/", headers=auth_headers)
        assert list_response.status_code == 200

        servers_list = list_response.json()
        assert isinstance(servers_list, list)
        assert len(servers_list) >= 2  # At least our two servers

        # Check our servers are in the list
        server_ids = [s["id"] for s in servers_list]
        assert stdio_server["id"] in server_ids
        assert sse_server["id"] in server_ids

        # Check server names
        server_names = [s["server_name"] for s in servers_list]
        assert stdio_name in server_names
        assert sse_name in server_names

    finally:
        # Cleanup
        for server_id in servers_created:
            requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_get_specific_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test getting a specific MCP server by ID."""
    # Create a server
    server_name = f"get-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name, command="python", args=["-m", "mcp_server"])
    server_config["env"]["PYTHONPATH"] = "/usr/local/lib"

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    created_server = create_response.json()
    server_id = created_server["id"]

    try:
        # Get the server by ID
        get_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
        assert get_response.status_code == 200

        retrieved_server = get_response.json()
        assert retrieved_server["id"] == server_id
        assert retrieved_server["server_name"] == server_name
        assert retrieved_server["command"] == "python"
        assert retrieved_server["args"] == ["-m", "mcp_server"]
        assert retrieved_server.get("env", {}).get("PYTHONPATH") == "/usr/local/lib"

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_update_stdio_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test updating a stdio MCP server."""
    # Create a server
    server_name = f"update-test-stdio-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name, command="node", args=["old_server.js"])

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Update the server
        update_data = {
            "server_name": "updated-stdio-server",
            "command": "node",
            "args": ["new_server.js", "--port", "3000"],
            "env": {"NEW_ENV": "new_value", "PORT": "3000"},
        }

        update_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200

        updated_server = update_response.json()
        assert updated_server["server_name"] == "updated-stdio-server"
        assert updated_server["args"] == ["new_server.js", "--port", "3000"]
        assert updated_server.get("env", {}).get("NEW_ENV") == "new_value"

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_update_sse_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test updating an SSE MCP server."""
    # Create an SSE server
    server_name = f"update-test-sse-{uuid.uuid4().hex[:8]}"
    server_config = create_sse_server_dict(server_name, server_url="https://old.example.com/sse")

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Update the server
        update_data = {
            "server_name": "updated-sse-server",
            "server_url": "https://new.example.com/sse/v2",
            "token": "new_token_789",
            "custom_headers": {"X-Updated": "true", "X-Version": "2.0"},
        }

        update_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200

        updated_server = update_response.json()
        assert updated_server["server_name"] == "updated-sse-server"
        assert updated_server["server_url"] == "https://new.example.com/sse/v2"

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_delete_mcp_server(server_url: str, auth_headers: Dict[str, str]):
    """Test deleting an MCP server."""
    # Create a server to delete
    server_name = f"delete-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    # Delete the server
    delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    # Verify it's deleted (should get 404)
    get_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
    assert get_response.status_code == 404


# ------------------------------
# Test Cases for Tool Operations
# ------------------------------


def test_list_mcp_tools_by_server(server_url: str, auth_headers: Dict[str, str]):
    """Test listing tools for a specific MCP server."""
    # Create a server
    server_name = f"tools-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # List tools for this server
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200

        tools = tools_response.json()
        assert isinstance(tools, list)

        # Tools might be empty initially if server hasn't connected
        # But response structure should be valid
        if len(tools) > 0:
            # Verify tool structure
            tool = tools[0]
            assert "id" in tool
            assert "name" in tool

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_get_specific_mcp_tool(server_url: str, auth_headers: Dict[str, str]):
    """Test getting a specific tool from an MCP server."""
    # Create a server
    server_name = f"tool-get-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # First get list of tools
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200
        tools = tools_response.json()

        if len(tools) > 0:
            # Get a specific tool
            tool_id = tools[0]["id"]
            tool_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools/{tool_id}", headers=auth_headers)
            assert tool_response.status_code == 200

            specific_tool = tool_response.json()
            assert specific_tool["id"] == tool_id
            assert "name" in specific_tool

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_run_mcp_tool(server_url: str, auth_headers: Dict[str, str]):
    """Test executing an MCP tool."""
    # Create a server
    server_name = f"tool-run-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Get available tools
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200
        tools = tools_response.json()

        if len(tools) > 0:
            # Run the first available tool
            tool_id = tools[0]["id"]

            # Run with arguments
            run_request = {"args": {"test_param": "test_value", "count": 5}}

            run_response = requests.post(
                f"{server_url}/v1/mcp-servers/{server_id}/tools/{tool_id}/run", json=run_request, headers=auth_headers
            )
            assert run_response.status_code == 200

            result = run_response.json()
            assert "status" in result
            assert result["status"] in ["success", "error"]
            assert "func_return" in result

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_run_mcp_tool_without_args(server_url: str, auth_headers: Dict[str, str]):
    """Test executing an MCP tool without arguments."""
    # Create a server
    server_name = f"tool-noargs-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Get available tools
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200
        tools = tools_response.json()

        if len(tools) > 0:
            tool_id = tools[0]["id"]

            # Run without arguments (empty dict)
            run_request = {"args": {}}

            run_response = requests.post(
                f"{server_url}/v1/mcp-servers/{server_id}/tools/{tool_id}/run", json=run_request, headers=auth_headers
            )
            assert run_response.status_code == 200

            result = run_response.json()
            assert "status" in result
            assert "func_return" in result

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_refresh_mcp_server_tools(server_url: str, auth_headers: Dict[str, str]):
    """Test refreshing tools for an MCP server."""
    # Create a server
    server_name = f"refresh-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Get initial tools
        initial_tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert initial_tools_response.status_code == 200

        # Refresh tools
        refresh_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}/refresh", headers=auth_headers)
        assert refresh_response.status_code == 200

        refresh_result = refresh_response.json()
        # Result should contain summary of changes
        assert refresh_result is not None

        # Get tools after refresh
        refreshed_tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert refreshed_tools_response.status_code == 200

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_refresh_mcp_server_tools_with_agent(server_url: str, auth_headers: Dict[str, str]):
    """Test refreshing tools with agent context."""
    # Create a server
    server_name = f"refresh-agent-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name)

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Refresh tools with agent ID
        mock_agent_id = f"agent-{uuid.uuid4()}"
        refresh_response = requests.patch(
            f"{server_url}/v1/mcp-servers/{server_id}/refresh", params={"agent_id": mock_agent_id}, headers=auth_headers
        )
        assert refresh_response.status_code == 200

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


# ------------------------------
# Test Cases for OAuth/Connection
# ------------------------------


def test_connect_mcp_server_oauth(server_url: str, auth_headers: Dict[str, str]):
    """Test connecting to an MCP server (OAuth flow)."""
    # Create an SSE server that might require OAuth
    server_name = f"oauth-test-{uuid.uuid4().hex[:8]}"
    server_config = create_sse_server_dict(server_name, server_url="https://oauth.example.com/sse")
    # Remove token to simulate OAuth requirement
    server_config["auth_token"] = None

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Attempt to connect (returns SSE stream)
        # We can't fully test SSE in a simple integration test, but verify endpoint works
        connect_response = requests.get(
            f"{server_url}/v1/mcp-servers/connect/{server_id}",
            headers={**auth_headers, "Accept": "text/event-stream"},
            stream=True,
            timeout=2,
        )

        # Should get a streaming response or error, not 404
        assert connect_response.status_code in [200, 400, 500], f"Unexpected status: {connect_response.status_code}"

        # Close the stream
        connect_response.close()

    except requests.exceptions.Timeout:
        # Timeout is acceptable for SSE endpoints in tests
        pass
    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


# ------------------------------
# Test Cases for Error Handling
# ------------------------------


def test_error_handling_invalid_server_id(server_url: str, auth_headers: Dict[str, str]):
    """Test error handling with invalid server IDs."""
    invalid_id = "invalid-server-id-12345"

    # Try to get non-existent server
    get_response = requests.get(f"{server_url}/v1/mcp-servers/{invalid_id}", headers=auth_headers)
    assert get_response.status_code == 404

    # Try to update non-existent server
    update_data = {"server_name": "updated"}
    update_response = requests.patch(f"{server_url}/v1/mcp-servers/{invalid_id}", json=update_data, headers=auth_headers)
    assert update_response.status_code == 404  # Non-existent server returns 404

    # Try to delete non-existent server
    delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{invalid_id}", headers=auth_headers)
    assert delete_response.status_code == 404

    # Try to list tools for non-existent server
    tools_response = requests.get(f"{server_url}/v1/mcp-servers/{invalid_id}/tools", headers=auth_headers)
    assert tools_response.status_code == 404


def test_invalid_server_type(server_url: str, auth_headers: Dict[str, str]):
    """Test creating server with invalid type."""
    invalid_config = {"type": "invalid_type", "server_name": "invalid-server", "some_field": "value"}

    response = requests.post(f"{server_url}/v1/mcp-servers/", json=invalid_config, headers=auth_headers)
    assert response.status_code == 422  # Validation error


# ------------------------------
# Test Cases for Complex Scenarios
# ------------------------------


def test_multiple_server_types_coexist(server_url: str, auth_headers: Dict[str, str]):
    """Test that multiple server types can coexist."""
    servers_created = []

    try:
        # Create one of each type
        stdio_config = create_stdio_server_dict(f"multi-stdio-{uuid.uuid4().hex[:8]}")
        stdio_response = requests.post(f"{server_url}/v1/mcp-servers/", json=stdio_config, headers=auth_headers)
        assert stdio_response.status_code == 200
        stdio_server = stdio_response.json()
        servers_created.append(stdio_server["id"])

        sse_config = create_sse_server_dict(f"multi-sse-{uuid.uuid4().hex[:8]}")
        sse_response = requests.post(f"{server_url}/v1/mcp-servers/", json=sse_config, headers=auth_headers)
        assert sse_response.status_code == 200
        sse_server = sse_response.json()
        servers_created.append(sse_server["id"])

        http_config = create_streamable_http_server_dict(f"multi-http-{uuid.uuid4().hex[:8]}")
        http_response = requests.post(f"{server_url}/v1/mcp-servers/", json=http_config, headers=auth_headers)
        assert http_response.status_code == 200
        http_server = http_response.json()
        servers_created.append(http_server["id"])

        # List all servers
        list_response = requests.get(f"{server_url}/v1/mcp-servers/", headers=auth_headers)
        assert list_response.status_code == 200

        servers_list = list_response.json()
        server_ids = [s["id"] for s in servers_list]

        # Verify all three are present
        assert stdio_server["id"] in server_ids
        assert sse_server["id"] in server_ids
        assert http_server["id"] in server_ids

        # Get each server and verify type-specific fields
        stdio_get = requests.get(f"{server_url}/v1/mcp-servers/{stdio_server['id']}", headers=auth_headers)
        assert stdio_get.status_code == 200
        assert stdio_get.json()["command"] == stdio_config["command"]

        sse_get = requests.get(f"{server_url}/v1/mcp-servers/{sse_server['id']}", headers=auth_headers)
        assert sse_get.status_code == 200
        assert sse_get.json()["server_url"] == sse_config["server_url"]

        http_get = requests.get(f"{server_url}/v1/mcp-servers/{http_server['id']}", headers=auth_headers)
        assert http_get.status_code == 200
        assert http_get.json()["server_url"] == http_config["server_url"]

    finally:
        # Cleanup all servers
        for server_id in servers_created:
            requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_partial_update_preserves_fields(server_url: str, auth_headers: Dict[str, str]):
    """Test that partial updates preserve non-updated fields."""
    # Create a server with all fields
    server_name = f"partial-update-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name, command="node", args=["server.js", "--port", "3000"])
    server_config["env"] = {"NODE_ENV": "production", "PORT": "3000", "DEBUG": "false"}

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # Update only the server name
        update_data = {"server_name": "renamed-server"}

        update_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200

        updated_server = update_response.json()
        assert updated_server["server_name"] == "renamed-server"
        # Other fields should be preserved
        assert updated_server["command"] == "node"
        assert updated_server["args"] == ["server.js", "--port", "3000"]

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_concurrent_server_operations(server_url: str, auth_headers: Dict[str, str]):
    """Test multiple servers can be operated on concurrently."""
    servers_created = []

    try:
        # Create multiple servers quickly
        for i in range(3):
            server_config = create_stdio_server_dict(f"concurrent-{i}-{uuid.uuid4().hex[:8]}", command="python", args=[f"server_{i}.py"])

            response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
            assert response.status_code == 200
            servers_created.append(response.json()["id"])

        # Update all servers
        for i, server_id in enumerate(servers_created):
            update_data = {"server_name": f"updated-concurrent-{i}"}

            update_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}", json=update_data, headers=auth_headers)
            assert update_response.status_code == 200
            assert update_response.json()["server_name"] == f"updated-concurrent-{i}"

        # Get all servers
        for i, server_id in enumerate(servers_created):
            get_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
            assert get_response.status_code == 200
            assert get_response.json()["server_name"] == f"updated-concurrent-{i}"

    finally:
        # Cleanup all servers
        for server_id in servers_created:
            requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)


def test_full_server_lifecycle(server_url: str, auth_headers: Dict[str, str]):
    """Test complete lifecycle: create, list, get, update, tools, delete."""
    # 1. Create server
    server_name = f"lifecycle-test-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name, command="npx", args=["-y", "@modelcontextprotocol/server-everything"])
    server_config["env"]["TEST"] = "true"

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # 2. List servers and verify it's there
        list_response = requests.get(f"{server_url}/v1/mcp-servers/", headers=auth_headers)
        assert list_response.status_code == 200
        assert any(s["id"] == server_id for s in list_response.json())

        # 3. Get specific server
        get_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["server_name"] == server_name

        # 4. Update server
        update_data = {"server_name": "lifecycle-updated", "env": {"TEST": "false", "NEW_VAR": "value"}}
        update_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200
        assert update_response.json()["server_name"] == "lifecycle-updated"

        # 5. List tools
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200
        tools = tools_response.json()
        assert isinstance(tools, list)

        # 6. If tools exist, try to get and run one
        if len(tools) > 0:
            tool_id = tools[0]["id"]

            # Get specific tool
            tool_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools/{tool_id}", headers=auth_headers)
            assert tool_response.status_code == 200
            assert tool_response.json()["id"] == tool_id

            # Run tool
            run_response = requests.post(
                f"{server_url}/v1/mcp-servers/{server_id}/tools/{tool_id}/run", json={"args": {}}, headers=auth_headers
            )
            assert run_response.status_code == 200

        # 7. Refresh tools
        refresh_response = requests.patch(f"{server_url}/v1/mcp-servers/{server_id}/refresh", headers=auth_headers)
        assert refresh_response.status_code == 200

        # 8. Try to connect (OAuth flow)
        try:
            connect_response = requests.get(
                f"{server_url}/v1/mcp-servers/connect/{server_id}",
                headers={**auth_headers, "Accept": "text/event-stream"},
                stream=True,
                timeout=1,
            )
            # Just verify it doesn't 404
            assert connect_response.status_code in [200, 400, 500]
            connect_response.close()
        except requests.exceptions.Timeout:
            pass  # SSE timeout is acceptable

    finally:
        # 9. Delete server
        delete_response = requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
        assert delete_response.status_code == 204

        # 10. Verify it's deleted
        get_deleted_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
        assert get_deleted_response.status_code == 404


# ------------------------------
# Test Cases for Empty Responses
# ------------------------------


def test_empty_tools_list(server_url: str, auth_headers: Dict[str, str]):
    """Test handling of servers with no tools."""
    # Create a minimal server that likely has no tools
    server_name = f"no-tools-{uuid.uuid4().hex[:8]}"
    server_config = create_stdio_server_dict(server_name, command="echo", args=["hello"])

    create_response = requests.post(f"{server_url}/v1/mcp-servers/", json=server_config, headers=auth_headers)
    assert create_response.status_code == 200
    server_id = create_response.json()["id"]

    try:
        # List tools (should be empty)
        tools_response = requests.get(f"{server_url}/v1/mcp-servers/{server_id}/tools", headers=auth_headers)
        assert tools_response.status_code == 200

        tools = tools_response.json()
        assert tools is not None
        assert isinstance(tools, list)
        # Tools will be empty for a simple echo command

    finally:
        # Cleanup
        requests.delete(f"{server_url}/v1/mcp-servers/{server_id}", headers=auth_headers)
