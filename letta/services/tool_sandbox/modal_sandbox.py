from typing import Any, Dict, Optional

import modal

from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import SandboxType
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.helpers.tool_parser_helper import parse_stdout_best_effort
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.settings import tool_settings
from letta.types import JsonDict
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class AsyncToolSandboxModal(AsyncToolSandboxBase):
    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        tool_object: Tool | None = None,
        sandbox_config: SandboxConfig | None = None,
        sandbox_env_vars: dict[str, Any] | None = None,
    ):
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)

        if not tool_settings.modal_api_key:
            raise ValueError("Modal API key is required but not set in tool_settings.modal_api_key")

        # Create a unique app name based on tool and config
        self._app_name = self._generate_app_name()

    def _generate_app_name(self) -> str:
        """Generate a unique app name based on tool and configuration. Created based on tool name and org"""
        return f"{self.user.organization_id}-{self.tool_name}"

    async def _fetch_or_create_modal_app(self, sbx_config: SandboxConfig, env_vars: Dict[str, str]) -> modal.App:
        """Create a Modal app with the tool function registered."""
        app = await modal.App.lookup.aio(self._app_name)
        modal_config = sbx_config.get_modal_config()

        # Get the base image with dependencies
        image = self._get_modal_image(sbx_config)

        # Decorator for the tool, note information on running untrusted code: https://modal.com/docs/guide/restricted-access
        # The `@app.function` decorator must apply to functions in global scope, unless `serialized=True` is set.
        @app.function(image=image, timeout=modal_config.timeout, restrict_modal_access=True, max_inputs=1, serialized=True)
        def execute_tool_with_script(execution_script: str, environment_vars: dict[str, str]):
            """Execute the generated tool script in Modal sandbox."""
            import os

            # Note: We pass environment variables directly instead of relying on Modal secrets
            # This is more flexible and doesn't require pre-configured secrets
            for key, value in environment_vars.items():
                os.environ[key] = str(value)

            exec_globals = {}
            exec(execution_script, exec_globals)

        # Store the function reference in the app for later use
        app.remote_executor = execute_tool_with_script
        return app

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
                sandbox_type=SandboxType.MODAL, actor=self.user
            )

        envs = await self._gather_env_vars(agent_state, additional_env_vars or {}, sbx_config.id, is_local=False)

        # Generate execution script (this includes the tool source code and execution logic)
        execution_script = await self.generate_execution_script(agent_state=agent_state)

        try:
            log_event(
                "modal_execution_started",
                {"tool": self.tool_name, "app_name": self._app_name, "env_vars": list(envs)},
            )

            # Create Modal app with the tool function registered
            app = await self._fetch_or_create_modal_app(sbx_config, envs)

            # Execute the tool remotely
            with app.run():
                result = app.remote_executor.remote(execution_script, envs)

            # Process the result
            if result["error"]:
                logger.error(
                    f"Executing tool {self.tool_name} raised a {result['error']['name']} with message: \n{result['error']['value']}"
                )
                logger.error(f"Traceback from Modal sandbox: \n{result['error']['traceback']}")
                func_return = get_friendly_error_msg(
                    function_name=self.tool_name, exception_name=result["error"]["name"], exception_message=result["error"]["value"]
                )
                log_event(
                    "modal_execution_failed",
                    {
                        "tool": self.tool_name,
                        "app_name": self._app_name,
                        "error_type": result["error"]["name"],
                        "error_message": result["error"]["value"],
                        "func_return": func_return,
                    },
                )
                # Parse the result from stdout even if there was an error
                # (in case the function returned something before failing)
                agent_state = None  # Initialize agent_state
                try:
                    func_return_parsed, agent_state_parsed = parse_stdout_best_effort(result["stdout"])
                    if func_return_parsed is not None:
                        func_return = func_return_parsed
                        agent_state = agent_state_parsed
                except Exception:
                    # If parsing fails, keep the error message
                    pass
            else:
                func_return, agent_state = parse_stdout_best_effort(result["stdout"])
                log_event(
                    "modal_execution_succeeded",
                    {
                        "tool": self.tool_name,
                        "app_name": self._app_name,
                        "func_return": func_return,
                    },
                )

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=agent_state,
                stdout=[result["stdout"]] if result["stdout"] else [],
                stderr=[result["stderr"]] if result["stderr"] else [],
                status="error" if result["error"] else "success",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

        except Exception as e:
            logger.error(f"Modal execution for tool {self.tool_name} encountered an error: {e}")
            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )
            log_event(
                "modal_execution_error",
                {
                    "tool": self.tool_name,
                    "app_name": self._app_name,
                    "error": str(e),
                    "func_return": func_return,
                },
            )
            return ToolExecutionResult(
                func_return=func_return,
                agent_state=None,
                stdout=[],
                stderr=[str(e)],
                status="error",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

    def _get_modal_image(self, sbx_config: SandboxConfig) -> modal.Image:
        """Get Modal image with required public python dependencies.

        Caching and rebuilding is handled in a cascading manner
        https://modal.com/docs/guide/images#image-caching-and-rebuilds
        """
        image = modal.Image.debian_slim(python_version="3.12")

        all_requirements = ["letta"]

        # Add sandbox-specific pip requirements
        modal_configs = sbx_config.get_modal_config()
        if modal_configs.pip_requirements:
            all_requirements.extend([str(req) for req in modal_configs.pip_requirements])

        # Add tool-specific pip requirements
        if self.tool and self.tool.pip_requirements:
            all_requirements.extend([str(req) for req in self.tool.pip_requirements])

        if all_requirements:
            image = image.pip_install(*all_requirements)

        return image

    def use_top_level_await(self) -> bool:
        """
        Modal functions don't have an active event loop by default,
        so we should use asyncio.run() like local execution.
        """
        return False
