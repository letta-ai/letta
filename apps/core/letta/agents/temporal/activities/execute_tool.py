import json
from typing import Any

from temporalio import activity

from letta.agents.temporal.activities.llm_request import ApplicationError
from letta.agents.temporal.types import ExecuteToolParams, ExecuteToolResult
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.run_manager import RunManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager


@activity.defn(name="execute_tool")
async def execute_tool(params: ExecuteToolParams) -> ExecuteToolResult:
    """
    Execute the tool using ToolExecutionManager.
    Returns the execution result and timing information.
    """
    message_manager = MessageManager()
    agent_manager = AgentManager()
    block_manager = BlockManager()
    run_manager = RunManager()
    passage_manager = PassageManager()

    target_tool = next((x for x in params.agent_state.tools if x.name == params.tool_name), None)

    if not target_tool:
        return ExecuteToolResult(
            tool_execution_result=ToolExecutionResult(
                func_return=f"Tool {params.tool_name} not found",
                status="error",
            ),
            execution_time_ns=0,
        )

    start_time = get_utc_timestamp_ns()

    sandbox_env_vars = {var.key: var.value for var in params.agent_state.secrets}
    tool_execution_manager = ToolExecutionManager(
        agent_state=params.agent_state,
        message_manager=message_manager,
        agent_manager=agent_manager,
        block_manager=block_manager,
        run_manager=run_manager,
        passage_manager=passage_manager,
        sandbox_env_vars=sandbox_env_vars,
        actor=params.actor,
    )

    tool_execution_result = await tool_execution_manager.execute_tool_async(
        function_name=params.tool_name,
        function_args=params.tool_args,
        tool=target_tool,
        step_id=params.step_id,
    )

    end_time = get_utc_timestamp_ns()

    # Exceptions are not JSON serializable, make sure to deserialize post activity execution
    if isinstance(tool_execution_result.func_return, Exception):
        tool_execution_result.func_return = _serialize_func_return(tool_execution_result.func_return)

    return ExecuteToolResult(
        tool_execution_result=tool_execution_result,
        execution_time_ns=end_time - start_time,  # TODO: actually record this or use native Temporal metrics?
    )


def _serialize_func_return(e: Exception) -> str:
    """Serialize exception to be JSON serializable string"""
    result = {
        "type": type(e).__name__,
        "module": type(e).__module__,
        "args": list(e.args) if e.args else [],
        "message": str(e),
    }

    # Preserve custom attributes if present
    if hasattr(e, "__dict__"):
        custom_attrs = {k: v for k, v in e.__dict__.items() if isinstance(v, (str, int, float, bool, list, dict, type(None)))}
        if custom_attrs:
            result["custom_attrs"] = custom_attrs

    return result


def deserialize_func_return(data: dict) -> Exception:
    """Deserialize back to Exception class"""
    exception_map = {
        "ValueError": ValueError,
        "KeyError": KeyError,
        "TypeError": TypeError,
        "RuntimeError": RuntimeError,
        "ApplicationError": ApplicationError,
    }

    exc_class = exception_map.get(data["type"], Exception)

    # Create exception with original args
    if data.get("args"):
        exc = exc_class(*data["args"])
    else:
        exc = exc_class(data.get("message", ""))

    # Restore custom attributes if any
    if data.get("custom_attrs"):
        for key, value in data["custom_attrs"].items():
            setattr(exc, key, value)

    return exc


def is_serialized_exception(data: Any) -> bool:
    """Check if data is a serialized exception"""
    # Should have been serialized to a string
    if not isinstance(data, str):
        return False

    try:
        # Soft check if data has exception structure
        parsed = json.loads(data)
        return isinstance(parsed, dict) and "type" in parsed and "message" in parsed
    except Exception:
        return False
