import ast
import base64
import pickle
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple

from letta.functions.helpers import generate_model_from_args_json_schema
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxRunResult
from letta.services.helpers.tool_execution_helper import add_imports_and_pydantic_schemas_for_args
from letta.services.organization_manager import OrganizationManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_manager import ToolManager


class AsyncToolSandboxBase(ABC):
    NAMESPACE = uuid.NAMESPACE_DNS
    LOCAL_SANDBOX_RESULT_START_MARKER = str(uuid.uuid5(NAMESPACE, "local-sandbox-result-start-marker"))
    LOCAL_SANDBOX_RESULT_END_MARKER = str(uuid.uuid5(NAMESPACE, "local-sandbox-result-end-marker"))
    LOCAL_SANDBOX_RESULT_VAR_NAME = "result_ZQqiequkcFwRwwGQMqkt"

    def __init__(self, tool_name: str, args: dict, user, tool_object=None):
        self.tool_name = tool_name
        self.args = args
        self.user = user
        self.organization = OrganizationManager().get_organization_by_id(self.user.organization_id)
        self.privileged_tools = self.organization.privileged_tools

        self.tool = tool_object or ToolManager().get_tool_by_name(tool_name=tool_name, actor=self.user)
        if self.tool is None:
            raise ValueError(
                f"Agent attempted to invoke tool {self.tool_name} that does not exist for organization {self.user.organization_id}"
            )

        self.sandbox_config_manager = SandboxConfigManager()

        # See if we should inject agent_state or not based on the presence of the "agent_state" arg
        if "agent_state" in self.parse_function_arguments(self.tool.source_code, self.tool.name):
            self.inject_agent_state = True
        else:
            self.inject_agent_state = False

    @abstractmethod
    async def run(
        self,
        agent_state: Optional[AgentState] = None,
        additional_env_vars: Optional[Dict] = None,
    ) -> SandboxRunResult:
        """
        Run the tool in a sandbox environment asynchronously.
        Must be implemented by subclasses.
        """
        raise NotImplementedError

    def generate_execution_script(self, agent_state: Optional[AgentState], wrap_print_with_markers: bool = False) -> str:
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
        if self.inject_agent_state:
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
        if self.inject_agent_state:
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
            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME}" + ' = {"results": ' + self.invoke_function_call() + ', "agent_state": agent_state}\n'
        )
        code += (
            f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME} = base64.b64encode("
            f"pickle.dumps({self.LOCAL_SANDBOX_RESULT_VAR_NAME})"
            ").decode('utf-8')\n"
        )

        if wrap_print_with_markers:
            code += f"sys.stdout.write('{self.LOCAL_SANDBOX_RESULT_START_MARKER}')\n"
            code += f"sys.stdout.write(str({self.LOCAL_SANDBOX_RESULT_VAR_NAME}))\n"
            code += f"sys.stdout.write('{self.LOCAL_SANDBOX_RESULT_END_MARKER}')\n"
        else:
            code += f"{self.LOCAL_SANDBOX_RESULT_VAR_NAME}\n"

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

    def parse_best_effort(self, text: str) -> Tuple[Any, Optional[AgentState]]:
        """
        Decode and unpickle the result from the function execution if possible.
        Returns (function_return_value, agent_state).
        """
        if not text:
            return None, None

        result = pickle.loads(base64.b64decode(text))
        agent_state = result["agent_state"]
        return result["results"], agent_state

    def parse_function_arguments(self, source_code: str, tool_name: str):
        """Get arguments of a function from its source code"""
        tree = ast.parse(source_code)
        args = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == tool_name:
                for arg in node.args.args:
                    args.append(arg.arg)
        return args
