"""Modal function executor for tool sandbox v2.

This module contains the executor function that runs inside Modal containers
to execute tool functions with dynamically passed arguments.
"""

import faulthandler
import signal
from typing import Any, Dict

import modal

# List of safe modules that can be imported in schema code
SAFE_IMPORT_MODULES = {
    "typing",
    "datetime",
    "uuid",
    "enum",
    "decimal",
    "collections",
    "abc",
    "dataclasses",
    "pydantic",
    "typing_extensions",
}


class ModalFunctionExecutor:
    """Executes tool functions in Modal with dynamic argument passing."""

    @staticmethod
    def execute_tool_dynamic(
        tool_source: str,
        tool_name: str,
        args_pickled: bytes,
        agent_state_pickled: bytes | None,
        inject_agent_state: bool,
        is_async: bool,
        args_schema_code: str | None,
    ) -> dict[str, Any]:
        """Execute a tool function with dynamically passed arguments.

        This function runs inside the Modal container and receives all parameters
        at runtime rather than having them embedded in a script.
        """
        import asyncio
        import pickle
        import sys
        import traceback
        from io import StringIO

        # Enable fault handler for better debugging of segfaults
        faulthandler.enable()

        stdout_capture = StringIO()
        stderr_capture = StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr

        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            # Safely unpickle arguments with size validation
            if not args_pickled:
                raise ValueError("No arguments provided")

            if len(args_pickled) > 10 * 1024 * 1024:  # 10MB limit
                raise ValueError(f"Pickled args too large: {len(args_pickled)} bytes")

            try:
                args = pickle.loads(args_pickled)
            except Exception as e:
                raise ValueError(f"Failed to unpickle arguments: {e}")

            agent_state = None
            if agent_state_pickled:
                if len(agent_state_pickled) > 10 * 1024 * 1024:  # 10MB limit
                    raise ValueError(f"Pickled agent state too large: {len(agent_state_pickled)} bytes")
                try:
                    agent_state = pickle.loads(agent_state_pickled)
                except Exception as e:
                    # Log but don't fail - agent state is optional
                    print(f"Warning: Failed to unpickle agent state: {e}", file=sys.stderr)
                    agent_state = None

            exec_globals = {
                "__name__": "__main__",
                "__builtins__": __builtins__,
            }

            if args_schema_code:
                import ast

                try:
                    tree = ast.parse(args_schema_code)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                module_name = alias.name.split(".")[0]
                                if module_name not in SAFE_IMPORT_MODULES:
                                    raise ValueError(f"Import of '{module_name}' not allowed in schema code")
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                module_name = node.module.split(".")[0]
                                if module_name not in SAFE_IMPORT_MODULES:
                                    raise ValueError(f"Import from '{module_name}' not allowed in schema code")

                    exec(compile(tree, "<schema>", "exec"), exec_globals)
                except (SyntaxError, ValueError) as e:
                    raise ValueError(f"Invalid or unsafe schema code: {e}")

            exec(tool_source, exec_globals)

            if tool_name not in exec_globals:
                raise ValueError(f"Function '{tool_name}' not found in tool source code")

            func = exec_globals[tool_name]

            kwargs = dict(args)
            if inject_agent_state:
                kwargs["agent_state"] = agent_state

            if is_async:
                result = asyncio.run(func(**kwargs))
            else:
                result = func(**kwargs)

            try:
                from pydantic import BaseModel, ConfigDict

                class _TempResultWrapper(BaseModel):
                    model_config = ConfigDict(arbitrary_types_allowed=True)
                    result: Any

                wrapped = _TempResultWrapper(result=result)
                serialized_result = wrapped.model_dump()["result"]
            except (ImportError, Exception):
                serialized_result = str(result)

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


def setup_signal_handlers():
    """Setup signal handlers for better debugging."""

    def handle_segfault(signum, frame):
        import sys
        import traceback

        print(f"SEGFAULT detected! Signal: {signum}", file=sys.stderr)
        print("Stack trace:", file=sys.stderr)
        traceback.print_stack(frame, file=sys.stderr)
        sys.exit(139)  # Standard segfault exit code

    def handle_abort(signum, frame):
        import sys
        import traceback

        print(f"ABORT detected! Signal: {signum}", file=sys.stderr)
        print("Stack trace:", file=sys.stderr)
        traceback.print_stack(frame, file=sys.stderr)
        sys.exit(134)  # Standard abort exit code

    # Register signal handlers
    signal.signal(signal.SIGSEGV, handle_segfault)
    signal.signal(signal.SIGABRT, handle_abort)

    @modal.method()
    def execute_tool_wrapper(
        self,
        tool_source: str,
        tool_name: str,
        args_pickled: bytes,
        agent_state_pickled: bytes | None,
        inject_agent_state: bool,
        is_async: bool,
        args_schema_code: str | None,
        environment_vars: Dict[str, str],
    ) -> Dict[str, Any]:
        """Wrapper function that runs in Modal container with enhanced error handling."""
        import os
        import resource
        import sys

        # Setup signal handlers for better crash debugging
        setup_signal_handlers()

        # Enable fault handler with file output
        try:
            faulthandler.enable(file=sys.stderr, all_threads=True)
        except:
            pass  # Faulthandler might not be available

        # Set resource limits to prevent runaway processes
        try:
            # Limit memory usage to 1GB
            resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
            # Limit stack size to 8MB (default is often unlimited)
            resource.setrlimit(resource.RLIMIT_STACK, (8 * 1024 * 1024, 8 * 1024 * 1024))
        except:
            pass  # Resource limits might not be available

        # Set environment variables
        for key, value in environment_vars.items():
            os.environ[key] = str(value)

        # Add debugging environment variables
        os.environ["PYTHONFAULTHANDLER"] = "1"
        os.environ["PYTHONDEVMODE"] = "1"

        try:
            # Execute the tool
            return ModalFunctionExecutor.execute_tool_dynamic(
                tool_source=tool_source,
                tool_name=tool_name,
                args_pickled=args_pickled,
                agent_state_pickled=agent_state_pickled,
                inject_agent_state=inject_agent_state,
                is_async=is_async,
                args_schema_code=args_schema_code,
            )
        except Exception as e:
            import traceback

            # Enhanced error reporting
            return {
                "result": None,
                "agent_state": None,
                "stdout": "",
                "stderr": f"Container execution failed: {traceback.format_exc()}",
                "error": {
                    "name": type(e).__name__,
                    "value": str(e),
                    "traceback": traceback.format_exc(),
                },
            }
