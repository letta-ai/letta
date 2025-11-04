# Built-in Extractors Reference

Letta Evals provides a set of built-in extractors that cover the most common extraction needs. These extractors let you pull specific content from agent conversations without writing any custom code.

**What are extractors?** Extractors determine what part of an agent's response gets evaluated. They take the full conversation trajectory (all messages, tool calls, and state changes) and extract just the piece you want to grade.

**Common use cases:**
- Extract the agent's final answer (`last_assistant`)
- Check what tools were called and with what arguments (`tool_arguments`)
- Verify memory was updated correctly (`memory_block`)
- Parse structured output with regex (`pattern`)
- Get all messages from a conversation (`all_assistant`)

**Quick example:**
```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant  # Extract final response
```

Each extractor below can be used with any grader by specifying it in your suite YAML. For custom extraction logic, see [Custom Extractors](./custom.md).

## `last_assistant`

Extracts the last assistant message content.

**Configuration**: None required

**Example**:
```yaml
extractor: last_assistant
```

**Use case**: Most common - get the agent's final response

**Output**: Content of the last assistant message

## `first_assistant`

Extracts the first assistant message content.

**Configuration**: None required

**Example**:
```yaml
extractor: first_assistant
```

**Use case**: Test immediate responses before tool usage

**Output**: Content of the first assistant message

## `all_assistant`

Concatenates all assistant messages with a separator.

**Configuration**:
- `separator` (optional): String to join messages (default: `"\n"`)

**Example**:
```yaml
extractor: all_assistant  # Get all agent messages
extractor_config:
  separator: "\n\n"  # Separate with double newlines
```

**Use case**: Evaluate complete conversation context

**Output**: All assistant messages joined by separator

## last_turn

Extracts all assistant messages from the last conversation turn.

**Configuration**:
- `separator` (optional): String to join messages (default: `"\n"`)

**Example**:
```yaml
extractor: last_turn  # Get messages from final turn
extractor_config:
  separator: " "  # Join with spaces
```

**Use case**: When agent makes multiple statements in final turn

**Output**: Assistant messages from last turn joined by separator

## pattern

Extracts content matching a regex pattern.

**Configuration**:
- `pattern` (required): Regex pattern to match
- `group` (optional): Capture group to extract (default: 0)
- `search_all` (optional): Find all matches vs first match (default: false)

**Example**:
```yaml
extractor: pattern  # Extract using regex
extractor_config:
  pattern: 'Result: (\d+)'  # Match "Result: " followed by digits
  group: 1  # Extract just the number (capture group 1)
```

**Use case**: Extract structured content (numbers, codes, formatted output)

**Output**: Matched pattern or capture group

## tool_arguments

Extracts arguments from a specific tool call.

**Configuration**:
- `tool_name` (required): Name of the tool to extract from

**Example**:
```yaml
extractor: tool_arguments  # Extract tool call arguments
extractor_config:
  tool_name: search  # Get arguments from "search" tool
```

**Use case**: Validate tool was called with correct arguments

**Output**: JSON string of tool arguments

Example output: `{"query": "pandas", "limit": 10}`

## tool_output

Extracts the return value from a specific tool call.

**Configuration**:
- `tool_name` (required): Name of the tool whose output to extract

**Example**:
```yaml
extractor: tool_output  # Extract tool return value
extractor_config:
  tool_name: search  # Get return value from "search" tool
```

**Use case**: Check tool return values

**Output**: Tool return value as string

## after_marker

Extracts content after a specific marker string.

**Configuration**:
- `marker` (required): String marker to search for
- `include_marker` (optional): Include marker in output (default: false)

**Example**:
```yaml
extractor: after_marker  # Extract content after a marker
extractor_config:
  marker: "ANSWER:"  # Find this marker in the response
  include_marker: false  # Don't include "ANSWER:" in output
```

**Use case**: Extract structured responses with markers

**Output**: Content after the marker

Example: From "Analysis... ANSWER: Paris", extracts "Paris"

## memory_block

Extracts content from a specific memory block.

**Configuration**:
- `block_label` (required): Label of the memory block

**Example**:
```yaml
extractor: memory_block  # Extract from agent memory
extractor_config:
  block_label: human  # Get content from "human" memory block
```

**Use case**: Validate agent memory updates

**Output**: Content of the specified memory block

**Important**: This extractor requires agent_state, which adds overhead. The runner automatically fetches it when needed.

## Quick Reference Table

| Extractor | Config Required | Use Case | Agent State? |
|-----------|----------------|----------|--------------|
| `last_assistant` | No | Final response | No |
| `first_assistant` | No | Initial response | No |
| `all_assistant` | Optional | Full conversation | No |
| `last_turn` | Optional | Final turn messages | No |
| `pattern` | Yes | Regex extraction | No |
| `tool_arguments` | Yes | Tool call args | No |
| `tool_output` | Yes | Tool return value | No |
| `after_marker` | Yes | Marker-based extraction | No |
| `memory_block` | Yes | Memory content | Yes |

## Listing Extractors

See all available extractors:

```bash
letta-evals list-extractors
```

## Next Steps

- [Custom Extractors](./custom.md) - Write your own extraction logic
- [Core Concepts: Extractors](../concepts/extractors.md) - How extractors work in the evaluation flow
- [Graders](../concepts/graders.md) - Using extractors with graders
