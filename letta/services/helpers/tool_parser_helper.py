import ast
import base64
import pickle
from typing import Any

from letta.schemas.agent import AgentState
from letta.types import JsonValue


def parse_stdout_best_effort(text: str | bytes) -> tuple[Any, AgentState | None]:
    """
    Decode and unpickle the result from the function execution if possible.
    Returns (function_return_value, agent_state).
    """
    if not text:
        return None, None
    if isinstance(text, str):
        text = base64.b64decode(text)
    result = pickle.loads(text)
    agent_state = result["agent_state"]
    return result["results"], agent_state


def parse_function_arguments(source_code: str, tool_name: str):
    """Get arguments of a function from its source code"""
    tree = ast.parse(source_code)
    args = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == tool_name:
            for arg in node.args.args:
                args.append(arg.arg)
    return args


def convert_param_to_str_value(param_type: str, raw_value: JsonValue) -> str:
    """
    Convert parameter to Python code representation based on JSON schema type.
    TODO (cliandy): increase sanitization checks here to fail at the right place
    """

    valid_types = {"string", "integer", "boolean", "number", "array", "object"}
    if param_type not in valid_types:
        raise TypeError(f"Unsupported type: {param_type}, raw_value={raw_value}")
    if param_type == "string":
        # Safely handle python string
        return repr(raw_value)
    if param_type == "integer":
        return str(int(raw_value))
    if param_type == "boolean":
        if isinstance(raw_value, bool):
            return str(raw_value)
        if isinstance(raw_value, int) and raw_value in (0, 1):
            return str(bool(raw_value))
        if isinstance(raw_value, str) and raw_value.strip().lower() in ("true", "false"):
            return raw_value.strip().lower().capitalize()
        raise ValueError(f"Invalid boolean value: {raw_value}")
    if param_type == "array":
        pass  # need more testing here
        # if isinstance(raw_value, str):
        #     if raw_value.strip()[0] != "[" or raw_value.strip()[-1] != "]":
        #         raise ValueError(f'Invalid array value: "{raw_value}"')
        #     return raw_value.strip()
    return str(raw_value)
