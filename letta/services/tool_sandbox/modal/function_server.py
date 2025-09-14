"""
Function server that runs inside Modal containers.
This server loads the tool function once and executes it with different arguments.
Similar to the NodeShimServer pattern but for Python functions.
"""

import asyncio
import sys
import traceback
from io import StringIO
from typing import Any

import modal


class FunctionServer:
    """
    Persistent function server that runs in Modal.
    Loads the tool function once on startup and executes with different arguments.
    """

    def __init__(self):
        """Initialize instance attributes."""
        self.func = None
        self.func_name = None
        self.is_async = False
        self.inject_agent_state = False

    @modal.enter()
    def load_function(self):
        """
        Load the tool function on container startup.
        This is called once when the container starts, not on every execution.
        """
        import sys

        # Import from the pre-generated file
        # Note: /app is the standard Modal container path for application code
        sys.path.insert(0, "/app")
        from tool_function_loader import get_function_metadata, tool_function

        metadata = get_function_metadata()
        self.func_name = metadata["name"]
        self.is_async = metadata["is_async"]
        self.inject_agent_state = metadata["inject_agent_state"]
        self.func = tool_function

        print(f"✅ Loaded function '{self.func_name}' from file (async={self.is_async})")

    @modal.method()
    def execute(self, args_pickled: bytes, agent_state_pickled: bytes | None = None) -> dict[str, Any]:
        """
        Execute the loaded function with provided arguments.
        Args:
            args_pickled: Pickled function arguments
            agent_state_pickled: Optional pickled agent state
        Returns:
            Execution result dictionary
        """
        import faulthandler
        import pickle

        # Enable fault handler for debugging
        faulthandler.enable()

        # Capture stdout/stderr
        stdout_capture = StringIO()
        stderr_capture = StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr

        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            # Unpickle arguments
            args = pickle.loads(args_pickled)

            # Unpickle agent state if provided
            agent_state = None
            if agent_state_pickled:
                try:
                    agent_state = pickle.loads(agent_state_pickled)
                except Exception as e:
                    print(f"Warning: Failed to unpickle agent state: {e}", file=sys.stderr)

            # Prepare kwargs
            kwargs = dict(args)
            if self.inject_agent_state and agent_state is not None:
                kwargs["agent_state"] = agent_state

            # Execute the function
            if self.is_async:
                result = asyncio.run(self.func(**kwargs))
            else:
                result = self.func(**kwargs)

            # Serialize the result
            from letta.services.tool_sandbox.modal.serializer import serialize_result

            serialized_result = serialize_result(result)

            return {
                "result": serialized_result,
                "agent_state": agent_state,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "error": None,
            }

        except Exception as e:
            return {
                "result": None,
                "agent_state": None,
                "stdout": stdout_capture.getvalue(),
                "stderr": stderr_capture.getvalue(),
                "error": {
                    "name": type(e).__name__,
                    "value": str(e),
                    "traceback": traceback.format_exc(),
                },
            }
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    @modal.exit()
    def cleanup(self):
        """Clean up resources on container shutdown."""
        print(f"🔚 Shutting down function server for '{self.func_name}'")
