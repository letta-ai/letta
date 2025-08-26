"""
Test MCP tool schema validation integration.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.functions.mcp_client.types import MCPTool, MCPToolHealth
from letta.functions.schema_generator import generate_tool_schema_for_mcp
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


def test_mcp_schema_healing_for_optional_fields():
    """Test that optional fields in MCP schemas are healed only in strict mode."""
    # Create an MCP tool with optional field 'b'
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool",
        inputSchema={
            "type": "object",
            "properties": {
                "a": {"type": "integer", "description": "Required field"},
                "b": {"type": "integer", "description": "Optional field"},
            },
            "required": ["a"],  # Only 'a' is required
            "additionalProperties": False,
        },
    )

    # Generate schema without strict mode - should NOT heal optional fields
    non_strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=False)
    assert "a" in non_strict_schema["parameters"]["required"]
    assert "b" not in non_strict_schema["parameters"]["required"]  # Should remain optional
    assert non_strict_schema["parameters"]["properties"]["b"]["type"] == "integer"  # No null added

    # Validate non-strict schema - should still be STRICT_COMPLIANT because validator is relaxed
    status, _ = validate_complete_json_schema(non_strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT

    # Generate schema with strict mode - should heal optional fields
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)
    assert strict_schema["strict"] is True
    assert "a" in strict_schema["parameters"]["required"]
    assert "b" in strict_schema["parameters"]["required"]  # Now required
    assert set(strict_schema["parameters"]["properties"]["b"]["type"]) == {"integer", "null"}  # Now accepts null

    # Validate strict schema
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT  # Should pass strict mode


def test_mcp_schema_healing_with_anyof():
    """Test schema healing for fields with anyOf that include optional types."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool",
        inputSchema={
            "type": "object",
            "properties": {
                "a": {"type": "string", "description": "Required field"},
                "b": {
                    "anyOf": [{"type": "integer"}, {"type": "null"}],
                    "description": "Optional field with anyOf",
                },
            },
            "required": ["a"],  # Only 'a' is required
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)
    assert strict_schema["strict"] is True
    assert "a" in strict_schema["parameters"]["required"]
    assert "b" in strict_schema["parameters"]["required"]  # Now required
    # Type should be flattened array with deduplication
    assert set(strict_schema["parameters"]["properties"]["b"]["type"]) == {"integer", "null"}

    # Validate strict schema
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_type_deduplication():
    """Test that duplicate types are deduplicated in schema generation."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool",
        inputSchema={
            "type": "object",
            "properties": {
                "field": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "string"},  # Duplicate
                        {"type": "null"},
                    ],
                    "description": "Field with duplicate types",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)

    # Check that duplicates were removed
    field_types = strict_schema["parameters"]["properties"]["field"]["type"]
    assert len(field_types) == len(set(field_types))  # No duplicates
    assert set(field_types) == {"string", "null"}


def test_mcp_schema_healing_preserves_existing_null():
    """Test that schema healing doesn't add duplicate null when it already exists."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool",
        inputSchema={
            "type": "object",
            "properties": {
                "field": {
                    "type": ["string", "null"],  # Already has null
                    "description": "Field that already accepts null",
                },
            },
            "required": [],  # Optional
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)

    # Check that null wasn't duplicated
    field_types = strict_schema["parameters"]["properties"]["field"]["type"]
    null_count = field_types.count("null")
    assert null_count == 1  # Should only have one null


def test_mcp_schema_healing_all_fields_already_required():
    """Test that schema healing works correctly when all fields are already required."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool",
        inputSchema={
            "type": "object",
            "properties": {
                "a": {"type": "string", "description": "Field A"},
                "b": {"type": "integer", "description": "Field B"},
            },
            "required": ["a", "b"],  # All fields already required
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)

    # Check that fields remain as-is
    assert set(strict_schema["parameters"]["required"]) == {"a", "b"}
    assert strict_schema["parameters"]["properties"]["a"]["type"] == "string"
    assert strict_schema["parameters"]["properties"]["b"]["type"] == "integer"

    # Should be strict compliant
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_with_uuid_format():
    """Test handling of UUID format in anyOf schemas (root cause of duplicate string types)."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool with UUID formatted field",
        inputSchema={
            "type": "object",
            "properties": {
                "session_id": {
                    "anyOf": [{"type": "string"}, {"format": "uuid", "type": "string"}, {"type": "null"}],
                    "description": "Session ID that can be a string, UUID, or null",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)

    # Check that string type is not duplicated
    session_props = strict_schema["parameters"]["properties"]["session_id"]
    assert set(session_props["type"]) == {"string", "null"}  # No duplicate strings
    # Format should NOT be preserved because field is optional (has null type)
    assert "format" not in session_props

    # Should be in required array (healed)
    assert "session_id" in strict_schema["parameters"]["required"]

    # Should be strict compliant
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_healing_only_in_strict_mode():
    """Test that schema healing only happens in strict mode."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="Test that healing only happens in strict mode",
        inputSchema={
            "type": "object",
            "properties": {
                "required_field": {"type": "string", "description": "Already required"},
                "optional_field1": {"type": "integer", "description": "Optional 1"},
                "optional_field2": {"type": "boolean", "description": "Optional 2"},
            },
            "required": ["required_field"],
            "additionalProperties": False,
        },
    )

    # Test with strict=False - no healing
    non_strict = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=False)
    assert "strict" not in non_strict  # strict flag not set
    assert non_strict["parameters"]["required"] == ["required_field"]  # Only originally required field
    assert non_strict["parameters"]["properties"]["required_field"]["type"] == "string"
    assert non_strict["parameters"]["properties"]["optional_field1"]["type"] == "integer"  # No null
    assert non_strict["parameters"]["properties"]["optional_field2"]["type"] == "boolean"  # No null

    # Test with strict=True - healing happens
    strict = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)
    assert strict["strict"] is True  # strict flag is set
    assert set(strict["parameters"]["required"]) == {"required_field", "optional_field1", "optional_field2"}
    assert strict["parameters"]["properties"]["required_field"]["type"] == "string"
    assert set(strict["parameters"]["properties"]["optional_field1"]["type"]) == {"integer", "null"}
    assert set(strict["parameters"]["properties"]["optional_field2"]["type"]) == {"boolean", "null"}

    # Both should be strict compliant (validator is relaxed)
    status1, _ = validate_complete_json_schema(non_strict["parameters"])
    status2, _ = validate_complete_json_schema(strict["parameters"])
    assert status1 == SchemaHealth.STRICT_COMPLIANT
    assert status2 == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_with_uuid_format_required_field():
    """Test that UUID format is preserved for required fields that don't have null type."""
    mcp_tool = MCPTool(
        name="test_tool",
        description="A test tool with required UUID formatted field",
        inputSchema={
            "type": "object",
            "properties": {
                "session_id": {
                    "anyOf": [{"type": "string"}, {"format": "uuid", "type": "string"}],
                    "description": "Session ID that must be a string with UUID format",
                },
            },
            "required": ["session_id"],  # Required field
            "additionalProperties": False,
        },
    )

    # Generate strict schema
    strict_schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=False, strict=True)

    # Check that string type is not duplicated and format IS preserved
    session_props = strict_schema["parameters"]["properties"]["session_id"]
    assert session_props["type"] == ["string"]  # No null, no duplicates
    assert "format" in session_props
    assert session_props["format"] == "uuid"  # Format should be preserved for non-optional field

    # Should be in required array
    assert "session_id" in strict_schema["parameters"]["required"]

    # Should be strict compliant
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT
