"""
Standalone executor function for Modal V3.
This module contains the actual execution logic that runs inside Modal containers
for standalone (non-persistent) deployments.
"""

from typing import Any


def execute_tool_standalone(
    args_pickled: bytes,
    agent_state_pickled: bytes | None,
    environment_vars: dict[str, str],
    tool_source: str,
    tool_name: str,
    is_async: bool,
    inject_agent_state: bool,
    args_schema_code: str | None = None,
) -> dict[str, Any]:
    """
    Execute a tool function in standalone mode.
    This function runs inside the Modal container and executes the tool
    with the provided arguments.
    Args:
        args_pickled: Pickled function arguments
        agent_state_pickled: Optional pickled agent state
        environment_vars: Environment variables to set
        tool_source: The source code of the tool function (no longer used)
        tool_name: Name of the function to execute (no longer used)
        is_async: Whether the function is async (no longer used)
        inject_agent_state: Whether to inject agent state into function (no longer used)
        args_schema_code: Optional schema code to execute first (no longer used)
    Returns:
        Execution result dictionary
    """
    # Import the pre-generated tool executor module
    # This file is baked into the Modal image during deployment
    # Note: /app is the standard Modal container path for application code
    import sys

    sys.path.insert(0, "/app")
    from tool_executor import execute_tool

    # Call the pre-generated executor function
    return execute_tool(
        args_pickled=args_pickled,
        agent_state_pickled=agent_state_pickled,
        environment_vars=environment_vars,
    )
