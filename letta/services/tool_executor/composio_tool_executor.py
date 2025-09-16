from typing import Any, Dict, Optional

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY
from letta.functions.composio_helpers import execute_composio_action_async, generate_composio_action_from_func_name
from letta.helpers.composio_helpers import get_composio_api_key_async
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor_base import ToolExecutor


class ExternalComposioToolExecutor(ToolExecutor):
    """Executor for external Composio tools."""

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
        if agent_state is None:
            return ToolExecutionResult(
                status="error",
                func_return="Agent state is required for external Composio tools. Please contact Letta support if you see this error.",
            )
        action_name = generate_composio_action_from_func_name(tool.name)

        # Get entity ID from the agent_state
        entity_id = self._get_entity_id(agent_state)

        # Get composio_api_key
        composio_api_key = await get_composio_api_key_async(actor=actor)

        # TODO (matt): Roll in execute_composio_action into this class
        function_response = await execute_composio_action_async(
            action_name=action_name, args=function_args, api_key=composio_api_key, entity_id=entity_id
        )

        return ToolExecutionResult(
            status="success",
            func_return=function_response,
        )

    def _get_entity_id(self, agent_state: AgentState) -> Optional[str]:
        """Extract the entity ID from environment variables."""
        for env_var in agent_state.secrets:
            if env_var.key == COMPOSIO_ENTITY_ENV_VAR_KEY:
                return env_var.value
        return None
