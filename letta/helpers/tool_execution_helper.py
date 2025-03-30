from collections import OrderedDict
from typing import Any, Dict, Optional

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY, PRE_EXECUTION_MESSAGE_ARG
from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source
from letta.functions.helpers import execute_composio_action, generate_composio_action_from_func_name
from letta.helpers.composio_helpers import get_composio_api_key
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxRunResult
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.services.tool_executor.tool_execution_sandbox import ToolExecutionSandbox
from letta.utils import get_friendly_error_msg


def enable_strict_mode(tool_schema: Dict[str, Any]) -> Dict[str, Any]:
    """Enables strict mode for a tool schema by setting 'strict' to True and
    disallowing additional properties in the parameters.

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.

    Returns:
        Dict[str, Any]: A new tool schema with strict mode enabled.
    """
    schema = tool_schema.copy()

    # Enable strict mode
    schema["strict"] = True

    # Ensure parameters is a valid dictionary
    parameters = schema.get("parameters", {})

    if isinstance(parameters, dict) and parameters.get("type") == "object":
        # Set additionalProperties to False
        parameters["additionalProperties"] = False
        schema["parameters"] = parameters
    return schema


def add_pre_execution_message(tool_schema: Dict[str, Any], description: Optional[str] = None) -> Dict[str, Any]:
    """Adds a `pre_execution_message` parameter to a tool schema to prompt a natural, human-like message before executing the tool.

    Args:
        tool_schema (Dict[str, Any]): The original tool schema.

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


# TODO: Deprecate the `execute_external_tool` function on the agent body
def execute_external_tool(
    agent_state: AgentState,
    function_name: str,
    function_args: dict,
    target_letta_tool: Tool,
    actor: User,
    allow_agent_state_modifications: bool = False,
) -> tuple[Any, Optional[SandboxRunResult]]:
    # TODO: need to have an AgentState object that actually has full access to the block data
    # this is because the sandbox tools need to be able to access block.value to edit this data
    try:
        if target_letta_tool.tool_type == ToolType.EXTERNAL_COMPOSIO:
            action_name = generate_composio_action_from_func_name(target_letta_tool.name)
            # Get entity ID from the agent_state
            entity_id = None
            for env_var in agent_state.tool_exec_environment_variables:
                if env_var.key == COMPOSIO_ENTITY_ENV_VAR_KEY:
                    entity_id = env_var.value
            # Get composio_api_key
            composio_api_key = get_composio_api_key(actor=actor)
            function_response = execute_composio_action(
                action_name=action_name, args=function_args, api_key=composio_api_key, entity_id=entity_id
            )
            return function_response, None
        elif target_letta_tool.tool_type == ToolType.CUSTOM:
            # Parse the source code to extract function annotations
            annotations = get_function_annotations_from_source(target_letta_tool.source_code, function_name)
            # Coerce the function arguments to the correct types based on the annotations
            function_args = coerce_dict_args_by_annotations(function_args, annotations)

            # execute tool in a sandbox
            # TODO: allow agent_state to specify which sandbox to execute tools in
            # TODO: This is only temporary, can remove after we publish a pip package with this object
            if allow_agent_state_modifications:
                agent_state_copy = agent_state.__deepcopy__()
                agent_state_copy.tools = []
                agent_state_copy.tool_rules = []
            else:
                agent_state_copy = None

            sandbox_run_result = ToolExecutionSandbox(function_name, function_args, actor).run(agent_state=agent_state_copy)
            function_response, updated_agent_state = sandbox_run_result.func_return, sandbox_run_result.agent_state
            # TODO: Bring this back
            # if allow_agent_state_modifications and updated_agent_state is not None:
            #     self.update_memory_if_changed(updated_agent_state.memory)
            return function_response, sandbox_run_result
    except Exception as e:
        # Need to catch error here, or else trunction wont happen
        # TODO: modify to function execution error
        function_response = get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))
        return function_response, None
