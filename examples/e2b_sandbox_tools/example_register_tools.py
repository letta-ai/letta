"""
Example: Register E2B Sandbox Tools with a Letta Agent

This script demonstrates how to register the sandbox tools with Letta
and create an agent that can use them.

IMPORTANT: These tools are designed for Letta's sandbox execution environment.
- All imports are inside the function scope
- The `client` object is auto-injected (not passed as parameter)
- Arguments are specified via Pydantic models with args_schema
"""

import os
from letta_client import Letta

# Import the tool functions and their argument schemas
from tools import (
    # Tool functions
    sandbox_read,
    sandbox_write,
    sandbox_edit,
    sandbox_grep,
    sandbox_glob,
    sandbox_ls,
    sandbox_bash,
    sandbox_run_python,
    sandbox_install_packages,
    sandbox_git_clone,
    sandbox_tree,
    sandbox_file_info,
    sandbox_status,
    sandbox_kill,
    # Pydantic argument schemas
    SandboxReadArgs,
    SandboxWriteArgs,
    SandboxEditArgs,
    SandboxGrepArgs,
    SandboxGlobArgs,
    SandboxLsArgs,
    SandboxBashArgs,
    SandboxRunPythonArgs,
    SandboxInstallPackagesArgs,
    SandboxGitCloneArgs,
    SandboxTreeArgs,
    SandboxFileInfoArgs,
)


def register_tools(client: Letta) -> list[str]:
    """Register all sandbox tools and return their names."""

    # Tools paired with their Pydantic argument schemas
    tools = [
        # File operations
        (sandbox_read, SandboxReadArgs),
        (sandbox_write, SandboxWriteArgs),
        (sandbox_edit, SandboxEditArgs),
        # Search & navigation
        (sandbox_grep, SandboxGrepArgs),
        (sandbox_glob, SandboxGlobArgs),
        (sandbox_ls, SandboxLsArgs),
        (sandbox_tree, SandboxTreeArgs),
        (sandbox_file_info, SandboxFileInfoArgs),
        # Command execution
        (sandbox_bash, SandboxBashArgs),
        (sandbox_run_python, SandboxRunPythonArgs),
        # Package management
        (sandbox_install_packages, SandboxInstallPackagesArgs),
        (sandbox_git_clone, SandboxGitCloneArgs),
        # Sandbox management (no complex args)
        (sandbox_status, None),
        (sandbox_kill, None),
    ]

    tool_names = []
    for tool_func, args_schema in tools:
        # Use upsert_from_function with args_schema for complex arguments
        if args_schema:
            tool = client.tools.upsert_from_function(
                func=tool_func,
                args_schema=args_schema,
                packages=["e2b-code-interpreter"],
            )
        else:
            tool = client.tools.upsert_from_function(
                func=tool_func,
                packages=["e2b-code-interpreter"],
            )
        tool_names.append(tool.name)
        print(f"Registered tool: {tool.name}")

    return tool_names


def create_sandbox_agent(client: Letta, tool_names: list[str]) -> str:
    """Create an agent with sandbox tools."""
    agent = client.agents.create(
        name="E2B Sandbox Agent",
        memory_blocks=[
            {
                "label": "human",
                "value": "A developer who needs help with coding tasks in an isolated sandbox environment.",
            },
            {
                "label": "persona",
                "value": """You are an AI assistant with access to an isolated E2B sandbox environment.

You can:
- Read, write, and edit files using sandbox_read, sandbox_write, sandbox_edit
- Search for patterns in files using sandbox_grep
- Find files using sandbox_glob
- List directories using sandbox_ls
- Display directory tree using sandbox_tree
- Get file info using sandbox_file_info
- Execute bash commands using sandbox_bash
- Execute Python code using sandbox_run_python
- Install packages using sandbox_install_packages
- Clone repositories using sandbox_git_clone
- Check sandbox status using sandbox_status
- Kill the sandbox using sandbox_kill (WARNING: deletes all files)

The sandbox has a persistent filesystem at /home/user that persists between tool calls.
Always use absolute paths starting from /home/user.""",
            },
        ],
        tools=tool_names,
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
    )

    print(f"\nCreated agent: {agent.name} (ID: {agent.id})")
    return agent.id


def main():
    # Initialize the Letta client
    api_key = os.environ.get("LETTA_API_KEY")
    if not api_key:
        print("Please set LETTA_API_KEY environment variable")
        return

    # Check for E2B API key
    e2b_key = os.environ.get("E2B_API_KEY")
    if not e2b_key:
        print("Please set E2B_API_KEY environment variable")
        return

    client = Letta(api_key=api_key)

    print("Registering sandbox tools...")
    tool_names = register_tools(client)

    print("\nCreating sandbox agent...")
    agent_id = create_sandbox_agent(client, tool_names)

    print("\n" + "=" * 50)
    print("Setup complete!")
    print("=" * 50)
    print(f"\nAgent ID: {agent_id}")
    print("\nYou can now use this agent to execute commands in an isolated sandbox.")
    print("\nExample usage:")
    print('  response = client.agents.messages.create(')
    print(f'      agent_id="{agent_id}",')
    print('      messages=[{"role": "user", "content": "Create a Python file and run it"}]')
    print('  )')


if __name__ == "__main__":
    main()
