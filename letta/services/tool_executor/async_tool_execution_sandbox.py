import ast
import asyncio
import base64
import os
import pickle
import sys
import tempfile
import uuid
from typing import Any, Dict, Optional, Tuple

from letta.functions.helpers import generate_model_from_args_json_schema
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxRunResult, SandboxType
from letta.services.helpers.tool_execution_helper import (
    add_imports_and_pydantic_schemas_for_args,
    create_venv_for_local_sandbox,
    find_python_executable,
    install_pip_requirements_for_sandbox,
)
from letta.services.organization_manager import OrganizationManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_manager import ToolManager
from letta.tracing import log_event, trace_method
from letta.utils import get_friendly_error_msg


class AsyncToolExecutionSandbox:
    METADATA_CONFIG_STATE_KEY = "config_state"
    REQUIREMENT_TXT_NAME = "requirements.txt"

    # For generating long, random marker hashes
    NAMESPACE = uuid.NAMESPACE_DNS
    LOCAL_SANDBOX_RESULT_START_MARKER = str(uuid.uuid5(NAMESPACE, "local-sandbox-result-start-marker"))
    LOCAL_SANDBOX_RESULT_END_MARKER = str(uuid.uuid5(NAMESPACE, "local-sandbox-result-end-marker"))

    # This is the variable name in the auto-generated code that contains the function results
    # We make this a long random string to avoid collisions with any variables in the user's code
    LOCAL_SANDBOX_RESULT_VAR_NAME = "result_ZQqiequkcFwRwwGQMqkt"

    def __init__(self, tool_name: str, args: dict, user, force_recreate=True, force_recreate_venv=False, tool_object=None):
        self.tool_name = tool_name
        self.args = args
        self.user = user
        # get organization
        self.organization = OrganizationManager().get_organization_by_id(self.user.organization_id)
        self.privileged_tools = self.organization.privileged_tools

        # If a tool object is provided, we use it directly, otherwise pull via name
        if tool_object is not None:
            self.tool = tool_object
        else:
            # Get the tool via name
            self.tool = ToolManager().get_tool_by_name(tool_name=tool_name, actor=self.user)
            if not self.tool:
                raise ValueError(
                    f"Agent attempted to invoke tool {self.tool_name} that does not exist for organization {self.user.organization_id}"
                )

        self.sandbox_config_manager = SandboxConfigManager()
        self.force_recreate = force_recreate
        self.force_recreate_venv = force_recreate_venv

    async def run(
        self, agent_state: Optional[AgentState] = None, additional_env_vars: Optional[Dict] = None, inject_agent_state: bool = False
    ) -> SandboxRunResult:
        """
        Run the tool in a sandbox environment asynchronously,
        *always* using a subprocess for execution.
        """
        result = await self.run_local_dir_sandbox(
            agent_state=agent_state, additional_env_vars=additional_env_vars, inject_agent_state=inject_agent_state
        )

        # Simple console logging for demonstration
        for log_line in (result.stdout or []) + (result.stderr or []):
            print(f"Tool execution log: {log_line}")

        return result

    @trace_method
    async def run_local_dir_sandbox(
        self, agent_state: Optional[AgentState], additional_env_vars: Optional[Dict], inject_agent_state: bool
    ) -> SandboxRunResult:
        """
        Unified asynchronougit pus method to run the tool in a local sandbox environment,
        always via subprocess for multi-core parallelism.
        """
        # Get sandbox configuration
        sbx_config = self.sandbox_config_manager.get_or_create_default_sandbox_config(sandbox_type=SandboxType.LOCAL, actor=self.user)
        local_configs = sbx_config.get_local_config()
        use_venv = local_configs.use_venv

        # Prepare environment variables
        env = os.environ.copy()
        env_vars = self.sandbox_config_manager.get_sandbox_env_vars_as_dict(sandbox_config_id=sbx_config.id, actor=self.user, limit=100)
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
            if self.force_recreate_venv or not os.path.isdir(venv_path):
                venv_preparation_task = asyncio.create_task(self._prepare_venv(local_configs, venv_path, env))

        # Generate and write execution script (always with markers, since we rely on stdout)
        with tempfile.NamedTemporaryFile(mode="w", dir=sandbox_dir, suffix=".py", delete=False) as temp_file:
            code = self.generate_execution_script(agent_state=agent_state, inject_agent_state=inject_agent_state)
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
    ) -> SandboxRunResult:
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
                stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=60)
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

            return SandboxRunResult(
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
            return SandboxRunResult(
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

    def parse_best_effort(self, text: str) -> Tuple[Any, Optional[AgentState]]:
        """
        Decode and unpickle the result from the function execution if possible.
        Returns (function_return_value, agent_state).
        """
        if not text:
            return None, None

        result = pickle.loads(base64.b64decode(text))
        agent_state = result["agent_state"] if result["agent_state"] is not None else None
        return result["results"], agent_state

    def parse_function_arguments(self, source_code: str, tool_name: str) -> list:
        """
        Get arguments of the given function from its source code via AST.
        """
        tree = ast.parse(source_code)
        args = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == tool_name:
                for arg in node.args.args:
                    args.append(arg.arg)
        return args

    def generate_execution_script(self, agent_state: Optional[AgentState], inject_agent_state: bool) -> str:
        """
        Generate code to run inside of execution sandbox.
        Serialize the agent state and arguments, call the tool,
        then base64-encode/pickle the result.
        """
        code = "from typing import *\n"
        code += "import pickle\n"
        code += "import sys\n"
        code += "import base64\n"

        # Additional imports to support agent state
        if inject_agent_state:
            code += "import letta\n"
            code += "from letta import * \n"

        # Add schema code if available
        if self.tool.args_json_schema:
            schema_code = add_imports_and_pydantic_schemas_for_args(self.tool.args_json_schema)
            if "from __future__ import annotations" in schema_code:
                schema_code = schema_code.replace("from __future__ import annotations", "").lstrip()
                code = "from __future__ import annotations\n\n" + code
            code += schema_code + "\n"

        # Load the agent state
        if inject_agent_state:
            agent_state_pickle = pickle.dumps(agent_state)
            code += f"agent_state = pickle.loads({agent_state_pickle})\n"
        else:
            code += "agent_state = None\n"

        # Initialize arguments
        if self.tool.args_json_schema:
            args_schema = generate_model_from_args_json_schema(self.tool.args_json_schema)
            code += f"args_object = {args_schema.__name__}(**{self.args})\n"
            for param in self.args:
                code += f"{param} = args_object.{param}\n"
        else:
            for param in self.args:
                code += self.initialize_param(param, self.args[param])

        # Insert the tool's source code
        code += "\n" + self.tool.source_code + "\n"

        # Invoke the function and store the result in a global variable
        code += (
            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME}"
            + ' = {"results": '
            + self.invoke_function_call(inject_agent_state=inject_agent_state)
            + ', "agent_state": agent_state}\n'
        )
        code += (
            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME} = base64.b64encode("
            f"pickle.dumps({self.LOCAL_SANDBOX_RESULT_VAR_NAME})"
            ").decode('utf-8')\n"
        )

        # If we're always in a subprocess, we must rely on markers to parse out the result
        code += f"sys.stdout.write('{self.LOCAL_SANDBOX_RESULT_START_MARKER}')\n"
        code += f"sys.stdout.write(str({self.LOCAL_SANDBOX_RESULT_VAR_NAME}))\n"
        code += f"sys.stdout.write('{self.LOCAL_SANDBOX_RESULT_END_MARKER}')\n"

        return code

    def _convert_param_to_value(self, param_type: str, raw_value: str) -> str:
        """
        Convert parameter to Python code representation based on JSON schema type.
        """
        if param_type == "string":
            # Safely inject a Python string via pickle
            value = "pickle.loads(" + str(pickle.dumps(raw_value)) + ")"
        elif param_type in ["integer", "boolean", "number", "array", "object"]:
            # This is simplistic. In real usage, ensure correct type-casting or sanitization.
            value = raw_value
        else:
            raise TypeError(f"Unsupported type: {param_type}, raw_value={raw_value}")

        return str(value)

    def initialize_param(self, name: str, raw_value: str) -> str:
        """
        Produce code for initializing a single parameter in the generated script.
        """
        params = self.tool.json_schema["parameters"]["properties"]
        spec = params.get(name)
        if spec is None:
            # Possibly an extra param like 'self' that we ignore
            return ""

        param_type = spec.get("type")
        if param_type is None and spec.get("parameters"):
            param_type = spec["parameters"].get("type")

        value = self._convert_param_to_value(param_type, raw_value)
        return f"{name} = {value}\n"

    def invoke_function_call(self, inject_agent_state: bool) -> str:
        """
        Generate the function call code string with the appropriate arguments.
        """
        kwargs = []
        for name in self.args:
            if name in self.tool.json_schema["parameters"]["properties"]:
                kwargs.append(name)

        param_list = [f"{arg}={arg}" for arg in kwargs]
        if inject_agent_state:
            param_list.append("agent_state=agent_state")

        params = ", ".join(param_list)
        func_call_str = self.tool.name + "(" + params + ")"
        return func_call_str
