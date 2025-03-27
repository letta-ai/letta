from typing import Any, Dict, Optional, Tuple, Type

from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxRunResult
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor import (
    ExternalComposioToolExecutor,
    ExternalMCPToolExecutor,
    LettaCoreToolExecutor,
    LettaMemoryToolExecutor,
    LettaMultiAgentToolExecutor,
    SandboxToolExecutor,
    ToolExecutor,
)
from letta.tracing import trace_method
from letta.utils import get_friendly_error_msg


class ToolExecutorFactory:
    """Factory for creating appropriate tool executors based on tool type."""

    _executor_map: Dict[ToolType, Type[ToolExecutor]] = {
        ToolType.LETTA_CORE: LettaCoreToolExecutor,
        ToolType.LETTA_MULTI_AGENT_CORE: LettaMultiAgentToolExecutor,
        ToolType.LETTA_MEMORY_CORE: LettaMemoryToolExecutor,
        ToolType.EXTERNAL_COMPOSIO: ExternalComposioToolExecutor,
        ToolType.EXTERNAL_MCP: ExternalMCPToolExecutor,
    }

    @classmethod
    def get_executor(cls, tool_type: ToolType) -> ToolExecutor:
        """Get the appropriate executor for the given tool type."""
        executor_class = cls._executor_map.get(tool_type)

        if executor_class:
            return executor_class()

        # Default to sandbox executor for unknown types
        return SandboxToolExecutor()


class ToolExecutionManager:
    """Manager class for tool execution operations."""

    def __init__(self, agent_state: AgentState, actor: User):
        self.agent_state = agent_state
        self.logger = get_logger(__name__)
        self.actor = actor

    def execute_tool(self, function_name: str, function_args: dict, tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        """
        Execute a tool and persist any state changes.

        Args:
            function_name: Name of the function to execute
            function_args: Arguments to pass to the function
            tool: Tool object containing metadata about the tool

        Returns:
            Tuple containing the function response and sandbox run result (if applicable)
        """
        try:
            # Get the appropriate executor for this tool type
            executor = ToolExecutorFactory.get_executor(tool.tool_type)

            # Execute the tool
            return executor.execute(function_name, function_args, self.agent_state, tool, self.actor)

        except Exception as e:
            self.logger.error(f"Error executing tool {function_name}: {str(e)}")
            error_message = get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))
            return error_message, SandboxRunResult(status="error")

    @trace_method
    async def execute_tool_async(self, function_name: str, function_args: dict, tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        """
        Execute a tool asynchronously and persist any state changes.
        """
        try:
            # Get the appropriate executor for this tool type
            # TODO: Extend this async model to composio

            if tool.tool_type == ToolType.CUSTOM:
                executor = SandboxToolExecutor()
                result_tuple = await executor.execute(function_name, function_args, self.agent_state, tool, self.actor)
            else:
                executor = ToolExecutorFactory.get_executor(tool.tool_type)
                result_tuple = executor.execute(function_name, function_args, self.agent_state, tool, self.actor)
            return result_tuple

        except Exception as e:
            self.logger.error(f"Error executing tool {function_name}: {str(e)}")
            error_message = get_friendly_error_msg(
                function_name=function_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )
            return error_message, SandboxRunResult(status="error")
