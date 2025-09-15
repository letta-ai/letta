"""
This runs tool calls within an isolated modal sandbox. This does this by doing the following:
1. deploying modal functions that embed the original functions
2. dynamically executing tools with arguments passed in at runtime
3. tracking deployment versions to know when a deployment update is needed
"""

from typing import Any, Dict

import modal

from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import SandboxType
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.services.tool_sandbox.modal_constants import DEFAULT_MAX_CONCURRENT_INPUTS, DEFAULT_PYTHON_VERSION
from letta.services.tool_sandbox.modal_deployment_manager import ModalDeploymentManager
from letta.services.tool_sandbox.modal_version_manager import ModalVersionManager
from letta.services.tool_sandbox.safe_pickle import SafePickleError, safe_pickle_dumps, sanitize_for_pickle
from letta.settings import tool_settings
from letta.types import JsonDict
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class AsyncToolSandboxModalV2(AsyncToolSandboxBase):
    """Modal sandbox with dynamic argument passing and version tracking."""

    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        tool_object: Tool | None = None,
        sandbox_config: SandboxConfig | None = None,
        sandbox_env_vars: dict[str, Any] | None = None,
        version_manager: ModalVersionManager | None = None,
        use_locking: bool = True,
        use_version_tracking: bool = True,
    ):
        """
        Initialize the Modal sandbox.

        Args:
            tool_name: Name of the tool to execute
            args: Arguments to pass to the tool
            user: User/actor for permissions
            tool_object: Tool object (optional)
            sandbox_config: Sandbox configuration (optional)
            sandbox_env_vars: Environment variables (optional)
            version_manager: Version manager, will create default if needed (optional)
            use_locking: Whether to use locking for deployment coordination (default: True)
            use_version_tracking: Whether to track and reuse deployments (default: True)
        """
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)

        if not tool_settings.modal_token_id or not tool_settings.modal_token_secret:
            raise ValueError("MODAL_TOKEN_ID and MODAL_TOKEN_SECRET must be set.")

        # Initialize deployment manager with configurable options
        self._deployment_manager = ModalDeploymentManager(
            tool=self.tool,
            version_manager=version_manager,
            use_locking=use_locking,
            use_version_tracking=use_version_tracking,
        )
        self._version_hash = None

    async def _get_or_deploy_modal_app(self, sbx_config: SandboxConfig) -> modal.App:
        """Get existing Modal app or deploy a new version if needed."""

        app, version_hash = await self._deployment_manager.get_or_deploy_app(
            sbx_config=sbx_config,
            user=self.user,
            create_app_func=self._create_and_deploy_app,
        )

        self._version_hash = version_hash
        return app

    async def _create_and_deploy_app(self, sbx_config: SandboxConfig, version: str) -> modal.App:
        """Create and deploy a new Modal app with the executor function."""
        import importlib.util
        from pathlib import Path

        # App name = tool_id + version hash
        app_full_name = self._deployment_manager.get_full_app_name(version)
        app = modal.App(app_full_name)

        modal_config = sbx_config.get_modal_config()
        image = self._get_modal_image(sbx_config)

        # Find the sandbox module dynamically
        spec = importlib.util.find_spec("sandbox")
        if not spec or not spec.origin:
            raise ValueError("Could not find sandbox module")
        sandbox_dir = Path(spec.origin).parent

        # Read the modal_executor module content
        executor_path = sandbox_dir / "modal_executor.py"
        if not executor_path.exists():
            raise ValueError(f"modal_executor.py not found at {executor_path}")

        with open(executor_path, "r") as f:
            f.read()

        # Create a single file mount instead of directory mount
        # This avoids sys.path manipulation
        image = image.add_local_file(str(executor_path), remote_path="/modal_executor.py")

        # Register the executor function with Modal
        @app.function(
            image=image,
            timeout=modal_config.timeout,
            restrict_modal_access=True,
            max_inputs=DEFAULT_MAX_CONCURRENT_INPUTS,
            serialized=True,
        )
        def tool_executor(
            tool_source: str,
            tool_name: str,
            args_pickled: bytes,
            agent_state_pickled: bytes | None,
            inject_agent_state: bool,
            is_async: bool,
            args_schema_code: str | None,
            environment_vars: Dict[str, Any],
        ) -> Dict[str, Any]:
            """Execute tool in Modal container."""
            # Execute the modal_executor code in a clean namespace

            # Create a module-like namespace for executor
            executor_namespace = {
                "__name__": "modal_executor",
                "__file__": "/modal_executor.py",
            }

            # Read and execute the module file
            with open("/modal_executor.py", "r") as f:
                exec(compile(f.read(), "/modal_executor.py", "exec"), executor_namespace)

            # Call the wrapper function from the executed namespace
            return executor_namespace["execute_tool_wrapper"](
                tool_source=tool_source,
                tool_name=tool_name,
                args_pickled=args_pickled,
                agent_state_pickled=agent_state_pickled,
                inject_agent_state=inject_agent_state,
                is_async=is_async,
                args_schema_code=args_schema_code,
                environment_vars=environment_vars,
            )

        # Store the function reference
        app.tool_executor = tool_executor

        # Deploy the app
        logger.info(f"Deploying Modal app {app_full_name}")
        log_event("modal_v2_deploy_started", {"app_name": app_full_name, "version": version})

        try:
            # Try to look up the app first to see if it already exists
            try:
                await modal.App.lookup.aio(app_full_name)
                logger.info(f"Modal app {app_full_name} already exists, skipping deployment")
                log_event("modal_v2_deploy_already_exists", {"app_name": app_full_name, "version": version})
                # Return the created app with the function attached
                return app
            except:
                # App doesn't exist, need to deploy
                pass

            with modal.enable_output():
                await app.deploy.aio()
            log_event("modal_v2_deploy_succeeded", {"app_name": app_full_name, "version": version})
        except Exception as e:
            log_event("modal_v2_deploy_failed", {"app_name": app_full_name, "version": version, "error": str(e)})
            raise

        return app

    @trace_method
    async def run(
        self,
        agent_state: AgentState | None = None,
        additional_env_vars: Dict | None = None,
    ) -> ToolExecutionResult:
        """Execute the tool in Modal sandbox with dynamic argument passing."""
        if self.provided_sandbox_config:
            sbx_config = self.provided_sandbox_config
        else:
            sbx_config = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.MODAL, actor=self.user
            )

        envs = await self._gather_env_vars(agent_state, additional_env_vars or {}, sbx_config.id, is_local=False)

        # Prepare schema code if needed
        args_schema_code = None
        if self.tool.args_json_schema:
            from letta.services.helpers.tool_execution_helper import add_imports_and_pydantic_schemas_for_args

            args_schema_code = add_imports_and_pydantic_schemas_for_args(self.tool.args_json_schema)

        # Serialize arguments and agent state with safety checks
        try:
            args_pickled = safe_pickle_dumps(self.args)
        except SafePickleError as e:
            logger.warning(f"Failed to pickle args, attempting sanitization: {e}")
            sanitized_args = sanitize_for_pickle(self.args)
            try:
                args_pickled = safe_pickle_dumps(sanitized_args)
            except SafePickleError:
                # Final fallback: convert to string representation
                args_pickled = safe_pickle_dumps(str(self.args))

        agent_state_pickled = None
        if self.inject_agent_state and agent_state:
            try:
                agent_state_pickled = safe_pickle_dumps(agent_state)
            except SafePickleError as e:
                logger.warning(f"Failed to pickle agent state: {e}")
                # For agent state, we prefer to skip injection rather than send corrupted data
                agent_state_pickled = None
                self.inject_agent_state = False

        try:
            log_event(
                "modal_execution_started",
                {
                    "tool": self.tool_name,
                    "app_name": self._deployment_manager._app_name,
                    "version": self._version_hash,
                    "env_vars": list(envs),
                    "args_size": len(args_pickled),
                    "agent_state_size": len(agent_state_pickled) if agent_state_pickled else 0,
                    "inject_agent_state": self.inject_agent_state,
                },
            )

            # Get or deploy the Modal app
            app = await self._get_or_deploy_modal_app(sbx_config)

            # Get modal config for timeout settings
            modal_config = sbx_config.get_modal_config()

            # Execute the tool remotely with retry logic
            max_retries = 3
            retry_delay = 1  # seconds
            last_error = None

            for attempt in range(max_retries):
                try:
                    # Add timeout to prevent hanging
                    import asyncio

                    result = await asyncio.wait_for(
                        app.tool_executor.remote.aio(
                            tool_source=self.tool.source_code,
                            tool_name=self.tool.name,
                            args_pickled=args_pickled,
                            agent_state_pickled=agent_state_pickled,
                            inject_agent_state=self.inject_agent_state,
                            is_async=self.is_async_function,
                            args_schema_code=args_schema_code,
                            environment_vars=envs,
                        ),
                        timeout=modal_config.timeout + 10,  # Add 10s buffer to Modal's own timeout
                    )
                    break  # Success, exit retry loop
                except asyncio.TimeoutError as e:
                    last_error = e
                    logger.warning(f"Modal execution timeout on attempt {attempt + 1}/{max_retries} for tool {self.tool_name}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                except Exception as e:
                    last_error = e
                    # Check if it's a transient error worth retrying
                    error_str = str(e).lower()
                    if any(x in error_str for x in ["segmentation fault", "sigsegv", "connection", "timeout"]):
                        logger.warning(f"Transient error on attempt {attempt + 1}/{max_retries} for tool {self.tool_name}: {e}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                    # Non-transient error, don't retry
                    raise
            else:
                # All retries exhausted
                raise last_error

            # Process the result
            if result["error"]:
                logger.debug(f"Tool {self.tool_name} raised a {result['error']['name']}: {result['error']['value']}")
                logger.debug(f"Traceback from Modal sandbox: \n{result['error']['traceback']}")

                # Check for segfault indicators
                is_segfault = False
                if "SIGSEGV" in str(result["error"]["value"]) or "Segmentation fault" in str(result["error"]["value"]):
                    is_segfault = True
                    logger.error(f"SEGFAULT detected in tool {self.tool_name}: {result['error']['value']}")

                func_return = get_friendly_error_msg(
                    function_name=self.tool_name,
                    exception_name=result["error"]["name"],
                    exception_message=result["error"]["value"],
                )
                log_event(
                    "modal_execution_failed",
                    {
                        "tool": self.tool_name,
                        "app_name": self._deployment_manager._app_name,
                        "version": self._version_hash,
                        "error_type": result["error"]["name"],
                        "error_message": result["error"]["value"],
                        "func_return": func_return,
                        "is_segfault": is_segfault,
                        "stdout": result.get("stdout", ""),
                        "stderr": result.get("stderr", ""),
                    },
                )
                status = "error"
            else:
                func_return = result["result"]
                agent_state = result["agent_state"]
                log_event(
                    "modal_v2_execution_succeeded",
                    {
                        "tool": self.tool_name,
                        "app_name": self._deployment_manager._app_name,
                        "version": self._version_hash,
                        "func_return": str(func_return)[:500],  # Limit logged result size
                        "stdout_size": len(result.get("stdout", "")),
                        "stderr_size": len(result.get("stderr", "")),
                    },
                )
                status = "success"

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=agent_state if not result["error"] else None,
                stdout=[result["stdout"]] if result["stdout"] else [],
                stderr=[result["stderr"]] if result["stderr"] else [],
                status=status,
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

        except Exception as e:
            import traceback

            error_context = {
                "tool": self.tool_name,
                "app_name": self._deployment_manager._app_name,
                "version": self._version_hash,
                "error_type": type(e).__name__,
                "error_message": str(e),
                "traceback": traceback.format_exc(),
            }

            logger.error(f"Modal V2 execution for tool {self.tool_name} encountered an error: {e}", extra=error_context)

            # Determine if this is a deployment error or execution error
            if "deploy" in str(e).lower() or "modal" in str(e).lower():
                error_category = "deployment_error"
            else:
                error_category = "execution_error"

            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )

            log_event(f"modal_v2_{error_category}", error_context)

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=None,
                stdout=[],
                stderr=[f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"],
                status="error",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

    def _get_modal_image(self, sbx_config: SandboxConfig) -> modal.Image:
        """Get Modal image with required public python dependencies.

        Caching and rebuilding is handled in a cascading manner
        https://modal.com/docs/guide/images#image-caching-and-rebuilds
        """
        # Start with a more robust base image with development tools
        image = modal.Image.debian_slim(python_version=DEFAULT_PYTHON_VERSION)

        # Add system packages for better C extension support
        image = image.apt_install(
            "build-essential",  # Compilation tools
            "libsqlite3-dev",  # SQLite development headers
            "libffi-dev",  # Foreign Function Interface library
            "libssl-dev",  # OpenSSL development headers
            "python3-dev",  # Python development headers
        )

        # Include dependencies required by letta's ORM modules
        # These are needed when unpickling agent_state objects
        all_requirements = [
            "letta",
            "sqlite-vec>=0.1.7a2",  # Required for SQLite vector operations
            "numpy<2.0",  # Pin numpy to avoid compatibility issues
        ]

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
