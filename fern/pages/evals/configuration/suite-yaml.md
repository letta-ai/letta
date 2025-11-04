# Suite YAML Reference

Complete reference for suite configuration files.

A **suite** is a YAML file that defines an evaluation: what agent to test, what dataset to use, how to grade responses, and what criteria determine pass/fail. This is your evaluation specification.

**Quick overview:**
- **name**: Identifier for your evaluation
- **dataset**: JSONL file with test cases
- **target**: Which agent to evaluate (via file, ID, or script)
- **graders**: How to score responses (tool or rubric graders)
- **gate**: Pass/fail criteria

See [Getting Started](../getting-started.md) for a tutorial, or [Core Concepts](../concepts/suites.md) for conceptual overview.

## File Structure

```yaml
name: string (required)
description: string (optional)
dataset: path (required)
max_samples: integer (optional)
sample_tags: array (optional)
num_runs: integer (optional)
setup_script: string (optional)

target: object (required)
  kind: "agent"
  base_url: string
  api_key: string
  timeout: float
  project_id: string
  agent_id: string (one of: agent_id, agent_file, agent_script)
  agent_file: path
  agent_script: string
  model_configs: array
  model_handles: array

graders: object (required)
  <metric_key>: object
    kind: "tool" | "rubric"
    display_name: string
    extractor: string
    extractor_config: object
    # Tool grader fields
    function: string
    # Rubric grader fields (LLM API)
    prompt: string
    prompt_path: path
    model: string
    temperature: float
    provider: string
    max_retries: integer
    timeout: float
    rubric_vars: array
    # Rubric grader fields (agent-as-judge)
    agent_file: path
    judge_tool_name: string

gate: object (required)
  metric_key: string
  metric: "avg_score" | "accuracy"
  op: "gte" | "gt" | "lte" | "lt" | "eq"
  value: float
  pass_op: "gte" | "gt" | "lte" | "lt" | "eq"
  pass_value: float
```

## Top-Level Fields

### name (required)

Suite name, used in output and results.

**Type**: string

**Example**:
```yaml
name: question-answering-eval
```

### description (optional)

Human-readable description of what the suite tests.

**Type**: string

**Example**:
```yaml
description: Tests agent's ability to answer factual questions accurately
```

### dataset (required)

Path to JSONL dataset file. Relative paths are resolved from the suite YAML location.

**Type**: path (string)

**Example**:
```yaml
dataset: ./datasets/qa.jsonl
dataset: /absolute/path/to/dataset.jsonl
```

### max_samples (optional)

Limit the number of samples to evaluate. Useful for quick tests.

**Type**: integer

**Default**: All samples

**Example**:
```yaml
max_samples: 10  # Only evaluate first 10 samples
```

### sample_tags (optional)

Filter samples by tags. Only samples with ALL specified tags are evaluated.

**Type**: array of strings

**Example**:
```yaml
sample_tags: [math, easy]  # Only samples tagged with both
```

Dataset samples need tags:
```jsonl
{"input": "What is 2+2?", "ground_truth": "4", "tags": ["math", "easy"]}
```

### num_runs (optional)

Number of times to run the evaluation suite. Useful for testing non-deterministic behavior or collecting multiple runs for statistical analysis.

**Type**: integer

**Default**: 1

**Example**:
```yaml
num_runs: 5  # Run the evaluation 5 times
```

### setup_script (optional)

Path to Python script with setup function.

**Type**: string (format: `path/to/script.py:function_name`)

**Example**:
```yaml
setup_script: setup.py:prepare_environment
```

The function signature:
```python
def prepare_environment(suite: SuiteSpec) -> None:
    # Setup code
    pass
```

## target (required)

Configuration for the agent being evaluated.

### kind (required)

Type of target. Currently only `"agent"` is supported.

**Type**: string

**Example**:
```yaml
target:
  kind: agent
```

### base_url (optional)

Letta server URL.

**Type**: string

**Default**: `http://localhost:8283`

**Example**:
```yaml
target:
  base_url: http://localhost:8283
  # or
  base_url: https://api.letta.com
```

### api_key (optional)

API key for Letta authentication. Can also be set via `LETTA_API_KEY` environment variable.

**Type**: string

**Example**:
```yaml
target:
  api_key: your-api-key-here
```

### timeout (optional)

Request timeout in seconds.

**Type**: float

**Default**: 300.0

**Example**:
```yaml
target:
  timeout: 600.0  # 10 minutes
```

### project_id (optional)

Letta project ID (for Letta Cloud).

**Type**: string

**Example**:
```yaml
target:
  project_id: proj_abc123
```

### Agent Source (required, pick one)

Exactly one of these must be specified:

#### agent_id

ID of existing agent on the server.

**Type**: string

**Example**:
```yaml
target:
  agent_id: agent-123-abc
```

#### agent_file

Path to `.af` agent file.

**Type**: path (string, must end in `.af`)

**Example**:
```yaml
target:
  agent_file: ./agents/my_agent.af
```

#### agent_script

Path to Python script with agent factory.

**Type**: string (format: `path/to/script.py:ClassName`)

**Example**:
```yaml
target:
  agent_script: factory.py:MyAgentFactory
```

See [Targets](../concepts/targets.md) for details on agent sources.

### model_configs (optional)

List of model configuration names to test. Cannot be used with `model_handles`.

**Type**: array of strings

**Example**:
```yaml
target:
  model_configs: [gpt-4o-mini, claude-3-5-sonnet]
```

### model_handles (optional)

List of model handles for cloud deployments. Cannot be used with `model_configs`.

**Type**: array of strings

**Example**:
```yaml
target:
  model_handles: ["openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet"]
```

## graders (required)

One or more graders, each with a unique key.

### Grader Key

The key becomes the metric name:

```yaml
graders:
  accuracy:  # This is the metric_key
    kind: tool
    ...
  quality:  # Another metric_key
    kind: rubric
    ...
```

### kind (required)

Grader type: `"tool"` or `"rubric"`.

**Type**: string

**Example**:
```yaml
graders:
  my_metric:
    kind: tool
```

### display_name (optional)

Human-friendly name for CLI/UI output.

**Type**: string

**Example**:
```yaml
graders:
  acc:
    display_name: "Answer Accuracy"
    kind: tool
    ...
```

### extractor (required)

Name of the extractor to use.

**Type**: string

**Example**:
```yaml
graders:
  my_metric:
    extractor: last_assistant
```

### extractor_config (optional)

Configuration passed to the extractor.

**Type**: object

**Example**:
```yaml
graders:
  my_metric:
    extractor: pattern
    extractor_config:
      pattern: 'Answer: (.*)'
      group: 1
```

### Tool Grader Fields

#### function (required for tool graders)

Name of the grading function.

**Type**: string

**Example**:
```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
```

### Rubric Grader Fields

#### prompt (required if no prompt_path)

Inline rubric prompt.

**Type**: string

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    prompt: |
      Evaluate response quality from 0.0 to 1.0.
      Input: {input}
      Response: {submission}
```

#### prompt_path (required if no prompt)

Path to rubric file. Cannot use both `prompt` and `prompt_path`.

**Type**: path (string)

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubrics/quality.txt
```

#### model (optional)

LLM model for judging.

**Type**: string

**Default**: `gpt-4o-mini`

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    model: gpt-4o
```

#### temperature (optional)

Temperature for LLM generation.

**Type**: float (0.0 to 2.0)

**Default**: 0.0

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    temperature: 0.0
```

#### provider (optional)

LLM provider.

**Type**: string

**Default**: `openai`

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    provider: openai
```

#### max_retries (optional)

Maximum retry attempts for API calls.

**Type**: integer

**Default**: 5

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    max_retries: 3
```

#### timeout (optional)

Timeout for API calls in seconds.

**Type**: float

**Default**: 120.0

**Example**:
```yaml
graders:
  quality:
    kind: rubric
    timeout: 60.0
```

#### rubric_vars (optional)

List of custom variable names that must be provided in the dataset for rubric template substitution. When specified, the grader validates that each sample includes these variables in its `rubric_vars` field.

**Type**: array of strings

**Example**:
```yaml
graders:
  code_quality:
    kind: rubric
    rubric_vars: [reference_code, required_features]  # Require these variables in dataset
    prompt: |
      Compare the submission to this reference:
      {reference_code}

      Required features: {required_features}
```

Dataset sample must provide these variables:
```jsonl
{"input": "Write a fibonacci function", "rubric_vars": {"reference_code": "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)", "required_features": "recursion, base case"}}
```

See [Datasets - rubric_vars](../concepts/datasets.md#rubric_vars) for details.

#### agent_file (required for agent-as-judge)

Path to `.af` agent file to use as judge for rubric grading. Use this instead of `model` when you want a Letta agent to act as the evaluator.

**Type**: path (string)

**Mutually exclusive with**: `model`, `temperature`, `provider`, `max_retries`, `timeout`

**Example**:
```yaml
graders:
  agent_judge:
    kind: rubric
    agent_file: judge.af  # Judge agent with submit_grade tool
    prompt_path: rubric.txt  # Evaluation criteria
    extractor: last_assistant
```

**Requirements**: The judge agent must have a tool with signature `submit_grade(score: float, rationale: str)`. The framework validates this on initialization.

See [Rubric Graders - Agent-as-Judge](../graders/rubric-graders.md#agent-as-judge) for complete documentation.

#### judge_tool_name (optional, for agent-as-judge)

Name of the tool that the judge agent uses to submit scores. Only applicable when using `agent_file`.

**Type**: string

**Default**: `submit_grade`

**Example**:
```yaml
graders:
  agent_judge:
    kind: rubric
    agent_file: judge.af
    judge_tool_name: submit_grade  # Default, can be omitted
    prompt_path: rubric.txt
    extractor: last_assistant
```

**Tool requirements**: The tool must have exactly two parameters:
- `score: float` - Score between 0.0 and 1.0
- `rationale: str` - Explanation of the score

## gate (required)

Pass/fail criteria for the evaluation.

### metric_key (optional)

Which grader to evaluate. If only one grader, this can be omitted.

**Type**: string

**Example**:
```yaml
gate:
  metric_key: accuracy  # Must match a key in graders
```

### metric (optional)

Which aggregate to compare: `avg_score` or `accuracy`.

**Type**: string

**Default**: `avg_score`

**Example**:
```yaml
gate:
  metric: avg_score
  # or
  metric: accuracy
```

### op (required)

Comparison operator.

**Type**: string (one of: `gte`, `gt`, `lte`, `lt`, `eq`)

**Example**:
```yaml
gate:
  op: gte  # Greater than or equal
```

### value (required)

Threshold value for comparison.

**Type**: float (0.0 to 1.0)

**Example**:
```yaml
gate:
  value: 0.8  # Require >= 0.8
```

### pass_op (optional)

Comparison operator for per-sample pass criteria.

**Type**: string (one of: `gte`, `gt`, `lte`, `lt`, `eq`)

**Default**: Same as `op`

**Example**:
```yaml
gate:
  metric: accuracy
  pass_op: gte  # Sample passes if...
  pass_value: 0.7  # ...score >= 0.7
```

### pass_value (optional)

Threshold for per-sample pass.

**Type**: float (0.0 to 1.0)

**Default**: Same as `value` (or 1.0 for accuracy metric)

**Example**:
```yaml
gate:
  metric: accuracy
  op: gte
  value: 0.8  # 80% must pass
  pass_op: gte
  pass_value: 0.7  # Sample passes if score >= 0.7
```

## Complete Examples

### Minimal Suite

```yaml
name: basic-eval
dataset: dataset.jsonl

target:
  kind: agent
  agent_file: agent.af

graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant

gate:
  op: gte
  value: 0.8
```

### Multi-Metric Suite

```yaml
name: comprehensive-eval
description: Tests accuracy and quality
dataset: test_data.jsonl
max_samples: 100

target:
  kind: agent
  agent_file: agent.af
  base_url: http://localhost:8283

graders:
  accuracy:
    display_name: "Answer Accuracy"
    kind: tool
    function: contains
    extractor: last_assistant

  quality:
    display_name: "Response Quality"
    kind: rubric
    prompt_path: rubrics/quality.txt
    model: gpt-4o-mini
    temperature: 0.0
    extractor: last_assistant

gate:
  metric_key: accuracy
  metric: avg_score
  op: gte
  value: 0.85
```

### Advanced Suite

```yaml
name: advanced-eval
description: Multi-model, multi-metric evaluation
dataset: comprehensive_tests.jsonl
sample_tags: [production]
setup_script: setup.py:prepare

target:
  kind: agent
  agent_script: factory.py:CustomFactory
  base_url: https://api.letta.com
  api_key: ${LETTA_API_KEY}
  project_id: proj_abc123
  model_configs: [gpt-4o-mini, claude-3-5-sonnet]

graders:
  answer:
    kind: tool
    function: exact_match
    extractor: last_assistant

  tool_usage:
    kind: tool
    function: contains
    extractor: tool_arguments
    extractor_config:
      tool_name: search

  memory:
    kind: tool
    function: contains
    extractor: memory_block
    extractor_config:
      block_label: human

gate:
  metric_key: answer
  metric: accuracy
  op: gte
  value: 0.9
  pass_op: gte
  pass_value: 1.0
```

## Validation

Validate your suite before running:

```bash
letta-evals validate suite.yaml
```

## Next Steps

- [Targets](../concepts/targets.md) - Understanding agent sources and configuration
- [Graders](../concepts/graders.md) - Tool graders vs rubric graders
- [Extractors](../concepts/extractors.md) - What to extract from agent responses
- [Gates](../concepts/gates.md) - Setting pass/fail criteria
