"""
JSON Schema validator for OpenAI strict mode compliance.

This module provides validation for JSON schemas to ensure they comply with
OpenAI's strict mode requirements for tool schemas.
"""

from enum import Enum
from typing import Any, Dict, List, Tuple


class SchemaHealth(Enum):
    """Schema health status for OpenAI strict mode compliance."""

    STRICT_COMPLIANT = "STRICT_COMPLIANT"  # Passes OpenAI strict mode
    NON_STRICT_ONLY = "NON_STRICT_ONLY"  # Valid JSON Schema but too loose for strict mode
    INVALID = "INVALID"  # Broken for both


def validate_complete_json_schema(schema: Dict[str, Any]) -> Tuple[SchemaHealth, List[str]]:
    """
    Validate schema for OpenAI tool strict mode compliance.

    This validator checks for:
    - Valid JSON Schema structure
    - OpenAI strict mode requirements
    - Special cases like required properties with empty object schemas

    Args:
        schema: The JSON schema to validate

    Returns:
        A tuple of (SchemaHealth, list_of_reasons)
    """

    reasons: List[str] = []
    status = SchemaHealth.STRICT_COMPLIANT

    def mark_non_strict(reason: str):
        """Mark schema as non-strict only (valid but not strict-compliant)."""
        nonlocal status
        if status == SchemaHealth.STRICT_COMPLIANT:
            status = SchemaHealth.NON_STRICT_ONLY
        reasons.append(reason)

    def mark_invalid(reason: str):
        """Mark schema as invalid."""
        nonlocal status
        status = SchemaHealth.INVALID
        reasons.append(reason)

    def schema_allows_empty_object(obj_schema: Dict[str, Any]) -> bool:
        """
        Return True if this object schema allows {}, meaning no required props
        and no additionalProperties content.
        """
        if obj_schema.get("type") != "object":
            return False
        props = obj_schema.get("properties", {})
        required = obj_schema.get("required", [])
        additional = obj_schema.get("additionalProperties", True)

        # Empty object: no required props and additionalProperties is false
        if not required and additional is False:
            return True
        return False

    def schema_allows_empty_array(arr_schema: Dict[str, Any]) -> bool:
        """
        Return True if this array schema allows empty arrays with no constraints.
        """
        if arr_schema.get("type") != "array":
            return False

        # If minItems is set and > 0, it doesn't allow empty
        min_items = arr_schema.get("minItems", 0)
        if min_items > 0:
            return False

        # If items schema is not defined or very permissive, it allows empty
        items = arr_schema.get("items")
        if items is None:
            return True

        return False

    def recurse(node: Dict[str, Any], path: str, is_root: bool = False):
        """Recursively validate a schema node."""
        node_type = node.get("type")

        # Handle schemas without explicit type but with type-specific keywords
        if not node_type:
            # Check for type-specific keywords
            if "properties" in node or "additionalProperties" in node:
                node_type = "object"
            elif "items" in node:
                node_type = "array"
            elif any(kw in node for kw in ["anyOf", "oneOf", "allOf"]):
                # Union types don't require explicit type
                pass
            else:
                mark_invalid(f"{path}: Missing 'type'")
                return

        # OBJECT
        if node_type == "object":
            props = node.get("properties")
            if props is not None and not isinstance(props, dict):
                mark_invalid(f"{path}: 'properties' must be a dict for objects")
                return

            if "additionalProperties" not in node:
                mark_non_strict(f"{path}: 'additionalProperties' not explicitly set")
            elif node["additionalProperties"] is not False:
                mark_non_strict(f"{path}: 'additionalProperties' is not false (free-form object)")

            required = node.get("required")
            if required is None:
                # TODO: @jnjpng skip this check for now, seems like OpenAI strict mode doesn't enforce this
                # Only mark as non-strict for nested objects, not root
                # if not is_root:
                #     mark_non_strict(f"{path}: 'required' not specified for object")
                required = []
            elif not isinstance(required, list):
                mark_invalid(f"{path}: 'required' must be a list if present")
                required = []

            # OpenAI strict-mode extra checks:
            # NOTE: We no longer flag properties not in required array as non-strict
            # because we can heal these schemas by adding null to the type union
            # This allows MCP tools with optional fields to be used with strict mode
            # The healing happens in generate_tool_schema_for_mcp() when strict=True

            for req_key in required:
                if props and req_key not in props:
                    mark_invalid(f"{path}: required contains '{req_key}' not found in properties")
                elif props:
                    req_schema = props[req_key]
                    if isinstance(req_schema, dict):
                        # Check for empty object issue
                        if schema_allows_empty_object(req_schema):
                            mark_invalid(f"{path}: required property '{req_key}' allows empty object (OpenAI will reject)")
                        # Check for empty array issue
                        if schema_allows_empty_array(req_schema):
                            mark_invalid(f"{path}: required property '{req_key}' allows empty array (OpenAI will reject)")

            # Recurse into properties
            if props:
                for prop_name, prop_schema in props.items():
                    if isinstance(prop_schema, dict):
                        recurse(prop_schema, f"{path}.properties.{prop_name}", is_root=False)
                    else:
                        mark_invalid(f"{path}.properties.{prop_name}: Not a valid schema dict")

        # ARRAY
        elif node_type == "array":
            items = node.get("items")
            if items is None:
                mark_invalid(f"{path}: 'items' must be defined for arrays in strict mode")
            elif not isinstance(items, dict):
                mark_invalid(f"{path}: 'items' must be a schema dict for arrays")
            else:
                recurse(items, f"{path}.items", is_root=False)

        # PRIMITIVE TYPES
        elif node_type in ["string", "number", "integer", "boolean", "null"]:
            # These are generally fine, but check for specific constraints
            pass

        # TYPE ARRAYS (e.g., ["string", "null"] for optional fields)
        elif isinstance(node_type, list):
            # Type arrays are allowed in OpenAI strict mode
            # They represent union types (e.g., string | null)
            for t in node_type:
                # TODO: @jnjpng handle enum types?
                if t not in ["string", "number", "integer", "boolean", "null", "array", "object"]:
                    mark_invalid(f"{path}: Invalid type '{t}' in type array")

        # UNION TYPES
        for kw in ("anyOf", "oneOf", "allOf"):
            if kw in node:
                if not isinstance(node[kw], list):
                    mark_invalid(f"{path}: '{kw}' must be a list")
                else:
                    for idx, sub_schema in enumerate(node[kw]):
                        if isinstance(sub_schema, dict):
                            recurse(sub_schema, f"{path}.{kw}[{idx}]", is_root=False)
                        else:
                            mark_invalid(f"{path}.{kw}[{idx}]: Not a valid schema dict")

    # Start validation
    if not isinstance(schema, dict):
        return SchemaHealth.INVALID, ["Top-level schema must be a dict"]

    # OpenAI tools require top-level type to be object
    if schema.get("type") != "object":
        mark_invalid("Top-level schema 'type' must be 'object' for OpenAI tools")

    # Begin recursive validation
    recurse(schema, "root", is_root=True)

    return status, reasons
