# Custom Graders

Write your own grading functions to implement custom evaluation logic.

## Overview

Custom graders let you:
- Implement domain-specific evaluation
- Parse and validate complex formats
- Apply custom scoring algorithms
- Combine multiple checks in one grader

## Basic Structure

```python
from letta_evals.decorators import grader
from letta_evals.models import GradeResult, Sample

@grader
def my_custom_grader(sample: Sample, submission: str) -> GradeResult:
    """Your custom grading logic."""
    # Evaluate the submission
    score = calculate_score(submission, sample)

    return GradeResult(
        score=score,  # Must be 0.0 to 1.0
        rationale="Explanation of the score",
        metadata={"extra": "information"}
    )
```

## The @grader Decorator

The `@grader` decorator registers your function so it can be used in suite YAML:

```python
from letta_evals.decorators import grader

@grader  # Makes this function available as "my_function"
def my_function(sample: Sample, submission: str) -> GradeResult:
    ...
```

Without the decorator, your function won't be discovered.

## Function Signature

Your grader must have this signature:

```python
def grader_name(sample: Sample, submission: str) -> GradeResult:
    ...
```

### Parameters

- `sample`: The dataset sample being evaluated (includes `input`, `ground_truth`, `metadata`, etc.)
- `submission`: The extracted text from the agent's response

### Return Value

Must return a `GradeResult`:

```python
from letta_evals.models import GradeResult

return GradeResult(
    score=0.85,  # Required: 0.0 to 1.0
    rationale="Explanation",  # Optional but recommended
    metadata={"key": "value"}  # Optional: any extra data
)
```

## Complete Example

```python
# custom_graders.py
import json
from letta_evals.decorators import grader
from letta_evals.models import GradeResult, Sample

@grader
def json_field_validator(sample: Sample, submission: str) -> GradeResult:
    """Validates JSON and checks for required fields."""
    required_fields = sample.ground_truth.split(",")  # e.g., "name,age,email"

    try:
        data = json.loads(submission)
    except json.JSONDecodeError as e:
        return GradeResult(
            score=0.0,
            rationale=f"Invalid JSON: {e}",
            metadata={"error": "json_decode"}
        )

    missing = [f for f in required_fields if f not in data]

    if missing:
        score = 1.0 - (len(missing) / len(required_fields))
        return GradeResult(
            score=score,
            rationale=f"Missing fields: {', '.join(missing)}",
            metadata={"missing_fields": missing}
        )

    return GradeResult(
        score=1.0,
        rationale="All required fields present",
        metadata={"fields_found": required_fields}
    )
```

Dataset:
```jsonl
{"input": "Return user info as JSON", "ground_truth": "name,age,email"}
```

Suite:
```yaml
graders:
  json_check:
    kind: tool
    function: json_field_validator
    extractor: last_assistant
```

## Using Custom Graders

### Method 1: Custom Evaluators File

Create a file with your graders (e.g., `custom_evaluators.py`) in your project:

```python
from letta_evals.decorators import grader
from letta_evals.models import GradeResult, Sample

@grader
def my_grader(sample: Sample, submission: str) -> GradeResult:
    ...
```

Reference it in your suite:

```yaml
# The file will be automatically discovered if it's in the same directory
# or use Python path imports
graders:
  my_metric:
    kind: tool
    function: my_grader
    extractor: last_assistant
```

### Method 2: Setup Script

Import your graders in a setup script:

```python
# setup.py
from letta_evals.models import SuiteSpec
import custom_evaluators  # This imports and registers graders

def prepare_environment(suite: SuiteSpec) -> None:
    pass  # Graders are registered via import
```

```yaml
setup_script: setup.py:prepare_environment

graders:
  my_metric:
    kind: tool
    function: my_grader
    extractor: last_assistant
```

## Real-World Examples

### Length Check

```python
@grader
def appropriate_length(sample: Sample, submission: str) -> GradeResult:
    """Check if response length is within expected range."""
    min_len = 50
    max_len = 500
    length = len(submission)

    if min_len <= length <= max_len:
        score = 1.0
        rationale = f"Length {length} is appropriate"
    elif length < min_len:
        score = max(0.0, length / min_len)
        rationale = f"Too short: {length} chars (min {min_len})"
    else:
        score = max(0.0, 1.0 - (length - max_len) / max_len)
        rationale = f"Too long: {length} chars (max {max_len})"

    return GradeResult(score=score, rationale=rationale)
```

### Keyword Coverage

```python
@grader
def keyword_coverage(sample: Sample, submission: str) -> GradeResult:
    """Check what percentage of required keywords are present."""
    keywords = sample.ground_truth.split(",")
    submission_lower = submission.lower()

    found = [kw for kw in keywords if kw.lower() in submission_lower]
    score = len(found) / len(keywords) if keywords else 0.0

    return GradeResult(
        score=score,
        rationale=f"Found {len(found)}/{len(keywords)} keywords: {', '.join(found)}",
        metadata={"found": found, "missing": list(set(keywords) - set(found))}
    )
```

Dataset:
```jsonl
{"input": "Explain photosynthesis", "ground_truth": "light,energy,chlorophyll,oxygen,carbon dioxide"}
```

### Tool Call Validation

```python
import json

@grader
def correct_tool_arguments(sample: Sample, submission: str) -> GradeResult:
    """Validate tool was called with correct arguments."""
    try:
        args = json.loads(submission)
    except json.JSONDecodeError:
        return GradeResult(score=0.0, rationale="No valid tool call found")

    expected_tool = sample.metadata.get("expected_tool")
    if args.get("tool_name") != expected_tool:
        return GradeResult(
            score=0.0,
            rationale=f"Wrong tool: expected {expected_tool}, got {args.get('tool_name')}"
        )

    # Check arguments
    expected_args = json.loads(sample.ground_truth)
    matches = all(args.get(k) == v for k, v in expected_args.items())

    if matches:
        return GradeResult(score=1.0, rationale="Tool called with correct arguments")
    else:
        return GradeResult(score=0.5, rationale="Tool correct but arguments differ")
```

### Numeric Range Check

```python
@grader
def numeric_range(sample: Sample, submission: str) -> GradeResult:
    """Check if extracted number is within expected range."""
    try:
        value = float(submission.strip())
        min_val, max_val = map(float, sample.ground_truth.split(","))

        if min_val <= value <= max_val:
            return GradeResult(
                score=1.0,
                rationale=f"Value {value} is within range [{min_val}, {max_val}]"
            )
        else:
            # Partial credit based on distance
            if value < min_val:
                distance = min_val - value
            else:
                distance = value - max_val

            score = max(0.0, 1.0 - (distance / max_val))
            return GradeResult(
                score=score,
                rationale=f"Value {value} outside range [{min_val}, {max_val}]"
            )

    except ValueError as e:
        return GradeResult(score=0.0, rationale=f"Invalid numeric value: {e}")
```

### Multi-Criteria

```python
@grader
def comprehensive_check(sample: Sample, submission: str) -> GradeResult:
    """Multiple checks with weighted scoring."""
    points = 0.0
    issues = []

    # Check 1: Contains answer (40%)
    if sample.ground_truth.lower() in submission.lower():
        points += 0.4
    else:
        issues.append("Missing expected answer")

    # Check 2: Appropriate length (20%)
    if 100 <= len(submission) <= 500:
        points += 0.2
    else:
        issues.append(f"Length {len(submission)} not in range [100, 500]")

    # Check 3: Starts with capital letter (10%)
    if submission and submission[0].isupper():
        points += 0.1
    else:
        issues.append("Doesn't start with capital letter")

    # Check 4: Ends with punctuation (10%)
    if submission and submission[-1] in ".!?":
        points += 0.1
    else:
        issues.append("Doesn't end with punctuation")

    # Check 5: No profanity (20%)
    profanity = ["badword1", "badword2"]
    if not any(word in submission.lower() for word in profanity):
        points += 0.2
    else:
        issues.append("Contains inappropriate language")

    rationale = f"Score: {points:.2f}. " + (
        "All checks passed!" if not issues else f"Issues: {'; '.join(issues)}"
    )

    return GradeResult(
        score=points,
        rationale=rationale,
        metadata={"issues": issues}
    )
```

## Accessing Sample Data

The `Sample` object provides:

```python
sample.id  # Sample ID
sample.input  # Input (str or List[str])
sample.ground_truth  # Expected answer (optional)
sample.metadata  # Dict with custom data (optional)
sample.agent_args  # Agent creation args (optional)
```

Use these for flexible grading logic:

```python
@grader
def context_aware_grader(sample: Sample, submission: str) -> GradeResult:
    category = sample.metadata.get("category", "general")

    if category == "math":
        # Strict for math
        return exact_math_check(sample, submission)
    elif category == "creative":
        # Lenient for creative
        return length_and_relevance_check(sample, submission)
    else:
        return default_check(sample, submission)
```

## Error Handling

Always handle exceptions:

```python
@grader
def safe_grader(sample: Sample, submission: str) -> GradeResult:
    try:
        # Your logic here
        score = complex_calculation(submission)
        return GradeResult(score=score, rationale="Success")

    except Exception as e:
        # Return 0.0 with error message
        return GradeResult(
            score=0.0,
            rationale=f"Error during grading: {str(e)}",
            metadata={"error": str(e), "error_type": type(e).__name__}
        )
```

This ensures evaluation continues even if individual samples fail.

## Testing Your Grader

Test your grader with sample data:

```python
from letta_evals.models import Sample, GradeResult

# Test case
sample = Sample(
    id=0,
    input="What is 2+2?",
    ground_truth="4"
)

submission = "The answer is 4"

result = my_grader(sample, submission)
print(f"Score: {result.score}, Rationale: {result.rationale}")
```

## Best Practices

1. **Validate input**: Check for edge cases (empty strings, malformed data)
2. **Use meaningful rationales**: Explain why a score was given
3. **Handle errors gracefully**: Return 0.0 with error message rather than crashing
4. **Keep it fast**: Custom graders run for every sample
5. **Use metadata**: Store extra information for debugging
6. **Normalize scores**: Always return 0.0 to 1.0
7. **Document your grader**: Add docstrings explaining criteria

## Next Steps

- [Custom Extractors](../extractors/custom.md)
- [Tool Graders](../graders/tool-graders.md)
- [Examples](../examples/README.md)
