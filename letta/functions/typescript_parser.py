"""TypeScript function parsing for JSON schema generation."""

import re
from typing import Any, Dict, Optional

from letta.errors import LettaToolCreateError


def derive_typescript_json_schema(source_code: str, name: Optional[str] = None) -> dict:
    """Derives the OpenAI JSON schema for a given TypeScript function source code.

    This parser extracts the function signature, parameters, and types from TypeScript
    code and generates a JSON schema compatible with OpenAI's function calling format.

    Args:
        source_code: TypeScript source code containing an exported function
        name: Optional function name override

    Returns:
        JSON schema dict with name, description, and parameters

    Raises:
        LettaToolCreateError: If parsing fails or no exported function is found
    """
    try:
        # Find the exported function
        function_pattern = r"export\s+function\s+(\w+)\s*\((.*?)\)\s*:\s*([\w<>\[\]|]+)?"
        match = re.search(function_pattern, source_code, re.DOTALL)

        if not match:
            # Try async function
            async_pattern = r"export\s+async\s+function\s+(\w+)\s*\((.*?)\)\s*:\s*([\w<>\[\]|]+)?"
            match = re.search(async_pattern, source_code, re.DOTALL)

        if not match:
            raise LettaToolCreateError("No exported function found in TypeScript source code")

        func_name = match.group(1)
        params_str = match.group(2).strip()
        # return_type = match.group(3) if match.group(3) else 'any'

        # Use provided name or extracted name
        schema_name = name or func_name

        # Extract JSDoc comment for description
        description = extract_jsdoc_description(source_code, func_name)
        if not description:
            description = f"TypeScript function {func_name}"

        # Parse parameters
        parameters = parse_typescript_parameters(params_str)

        # Build OpenAI-compatible JSON schema
        schema = {
            "name": schema_name,
            "description": description,
            "parameters": {"type": "object", "properties": parameters["properties"], "required": parameters["required"]},
        }

        return schema

    except Exception as e:
        raise LettaToolCreateError(f"TypeScript schema generation failed: {str(e)}") from e


def extract_jsdoc_description(source_code: str, func_name: str) -> Optional[str]:
    """Extract JSDoc description for a function."""
    # Look for JSDoc comment before the function
    jsdoc_pattern = r"/\*\*(.*?)\*/\s*export\s+(?:async\s+)?function\s+" + re.escape(func_name)
    match = re.search(jsdoc_pattern, source_code, re.DOTALL)

    if match:
        jsdoc_content = match.group(1)
        # Extract the main description (text before @param tags)
        lines = jsdoc_content.split("\n")
        description_lines = []

        for line in lines:
            line = line.strip().lstrip("*").strip()
            if line and not line.startswith("@"):
                description_lines.append(line)
            elif line.startswith("@"):
                break

        if description_lines:
            return " ".join(description_lines)

    return None


def parse_typescript_parameters(params_str: str) -> Dict[str, Any]:
    """Parse TypeScript function parameters and generate JSON schema properties."""
    properties = {}
    required = []

    if not params_str:
        return {"properties": properties, "required": required}

    # Split parameters by comma (handling nested types)
    params = split_parameters(params_str)

    for param in params:
        param = param.strip()
        if not param:
            continue

        # Parse parameter name, optional flag, and type
        param_match = re.match(r"(\w+)(\?)?\s*:\s*(.+)", param)
        if param_match:
            param_name = param_match.group(1)
            is_optional = param_match.group(2) == "?"
            param_type = param_match.group(3).strip()

            # Convert TypeScript type to JSON schema type
            json_type = typescript_to_json_schema_type(param_type)

            properties[param_name] = json_type

            # Add to required list if not optional
            if not is_optional:
                required.append(param_name)

    return {"properties": properties, "required": required}


def split_parameters(params_str: str) -> list:
    """Split parameter string by commas, handling nested types."""
    params = []
    current_param = ""
    depth = 0

    for char in params_str:
        if char in "<[{(":
            depth += 1
        elif char in ">]})":
            depth -= 1
        elif char == "," and depth == 0:
            params.append(current_param)
            current_param = ""
            continue

        current_param += char

    if current_param:
        params.append(current_param)

    return params


def typescript_to_json_schema_type(ts_type: str) -> Dict[str, Any]:
    """Convert TypeScript type to JSON schema type definition."""
    ts_type = ts_type.strip()

    # Basic type mappings
    type_map = {
        "string": {"type": "string"},
        "number": {"type": "number"},
        "boolean": {"type": "boolean"},
        "any": {"type": "string"},  # Default to string for any
        "void": {"type": "null"},
        "null": {"type": "null"},
        "undefined": {"type": "null"},
    }

    # Check for basic types
    if ts_type in type_map:
        return type_map[ts_type]

    # Handle arrays
    if ts_type.endswith("[]"):
        item_type = ts_type[:-2].strip()
        return {"type": "array", "items": typescript_to_json_schema_type(item_type)}

    # Handle Array<T> syntax
    array_match = re.match(r"Array<(.+)>", ts_type)
    if array_match:
        item_type = array_match.group(1)
        return {"type": "array", "items": typescript_to_json_schema_type(item_type)}

    # Handle union types (simplified - just use string)
    if "|" in ts_type:
        # For union types, we'll default to string for simplicity
        # A more sophisticated parser could handle this better
        return {"type": "string"}

    # Handle object types (simplified)
    if ts_type.startswith("{") and ts_type.endswith("}"):
        return {"type": "object"}

    # Handle Record<K, V> and similar generic types
    record_match = re.match(r"Record<(.+),\s*(.+)>", ts_type)
    if record_match:
        return {"type": "object", "additionalProperties": typescript_to_json_schema_type(record_match.group(2))}

    # Default case - treat unknown types as objects
    return {"type": "object"}
