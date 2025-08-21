import json
import os
import subprocess
import threading
import uuid
import venv
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, McpTool, ToolCallMessage, ToolReturnMessage

from letta.functions.mcp_client.types import SSEServerConfig, StdioServerConfig, StreamableHTTPServerConfig
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from tests.utils import wait_for_server


def create_virtualenv_and_install_requirements(requirements_path: Path, name="venv") -> Path:
    requirements_path = requirements_path.resolve()

    if not requirements_path.exists():
        raise FileNotFoundError(f"Requirements file not found: {requirements_path}")
    if requirements_path.name != "requirements.txt":
        raise ValueError(f"Expected file named 'requirements.txt', got: {requirements_path.name}")

    venv_dir = requirements_path.parent / name

    if not venv_dir.exists():
        venv.EnvBuilder(with_pip=True).create(venv_dir)

    pip_path = venv_dir / ("Scripts" if os.name == "nt" else "bin") / "pip"
    if not pip_path.exists():
        raise FileNotFoundError(f"pip executable not found at: {pip_path}")

    try:
        subprocess.check_call([str(pip_path), "install", "-r", str(requirements_path)])
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"pip install failed with exit code {exc.returncode}")

    return venv_dir


# --- Server Management --- #


def _run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture
def empty_mcp_config():
    path = Path(__file__).parent / "mcp_config.json"
    path.write_text(json.dumps({}))  # writes "{}"

    return path


@pytest.fixture()
def server_url(empty_mcp_config):
    """Ensures a server is running and returns its base URL."""
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        wait_for_server(url)

    return url


@pytest.fixture()
def client(server_url):
    """Creates a REST client for testing."""
    client = Letta(base_url=server_url)
    return client


@pytest.fixture()
def agent_state(client):
    """Creates an agent and ensures cleanup after tests."""
    agent_state = client.agents.create(
        name=f"test_compl_{str(uuid.uuid4())[5:]}",
        include_base_tools=True,
        memory_blocks=[
            {
                "label": "human",
                "value": "Name: Matt",
            },
            {
                "label": "persona",
                "value": "Friendly agent",
            },
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


@pytest.mark.asyncio
async def test_sse_mcp_server(client, agent_state):
    mcp_server_name = "deepwiki"
    server_url = "https://mcp.deepwiki.com/sse"
    sse_mcp_config = SSEServerConfig(server_name=mcp_server_name, server_url=server_url)
    client.tools.add_mcp_server(request=sse_mcp_config)

    # Check that it's in the server mapping
    mcp_server_mapping = client.tools.list_mcp_servers()
    assert mcp_server_name in mcp_server_mapping

    # Check tools
    tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)
    assert len(tools) > 0
    assert isinstance(tools[0], McpTool)

    # Test with the ask_question tool which is one of the available deepwiki tools
    ask_question_tool = next((t for t in tools if t.name == "ask_question"), None)
    assert ask_question_tool is not None, f"ask_question tool not found. Available tools: {[t.name for t in tools]}"

    # Check that the tool is executable
    letta_tool = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name=ask_question_tool.name)

    tool_args = {"repoName": "facebook/react", "question": "What is React?"}

    # Add to agent, have agent invoke tool
    client.agents.tools.attach(agent_id=agent_state.id, tool_id=letta_tool.id)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=[TextContent(text=f"Use the `{letta_tool.name}` tool with these arguments: {tool_args}.")],
            )
        ],
    )
    seq = response.messages
    calls = [m for m in seq if isinstance(m, ToolCallMessage)]
    assert calls, "Expected a ToolCallMessage"
    assert calls[0].tool_call.name == "ask_question"

    returns = [m for m in seq if isinstance(m, ToolReturnMessage)]
    assert returns, "Expected a ToolReturnMessage"
    tr = returns[0]
    # status field
    assert tr.status == "success", f"Bad status: {tr.status}"
    # Check that we got some content back
    assert len(tr.tool_return.strip()) > 0, f"Expected non-empty tool return, got: {tr.tool_return}"


def test_stdio_mcp_server(client, agent_state):
    req_file = Path(__file__).parent / "weather" / "requirements.txt"
    create_virtualenv_and_install_requirements(req_file, name="venv")

    mcp_server_name = "weather"
    command = str(Path(__file__).parent / "weather" / "venv" / "bin" / "python3")
    args = [str(Path(__file__).parent / "weather" / "weather.py")]

    stdio_config = StdioServerConfig(
        server_name=mcp_server_name,
        command=command,
        args=args,
    )

    client.tools.add_mcp_server(request=stdio_config)

    servers = client.tools.list_mcp_servers()
    assert mcp_server_name in servers

    tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)
    assert tools, "Expected at least one tool from the weather MCP server"
    assert any(t.name == "get_alerts" for t in tools), f"Got: {[t.name for t in tools]}"

    get_alerts = next(t for t in tools if t.name == "get_alerts")

    letta_tool = client.tools.add_mcp_tool(
        mcp_server_name=mcp_server_name,
        mcp_tool_name=get_alerts.name,
    )

    client.agents.tools.attach(agent_id=agent_state.id, tool_id=letta_tool.id)

    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[
            MessageCreate(
                role="user",
                content=[TextContent(text=(f"Use the `{letta_tool.name}` tool with these arguments: {{'state': 'CA'}}."))],
            )
        ],
    )

    calls = [m for m in response.messages if isinstance(m, ToolCallMessage) and m.tool_call.name == "get_alerts"]
    assert calls, "Expected a get_alerts ToolCallMessage"

    returns = [m for m in response.messages if isinstance(m, ToolReturnMessage) and m.tool_call_id == calls[0].tool_call.tool_call_id]
    assert returns, "Expected a ToolReturnMessage for get_alerts"
    ret = returns[0]

    assert ret.status == "success", f"Unexpected status: {ret.status}"
    # make sure there's at least some payload
    assert len(ret.tool_return.strip()) >= 10, f"Expected at least 10 characters in tool_return, got {len(ret.tool_return.strip())}"


# Optional OpenAI validation test for MCP-normalized schema
# Skips unless OPENAI_API_KEY is set to avoid network flakiness in CI
EXAMPLE_BAD_SCHEMA = {
    "type": "object",
    "properties": {
        "conversation_type": {
            "type": "string",
            "const": "Group",
            "description": "Specifies the type of conversation to be created. Must be 'Group' for this action.",
        },
        "message": {
            "type": "object",
            "additionalProperties": {},  # invalid for OpenAI: missing "type"
            "description": "Initial message payload",
        },
        "participant_ids": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Participant IDs",
        },
    },
    "required": ["conversation_type", "message", "participant_ids"],
    "additionalProperties": False,
    "$schema": "http://json-schema.org/draft-07/schema#",
}


@pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="Requires OPENAI_API_KEY to call OpenAI for schema validation",
)
def test_openai_rejects_untyped_additional_properties_and_accepts_normalized_schema():
    """Test written to check if our extra schema validation works.

    Some MCP servers will return faulty schemas that require correction, or they will brick the LLM client calls.
    """
    import copy

    try:
        from openai import OpenAI
    except Exception as e:  # pragma: no cover
        pytest.skip(f"openai package not available: {e}")

    client = OpenAI()

    def run_request_with_schema(schema: dict):
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "TWITTER_CREATE_A_NEW_DM_CONVERSATION",
                    "description": "Create a DM conversation",
                    "parameters": schema,
                    "strict": True,
                },
            }
        ]

        return client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "hello"}],
            tools=tools,
        )

    # Bad schema should raise
    with pytest.raises(Exception):
        run_request_with_schema(EXAMPLE_BAD_SCHEMA)

    # Normalized should succeed
    normalized = copy.deepcopy(EXAMPLE_BAD_SCHEMA)
    normalized["properties"]["message"]["additionalProperties"] = False
    normalized["properties"]["message"]["properties"] = {"text": {"type": "string"}}
    normalized["properties"]["message"]["required"] = ["text"]
    resp = run_request_with_schema(normalized)
    assert getattr(resp, "id", None)


@pytest.mark.asyncio
async def test_streamable_http_mcp_server_update_schema_no_docstring_required(client, agent_state, server_url):
    """
    Repro for schema-derivation-on-update error with MCP tools.

    Without the fix, calling add_mcp_tool a second time for the same MCP tool
    triggers a docstring-based schema derivation on a generated wrapper that has
    no docstring, causing a 500. With the fix in place, updates should succeed.
    """
    mcp_server_name = f"deepwiki_http_{uuid.uuid4().hex[:6]}"
    mcp_url = "https://mcp.deepwiki.com/mcp"

    http_mcp_config = StreamableHTTPServerConfig(server_name=mcp_server_name, server_url=mcp_url)
    try:
        client.tools.add_mcp_server(request=http_mcp_config)

        # Ensure server is registered
        servers = client.tools.list_mcp_servers()
        assert mcp_server_name in servers

        # Fetch available tools from server
        tools = client.tools.list_mcp_tools_by_server(mcp_server_name=mcp_server_name)
        assert tools, "Expected at least one tool from deepwiki streamable-http MCP server"
        ask_question_tool = next((t for t in tools if t.name == "ask_question"), None)
        assert ask_question_tool is not None, f"ask_question tool not found. Available: {[t.name for t in tools]}"

        # Initial create
        letta_tool_1 = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name=ask_question_tool.name)
        assert letta_tool_1 is not None

        # Update path (re-register same tool); should not attempt Python docstring schema derivation
        letta_tool_2 = client.tools.add_mcp_tool(mcp_server_name=mcp_server_name, mcp_tool_name=ask_question_tool.name)
        assert letta_tool_2 is not None
    finally:
        # Best-effort cleanup (DELETE by name)
        try:
            requests.delete(f"{server_url}/v1/tools/mcp/servers/{mcp_server_name}")
        except Exception:
            pass
