from collections import OrderedDict
from typing import Any, Dict, Optional

from letta.constants import PRE_EXECUTION_MESSAGE_ARG
from letta.schemas.tool import MCP_TOOL_METADATA_SCHEMA_STATUS, MCP_TOOL_METADATA_SCHEMA_WARNINGS
from letta.utils import get_logger

logger = get_logger(__name__)


def enable_strict_mode(tool_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Enables strict mode for a tool schema by setting 'strict' to True and
    disallowing additional properties in the parameters.

    If the tool schema is NON_STRICT_ONLY, strict mode will not be applied.

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.

    Returns:
        Dict[str, Any]: A new tool schema with strict mode conditionally enabled.
    """
    schema = tool_schema.copy()

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

    # Enable strict mode for STRICT_COMPLIANT or unspecified health status
    schema["strict"] = True

    # Ensure parameters is a valid dictionary
    parameters = schema.get("parameters", {})
    if isinstance(parameters, dict) and parameters.get("type") == "object":
        # Set additionalProperties to False
        parameters["additionalProperties"] = False
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
