# Getting Started with Letta Evals

This guide will help you get up and running with Letta Evals in minutes.

## What is Letta Evals?

Letta Evals is a framework for testing Letta AI agents. It allows you to:

- Test agent responses against expected outputs
- Evaluate subjective quality using LLM judges
- Test tool usage and memory updates
- Track metrics across multiple evaluation runs
- Gate deployments on quality thresholds

Unlike most evaluation frameworks designed for simple input-output models, Letta Evals is built for [stateful agents](https://www.letta.com/blog/stateful-agents) that maintain memory, use tools, and evolve over time.

## Prerequisites

- Python 3.11 or higher
- A running Letta server ([local](https://docs.letta.com/guides/selfhosting) or [Letta Cloud](https://docs.letta.com/guides/cloud/overview))
- A Letta agent to test, either in agent file format or by ID (see [Targets](./concepts/targets.md) for more details)

## Installation

```bash
pip install letta-evals
```

Or with uv:

```bash
uv pip install letta-evals
```

## Getting an Agent to Test

Before you can run evaluations, you need a Letta agent. You have two options:

### Option 1: Use an Agent File (.af)

Export an existing agent to a file using the Letta SDK:

```python
from letta_client import Letta
import os

client = Letta(
    base_url="http://localhost:8283",  # or https://api.letta.com for Letta Cloud
    token=os.getenv("LETTA_API_KEY")  # required for Letta Cloud
)

# Export an agent to a file
agent_file = client.agents.export_file(agent_id="agent-123")

# Save to disk
with open("my_agent.af", "w") as f:
    f.write(agent_file)
```

Or export via the Agent Development Environment (ADE) by selecting "Export Agent".

This creates an `.af` file which you can reference in your suite configuration:

```yaml
target:
  kind: agent
  agent_file: my_agent.af
```

**How it works:** When using an agent file, a fresh agent instance is created for each sample in your dataset. Each test runs independently with a clean slate, making this ideal for parallel testing across different inputs.

**Example:** If your dataset has 5 samples, 5 separate agents will be created and can run in parallel. Each agent starts fresh with no memory of the other tests.

### Option 2: Use an Existing Agent ID

If you already have a running agent, use its ID directly:

```python
from letta_client import Letta
import os

client = Letta(
    base_url="http://localhost:8283",  # or https://api.letta.com for Letta Cloud
    token=os.getenv("LETTA_API_KEY")  # required for Letta Cloud
)

# List all agents
agents = client.agents.list()
for agent in agents:
    print(f"Agent: {agent.name}, ID: {agent.id}")
```

Then reference it in your suite:

```yaml
target:
  kind: agent
  agent_id: agent-abc-123
```

**How it works:** The same agent instance is used for all samples, processing them sequentially. The agent's state (memory, message history) carries over between samples, making the dataset behave more like a conversation script than independent test cases.

**Example:** If your dataset has 5 samples, they all run against the same agent one after another. The agent "remembers" each previous interaction, so sample 3 can reference information from samples 1 and 2.

### Which Should You Use?

**Agent File (.af)** - Use when testing independent scenarios

Best for testing how the agent responds to independent, isolated inputs. Each sample gets a fresh agent with no prior context. Tests can run in parallel.

**Typical scenarios:**
- "How does the agent answer different questions?"
- "Does the agent correctly use tools for various tasks?"
- "Testing behavior across different prompts"

**Agent ID** - Use when testing conversational flows

Best for testing conversational flows or scenarios where context should build up over time. The agent's state accumulates as it processes each sample sequentially.

**Typical scenarios:**
- "Does the agent remember information across a conversation?"
- "How does the agent's memory evolve over multiple exchanges?"
- "Simulating a realistic user session with multiple requests"

**Recommendation:** For most evaluation scenarios, use agent files to ensure consistent, reproducible test conditions. Only use agent IDs when you specifically want to test stateful, sequential interactions.

For more details on agent lifecycle and testing behaviors, see the [Targets guide](./concepts/targets.md#agent-lifecycle-and-testing-behavior).

## Quick Start

Let's create your first evaluation in 3 steps:

### 1. Create a Test Dataset

Create a file named `dataset.jsonl`:

```jsonl
{"input": "What's the capital of France?", "ground_truth": "Paris"}
{"input": "Calculate 2+2", "ground_truth": "4"}
{"input": "What color is the sky?", "ground_truth": "blue"}
```

Each line is a JSON object with:
- `input`: The prompt to send to your agent
- `ground_truth`: The expected answer (used for grading)

Note: `ground_truth` is optional for some graders (like rubric graders), but required for tool graders like `contains` and `exact_match`.

Read more about [Datasets](./concepts/datasets.md) for details on how to create your dataset.

### 2. Create a Suite Configuration

Create a file named `suite.yaml`:

```yaml
name: my-first-eval
dataset: dataset.jsonl

target:
  kind: agent
  agent_file: my_agent.af  # Path to your agent file
  base_url: http://localhost:8283  # Your Letta server

graders:
  quality:
    kind: tool
    function: contains  # Check if response contains the ground truth
    extractor: last_assistant  # Use the last assistant message

gate:
  metric_key: quality
  op: gte
  value: 0.75  # Require 75% pass rate
```

The suite configuration defines:
- The [dataset](./concepts/datasets.md) to use
- The [agent](./concepts/targets.md) to test
- The [graders](./concepts/graders.md) to use
- The [gate](./concepts/gates.md) criteria

Read more about [Suites](./concepts/suites.md) for details on how to configure your evaluation.

### 3. Run the Evaluation

Run your evaluation with the following command:

```bash
letta-evals run suite.yaml
```

You'll see real-time progress as your evaluation runs:

```
Running evaluation: my-first-eval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3/3 100%
✓ PASSED (2.25/3.00 avg, 75.0% pass rate)
```

Read more about [CLI Commands](./cli/commands.md) for details about the available commands and options.

## Understanding the Results

The core evaluation flow is:

**Dataset → Target (Agent) → Extractor → Grader → Gate → Result**

The evaluation runner:
1. Loads your dataset
2. Sends each input to your agent (Target)
3. Extracts the relevant information (using the Extractor)
4. Grades the response (using the Grader function)
5. Computes aggregate metrics
6. Checks if metrics pass the Gate criteria

The output shows:
- **Average score**: Mean score across all samples
- **Pass rate**: Percentage of samples that passed
- **Gate status**: Whether the evaluation passed or failed overall

## Next Steps

Now that you've run your first evaluation, explore more advanced features:

- [Core Concepts](./concepts/overview.md) - Understand suites, datasets, graders, and extractors
- [Grader Types](./concepts/graders.md) - Learn about tool graders vs rubric graders
- [Multi-Metric Evaluation](./graders/multi-metric.md) - Test multiple aspects simultaneously
- [Custom Graders](./advanced/custom-graders.md) - Write custom grading functions
- [Multi-Turn Conversations](./advanced/multi-turn-conversations.md) - Test conversational memory

## Common Use Cases

### Strict Answer Checking

Use exact matching for cases where the answer must be precisely correct:

```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant
```

### Subjective Quality Evaluation

Use an LLM judge to evaluate subjective qualities like helpfulness or tone:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini
    extractor: last_assistant
```

Then create `rubric.txt`:
```
Rate the helpfulness and accuracy of the response.
- Score 1.0 if helpful and accurate
- Score 0.5 if partially helpful
- Score 0.0 if unhelpful or wrong
```

### Testing Tool Calls

Verify that your agent calls specific tools with expected arguments:

```yaml
graders:
  tool_check:
    kind: tool
    function: contains
    extractor: tool_arguments
    extractor_config:
      tool_name: search
```

### Testing Memory Persistence

Check if the agent correctly updates its memory blocks:

```yaml
graders:
  memory_check:
    kind: tool
    function: contains
    extractor: memory_block
    extractor_config:
      block_label: human
```

## Troubleshooting

**"Agent file not found"**

Make sure your `agent_file` path is correct. Paths are relative to the suite YAML file location. Use absolute paths if needed:

```yaml
target:
  agent_file: /absolute/path/to/my_agent.af
```

**"Connection refused"**

Your Letta server isn't running or isn't accessible. Start it with:

```bash
letta server
```

By default, it runs at `http://localhost:8283`.

**"No ground_truth provided"**

Tool graders like `exact_match` and `contains` require `ground_truth` in your dataset. Either:
- Add `ground_truth` to your samples, or
- Use a rubric grader which doesn't require ground truth

**Agent didn't respond as expected**

Try testing your agent manually first using the Letta SDK or Agent Development Environment (ADE) to see how it behaves before running evaluations. See the [Letta documentation](https://docs.letta.com) for more information.

For more help, see the [Troubleshooting Guide](./troubleshooting.md).
