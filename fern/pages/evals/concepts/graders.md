# Graders

**Graders** are the scoring functions that evaluate agent responses. They take the extracted submission (from an extractor) and assign a score between 0.0 (complete failure) and 1.0 (perfect success).

**Quick overview:**
- **Two types**: Tool graders (deterministic Python functions) and Rubric graders (LLM-as-judge)
- **Built-in functions**: exact_match, contains, regex_match, ascii_printable_only
- **Custom graders**: Write your own grading logic
- **Multi-metric**: Combine multiple graders in one suite
- **Flexible extraction**: Each grader can use a different extractor

**When to use each:**
- **Tool graders**: Fast, deterministic, free - perfect for exact matching, patterns, tool validation
- **Rubric graders**: Flexible, subjective, costs API calls - ideal for quality, creativity, nuanced evaluation

Graders evaluate agent responses and assign scores between 0.0 (complete failure) and 1.0 (perfect success).

## Grader Types

There are two types of graders:

### Tool Graders

Python functions that programmatically compare the submission to ground truth or apply deterministic checks.

```yaml
graders:
  accuracy:
    kind: tool  # Deterministic grading
    function: exact_match  # Built-in grading function
    extractor: last_assistant  # Use final agent response
```

Best for:
- Exact matching
- Pattern checking
- Tool call validation
- Deterministic criteria

### Rubric Graders

LLM-as-judge evaluation using custom prompts and criteria. Can use either direct LLM API calls or a Letta agent as the judge.

**Standard rubric grading (LLM API):**
```yaml
graders:
  quality:
    kind: rubric  # LLM-as-judge
    prompt_path: rubric.txt  # Custom evaluation criteria
    model: gpt-4o-mini  # Judge model
    extractor: last_assistant  # What to evaluate
```

**Agent-as-judge (Letta agent):**
```yaml
graders:
  agent_judge:
    kind: rubric  # Still "rubric" kind
    agent_file: judge.af  # Judge agent with submit_grade tool
    prompt_path: rubric.txt  # Evaluation criteria
    extractor: last_assistant  # What to evaluate
```

Best for:
- Subjective quality assessment
- Open-ended responses
- Nuanced evaluation
- Complex criteria
- Judges that need tools (when using agent-as-judge)

## Built-in Tool Graders

### exact_match

Checks if submission exactly matches ground truth (case-sensitive, whitespace-trimmed).

```yaml
graders:
  accuracy:
    kind: tool
    function: exact_match  # Case-sensitive, whitespace-trimmed
    extractor: last_assistant  # Extract final response
```

Requires: `ground_truth` in dataset

Score: 1.0 if exact match, 0.0 otherwise

### contains

Checks if submission contains ground truth (case-insensitive).

```yaml
graders:
  contains_answer:
    kind: tool
    function: contains  # Case-insensitive substring match
    extractor: last_assistant  # Search in final response
```

Requires: `ground_truth` in dataset

Score: 1.0 if found, 0.0 otherwise

### regex_match

Checks if submission matches a regex pattern in ground truth.

```yaml
graders:
  pattern:
    kind: tool
    function: regex_match  # Pattern matching
    extractor: last_assistant  # Check final response
```

Dataset sample:
```json
{"input": "Generate a UUID", "ground_truth": "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"}
```

Score: 1.0 if pattern matches, 0.0 otherwise

### ascii_printable_only

Validates that all characters are printable ASCII (useful for ASCII art, formatted output).

```yaml
graders:
  ascii_check:
    kind: tool
    function: ascii_printable_only  # Validate ASCII characters
    extractor: last_assistant  # Check final response
```

Does not require ground truth.

Score: 1.0 if all characters are printable ASCII, 0.0 if any non-printable characters found

## Rubric Graders

Rubric graders use an LLM to evaluate responses based on custom criteria.

### Basic Configuration

```yaml
graders:
  quality:
    kind: rubric  # LLM-as-judge
    prompt_path: quality_rubric.txt  # Evaluation criteria
    model: gpt-4o-mini  # Judge model
    temperature: 0.0  # Deterministic
    extractor: last_assistant  # What to evaluate
```

### Rubric Prompt Format

Your rubric file should describe the evaluation criteria. Use placeholders:

- `{input}`: The original input from the dataset
- `{submission}`: The extracted agent response
- `{ground_truth}`: Ground truth from dataset (if available)

Example `quality_rubric.txt`:
```
Evaluate the response for:
1. Accuracy: Does it correctly answer the question?
2. Completeness: Is the answer thorough?
3. Clarity: Is it well-explained?

Input: {input}
Expected: {ground_truth}
Response: {submission}

Score from 0.0 to 1.0 where:
- 1.0: Perfect response
- 0.75: Good with minor issues
- 0.5: Acceptable but incomplete
- 0.25: Poor quality
- 0.0: Completely wrong
```

### Inline Prompt

Instead of a file, you can include the prompt inline:

```yaml
graders:
  quality:
    kind: rubric  # LLM-as-judge
    prompt: |  # Inline prompt instead of file
      Evaluate the creativity and originality of the response.
      Score 1.0 for highly creative, 0.0 for generic or unoriginal.
    model: gpt-4o-mini  # Judge model
    extractor: last_assistant  # What to evaluate
```

### Model Configuration

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt  # Evaluation criteria
    model: gpt-4o-mini  # Judge model
    temperature: 0.0  # Deterministic (0.0-2.0)
    provider: openai  # LLM provider (default: openai)
    max_retries: 5  # API retry attempts
    timeout: 120.0  # Request timeout in seconds
```

Supported providers:
- `openai` (default)

Models:
- Any OpenAI-compatible model
- Special handling for reasoning models (o1, o3) - temperature automatically adjusted to 1.0

### Structured Output

Rubric graders use JSON mode to get structured responses:

```json
{
  "score": 0.85,
  "rationale": "The response is accurate and complete but could be more concise."
}
```

The score is validated to be between 0.0 and 1.0.

## Multi-Metric Configuration

Evaluate multiple aspects in one suite:

```yaml
graders:
  accuracy:  # Tool grader for factual correctness
    kind: tool
    function: contains
    extractor: last_assistant

  completeness:  # Rubric grader for thoroughness
    kind: rubric
    prompt_path: completeness_rubric.txt
    model: gpt-4o-mini
    extractor: last_assistant

  tool_usage:  # Tool grader for tool call validation
    kind: tool
    function: exact_match
    extractor: tool_arguments  # Extract tool call args
    extractor_config:
      tool_name: search  # Which tool to check
```

Each grader can use a different extractor.

## Extractor Configuration

Every grader must specify an `extractor` to select what to grade:

```yaml
graders:
  my_metric:
    kind: tool
    function: contains  # Grading function
    extractor: last_assistant  # What to extract and grade
```

Some extractors need additional configuration:

```yaml
graders:
  tool_check:
    kind: tool
    function: contains  # Check if ground truth in tool args
    extractor: tool_arguments  # Extract tool call arguments
    extractor_config:  # Configuration for this extractor
      tool_name: search  # Which tool to extract from
```

See [Extractors](./extractors.md) for all available extractors.

## Custom Graders

You can write custom grading functions. See [Custom Graders](../advanced/custom-graders.md) for details.

## Grader Selection Guide

| Use Case | Recommended Grader |
|----------|-------------------|
| Exact answer matching | `exact_match` |
| Keyword checking | `contains` |
| Pattern validation | `regex_match` |
| Tool call validation | `exact_match` with `tool_arguments` extractor |
| Quality assessment | Rubric grader |
| Creativity evaluation | Rubric grader |
| Format checking | Custom tool grader |
| Multi-criteria evaluation | Multiple graders |

## Score Interpretation

All scores are between 0.0 and 1.0:

- **1.0**: Perfect - meets all criteria
- **0.75-0.99**: Good - minor issues
- **0.5-0.74**: Acceptable - notable gaps
- **0.25-0.49**: Poor - major problems
- **0.0-0.24**: Failed - did not meet criteria

Tool graders typically return binary scores (0.0 or 1.0), while rubric graders can return any value in the range.

## Error Handling

If grading fails (e.g., network error, invalid format):
- Score is set to 0.0
- Rationale includes error message
- Metadata includes error details

This ensures evaluations can continue even with individual failures.

## Next Steps

- [Tool Graders](../graders/tool-graders.md) - Built-in and custom functions
- [Rubric Graders](../graders/rubric-graders.md) - LLM-as-judge details
- [Multi-Metric Evaluation](../graders/multi-metric.md) - Using multiple graders
- [Extractors](./extractors.md) - Selecting what to grade
