from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple, Type

from letta.constants import COMPOSIO_ENTITY_ENV_VAR_KEY, LETTA_CORE_TOOL_MODULE_NAME, LETTA_MULTI_AGENT_TOOL_MODULE_NAME
from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source
from letta.functions.functions import get_function_from_module
from letta.functions.helpers import execute_composio_action, generate_composio_action_from_func_name
from letta.functions.mcp_client.base_client import BaseMCPClient
from letta.helpers.composio_helpers import get_composio_api_key
from letta.orm.enums import ToolType
from letta.schemas.sandbox_config import SandboxRunResult
from letta.schemas.tool import Tool
from letta.services.tool_execution_sandbox import ToolExecutionSandbox
from letta.utils import get_friendly_error_msg


class ToolExecutor(ABC):
    """Abstract base class for tool executors."""

    @abstractmethod
    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        """Execute the tool and return the result."""


class LettaCoreToolExecutor(ToolExecutor):
    """Executor for LETTA core tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        callable_func = get_function_from_module(LETTA_CORE_TOOL_MODULE_NAME, function_name)
        function_args["self"] = agent  # need to attach self to arg since it's dynamically linked
        function_response = callable_func(**function_args)
        return function_response, None


class LettaMultiAgentToolExecutor(ToolExecutor):
    """Executor for LETTA multi-agent core tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        callable_func = get_function_from_module(LETTA_MULTI_AGENT_TOOL_MODULE_NAME, function_name)
        function_args["self"] = agent  # need to attach self to arg since it's dynamically linked
        function_response = callable_func(**function_args)
        return function_response, None


class LettaMemoryToolExecutor(ToolExecutor):
    """Executor for LETTA memory core tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        callable_func = get_function_from_module(LETTA_CORE_TOOL_MODULE_NAME, function_name)
        agent_state_copy = agent.agent_state.__deepcopy__()
        function_args["agent_state"] = agent_state_copy
        function_response = callable_func(**function_args)
        agent.update_memory_if_changed(agent_state_copy.memory)
        return function_response, None


class ExternalComposioToolExecutor(ToolExecutor):
    """Executor for external Composio tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        action_name = generate_composio_action_from_func_name(tool.name)

        # Get entity ID from the agent_state
        entity_id = self._get_entity_id(agent)

        # Get composio_api_key
        composio_api_key = get_composio_api_key(actor=agent.user, logger=agent.logger)

        # TODO (matt): Roll in execute_composio_action into this class
        function_response = execute_composio_action(
            action_name=action_name, args=function_args, api_key=composio_api_key, entity_id=entity_id
        )

        return function_response, None

    def _get_entity_id(self, agent: "Agent") -> Optional[str]:
        """Extract the entity ID from environment variables."""
        for env_var in agent.agent_state.tool_exec_environment_variables:
            if env_var.key == COMPOSIO_ENTITY_ENV_VAR_KEY:
                return env_var.value
        return None


class ExternalMCPToolExecutor(ToolExecutor):
    """Executor for external MCP tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        # Get the server name from the tool tag
        server_name = self._extract_server_name(tool)

        # Get the MCPClient
        mcp_client = self._get_mcp_client(agent, server_name)

        # Validate tool exists
        self._validate_tool_exists(mcp_client, function_name, server_name)

        # Execute the tool
        function_response, is_error = mcp_client.execute_tool(tool_name=function_name, tool_args=function_args)

        sandbox_run_result = SandboxRunResult(status="error" if is_error else "success")
        return function_response, sandbox_run_result

    def _extract_server_name(self, tool: Tool) -> str:
        """Extract server name from tool tags."""
        return tool.tags[0].split(":")[1]

    def _get_mcp_client(self, agent: "Agent", server_name: str):
        """Get the MCP client for the given server name."""
        if not agent.mcp_clients:
            raise ValueError("No MCP client available to use")

        if server_name not in agent.mcp_clients:
            raise ValueError(f"Unknown MCP server name: {server_name}")

        mcp_client = agent.mcp_clients[server_name]
        if not isinstance(mcp_client, BaseMCPClient):
            raise RuntimeError(f"Expected an MCPClient, but got: {type(mcp_client)}")

        return mcp_client

    def _validate_tool_exists(self, mcp_client, function_name: str, server_name: str):
        """Validate that the tool exists in the MCP server."""
        available_tools = mcp_client.list_tools()
        available_tool_names = [t.name for t in available_tools]

        if function_name not in available_tool_names:
            raise ValueError(
                f"{function_name} is not available in MCP server {server_name}. " f"Please check your `~/.letta/mcp_config.json` file."
            )


class SandboxToolExecutor(ToolExecutor):
    """Executor for sandboxed tools."""

    def execute(self, function_name: str, function_args: dict, agent: "Agent", tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        # Store original memory state
        orig_memory_str = agent.agent_state.memory.compile()

        try:
            # Prepare function arguments
            function_args = self._prepare_function_args(function_args, tool, function_name)

            # Create agent state copy for sandbox
            agent_state_copy = self._create_agent_state_copy(agent)

            # Execute in sandbox
            sandbox_run_result = ToolExecutionSandbox(function_name, function_args, agent.user, tool_object=tool).run(
                agent_state=agent_state_copy
            )

            function_response, updated_agent_state = sandbox_run_result.func_return, sandbox_run_result.agent_state

            # Verify memory integrity
            assert orig_memory_str == agent.agent_state.memory.compile(), "Memory should not be modified in a sandbox tool"

            # Update agent memory if needed
            if updated_agent_state is not None:
                agent.update_memory_if_changed(updated_agent_state.memory)

            return function_response, sandbox_run_result

        except Exception as e:
            return self._handle_execution_error(e, function_name)

    def _prepare_function_args(self, function_args: dict, tool: Tool, function_name: str) -> dict:
        """Prepare function arguments with proper type coercion."""
        try:
            # Parse the source code to extract function annotations
            annotations = get_function_annotations_from_source(tool.source_code, function_name)
            # Coerce the function arguments to the correct types based on the annotations
            return coerce_dict_args_by_annotations(function_args, annotations)
        except ValueError:
            # Just log the error and continue with original args
            # This is defensive programming - we try to coerce but fall back if it fails
            return function_args

    def _create_agent_state_copy(self, agent: "Agent"):
        """Create a copy of agent state for sandbox execution."""
        agent_state_copy = agent.agent_state.__deepcopy__()
        # Remove tools from copy to prevent nested tool execution
        agent_state_copy.tools = []
        agent_state_copy.tool_rules = []
        return agent_state_copy

    def _handle_execution_error(self, exception: Exception, function_name: str) -> Tuple[str, SandboxRunResult]:
        """Handle tool execution errors."""
        error_message = get_friendly_error_msg(
            function_name=function_name, exception_name=type(exception).__name__, exception_message=str(exception)
        )
        return error_message, SandboxRunResult(status="error")


class ToolExecutorFactory:
    """Factory for creating appropriate tool executors based on tool type."""

    _executor_map: Dict[ToolType, Type[ToolExecutor]] = {
        ToolType.LETTA_CORE: LettaCoreToolExecutor,
        ToolType.LETTA_MULTI_AGENT_CORE: LettaMultiAgentToolExecutor,
        ToolType.LETTA_MEMORY_CORE: LettaMemoryToolExecutor,
        ToolType.EXTERNAL_COMPOSIO: ExternalComposioToolExecutor,
        ToolType.EXTERNAL_MCP: ExternalMCPToolExecutor,
    }

    @classmethod
    def get_executor(cls, tool_type: ToolType) -> ToolExecutor:
        """Get the appropriate executor for the given tool type."""
        executor_class = cls._executor_map.get(tool_type)

        if executor_class:
            return executor_class()

        # Default to sandbox executor for unknown types
        return SandboxToolExecutor()


class ToolExecutionManager:
    """Manager class for tool execution operations."""

    def __init__(self, agent: "Agent"):
        self.agent = agent
        self.logger = agent.logger

    def execute_tool(self, function_name: str, function_args: dict, tool: Tool) -> Tuple[Any, Optional[SandboxRunResult]]:
        """
        Execute a tool and persist any state changes.

        Args:
            function_name: Name of the function to execute
            function_args: Arguments to pass to the function
            tool: Tool object containing metadata about the tool

        Returns:
            Tuple containing the function response and sandbox run result (if applicable)
        """
        try:
            # Get the appropriate executor for this tool type
            executor = ToolExecutorFactory.get_executor(tool.tool_type)

            # Execute the tool
            return executor.execute(function_name, function_args, self.agent, tool)

        except Exception as e:
            self.logger.error(f"Error executing tool {function_name}: {str(e)}")
            error_message = get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))
            return error_message, SandboxRunResult(status="error")
