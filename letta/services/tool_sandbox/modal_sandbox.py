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

# class AsyncToolSandboxModalBase(AsyncToolSandboxBase):
#     pass


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

        if not tool_settings.modal_token_id or not tool_settings.modal_token_secret:
            raise ValueError("MODAL_TOKEN_ID and MODAL_TOKEN_SECRET must be set.")

        # Create a unique app name based on tool and config
        self._app_name = self._generate_app_name()

    def _generate_app_name(self) -> str:
        """Generate a unique app name based on tool and configuration. Created based on tool name and org"""
        return f"{self.user.organization_id}-{self.tool_name}"

    async def _fetch_or_create_modal_app(self, sbx_config: SandboxConfig, env_vars: Dict[str, str]) -> modal.App:
        """Create a Modal app with the tool function registered."""
        try:
            app = await modal.App.lookup.aio(self._app_name)
            return app
        except:
            app = modal.App(self._app_name)

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
                # app = modal.Cls.from_name(app.name, "NodeShimServer")()
                result = app.remote_executor.remote(execution_script, envs)

            # Process the result
            if result["error"]:
                # Tool errors are expected behavior - tools can raise exceptions as part of their normal operation
                # Only log at debug level to avoid triggering Sentry alerts for expected errors
                logger.debug(f"Tool {self.tool_name} raised a {result['error']['name']}: {result['error']['value']}")
                logger.debug(f"Traceback from Modal sandbox: \n{result['error']['traceback']}")
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


class TypescriptToolSandboxModal(AsyncToolSandboxModal):
    """Modal sandbox implementation for TypeScript tools."""

    @trace_method
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        """Run TypeScript tool in Modal sandbox using Node.js server."""
        if self.provided_sandbox_config:
            sbx_config = self.provided_sandbox_config
        else:
            sbx_config = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.MODAL, actor=self.user
            )

        envs = await self._gather_env_vars(agent_state, additional_env_vars or {}, sbx_config.id, is_local=False)

        # Generate execution script (JSON args for TypeScript)
        json_args = await self.generate_execution_script(agent_state=agent_state)

        try:
            log_event(
                "modal_typescript_execution_started",
                {"tool": self.tool_name, "app_name": self._app_name, "args": json_args},
            )

            # Create Modal app with the TypeScript Node.js server
            app = await self._fetch_or_create_modal_app(sbx_config, envs)

            # Execute the TypeScript tool remotely via the Node.js server
            with app.run():
                # Get the NodeShimServer class from Modal
                node_server = modal.Cls.from_name(self._app_name, "NodeShimServer")

                # Call the remote_executor method with the JSON arguments
                # The server will parse the JSON and call the TypeScript function
                result = node_server().remote_executor.remote(json_args)

            # Process the TypeScript execution result
            if isinstance(result, dict) and "error" in result:
                # Handle errors from TypeScript execution
                logger.debug(f"TypeScript tool {self.tool_name} raised an error: {result['error']}")
                func_return = get_friendly_error_msg(
                    function_name=self.tool_name,
                    exception_name="TypeScriptError",
                    exception_message=str(result["error"]),
                )
                log_event(
                    "modal_typescript_execution_failed",
                    {
                        "tool": self.tool_name,
                        "app_name": self._app_name,
                        "error": result["error"],
                        "func_return": func_return,
                    },
                )
                return ToolExecutionResult(
                    func_return=func_return,
                    agent_state=None,  # TypeScript tools don't support agent_state yet
                    stdout=[],
                    stderr=[str(result["error"])],
                    status="error",
                    sandbox_config_fingerprint=sbx_config.fingerprint(),
                )
            else:
                # Success case - TypeScript function returned a result
                func_return = str(result) if result is not None else ""
                log_event(
                    "modal_typescript_execution_succeeded",
                    {
                        "tool": self.tool_name,
                        "app_name": self._app_name,
                        "func_return": func_return,
                    },
                )
                return ToolExecutionResult(
                    func_return=func_return,
                    agent_state=None,  # TypeScript tools don't support agent_state yet
                    stdout=[],
                    stderr=[],
                    status="success",
                    sandbox_config_fingerprint=sbx_config.fingerprint(),
                )

        except Exception as e:
            logger.error(f"Modal TypeScript execution for tool {self.tool_name} encountered an error: {e}")
            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )
            log_event(
                "modal_typescript_execution_error",
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

    async def _fetch_or_create_modal_app(self, sbx_config: SandboxConfig, env_vars: Dict[str, str]) -> modal.App:
        """Create or fetch a Modal app with TypeScript execution capabilities."""
        try:
            return await modal.App.lookup.aio(self._app_name)
        except:
            app = modal.App(self._app_name)

        modal_config = sbx_config.get_modal_config()

        # Get the base image with dependencies
        image = self._get_modal_image(sbx_config)

        # Import the NodeShimServer that will handle TypeScript execution
        from sandbox.node_server import NodeShimServer

        # Register the NodeShimServer class with Modal
        # This creates a serverless function that can handle concurrent requests
        app.cls(image=image, restrict_modal_access=True, include_source=False, timeout=modal_config.timeout if modal_config else 60)(
            modal.concurrent(max_inputs=100, target_inputs=50)(NodeShimServer)
        )

        # Deploy the app to Modal
        with modal.enable_output():
            await app.deploy.aio()

        return app

    async def generate_execution_script(self, agent_state: Optional[AgentState], wrap_print_with_markers: bool = False) -> str:
        """Generate the execution script for TypeScript tools.

        For TypeScript tools, this returns the JSON-encoded arguments that will be passed
        to the Node.js server via the remote_executor method.
        """
        import json

        # Convert args to JSON string for TypeScript execution
        # The Node.js server expects JSON-encoded arguments
        return json.dumps(self.args)

    def _get_modal_image(self, sbx_config: SandboxConfig) -> modal.Image:
        """Build a Modal image with Node.js, TypeScript, and the user's tool function."""
        import importlib.util
        from pathlib import Path

        # Find the sandbox module location
        spec = importlib.util.find_spec("sandbox")
        if not spec or not spec.origin:
            raise ValueError("Could not find sandbox module")
        server_dir = Path(spec.origin).parent

        # Get the TypeScript function source code
        if not self.tool or not self.tool.source_code:
            raise ValueError("TypeScript tool must have source code")

        ts_function = self.tool.source_code

        # Get npm dependencies from sandbox config and tool
        modal_config = sbx_config.get_modal_config()
        npm_dependencies = []

        # Add dependencies from sandbox config
        if modal_config and modal_config.npm_requirements:
            npm_dependencies.extend(modal_config.npm_requirements)

        # Add dependencies from the tool itself
        if self.tool.npm_requirements:
            npm_dependencies.extend(self.tool.npm_requirements)

        # Build npm install command for user dependencies
        user_dependencies_cmd = ""
        if npm_dependencies:
            # Ensure unique dependencies
            unique_deps = list(set(npm_dependencies))
            user_dependencies_cmd = " && npm install " + " ".join(unique_deps)

        # Escape single quotes in the TypeScript function for shell command
        escaped_ts_function = ts_function.replace("'", "'\\''")

        # Build the Docker image with Node.js and TypeScript
        image = (
            modal.Image.from_registry("node:22-slim", add_python="3.12")
            .add_local_dir(server_dir, "/root/sandbox", ignore=["node_modules", "build"], copy=True)
            .run_commands(
                # Install dependencies and build the TypeScript server
                f"cd /root/sandbox/resources/server && npm install{user_dependencies_cmd}",
                # Write the user's TypeScript function to a file
                f"echo '{escaped_ts_function}' > /root/sandbox/user-function.ts",
            )
        )
        return image


# probably need to do  parse_stdout_best_effort
