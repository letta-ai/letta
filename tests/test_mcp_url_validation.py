from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from letta.functions.mcp_client.types import MCPServerType, SSEServerConfig, StreamableHTTPServerConfig
from letta.helpers.url_validation import validate_mcp_server_url
from letta.schemas.mcp import MCPServer
from letta.schemas.mcp_server import CreateMCPServerRequest
from letta.schemas.user import User
from letta.services.mcp_manager import MCPManager
from letta.services.mcp_server_manager import MCPServerManager


def test_validate_mcp_server_url_rejects_private_ip_literal():
    with pytest.raises(ValueError, match="Non-public IP not allowed"):
        validate_mcp_server_url("http://127.0.0.1:8000")


def test_validate_mcp_server_url_rejects_cluster_local_hostname():
    with pytest.raises(ValueError, match="Blocked internal hostname"):
        validate_mcp_server_url("https://service.namespace.svc.cluster.local/mcp")


def test_validate_mcp_server_url_allows_public_hostname():
    with patch("letta.helpers.url_validation.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        assert validate_mcp_server_url("https://example.com/mcp") == "https://example.com/mcp"


def test_validate_mcp_server_url_without_resolution_allows_public_looking_hostname():
    assert validate_mcp_server_url("https://test.example.com/mcp", resolve_hostname=False) == "https://test.example.com/mcp"


def test_mcp_schema_rejects_internal_server_url():
    with pytest.raises(ValidationError, match="Non-public IP not allowed"):
        MCPServer(server_name="bad", server_type=MCPServerType.SSE, server_url="http://127.0.0.1:9999")


def test_mcp_schema_allows_public_looking_unresolved_server_url():
    server = MCPServer(server_name="good", server_type=MCPServerType.SSE, server_url="https://test.example.com/mcp")
    assert server.server_url == "https://test.example.com/mcp"


def test_mcp_server_request_schema_rejects_internal_server_url():
    with pytest.raises(ValidationError, match="Blocked internal hostname"):
        CreateMCPServerRequest(
            server_name="bad",
            config={
                "mcp_server_type": "sse",
                "server_url": "https://metadata.google.internal/mcp",
            },
        )


@pytest.mark.asyncio
async def test_mcp_manager_get_mcp_client_rejects_existing_internal_url():
    manager = MCPManager()
    actor = User(name="test")
    config = SSEServerConfig(server_name="bad", server_url="http://127.0.0.1:9999")

    with patch.object(manager, "get_oauth_session_by_server", AsyncMock(return_value=None)):
        with pytest.raises(ValueError, match="Non-public IP not allowed"):
            await manager.get_mcp_client(config, actor=actor)


@pytest.mark.asyncio
async def test_mcp_manager_get_mcp_client_rejects_existing_internal_url_with_explicit_oauth():
    manager = MCPManager()
    actor = User(name="test")
    config = SSEServerConfig(server_name="bad", server_url="http://127.0.0.1:9999")

    with pytest.raises(ValueError, match="Non-public IP not allowed"):
        await manager.get_mcp_client(config, actor=actor, oauth=object())


@pytest.mark.asyncio
async def test_mcp_server_manager_get_mcp_client_allows_public_url():
    manager = MCPServerManager()
    actor = User(name="test")
    config = StreamableHTTPServerConfig(server_name="good", server_url="https://example.com/mcp")

    with patch("letta.helpers.url_validation.socket.getaddrinfo", return_value=[(None, None, None, None, ("93.184.216.34", 443))]):
        with patch.object(manager, "get_oauth_session_by_server", AsyncMock(return_value=None)):
            client = await manager.get_mcp_client(config, actor=actor)

    assert client.server_config.server_url == "https://example.com/mcp"


@pytest.mark.asyncio
async def test_mcp_server_manager_get_mcp_client_rejects_existing_internal_url_with_explicit_oauth():
    manager = MCPServerManager()
    actor = User(name="test")
    config = StreamableHTTPServerConfig(server_name="bad", server_url="http://127.0.0.1:9999")

    with pytest.raises(ValueError, match="Non-public IP not allowed"):
        await manager.get_mcp_client(config, actor=actor, oauth=object())
