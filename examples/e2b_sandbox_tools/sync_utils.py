"""
File Sync Utilities for E2B Sandbox

These utilities help sync files between the local filesystem and the E2B sandbox.
They are designed to be run OUTSIDE the Letta tool sandbox (i.e., from your local machine).

For syncing within Letta tools, use sandbox_write with the file content directly.
"""

import os
import base64
from pathlib import Path
from typing import Optional, List
from letta_client import Letta


def upload_file_to_sandbox(
    client: Letta,
    agent_id: str,
    local_path: str,
    sandbox_path: Optional[str] = None,
) -> str:
    """
    Upload a local file to an agent's sandbox.

    This function reads the local file and sends a message to the agent
    asking it to write the content to the sandbox.

    Args:
        client: Initialized Letta client
        agent_id: The agent's ID
        local_path: Path to the local file
        sandbox_path: Destination path in sandbox (default: /home/user/<filename>)

    Returns:
        Result message from the agent
    """
    local_file = Path(local_path)

    if not local_file.exists():
        raise FileNotFoundError(f"Local file not found: {local_path}")

    if not local_file.is_file():
        raise ValueError(f"Path is not a file: {local_path}")

    # Read file content
    try:
        content = local_file.read_text()
    except UnicodeDecodeError:
        # Binary file - encode as base64
        content = base64.b64encode(local_file.read_bytes()).decode('ascii')
        is_binary = True
    else:
        is_binary = False

    # Determine sandbox path
    if sandbox_path is None:
        sandbox_path = f"/home/user/{local_file.name}"

    # Create the message for the agent
    if is_binary:
        message = f"""Please write this base64-encoded content to {sandbox_path} using sandbox_bash.
First decode it: echo '{content}' | base64 -d > {sandbox_path}"""
    else:
        # Escape content for safe transmission
        message = f"""Please write the following content to {sandbox_path} using sandbox_write:

```
{content}
```"""

    # Send to agent
    response = client.agents.messages.create(
        agent_id=agent_id,
        messages=[{"role": "user", "content": message}]
    )

    # Extract result
    result_parts = []
    for msg in response.messages:
        if hasattr(msg, 'content') and msg.content:
            result_parts.append(msg.content)

    return "\n".join(result_parts) if result_parts else "Upload completed"


def upload_directory_to_sandbox(
    client: Letta,
    agent_id: str,
    local_dir: str,
    sandbox_dir: str = "/home/user",
    ignore_patterns: Optional[List[str]] = None,
) -> dict:
    """
    Upload a local directory to an agent's sandbox.

    Args:
        client: Initialized Letta client
        agent_id: The agent's ID
        local_dir: Path to the local directory
        sandbox_dir: Base directory in sandbox (default: /home/user)
        ignore_patterns: List of glob patterns to ignore

    Returns:
        Dict with upload results per file
    """
    import fnmatch

    local_path = Path(local_dir)

    if not local_path.exists():
        raise FileNotFoundError(f"Local directory not found: {local_dir}")

    if not local_path.is_dir():
        raise ValueError(f"Path is not a directory: {local_dir}")

    ignore_patterns = ignore_patterns or [
        "__pycache__", "*.pyc", ".git", ".git/*",
        "node_modules", "node_modules/*", ".env",
        "*.log", ".DS_Store"
    ]

    results = {}

    for file_path in local_path.rglob("*"):
        if not file_path.is_file():
            continue

        # Check ignore patterns
        rel_path = file_path.relative_to(local_path)
        if any(fnmatch.fnmatch(str(rel_path), pattern) or
               fnmatch.fnmatch(file_path.name, pattern)
               for pattern in ignore_patterns):
            continue

        sandbox_file_path = f"{sandbox_dir}/{rel_path}"

        try:
            result = upload_file_to_sandbox(
                client, agent_id, str(file_path), sandbox_file_path
            )
            results[str(rel_path)] = {"status": "success", "message": result}
        except Exception as e:
            results[str(rel_path)] = {"status": "error", "message": str(e)}

    return results


def download_file_from_sandbox(
    client: Letta,
    agent_id: str,
    sandbox_path: str,
    local_path: Optional[str] = None,
) -> str:
    """
    Download a file from an agent's sandbox to the local filesystem.

    Args:
        client: Initialized Letta client
        agent_id: The agent's ID
        sandbox_path: Path to the file in the sandbox
        local_path: Local destination path (default: current dir/<filename>)

    Returns:
        Path to the downloaded file
    """
    # Ask agent to read the file
    message = f"Please read the file at {sandbox_path} using sandbox_read and show me the complete contents"

    response = client.agents.messages.create(
        agent_id=agent_id,
        messages=[{"role": "user", "content": message}]
    )

    # Extract file content from response
    content = None
    for msg in response.messages:
        if hasattr(msg, 'role') and msg.role == 'tool':
            if hasattr(msg, 'content') and msg.content:
                # Parse out the content (removing line numbers if present)
                lines = []
                for line in msg.content.split('\n'):
                    # Remove line number prefix (e.g., "  1→")
                    if '→' in line:
                        lines.append(line.split('→', 1)[1])
                    else:
                        lines.append(line)
                content = '\n'.join(lines)
                break

    if content is None:
        raise ValueError("Failed to retrieve file content from sandbox")

    # Determine local path
    if local_path is None:
        filename = sandbox_path.split('/')[-1]
        local_path = filename

    # Write to local file
    Path(local_path).write_text(content)

    return local_path


def sync_to_sandbox(
    client: Letta,
    agent_id: str,
    local_path: str,
    sandbox_path: Optional[str] = None,
) -> str:
    """
    Sync a local file or directory to the sandbox.

    Automatically detects whether the path is a file or directory
    and calls the appropriate upload function.

    Args:
        client: Initialized Letta client
        agent_id: The agent's ID
        local_path: Path to local file or directory
        sandbox_path: Destination path in sandbox

    Returns:
        Result message or dict with results
    """
    path = Path(local_path)

    if path.is_file():
        return upload_file_to_sandbox(client, agent_id, local_path, sandbox_path)
    elif path.is_dir():
        sandbox_dir = sandbox_path or f"/home/user/{path.name}"
        return upload_directory_to_sandbox(client, agent_id, local_path, sandbox_dir)
    else:
        raise ValueError(f"Path not found: {local_path}")


# Example usage
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print("Usage: python sync_utils.py <agent_id> <local_path> [sandbox_path]")
        print("\nExample:")
        print("  python sync_utils.py agent-123 ./my_project /home/user/project")
        sys.exit(1)

    agent_id = sys.argv[1]
    local_path = sys.argv[2]
    sandbox_path = sys.argv[3] if len(sys.argv) > 3 else None

    api_key = os.environ.get("LETTA_API_KEY")
    if not api_key:
        print("Error: LETTA_API_KEY environment variable not set")
        sys.exit(1)

    client = Letta(api_key=api_key)

    print(f"Syncing {local_path} to sandbox...")
    result = sync_to_sandbox(client, agent_id, local_path, sandbox_path)
    print(result)
