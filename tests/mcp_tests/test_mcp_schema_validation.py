"""
Test MCP tool schema validation integration.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.functions.mcp_client.types import MCPTool, MCPToolHealth
from letta.functions.schema_generator import generate_tool_schema_for_mcp
from letta.functions.schema_validator import SchemaHealth, validate_complete_json_schema
from letta.server.rest_api.dependencies import HeaderParams


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
            headers = HeaderParams(actor_id="test_user")
            result = await add_mcp_tool(mcp_server_name="test_server", mcp_tool_name="test_tool", server=mock_server, headers=headers)

            # Verify the tool was added successfully
            assert result is not None

            # Verify create_mcp_tool_async was called with the right parameters
            mock_server.tool_manager.create_mcp_tool_async.assert_called_once()
            call_args = mock_server.tool_manager.create_mcp_tool_async.call_args
            assert call_args.kwargs["mcp_server_name"] == "test_server"


@pytest.mark.skip(reason="Allowing invalid schemas to be attached")
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
            headers = HeaderParams(actor_id="test_user")
            from letta.errors import LettaInvalidMCPSchemaError

            with pytest.raises(LettaInvalidMCPSchemaError) as exc_info:
                await add_mcp_tool(mcp_server_name="test_server", mcp_tool_name="test_tool", server=mock_server, headers=headers)

            assert "invalid schema" in exc_info.value.message.lower()
            assert exc_info.value.details["mcp_tool_name"] == "test_tool"
            assert exc_info.value.details["reasons"] == ["Missing 'type' at root level"]


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
    # anyOf should be preserved with integer and null types
    b_prop = strict_schema["parameters"]["properties"]["b"]
    assert "anyOf" in b_prop
    assert len(b_prop["anyOf"]) == 2
    types_in_anyof = {opt.get("type") for opt in b_prop["anyOf"]}
    assert types_in_anyof == {"integer", "null"}

    # Validate strict schema
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_type_deduplication():
    """Test that anyOf duplicates are removed in schema generation."""
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

    # Check that anyOf is preserved but duplicates are removed
    field_prop = strict_schema["parameters"]["properties"]["field"]
    assert "anyOf" in field_prop
    types_in_anyof = [opt.get("type") for opt in field_prop["anyOf"]]
    # Duplicates should be removed
    assert len(types_in_anyof) == 2  # Deduplicated to 2 entries
    assert types_in_anyof.count("string") == 1  # Only one string entry
    assert types_in_anyof.count("null") == 1  # One null entry


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
    """Test handling of UUID format in anyOf schemas (deduplicates but keeps format)."""
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

    # Check that anyOf is preserved with deduplication
    session_props = strict_schema["parameters"]["properties"]["session_id"]
    assert "anyOf" in session_props
    # Deduplication should keep the string with format (more specific)
    assert len(session_props["anyOf"]) == 2  # Deduplicated: string (with format) + null
    types_in_anyof = [opt.get("type") for opt in session_props["anyOf"]]
    assert types_in_anyof.count("string") == 1  # Only one string entry (the one with format)
    assert "null" in types_in_anyof
    # Verify the string entry has the uuid format
    string_entry = next(opt for opt in session_props["anyOf"] if opt.get("type") == "string")
    assert string_entry.get("format") == "uuid", "UUID format should be preserved"

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
    """Test that UUID format is preserved and duplicates are removed for required fields."""
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

    # Check that anyOf is deduplicated, keeping the more specific version
    session_props = strict_schema["parameters"]["properties"]["session_id"]
    assert "anyOf" in session_props
    # Deduplication should keep only the string with format (more specific)
    assert len(session_props["anyOf"]) == 1  # Deduplicated to 1 entry
    types_in_anyof = [opt.get("type") for opt in session_props["anyOf"]]
    assert types_in_anyof.count("string") == 1  # Only one string entry
    assert "null" not in types_in_anyof  # No null since it's required
    # UUID format should be preserved
    string_entry = session_props["anyOf"][0]
    assert string_entry.get("type") == "string"
    assert string_entry.get("format") == "uuid", "UUID format should be preserved"

    # Should be in required array
    assert "session_id" in strict_schema["parameters"]["required"]

    # Should be strict compliant
    status, _ = validate_complete_json_schema(strict_schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT


def test_mcp_schema_complex_nested_with_defs():
    """Test generating exact schema with nested Pydantic-like models using $defs."""
    import json

    from letta.functions.mcp_client.types import MCPToolHealth

    mcp_tool = MCPTool(
        name="get_vehicle_configuration",
        description="Get vehicle configuration details for a given model type and optional dealer info and customization options.\n\nArgs:\n    model_type (VehicleModel): The vehicle model type selection.\n    dealer_location (str | None): Dealer location identifier from registration system, if available.\n    customization_options (CustomizationData | None): Customization preferences for the vehicle from user selections, if available.\n\nReturns:\n    str: The vehicle configuration details.",
        inputSchema={
            "type": "object",
            "properties": {
                "model_type": {
                    "$ref": "#/$defs/VehicleModel",
                    "description": "The vehicle model type selection.",
                    "title": "Model Type",
                },
                "dealer_location": {
                    "anyOf": [{"type": "string"}, {"type": "null"}],
                    "default": None,
                    "description": "Dealer location identifier from registration system, if available.",
                    "title": "Dealer Location",
                },
                "customization_options": {
                    "anyOf": [{"$ref": "#/$defs/CustomizationData"}, {"type": "null"}],
                    "default": None,
                    "description": "Customization preferences for the vehicle from user selections, if available.",
                    "title": "Customization Options",
                },
            },
            "required": ["model_type"],
            "additionalProperties": False,
            "$defs": {
                "VehicleModel": {
                    "type": "string",
                    "enum": [
                        "sedan",
                        "suv",
                        "truck",
                        "coupe",
                        "hatchback",
                        "minivan",
                        "wagon",
                        "convertible",
                        "sports",
                        "luxury",
                        "electric",
                        "hybrid",
                        "compact",
                        "crossover",
                        "other",
                        "unknown",
                    ],
                    "title": "VehicleModel",
                },
                "Feature": {
                    "type": "object",
                    "properties": {
                        "feature_id": {
                            "anyOf": [{"type": "string"}, {"type": "null"}],
                            "default": None,
                            "title": "Feature ID",
                        },
                        "category_code": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Category Code",
                        },
                        "variant_code": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Variant Code",
                        },
                        "package_level": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Package Level",
                        },
                    },
                    "title": "Feature",
                    "additionalProperties": False,
                },
                "CustomizationData": {
                    "type": "object",
                    "properties": {
                        "has_premium_package": {
                            "anyOf": [{"type": "boolean"}, {"type": "null"}],
                            "default": None,
                            "title": "Has Premium Package",
                        },
                        "has_multiple_trims": {
                            "anyOf": [{"type": "boolean"}, {"type": "null"}],
                            "default": None,
                            "title": "Has Multiple Trims",
                        },
                        "selected_features": {
                            "anyOf": [
                                {"type": "array", "items": {"$ref": "#/$defs/Feature"}},
                                {"type": "null"},
                            ],
                            "default": None,
                            "title": "Selected Features",
                        },
                    },
                    "title": "CustomizationData",
                    "additionalProperties": False,
                },
            },
        },
    )
    # Initialize health status to simulate what happens in the server
    mcp_tool.health = MCPToolHealth(status=SchemaHealth.STRICT_COMPLIANT.value, reasons=[])

    # Generate schema with heartbeat
    schema = generate_tool_schema_for_mcp(mcp_tool, append_heartbeat=True, strict=False)

    # Add metadata fields (these are normally added by ToolCreate.from_mcp)
    from letta.schemas.tool import MCP_TOOL_METADATA_SCHEMA_STATUS, MCP_TOOL_METADATA_SCHEMA_WARNINGS

    schema[MCP_TOOL_METADATA_SCHEMA_STATUS] = mcp_tool.health.status
    schema[MCP_TOOL_METADATA_SCHEMA_WARNINGS] = mcp_tool.health.reasons

    # Expected schema
    expected_schema = {
        "name": "get_vehicle_configuration",
        "description": "Get vehicle configuration details for a given model type and optional dealer info and customization options.\n\nArgs:\n    model_type (VehicleModel): The vehicle model type selection.\n    dealer_location (str | None): Dealer location identifier from registration system, if available.\n    customization_options (CustomizationData | None): Customization preferences for the vehicle from user selections, if available.\n\nReturns:\n    str: The vehicle configuration details.",
        "parameters": {
            "$defs": {
                "Feature": {
                    "properties": {
                        "feature_id": {
                            "anyOf": [{"type": "string"}, {"type": "null"}],
                            "default": None,
                            "title": "Feature ID",
                        },
                        "category_code": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Category Code",
                        },
                        "variant_code": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Variant Code",
                        },
                        "package_level": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                            "default": None,
                            "title": "Package Level",
                        },
                    },
                    "title": "Feature",
                    "type": "object",
                    "additionalProperties": False,
                },
                "CustomizationData": {
                    "properties": {
                        "has_premium_package": {
                            "anyOf": [{"type": "boolean"}, {"type": "null"}],
                            "default": None,
                            "title": "Has Premium Package",
                        },
                        "has_multiple_trims": {
                            "anyOf": [{"type": "boolean"}, {"type": "null"}],
                            "default": None,
                            "title": "Has Multiple Trims",
                        },
                        "selected_features": {
                            "anyOf": [
                                {"items": {"$ref": "#/$defs/Feature"}, "type": "array"},
                                {"type": "null"},
                            ],
                            "default": None,
                            "title": "Selected Features",
                        },
                    },
                    "title": "CustomizationData",
                    "type": "object",
                    "additionalProperties": False,
                },
                "VehicleModel": {
                    "enum": [
                        "sedan",
                        "suv",
                        "truck",
                        "coupe",
                        "hatchback",
                        "minivan",
                        "wagon",
                        "convertible",
                        "sports",
                        "luxury",
                        "electric",
                        "hybrid",
                        "compact",
                        "crossover",
                        "other",
                        "unknown",
                    ],
                    "title": "VehicleModel",
                    "type": "string",
                },
            },
            "properties": {
                "model_type": {
                    "$ref": "#/$defs/VehicleModel",
                    "description": "The vehicle model type selection.",
                    "title": "Model Type",
                    "type": "string",
                },
                "dealer_location": {
                    "anyOf": [{"type": "string"}, {"type": "null"}],
                    "default": None,
                    "description": "Dealer location identifier from registration system, if available.",
                    "title": "Dealer Location",
                },
                "customization_options": {
                    "anyOf": [
                        {
                            "type": "object",
                            "title": "CustomizationData",
                            "additionalProperties": False,
                            "properties": {
                                "has_premium_package": {
                                    "anyOf": [{"type": "boolean"}, {"type": "null"}],
                                    "default": None,
                                    "title": "Has Premium Package",
                                },
                                "has_multiple_trims": {
                                    "anyOf": [{"type": "boolean"}, {"type": "null"}],
                                    "default": None,
                                    "title": "Has Multiple Trims",
                                },
                                "selected_features": {
                                    "anyOf": [
                                        {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "title": "Feature",
                                                "additionalProperties": False,
                                                "properties": {
                                                    "feature_id": {
                                                        "anyOf": [{"type": "string"}, {"type": "null"}],
                                                        "default": None,
                                                        "title": "Feature ID",
                                                    },
                                                    "category_code": {
                                                        "anyOf": [{"type": "integer"}, {"type": "null"}],
                                                        "default": None,
                                                        "title": "Category Code",
                                                    },
                                                    "variant_code": {
                                                        "anyOf": [{"type": "integer"}, {"type": "null"}],
                                                        "default": None,
                                                        "title": "Variant Code",
                                                    },
                                                    "package_level": {
                                                        "anyOf": [{"type": "integer"}, {"type": "null"}],
                                                        "default": None,
                                                        "title": "Package Level",
                                                    },
                                                },
                                            },
                                        },
                                        {"type": "null"},
                                    ],
                                    "default": None,
                                    "title": "Selected Features",
                                },
                            },
                        },
                        {"type": "null"},
                    ],
                    "default": None,
                    "description": "Customization preferences for the vehicle from user selections, if available.",
                    "title": "Customization Options",
                },
                "request_heartbeat": {
                    "type": "boolean",
                    "description": "Request an immediate heartbeat after function execution. You MUST set this value to `True` if you want to send a follow-up message or run a follow-up tool call (chain multiple tools together). If set to `False` (the default), then the chain of execution will end immediately after this function call.",
                },
            },
            "required": ["model_type", "request_heartbeat"],
            "type": "object",
            "additionalProperties": False,
        },
        "mcp:SCHEMA_STATUS": "STRICT_COMPLIANT",
        "mcp:SCHEMA_WARNINGS": [],
    }

    # Compare key components
    assert schema["name"] == expected_schema["name"]
    assert schema["description"] == expected_schema["description"]
    assert schema["parameters"]["type"] == expected_schema["parameters"]["type"]
    assert schema["parameters"]["additionalProperties"] == expected_schema["parameters"]["additionalProperties"]
    assert set(schema["parameters"]["required"]) == set(expected_schema["parameters"]["required"])

    # Check $defs
    assert "$defs" in schema["parameters"]
    assert set(schema["parameters"]["$defs"].keys()) == set(expected_schema["parameters"]["$defs"].keys())

    # Check properties
    assert "model_type" in schema["parameters"]["properties"]
    assert "dealer_location" in schema["parameters"]["properties"]
    assert "customization_options" in schema["parameters"]["properties"]
    assert "request_heartbeat" in schema["parameters"]["properties"]

    # Verify model_type property ($ref is inlined)
    model_prop = schema["parameters"]["properties"]["model_type"]
    assert model_prop["type"] == "string"
    assert "enum" in model_prop, "$ref should be inlined with enum values"
    assert model_prop["description"] == "The vehicle model type selection."

    # Verify dealer_location property (anyOf preserved)
    dl_prop = schema["parameters"]["properties"]["dealer_location"]
    assert "anyOf" in dl_prop, "anyOf should be preserved for optional primitives"
    assert len(dl_prop["anyOf"]) == 2
    types_in_anyof = {opt.get("type") for opt in dl_prop["anyOf"]}
    assert types_in_anyof == {"string", "null"}
    assert dl_prop["description"] == "Dealer location identifier from registration system, if available."

    # Verify customization_options property (anyOf with fully inlined $refs)
    co_prop = schema["parameters"]["properties"]["customization_options"]
    assert "anyOf" in co_prop, "Should use anyOf structure"
    assert len(co_prop["anyOf"]) == 2, "Should have object and null options"

    # Find the object option in anyOf
    object_option = next((opt for opt in co_prop["anyOf"] if opt.get("type") == "object"), None)
    assert object_option is not None, "Should have object type in anyOf"
    assert object_option["additionalProperties"] is False, "Object must have additionalProperties: false"
    assert "properties" in object_option, "$ref should be fully inlined with properties"

    # Verify the inlined properties are present
    assert "has_premium_package" in object_option["properties"]
    assert "has_multiple_trims" in object_option["properties"]
    assert "selected_features" in object_option["properties"]

    # Verify nested selected_features array has inlined Feature objects
    features_prop = object_option["properties"]["selected_features"]
    assert "anyOf" in features_prop, "selected_features should have anyOf"
    array_option = next((opt for opt in features_prop["anyOf"] if opt.get("type") == "array"), None)
    assert array_option is not None
    assert "items" in array_option
    assert array_option["items"]["type"] == "object"
    assert array_option["items"]["additionalProperties"] is False
    assert "feature_id" in array_option["items"]["properties"]
    assert "category_code" in array_option["items"]["properties"]

    # Verify metadata fields
    assert schema[MCP_TOOL_METADATA_SCHEMA_STATUS] == "STRICT_COMPLIANT"
    assert schema[MCP_TOOL_METADATA_SCHEMA_WARNINGS] == []

    # Should be strict compliant
    status, _ = validate_complete_json_schema(schema["parameters"])
    assert status == SchemaHealth.STRICT_COMPLIANT
