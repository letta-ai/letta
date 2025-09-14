"""
Execution client for Modal V3 sandbox.
Handles runtime execution of deployed Modal functions.
"""

import asyncio
from typing import Any, Optional

import modal

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.services.tool_sandbox.modal.serializer import SerializationError, safe_pickle, serialize_arguments
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class FunctionExecutor:
    """
    Executes functions deployed on Modal.
    Handles argument serialization and result processing.
    """

    def __init__(self, app: modal.App, tool_name: str, use_persistent_server: bool = True):
        """
        Initialize the executor.
        Args:
            app: Deployed Modal app
            tool_name: Name of the tool function
            use_persistent_server: Whether app uses persistent server
        """
        self.app = app
        self.tool_name = tool_name
        self.use_persistent_server = use_persistent_server

    async def execute(
        self,
        args: dict[str, Any],
        agent_state: Optional[AgentState] = None,
        environment_vars: Optional[dict[str, str]] = None,
        inject_agent_state: bool = False,
        timeout: Optional[int] = None,
    ) -> ToolExecutionResult:
        """
        Execute the function with provided arguments.
        Args:
            args: Function arguments
            agent_state: Optional agent state
            environment_vars: Environment variables
            inject_agent_state: Whether to inject agent state
            timeout: Execution timeout in seconds
        Returns:
            Tool execution result
        """
        # Serialize arguments
        try:
            args_pickled = serialize_arguments(args)
        except Exception as e:
            logger.error(f"Failed to serialize arguments: {e}")
            return self._create_error_result("SerializationError", f"Failed to serialize arguments: {e}")

        # Serialize agent state if provided
        agent_state_pickled = None
        if inject_agent_state and agent_state:
            try:
                agent_state_pickled = safe_pickle(agent_state)
            except SerializationError as e:
                logger.warning(f"Failed to serialize agent state: {e}")
                # Continue without agent state rather than failing
                inject_agent_state = False

        # Execute on Modal
        try:
            result = await self._execute_remote(args_pickled, agent_state_pickled, environment_vars or {}, timeout)

            return self._process_result(result)

        except asyncio.TimeoutError:
            logger.error(f"Execution timeout for tool {self.tool_name}")
            return self._create_error_result("TimeoutError", f"Function execution timed out after {timeout} seconds")
        except Exception as e:
            logger.error(f"Execution failed for tool {self.tool_name}: {e}")
            return self._create_error_result(type(e).__name__, str(e))

    async def _execute_remote(
        self,
        args_pickled: bytes,
        agent_state_pickled: Optional[bytes],
        environment_vars: dict[str, str],
        timeout: Optional[int],
    ) -> dict[str, Any]:
        """
        Execute the function remotely on Modal.
        Args:
            args_pickled: Serialized arguments
            agent_state_pickled: Serialized agent state
            environment_vars: Environment variables
            timeout: Execution timeout
        Returns:
            Execution result from Modal
        """
        if self.use_persistent_server:
            # Execute via persistent server
            return await self._execute_with_server(args_pickled, agent_state_pickled, timeout)
        else:
            # Execute via standalone function
            return await self._execute_standalone(args_pickled, agent_state_pickled, environment_vars, timeout)

    async def _execute_with_server(
        self,
        args_pickled: bytes,
        agent_state_pickled: Optional[bytes],
        timeout: Optional[int],
    ) -> dict[str, Any]:
        """
        Execute via persistent function server.
        Args:
            args_pickled: Serialized arguments
            agent_state_pickled: Serialized agent state
            timeout: Execution timeout
        Returns:
            Execution result
        """
        # Get the FunctionServer class from Modal
        # Use string literal for the class name
        function_server_cls = modal.Cls.from_name(self.app.name, "FunctionServer")

        # Create an instance of the class
        function_server = function_server_cls()

        # Execute with optional timeout
        if timeout:
            result = await asyncio.wait_for(
                function_server.execute.remote.aio(args_pickled, agent_state_pickled),
                timeout=timeout,
            )
        else:
            result = await function_server.execute.remote.aio(args_pickled, agent_state_pickled)

        return result

    async def _execute_standalone(
        self,
        args_pickled: bytes,
        agent_state_pickled: Optional[bytes],
        environment_vars: dict[str, str],
        timeout: Optional[int],
    ) -> dict[str, Any]:
        """
        Execute via standalone function.
        Args:
            args_pickled: Serialized arguments
            agent_state_pickled: Serialized agent state
            environment_vars: Environment variables
            timeout: Execution timeout
        Returns:
            Execution result
        """
        # Get the function from registered functions
        logger.debug(f"Looking for function in app {self.app.name}")
        logger.debug(f"Registered functions: {list(self.app.registered_functions.keys())}")

        # The function is registered as "execute_tool" explicitly
        if "execute_tool" in self.app.registered_functions:
            execute_tool = self.app.registered_functions["execute_tool"]
            logger.debug("Found execute_tool function")
        else:
            # Fallback to looking it up by convention
            func_names = list(self.app.registered_functions.keys())
            if func_names:
                logger.warning(f"execute_tool not found, using first function: {func_names[0]}")
                execute_tool = self.app.registered_functions[func_names[0]]
            else:
                raise ValueError(f"No functions found in deployed app {self.app.name}")

        # Execute via the standalone function
        logger.debug(f"Calling remote function with timeout={timeout}")
        logger.debug(f"Args size: {len(args_pickled)} bytes")
        logger.debug(f"Agent state: {'present' if agent_state_pickled else 'none'}")
        logger.debug(f"Env vars: {len(environment_vars)} variables")

        try:
            if timeout:
                result = await asyncio.wait_for(
                    execute_tool.remote.aio(args_pickled, agent_state_pickled, environment_vars),
                    timeout=timeout,
                )
            else:
                result = await execute_tool.remote.aio(args_pickled, agent_state_pickled, environment_vars)
        except Exception as e:
            logger.error(f"Error calling remote function: {e}")
            raise

        return result

    def _process_result(self, result: dict[str, Any]) -> ToolExecutionResult:
        """
        Process the execution result from Modal.
        Args:
            result: Raw result from Modal
        Returns:
            Processed tool execution result
        """
        if result.get("error"):
            # Handle execution error
            error = result["error"]
            logger.debug(f"Tool {self.tool_name} raised {error['name']}: {error['value']}")

            func_return = get_friendly_error_msg(
                function_name=self.tool_name,
                exception_name=error["name"],
                exception_message=error["value"],
            )

            return ToolExecutionResult(
                func_return=func_return,
                agent_state=None,
                stdout=[result.get("stdout", "")] if result.get("stdout") else [],
                stderr=[result.get("stderr", "")] if result.get("stderr") else [],
                status="error",
            )
        else:
            # Successful execution
            return ToolExecutionResult(
                func_return=result.get("result"),
                agent_state=result.get("agent_state"),
                stdout=[result.get("stdout", "")] if result.get("stdout") else [],
                stderr=[result.get("stderr", "")] if result.get("stderr") else [],
                status="success",
            )

    def _create_error_result(self, error_name: str, error_message: str) -> ToolExecutionResult:
        """
        Create an error result.
        Args:
            error_name: Name of the error
            error_message: Error message
        Returns:
            Error tool execution result
        """
        func_return = get_friendly_error_msg(
            function_name=self.tool_name,
            exception_name=error_name,
            exception_message=error_message,
        )

        return ToolExecutionResult(
            func_return=func_return,
            agent_state=None,
            stdout=[],
            stderr=[f"{error_name}: {error_message}"],
            status="error",
        )
