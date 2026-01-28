import copy
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from letta.constants import PRE_EXECUTION_MESSAGE_ARG
from letta.schemas.tool import MCP_TOOL_METADATA_SCHEMA_STATUS, MCP_TOOL_METADATA_SCHEMA_WARNINGS
from letta.utils import get_logger

logger = get_logger(__name__)


def _make_field_nullable(field_props: Dict[str, Any]) -> None:
    """Make a field schema nullable by adding 'null' to its type.

    This modifies field_props in place.

    Args:
        field_props: The field schema to make nullable
    """
    if "type" in field_props:
        field_type = field_props["type"]
        if isinstance(field_type, list):
            # Already an array of types - add null if not present
            if "null" not in field_type:
                field_type.append("null")
        elif field_type != "null":
            # Single type - convert to array with null
            field_props["type"] = [field_type, "null"]
    elif "anyOf" in field_props:
        # Check if null is already one of the options
        has_null = any(opt.get("type") == "null" for opt in field_props["anyOf"])
        if not has_null:
            field_props["anyOf"].append({"type": "null"})
    elif "$ref" in field_props:
        # For $ref schemas, wrap in anyOf with null option
        ref_value = field_props.pop("$ref")
        field_props["anyOf"] = [{"$ref": ref_value}, {"type": "null"}]
    else:
        # No type specified, add null type
        field_props["type"] = "null"


def _process_property_for_strict_mode(prop: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively process a property for strict mode.

    Handles nested objects, arrays, and anyOf structures by setting
    additionalProperties: False and adding all properties to required.

    Args:
        prop: The property schema to process

    Returns:
        The processed property schema
    """
    # Handle anyOf structures
    if "anyOf" in prop:
        prop["anyOf"] = [_process_property_for_strict_mode(opt) for opt in prop["anyOf"]]
        return prop

    if "type" not in prop:
        return prop

    param_type = prop["type"]

    # Handle type arrays (e.g., ["string", "null"])
    if isinstance(param_type, list):
        return prop

    if param_type == "object":
        if "properties" in prop:
            properties = prop["properties"]
            # Recursively process nested properties
            for key, value in properties.items():
                properties[key] = _process_property_for_strict_mode(value)
            # Set additionalProperties to False and require all properties
            prop["additionalProperties"] = False
            prop["required"] = list(properties.keys())
        return prop

    elif param_type == "array":
        if "items" in prop:
            prop["items"] = _process_property_for_strict_mode(prop["items"])
        return prop

    # Simple types - return as-is
    return prop


def enable_strict_mode(tool_schema: Dict[str, Any], strict: bool = True) -> Dict[str, Any]:
    """Enables strict mode for a tool schema by setting 'strict' to True and
    disallowing additional properties in the parameters.

    If the tool schema is NON_STRICT_ONLY, strict mode will not be applied.
    If strict=False, the function will only clean metadata without applying strict mode.

    When strict mode is enabled:
    - All properties are added to the 'required' array (OpenAI requirement)
    - Optional properties are made nullable (type includes 'null') to preserve optionality
    - additionalProperties is set to False
    - Nested objects and arrays are recursively processed

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.
        strict (bool): Whether to enable strict mode. Defaults to True.

    Returns:
        Dict[str, Any]: A new tool schema with strict mode conditionally enabled.
    """
    # Deep copy to avoid mutating the original schema
    schema = copy.deepcopy(tool_schema)

    # Check if schema has status metadata indicating NON_STRICT_ONLY
    schema_status = schema.get(MCP_TOOL_METADATA_SCHEMA_STATUS)
    if schema_status == "NON_STRICT_ONLY":
        # Don't apply strict mode for non-strict schemas
        # Remove the metadata fields from the schema
        schema.pop(MCP_TOOL_METADATA_SCHEMA_STATUS, None)
        schema.pop(MCP_TOOL_METADATA_SCHEMA_WARNINGS, None)
        return schema
    elif schema_status == "INVALID":
        # We should not be hitting this and allowing invalid schemas to be used
        logger.error(f"Tool schema {schema} is invalid: {schema.get(MCP_TOOL_METADATA_SCHEMA_WARNINGS)}")

    # If strict mode is disabled, just clean metadata and return
    if not strict:
        schema.pop(MCP_TOOL_METADATA_SCHEMA_STATUS, None)
        schema.pop(MCP_TOOL_METADATA_SCHEMA_WARNINGS, None)
        return schema

    # Enable strict mode for STRICT_COMPLIANT or unspecified health status
    schema["strict"] = True

    # Ensure parameters is a valid dictionary
    parameters = schema.get("parameters", {})
    if isinstance(parameters, dict) and parameters.get("type") == "object":
        # Set additionalProperties to False (required for OpenAI strict mode)
        parameters["additionalProperties"] = False

        # Get properties and current required list
        properties = parameters.get("properties", {})
        current_required = set(parameters.get("required", []))

        # Process each property recursively and handle required/nullable
        for field_name, field_props in properties.items():
            # Recursively process nested structures
            properties[field_name] = _process_property_for_strict_mode(field_props)

            # OpenAI strict mode requires ALL properties to be in the required array
            # For optional properties, we add them to required but make them nullable
            if field_name not in current_required:
                # Make the field nullable to preserve optionality
                _make_field_nullable(properties[field_name])

        # Set all properties as required
        parameters["required"] = list(properties.keys())
        schema["parameters"] = parameters

    # Remove the metadata fields from the schema
    schema.pop(MCP_TOOL_METADATA_SCHEMA_STATUS, None)
    schema.pop(MCP_TOOL_METADATA_SCHEMA_WARNINGS, None)

    return schema


def add_pre_execution_message(tool_schema: Dict[str, Any], description: Optional[str] = None) -> Dict[str, Any]:
    """Adds a `pre_execution_message` parameter to a tool schema to prompt a natural, human-like message before executing the tool.

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.
        description (Optional[str]): Description of the tool schema. Defaults to None.

    Returns:
        Dict[str, Any]: A new tool schema with the `pre_execution_message` field added at the beginning.
    """
    schema = tool_schema.copy()
    parameters = schema.get("parameters", {})

    if not isinstance(parameters, dict) or parameters.get("type") != "object":
        return schema  # Do not modify if schema is not valid

    properties = parameters.get("properties", {})
    required = parameters.get("required", [])

    # Define the new `pre_execution_message` field
    if not description:
        # Default description
        description = (
            "A concise message to be uttered before executing this tool. "
            "This should sound natural, as if a person is casually announcing their next action."
            "You MUST also include punctuation at the end of this message."
        )
    pre_execution_message_field = {
        "type": "string",
        "description": description,
    }

    # Ensure the pre-execution message is the first field in properties
    updated_properties = OrderedDict()
    updated_properties[PRE_EXECUTION_MESSAGE_ARG] = pre_execution_message_field
    updated_properties.update(properties)  # Retain all existing properties

    # Ensure pre-execution message is the first required field
    if PRE_EXECUTION_MESSAGE_ARG not in required:
        required = [PRE_EXECUTION_MESSAGE_ARG] + required

    # Update the schema with ordered properties and required list
    schema["parameters"] = {
        **parameters,
        "properties": dict(updated_properties),  # Convert OrderedDict back to dict
        "required": required,
    }

    return schema


def remove_request_heartbeat(tool_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Removes the `request_heartbeat` parameter from a tool schema if it exists.

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.

    Returns:
        Dict[str, Any]: A new tool schema without `request_heartbeat`.
    """
    schema = tool_schema.copy()
    parameters = schema.get("parameters", {})

    if isinstance(parameters, dict):
        properties = parameters.get("properties", {})
        required = parameters.get("required", [])

        # Remove the `request_heartbeat` property if it exists
        if "request_heartbeat" in properties:
            properties.pop("request_heartbeat")

        # Remove `request_heartbeat` from required fields if present
        if "request_heartbeat" in required:
            required = [r for r in required if r != "request_heartbeat"]

        # Update parameters with modified properties and required list
        schema["parameters"] = {**parameters, "properties": properties, "required": required}

    return schema
