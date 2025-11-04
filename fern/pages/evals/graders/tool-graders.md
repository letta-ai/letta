# Tool Graders

Tool graders use Python functions to programmatically evaluate submissions. They're ideal for deterministic, rule-based evaluation.

## Overview

Tool graders:
- Execute Python functions that take `(sample, submission)` and return a `GradeResult`
- Are fast and deterministic
- Don't require external API calls
- Can implement any custom logic

## Configuration

```yaml
graders:
  my_metric:
    kind: tool
    function: exact_match  # Function name
    extractor: last_assistant  # What to extract from trajectory
```

The `extractor` determines what part of the agent's response to evaluate. See [Built-in Extractors](../extractors/builtin.md) for all available options.

## Built-in Functions

### exact_match

Exact string comparison (case-sensitive, whitespace-trimmed).

```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match
    extractor: last_assistant
```

**Requires**: `ground_truth` in dataset

**Returns**:
- Score: 1.0 if exact match, 0.0 otherwise
- Rationale: "Exact match: true" or "Exact match: false"

**Example**:
```jsonl
{"input": "What is 2+2?", "ground_truth": "4"}
```

Submission "4" → Score 1.0
Submission "four" → Score 0.0

### contains

Case-insensitive substring check.

```yaml
graders:
  keyword_check:
    kind: tool
    function: contains
    extractor: last_assistant
```

**Requires**: `ground_truth` in dataset

**Returns**:
- Score: 1.0 if ground_truth found in submission (case-insensitive), 0.0 otherwise
- Rationale: "Contains ground_truth: true" or "Contains ground_truth: false"

**Example**:
```jsonl
{"input": "What is the capital of France?", "ground_truth": "Paris"}
```

Submission "The capital is Paris" → Score 1.0
Submission "The capital is paris" → Score 1.0 (case-insensitive)
Submission "The capital is Lyon" → Score 0.0

### regex_match

Pattern matching using regex.

```yaml
graders:
  pattern_check:
    kind: tool
    function: regex_match
    extractor: last_assistant
```

**Requires**: `ground_truth` in dataset (as regex pattern)

**Returns**:
- Score: 1.0 if pattern matches, 0.0 otherwise
- Rationale: "Regex match: true" or "Regex match: false"
- If pattern is invalid: Score 0.0 with error message

**Example**:
```jsonl
{"input": "Generate a UUID", "ground_truth": "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"}
{"input": "Extract the number", "ground_truth": "\\d+"}
```

Submission "550e8400-e29b-41d4-a716-446655440000" → Score 1.0
Submission "not-a-uuid" → Score 0.0

### ascii_printable_only

Validates that all characters are printable ASCII (code points 32-126).

```yaml
graders:
  ascii_check:
    kind: tool
    function: ascii_printable_only
    extractor: last_assistant
```

**Requires**: No ground_truth needed

**Returns**:
- Score: 1.0 if all characters are printable ASCII, 0.0 if any non-printable found
- Rationale: Details about non-printable characters if found

**Notes**:
- Newlines (`\n`) and carriage returns (`\r`) are ignored (allowed)
- Useful for ASCII art, formatted output, or ensuring clean text

**Example**:

Submission "Hello, World!\n" → Score 1.0
Submission "Hello 🌍" → Score 0.0 (emoji not in ASCII range)

## Custom Tool Graders

You can write custom grading functions:

```python
# custom_graders.py
from letta_evals.decorators import grader
from letta_evals.models import GradeResult, Sample

@grader
def my_custom_grader(sample: Sample, submission: str) -> GradeResult:
    """Custom grading logic."""
    # Your evaluation logic here
    score = 1.0 if some_condition(submission) else 0.0
    return GradeResult(
        score=score,
        rationale=f"Explanation of the score",
        metadata={"extra": "info"}
    )
```

Then reference it in your suite:

```yaml
graders:
  custom:
    kind: tool
    function: my_custom_grader
    extractor: last_assistant
```

See [Custom Graders](../advanced/custom-graders.md) for details.

## Use Cases

### Exact Answer Validation

```yaml
graders:
  correct_answer:
    kind: tool
    function: exact_match
    extractor: last_assistant
```

Best for: Math problems, single-word answers, structured formats

### Keyword Presence

```yaml
graders:
  mentions_topic:
    kind: tool
    function: contains
    extractor: last_assistant
```

Best for: Checking if specific concepts are mentioned

### Format Validation

```yaml
graders:
  valid_email:
    kind: tool
    function: regex_match
    extractor: last_assistant
```

Dataset:
```jsonl
{"input": "Extract the email", "ground_truth": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"}
```

Best for: Emails, UUIDs, phone numbers, structured data

### Tool Call Validation

```yaml
graders:
  used_search:
    kind: tool
    function: contains
    extractor: tool_arguments
    extractor_config:
      tool_name: search
```

Dataset:
```jsonl
{"input": "Find information about pandas", "ground_truth": "pandas"}
```

Checks if the agent called the search tool with "pandas" in arguments.

### JSON Structure Validation

Custom grader:

```python
import json
from letta_evals.decorators import grader
from letta_evals.models import GradeResult, Sample

@grader
def valid_json_with_field(sample: Sample, submission: str) -> GradeResult:
    try:
        data = json.loads(submission)
        required_field = sample.ground_truth
        if required_field in data:
            return GradeResult(score=1.0, rationale=f"Valid JSON with '{required_field}' field")
        else:
            return GradeResult(score=0.0, rationale=f"Missing required field: {required_field}")
    except json.JSONDecodeError as e:
        return GradeResult(score=0.0, rationale=f"Invalid JSON: {e}")
```

## Combining with Extractors

Tool graders work with any extractor:

### Grade Tool Arguments

```yaml
graders:
  correct_tool:
    kind: tool
    function: exact_match
    extractor: tool_arguments
    extractor_config:
      tool_name: calculator
```

Checks if calculator was called with specific arguments.

### Grade Memory Updates

```yaml
graders:
  memory_correct:
    kind: tool
    function: contains
    extractor: memory_block
    extractor_config:
      block_label: human
```

Checks if agent's memory block contains expected content.

### Grade Pattern Extraction

```yaml
graders:
  extracted_correctly:
    kind: tool
    function: exact_match
    extractor: pattern
    extractor_config:
      pattern: 'ANSWER: (.*)'
      group: 1
```

Extracts content after "ANSWER:" and checks if it matches ground truth.

## Performance

Tool graders are:
- **Fast**: No API calls, pure Python execution
- **Deterministic**: Same input always produces same result
- **Cost-effective**: No LLM API costs
- **Reliable**: No network dependencies

Use tool graders when possible for faster, cheaper evaluations.

## Limitations

Tool graders:
- Can't evaluate subjective quality
- Limited to predefined logic
- Don't understand semantic similarity
- Can't handle complex, nuanced criteria

For these cases, use [Rubric Graders](./rubric-graders.md).

## Best Practices

1. **Use exact_match for precise answers**: Math, single words, structured formats
2. **Use contains for flexible matching**: When exact format varies but key content is present
3. **Use regex for format validation**: Emails, phone numbers, UUIDs
4. **Write custom graders for complex logic**: Multi-step validation, JSON parsing
5. **Combine multiple graders**: Evaluate different aspects (format + content + tool usage)

## Next Steps

- [Built-in Extractors](../extractors/builtin.md) - Understanding what to extract from trajectories
- [Rubric Graders](./rubric-graders.md) - LLM-based evaluation for subjective quality
- [Custom Graders](../advanced/custom-graders.md) - Writing your own grading functions
- [Multi-Metric Evaluation](./multi-metric.md) - Using multiple graders simultaneously
