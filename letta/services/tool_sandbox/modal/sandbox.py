"""
Main interface for Modal V3 sandbox.
Simplified implementation that separates deployment from execution.
"""

from typing import Any, Optional

from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import SandboxType
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.services.tool_sandbox.modal.deployer import ModalDeployer
from letta.services.tool_sandbox.modal.executor import FunctionExecutor
from letta.settings import tool_settings
from letta.types import JsonDict

logger = get_logger(__name__)


class AsyncToolSandboxModal(AsyncToolSandboxBase):
    """
    Simplified Modal sandbox implementation.
    Key features:
    - Deploy functions once, execute many times
    - Clean separation of deployment and execution
    """

    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        tool_object: Tool | None = None,
        sandbox_config: SandboxConfig | None = None,
        sandbox_env_vars: dict[str, Any] | None = None,
        use_persistent_server: bool = True,
    ):
        """
        Initialize the Modal V3 sandbox.
        Args:
            tool_name: Name of the tool to execute
            args: Arguments to pass to the tool
            user: User/actor for permissions
            tool_object: Tool object (optional)
            sandbox_config: Sandbox configuration (optional)
            sandbox_env_vars: Environment variables (optional)
            use_persistent_server: Whether to use persistent function server
        """
        super().__init__(
            tool_name,
            args,
            user,
            tool_object,
            sandbox_config=sandbox_config,
            sandbox_env_vars=sandbox_env_vars,
        )

        # Validate Modal credentials
        if not tool_settings.modal_token_id or not tool_settings.modal_token_secret:
            raise ValueError("MODAL_TOKEN_ID and MODAL_TOKEN_SECRET must be set")

        # Configuration options
        self.use_persistent_server = use_persistent_server

        # Initialize components
        self.deployer = ModalDeployer(self.tool)
        self._app = None
        self._version_hash = None
        self._executor = None

    @trace_method
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[dict] = None,
    ) -> ToolExecutionResult:
        """
        Execute the tool in Modal sandbox.
        This method:
        1. Gets or creates sandbox configuration
        2. Deploys the Modal app if needed (cached by Modal)
        3. Executes the function with provided arguments
        4. Returns the execution result
        Args:
            agent_state: Optional agent state
            additional_env_vars: Additional environment variables
        Returns:
            Tool execution result
        """
        # Get sandbox configuration
        if self.provided_sandbox_config:
            sbx_config = self.provided_sandbox_config
        else:
            sbx_config = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.MODAL, actor=self.user
            )

        # Gather environment variables
        env_vars = await self._gather_env_vars(agent_state, additional_env_vars or {}, sbx_config.id, is_local=False)

        try:
            # Log execution start
            log_event(
                "modal_execution_started",
                {
                    "tool": self.tool_name,
                    "use_persistent_server": self.use_persistent_server,
                    "env_vars": list(env_vars),
                },
            )

            # Get or deploy Modal app
            await self._ensure_app_deployed(sbx_config)

            # Create executor if needed
            if not self._executor:
                self._executor = FunctionExecutor(
                    app=self._app,
                    tool_name=self.tool_name,
                    use_persistent_server=self.use_persistent_server,
                )

            # Get execution timeout from config
            modal_config = sbx_config.get_modal_config()
            timeout = modal_config.timeout if modal_config else 60

            # Execute the function
            result = await self._executor.execute(
                args=self.args,
                agent_state=agent_state,
                environment_vars=env_vars,
                inject_agent_state=self.inject_agent_state,
                timeout=timeout + 10,  # Add buffer to Modal's timeout
            )

            # Add sandbox fingerprint to result
            result.sandbox_config_fingerprint = sbx_config.fingerprint()

            # Log execution result
            if result.status == "success":
                log_event(
                    "modal_execution_succeeded",
                    {
                        "tool": self.tool_name,
                        "version": self._version_hash,
                        "func_return": str(result.func_return)[:500],
                    },
                )
            else:
                log_event(
                    "modal_execution_failed",
                    {
                        "tool": self.tool_name,
                        "version": self._version_hash,
                        "error": result.func_return,
                    },
                )

            return result

        except Exception as e:
            logger.error(f"Modal execution failed for tool {self.tool_name}: {e}")

            log_event(
                "modal_execution_error",
                {
                    "tool": self.tool_name,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )

            # Create error result
            from letta.utils import get_friendly_error_msg

            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=None,
                stdout=[],
                stderr=[str(e)],
                status="error",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

    async def _ensure_app_deployed(self, sbx_config: SandboxConfig) -> None:
        """
        Ensure the Modal app is deployed.
        This method uses the deployer to get or create the Modal app.
        Modal's app lookup provides caching, so this is efficient.
        Args:
            sbx_config: Sandbox configuration
        """
        if not self._app:
            logger.info(f"Getting or deploying Modal app for tool {self.tool_name}")

            self._app, self._version_hash = await self.deployer.get_or_deploy_app(
                sbx_config=sbx_config, use_persistent_server=self.use_persistent_server
            )

            logger.info(f"Modal app ready: {self.deployer.get_app_name(self._version_hash)}")
