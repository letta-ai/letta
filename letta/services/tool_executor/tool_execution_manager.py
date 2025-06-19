import traceback
from typing import Any, Dict, Optional, Type

from letta.constants import FUNCTION_RETURN_VALUE_TRUNCATED
from letta.helpers.datetime_helpers import AsyncTimer
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.tool_executor.builtin_tool_executor import LettaBuiltinToolExecutor
from letta.services.tool_executor.composio_tool_executor import ExternalComposioToolExecutor
from letta.services.tool_executor.core_tool_executor import LettaCoreToolExecutor
from letta.services.tool_executor.files_tool_executor import LettaFileToolExecutor
from letta.services.tool_executor.mcp_tool_executor import ExternalMCPToolExecutor
from letta.services.tool_executor.multi_agent_tool_executor import LettaMultiAgentToolExecutor
from letta.services.tool_executor.tool_executor import SandboxToolExecutor
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.utils import get_friendly_error_msg


class ToolExecutorFactory:
    """Factory for creating appropriate tool executors based on tool type."""

    _executor_map: Dict[ToolType, Type[ToolExecutor]] = {
        ToolType.LETTA_CORE: LettaCoreToolExecutor,
        ToolType.LETTA_MEMORY_CORE: LettaCoreToolExecutor,
        ToolType.LETTA_SLEEPTIME_CORE: LettaCoreToolExecutor,
        ToolType.LETTA_MULTI_AGENT_CORE: LettaMultiAgentToolExecutor,
        ToolType.LETTA_BUILTIN: LettaBuiltinToolExecutor,
        ToolType.LETTA_FILES_CORE: LettaFileToolExecutor,
        ToolType.EXTERNAL_COMPOSIO: ExternalComposioToolExecutor,
        ToolType.EXTERNAL_MCP: ExternalMCPToolExecutor,
    }

    @classmethod
    def get_executor(
        cls,
        tool_type: ToolType,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        job_manager: JobManager,
        passage_manager: PassageManager,
        actor: User,
    ) -> ToolExecutor:
        """Get the appropriate executor for the given tool type."""
        executor_class = cls._executor_map.get(tool_type, SandboxToolExecutor)
        return executor_class(
            message_manager=message_manager,
            agent_manager=agent_manager,
            block_manager=block_manager,
            job_manager=job_manager,
            passage_manager=passage_manager,
            actor=actor,
        )


class ToolExecutionManager:
    """Manager class for tool execution operations."""

    def __init__(
        self,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        job_manager: JobManager,
        passage_manager: PassageManager,
        actor: User,
        agent_state: Optional[AgentState] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ):
        self.message_manager = message_manager
        self.agent_manager = agent_manager
        self.block_manager = block_manager
        self.job_manager = job_manager
        self.passage_manager = passage_manager
        self.agent_state = agent_state
        self.logger = get_logger(__name__)
        self.actor = actor
        self.sandbox_config = sandbox_config
        self.sandbox_env_vars = sandbox_env_vars

    @trace_method
    async def execute_tool_async(
        self, function_name: str, function_args: dict, tool: Tool, step_id: str | None = None
    ) -> ToolExecutionResult:
        """
        Execute a tool asynchronously and persist any state changes.
        """
        status = "error"  # set as default for tracking purposes
        try:
            executor = ToolExecutorFactory.get_executor(
                tool.tool_type,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                block_manager=self.block_manager,
                job_manager=self.job_manager,
                passage_manager=self.passage_manager,
                actor=self.actor,
            )

            def _metrics_callback(exec_time_ms: int, exc):
                return MetricRegistry().tool_execution_time_ms_histogram.record(
                    exec_time_ms, dict(get_ctx_attributes(), **{"tool.name": tool.name})
                )

            async with AsyncTimer(callback_func=_metrics_callback):
                result = await executor.execute(
                    function_name, function_args, tool, self.actor, self.agent_state, self.sandbox_config, self.sandbox_env_vars
                )
            status = result.status

            # trim result
            return_str = str(result.func_return)
            if len(return_str) > tool.return_char_limit:
                # TODO: okay that this become a string?
                result.func_return = FUNCTION_RETURN_VALUE_TRUNCATED(return_str, len(return_str), tool.return_char_limit)
            return result

        except Exception as e:
            status = "error"
            self.logger.error(f"Error executing tool {function_name}: {str(e)}")
            error_message = get_friendly_error_msg(
                function_name=function_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )
            return ToolExecutionResult(
                status="error",
                func_return=error_message,
                stderr=[traceback.format_exc()],
            )
        finally:
            metric_attrs = {"tool.name": tool.name, "tool.execution_success": status == "success"}
            if status == "error" and step_id:
                metric_attrs["step.id"] = step_id
            MetricRegistry().tool_execution_counter.add(1, dict(get_ctx_attributes(), **metric_attrs))
