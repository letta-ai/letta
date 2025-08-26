"""
Test schema validation for OpenAI strict mode compliance.
"""

from letta.functions.schema_validator import SchemaHealth, validate_complete_json_schema


def test_user_example_schema_now_strict():
    """Test that schemas with optional fields are now considered STRICT_COMPLIANT (will be healed)."""
    schema = {
        "properties": {
            "a": {"title": "A", "type": "integer"},
            "b": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "B",
            },
        },
        "required": ["a"],  # Only 'a' is required, 'b' is not
        "type": "object",
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should now be STRICT_COMPLIANT because we can heal optional fields
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_all_properties_required_is_strict():
    """Test that schemas with all properties required are STRICT_COMPLIANT."""
    schema = {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"anyOf": [{"type": "integer"}, {"type": "null"}]},  # Optional via null type
        },
        "required": ["a", "b"],  # All properties are required
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT since all properties are required
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_nested_object_missing_required_now_strict():
    """Test that nested objects with optional fields are now STRICT_COMPLIANT (will be healed)."""
    schema = {
        "type": "object",
        "properties": {
            "config": {
                "type": "object",
                "properties": {
                    "host": {"type": "string"},
                    "port": {"type": "integer"},
                    "optional_field": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                },
                "required": ["host", "port"],  # optional_field not required
                "additionalProperties": False,
            }
        },
        "required": ["config"],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should now be STRICT_COMPLIANT because we can heal optional fields
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_nested_object_all_required_is_strict():
    """Test that nested objects with all properties required are STRICT_COMPLIANT."""
    schema = {
        "type": "object",
        "properties": {
            "config": {
                "type": "object",
                "properties": {
                    "host": {"type": "string"},
                    "port": {"type": "integer"},
                    "timeout": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                },
                "required": ["host", "port", "timeout"],  # All properties required
                "additionalProperties": False,
            }
        },
        "required": ["config"],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT since all properties at all levels are required
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_empty_object_no_properties_is_strict():
    """Test that objects with no properties are STRICT_COMPLIANT."""
    schema = {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Empty objects with no properties should be STRICT_COMPLIANT
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_missing_additionalproperties_not_strict():
    """Test that missing additionalProperties makes schema NON_STRICT_ONLY."""
    schema = {
        "type": "object",
        "properties": {
            "field": {"type": "string"},
        },
        "required": ["field"],
        # Missing additionalProperties
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be NON_STRICT_ONLY due to missing additionalProperties
    assert status == SchemaHealth.NON_STRICT_ONLY
    assert any("additionalProperties" in reason and "not explicitly set" in reason for reason in reasons)


def test_additionalproperties_true_not_strict():
    """Test that additionalProperties: true makes schema NON_STRICT_ONLY."""
    schema = {
        "type": "object",
        "properties": {
            "field": {"type": "string"},
        },
        "required": ["field"],
        "additionalProperties": True,  # Allows additional properties
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be NON_STRICT_ONLY due to additionalProperties not being false
    assert status == SchemaHealth.NON_STRICT_ONLY
    assert any("additionalProperties" in reason and "not false" in reason for reason in reasons)


def test_complex_schema_with_arrays():
    """Test a complex schema with arrays and nested objects."""
    schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "name": {"type": "string"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["id", "name", "tags"],  # All properties required
                    "additionalProperties": False,
                },
            },
            "total": {"type": "integer"},
        },
        "required": ["items", "total"],  # All properties required
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT since all properties at all levels are required
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_fastmcp_tool_schema_now_strict():
    """Test that a schema from FastMCP with optional field 'b' is now STRICT_COMPLIANT."""
    # This is the exact schema format provided by the user
    schema = {
        "properties": {
            "a": {"title": "A", "type": "integer"},
            "b": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": None, "title": "B"},
        },
        "required": ["a"],  # Only 'a' is required, but we can heal this
        "type": "object",
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should now be STRICT_COMPLIANT because we can heal optional fields
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_union_types_with_anyof():
    """Test that anyOf unions are handled correctly."""
    schema = {
        "type": "object",
        "properties": {
            "value": {
                "anyOf": [
                    {"type": "string"},
                    {"type": "number"},
                    {"type": "null"},
                ]
            }
        },
        "required": ["value"],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT - anyOf is allowed and all properties are required
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_healed_schema_with_type_array():
    """Test that healed schemas with type arrays including null are STRICT_COMPLIANT."""
    # This represents a schema that has been healed by adding null to optional fields
    schema = {
        "type": "object",
        "properties": {
            "required_field": {"type": "string"},
            "optional_field": {"type": ["integer", "null"]},  # Healed: was optional, now required with null
        },
        "required": ["required_field", "optional_field"],  # All fields now required
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT since all properties are required
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []


def test_healed_nested_schema():
    """Test that healed nested schemas are STRICT_COMPLIANT."""
    schema = {
        "type": "object",
        "properties": {
            "config": {
                "type": "object",
                "properties": {
                    "host": {"type": "string"},
                    "port": {"type": ["integer", "null"]},  # Healed optional field
                    "timeout": {"type": ["number", "null"]},  # Healed optional field
                },
                "required": ["host", "port", "timeout"],  # All fields required after healing
                "additionalProperties": False,
            }
        },
        "required": ["config"],
        "additionalProperties": False,
    }

    status, reasons = validate_complete_json_schema(schema)

    # Should be STRICT_COMPLIANT after healing
    assert status == SchemaHealth.STRICT_COMPLIANT
    assert reasons == []
