from typing import Any, Dict, Optional

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig, SandboxType
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.tracing import log_event, trace_method
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class AsyncToolSandboxE2B(AsyncToolSandboxBase):
    METADATA_CONFIG_STATE_KEY = "config_state"

    def __init__(
        self,
        tool_name: str,
        args: dict,
        user,
        force_recreate=True,
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
        """
        Run the tool in a sandbox environment asynchronously,
        *always* using a subprocess for execution.
        """
        result = await self.run_e2b_sandbox(agent_state=agent_state, additional_env_vars=additional_env_vars)

        # Simple console logging for demonstration
        for log_line in (result.stdout or []) + (result.stderr or []):
            print(f"Tool execution log: {log_line}")

        return result

    @trace_method
    async def run_e2b_sandbox(
        self, agent_state: Optional[AgentState] = None, additional_env_vars: Optional[Dict] = None
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
        # TODO: We set limit to 100 here, but maybe we want it uncapped? Realistically this should be fine.
        env_vars = {}
        if self.provided_sandbox_env_vars:
            env_vars.update(self.provided_sandbox_env_vars)
        else:
            db_env_vars = await self.sandbox_config_manager.get_sandbox_env_vars_as_dict_async(
                sandbox_config_id=sbx_config.id, actor=self.user, limit=100
            )
            env_vars.update(db_env_vars)
        # Get environment variables for this agent specifically
        if agent_state:
            env_vars.update(agent_state.get_agent_env_vars_as_dict())

        # Finally, get any that are passed explicitly into the `run` function call
        if additional_env_vars:
            env_vars.update(additional_env_vars)
        code = self.generate_execution_script(agent_state=agent_state)

        log_event(
            "e2b_execution_started",
            {"tool": self.tool_name, "sandbox_id": e2b_sandbox.sandbox_id, "code": code, "env_vars": env_vars},
        )
        execution = await e2b_sandbox.run_code(code, envs=env_vars)
        if execution.results:
            func_return, agent_state = self.parse_best_effort(execution.results[0].text)
            log_event(
                "e2b_execution_succeeded",
                {
                    "tool": self.tool_name,
                    "sandbox_id": e2b_sandbox.sandbox_id,
                    "func_return": func_return,
                },
            )
        elif execution.error:
            logger.error(f"Executing tool {self.tool_name} raised a {execution.error.name} with message: \n{execution.error.value}")
            logger.error(f"Traceback from e2b sandbox: \n{execution.error.traceback}")
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

    def parse_exception_from_e2b_execution(self, e2b_execution: "Execution") -> Exception:
        builtins_dict = __builtins__ if isinstance(__builtins__, dict) else vars(__builtins__)
        # Dynamically fetch the exception class from builtins, defaulting to Exception if not found
        exception_class = builtins_dict.get(e2b_execution.error.name, Exception)
        return exception_class(e2b_execution.error.value)

    @trace_method
    async def create_e2b_sandbox_with_metadata_hash(self, sandbox_config: SandboxConfig) -> "Sandbox":
        from e2b_code_interpreter import AsyncSandbox

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
                await sbx.commands.run(f"pip install {package}")
                log_event(
                    "e2b_pip_install_finished",
                    {
                        "sandbox_id": sbx.sandbox_id,
                        "package": package,
                    },
                )

        return sbx

    async def list_running_e2b_sandboxes(self):
        from e2b_code_interpreter import AsyncSandbox

        # List running sandboxes and access metadata.
        return await AsyncSandbox.list()
