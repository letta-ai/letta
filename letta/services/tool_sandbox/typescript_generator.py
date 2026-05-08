"""TypeScript execution script generator for sandbox execution."""

import json
import re
from typing import Any, Dict, Optional

from letta.types import JsonDict, JsonValue


def convert_param_to_ts_value(param_type: Optional[str], raw_value: JsonValue) -> str:
    """
    Convert parameter to TypeScript code representation based on JSON schema type.

    Args:
        param_type: The JSON schema type (string, number, integer, boolean, array, object)
        raw_value: The raw value to convert

    Returns:
        A string representation of the value in TypeScript syntax
    """
    # Handle null values first - return TypeScript null (not Python's "None")
    if raw_value is None:
        return "null"

    if param_type == "string":
        # Use JSON.stringify for proper string escaping
        return json.dumps(raw_value)
    if param_type in ("number", "integer"):
        return str(raw_value)
    if param_type == "boolean":
        if isinstance(raw_value, bool):
            return "true" if raw_value else "false"
        if isinstance(raw_value, int) and raw_value in (0, 1):
            return "true" if raw_value else "false"
        if isinstance(raw_value, str) and raw_value.strip().lower() in ("true", "false"):
            return raw_value.strip().lower()
        raise ValueError(f"Invalid boolean value: {raw_value}")
    if param_type in ("array", "object"):
        return json.dumps(raw_value)
    # Default: use JSON serialization
    return json.dumps(raw_value)


def extract_typescript_function_name(source_code: str) -> Optional[str]:
    """
    Extract the exported function name from TypeScript source code.

    Args:
        source_code: TypeScript source code

    Returns:
        The function name if found, None otherwise
    """
    # Match both regular and async exported functions
    patterns = [
        r"export\s+function\s+(\w+)",
        r"export\s+async\s+function\s+(\w+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, source_code)
        if match:
            return match.group(1)

    return None


def is_async_typescript_function(source_code: str, function_name: str) -> bool:
    """
    Detect if a TypeScript function is async.

    Args:
        source_code: TypeScript source code
        function_name: The function name to check

    Returns:
        True if the function is async, False otherwise
    """
    # Match async function declaration: export async function foo
    pattern1 = rf"export\s+async\s+function\s+{re.escape(function_name)}"
    if re.search(pattern1, source_code):
        return True

    # Match async arrow function: export const foo = async
    pattern2 = rf"export\s+const\s+{re.escape(function_name)}\s*=\s*async"
    if re.search(pattern2, source_code):
        return True

    return False


def generate_typescript_execution_script(
    tool_name: str,
    tool_source_code: str,
    args: JsonDict,
    json_schema: Dict[str, Any],
    env_vars_to_inject: Optional[Dict[str, str]] = None,
) -> str:
    """
    Generate a TypeScript execution script for running a tool in E2B sandbox.

    The generated script:
    1. Imports and initializes the Letta client (available as `client` variable)
    2. Initializes arguments as TypeScript constants
    3. Includes the user's tool source code
    4. Calls the function and serializes the result as JSON

    Note: TypeScript tools do NOT support agent_state injection (legacy Python feature).
    The agent_id is available via process.env.LETTA_AGENT_ID environment variable.

    Args:
        tool_name: Name of the tool function
        tool_source_code: The TypeScript source code of the tool
        args: Arguments to pass to the function
        json_schema: JSON schema describing the function parameters
        env_vars_to_inject: Optional environment variables to inject

    Returns:
        Generated TypeScript code ready for execution
    """
    lines: list[str] = []

    # Extract user's import statements - they must be at the top of the file for ESM
    import_pattern = r"^import\s+.+?['\"];?\s*$"
    user_imports = re.findall(import_pattern, tool_source_code, re.MULTILINE)
    source_without_imports = re.sub(import_pattern, "", tool_source_code, flags=re.MULTILINE)

    # Add user imports at the very top (ESM requires imports at top of file)
    if user_imports:
        for imp in user_imports:
            lines.append(imp.strip())
        lines.append("")

    # Import and initialize Letta client (similar to Python's letta_client injection)
    # The client is available as `client` variable in the tool's scope
    # Use dynamic import with try/catch to gracefully handle missing package
    lines.extend(
        [
            "// Initialize Letta client for TypeScript tool execution",
            "let client: any = null;",
            "try {",
            "    const { LettaClient } = await import('@letta-ai/letta-client');",
            "    const apiKey = process.env.LETTA_API_KEY;",
            "    if (apiKey) {",
            "        client = new LettaClient({ apiKey });",
            "    }",
            "} catch (e) {",
            "    // Package not available - client remains null",
            "}",
            "",
        ]
    )

    # Initialize arguments
    # Handle null json_schema (can happen if ToolUpdate sets source_type without schema)
    if json_schema is None:
        json_schema = {}
    properties = json_schema.get("parameters", {}).get("properties", {})
    for param_name, param_value in args.items():
        param_spec = properties.get(param_name, {})
        param_type = param_spec.get("type")
        ts_value = convert_param_to_ts_value(param_type, param_value)
        lines.append(f"const {param_name} = {ts_value};")

    if args:
        lines.append("")

    # Add the user's source code (imports already extracted), stripping 'export' keywords
    stripped_source = re.sub(r"\bexport\s+", "", source_without_imports)
    lines.append(stripped_source.strip())
    lines.append("")

    # Detect if function is async
    is_async = is_async_typescript_function(tool_source_code, tool_name)

    # Generate function call with arguments in correct order
    # Use the order from json_schema (required + optional) to ensure positional args are correct
    parameters = json_schema.get("parameters", {})
    required_params = parameters.get("required", [])
    schema_properties = parameters.get("properties", {})

    # Build ordered param list: required params first (in order), then any remaining args
    ordered_params = []
    for param in required_params:
        if param in args:
            ordered_params.append(param)
    # Add any remaining params that weren't in required (optional params)
    for param in schema_properties.keys():
        if param in args and param not in ordered_params:
            ordered_params.append(param)
    # Fallback: add any args not in schema (shouldn't happen, but be safe)
    for param in args.keys():
        if param not in ordered_params:
            ordered_params.append(param)

    params_str = ", ".join(ordered_params)
    func_call = f"{tool_name}({params_str})"

    # Execute the function and output result as JSON
    # E2B supports top-level await for TypeScript
    if is_async:
        lines.append(f"const _result = await {func_call};")
    else:
        lines.append(f"const _result = {func_call};")

    # Serialize the result - we use JSON for TypeScript (not pickle like Python)
    # The output format matches what the Python sandbox expects
    # Note: agent_state is always null for TypeScript tools (not supported)
    lines.append("const _output = { results: _result, agent_state: null };")
    lines.append("JSON.stringify(_output);")

    return "\n".join(lines) + "\n"


def parse_typescript_result(result_text: str) -> tuple[Any, None]:
    """
    Parse the result from TypeScript tool execution.

    TypeScript tools return JSON-serialized results instead of pickle.

    Args:
        result_text: The JSON string output from the TypeScript execution

    Returns:
        Tuple of (function_return_value, agent_state)
        Note: agent_state is always None for TypeScript tools
    """
    if not result_text:
        return None, None

    try:
        result = json.loads(result_text)
        return result.get("results"), result.get("agent_state")
    except json.JSONDecodeError:
        # If JSON parsing fails, return the raw text
        return result_text, None
