#!/usr/bin/env python3
"""
Minimal test to debug Modal function execution.
"""

import asyncio
import contextlib
import io
import os
import pickle
import sys
from typing import Optional

import modal
from letta_client import Letta

app = modal.App("test-simple-modal3")

code_str = """
def helper_function(x):
    return x + 1
def
def my_tool(x):
    import os
    print(os.environ["TEST_VAR"])
    #raise Exception("test")
    return helper_function(x)
"""


@app.function(
    image=modal.Image.debian_slim(python_version="3.13").pip_install("letta_client"),
    restrict_modal_access=True,  # untrusted
    timeout=10,
)
def modal_tool_wrapper(tool_name: str, agent_id: str, env_vars: dict, letta_api_key: Optional[str] = None, **kwargs):
    """Wrapper function for modal tools."""
    import os

    stdout = None
    stderr = None
    result = None

    if letta_api_key:
        client = Letta(token=letta_api_key)

    # initialize the agent code
    try:
        exec(code_str)
    except Exception as e:
        return {"result": None, "stdout": None, "stderr": f"Failed to initialize tool code: {str(e)}", "error": True}

    # set environment variables
    for key, value in env_vars.items():
        os.environ[key] = value
    print(os.environ)

    # call the tool (capture stdout and stderr)
    print(globals())
    tool = globals()[tool_name]

    # Capture stdout and stderr during tool execution
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
        result = tool(**kwargs)

    # Get captured output
    stdout = stdout_capture.getvalue()
    stderr = stderr_capture.getvalue()

    return {
        "result": result,
        "stdout": stdout,
        "stderr": stderr,
        "error": True if stderr else False,
    }


async def test():
    """Test the simple Modal function."""
    print("Deploying app...")
    await app.deploy.aio()

    print("App deployed! Testing function...")

    # Call the function
    with modal.enable_output():
        with app.run():
            f = modal.Function.from_name("test-simple-modal", "modal_tool_wrapper")
            args = {"x": 8}
            result = f.remote(tool_name="my_tool", agent_id="", env_vars={"TEST_VAR": "test"}, **args)

    print(f"Result: {result}")
    assert result["result"] == 9
    assert result["error"] == False
    assert result["stdout"] == "test\n"

    print("✅ Test passed!")


if __name__ == "__main__":
    asyncio.run(test())
