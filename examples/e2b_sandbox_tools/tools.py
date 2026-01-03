"""
E2B Sandbox Tools for Letta Agents

These tools execute operations inside an E2B persistent sandbox.
Each agent has its own sandbox stored in agent.metadata["sandbox_id"].

IMPORTANT: All imports and helper code must be INSIDE each function.
The `client` object is auto-injected by Letta - do not pass it as an argument.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


# ============================================================================
# Pydantic models for complex tool arguments
# ============================================================================

class SandboxReadArgs(BaseModel):
    """Arguments for sandbox_read tool."""
    file_path: str = Field(..., description="The absolute path to the file to read in the sandbox")
    offset: int = Field(0, description="Line number to start reading from (0-indexed)")
    limit: Optional[int] = Field(None, description="Maximum number of lines to read (default: 2000)")


class SandboxWriteArgs(BaseModel):
    """Arguments for sandbox_write tool."""
    file_path: str = Field(..., description="The absolute path to the file to write in the sandbox")
    content: str = Field(..., description="The content to write to the file")


class SandboxEditArgs(BaseModel):
    """Arguments for sandbox_edit tool."""
    file_path: str = Field(..., description="The absolute path to the file to edit")
    old_string: str = Field(..., description="The text to find and replace")
    new_string: str = Field(..., description="The text to replace with")
    replace_all: bool = Field(False, description="If True, replace all occurrences; otherwise replace only the first")


class SandboxGrepArgs(BaseModel):
    """Arguments for sandbox_grep tool."""
    pattern: str = Field(..., description="The regex pattern to search for")
    path: str = Field("/home/user", description="Directory to search in")
    glob_pattern: Optional[str] = Field(None, description="Optional glob pattern to filter files (e.g., '*.py')")
    case_insensitive: bool = Field(False, description="Whether to ignore case")
    context_lines: int = Field(0, description="Number of context lines to show around matches")
    output_mode: str = Field("files_with_matches", description="One of 'files_with_matches', 'content', or 'count'")
    limit: int = Field(100, description="Maximum number of results to return")


class SandboxGlobArgs(BaseModel):
    """Arguments for sandbox_glob tool."""
    pattern: str = Field(..., description="The glob pattern to match (e.g., '**/*.py')")
    path: str = Field("/home/user", description="Base directory to search from")


class SandboxLsArgs(BaseModel):
    """Arguments for sandbox_ls tool."""
    path: str = Field("/home/user", description="The directory path to list")
    ignore: Optional[List[str]] = Field(None, description="Optional list of patterns to ignore")


class SandboxBashArgs(BaseModel):
    """Arguments for sandbox_bash tool."""
    command: str = Field(..., description="The bash command to execute")
    timeout: int = Field(120, description="Timeout in seconds (default: 120, max: 600)")
    description: Optional[str] = Field(None, description="Optional description of what the command does")


class SandboxRunPythonArgs(BaseModel):
    """Arguments for sandbox_run_python tool."""
    code: str = Field(..., description="The Python code to execute")
    timeout: int = Field(60, description="Timeout in seconds (default: 60, max: 300)")


class SandboxInstallPackagesArgs(BaseModel):
    """Arguments for sandbox_install_packages tool."""
    packages: List[str] = Field(..., description="List of package names to install (e.g., ['numpy', 'pandas'])")


class SandboxGitCloneArgs(BaseModel):
    """Arguments for sandbox_git_clone tool."""
    repo_url: str = Field(..., description="The URL of the git repository to clone")
    target_dir: Optional[str] = Field(None, description="Optional target directory name")
    branch: Optional[str] = Field(None, description="Optional branch to checkout")


class SandboxTreeArgs(BaseModel):
    """Arguments for sandbox_tree tool."""
    path: str = Field("/home/user", description="The root path to display")
    max_depth: int = Field(3, description="Maximum depth to traverse (default: 3, max: 10)")


class SandboxFileInfoArgs(BaseModel):
    """Arguments for sandbox_file_info tool."""
    file_path: str = Field(..., description="Path to the file")


# ============================================================================
# Tool functions - all imports and implementation inside function scope
# ============================================================================

def sandbox_read(file_path: str, offset: int = 0, limit: Optional[int] = None) -> str:
    """
    Read a file from the sandbox filesystem with line numbers.

    Args:
        file_path: The absolute path to the file to read in the sandbox
        offset: Line number to start reading from (0-indexed)
        limit: Maximum number of lines to read (default: 2000)

    Returns:
        str: The file content with line numbers
    """
    import os
    from e2b_code_interpreter import Sandbox

    # Constants
    MAX_READ_LINES = 2000
    MAX_CHARS_PER_LINE = 2000

    # Get or create sandbox
    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    # Read file
    try:
        content = sandbox.files.read(file_path)

        if not content or content.strip() == "":
            return f"<system-reminder>\nThe file {file_path} exists but has empty contents.\n</system-reminder>"

        # Format with line numbers
        lines = content.split("\n")
        original_count = len(lines)
        effective_limit = limit if limit is not None else MAX_READ_LINES
        start_line = offset
        end_line = min(start_line + effective_limit, len(lines))
        selected_lines = lines[start_line:end_line]

        max_line_num = start_line + len(selected_lines)
        padding = max(1, len(str(max_line_num)))

        formatted_lines = []
        lines_truncated = False

        for i, line in enumerate(selected_lines):
            line_num = start_line + i + 1
            if len(line) > MAX_CHARS_PER_LINE:
                lines_truncated = True
                line = line[:MAX_CHARS_PER_LINE] + "... [line truncated]"
            formatted_lines.append(f"{str(line_num).rjust(padding)}\u2192{line}")

        result = "\n".join(formatted_lines)

        if end_line < original_count and limit is None:
            result += f"\n\n[File truncated: showing lines {start_line + 1}-{end_line} of {original_count} total lines.]"
        if lines_truncated:
            result += f"\n\n[Some lines exceeded {MAX_CHARS_PER_LINE:,} characters and were truncated.]"

        return result

    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "no such file" in error_msg.lower():
            raise ValueError(f"File does not exist: {file_path}")
        raise ValueError(f"Failed to read file: {error_msg}")


def sandbox_write(file_path: str, content: str) -> str:
    """
    Write content to a file in the sandbox filesystem.

    Args:
        file_path: The absolute path to the file to write in the sandbox
        content: The content to write to the file

    Returns:
        str: A success message
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        # Create parent directories if needed
        parent_dir = "/".join(file_path.rsplit("/", 1)[:-1])
        if parent_dir:
            sandbox.commands.run(f"mkdir -p {parent_dir}")

        sandbox.files.write(file_path, content)
        return f"Successfully wrote {len(content)} characters to {file_path}"
    except Exception as e:
        raise ValueError(f"Failed to write file: {str(e)}")


def sandbox_edit(file_path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
    """
    Edit a file in the sandbox by replacing text.

    Args:
        file_path: The absolute path to the file to edit
        old_string: The text to find and replace
        new_string: The text to replace with
        replace_all: If True, replace all occurrences; otherwise replace only the first

    Returns:
        str: A message indicating how many replacements were made
    """
    import os
    from e2b_code_interpreter import Sandbox

    if old_string == new_string:
        raise ValueError("No changes to make: old_string and new_string are exactly the same.")

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        content = sandbox.files.read(file_path)
        occurrences = content.count(old_string)

        if occurrences == 0:
            raise ValueError(f"String to replace not found in file.\nString: {old_string}")

        if replace_all:
            new_content = content.replace(old_string, new_string)
            replacements = occurrences
        else:
            new_content = content.replace(old_string, new_string, 1)
            replacements = 1

        sandbox.files.write(file_path, new_content)
        return f"Successfully replaced {replacements} occurrence{'s' if replacements != 1 else ''} in {file_path}"

    except ValueError:
        raise
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise ValueError(f"File does not exist: {file_path}")
        raise ValueError(f"Failed to edit file: {error_msg}")


def sandbox_grep(
    pattern: str,
    path: str = "/home/user",
    glob_pattern: Optional[str] = None,
    case_insensitive: bool = False,
    context_lines: int = 0,
    output_mode: str = "files_with_matches",
    limit: int = 100,
) -> str:
    """
    Search for a pattern in files within the sandbox.

    Args:
        pattern: The regex pattern to search for
        path: Directory to search in (default: /home/user)
        glob_pattern: Optional glob pattern to filter files (e.g., '*.py')
        case_insensitive: Whether to ignore case
        context_lines: Number of context lines to show around matches
        output_mode: One of 'files_with_matches', 'content', or 'count'
        limit: Maximum number of results to return

    Returns:
        str: Search results based on output_mode
    """
    import os
    from e2b_code_interpreter import Sandbox

    MAX_OUTPUT_CHARS = 30000

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    # Build grep command
    grep_cmd = "grep -r"
    if case_insensitive:
        grep_cmd += " -i"
    if output_mode == "files_with_matches":
        grep_cmd += " -l"
    elif output_mode == "count":
        grep_cmd += " -c"
    else:
        if context_lines > 0:
            grep_cmd += f" -C {context_lines}"
        grep_cmd += " -n"

    escaped_pattern = pattern.replace("'", "'\\''")
    grep_cmd += f" '{escaped_pattern}'"

    if glob_pattern:
        grep_cmd += f" --include='{glob_pattern}'"
    grep_cmd += f" {path}"

    try:
        result = sandbox.commands.run(grep_cmd)
        output = result.stdout if hasattr(result, 'stdout') else str(result)

        if not output or output.strip() == "":
            if output_mode == "files_with_matches":
                return "No files found"
            elif output_mode == "count":
                return "0\n\nFound 0 total occurrences across 0 files."
            return "No matches found"

        lines = output.strip().split("\n")
        if len(lines) > limit:
            lines = lines[:limit]
            lines.append(f"\n[Output truncated: showing {limit} results]")

        result_text = "\n".join(lines)
        if len(result_text) > MAX_OUTPUT_CHARS:
            result_text = result_text[:MAX_OUTPUT_CHARS] + "\n[Output truncated]"

        if output_mode == "files_with_matches":
            file_count = len([l for l in lines if l and not l.startswith("[")])
            return f"Found {file_count} file{'s' if file_count != 1 else ''}\n{result_text}"

        return result_text

    except Exception as e:
        if "exit code 1" in str(e).lower() or "returned 1" in str(e).lower():
            if output_mode == "files_with_matches":
                return "No files found"
            elif output_mode == "count":
                return "0\n\nFound 0 total occurrences across 0 files."
            return "No matches found"
        raise ValueError(f"Grep failed: {str(e)}")


def sandbox_glob(pattern: str, path: str = "/home/user") -> str:
    """
    Find files matching a glob pattern in the sandbox.

    Args:
        pattern: The glob pattern to match (e.g., '**/*.py')
        path: Base directory to search from (default: /home/user)

    Returns:
        str: List of matching files
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        if "**" in pattern:
            name_pattern = pattern.replace("**/", "").replace("**", "*")
            find_cmd = f"find {path} -type f -name '{name_pattern}' 2>/dev/null | sort"
        else:
            find_cmd = f"find {path} -type f -name '{pattern}' 2>/dev/null | sort"

        result = sandbox.commands.run(find_cmd)
        output = result.stdout if hasattr(result, 'stdout') else str(result)

        if not output or output.strip() == "":
            return "No files found"

        files = [f for f in output.strip().split("\n") if f]
        total_files = len(files)

        max_files = 2000
        if total_files > max_files:
            files = files[:max_files]
            files.append(f"\n[Output truncated: showing {max_files:,} of {total_files:,} files.]")

        return f"Found {total_files} file{'s' if total_files != 1 else ''}\n" + "\n".join(files)

    except Exception as e:
        raise ValueError(f"Glob failed: {str(e)}")


def sandbox_ls(path: str = "/home/user", ignore: Optional[List[str]] = None) -> str:
    """
    List contents of a directory in the sandbox.

    Args:
        path: The directory path to list
        ignore: Optional list of patterns to ignore

    Returns:
        str: A tree-like listing of the directory contents
    """
    import os
    import fnmatch
    from e2b_code_interpreter import Sandbox

    MAX_ENTRIES = 1000
    ignore = ignore or []

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        result = sandbox.commands.run(f"ls -la {path}")
        output = result.stdout if hasattr(result, 'stdout') else str(result)

        if not output or output.strip() == "":
            return f"{path}/ (empty directory)"

        lines = output.strip().split("\n")
        entries = []

        for line in lines[1:]:
            parts = line.split()
            if len(parts) < 9:
                continue

            name = " ".join(parts[8:])
            if name in (".", ".."):
                continue

            if any(fnmatch.fnmatch(name, p) for p in ignore):
                continue

            is_dir = parts[0].startswith("d")
            entries.append({
                "name": name,
                "type": "directory" if is_dir else "file",
            })

        entries.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))

        total_entries = len(entries)
        truncated = False
        if total_entries > MAX_ENTRIES:
            entries = entries[:MAX_ENTRIES]
            truncated = True

        if not entries:
            return f"{path}/ (empty directory)"

        path_parts = path.rstrip("/").split("/")
        last_part = path_parts[-1] if path_parts else "/"
        parent_path = "/".join(path_parts[:-1]) if len(path_parts) > 1 else "/"

        output_lines = [f"- {parent_path}/", f"  - {last_part}/"]

        for entry in entries:
            suffix = "/" if entry["type"] == "directory" else ""
            output_lines.append(f"    - {entry['name']}{suffix}")

        if truncated:
            output_lines.append("")
            output_lines.append(f"[Output truncated: showing {MAX_ENTRIES:,} of {total_entries:,} entries.]")

        return "\n".join(output_lines)

    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "no such" in error_msg.lower():
            raise ValueError(f"Directory not found: {path}")
        if "not a directory" in error_msg.lower():
            raise ValueError(f"Not a directory: {path}")
        raise ValueError(f"Failed to list directory: {error_msg}")


def sandbox_bash(command: str, timeout: int = 120, description: Optional[str] = None) -> str:
    """
    Execute a bash command in the sandbox.

    Args:
        command: The bash command to execute
        timeout: Timeout in seconds (default: 120, max: 600)
        description: Optional description of what the command does

    Returns:
        str: Command output (stdout and stderr combined)
    """
    import os
    from e2b_code_interpreter import Sandbox

    MAX_OUTPUT_CHARS = 30000
    timeout = max(1, min(timeout, 600))

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        result = sandbox.commands.run(command, timeout=timeout)

        stdout = result.stdout if hasattr(result, 'stdout') else ""
        stderr = result.stderr if hasattr(result, 'stderr') else ""
        exit_code = result.exit_code if hasattr(result, 'exit_code') else 0

        output = stdout
        if stderr:
            output = f"{output}\n{stderr}" if output else stderr

        if not output:
            output = "(Command completed with no output)"

        if len(output) > MAX_OUTPUT_CHARS:
            output = output[:MAX_OUTPUT_CHARS] + "\n[Output truncated]"

        if exit_code != 0:
            return f"Exit code: {exit_code}\n{output}"

        return output

    except Exception as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            raise ValueError(f"Command timed out after {timeout} seconds")
        raise ValueError(f"Command failed: {error_msg}")


def sandbox_run_python(code: str, timeout: int = 60) -> str:
    """
    Execute Python code in the sandbox using the code interpreter.

    Args:
        code: The Python code to execute
        timeout: Timeout in seconds (default: 60, max: 300)

    Returns:
        str: The execution output including stdout, stderr, and any results
    """
    import os
    from e2b_code_interpreter import Sandbox

    MAX_OUTPUT_CHARS = 30000
    timeout = max(1, min(timeout, 300))

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        execution = sandbox.run_code(code, timeout=timeout)

        output_parts = []

        if hasattr(execution, 'logs') and execution.logs:
            if hasattr(execution.logs, 'stdout') and execution.logs.stdout:
                output_parts.append(execution.logs.stdout)
            if hasattr(execution.logs, 'stderr') and execution.logs.stderr:
                output_parts.append(f"STDERR: {execution.logs.stderr}")

        if hasattr(execution, 'results') and execution.results:
            for result in execution.results:
                if hasattr(result, 'text') and result.text:
                    output_parts.append(f"Result: {result.text}")
                if hasattr(result, 'png') and result.png:
                    output_parts.append("[Generated image - base64 PNG available]")

        if hasattr(execution, 'error') and execution.error:
            output_parts.append(f"Error: {execution.error}")

        output = "\n".join(output_parts) if output_parts else "(Code executed with no output)"

        if len(output) > MAX_OUTPUT_CHARS:
            output = output[:MAX_OUTPUT_CHARS] + "\n[Output truncated]"

        return output

    except Exception as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            raise ValueError(f"Code execution timed out after {timeout} seconds")
        raise ValueError(f"Code execution failed: {error_msg}")


def sandbox_install_packages(packages: List[str]) -> str:
    """
    Install Python packages in the sandbox using pip.

    Args:
        packages: List of package names to install (e.g., ['numpy', 'pandas'])

    Returns:
        str: Installation output
    """
    import os
    from e2b_code_interpreter import Sandbox

    if not packages:
        return "No packages specified"

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    packages_str = " ".join(packages)

    try:
        result = sandbox.commands.run(f"pip install {packages_str}", timeout=300)

        stdout = result.stdout if hasattr(result, 'stdout') else ""
        stderr = result.stderr if hasattr(result, 'stderr') else ""
        exit_code = result.exit_code if hasattr(result, 'exit_code') else 0

        output = stdout
        if stderr:
            output = f"{output}\n{stderr}" if output else stderr

        if exit_code != 0:
            return f"Installation failed (exit code {exit_code}):\n{output}"

        return f"Successfully installed: {', '.join(packages)}\n{output}"

    except Exception as e:
        raise ValueError(f"Failed to install packages: {str(e)}")


def sandbox_git_clone(repo_url: str, target_dir: Optional[str] = None, branch: Optional[str] = None) -> str:
    """
    Clone a git repository into the sandbox.

    Args:
        repo_url: The URL of the git repository to clone
        target_dir: Optional target directory name (default: repo name)
        branch: Optional branch to checkout

    Returns:
        str: Clone status message
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    cmd = "cd /home/user && git clone"
    if branch:
        cmd += f" -b {branch}"
    cmd += f" {repo_url}"
    if target_dir:
        cmd += f" {target_dir}"

    try:
        result = sandbox.commands.run(cmd, timeout=300)

        stdout = result.stdout if hasattr(result, 'stdout') else ""
        stderr = result.stderr if hasattr(result, 'stderr') else ""
        exit_code = result.exit_code if hasattr(result, 'exit_code') else 0

        output = stdout + ("\n" + stderr if stderr else "")

        if exit_code != 0:
            return f"Clone failed (exit code {exit_code}):\n{output}"

        return f"Successfully cloned {repo_url}\n{output}"

    except Exception as e:
        raise ValueError(f"Failed to clone repository: {str(e)}")


def sandbox_tree(path: str = "/home/user", max_depth: int = 3) -> str:
    """
    Display a tree view of the directory structure in the sandbox.

    Args:
        path: The root path to display (default: /home/user)
        max_depth: Maximum depth to traverse (default: 3, max: 10)

    Returns:
        str: Tree-formatted directory structure
    """
    import os
    from e2b_code_interpreter import Sandbox

    MAX_OUTPUT_CHARS = 30000
    max_depth = max(1, min(max_depth, 10))

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        result = sandbox.commands.run(
            f"tree -L {max_depth} {path} 2>/dev/null || find {path} -maxdepth {max_depth} -print | head -500",
            timeout=30
        )

        output = result.stdout if hasattr(result, 'stdout') else ""

        if not output or output.strip() == "":
            return f"{path}/ (empty or inaccessible)"

        if len(output) > MAX_OUTPUT_CHARS:
            output = output[:MAX_OUTPUT_CHARS] + "\n[Output truncated]"

        return output

    except Exception as e:
        raise ValueError(f"Failed to display tree: {str(e)}")


def sandbox_file_info(file_path: str) -> str:
    """
    Get detailed information about a file in the sandbox.

    Args:
        file_path: Path to the file

    Returns:
        str: File information including size, permissions, modification time
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        except Exception:
            sandbox = None
    else:
        sandbox = None

    if sandbox is None:
        sandbox = Sandbox.create(timeout=10 * 60 * 1000)
        current_metadata = agent.metadata or {}
        if not isinstance(current_metadata, dict):
            current_metadata = {}
        current_metadata["sandbox_id"] = sandbox.sandbox_id
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    try:
        result = sandbox.commands.run(f"ls -la {file_path} && file {file_path} && stat {file_path}", timeout=10)

        output = result.stdout if hasattr(result, 'stdout') else ""
        stderr = result.stderr if hasattr(result, 'stderr') else ""

        if stderr and "No such file" in stderr:
            raise ValueError(f"File not found: {file_path}")

        return output if output else f"Could not get info for {file_path}"

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Failed to get file info: {str(e)}")


def sandbox_status() -> str:
    """
    Get the status of the current agent's sandbox.

    Returns:
        str: Sandbox status information
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)

    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if not sandbox_id:
        return "No sandbox associated with this agent. A new one will be created on the next sandbox operation."

    try:
        sandbox = Sandbox.connect(sandbox_id, timeout=10 * 60 * 1000)
        return f"Sandbox ID: {sandbox_id}\nStatus: Running"
    except Exception as e:
        return f"Sandbox ID: {sandbox_id}\nStatus: Unavailable (may be paused or expired)\nError: {str(e)}"


def sandbox_kill() -> str:
    """
    Kill the current agent's sandbox permanently.

    This will permanently delete the sandbox. A new one will be created
    on the next tool call that needs a sandbox.

    Returns:
        str: A confirmation message
    """
    import os
    from e2b_code_interpreter import Sandbox

    agent_id = os.environ.get("LETTA_AGENT_ID")
    if not agent_id:
        raise ValueError("LETTA_AGENT_ID environment variable not set")

    agent = client.agents.retrieve(agent_id=agent_id)

    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if not sandbox_id:
        return "No sandbox found for this agent"

    try:
        Sandbox.kill(sandbox_id)
    except Exception:
        pass

    current_metadata = agent.metadata or {}
    if isinstance(current_metadata, dict) and "sandbox_id" in current_metadata:
        del current_metadata["sandbox_id"]
        client.agents.modify(agent_id=agent_id, metadata=current_metadata)

    return f"Sandbox {sandbox_id} has been killed"
