import os
import sys
import threading
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate, ToolCallMessage, ToolReturnMessage

from letta.functions.mcp_client.types import StdioServerConfig
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import TextContent
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
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def mcp_server_name() -> str:
    """Generate a unique MCP server name for each test."""
    return f"test-mcp-server-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="function")
def mock_mcp_server_config(mcp_server_name: str) -> StdioServerConfig:
    """
    Creates a stdio configuration for the mock MCP server.
    """
    # Get path to mock_mcp_server.py
    script_dir = Path(__file__).parent
    mcp_server_path = script_dir / "mock_mcp_server.py"

    if not mcp_server_path.exists():
        raise FileNotFoundError(f"Mock MCP server not found at {mcp_server_path}")

    return StdioServerConfig(
        server_name=mcp_server_name,
        command=sys.executable,  # Use the current Python interpreter
        args=[str(mcp_server_path)],
    )


@pytest.fixture(scope="function")
def agent_state(client: Letta, mcp_server_name: str, mock_mcp_server_config: StdioServerConfig) -> AgentState:
    """
    Creates an agent with MCP tools attached for testing.
    """
    # Register the MCP server
    client.tools.add_mcp_server(request=mock_mcp_server_config)

    # Verify server is registered
    servers = client.tools.list_mcp_servers()
    assert mcp_server_name in servers, f"MCP server {mcp_server_name} not found in {servers}"

    # List available MCP tools
    mcp_tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)
    assert len(mcp_tools) > 0, "No tools found from MCP server"

    # Add the echo and add tools to Letta
    echo_tool = next((t for t in mcp_tools if t.name == "echo"), None)
    add_tool = next((t for t in mcp_tools if t.name == "add"), None)

    assert echo_tool is not None, "echo tool not found"
    assert add_tool is not None, "add tool not found"

    letta_echo_tool = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name="echo")
    letta_add_tool = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name="add")

    # Create agent with the MCP tools
    agent = client.agents.create(
        name=f"test_mcp_agent_{uuid.uuid4().hex[:8]}",
        include_base_tools=True,
        tool_ids=[letta_echo_tool.id, letta_add_tool.id],
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

    # Cleanup
    try:
        client.agents.delete(agent.id)
    except Exception as e:
        print(f"Warning: Failed to delete agent {agent.id}: {e}")

    try:
        client.tools.delete_mcp_server(mcp_server_name=mcp_server_name)
    except Exception as e:
        print(f"Warning: Failed to delete MCP server {mcp_server_name}: {e}")


# ------------------------------
# Test Cases
# ------------------------------


def test_mcp_echo_tool(client: Letta, agent_state: AgentState):
    """
    Test that an agent can successfully call the echo tool from the MCP server.
    """
    test_message = "Hello from MCP integration test!"

    response = client.agents.messages.create(
        agent_id=agent_state.id,
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


def test_mcp_add_tool(client: Letta, agent_state: AgentState):
    """
    Test that an agent can successfully call the add tool from the MCP server.
    """
    a, b = 42, 58
    expected_sum = a + b

    response = client.agents.messages.create(
        agent_id=agent_state.id,
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


def test_mcp_multiple_tools_in_sequence(client: Letta, agent_state: AgentState):
    """
    Test that an agent can call multiple MCP tools in sequence.
    """
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content="First use the add tool to add 10 and 20. Then use the echo tool to echo back the result you got from the add tool.",
            )
        ],
    )

    # Check for tool call messages
    tool_calls = [m for m in response.messages if isinstance(m, ToolCallMessage)]
    assert len(tool_calls) >= 2, f"Expected at least 2 tool calls, got {len(tool_calls)}"

    # Verify both tools were called
    tool_names = [m.tool_call.name for m in tool_calls]
    assert "add" in tool_names, f"add tool not called. Tools called: {tool_names}"
    assert "echo" in tool_names, f"echo tool not called. Tools called: {tool_names}"

    # Check for tool return messages
    tool_returns = [m for m in response.messages if isinstance(m, ToolReturnMessage)]
    assert len(tool_returns) >= 2, f"Expected at least 2 tool returns, got {len(tool_returns)}"

    # Verify all tools succeeded
    for tool_return in tool_returns:
        assert tool_return.status == "success", f"Tool call failed with status: {tool_return.status}"


def test_mcp_server_listing(client: Letta, mcp_server_name: str, mock_mcp_server_config: StdioServerConfig):
    """
    Test that MCP server registration and tool listing works correctly.
    """
    # Register the MCP server
    client.tools.add_mcp_server(request=mock_mcp_server_config)

    try:
        # Verify server is in the list
        servers = client.tools.list_mcp_servers()
        assert mcp_server_name in servers, f"MCP server {mcp_server_name} not found in {servers}"

        # List available tools
        mcp_tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)
        assert len(mcp_tools) > 0, "No tools found from MCP server"

        # Verify expected tools are present
        tool_names = [t.name for t in mcp_tools]
        expected_tools = ["echo", "add", "multiply", "reverse_string"]
        for expected_tool in expected_tools:
            assert expected_tool in tool_names, f"Expected tool '{expected_tool}' not found. Available: {tool_names}"

    finally:
        # Cleanup
        client.tools.delete_mcp_server(mcp_server_name=mcp_server_name)
        servers = client.tools.list_mcp_servers()
        assert mcp_server_name not in servers, f"MCP server {mcp_server_name} should be deleted but is still in {servers}"


def test_mcp_complex_schema_tool(client: Letta, mcp_server_name: str, mock_mcp_server_config: StdioServerConfig):
    """
    Test that an agent can successfully call a tool with complex nested schema.
    This tests the get_parameter_type_description tool which has:
    - Enum-like preset parameter
    - Optional string field
    - Optional nested object with arrays of objects
    """
    # Register the MCP server
    client.tools.add_mcp_server(request=mock_mcp_server_config)

    try:
        # List available tools
        mcp_tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)

        # Find the complex schema tool
        complex_tool = next((t for t in mcp_tools if t.name == "get_parameter_type_description"), None)
        assert complex_tool is not None, f"get_parameter_type_description tool not found. Available: {[t.name for t in mcp_tools]}"

        # Add it to Letta
        letta_complex_tool = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name="get_parameter_type_description")

        # Create agent with the complex tool
        agent = client.agents.create(
            name=f"test_complex_schema_{uuid.uuid4().hex[:8]}",
            include_base_tools=True,
            tool_ids=[letta_complex_tool.id],
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
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                MessageCreate(
                    role="user", content='Use the get_parameter_type_description tool with preset "a" to get parameter information.'
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
        response = client.agents.messages.create(
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

        # Cleanup agent
        client.agents.delete(agent.id)

    finally:
        # Cleanup MCP server
        client.tools.delete_mcp_server(mcp_server_name=mcp_server_name)
