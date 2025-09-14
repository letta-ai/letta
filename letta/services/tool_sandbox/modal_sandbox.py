"""
Model sandbox implementation, which configures on Modal App per tool.
"""

from typing import TYPE_CHECKING, Any, Dict, Optional

import modal
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b_code_interpreter import AsyncSandbox

from letta.constants import MODAL_DEFAULT_TOOL_NAME
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import SandboxType
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.helpers.tool_parser_helper import parse_stdout_best_effort
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.types import JsonDict
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)

if TYPE_CHECKING:
    from e2b_code_interpreter import Execution


class AsyncToolSandboxModal(AsyncToolSandboxBase):
    METADATA_CONFIG_STATE_KEY = "config_state"

    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        force_recreate: bool = True,
        tool_object: Optional[Tool] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)
        self.force_recreate = force_recreate

        # TODO: check to make sure modal app `App(tool.id)` exists

    @trace_method
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        import modal

        try:
            log_event("modal_execution_started", {"tool": self.tool_name, "modal_app_id": self.tool.id})
            f = modal.Function.from_name(self.tool.id, MODAL_DEFAULT_TOOL_NAME)
            result = f.remote(
                tool_name=self.tool_name, agent_id=agent_state.id if agent_state else None, env_vars=additional_env_vars, **self.args
            )

            return ToolExecutionResult(
                func_return=result["result"],
                agent_state=agent_state,
                stdout=[result["stdout"]],
                stderr=[result["stderr"]],
                status="error" if result["error"] else "success",
            )
        except Exception as e:
            log_event(
                "modal_execution_failed",
                {
                    "tool": self.tool_name,
                    "modal_app_id": self.tool.id,
                    "error": str(e),
                },
            )
            return ToolExecutionResult(
                func_return=None,
                agent_state=agent_state,
                stdout=[],
                stderr=[str(e)],
                status="error",
            )
