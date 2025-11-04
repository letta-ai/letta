# Multi-Turn Conversations

Multi-turn conversations allow you to test how agents handle context across multiple exchanges - a key capability for stateful agents.

## Why Use Multi-Turn?

Multi-turn conversations enable testing that single-turn prompts cannot:

- **Memory storage**: Verify agents persist information to memory blocks across turns
- **Tool call sequences**: Test multi-step workflows (e.g., search → analyze → summarize)
- **Context retention**: Ensure agents remember details from earlier in the conversation
- **State evolution**: Track how agent state changes across interactions
- **Conversational coherence**: Test if agents maintain context appropriately

This is essential for stateful agents where behavior depends on conversation history.

## Single vs Multi-Turn Format

### Single-Turn (Default)

Most evaluations use a single prompt:

```jsonl
{"input": "What is the capital of France?", "ground_truth": "Paris"}
```

The agent receives one message and responds. Single-turn conversations are useful for simpler agents and for testing next-step behavior.

### Multi-Turn

For testing conversational memory, use an array of messages:

```jsonl
{"input": ["My name is Alice", "What's my name?"], "ground_truth": "Alice"}
```

The agent receives multiple messages in sequence:
1. Turn 1: "My name is Alice"
2. Turn 2: "What's my name?"

See the [built-in extractors](../extractors/builtin.md) for more information on how to use the agent's response from a multi-turn conversation for grading.

## How It Works

When you provide an array for `input`, the framework:
1. Sends the first message to the agent
2. Waits for the agent's response
3. Sends the second message
4. Continues until all messages are sent
5. Extracts and grades the agent's response using the specified extractor and grader.

## Use Cases

### Testing Memory Persistence

```jsonl
{"input": ["I live in Paris", "Where do I live?"], "ground_truth": "Paris"}
```

Tests whether the agent stores information correctly using the `memory_block` extractor.

### Testing Tool Call Sequences

```jsonl
{"input": ["Search for pandas", "What did you find about their diet?"], "ground_truth": "bamboo"}
```

Verifies the agent calls tools in the right order and uses results appropriately.

### Testing Context Retention

```jsonl
{"input": ["My favorite color is blue", "What color do I prefer?"], "ground_truth": "blue"}
```

Ensures the agent recalls details from earlier in the conversation.

### Testing Long-Term Memory

```jsonl
{"input": ["My name is Alice", "Tell me a joke", "What's my name again?"], "ground_truth": "Alice"}
```

Checks if the agent remembers information even after intervening exchanges.

## Example Configuration

```yaml
name: multi-turn-test
dataset: conversations.jsonl

target:
  kind: agent
  agent_file: agent.af
  base_url: http://localhost:8283

graders:
  recall:
    kind: tool
    function: contains
    extractor: last_assistant

gate:
  metric_key: recall
  op: gte
  value: 0.8
```

The grader evaluates the agent's final response (after all turns).

## Testing Both Response and Memory

Multi-turn evaluations become especially powerful when combined with the `memory_block` extractor:

```yaml
graders:
  response_accuracy:
    kind: tool
    function: contains
    extractor: last_assistant

  memory_storage:
    kind: tool
    function: contains
    extractor: memory_block
    extractor_config:
      block_label: human
```

This tests two things:
1. **Did the agent respond correctly?** (using conversation context)
2. **Did the agent persist the information?** (to its memory blocks)

An agent might pass the first test by keeping information in working memory, but fail the second by not properly storing it for long-term recall.

## Context vs Persistence

Consider this result:

```
Results by metric:
  response_accuracy - Avg: 1.00, Pass: 100.0%
  memory_storage    - Avg: 0.00, Pass: 0.0%
```

The agent answered correctly (100%) but didn't store anything in memory (0%). This reveals important agent behavior:

- **Working memory**: Agent kept information in conversation context
- **Persistent memory**: Agent didn't update its memory blocks

For short conversations, working memory is sufficient. For long-term interactions, persistent memory is crucial.

## Complete Example

See [`examples/multi-turn-memory/`](https://github.com/letta-ai/letta-evals/tree/main/examples/multi-turn-memory) for a working example that demonstrates:
- Multi-turn conversation format
- Dual metric evaluation (response + memory)
- The difference between context-based recall and true persistence

## Best Practices

### 1. Keep Turns Focused

Each turn should test one aspect of memory or context:

```jsonl
{"input": ["I'm allergic to peanuts", "Can I eat this cookie?"], "ground_truth": "peanut"}
```

### 2. Test Realistic Scenarios

Design conversations that mirror real user interactions:

```jsonl
{"input": ["Set a reminder for tomorrow at 2pm", "What reminders do I have?"], "ground_truth": "2pm"}
```

### 3. Use Tags for Organization

Tag multi-turn samples to distinguish them:

```jsonl
{"input": ["Hello", "How are you?"], "tags": ["multi-turn", "greeting"]}
```

### 4. Test Memory Limits

See how far back agents can recall:

```jsonl
{"input": ["My name is Alice", "message 2", "message 3", "message 4", "What's my name?"], "ground_truth": "Alice"}
```

### 5. Combine with Memory Extractors

Always verify both response and internal state for memory tests.

## Limitations

### Turn Count

Very long conversations may exceed context windows. Monitor token usage for conversations with many turns.

### State Isolation

Each sample starts with a fresh agent (or fresh conversation if using `agent_id`). Multi-turn tests memory within a single conversation, not across separate conversations.

### Extraction

Most extractors work on the final state. If you need to check intermediate turns, consider using custom extractors.

## Next Steps

- [Built-in Extractors](../extractors/builtin.md) - Using memory_block extractor
- [Custom Extractors](../extractors/custom.md) - Build extractors for complex scenarios
- [Multi-Metric Evaluation](../graders/multi-metric.md) - Combine multiple checks
