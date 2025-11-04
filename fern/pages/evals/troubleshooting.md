# Troubleshooting

Common issues and solutions when using Letta Evals.

## Installation Issues

### "Command not found: letta-evals"

**Problem**: CLI not available after installation

**Solution**:
```bash
# Verify installation
pip list | grep letta-evals

# Reinstall if needed
pip install --upgrade letta-evals

# Or with uv
uv sync
```

### Import errors

**Problem**: `ModuleNotFoundError: No module named 'letta_evals'`

**Solution**:
```bash
# Ensure you're in the right environment
which python

# Install in correct environment
source .venv/bin/activate  # or: ac
pip install letta-evals
```

## Configuration Issues

### "Agent file not found"

**Problem**: `FileNotFoundError: agent.af`

**Solution**:
- Check the path is correct relative to the suite YAML
- Use absolute paths if needed
- Verify file exists: `ls -la path/to/agent.af`

```yaml
# Correct relative path
target:
  agent_file: ./agents/my_agent.af

# Or absolute path
target:
  agent_file: /absolute/path/to/agent.af
```

### "Dataset not found"

**Problem**: Cannot load dataset file

**Solution**:
- Verify dataset path in YAML
- Check file exists: `ls -la dataset.jsonl`
- Ensure proper JSONL format (one JSON object per line)

```bash
# Validate JSONL format
cat dataset.jsonl | jq .
```

### "Validation failed: unknown function"

**Problem**: Grader function not found

**Solution**:
```bash
# List available graders
letta-evals list-graders

# Check spelling in suite.yaml
graders:
  my_metric:
    function: exact_match  # Correct
    # not: exactMatch or exact-match
```

### "Validation failed: unknown extractor"

**Problem**: Extractor not found

**Solution**:
```bash
# List available extractors
letta-evals list-extractors

# Check spelling
graders:
  my_metric:
    extractor: last_assistant  # Correct
    # not: lastAssistant or last-assistant
```

## Connection Issues

### "Connection refused"

**Problem**: Cannot connect to Letta server

**Solution**:
```bash
# Verify server is running
curl http://localhost:8283/v1/health

# Check base_url in suite.yaml
target:
  base_url: http://localhost:8283  # Correct port?

# Or use environment variable
export LETTA_BASE_URL=http://localhost:8283
```

### "Unauthorized" or "Invalid API key"

**Problem**: Authentication failed

**Solution**:
```bash
# Set API key
export LETTA_API_KEY=your-key-here

# Or in suite.yaml
target:
  api_key: your-key-here

# Verify key is correct
echo $LETTA_API_KEY
```

### "Request timeout"

**Problem**: Requests taking too long

**Solution**:
```yaml
# Increase timeout
target:
  timeout: 600.0  # 10 minutes

# Rubric grader timeout
graders:
  quality:
    kind: rubric
    timeout: 300.0  # 5 minutes
```

## Runtime Issues

### "No ground_truth provided"

**Problem**: Grader requires ground truth but sample doesn't have it

**Solution**:
- Add ground_truth to dataset samples:
```jsonl
{"input": "What is 2+2?", "ground_truth": "4"}
```

- Or use a grader that doesn't require ground truth:
```yaml
graders:
  quality:
    kind: rubric  # Doesn't require ground_truth
    prompt_path: rubric.txt
```

### "Extractor requires agent_state"

**Problem**: `memory_block` extractor needs agent state but it wasn't fetched

**Solution**:
This should be automatic, but if you see this error:
- Check that the extractor is correctly configured
- Ensure the agent exists and is accessible
- Try using a different extractor if memory isn't needed

### "Score must be between 0.0 and 1.0"

**Problem**: Custom grader returning invalid score

**Solution**:
```python
@grader
def my_grader(sample, submission):
    score = calculate_score(submission)
    # Clamp score to valid range
    score = max(0.0, min(1.0, score))
    return GradeResult(score=score, rationale="...")
```

### "Invalid JSON in response"

**Problem**: Rubric grader got non-JSON response

**Solution**:
- Check OpenAI API key is valid
- Verify model name is correct
- Check for network issues
- Try increasing max_retries:
```yaml
graders:
  quality:
    kind: rubric
    max_retries: 10
```

## Performance Issues

### Evaluation is very slow

**Problem**: Taking too long to complete

**Solutions**:

1. Increase concurrency:
```bash
letta-evals run suite.yaml --max-concurrent 20
```

2. Reduce samples for testing:
```yaml
max_samples: 10  # Test with small subset first
```

3. Use tool graders instead of rubric graders when possible:
```yaml
graders:
  accuracy:
    kind: tool  # Much faster than rubric
    function: exact_match
```

4. Check network latency:
```bash
# Test server response time
time curl http://localhost:8283/v1/health
```

### High API costs

**Problem**: Rubric graders costing too much

**Solutions**:

1. Use cheaper models:
```yaml
graders:
  quality:
    model: gpt-4o-mini  # Cheaper than gpt-4o
```

2. Reduce number of rubric graders:
```yaml
graders:
  accuracy:
    kind: tool  # Free
  quality:
    kind: rubric  # Only use for subjective evaluation
```

3. Test with small sample first:
```yaml
max_samples: 5  # Verify before running full suite
```

## Results Issues

### "No results generated"

**Problem**: No output files created

**Solution**:
```bash
# Specify output directory
letta-evals run suite.yaml --output results/

# Check for errors in console output
letta-evals run suite.yaml  # Without --quiet
```

### "All scores are 0.0"

**Problem**: Everything failing

**Solutions**:

1. Check if agent is working:
```bash
# Test agent manually first
```

2. Verify extractor is getting content:
- Add debug logging
- Check sample results in output

3. Check grader logic:
```python
# Test grader independently
from letta_evals.models import Sample, GradeResult
sample = Sample(id=0, input="test", ground_truth="test")
result = my_grader(sample, "test")
print(result)
```

### "Gates failed but scores look good"

**Problem**: Passing samples but gate failing

**Solution**:
- Check gate configuration:
```yaml
gate:
  metric_key: accuracy  # Correct metric?
  metric: avg_score  # Or accuracy?
  op: gte  # Correct operator?
  value: 0.8  # Correct threshold?
```

- Understand the difference between `avg_score` and `accuracy`
- Check per-sample pass criteria with `pass_op` and `pass_value`

## Environment Issues

### "OPENAI_API_KEY not found"

**Problem**: Rubric grader can't find API key

**Solution**:
```bash
# Set in environment
export OPENAI_API_KEY=your-key-here

# Or in .env file
echo "OPENAI_API_KEY=your-key-here" >> .env

# Verify
echo $OPENAI_API_KEY
```

### "Cannot use both model_configs and model_handles"

**Problem**: Specified both in target config

**Solution**:
```yaml
# Use one or the other, not both
target:
  model_configs: [gpt-4o-mini]  # For local server
  # OR
  model_handles: ["openai/gpt-4o-mini"]  # For cloud
```

## Debug Tips

### Enable verbose output

Run without `--quiet` to see detailed progress:
```bash
letta-evals run suite.yaml
```

### Examine output files

```bash
letta-evals run suite.yaml --output debug/

# Check summary
cat debug/summary.json | jq .

# Check individual results
cat debug/results.jsonl | jq .
```

### Test with minimal suite

Create a minimal test:
```yaml
name: debug-test
dataset: test.jsonl  # Just 1-2 samples

target:
  kind: agent
  agent_file: agent.af

graders:
  test:
    kind: tool
    function: contains
    extractor: last_assistant

gate:
  op: gte
  value: 0.0  # Always pass
```

### Validate configuration

```bash
letta-evals validate suite.yaml
```

### Check component availability

```bash
letta-evals list-graders
letta-evals list-extractors
```

## Getting Help

If you're still stuck:

1. Check the [documentation](./README.md)
2. Look at [examples](../examples/)
3. Report issues at https://github.com/anthropics/claude-code/issues

When reporting issues, include:
- Suite YAML configuration
- Dataset sample (if not sensitive)
- Error message and full stack trace
- Output from `--output` directory
- Environment info (OS, Python version)

```bash
# Get environment info
python --version
pip show letta-evals
```
