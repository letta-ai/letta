# Multi-Metric Evaluation

Evaluate multiple aspects of agent performance simultaneously in a single evaluation suite.

Multi-metric evaluation allows you to define multiple graders, each measuring a different dimension of your agent's behavior. This is essential for comprehensive testing because agent quality isn't just about correctness—you also care about explanation quality, tool usage, format compliance, and more.

**Example**: You might want to check that an agent gives the correct answer (tool grader with `exact_match`), explains it well (rubric grader for clarity), and calls the right tools (tool grader on `tool_arguments`). Instead of running three separate evaluations, you can test all three aspects in one run.

## Why Multiple Metrics?

Agents are complex systems. You might want to evaluate:
- **Correctness**: Does the answer match the expected output?
- **Quality**: Is the explanation clear, complete, and well-structured?
- **Tool usage**: Does the agent call the right tools with correct arguments?
- **Memory**: Does the agent correctly update its memory blocks?
- **Format**: Does the output follow required formatting rules?

Multi-metric evaluation lets you track all of these simultaneously, giving you a holistic view of agent performance.

## Configuration

Define multiple graders under the `graders` section:

```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant  # Check if answer is exactly correct

  completeness:
    kind: rubric
    prompt_path: completeness.txt
    model: gpt-4o-mini
    extractor: last_assistant  # LLM judge evaluates how complete the answer is

  tool_usage:
    kind: tool
    function: contains
    extractor: tool_arguments  # Check if agent called the right tool
    extractor_config:
      tool_name: search
```

Each grader:
- Has a unique key (e.g., `accuracy`, `completeness`)
- Can use different kinds (tool vs rubric)
- Can use different extractors
- Produces independent scores

## Gating on One Metric

While you evaluate multiple metrics, you can only gate on one:

```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant  # Check correctness

  quality:
    kind: rubric
    prompt_path: quality.txt
    model: gpt-4o-mini
    extractor: last_assistant  # Evaluate subjective quality

gate:
  metric_key: accuracy  # Pass/fail based on accuracy only
  op: gte
  value: 0.8  # Require 80% accuracy to pass
```

The evaluation passes/fails based on `accuracy`, but results include both metrics.

## Results Structure

With multiple metrics, results include:

### Per-Sample Results

Each sample has scores for all metrics:

```json
{
  "sample": {...},
  "grades": {
    "accuracy": {"score": 1.0, "rationale": "Exact match: true"},
    "quality": {"score": 0.85, "rationale": "Good response, minor improvements possible"}
  },
  "submissions": {
    "accuracy": "Paris",
    "quality": "Paris"
  }
}
```

Note: If all graders use the same extractor, `submission` and `grade` are also provided for backwards compatibility.

### Aggregate Metrics

```json
{
  "metrics": {
    "by_metric": {
      "accuracy": {
        "avg_score_attempted": 0.95,
        "pass_rate": 95.0,
        "passed_attempts": 19,
        "failed_attempts": 1
      },
      "quality": {
        "avg_score_attempted": 0.82,
        "pass_rate": 80.0,
        "passed_attempts": 16,
        "failed_attempts": 4
      }
    }
  }
}
```

## Use Cases

### Accuracy + Quality

```yaml
graders:
  accuracy:
    kind: tool
    function: contains
    extractor: last_assistant  # Does response contain the answer?

  quality:
    kind: rubric
    prompt_path: quality.txt
    model: gpt-4o-mini
    extractor: last_assistant  # How well is it explained?

gate:
  metric_key: accuracy  # Must be correct to pass
  op: gte
  value: 0.9  # 90% must have correct answer
```

Gate on accuracy (must be correct), but also track quality for insights.

### Content + Format

```yaml
graders:
  content:
    kind: rubric
    prompt_path: content.txt
    model: gpt-4o-mini
    extractor: last_assistant  # Evaluate content quality

  format:
    kind: tool
    function: ascii_printable_only
    extractor: last_assistant  # Check format compliance

gate:
  metric_key: content  # Gate on content quality
  op: gte
  value: 0.7  # Content must score 70% or higher
```

Ensure content quality while checking format constraints.

### Answer + Tool Usage + Memory

```yaml
graders:
  answer:
    kind: tool
    function: contains
    extractor: last_assistant  # Did the agent answer correctly?

  used_tools:
    kind: tool
    function: contains
    extractor: tool_arguments  # Did it call the search tool?
    extractor_config:
      tool_name: search

  memory_updated:
    kind: tool
    function: contains
    extractor: memory_block  # Did it update human memory?
    extractor_config:
      block_label: human

gate:
  metric_key: answer  # Gate on correctness
  op: gte
  value: 0.8  # 80% of answers must be correct
```

Comprehensive evaluation of agent behavior.

### Multiple Quality Dimensions

```yaml
graders:
  accuracy:
    kind: rubric
    prompt: "Rate factual accuracy from 0.0 to 1.0"
    model: gpt-4o-mini
    extractor: last_assistant

  clarity:
    kind: rubric
    prompt: "Rate clarity of explanation from 0.0 to 1.0"
    model: gpt-4o-mini
    extractor: last_assistant

  conciseness:
    kind: rubric
    prompt: "Rate conciseness (not too verbose) from 0.0 to 1.0"
    model: gpt-4o-mini
    extractor: last_assistant

gate:
  metric_key: accuracy
  op: gte
  value: 0.8
```

Track multiple subjective dimensions.

## Display Names

Add human-friendly names for metrics:

```yaml
graders:
  acc:
    display_name: "Accuracy"
    kind: tool
    function: exact_match
    extractor: last_assistant

  qual:
    display_name: "Response Quality"
    kind: rubric
    prompt_path: quality.txt
    model: gpt-4o-mini
    extractor: last_assistant
```

Display names appear in CLI output and visualizations.

## Independent Extraction

Each grader can extract different content:

```yaml
graders:
  final_answer:
    kind: tool
    function: contains
    extractor: last_assistant  # Last thing said

  tool_calls:
    kind: tool
    function: contains
    extractor: all_assistant  # Everything said

  search_usage:
    kind: tool
    function: contains
    extractor: tool_arguments  # Tool arguments
    extractor_config:
      tool_name: search
```

## Analyzing Results

### View All Metrics

CLI output shows all metrics:

```
Results by metric:
  accuracy      - Avg: 0.95, Pass: 95.0%
  quality       - Avg: 0.82, Pass: 80.0%
  tool_usage    - Avg: 0.88, Pass: 88.0%

Gate (accuracy >= 0.9): PASSED
```

### JSON Output

```bash
letta-evals run suite.yaml --output results/
```

Produces:
- `results/summary.json`: Aggregate metrics
- `results/results.jsonl`: Per-sample results with all grades

### Filtering Results

Post-process to find patterns:

```python
import json

# Load results
with open("results/results.jsonl") as f:
    results = [json.loads(line) for line in f]

# Find samples where accuracy=1.0 but quality<0.5
issues = [
    r for r in results
    if r["grades"]["accuracy"]["score"] == 1.0
    and r["grades"]["quality"]["score"] < 0.5
]

print(f"Found {len(issues)} samples with correct but low-quality responses")
```

## Best Practices

### 1. Start with Core Metric

Focus on one primary metric for gating:

```yaml
gate:
  metric_key: accuracy  # Most important
  op: gte
  value: 0.9
```

Use others for diagnostics.

### 2. Combine Tool and Rubric

Use fast tool graders for objective checks, rubric graders for quality:

```yaml
graders:
  correct:
    kind: tool  # Fast, cheap
    function: contains
    extractor: last_assistant

  quality:
    kind: rubric  # Slower, more nuanced
    prompt_path: quality.txt
    model: gpt-4o-mini
    extractor: last_assistant
```

### 3. Track Tool Usage

Add a metric for expected tool calls:

```yaml
graders:
  used_search:
    kind: tool
    function: contains
    extractor: tool_arguments
    extractor_config:
      tool_name: search
```

### 4. Validate Format

Include format checks alongside content:

```yaml
graders:
  content:
    kind: rubric
    prompt_path: content.txt
    model: gpt-4o-mini
    extractor: last_assistant

  ascii_only:
    kind: tool
    function: ascii_printable_only
    extractor: last_assistant
```

### 5. Use Display Names

Make CLI output readable:

```yaml
graders:
  acc:
    display_name: "Answer Accuracy"
    kind: tool
    function: exact_match
    extractor: last_assistant
```

## Cost Implications

Multiple rubric graders multiply API costs:

- 1 grader: $0.00015/sample
- 3 graders: $0.00045/sample
- 5 graders: $0.00075/sample

For 1000 samples with 3 rubric graders: ~$0.45

Mix tool and rubric graders to balance cost and insight.

## Performance

Multiple graders run sequentially per sample, but samples run concurrently:

- 1 grader: ~1s per sample
- 3 graders (2 rubric): ~2s per sample

With 10 concurrent: 1000 samples in ~3-5 minutes

## Next Steps

- [Tool Graders](./tool-graders.md)
- [Rubric Graders](./rubric-graders.md)
- [Understanding Results](../results/overview.md)
