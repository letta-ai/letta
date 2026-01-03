"""
E2B Sandbox Tools for Letta Agents

This package provides tools that execute operations inside E2B persistent sandboxes.
Each agent has its own sandbox stored in agent.metadata["sandbox_id"].

IMPORTANT: These tools use Letta's client injection - the `client` object is
automatically available inside tools when running in Letta's sandbox environment.
All imports are inside the function scope as required by Letta.

Tools available:
- sandbox_read: Read files from the sandbox
- sandbox_write: Write files to the sandbox
- sandbox_edit: Edit files in the sandbox
- sandbox_grep: Search for patterns in files
- sandbox_glob: Find files matching a pattern
- sandbox_ls: List directory contents
- sandbox_bash: Execute bash commands
- sandbox_run_python: Execute Python code
- sandbox_install_packages: Install pip packages
- sandbox_git_clone: Clone git repositories
- sandbox_tree: Show directory tree
- sandbox_file_info: Get file information
- sandbox_status: Get sandbox status
- sandbox_kill: Kill the sandbox

Usage:
    from e2b_sandbox_tools import sandbox_read, SandboxReadArgs

    # Register with Letta
    tool = client.tools.upsert_from_function(
        func=sandbox_read,
        args_schema=SandboxReadArgs,
        packages=["e2b-code-interpreter"],
    )
"""

from .tools import (
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
)

__all__ = [
    # Pydantic argument schemas
    "SandboxReadArgs",
    "SandboxWriteArgs",
    "SandboxEditArgs",
    "SandboxGrepArgs",
    "SandboxGlobArgs",
    "SandboxLsArgs",
    "SandboxBashArgs",
    "SandboxRunPythonArgs",
    "SandboxInstallPackagesArgs",
    "SandboxGitCloneArgs",
    "SandboxTreeArgs",
    "SandboxFileInfoArgs",
    # File operations
    "sandbox_read",
    "sandbox_write",
    "sandbox_edit",
    # Search & find
    "sandbox_grep",
    "sandbox_glob",
    "sandbox_ls",
    "sandbox_tree",
    "sandbox_file_info",
    # Command execution
    "sandbox_bash",
    "sandbox_run_python",
    # Package management
    "sandbox_install_packages",
    "sandbox_git_clone",
    # Sandbox management
    "sandbox_status",
    "sandbox_kill",
]

__version__ = "0.1.0"
