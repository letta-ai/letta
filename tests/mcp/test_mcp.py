import json
import os
import subprocess
import venv
from pathlib import Path

import pytest
from mcp import Tool as MCPTool

import letta.constants as constants
from letta.config import LettaConfig
from letta.functions.mcp_client.types import MCPServerType, SSEServerConfig, StdioServerConfig
from letta.schemas.tool import ToolCreate
from letta.server.server import SyncServer
from letta.utils import parse_json


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


@pytest.fixture
def empty_mcp_config(tmp_path):
    path = Path(__file__).parent / "mcp_config.json"
    path.write_text(json.dumps({}))  # writes "{}"

    return path


@pytest.fixture
def server(empty_mcp_config):
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    old_dir = constants.LETTA_DIR
    constants.LETTA_DIR = str(Path(__file__).parent)

    server = SyncServer()
    yield server
    constants.LETTA_DIR = old_dir


@pytest.fixture
def default_user(server):
    user = server.user_manager.get_user_or_default()
    yield user


def test_sse_mcp_server(server, default_user):
    assert server.mcp_clients == {}

    mcp_server_name = "github_composio"
    server_url = "https://mcp.composio.dev/composio/server/3c44733b-75ae-4ba8-9a68-7153265fadd8"
    sse_mcp_config = SSEServerConfig(server_name=mcp_server_name, server_url=server_url)
    server.add_mcp_server_to_config(sse_mcp_config)

    # Check that it's in clients
    assert mcp_server_name in server.mcp_clients

    # Check that it's in the server mapping
    mcp_server_mapping = server.get_mcp_servers()
    assert mcp_server_name in mcp_server_mapping
    assert mcp_server_mapping[mcp_server_name] == sse_mcp_config

    # Check tools
    tools = server.get_tools_from_mcp_server(mcp_server_name)
    assert len(tools) > 0
    assert isinstance(tools[0], MCPTool)
    star_mcp_tool = next((t for t in tools if t.name == "GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER"), None)

    # Check that one of the tools are executable
    tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=star_mcp_tool)
    server.tool_manager.create_or_update_mcp_tool(tool_create=tool_create, mcp_server_name=mcp_server_name, actor=default_user)

    function_response, is_error = server.mcp_clients[mcp_server_name].execute_tool(
        tool_name=star_mcp_tool.name, tool_args={"owner": "letta-ai", "repo": "letta"}
    )
    assert not is_error
    function_response = parse_json(function_response)
    assert function_response.get("successful"), function_response
    assert function_response.get("data").get("details") == "Action executed successfully", function_response


def test_stdio_mcp_server(server, default_user):
    assert server.mcp_clients == {}

    # Create venv
    create_virtualenv_and_install_requirements(Path(__file__).parent / "weather" / "requirements.txt")

    mcp_server_name = "weather"
    command = str(Path(__file__).parent / "weather" / "venv" / "bin" / "python3")
    args = [str(Path(__file__).parent / "weather" / "weather.py")]
    stdio_mcp_config = StdioServerConfig(server_name=mcp_server_name, command=command, args=args)
    server.add_mcp_server_to_config(stdio_mcp_config)

    # Check that it's in clients
    assert mcp_server_name in server.mcp_clients

    # Check that it's in the server mapping
    mcp_server_mapping = server.get_mcp_servers()
    assert mcp_server_name in mcp_server_mapping
    assert mcp_server_mapping[mcp_server_name] == StdioServerConfig(
        server_name=mcp_server_name, type=MCPServerType.STDIO, command=command, args=args, env=None
    )

    # Check that it can return valid tools
    tools = server.get_tools_from_mcp_server(mcp_server_name)
    assert tools == [
        MCPTool(
            name="get_alerts",
            description="Get weather alerts for a US state.\n\n    Args:\n        state: Two-letter US state code (e.g. CA, NY)\n    ",
            inputSchema={
                "properties": {"state": {"title": "State", "type": "string"}},
                "required": ["state"],
                "title": "get_alertsArguments",
                "type": "object",
            },
        ),
        MCPTool(
            name="get_forecast",
            description="Get weather forecast for a location.\n\n    Args:\n        latitude: Latitude of the location\n        longitude: Longitude of the location\n    ",
            inputSchema={
                "properties": {"latitude": {"title": "Latitude", "type": "number"}, "longitude": {"title": "Longitude", "type": "number"}},
                "required": ["latitude", "longitude"],
                "title": "get_forecastArguments",
                "type": "object",
            },
        ),
    ]
    get_alerts_mcp_tool = tools[0]

    tool_create = ToolCreate.from_mcp(mcp_server_name=mcp_server_name, mcp_tool=get_alerts_mcp_tool)
    server.tool_manager.create_or_update_mcp_tool(tool_create=tool_create, mcp_server_name=mcp_server_name, actor=default_user)

    # Attempt running the tool
    function_response, is_error = server.mcp_clients[mcp_server_name].execute_tool(tool_name="get_alerts", tool_args={"state": "CA"})
    assert not is_error
    assert len(function_response) > 20, function_response  # Crude heuristic for an expected result
