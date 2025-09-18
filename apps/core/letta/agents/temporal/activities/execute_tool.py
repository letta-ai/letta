from temporalio import activity

from letta.agents.temporal.types import ExecuteToolParams, ExecuteToolResult
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
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
    job_manager = JobManager()
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
        job_manager=job_manager,
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

    return ExecuteToolResult(
        tool_execution_result=tool_execution_result,
        execution_time_ns=end_time - start_time,  # TODO: actually record this or use native Temporal metrics?
    )
