import os
import pickle
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from letta.functions.helpers import generate_model_from_args_json_schema
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.helpers.tool_execution_helper import add_imports_and_pydantic_schemas_for_args
from letta.services.helpers.tool_parser_helper import convert_param_to_str_value, parse_function_arguments
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_manager import ToolManager
from letta.types import JsonDict, JsonValue


class AsyncToolSandboxBase(ABC):
    NAMESPACE = uuid.NAMESPACE_DNS
    LOCAL_SANDBOX_RESULT_START_MARKER = uuid.uuid5(NAMESPACE, "local-sandbox-result-start-marker").bytes
    LOCAL_SANDBOX_RESULT_VAR_NAME = "result_ZQqiequkcFwRwwGQMqkt"

    def __init__(
        self,
        tool_name: str,
        args: JsonDict,
        user,
        tool_object: Optional[Tool] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ):
        self.tool_name = tool_name
        self.args = args
        self.user = user
        self.tool = tool_object

        # Store provided values or create manager to fetch them later
        self.provided_sandbox_config = sandbox_config
        self.provided_sandbox_env_vars = sandbox_env_vars

        # Only create the manager if we need to (lazy initialization)
        self._sandbox_config_manager = None

        self._initialized = False

    async def _init_async(self):
        """Must be called inside the run method before the sandbox can be used"""
        if not self._initialized:
            if not self.tool:
                self.tool = await ToolManager().get_tool_by_name_async(tool_name=self.tool_name, actor=self.user)

            # missing tool
            if self.tool is None:
                raise ValueError(
                    f"Agent attempted to invoke tool {self.tool_name} that does not exist for organization {self.user.organization_id}"
                )

            # Check for reserved keyword arguments
            tool_arguments = parse_function_arguments(self.tool.source_code, self.tool.name)

            # TODO: deprecate this
            if "agent_state" in tool_arguments:
                self.inject_agent_state = True
            else:
                self.inject_agent_state = False

            # Check for Letta client and agent_id injection
            self.inject_letta_client = "letta_client" in tool_arguments or "client" in tool_arguments
            self.inject_agent_id = "agent_id" in tool_arguments

            self.is_async_function = self._detect_async_function()
        self._initialized = True

    # Lazily initialize the manager only when needed
    @property
    def sandbox_config_manager(self):
        if self._sandbox_config_manager is None:
            self._sandbox_config_manager = SandboxConfigManager()
        return self._sandbox_config_manager

    @abstractmethod
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> ToolExecutionResult:
        """
        Run the tool in a sandbox environment asynchronously.
        Must be implemented by subclasses.
        """
        raise NotImplementedError

    @trace_method
    async def generate_execution_script(self, agent_state: Optional[AgentState], wrap_print_with_markers: bool = False) -> str:
        """
        Generate code to run inside of execution sandbox. Serialize the agent state and arguments, call the tool,
        then base64-encode/pickle the result. Constructs the python file.
        """
        await self._init_async()
        future_import = False
        schema_code = None

        if self.tool.args_json_schema:
            # Add schema code if available
            schema_code = add_imports_and_pydantic_schemas_for_args(self.tool.args_json_schema)
            if "from __future__ import annotations" in schema_code:
                schema_code = schema_code.replace("from __future__ import annotations", "").lstrip()
                future_import = True

            # Initialize arguments
            args_schema = generate_model_from_args_json_schema(self.tool.args_json_schema)
            tool_args = f"args_object = {args_schema.__name__}(**{self.args})\n"
            for param in self.args:
                tool_args += f"{param} = args_object.{param}\n"
        else:
            tool_args = ""
            for param in self.args:
                tool_args += self.initialize_param(param, self.args[param])

        agent_state_pickle = pickle.dumps(agent_state) if self.inject_agent_state else None
        agent_id = agent_state.id if agent_state else None

        code = self._render_sandbox_code(
            future_import=future_import,
            inject_agent_state=self.inject_agent_state,
            inject_letta_client=self.inject_letta_client,
            inject_agent_id=self.inject_agent_id,
            schema_imports=schema_code or "",
            agent_state_pickle=agent_state_pickle,
            agent_id=agent_id,
            tool_args=tool_args,
            tool_source_code=self.tool.source_code,
            local_sandbox_result_var_name=self.LOCAL_SANDBOX_RESULT_VAR_NAME,
            invoke_function_call=self.invoke_function_call(),
            wrap_print_with_markers=wrap_print_with_markers,
            start_marker=self.LOCAL_SANDBOX_RESULT_START_MARKER,
            use_top_level_await=self.use_top_level_await(),
        )
        return code

    def _render_sandbox_code(
        self,
        *,
        future_import: bool,
        inject_agent_state: bool,
        inject_letta_client: bool,
        inject_agent_id: bool,
        schema_imports: str,
        agent_state_pickle: bytes | None,
        agent_id: str | None,
        tool_args: str,
        tool_source_code: str,
        local_sandbox_result_var_name: str,
        invoke_function_call: str,
        wrap_print_with_markers: bool,
        start_marker: bytes,
        use_top_level_await: bool,
    ) -> str:
        lines: list[str] = []
        if future_import:
            lines.append("from __future__ import annotations")
        lines.extend(
            [
                "from typing import *",
                "import pickle",
                "import sys",
                "import base64",
                "import struct",
                "import hashlib",
            ]
        )
        if self.is_async_function:
            lines.append("import asyncio")

        if inject_agent_state:
            lines.extend(["import letta", "from letta import *"])  # noqa: F401

        # Import Letta client if needed
        if inject_letta_client:
            lines.append("from letta_client import Letta")

        if schema_imports:
            lines.append(schema_imports.rstrip())

        if agent_state_pickle is not None:
            lines.append(f"agent_state = pickle.loads({repr(agent_state_pickle)})")
        else:
            lines.append("agent_state = None")

        # Initialize Letta client if needed
        if inject_letta_client:
            from letta.settings import settings

            lines.extend(
                [
                    "# Initialize Letta client for tool execution",
                    "letta_client = Letta(",
                    f"    base_url={repr(settings.default_base_url)},",
                    f"    token={repr(settings.default_token)}",
                    ")",
                    "# Compatibility shim for client.agents.get",
                    "try:",
                    "    _agents = letta_client.agents",
                    "    if not hasattr(_agents, 'get') and hasattr(_agents, 'retrieve'):",
                    "        setattr(_agents, 'get', _agents.retrieve)",
                    "except Exception:",
                    "    pass",
                ]
            )

        # Set agent_id if needed
        if inject_agent_id:
            if agent_id:
                lines.append(f"agent_id = {repr(agent_id)}")
            else:
                lines.append("agent_id = None")

        if tool_args:
            lines.append(tool_args.rstrip())

        if tool_source_code:
            lines.append(tool_source_code.rstrip())

        if not self.is_async_function:
            # sync variant
            lines.append(f"_function_result = {invoke_function_call}")
            lines.extend(
                [
                    "try:",
                    "    from pydantic import BaseModel, ConfigDict",
                    "    from typing import Any",
                    "",
                    "    class _TempResultWrapper(BaseModel):",
                    "        model_config = ConfigDict(arbitrary_types_allowed=True)",
                    "        result: Any",
                    "",
                    "    _wrapped = _TempResultWrapper(result=_function_result)",
                    "    _serialized_result = _wrapped.model_dump()['result']",
                    "except ImportError:",
                    '    print("Pydantic not available in sandbox environment, falling back to string conversion")',
                    "    _serialized_result = str(_function_result)",
                    "except Exception as e:",
                    '    print(f"Failed to serialize result with Pydantic wrapper: {e}")',
                    "    _serialized_result = str(_function_result)",
                    "",
                    f"{local_sandbox_result_var_name} = {{",
                    '    "results": _serialized_result,',
                    '    "agent_state": agent_state',
                    "}",
                    f"{local_sandbox_result_var_name}_pkl = pickle.dumps({local_sandbox_result_var_name})",
                ]
            )
        else:
            # async variant
            lines.extend(
                [
                    "async def _async_wrapper():",
                    f"    _function_result = await {invoke_function_call}",
                    "    try:",
                    "        from pydantic import BaseModel, ConfigDict",
                    "        from typing import Any",
                    "",
                    "        class _TempResultWrapper(BaseModel):",
                    "            model_config = ConfigDict(arbitrary_types_allowed=True)",
                    "            result: Any",
                    "",
                    "        _wrapped = _TempResultWrapper(result=_function_result)",
                    "        _serialized_result = _wrapped.model_dump()['result']",
                    "    except ImportError:",
                    '        print("Pydantic not available in sandbox environment, falling back to string conversion")',
                    "        _serialized_result = str(_function_result)",
                    "    except Exception as e:",
                    '        print(f"Failed to serialize result with Pydantic wrapper: {e}")',
                    "        _serialized_result = str(_function_result)",
                    "",
                    "    return {",
                    '        "results": _serialized_result,',
                    '        "agent_state": agent_state',
                    "    }",
                ]
            )
            if use_top_level_await:
                lines.append(f"{local_sandbox_result_var_name} = await _async_wrapper()")
            else:
                lines.append(f"{local_sandbox_result_var_name} = asyncio.run(_async_wrapper())")
            lines.append(f"{local_sandbox_result_var_name}_pkl = pickle.dumps({local_sandbox_result_var_name})")

        if wrap_print_with_markers:
            lines.extend(
                [
                    f"data_checksum = hashlib.md5({local_sandbox_result_var_name}_pkl).hexdigest().encode('ascii')",
                    f"{local_sandbox_result_var_name}_msg = (",
                    f"  {repr(start_marker)} +",
                    f"  struct.pack('>I', len({local_sandbox_result_var_name}_pkl)) +",
                    "  data_checksum +",
                    f"  {local_sandbox_result_var_name}_pkl",
                    ")",
                    f"sys.stdout.buffer.write({local_sandbox_result_var_name}_msg)",
                    "sys.stdout.buffer.flush()",
                ]
            )
        else:
            lines.append(f"base64.b64encode({local_sandbox_result_var_name}_pkl).decode('utf-8')")

        return "\n".join(lines) + "\n"

    def initialize_param(self, name: str, raw_value: JsonValue) -> str:
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

        value = convert_param_to_str_value(param_type, raw_value)
        return f"{name} = {value}\n"

    def invoke_function_call(self) -> str:
        """
        Generate the function call code string with the appropriate arguments.
        """
        kwargs = []
        for name in self.args:
            if name in self.tool.json_schema["parameters"]["properties"]:
                kwargs.append(name)

        param_list = [f"{arg}={arg}" for arg in kwargs]

        # Add reserved keyword arguments
        if self.inject_agent_state:
            param_list.append("agent_state=agent_state")

        if self.inject_letta_client:
            # Check if the function expects 'client' or 'letta_client'
            tool_arguments = parse_function_arguments(self.tool.source_code, self.tool.name)
            if "client" in tool_arguments:
                param_list.append("client=letta_client")
            elif "letta_client" in tool_arguments:
                param_list.append("letta_client=letta_client")

        if self.inject_agent_id:
            param_list.append("agent_id=agent_id")

        params = ", ".join(param_list)
        func_call_str = self.tool.name + "(" + params + ")"
        return func_call_str

    def _detect_async_function(self) -> bool:
        """
        Detect if the tool function is an async function by examining its source code.
        Uses AST parsing to reliably detect 'async def' declarations.
        """
        import ast

        try:
            tree = ast.parse(self.tool.source_code)

            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef) and node.name == self.tool.name:
                    return True
            return False
        except:
            return False

    def use_top_level_await(self) -> bool:
        """
        Determine if this sandbox environment supports top-level await.
        Should be overridden by subclasses to return True for environments
        with running event loops (like E2B), False for local execution.
        """
        return False  # Default to False for local execution

    async def _gather_env_vars(self, agent_state: AgentState | None, additional_env_vars: dict[str, str], sbx_id: str, is_local: bool):
        env = os.environ.copy() if is_local else {}
        if self.provided_sandbox_env_vars:
            env.update(self.provided_sandbox_env_vars)
        else:
            env_vars = await self.sandbox_config_manager.get_sandbox_env_vars_as_dict_async(
                sandbox_config_id=sbx_id, actor=self.user, limit=None
            )
            env.update(env_vars)

        if agent_state:
            env.update(agent_state.get_agent_env_vars_as_dict())

        if additional_env_vars:
            env.update(additional_env_vars)

        return env
