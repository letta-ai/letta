# Custom Extractors

Create your own extractors to pull exactly what you need from agent trajectories.

While built-in extractors cover common cases (last assistant message, tool arguments, memory blocks), custom extractors let you implement specialized extraction logic for your specific use case.

## Why Custom Extractors?

Use custom extractors when you need to:
- **Extract structured data**: Parse JSON fields from agent responses
- **Filter specific patterns**: Extract code blocks, URLs, or formatted content
- **Combine data sources**: Merge information from multiple messages or memory blocks
- **Count occurrences**: Track how many times something happened in the conversation
- **Complex logic**: Implement domain-specific extraction that built-ins can't handle

**Example**: You want to test if your agent correctly stores fruit preferences in memory using the `memory_insert` tool. A custom extractor can grab the tool call arguments, and a custom grader can verify the fruit name is in the right memory block.

## Quick Example

Here's a real custom extractor that pulls `memory_insert` tool call arguments:

```python
from typing import List
from letta_client import LettaMessageUnion, ToolCallMessage
from letta_evals.decorators import extractor

@extractor
def memory_insert_extractor(trajectory: List[List[LettaMessageUnion]], config: dict) -> str:
    """Extract memory_insert tool call arguments from trajectory."""
    for turn in trajectory:
        for message in turn:
            if isinstance(message, ToolCallMessage) and message.tool_call.name == "memory_insert":
                return message.tool_call.arguments

    return "{}"  # Return empty JSON if not found
```

This extractor:
1. Loops through all conversation turns
2. Finds `ToolCallMessage` objects
3. Checks if the tool is `memory_insert`
4. Returns the JSON arguments
5. Returns `"{}"` if no matching tool call found

You can then pair this with a custom grader to verify the arguments are correct (see [Custom Graders](../advanced/custom-graders.md)).

## Basic Structure

```python
from typing import List, Optional
from letta_client import LettaMessageUnion, AgentState
from letta_evals.decorators import extractor

@extractor
def my_extractor(
    trajectory: List[List[LettaMessageUnion]],
    config: dict,
    agent_state: Optional[AgentState] = None
) -> str:
    """Your custom extraction logic."""
    # Extract and return content
    return extracted_text
```

## The @extractor Decorator

The `@extractor` decorator registers your function:

```python
from letta_evals.decorators import extractor

@extractor  # Makes this available as "my_extractor"
def my_extractor(trajectory, config, agent_state=None):
    ...
```

## Function Signature

### Required Parameters

- `trajectory`: List of conversation turns, each containing messages
- `config`: Dictionary with extractor configuration from YAML

### Optional Parameters

- `agent_state`: Agent state (only needed if extracting from memory blocks or other agent state). Most extractors only need the trajectory.

### Return Value

Must return a string - the extracted content to be graded.

## Trajectory Structure

The trajectory is a list of turns:

```python
[
  # Turn 1
  [
    UserMessage(...),
    AssistantMessage(...),
    ToolCallMessage(...),
    ToolReturnMessage(...)
  ],
  # Turn 2
  [
    AssistantMessage(...)
  ]
]
```

Message types:
- `UserMessage`: User input
- `AssistantMessage`: Agent response
- `ToolCallMessage`: Tool invocation
- `ToolReturnMessage`: Tool result
- `SystemMessage`: System messages

## Configuration

Access extractor config via the `config` parameter:

```yaml
extractor: my_extractor
extractor_config:
  max_length: 100  # Truncate output at 100 chars
  include_metadata: true  # Include metadata in extraction
```

```python
@extractor
def my_extractor(trajectory, config, agent_state=None):
    max_length = config.get("max_length", 500)
    include_metadata = config.get("include_metadata", False)
    ...
```

## Examples

### Extract Last N Messages

```python
from letta_evals.decorators import extractor
from letta_evals.extractors.utils import get_assistant_messages, flatten_content

@extractor
def last_n_messages(trajectory, config, agent_state=None):
    """Extract the last N assistant messages."""
    n = config.get("n", 3)
    messages = get_assistant_messages(trajectory)
    last_n = messages[-n:] if len(messages) >= n else messages
    contents = [flatten_content(msg.content) for msg in last_n]
    return "\n".join(contents)
```

Usage:
```yaml
extractor: last_n_messages  # Use custom extractor
extractor_config:
  n: 3  # Extract last 3 assistant messages
```

### Extract JSON Field

```python
import json
from letta_evals.decorators import extractor
from letta_evals.extractors.utils import get_assistant_messages, flatten_content

@extractor
def json_field(trajectory, config, agent_state=None):
    """Extract a specific field from JSON response."""
    field_name = config.get("field", "result")
    messages = get_assistant_messages(trajectory)

    if not messages:
        return ""

    content = flatten_content(messages[-1].content)

    try:
        data = json.loads(content)
        return str(data.get(field_name, ""))
    except json.JSONDecodeError:
        return ""
```

Usage:
```yaml
extractor: json_field  # Parse JSON from agent response
extractor_config:
  field: result  # Extract the "result" field from JSON
```

### Extract Code Blocks

```python
import re
from letta_evals.decorators import extractor
from letta_evals.extractors.utils import get_assistant_messages, flatten_content

@extractor
def code_blocks(trajectory, config, agent_state=None):
    """Extract all code blocks from messages."""
    language = config.get("language", None)  # Optional: filter by language
    messages = get_assistant_messages(trajectory)

    code_pattern = r'```(?:(\w+)\n)?(.*?)```'
    all_code = []

    for msg in messages:
        content = flatten_content(msg.content)
        matches = re.findall(code_pattern, content, re.DOTALL)

        for lang, code in matches:
            if language is None or lang == language:
                all_code.append(code.strip())

    return "\n\n".join(all_code)
```

Usage:
```yaml
extractor: code_blocks  # Extract code from markdown blocks
extractor_config:
  language: python  # Optional: only extract Python code blocks
```

### Extract Tool Call Count

```python
from letta_client import ToolCallMessage
from letta_evals.decorators import extractor

@extractor
def tool_call_count(trajectory, config, agent_state=None):
    """Count how many times a specific tool was called."""
    tool_name = config.get("tool_name")
    count = 0

    for turn in trajectory:
        for message in turn:
            if isinstance(message, ToolCallMessage):
                if tool_name is None or message.tool_call.name == tool_name:
                    count += 1

    return str(count)
```

Usage:
```yaml
extractor: tool_call_count  # Count tool invocations
extractor_config:
  tool_name: search  # Optional: count only "search" tool calls
```

### Extract Multiple Memory Blocks

```python
from letta_evals.decorators import extractor

@extractor
def multiple_memory_blocks(trajectory, config, agent_state=None):
    """Extract and concatenate multiple memory blocks."""
    if agent_state is None:
        return ""

    block_labels = config.get("block_labels", ["human", "persona"])
    separator = config.get("separator", "\n---\n")

    blocks = []
    for block in agent_state.memory.blocks:
        if block.label in block_labels:
            blocks.append(f"{block.label}: {block.value}")

    return separator.join(blocks)
```

Usage:
```yaml
extractor: multiple_memory_blocks  # Combine multiple memory blocks
extractor_config:
  block_labels: [human, persona]  # Which blocks to extract
  separator: "\n---\n"  # How to separate them in output
```

## Helper Utilities

The framework provides helper functions:

### get_assistant_messages

```python
from letta_evals.extractors.utils import get_assistant_messages

messages = get_assistant_messages(trajectory)
# Returns list of AssistantMessage objects
```

### get_last_turn_messages

```python
from letta_evals.extractors.utils import get_last_turn_messages
from letta_client import AssistantMessage

messages = get_last_turn_messages(trajectory, AssistantMessage)
# Returns assistant messages from last turn
```

### flatten_content

```python
from letta_evals.extractors.utils import flatten_content

text = flatten_content(message.content)
# Converts complex content to plain text
```

## Agent State Requirements

If your extractor needs agent state, include it in the signature:

```python
@extractor
def my_extractor(trajectory, config, agent_state: Optional[AgentState] = None):
    if agent_state is None:
        raise RuntimeError("This extractor requires agent_state")

    # Use agent_state.memory.blocks, etc.
    ...
```

The runner will automatically fetch agent state when your extractor is used.

**Note**: Fetching agent state adds overhead. Only use when necessary.

## Using Custom Extractors

### Method 1: Custom Evaluators File

Create `custom_evaluators.py`:

```python
from letta_evals.decorators import extractor

@extractor
def my_extractor(trajectory, config, agent_state=None):
    ...
```

The file will be discovered automatically if in the same directory.

### Method 2: Setup Script

Use a setup script to import custom extractors before the suite runs:

```python
# setup.py
from letta_evals.models import SuiteSpec
import custom_extractors  # Imports and registers your @extractor functions

def prepare_environment(suite: SuiteSpec) -> None:
    # Runs before evaluation starts
    pass
```

```yaml
setup_script: setup.py:prepare_environment  # Import custom extractors

graders:
  my_metric:
    extractor: my_extractor  # Now available from custom_extractors
```

## Testing Your Extractor

```python
from letta_client import AssistantMessage

# Mock trajectory
trajectory = [
    [
        AssistantMessage(
            content="The answer is 42",
            role="assistant"
        )
    ]
]

config = {"max_length": 100}
result = my_extractor(trajectory, config)
print(f"Extracted: {result}")
```

## Best Practices

1. **Handle empty trajectories**: Check if messages exist
2. **Return strings**: Always return a string, not None
3. **Use config for flexibility**: Make behavior configurable
4. **Document required config**: Explain config parameters
5. **Handle errors gracefully**: Return empty string on error
6. **Keep it fast**: Extractors run for every sample
7. **Use helper utilities**: Leverage built-in functions

## Next Steps

- [Built-in Extractors](./builtin.md) - Learn from examples
- [Custom Graders](../advanced/custom-graders.md) - Pair with custom grading
- [Core Concepts](../concepts/extractors.md) - How extractors work
