from typing import TYPE_CHECKING, Any, Dict, Optional

from e2b.sandbox.commands.command_handle import CommandExitException
from e2b_code_interpreter import AsyncSandbox

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


class AsyncToolSandboxE2B(AsyncToolSandboxBase):
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

    @trace_method
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        if self.provided_sandbox_config:
            sbx_config = self.provided_sandbox_config
        else:
            sbx_config = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.E2B, actor=self.user
            )
        # TODO: So this defaults to force recreating always
        # TODO: Eventually, provision one sandbox PER agent, and that agent re-uses that one specifically
        e2b_sandbox = await self.create_e2b_sandbox_with_metadata_hash(sandbox_config=sbx_config)

        logger.info(f"E2B Sandbox configurations: {sbx_config}")
        logger.info(f"E2B Sandbox ID: {e2b_sandbox.sandbox_id}")

        # TODO: This only makes sense if we re-use sandboxes
        # # Since this sandbox was used, we extend its lifecycle by the timeout
        # await sbx.set_timeout(sbx_config.get_e2b_config().timeout)

        # Get environment variables for the sandbox
        envs = await self._gather_env_vars(agent_state, additional_env_vars, sbx_config.id, is_local=False)
        code = await self.generate_execution_script(agent_state=agent_state)

        try:
            log_event(
                "e2b_execution_started",
                {"tool": self.tool_name, "sandbox_id": e2b_sandbox.sandbox_id, "code": code, "env_vars": envs},
            )
            execution = await e2b_sandbox.run_code(code, envs=envs)

            if execution.results:
                func_return, agent_state = parse_stdout_best_effort(execution.results[0].text)
                log_event(
                    "e2b_execution_succeeded",
                    {
                        "tool": self.tool_name,
                        "sandbox_id": e2b_sandbox.sandbox_id,
                        "func_return": func_return,
                    },
                )
            elif execution.error:
                # Tool errors are expected behavior - tools can raise exceptions as part of their normal operation
                # Only log at debug level to avoid triggering Sentry alerts for expected errors
                logger.debug(f"Tool {self.tool_name} raised a {execution.error.name}: {execution.error.value}")
                logger.debug(f"Traceback from e2b sandbox: \n{execution.error.traceback}")
                func_return = get_friendly_error_msg(
                    function_name=self.tool_name, exception_name=execution.error.name, exception_message=execution.error.value
                )
                execution.logs.stderr.append(execution.error.traceback)
                log_event(
                    "e2b_execution_failed",
                    {
                        "tool": self.tool_name,
                        "sandbox_id": e2b_sandbox.sandbox_id,
                        "error_type": execution.error.name,
                        "error_message": execution.error.value,
                        "func_return": func_return,
                    },
                )
            else:
                log_event(
                    "e2b_execution_empty",
                    {
                        "tool": self.tool_name,
                        "sandbox_id": e2b_sandbox.sandbox_id,
                        "status": "no_results_no_error",
                    },
                )
                raise ValueError(f"Tool {self.tool_name} returned execution with None")

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=agent_state,
                stdout=execution.logs.stdout,
                stderr=execution.logs.stderr,
                status="error" if execution.error else "success",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )
        finally:
            await e2b_sandbox.kill()

    @staticmethod
    def parse_exception_from_e2b_execution(e2b_execution: "Execution") -> Exception:
        builtins_dict = __builtins__ if isinstance(__builtins__, dict) else vars(__builtins__)
        # Dynamically fetch the exception class from builtins, defaulting to Exception if not found
        exception_class = builtins_dict.get(e2b_execution.error.name, Exception)
        return exception_class(e2b_execution.error.value)

    @trace_method
    async def create_e2b_sandbox_with_metadata_hash(self, sandbox_config: SandboxConfig) -> "AsyncSandbox":
        state_hash = sandbox_config.fingerprint()
        e2b_config = sandbox_config.get_e2b_config()

        log_event(
            "e2b_sandbox_create_started",
            {
                "sandbox_fingerprint": state_hash,
                "e2b_config": e2b_config.model_dump(),
            },
        )

        if e2b_config.template:
            sbx = await AsyncSandbox.create(sandbox_config.get_e2b_config().template, metadata={self.METADATA_CONFIG_STATE_KEY: state_hash})
        else:
            sbx = await AsyncSandbox.create(
                metadata={self.METADATA_CONFIG_STATE_KEY: state_hash}, **e2b_config.model_dump(exclude={"pip_requirements"})
            )

        log_event(
            "e2b_sandbox_create_finished",
            {
                "sandbox_id": sbx.sandbox_id,
                "sandbox_fingerprint": state_hash,
            },
        )

        if e2b_config.pip_requirements:
            for package in e2b_config.pip_requirements:
                log_event(
                    "e2b_pip_install_started",
                    {
                        "sandbox_id": sbx.sandbox_id,
                        "package": package,
                    },
                )
                try:
                    await sbx.commands.run(f"pip install {package}")
                    log_event(
                        "e2b_pip_install_finished",
                        {
                            "sandbox_id": sbx.sandbox_id,
                            "package": package,
                        },
                    )
                except CommandExitException as e:
                    error_msg = f"Failed to install sandbox pip requirement '{package}' in E2B sandbox. This may be due to package version incompatibility with the E2B environment. Error: {e}"
                    logger.error(error_msg)
                    log_event(
                        "e2b_pip_install_failed",
                        {
                            "sandbox_id": sbx.sandbox_id,
                            "package": package,
                            "error": str(e),
                        },
                    )
                    raise RuntimeError(error_msg) from e

        # Install tool-specific pip requirements
        if self.tool and self.tool.pip_requirements:
            for pip_requirement in self.tool.pip_requirements:
                package_str = str(pip_requirement)
                log_event(
                    "tool_pip_install_started",
                    {
                        "sandbox_id": sbx.sandbox_id,
                        "package": package_str,
                        "tool_name": self.tool.name,
                    },
                )
                try:
                    await sbx.commands.run(f"pip install {package_str}")
                    log_event(
                        "tool_pip_install_finished",
                        {
                            "sandbox_id": sbx.sandbox_id,
                            "package": package_str,
                            "tool_name": self.tool.name,
                        },
                    )
                except CommandExitException as e:
                    error_msg = f"Failed to install tool pip requirement '{package_str}' for tool '{self.tool.name}' in E2B sandbox. This may be due to package version incompatibility with the E2B environment. Consider updating the package version or removing the version constraint. Error: {e}"
                    logger.error(error_msg)
                    log_event(
                        "tool_pip_install_failed",
                        {
                            "sandbox_id": sbx.sandbox_id,
                            "package": package_str,
                            "tool_name": self.tool.name,
                            "error": str(e),
                        },
                    )
                    raise RuntimeError(error_msg) from e

        return sbx

    def use_top_level_await(self) -> bool:
        """
        E2B sandboxes run in a Jupyter-like environment with an active event loop,
        so they support top-level await.
        """
        return True

    @staticmethod
    async def list_running_e2b_sandboxes():
        # List running sandboxes and access metadata.
        return await AsyncSandbox.list()
