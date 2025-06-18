import traceback
from typing import Any, Dict, Optional

from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.services.tool_sandbox.e2b_sandbox import AsyncToolSandboxE2B
from letta.services.tool_sandbox.local_sandbox import AsyncToolSandboxLocal
from letta.settings import tool_settings
from letta.types import JsonDict
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class SandboxToolExecutor(ToolExecutor):
    """Executor for sandboxed tools."""

    @trace_method
    async def execute(
        self,
        function_name: str,
        function_args: JsonDict,
        tool: Tool,
        actor: User,
        agent_state: Optional[AgentState] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ) -> ToolExecutionResult:

        # Store original memory state
        orig_memory_str = agent_state.memory.compile() if agent_state else None

        try:
            # Prepare function arguments
            function_args = self._prepare_function_args(function_args, tool, function_name)

            agent_state_copy = self._create_agent_state_copy(agent_state) if agent_state else None

            # Execute in sandbox depending on API key
            if tool_settings.e2b_api_key:
                sandbox = AsyncToolSandboxE2B(
                    function_name, function_args, actor, tool_object=tool, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars
                )
            else:
                sandbox = AsyncToolSandboxLocal(
                    function_name, function_args, actor, tool_object=tool, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars
                )

            tool_execution_result = await sandbox.run(agent_state=agent_state_copy)

            # Verify memory integrity
            if agent_state:
                assert orig_memory_str == agent_state.memory.compile(), "Memory should not be modified in a sandbox tool"

            # Update agent memory if needed
            if tool_execution_result.agent_state is not None:
                await AgentManager().update_memory_if_changed_async(agent_state.id, tool_execution_result.agent_state.memory, actor)

            return tool_execution_result

        except Exception as e:
            return self._handle_execution_error(e, function_name, traceback.format_exc())

    @staticmethod
    def _prepare_function_args(function_args: JsonDict, tool: Tool, function_name: str) -> dict:
        """Prepare function arguments with proper type coercion."""
        try:
            # Parse the source code to extract function annotations
            annotations = get_function_annotations_from_source(tool.source_code, function_name)
            # Coerce the function arguments to the correct types based on the annotations
            return coerce_dict_args_by_annotations(function_args, annotations)
        except ValueError:
            # Just log the error and continue with original args
            # This is defensive programming - we try to coerce but fall back if it fails
            return function_args

    @staticmethod
    def _create_agent_state_copy(agent_state: AgentState):
        """Create a copy of agent state for sandbox execution."""
        agent_state_copy = agent_state.__deepcopy__()
        # Remove tools from copy to prevent nested tool execution
        agent_state_copy.tools = []
        agent_state_copy.tool_rules = []
        return agent_state_copy

    @staticmethod
    def _handle_execution_error(
        exception: Exception,
        function_name: str,
        stderr: str,
    ) -> ToolExecutionResult:
        """Handle tool execution errors."""
        error_message = get_friendly_error_msg(
            function_name=function_name, exception_name=type(exception).__name__, exception_message=str(exception)
        )
        return ToolExecutionResult(
            status="error",
            func_return=error_message,
            stderr=[stderr],
        )
