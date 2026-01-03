# E2B Sandbox Tools for Letta

This package provides tools that execute operations inside E2B persistent sandboxes for Letta agents. Each agent gets its own isolated sandbox that persists between tool calls.

## Features

- **Persistent Sandboxes**: Each agent has its own E2B sandbox stored in `agent.metadata["sandbox_id"]`
- **Automatic Resumption**: Sandboxes are automatically resumed when the agent calls a tool
- **Full Filesystem Access**: Read, write, edit, and search files in the sandbox
- **Python Code Execution**: Execute Python code with automatic output capture
- **Package Management**: Install pip packages and clone git repositories
- **Client Injection Compatible**: Uses Letta's client injection (all imports inside function scope)

## Installation

```bash
pip install e2b-code-interpreter letta-client pydantic
```

You'll also need environment variables:

```bash
export E2B_API_KEY=your_e2b_api_key
export LETTA_API_KEY=your_letta_api_key
```

## Tool Format

These tools follow Letta's tool conventions:
- **All imports inside function scope** (not at module level)
- **`client` is auto-injected** - not passed as a function argument
- **Pydantic models for complex arguments** via `args_schema`

## Quick Start

### 1. Register Tools

```python
from letta_client import Letta
from e2b_sandbox_tools import (
    sandbox_read, SandboxReadArgs,
    sandbox_write, SandboxWriteArgs,
    sandbox_bash, SandboxBashArgs,
    sandbox_run_python, SandboxRunPythonArgs,
)

client = Letta(api_key="...")

# Register with Pydantic args_schema for complex arguments
client.tools.upsert_from_function(
    func=sandbox_read,
    args_schema=SandboxReadArgs,
    packages=["e2b-code-interpreter"],
)

client.tools.upsert_from_function(
    func=sandbox_bash,
    args_schema=SandboxBashArgs,
    packages=["e2b-code-interpreter"],
)
```

### 2. Create Agent

```python
agent = client.agents.create(
    name="sandbox-agent",
    memory_blocks=[
        {"label": "human", "value": "Developer needing help"},
        {"label": "persona", "value": "AI with E2B sandbox access"},
    ],
    tools=["sandbox_read", "sandbox_write", "sandbox_bash", "sandbox_run_python"],
    model="openai/gpt-4o",
    embedding="openai/text-embedding-3-small",
)
```

### 3. Use the Agent

```python
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{
        "role": "user",
        "content": "Create a Python script that calculates fibonacci numbers and run it"
    }]
)
```

## Available Tools

### File Operations

| Tool | Args Schema | Description |
|------|-------------|-------------|
| `sandbox_read` | `SandboxReadArgs` | Read files with line numbers |
| `sandbox_write` | `SandboxWriteArgs` | Write content to files |
| `sandbox_edit` | `SandboxEditArgs` | Find and replace text |

### Search & Navigation

| Tool | Args Schema | Description |
|------|-------------|-------------|
| `sandbox_grep` | `SandboxGrepArgs` | Search for patterns in files |
| `sandbox_glob` | `SandboxGlobArgs` | Find files matching patterns |
| `sandbox_ls` | `SandboxLsArgs` | List directory contents |
| `sandbox_tree` | `SandboxTreeArgs` | Display directory tree |
| `sandbox_file_info` | `SandboxFileInfoArgs` | Get detailed file information |

### Code Execution

| Tool | Args Schema | Description |
|------|-------------|-------------|
| `sandbox_bash` | `SandboxBashArgs` | Execute shell commands |
| `sandbox_run_python` | `SandboxRunPythonArgs` | Execute Python with output capture |

### Package & Repository Management

| Tool | Args Schema | Description |
|------|-------------|-------------|
| `sandbox_install_packages` | `SandboxInstallPackagesArgs` | Install Python packages |
| `sandbox_git_clone` | `SandboxGitCloneArgs` | Clone git repositories |

### Sandbox Management

| Tool | Args Schema | Description |
|------|-------------|-------------|
| `sandbox_status` | None | Get sandbox status |
| `sandbox_kill` | None | Destroy sandbox permanently |

## Pydantic Argument Schemas

Each tool has a corresponding Pydantic model for its arguments:

```python
from pydantic import BaseModel, Field

class SandboxReadArgs(BaseModel):
    file_path: str = Field(..., description="The absolute path to the file to read")
    offset: int = Field(0, description="Line number to start reading from (0-indexed)")
    limit: Optional[int] = Field(None, description="Maximum number of lines to read")
```

## How It Works

### Client Injection

The tools use Letta's client injection. Inside each tool, `client` is automatically available:

```python
def sandbox_read(file_path: str, offset: int = 0, limit: Optional[int] = None) -> str:
    """Read a file from the sandbox."""
    import os
    from e2b_code_interpreter import Sandbox

    # client is auto-injected by Letta - no import needed!
    agent_id = os.environ.get("LETTA_AGENT_ID")
    agent = client.agents.retrieve(agent_id=agent_id)

    # ... rest of implementation
```

### Sandbox Persistence

1. **First Tool Call**: Creates a new E2B sandbox and stores its ID in `agent.metadata["sandbox_id"]`
2. **Subsequent Calls**: Resumes the existing sandbox using `Sandbox.connect(sandbox_id)`
3. **State Preservation**: Files, installed packages, and running processes persist between calls
4. **Expiration**: E2B sandboxes can be paused/resumed for up to 30 days

## Examples

### Run the Registration Example

```bash
cd /path/to/e2b_sandbox_tools
python example_register_tools.py
```

### Data Analysis Example

```python
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{
        "role": "user",
        "content": """
        1. Install pandas and matplotlib
        2. Create a CSV file with sample sales data
        3. Write a Python script to analyze and visualize the data
        4. Run the analysis and show me the results
        """
    }]
)
```

### Clone and Explore Repository

```python
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{
        "role": "user",
        "content": """
        Clone the requests library from GitHub and:
        1. Show me the directory structure
        2. Find all files containing "session"
        3. Read the main session implementation
        """
    }]
)
```

## Project Structure

```
e2b_sandbox_tools/
├── __init__.py                  # Package exports
├── tools.py                     # All sandbox tools with Pydantic schemas
├── example_register_tools.py    # Quick start example
├── examples/
│   └── comprehensive_example.py # Full interactive demo
├── tests/
│   └── test_tools.py            # Unit tests
├── pyproject.toml
├── requirements.txt
└── README.md
```

## Limitations

- Sandboxes have a maximum lifetime of 30 days
- Default timeout is 10 minutes per session
- File content is limited to prevent excessive token usage
- Binary files cannot be read directly (use base64 encoding)

## License

MIT
