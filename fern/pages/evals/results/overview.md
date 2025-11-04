# Understanding Results

This guide explains how to interpret evaluation results.

## Result Structure

An evaluation produces three types of output:

1. **Console output**: Real-time progress and summary
2. **Summary JSON**: Aggregate metrics and configuration
3. **Results JSONL**: Per-sample detailed results

## Console Output

### Progress Display

```
Running evaluation: my-eval-suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3/3 100%

Results:
  Total samples: 3
  Attempted: 3
  Avg score: 0.83 (attempted: 0.83)
  Passed: 2 (66.7%)

Gate (quality >= 0.75): PASSED
```

### Quiet Mode

```bash
letta-evals run suite.yaml --quiet
```

Output:
```
✓ PASSED
```

or

```
✗ FAILED
```

## JSON Output

### Saving Results

```bash
letta-evals run suite.yaml --output results/
```

Creates three files:

#### header.json

Evaluation metadata:

```json
{
  "suite_name": "my-eval-suite",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "0.3.0"
}
```

#### summary.json

Complete evaluation summary:

```json
{
  "suite": "my-eval-suite",
  "config": {
    "target": {...},
    "graders": {...},
    "gate": {...}
  },
  "metrics": {
    "total": 10,
    "total_attempted": 10,
    "avg_score_attempted": 0.85,
    "avg_score_total": 0.85,
    "passed_attempts": 8,
    "failed_attempts": 2,
    "by_metric": {
      "accuracy": {
        "avg_score_attempted": 0.90,
        "pass_rate": 90.0,
        "passed_attempts": 9,
        "failed_attempts": 1
      },
      "quality": {
        "avg_score_attempted": 0.80,
        "pass_rate": 70.0,
        "passed_attempts": 7,
        "failed_attempts": 3
      }
    }
  },
  "gates_passed": true
}
```

#### results.jsonl

One JSON object per line, each representing one sample:

```jsonl
{"sample": {"id": 0, "input": "What is 2+2?", "ground_truth": "4"}, "submission": "4", "grade": {"score": 1.0, "rationale": "Exact match: true"}, "trajectory": [...], "agent_id": "agent-123", "model_name": "default"}
{"sample": {"id": 1, "input": "What is 3+3?", "ground_truth": "6"}, "submission": "6", "grade": {"score": 1.0, "rationale": "Exact match: true"}, "trajectory": [...], "agent_id": "agent-124", "model_name": "default"}
```

## Metrics Explained

### total

Total number of samples in the evaluation (including errors).

### total_attempted

Number of samples that completed without errors.

If a sample fails during agent execution or grading, it's counted in `total` but not `total_attempted`.

### avg_score_attempted

Average score across samples that completed successfully.

Formula: `sum(scores) / total_attempted`

Range: 0.0 to 1.0

### avg_score_total

Average score across all samples, treating errors as 0.0.

Formula: `sum(scores) / total`

Range: 0.0 to 1.0

### passed_attempts / failed_attempts

Number of samples that passed/failed the gate's per-sample criteria.

By default:
- If gate metric is `accuracy`: sample passes if score >= 1.0
- If gate metric is `avg_score`: sample passes if score >= gate value

Can be customized with `pass_op` and `pass_value` in gate config.

### by_metric

For multi-metric evaluation, shows aggregate stats for each metric:

```json
"by_metric": {
  "accuracy": {
    "avg_score_attempted": 0.90,
    "avg_score_total": 0.85,
    "pass_rate": 90.0,
    "passed_attempts": 9,
    "failed_attempts": 1
  }
}
```

## Sample Results

Each sample result includes:

### sample
The original dataset sample:
```json
"sample": {
  "id": 0,
  "input": "What is 2+2?",
  "ground_truth": "4",
  "metadata": {...}
}
```

### submission
The extracted text that was graded:
```json
"submission": "The answer is 4"
```

### grade
The grading result:
```json
"grade": {
  "score": 1.0,
  "rationale": "Contains ground_truth: true",
  "metadata": {"model": "gpt-4o-mini", "usage": {...}}
}
```

### grades (multi-metric)
For multi-metric evaluation:
```json
"grades": {
  "accuracy": {"score": 1.0, "rationale": "Exact match"},
  "quality": {"score": 0.85, "rationale": "Good but verbose"}
}
```

### trajectory
The complete conversation history:
```json
"trajectory": [
  [
    {"role": "user", "content": "What is 2+2?"},
    {"role": "assistant", "content": "The answer is 4"}
  ]
]
```

### agent_id
The ID of the agent that generated this response:
```json
"agent_id": "agent-abc-123"
```

### model_name
The model configuration used:
```json
"model_name": "gpt-4o-mini"
```

### agent_usage
Token usage statistics (if available):
```json
"agent_usage": [
  {"completion_tokens": 10, "prompt_tokens": 50, "total_tokens": 60}
]
```

## Interpreting Scores

### Score Ranges

- **1.0**: Perfect - fully meets criteria
- **0.8-0.99**: Very good - minor issues
- **0.6-0.79**: Good - notable improvements possible
- **0.4-0.59**: Acceptable - significant issues
- **0.2-0.39**: Poor - major problems
- **0.0-0.19**: Failed - did not meet criteria

### Binary vs Continuous

**Tool graders** typically return binary scores:
- 1.0: Passed
- 0.0: Failed

**Rubric graders** return continuous scores:
- Any value from 0.0 to 1.0
- Allows for partial credit

## Multi-Model Results

When testing multiple models:

```json
"metrics": {
  "per_model": [
    {
      "model_name": "gpt-4o-mini",
      "avg_score_attempted": 0.85,
      "passed_samples": 8,
      "failed_samples": 2
    },
    {
      "model_name": "claude-3-5-sonnet",
      "avg_score_attempted": 0.90,
      "passed_samples": 9,
      "failed_samples": 1
    }
  ]
}
```

Console output:
```
Results by model:
  gpt-4o-mini         - Avg: 0.85, Pass: 80.0%
  claude-3-5-sonnet   - Avg: 0.90, Pass: 90.0%
```

## Multiple Runs Statistics

Run evaluations multiple times to measure consistency and get aggregate statistics.

### Configuration

Specify in YAML:
```yaml
name: my-eval-suite
dataset: dataset.jsonl
num_runs: 5  # Run 5 times
target:
  kind: agent
  agent_file: my_agent.af
graders:
  accuracy:
    kind: tool
    function: exact_match
gate:
  metric_key: accuracy
  op: gte
  value: 0.8
```

Or via CLI:
```bash
letta-evals run suite.yaml --num-runs 10 --output results/
```

### Output Structure

```
results/
├── run_1/
│   ├── header.json
│   ├── results.jsonl
│   └── summary.json
├── run_2/
│   ├── header.json
│   ├── results.jsonl
│   └── summary.json
├── ...
└── aggregate_stats.json  # Statistics across all runs
```

### Aggregate Statistics File

The `aggregate_stats.json` includes statistics across all runs:

```json
{
  "num_runs": 10,
  "runs_passed": 8,
  "runs_failed": 2,
  "pass_rate": 80.0,
  "avg_score_attempted": {
    "mean": 0.847,
    "std": 0.042,
    "min": 0.78,
    "max": 0.91
  },
  "avg_score_total": {
    "mean": 0.847,
    "std": 0.042,
    "min": 0.78,
    "max": 0.91
  },
  "per_metric": {
    "accuracy": {
      "avg_score_attempted": {
        "mean": 0.89,
        "std": 0.035,
        "min": 0.82,
        "max": 0.95
      },
      "pass_rate": {
        "mean": 89.0,
        "std": 4.2,
        "min": 80.0,
        "max": 95.0
      }
    }
  }
}
```

### Use Cases

**Measure consistency of non-deterministic agents:**
```bash
letta-evals run suite.yaml --num-runs 20 --output results/
# Check stddev in aggregate_stats.json
# Low stddev = consistent, high stddev = variable
```

**Get confidence intervals:**
```python
import json
import math

with open("results/aggregate_stats.json") as f:
    stats = json.load(f)

mean = stats["avg_score_attempted"]["mean"]
std = stats["avg_score_attempted"]["std"]
n = stats["num_runs"]

# 95% confidence interval (assuming normal distribution)
margin = 1.96 * (std / math.sqrt(n))
print(f"Score: {mean:.3f} ± {margin:.3f}")
```

## Error Handling

If a sample encounters an error:

```json
{
  "sample": {...},
  "submission": "",
  "grade": {
    "score": 0.0,
    "rationale": "Error during grading: Connection timeout",
    "metadata": {"error": "timeout", "error_type": "ConnectionError"}
  }
}
```

Errors:
- Count toward `total` but not `total_attempted`
- Get score of 0.0
- Include error details in rationale and metadata

## Analyzing Results

### Find Low Scores

```python
import json

with open("results/results.jsonl") as f:
    results = [json.loads(line) for line in f]

low_scores = [r for r in results if r["grade"]["score"] < 0.5]
print(f"Found {len(low_scores)} samples with score < 0.5")

for result in low_scores:
    print(f"Sample {result['sample']['id']}: {result['grade']['rationale']}")
```

### Compare Metrics

```python
# Load summary
with open("results/summary.json") as f:
    summary = json.load(f)

metrics = summary["metrics"]["by_metric"]
for name, stats in metrics.items():
    print(f"{name}: {stats['avg_score_attempted']:.2f} avg, {stats['pass_rate']:.1f}% pass")
```

### Extract Failures

```python
# Find samples that failed gate criteria
failures = [
    r for r in results
    if not gate_passed(r["grade"]["score"])  # Your gate logic
]
```

## Next Steps

- [Metrics Reference](./metrics.md)
- [Output Formats](./output-formats.md)
- [Best Practices](../best-practices/writing-tests.md)
