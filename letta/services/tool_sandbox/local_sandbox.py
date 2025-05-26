import asyncio
import os
import sys
import tempfile
from typing import Any, Dict, Optional, Tuple

from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig, SandboxType
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.helpers.tool_execution_helper import (
    create_venv_for_local_sandbox,
    find_python_executable,
    install_pip_requirements_for_sandbox,
)
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.settings import tool_settings
from letta.tracing import log_event, trace_method
from letta.utils import get_friendly_error_msg


class AsyncToolSandboxLocal(AsyncToolSandboxBase):
    METADATA_CONFIG_STATE_KEY = "config_state"
    REQUIREMENT_TXT_NAME = "requirements.txt"

    def __init__(
        self,
        tool_name: str,
        args: dict,
        user,
        force_recreate_venv=False,
        tool_object: Optional[Tool] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)
        self.force_recreate_venv = force_recreate_venv

    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        """
        Run the tool in a sandbox environment asynchronously,
        *always* using a subprocess for execution.
        """
        result = await self.run_local_dir_sandbox(agent_state=agent_state, additional_env_vars=additional_env_vars)

        # Simple console logging for demonstration
        for log_line in (result.stdout or []) + (result.stderr or []):
            print(f"Tool execution log: {log_line}")

        return result

    @trace_method
    async def run_local_dir_sandbox(
        self,
        agent_state: Optional[AgentState],
        additional_env_vars: Optional[Dict],
    ) -> ToolExecutionResult:
        """
        Unified asynchronous method to run the tool in a local sandbox environment,
        always via subprocess for multi-core parallelism.
        """
        # Get sandbox configuration
        if self.provided_sandbox_config:
            sbx_config = self.provided_sandbox_config
        else:
            sbx_config = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(
                sandbox_type=SandboxType.LOCAL, actor=self.user
            )
        local_configs = sbx_config.get_local_config()
        use_venv = local_configs.use_venv

        # Prepare environment variables
        env = os.environ.copy()
        if self.provided_sandbox_env_vars:
            env.update(self.provided_sandbox_env_vars)
        else:
            env_vars = await self.sandbox_config_manager.get_sandbox_env_vars_as_dict_async(
                sandbox_config_id=sbx_config.id, actor=self.user, limit=100
            )
            env.update(env_vars)

        if agent_state:
            env.update(agent_state.get_agent_env_vars_as_dict())

        if additional_env_vars:
            env.update(additional_env_vars)

        # Make sure sandbox directory exists
        sandbox_dir = os.path.expanduser(local_configs.sandbox_dir)
        if not os.path.exists(sandbox_dir) or not os.path.isdir(sandbox_dir):
            os.makedirs(sandbox_dir)

        # If using a virtual environment, ensure it's prepared in parallel
        venv_preparation_task = None
        if use_venv:
            venv_path = str(os.path.join(sandbox_dir, local_configs.venv_name))
            venv_preparation_task = asyncio.create_task(self._prepare_venv(local_configs, venv_path, env))

        # Generate and write execution script (always with markers, since we rely on stdout)
        with tempfile.NamedTemporaryFile(mode="w", dir=sandbox_dir, suffix=".py", delete=False) as temp_file:
            code = self.generate_execution_script(agent_state=agent_state, wrap_print_with_markers=True)
            temp_file.write(code)
            temp_file.flush()
            temp_file_path = temp_file.name

        try:
            # If we started a venv preparation task, wait for it to complete
            if venv_preparation_task:
                await venv_preparation_task

            # Determine the python executable and environment for the subprocess
            exec_env = env.copy()
            if use_venv:
                venv_path = str(os.path.join(sandbox_dir, local_configs.venv_name))
                python_executable = find_python_executable(local_configs)
                exec_env["VIRTUAL_ENV"] = venv_path
                exec_env["PATH"] = os.path.join(venv_path, "bin") + ":" + exec_env["PATH"]
            else:
                # If not using venv, use whatever Python we are running on
                python_executable = sys.executable

            exec_env["PYTHONWARNINGS"] = "ignore"

            # Execute in subprocess
            return await self._execute_tool_subprocess(
                sbx_config=sbx_config,
                python_executable=python_executable,
                temp_file_path=temp_file_path,
                env=exec_env,
                cwd=sandbox_dir,
            )

        except Exception as e:
            print(f"Executing tool {self.tool_name} has an unexpected error: {e}")
            print(f"Auto-generated code for debugging:\n\n{code}")
            raise e
        finally:
            # Clean up the temp file
            os.remove(temp_file_path)

    async def _prepare_venv(self, local_configs, venv_path: str, env: Dict[str, str]):
        """
        Prepare virtual environment asynchronously (in a background thread).
        """
        if self.force_recreate_venv or not os.path.isdir(venv_path):
            sandbox_dir = os.path.expanduser(local_configs.sandbox_dir)
            log_event(name="start create_venv_for_local_sandbox", attributes={"venv_path": venv_path})
            await asyncio.to_thread(
                create_venv_for_local_sandbox,
                sandbox_dir_path=sandbox_dir,
                venv_path=venv_path,
                env=env,
                force_recreate=self.force_recreate_venv,
            )
            log_event(name="finish create_venv_for_local_sandbox")

        log_event(name="start install_pip_requirements_for_sandbox", attributes={"local_configs": local_configs.model_dump_json()})
        await asyncio.to_thread(install_pip_requirements_for_sandbox, local_configs, upgrade=True, user_install_if_no_venv=False, env=env)
        log_event(name="finish install_pip_requirements_for_sandbox", attributes={"local_configs": local_configs.model_dump_json()})

    @trace_method
    async def _execute_tool_subprocess(
        self, sbx_config, python_executable: str, temp_file_path: str, env: Dict[str, str], cwd: str
    ) -> ToolExecutionResult:
        """
        Execute user code in a subprocess, always capturing stdout and stderr.
        We parse special markers to extract the pickled result string.
        """
        try:
            log_event(name="start subprocess")

            process = await asyncio.create_subprocess_exec(
                python_executable, temp_file_path, env=env, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=tool_settings.tool_sandbox_timeout)
            except asyncio.TimeoutError:
                # Terminate the process on timeout
                if process.returncode is None:
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        process.kill()

                raise TimeoutError(f"Executing tool {self.tool_name} timed out after 60 seconds.")

            stdout = stdout_bytes.decode("utf-8") if stdout_bytes else ""
            stderr = stderr_bytes.decode("utf-8") if stderr_bytes else ""
            log_event(name="finish subprocess")

            # Parse markers to isolate the function result
            func_result, stdout_text = self.parse_out_function_results_markers(stdout)
            func_return, agent_state = self.parse_best_effort(func_result)

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=agent_state,
                stdout=[stdout_text] if stdout_text else [],
                stderr=[stderr] if stderr else [],
                status="success" if process.returncode == 0 else "error",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

        except (TimeoutError, Exception) as e:
            # Distinguish between timeouts and other exceptions for clarity
            if isinstance(e, TimeoutError):
                raise e

            print(f"Subprocess execution for tool {self.tool_name} encountered an error: {e}")
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

    def parse_out_function_results_markers(self, text: str) -> Tuple[str, str]:
        """
        Parse the function results out of the stdout using special markers.
        Returns (function_result_str, stripped_stdout).
        """
        if self.LOCAL_SANDBOX_RESULT_START_MARKER not in text:
            # No markers found, so nothing to parse
            return "", text

        marker_len = len(self.LOCAL_SANDBOX_RESULT_START_MARKER)
        start_index = text.index(self.LOCAL_SANDBOX_RESULT_START_MARKER) + marker_len
        end_index = text.index(self.LOCAL_SANDBOX_RESULT_END_MARKER)

        # The actual pickled base64 is between start_index and end_index
        results_str = text[start_index:end_index]
        # The rest of stdout (minus the markers)
        remainder = text[: start_index - marker_len] + text[end_index + marker_len :]
        return results_str, remainder
