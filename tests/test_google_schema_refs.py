"""Unit tests for GoogleVertexClient._resolve_json_schema_refs and $ref safety net."""

import pytest

from letta.llm_api.google_vertex_client import GoogleVertexClient


@pytest.fixture
def client():
    return GoogleVertexClient()


class TestResolveJsonSchemaRefs:
    def test_single_def_with_ref(self, client):
        schema = {
            "type": "object",
            "properties": {
                "status": {"$ref": "#/$defs/StatusEnum"},
            },
            "$defs": {
                "StatusEnum": {"type": "string", "enum": ["active", "inactive"]},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$defs" not in result
        assert result["properties"]["status"] == {"type": "string", "enum": ["active", "inactive"]}

    def test_multiple_defs(self, client):
        schema = {
            "type": "object",
            "properties": {
                "ticket": {"$ref": "#/$defs/TicketStatus"},
                "report": {"$ref": "#/$defs/ReportType"},
            },
            "$defs": {
                "TicketStatus": {"type": "string", "enum": ["open", "closed"]},
                "ReportType": {"type": "string", "enum": ["summary", "detailed"]},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$defs" not in result
        assert result["properties"]["ticket"] == {"type": "string", "enum": ["open", "closed"]}
        assert result["properties"]["report"] == {"type": "string", "enum": ["summary", "detailed"]}

    def test_nested_ref_in_def(self, client):
        schema = {
            "type": "object",
            "properties": {
                "order": {"$ref": "#/$defs/Order"},
            },
            "$defs": {
                "Order": {
                    "type": "object",
                    "properties": {
                        "status": {"$ref": "#/$defs/OrderStatus"},
                    },
                },
                "OrderStatus": {"type": "string", "enum": ["pending", "shipped"]},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$defs" not in result
        assert result["properties"]["order"]["properties"]["status"] == {"type": "string", "enum": ["pending", "shipped"]}

    def test_ref_inside_anyof(self, client):
        schema = {
            "type": "object",
            "properties": {
                "value": {
                    "anyOf": [
                        {"$ref": "#/$defs/StringVal"},
                        {"type": "null"},
                    ]
                },
            },
            "$defs": {
                "StringVal": {"type": "string", "maxLength": 100},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$defs" not in result
        assert result["properties"]["value"]["anyOf"][0] == {"type": "string", "maxLength": 100}
        assert result["properties"]["value"]["anyOf"][1] == {"type": "null"}

    def test_ref_inside_allof(self, client):
        schema = {
            "type": "object",
            "properties": {
                "item": {"allOf": [{"$ref": "#/$defs/Base"}, {"type": "object", "properties": {"extra": {"type": "string"}}}]},
            },
            "$defs": {
                "Base": {"type": "object", "properties": {"name": {"type": "string"}}},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert result["properties"]["item"]["allOf"][0] == {"type": "object", "properties": {"name": {"type": "string"}}}

    def test_no_defs_is_noop(self, client):
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert result == schema

    def test_definitions_key(self, client):
        schema = {
            "type": "object",
            "properties": {
                "role": {"$ref": "#/definitions/Role"},
            },
            "definitions": {
                "Role": {"type": "string", "enum": ["admin", "user"]},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "definitions" not in result
        assert result["properties"]["role"] == {"type": "string", "enum": ["admin", "user"]}

    def test_unresolvable_ref_logged(self, client):
        schema = {
            "type": "object",
            "properties": {
                "thing": {"$ref": "#/properties/other/nested"},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$ref" in result["properties"]["thing"]

    def test_ref_in_array_items(self, client):
        schema = {
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/Tag"},
                },
            },
            "$defs": {
                "Tag": {"type": "string", "enum": ["urgent", "low"]},
            },
        }
        result = client._resolve_json_schema_refs(schema)
        assert "$defs" not in result
        assert result["properties"]["tags"]["items"] == {"type": "string", "enum": ["urgent", "low"]}


class TestCleanSchemaStripsUnresolvedRefs:
    def test_ref_stripped_by_cleaner(self, client):
        schema = {
            "type": "object",
            "properties": {
                "thing": {"$ref": "#/properties/other/nested", "type": "string"},
            },
        }
        client._clean_google_ai_schema_properties(schema)
        assert "$ref" not in schema["properties"]["thing"]
        assert schema["properties"]["thing"]["type"] == "string"

    def test_full_pipeline_resolves_then_cleans(self, client):
        schema = {
            "type": "object",
            "properties": {
                "status": {"$ref": "#/$defs/Status"},
                "weird": {"$ref": "#/properties/foo/bar", "type": "string"},
            },
            "$defs": {
                "Status": {"type": "string", "enum": ["a", "b"], "default": "a"},
            },
        }
        resolved = client._resolve_json_schema_refs(schema)
        client._clean_google_ai_schema_properties(resolved)
        assert "$defs" not in resolved
        assert "$ref" not in resolved["properties"]["weird"]
        assert resolved["properties"]["status"]["enum"] == ["a", "b"]
        assert "default" not in resolved["properties"]["status"]
