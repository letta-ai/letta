"""
Unit tests for the JSON Schema validator for OpenAI strict mode compliance.
"""

from letta.functions.schema_validator import SchemaHealth, validate_complete_json_schema


class TestSchemaValidator:
    """Test cases for the schema validator."""

    def test_valid_strict_compliant_schema(self):
        """Test a fully strict-compliant schema."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "The name of the user"},
                "age": {"type": "integer", "description": "The age of the user"},
                "address": {
                    "type": "object",
                    "properties": {"street": {"type": "string"}, "city": {"type": "string"}},
                    "required": ["street", "city"],
                    "additionalProperties": False,
                },
            },
            "required": ["name", "age", "address"],  # All properties must be required for strict mode
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_free_form_object_non_strict(self):
        """Test that free-form objects (like Composio message) are marked as NON_STRICT_ONLY."""
        schema = {
            "type": "object",
            "properties": {
                "message": {
                    "type": "object",
                    "description": "A message object",
                    # Missing additionalProperties: false makes this free-form
                }
            },
            "required": ["message"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.NON_STRICT_ONLY
        assert any("additionalProperties" in reason for reason in reasons)

    def test_empty_object_in_required_invalid(self):
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

    def test_missing_type_invalid(self):
        """Test that schemas missing type are marked INVALID."""
        schema = {
            # Missing "type": "object"
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.INVALID
        assert any("type" in reason.lower() for reason in reasons)

    def test_missing_items_in_array_invalid(self):
        """Test that arrays without items definition are marked INVALID."""
        schema = {
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array"
                    # Missing "items" definition
                }
            },
            "required": ["tags"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.INVALID
        assert any("items" in reason for reason in reasons)

    def test_required_property_not_in_properties_invalid(self):
        """Test that required properties not defined in properties are marked INVALID."""
        schema = {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name", "email"],  # "email" not in properties
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.INVALID
        assert any("email" in reason and "not found" in reason for reason in reasons)

    def test_nested_object_validation(self):
        """Test that nested objects are properly validated."""
        schema = {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {
                        "profile": {
                            "type": "object",
                            "properties": {"bio": {"type": "string"}},
                            # Missing additionalProperties and required
                        }
                    },
                    "required": ["profile"],
                    "additionalProperties": False,
                }
            },
            "required": ["user"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.NON_STRICT_ONLY
        # Should have warnings about nested profile object
        assert any("profile" in reason.lower() or "properties.profile" in reason for reason in reasons)

    def test_union_types_with_anyof(self):
        """Test schemas with anyOf union types."""
        schema = {
            "type": "object",
            "properties": {"value": {"anyOf": [{"type": "string"}, {"type": "number"}]}},
            "required": ["value"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_array_with_proper_items(self):
        """Test arrays with properly defined items."""
        schema = {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"id": {"type": "string"}, "value": {"type": "number"}},
                        "required": ["id", "value"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_empty_array_in_required_invalid(self):
        """Test that required properties allowing empty arrays are marked INVALID."""
        schema = {
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    # No minItems constraint, allows empty array
                }
            },
            "required": ["tags"],
            "additionalProperties": False,
        }

        # This should actually be STRICT_COMPLIANT since empty arrays with defined items are OK
        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT

    def test_array_without_constraints_invalid(self):
        """Test that arrays without any constraints in required props are invalid."""
        schema = {
            "type": "object",
            "properties": {
                "data": {
                    "type": "array"
                    # No items defined at all - completely unconstrained
                }
            },
            "required": ["data"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.INVALID
        assert any("items" in reason for reason in reasons)

    def test_composio_like_schema(self):
        """Test a schema similar to Composio's free-form message structure."""
        schema = {
            "type": "object",
            "properties": {
                "message": {
                    "type": "object",
                    "description": "Message to send",
                    # No properties defined, no additionalProperties: false
                    # This is a free-form object
                }
            },
            "required": ["message"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.NON_STRICT_ONLY
        assert any("additionalProperties" in reason for reason in reasons)

    def test_non_dict_schema(self):
        """Test that non-dict schemas are marked INVALID."""
        schema = "not a dict"

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.INVALID
        assert any("dict" in reason for reason in reasons)

    def test_schema_with_defaults_non_strict(self):
        """Test that root-level schemas without required field are STRICT_COMPLIANT (validator is relaxed)."""
        schema = {
            "type": "object",
            "properties": {"name": {"type": "string"}, "optional": {"type": "string"}},
            # Missing "required" field at root level - validator now accepts this
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        # Validator is relaxed - schemas with optional fields are now STRICT_COMPLIANT
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_composio_schema_with_optional_root_properties_non_strict(self):
        """Test that Composio-like schemas with optional root properties are STRICT_COMPLIANT (validator is relaxed)."""
        schema = {
            "type": "object",
            "properties": {
                "thinking": {"type": "string", "description": "Deep inner monologue"},
                "connected_account_id": {"type": "string", "description": "Specific connected account ID"},
                "toolkit": {"type": "string", "description": "Name of the toolkit"},
                "request_heartbeat": {"type": "boolean", "description": "Request immediate heartbeat"},
            },
            "required": ["thinking", "request_heartbeat"],  # Not all properties are required
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_root_level_without_required_non_strict(self):
        """Test that root-level objects without 'required' field are STRICT_COMPLIANT (validator is relaxed)."""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "integer"},
            },
            # No "required" field at root level - validator now accepts this
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        # Validator is relaxed - accepts schemas without required field
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_nested_object_without_required_non_strict(self):
        """Test that nested objects without 'required' are STRICT_COMPLIANT (validator is relaxed)."""
        schema = {
            "type": "object",
            "properties": {
                "user": {
                    "type": "object",
                    "properties": {
                        "preferences": {
                            "type": "object",
                            "properties": {"theme": {"type": "string"}, "language": {"type": "string"}},
                            # Missing "required" field in nested object
                            "additionalProperties": False,
                        },
                        "name": {"type": "string"},
                    },
                    "required": ["name"],  # Don't require preferences so it's not marked INVALID
                    "additionalProperties": False,
                }
            },
            "required": ["user"],
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_user_example_schema_non_strict(self):
        """Test the user's example schema with optional properties - now STRICT_COMPLIANT (validator is relaxed)."""
        schema = {
            "type": "object",
            "properties": {
                "a": {"title": "A", "type": "integer"},
                "b": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": None, "title": "B"},
            },
            "required": ["a"],  # Only 'a' is required, 'b' is not
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []

    def test_all_properties_required_strict_compliant(self):
        """Test that schemas with all properties required are STRICT_COMPLIANT."""
        schema = {
            "type": "object",
            "properties": {
                "a": {"title": "A", "type": "integer"},
                "b": {"anyOf": [{"type": "integer"}, {"type": "null"}], "default": None, "title": "B"},
            },
            "required": ["a", "b"],  # All properties are required
            "additionalProperties": False,
        }

        status, reasons = validate_complete_json_schema(schema)
        assert status == SchemaHealth.STRICT_COMPLIANT
        assert reasons == []
