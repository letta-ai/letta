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
from letta.services.helpers.tool_parser_helper import parse_function_arguments, parse_stdout_best_effort
from letta.services.tool_manager import ToolManager
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
        organization_id: Optional[str] = None,
        project_id: str = "default",
    ):
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)
        self.force_recreate = force_recreate
        # Get organization_id from user if not explicitly provided
        self.organization_id = organization_id if organization_id is not None else user.organization_id
        self.project_id = project_id

        # TODO: check to make sure modal app `App(tool.id)` exists

    async def _wait_for_modal_function_deployment(self, timeout: int = 60):
        """Wait for Modal app deployment to complete by retrying function lookup."""
        import asyncio
        import time

        import modal

        from letta.helpers.tool_helpers import generate_modal_function_name

        # Use the same naming logic as deployment
        function_name = generate_modal_function_name(self.tool.name, self.organization_id, self.project_id)

        start_time = time.time()
        retry_delay = 2  # seconds

        while time.time() - start_time < timeout:
            try:
                f = modal.Function.from_name(function_name, MODAL_DEFAULT_TOOL_NAME)
                logger.info(f"Modal function found successfully for app {function_name}, function {f}")
                return f
            except Exception as e:
                elapsed = time.time() - start_time
                if elapsed >= timeout:
                    raise TimeoutError(
                        f"Modal app {function_name} deployment timed out after {timeout} seconds. "
                        f"Expected app name: {function_name}, function: {MODAL_DEFAULT_TOOL_NAME}"
                    ) from e
                logger.info(f"Modal app {function_name} not ready yet (elapsed: {elapsed:.1f}s), waiting {retry_delay}s...")
                await asyncio.sleep(retry_delay)

        raise TimeoutError(f"Modal app {function_name} deployment timed out after {timeout} seconds")

    @trace_method
    async def run(
        self,
        agent_id: Optional[str] = None,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        await self._init_async()

        try:
            log_event("modal_execution_started", {"tool": self.tool_name, "modal_app_id": self.tool.id})
            logger.info(f"Waiting for Modal function deployment for app {self.tool.id}")
            func = await self._wait_for_modal_function_deployment()
            logger.info(f"Modal function found successfully for app {self.tool.id}, function {str(func)}")
            logger.info(f"Calling with arguments {self.args}")

            # TODO: use another mechanism to pass through the key
            if additional_env_vars is None:
                letta_api_key = None
            else:
                letta_api_key = additional_env_vars.get("LETTA_API_KEY", None)

            # Construct dynamic env vars
            # Priority order (later overrides earlier):
            # 1. Sandbox-level env vars (from database)
            # 2. Agent-specific env vars
            # 3. Additional runtime env vars
            env_vars = {}

            # Load sandbox-level environment variables from the database
            # These can be updated after deployment and will be available at runtime
            if self.provided_sandbox_env_vars:
                env_vars.update(self.provided_sandbox_env_vars)
            else:
                try:
                    from letta.services.sandbox_config_manager import SandboxConfigManager

                    sandbox_config_manager = SandboxConfigManager()
                    sandbox_config = await sandbox_config_manager.get_or_create_default_sandbox_config_async(
                        sandbox_type=SandboxType.MODAL, actor=self.user
                    )
                    if sandbox_config:
                        sandbox_env_vars = await sandbox_config_manager.get_sandbox_env_vars_as_dict_async(
                            sandbox_config_id=sandbox_config.id, actor=self.user, limit=None
                        )
                        env_vars.update(sandbox_env_vars)
                except Exception as e:
                    logger.warning(f"Could not load sandbox env vars for tool {self.tool_name}: {e}")

            # Add agent-specific environment variables (these override sandbox-level)
            if agent_state and agent_state.secrets:
                for secret in agent_state.secrets:
                    env_vars[secret.key] = secret.value

            # Add any additional env vars passed at runtime (highest priority)
            if additional_env_vars:
                env_vars.update(additional_env_vars)

            # Call the modal function (already retrieved at line 101)
            # Convert agent_state to dict to avoid cloudpickle serialization issues
            agent_state_dict = agent_state.model_dump() if agent_state else None

            logger.info(f"Calling function {func} with arguments {self.args}")
            result = await func.remote.aio(
                tool_name=self.tool_name,
                agent_state=agent_state_dict,
                agent_id=agent_id,
                env_vars=env_vars,
                letta_api_key=letta_api_key,
                **self.args,
            )
            logger.info(f"Modal function result: {result}")

            # Reconstruct agent_state if it was returned (use original as fallback)
            result_agent_state = agent_state
            if result.get("agent_state"):
                if isinstance(result["agent_state"], dict):
                    try:
                        from letta.schemas.agent import AgentState

                        result_agent_state = AgentState.model_validate(result["agent_state"])
                    except Exception as e:
                        logger.warning(f"Failed to reconstruct AgentState: {e}, using original")
                else:
                    result_agent_state = result["agent_state"]

            return ToolExecutionResult(
                func_return=result["result"],
                agent_state=result_agent_state,
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
            logger.error(f"Modal execution failed for tool {self.tool_name} {self.tool.id}: {e}")
            return ToolExecutionResult(
                func_return=None,
                agent_state=agent_state,
                stdout=[""],
                stderr=[str(e)],
                status="error",
            )
