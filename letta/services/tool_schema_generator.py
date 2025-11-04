"""Schema generation utilities for tool creation and updates."""

from typing import Optional

from letta.functions.ast_parsers import get_function_name_and_docstring
from letta.functions.functions import derive_openai_json_schema
from letta.functions.helpers import generate_model_from_args_json_schema
from letta.functions.schema_generator import generate_schema_from_args_schema_v2
from letta.log import get_logger
from letta.schemas.enums import ToolSourceType, ToolType
from letta.schemas.tool import Tool as PydanticTool

logger = get_logger(__name__)


def generate_schema_for_tool_creation(
    tool: PydanticTool,
) -> Optional[dict]:
    """
    Generate JSON schema for tool creation based on the provided parameters.

    Args:
        tool: The tool being created

    Returns:
        Generated JSON schema or None if not applicable
    """
    # Only generate schema for custom tools
    if tool.tool_type != ToolType.CUSTOM:
        return None

    # If json_schema is already provided, use it
    if tool.json_schema:
        return tool.json_schema

    # Must have source code for custom tools
    if not tool.source_code:
        logger.error("Custom tool is missing source_code field")
        raise ValueError("Custom tool is missing source_code field.")

    source_code_size_kb = len(tool.source_code) / 1024
    logger.info(f"Generating schema for tool '{tool.name}': source code {source_code_size_kb:.2f} KB")

    # TypeScript tools
    if tool.source_type == ToolSourceType.typescript:
        try:
            from letta.functions.typescript_parser import derive_typescript_json_schema

            schema = derive_typescript_json_schema(source_code=tool.source_code)
            import json

            schema_size_kb = len(json.dumps(schema)) / 1024
            logger.info(f"Generated TypeScript schema for '{tool.name}': {schema_size_kb:.2f} KB")
            return schema
        except Exception as e:
            logger.warning(f"Failed to derive TypeScript json schema: {e}")
            raise ValueError(f"Failed to derive TypeScript json schema: {e}")

    # Python tools (default if not specified for backwards compatibility)
    elif tool.source_type == ToolSourceType.python or tool.source_type is None:
        # If args_json_schema is provided, use it to generate full schema
        if tool.args_json_schema:
            name, description = get_function_name_and_docstring(tool.source_code, tool.name)
            args_schema = generate_model_from_args_json_schema(tool.args_json_schema)
            schema = generate_schema_from_args_schema_v2(
                args_schema=args_schema,
                name=name,
                description=description,
                append_heartbeat=False,
            )
            import json

            schema_size_kb = len(json.dumps(schema)) / 1024
            logger.info(f"Generated Python schema from args_json for '{tool.name}': {schema_size_kb:.2f} KB")
            return schema
        # Otherwise, attempt to parse from docstring with best effort
        else:
            try:
                schema = derive_openai_json_schema(source_code=tool.source_code)
                import json

                schema_size_kb = len(json.dumps(schema)) / 1024
                logger.info(f"Generated Python schema from docstring for '{tool.name}': {schema_size_kb:.2f} KB")
                return schema
            except Exception as e:
                logger.warning(f"Failed to derive json schema: {e}")
                raise ValueError(f"Failed to derive json schema: {e}")
    else:
        # TODO: convert to explicit error
        raise ValueError(f"Unknown tool source type: {tool.source_type}")


def generate_schema_for_tool_update(
    current_tool: PydanticTool,
    json_schema: Optional[dict] = None,
    args_json_schema: Optional[dict] = None,
    source_code: Optional[str] = None,
    source_type: Optional[ToolSourceType] = None,
) -> Optional[dict]:
    """
    Generate JSON schema for tool update based on the provided parameters.

    Args:
        current_tool: The current tool being updated
        json_schema: Directly provided JSON schema (takes precedence)
        args_json_schema: Schema for just the arguments
        source_code: Updated source code (only used if explicitly updating source)
        source_type: Source type for the tool

    Returns:
        Updated JSON schema or None if no update needed
    """
    # Only handle custom tools
    if current_tool.tool_type != ToolType.CUSTOM:
        return None

    # If json_schema is directly provided, use it
    if json_schema is not None:
        # If args_json_schema is also provided, that's an error
        if args_json_schema is not None:
            raise ValueError("Cannot provide both json_schema and args_json_schema in update")
        return json_schema

    # If args_json_schema is provided, generate full schema from it
    if args_json_schema is not None:
        # Use updated source_code if provided, otherwise use current
        code_to_parse = source_code if source_code is not None else current_tool.source_code
        if not code_to_parse:
            raise ValueError("Source code required when updating with args_json_schema")

        name, description = get_function_name_and_docstring(code_to_parse, current_tool.name)
        args_schema = generate_model_from_args_json_schema(args_json_schema)
        return generate_schema_from_args_schema_v2(
            args_schema=args_schema,
            name=name,
            description=description,
            append_heartbeat=False,
        )

    # Otherwise, no schema updates (don't parse docstring)
    return None
