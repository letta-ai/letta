import os
import pickle
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from letta.functions.helpers import generate_model_from_args_json_schema
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

        self.tool = tool_object or ToolManager().get_tool_by_name(tool_name=tool_name, actor=self.user)
        if self.tool is None:
            raise ValueError(
                f"Agent attempted to invoke tool {self.tool_name} that does not exist for organization {self.user.organization_id}"
            )

        # Store provided values or create manager to fetch them later
        self.provided_sandbox_config = sandbox_config
        self.provided_sandbox_env_vars = sandbox_env_vars

        # Only create the manager if we need to (lazy initialization)
        self._sandbox_config_manager = None

        # See if we should inject agent_state or not based on the presence of the "agent_state" arg
        if "agent_state" in parse_function_arguments(self.tool.source_code, self.tool.name):
            self.inject_agent_state = True
        else:
            self.inject_agent_state = False

        # Detect if the tool function is async
        self.is_async_function = self._detect_async_function()

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

    async def generate_execution_script(self, agent_state: Optional[AgentState], wrap_print_with_markers: bool = False) -> str:
        """
        Generate code to run inside of execution sandbox. Serialize the agent state and arguments, call the tool,
        then base64-encode/pickle the result. Runs a jinja2 template constructing the python file.
        """
        from letta.templates.template_helper import render_template_async

        # Select the appropriate template based on whether the function is async
        TEMPLATE_NAME = "sandbox_code_file_async.py.j2" if self.is_async_function else "sandbox_code_file.py.j2"

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

        return await render_template_async(
            TEMPLATE_NAME,
            future_import=future_import,
            inject_agent_state=self.inject_agent_state,
            schema_imports=schema_code,
            agent_state_pickle=agent_state_pickle,
            tool_args=tool_args,
            tool_source_code=self.tool.source_code,
            local_sandbox_result_var_name=self.LOCAL_SANDBOX_RESULT_VAR_NAME,
            invoke_function_call=self.invoke_function_call(),
            wrap_print_with_markers=wrap_print_with_markers,
            start_marker=self.LOCAL_SANDBOX_RESULT_START_MARKER,
            use_top_level_await=self.use_top_level_await(),
        )

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
        if self.inject_agent_state:
            param_list.append("agent_state=agent_state")

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
            # Parse the source code to AST
            tree = ast.parse(self.tool.source_code)

            # Look for function definitions
            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef) and node.name == self.tool.name:
                    return True
                elif isinstance(node, ast.FunctionDef) and node.name == self.tool.name:
                    return False

            # If we couldn't find the function definition, fall back to string matching
            return "async def " + self.tool.name in self.tool.source_code

        except SyntaxError:
            # If source code can't be parsed, fall back to string matching
            return "async def " + self.tool.name in self.tool.source_code

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
