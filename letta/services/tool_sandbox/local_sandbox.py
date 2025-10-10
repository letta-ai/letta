import asyncio
import hashlib
import os
import struct
import sys
import tempfile
from typing import Any, Dict, Optional

from pydantic.config import JsonDict

from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import SandboxType
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.helpers.tool_execution_helper import (
    create_venv_for_local_sandbox,
    find_python_executable,
    install_pip_requirements_for_sandbox,
)
from letta.services.helpers.tool_parser_helper import parse_stdout_best_effort
from letta.services.tool_sandbox.base import AsyncToolSandboxBase
from letta.settings import tool_settings
from letta.utils import get_friendly_error_msg, parse_stderr_error_msg, safe_create_task

logger = get_logger(__name__)


class AsyncToolSandboxLocal(AsyncToolSandboxBase):
    METADATA_CONFIG_STATE_KEY = "config_state"
    REQUIREMENT_TXT_NAME = "requirements.txt"

    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        force_recreate_venv=False,
        tool_object: Optional[Tool] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(tool_name, args, user, tool_object, sandbox_config=sandbox_config, sandbox_env_vars=sandbox_env_vars)
        self.force_recreate_venv = force_recreate_venv

    @trace_method
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        """
        Run the tool in a local sandbox environment asynchronously.
        Uses a subprocess for multi-core parallelism.
        """
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
        if not await asyncio.to_thread(lambda: os.path.exists(sandbox_dir) and os.path.isdir(sandbox_dir)):
            await asyncio.to_thread(os.makedirs, sandbox_dir)

        # If using a virtual environment, ensure it's prepared in parallel
        venv_preparation_task = None
        if use_venv:
            venv_path = str(os.path.join(sandbox_dir, local_configs.venv_name))
            venv_preparation_task = safe_create_task(self._prepare_venv(local_configs, venv_path, env), label="prepare_venv")

        # Generate and write execution script (always with markers, since we rely on stdout)
        code = await self.generate_execution_script(agent_state=agent_state, wrap_print_with_markers=True)

        async def write_temp_file(dir, content):
            def _write():
                with tempfile.NamedTemporaryFile(mode="w", dir=dir, suffix=".py", delete=False) as temp_file:
                    temp_file.write(content)
                    temp_file.flush()
                    return temp_file.name

            return await asyncio.to_thread(_write)

        temp_file_path = await write_temp_file(sandbox_dir, code)

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
                # For embedded/desktop environments, preserve Python paths
                # This ensures the subprocess can find bundled modules
                if "PYTHONPATH" in os.environ:
                    exec_env["PYTHONPATH"] = os.environ["PYTHONPATH"]

            # handle unwanted terminal behavior
            exec_env.update(
                {
                    "PYTHONWARNINGS": "ignore",
                    "NO_COLOR": "1",
                    "TERM": "dumb",
                    "PYTHONUNBUFFERED": "1",
                }
            )

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
            # Clean up the temp file if not debugging
            from letta.settings import settings

            if not settings.debug:
                await asyncio.to_thread(os.remove, temp_file_path)

    async def _prepare_venv(self, local_configs, venv_path: str, env: Dict[str, str]):
        """
        Prepare virtual environment asynchronously (in a background thread).
        """
        if self.force_recreate_venv or not await asyncio.to_thread(os.path.isdir, venv_path):
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

        if local_configs.pip_requirements or (self.tool and self.tool.pip_requirements):
            log_event(name="start install_pip_requirements_for_sandbox", attributes={"local_configs": local_configs.model_dump_json()})
            await asyncio.to_thread(
                install_pip_requirements_for_sandbox, local_configs, upgrade=True, user_install_if_no_venv=False, env=env, tool=self.tool
            )
            log_event(name="finish install_pip_requirements_for_sandbox", attributes={"local_configs": local_configs.model_dump_json()})

    async def _execute_tool_subprocess(
        self, sbx_config, python_executable: str, temp_file_path: str, env: Dict[str, str], cwd: str
    ) -> ToolExecutionResult:
        """
        Execute user code in a subprocess, always capturing stdout and stderr.
        We parse special markers to extract the pickled result string.
        """
        stdout_text = ""
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

                raise TimeoutError(f"Executing tool {self.tool_name} timed out after {tool_settings.tool_sandbox_timeout} seconds.")

            stderr = stderr_bytes.decode("utf-8") if stderr_bytes else ""
            log_event(name="finish subprocess")

            # Parse markers to isolate the function result
            func_result_bytes, stdout_text = self.parse_out_function_results_markers(stdout_bytes)
            func_return, agent_state = parse_stdout_best_effort(func_result_bytes)

            if process.returncode != 0 and func_return is None:
                exception_name, msg = parse_stderr_error_msg(stderr)
                func_return = get_friendly_error_msg(
                    function_name=self.tool_name,
                    exception_name=exception_name,
                    exception_message=msg,
                )

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

            logger.exception(f"Subprocess execution for tool {self.tool_name} encountered an error: {e}")
            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=type(e).__name__,
                exception_message=str(e),
            )
            return ToolExecutionResult(
                func_return=func_return,
                agent_state=None,
                stdout=[stdout_text],
                stderr=[str(e)],
                status="error",
                sandbox_config_fingerprint=sbx_config.fingerprint(),
            )

    def parse_out_function_results_markers(self, data: bytes) -> tuple[bytes, str]:
        """
        Parse the function results out of the stdout using special markers.
        Returns (function_results_bytes, stripped_stdout_bytes).
        """
        pos = data.find(self.LOCAL_SANDBOX_RESULT_START_MARKER)
        if pos < 0:
            return b"", data.decode("utf-8") if data else ""

        DATA_LENGTH_INDICATOR = 4
        CHECKSUM_LENGTH = 32
        pos_start = pos + len(self.LOCAL_SANDBOX_RESULT_START_MARKER)
        checksum_start = pos_start + DATA_LENGTH_INDICATOR
        message_start = checksum_start + CHECKSUM_LENGTH

        message_len = struct.unpack(">I", data[pos_start:checksum_start])[0]
        checksum = data[checksum_start:message_start]
        message_data = data[message_start : message_start + message_len]
        actual_checksum = hashlib.md5(message_data).hexdigest().encode("ascii")
        if actual_checksum == checksum:
            remainder = data[:pos] + data[message_start + message_len :]
            return message_data, (remainder.decode("utf-8") if remainder else "")
        raise Exception("Function ran, but output is corrupted.")
