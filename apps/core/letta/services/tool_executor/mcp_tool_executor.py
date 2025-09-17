from typing import Any, Dict, Optional

from letta.constants import MCP_TOOL_TAG_NAME_PREFIX
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.mcp_manager import MCPManager
from letta.services.tool_executor.tool_executor_base import ToolExecutor


class ExternalMCPToolExecutor(ToolExecutor):
    """Executor for external MCP tools."""

    @trace_method
    async def execute(
        self,
        function_name: str,
        function_args: dict,
        tool: Tool,
        actor: User,
        agent_state: Optional[AgentState] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ) -> ToolExecutionResult:
        pass

        mcp_server_tag = [tag for tag in tool.tags if tag.startswith(f"{MCP_TOOL_TAG_NAME_PREFIX}:")]
        if not mcp_server_tag:
            raise ValueError(f"Tool {tool.name} does not have a valid MCP server tag")
        mcp_server_name = mcp_server_tag[0].split(":")[1]

        mcp_manager = MCPManager()
        # TODO: may need to have better client connection management

        environment_variables = {}
        agent_id = None
        if agent_state:
            environment_variables = agent_state.get_agent_env_vars_as_dict()
            agent_id = agent_state.id

        function_response, success = await mcp_manager.execute_mcp_server_tool(
            mcp_server_name=mcp_server_name,
            tool_name=function_name,
            tool_args=function_args,
            environment_variables=environment_variables,
            actor=actor,
            agent_id=agent_id,
        )

        return ToolExecutionResult(
            status="success" if success else "error",
            func_return=function_response,
        )
