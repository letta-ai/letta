#!/usr/bin/env python3
"""
Minimal test to debug Modal function execution.
"""

import asyncio
import pickle
from typing import Optional

import modal
from letta_client import Letta

app = modal.App("test-simple-modal")

code_str = """
def helper_function(x):
    return x + 1

def my_tool(x):
    return helper_function(x)
"""


@app.function(
    image=modal.Image.debian_slim(python_version="3.13").pip_install("letta_client"),
    restrict_modal_access=True,  # untrusted
    timeout=10,
)
def modal_tool_wrapper(tool_name: str, agent_id: str, letta_api_key: Optional[str] = None, **kwargs):
    """Wrapper function for modal tools."""
    if letta_api_key:
        client = Letta(token=letta_api_key)

    # initialize the agent code
    exec(code_str)

    # call the tool (capture stdout and stderr)
    tool = globals()[tool_name]
    result = tool(**kwargs)

    return result


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
            result = f.remote(tool_name="my_tool", agent_id="", **args)

    print(f"Result: {result}")
    assert result == 9
    print("✅ Test passed!")


if __name__ == "__main__":
    asyncio.run(test())
