"""
Test MCP tool schema validation integration.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.functions.mcp_client.types import MCPTool, MCPToolHealth
from letta.functions.schema_validator import SchemaHealth, validate_complete_json_schema


@pytest.mark.asyncio
async def test_mcp_tools_get_health_status():
    """Test that MCP tools receive health status when listed."""
    from letta.server.server import SyncServer

    # Create mock tools with different schema types
    mock_tools = [
        # Strict compliant tool
        MCPTool(
            name="strict_tool",
            inputSchema={"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"], "additionalProperties": False},
        ),
        # Non-strict tool (free-form object)
        MCPTool(
            name="non_strict_tool",
            inputSchema={
                "type": "object",
                "properties": {"message": {"type": "object", "additionalProperties": {}}},  # Free-form object
                "required": ["message"],
                "additionalProperties": False,
            },
        ),
        # Invalid tool (missing type)
        MCPTool(name="invalid_tool", inputSchema={"properties": {"data": {"type": "string"}}, "required": ["data"]}),
    ]

    # Mock the server and client
    mock_client = AsyncMock()
    mock_client.list_tools = AsyncMock(return_value=mock_tools)

    # Call the method directly
    actual_server = SyncServer.__new__(SyncServer)
    actual_server.mcp_clients = {"test_server": mock_client}

    tools = await actual_server.get_tools_from_mcp_server("test_server")

    # Verify health status was added
    assert len(tools) == 3

    # Check strict tool
    strict_tool = tools[0]
    assert strict_tool.name == "strict_tool"
    assert strict_tool.health is not None
    assert strict_tool.health.status == SchemaHealth.STRICT_COMPLIANT.value
    assert strict_tool.health.reasons == []

    # Check non-strict tool
    non_strict_tool = tools[1]
    assert non_strict_tool.name == "non_strict_tool"
    assert non_strict_tool.health is not None
    assert non_strict_tool.health.status == SchemaHealth.NON_STRICT_ONLY.value
    assert len(non_strict_tool.health.reasons) > 0
    assert any("additionalProperties" in reason for reason in non_strict_tool.health.reasons)

    # Check invalid tool
    invalid_tool = tools[2]
    assert invalid_tool.name == "invalid_tool"
    assert invalid_tool.health is not None
    assert invalid_tool.health.status == SchemaHealth.INVALID.value
    assert len(invalid_tool.health.reasons) > 0
    assert any("type" in reason for reason in invalid_tool.health.reasons)


def test_composio_like_schema_marked_non_strict():
    """Test that Composio-like schemas are correctly marked as NON_STRICT_ONLY."""

    # Example schema from Composio with free-form message object
    composio_schema = {
        "type": "object",
        "properties": {
            "message": {"type": "object", "additionalProperties": {}, "description": "Message to send"}  # Free-form, missing "type"
        },
        "required": ["message"],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(composio_schema)

    assert status == SchemaHealth.NON_STRICT_ONLY
    assert len(reasons) > 0
    assert any("additionalProperties" in reason for reason in reasons)


def test_empty_object_in_required_marked_invalid():
    """Test that required properties allowing empty objects are marked INVALID."""

    schema = {
        "type": "object",
        "properties": {
            "config": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}  # Empty object schema
        },
        "required": ["config"],  # Required but allows empty object
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    assert status == SchemaHealth.INVALID
    assert any("empty object" in reason for reason in reasons)
    assert any("config" in reason for reason in reasons)


@pytest.mark.asyncio
async def test_add_mcp_tool_accepts_non_strict_schemas():
    """Test that adding MCP tools with non-strict schemas is allowed."""
    from letta.server.rest_api.routers.v1.tools import add_mcp_tool
    from letta.settings import tool_settings

    # Mock a non-strict tool
    non_strict_tool = MCPTool(
        name="test_tool",
        inputSchema={
            "type": "object",
            "properties": {"message": {"type": "object"}},  # Missing additionalProperties: false
            "required": ["message"],
            "additionalProperties": False,
        },
    )
    non_strict_tool.health = MCPToolHealth(status=SchemaHealth.NON_STRICT_ONLY.value, reasons=["Missing additionalProperties for message"])

    # Mock server response
    with patch("letta.server.rest_api.routers.v1.tools.get_letta_server") as mock_get_server:
        with patch.object(tool_settings, "mcp_read_from_config", True):  # Ensure we're using config path
            mock_server = AsyncMock()
            mock_server.get_tools_from_mcp_server = AsyncMock(return_value=[non_strict_tool])
            mock_server.user_manager.get_user_or_default = MagicMock()
            mock_server.tool_manager.create_mcp_tool_async = AsyncMock(return_value=non_strict_tool)
            mock_get_server.return_value = mock_server

            # Should accept non-strict schema without raising an exception
            result = await add_mcp_tool(mcp_server_name="test_server", mcp_tool_name="test_tool", server=mock_server, actor_id=None)

            # Verify the tool was added successfully
            assert result is not None

            # Verify create_mcp_tool_async was called with the right parameters
            mock_server.tool_manager.create_mcp_tool_async.assert_called_once()
            call_args = mock_server.tool_manager.create_mcp_tool_async.call_args
            assert call_args.kwargs["mcp_server_name"] == "test_server"


@pytest.mark.asyncio
async def test_add_mcp_tool_rejects_invalid_schemas():
    """Test that adding MCP tools with invalid schemas is rejected."""
    from fastapi import HTTPException

    from letta.server.rest_api.routers.v1.tools import add_mcp_tool
    from letta.settings import tool_settings

    # Mock an invalid tool
    invalid_tool = MCPTool(
        name="test_tool",
        inputSchema={
            "properties": {"data": {"type": "string"}},
            "required": ["data"],
            # Missing "type": "object"
        },
    )
    invalid_tool.health = MCPToolHealth(status=SchemaHealth.INVALID.value, reasons=["Missing 'type' at root level"])

    # Mock server response
    with patch("letta.server.rest_api.routers.v1.tools.get_letta_server") as mock_get_server:
        with patch.object(tool_settings, "mcp_read_from_config", True):  # Ensure we're using config path
            mock_server = AsyncMock()
            mock_server.get_tools_from_mcp_server = AsyncMock(return_value=[invalid_tool])
            mock_server.user_manager.get_user_or_default = MagicMock()
            mock_get_server.return_value = mock_server

            # Should raise HTTPException for invalid schema
            with pytest.raises(HTTPException) as exc_info:
                await add_mcp_tool(mcp_server_name="test_server", mcp_tool_name="test_tool", server=mock_server, actor_id=None)

            assert exc_info.value.status_code == 400
            assert "invalid schema" in exc_info.value.detail["message"].lower()
            assert exc_info.value.detail["health_status"] == SchemaHealth.INVALID.value
