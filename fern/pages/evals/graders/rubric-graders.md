# Rubric Graders

Rubric graders, also called "LLM-as-judge" graders, use language models evaluate submissions based on custom criteria. They're ideal for subjective, nuanced evaluation.

Rubric graders work by providing the LLM with a prompt that describes the evaluation criteria, then the language model generates a structured JSON response with a score and rationale:

```json
{
  "score": 0.85,
  "rationale": "The response is accurate and well-explained, but could be more concise."
}
```

**Schema requirements:**
- `score` (required): Decimal number between 0.0 and 1.0
- `rationale` (required): String explanation of the grading decision

> **Note**: OpenAI provides the best support for structured generation. Other providers may have varying quality of structured output adherence.

## Overview

Rubric graders:
- Use an LLM to evaluate responses
- Support custom evaluation criteria (rubrics)
- Can handle subjective quality assessment
- Return scores with explanations
- Use JSON structured generation for reliability

## Basic Configuration

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt  # Path to rubric file
    model: gpt-4o-mini  # LLM model
    extractor: last_assistant
```

## Rubric Prompts

Your rubric file defines the evaluation criteria. It can include placeholders:

- `{input}`: The original input from the dataset
- `{submission}`: The extracted agent response
- `{ground_truth}`: Ground truth from dataset (if available)

### Example Rubric

`quality_rubric.txt`:
```
Evaluate the response for accuracy, completeness, and clarity.

Input: {input}
Expected answer: {ground_truth}
Agent response: {submission}

Scoring criteria:
- 1.0: Perfect - accurate, complete, and clear
- 0.8-0.9: Excellent - minor improvements possible
- 0.6-0.7: Good - some gaps or unclear parts
- 0.4-0.5: Adequate - significant issues
- 0.2-0.3: Poor - major problems
- 0.0-0.1: Failed - incorrect or nonsensical

Provide a score between 0.0 and 1.0.
```

### Inline Prompts

You can include the prompt directly in the YAML:

```yaml
graders:
  creativity:
    kind: rubric
    prompt: |
      Evaluate the creativity and originality of the response.

      Response: {submission}

      Score from 0.0 (generic) to 1.0 (highly creative).
    model: gpt-4o-mini
    extractor: last_assistant
```

## Configuration Options

### prompt_path vs prompt

Use exactly one:

```yaml
# Option 1: External file
graders:
  quality:
    kind: rubric
    prompt_path: rubrics/quality.txt  # Relative to suite YAML
    model: gpt-4o-mini
    extractor: last_assistant
```

```yaml
# Option 2: Inline
graders:
  quality:
    kind: rubric
    prompt: "Evaluate the response quality from 0.0 to 1.0"
    model: gpt-4o-mini
    extractor: last_assistant
```

### model

LLM model to use for judging:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini  # Or gpt-4o, claude-3-5-sonnet, etc.
    extractor: last_assistant
```

Supported: Any OpenAI-compatible model

**Special handling**: For reasoning models (o1, o3, gpt-5), temperature is automatically set to 1.0 even if you specify 0.0.

### temperature

Controls randomness in LLM generation:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini
    temperature: 0.0  # Deterministic (default)
    extractor: last_assistant
```

Range: 0.0 (deterministic) to 2.0 (very random)

Default: 0.0 (recommended for evaluations)

### provider

LLM provider:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini
    provider: openai  # Default
    extractor: last_assistant
```

Currently supported: `openai` (default)

### max_retries

Number of retry attempts if API call fails:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini
    max_retries: 5  # Default
    extractor: last_assistant
```

### timeout

Timeout for API calls in seconds:

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: rubric.txt
    model: gpt-4o-mini
    timeout: 120.0  # Default: 2 minutes
    extractor: last_assistant
```

## How It Works

1. **Prompt Building**: The rubric prompt is populated with placeholders (`{input}`, `{submission}`, `{ground_truth}`)
2. **System Prompt**: Instructs the LLM to return JSON with `score` and `rationale` fields
3. **Structured Output**: Uses JSON mode (`response_format: json_object`) to enforce the schema
4. **Validation**: Extracts and validates score (clamped to 0.0-1.0) and rationale
5. **Error Handling**: Returns score 0.0 with error message if grading fails

### System Prompt

The rubric grader automatically includes this system prompt:

```
You are an evaluation judge. You will be given:
1. A rubric describing evaluation criteria
2. An input/question
3. A submission to evaluate

Evaluate the submission according to the rubric and return a JSON response with:
{
    "score": (REQUIRED: a decimal number between 0.0 and 1.0 inclusive),
    "rationale": "explanation of your grading decision"
}

IMPORTANT:
- The score MUST be a number between 0.0 and 1.0 (inclusive)
- 0.0 means complete failure, 1.0 means perfect
- Use decimal values for partial credit (e.g., 0.25, 0.5, 0.75)
- Be objective and follow the rubric strictly
```

If the LLM returns invalid JSON or missing fields, the grading fails and returns score 0.0 with an error message.

## Agent-as-Judge

Instead of calling an LLM API directly, you can use a **Letta agent** as the judge. The agent-as-judge approach loads a Letta agent from a `.af` file, sends it the evaluation criteria, and collects its score via a tool call.

### Why Use Agent-as-Judge?

Agent-as-judge is ideal when:

1. **No direct LLM API access**: Your team uses Letta Cloud or managed instances without direct API keys
2. **Judges need tools**: The evaluator needs to call tools during grading (e.g., web search, database queries, fetching webpages to verify answers)
3. **Centralized LLM access**: Your organization provides LLM access only through Letta
4. **Custom evaluation logic**: You want the judge to use specific tools or follow complex evaluation workflows
5. **Teacher-student patterns**: You have a well-built, experienced agent that can evaluate and teach a student agent being developed

### Configuration

To use agent-as-judge, specify `agent_file` instead of `model`:

```yaml
graders:
  agent_judge:
    kind: rubric  # Still "rubric" kind
    agent_file: judge.af  # Path to judge agent .af file
    prompt_path: rubric.txt  # Evaluation criteria
    judge_tool_name: submit_grade  # Tool for submitting scores (default: submit_grade)
    extractor: last_assistant  # What to extract from target agent
```

**Key differences from standard rubric grading:**
- Use `agent_file` instead of `model`
- No `temperature`, `provider`, `max_retries`, or `timeout` fields (agent handles retries internally)
- Judge agent must have a `submit_grade(score: float, rationale: str)` tool
- Framework validates judge tool on initialization (fail-fast)

### Judge Agent Requirements

Your judge agent **must** have a tool with this exact signature:

```python
def submit_grade(score: float, rationale: str) -> dict:
    """
    Submit an evaluation grade for an agent's response.

    Args:
        score: A float between 0.0 (complete failure) and 1.0 (perfect)
        rationale: Explanation of why this score was given

    Returns:
        dict: Confirmation of grade submission
    """
    return {
        "status": "success",
        "grade": {"score": score, "rationale": rationale}
    }
```

**Validation on initialization**: The framework validates the judge agent has the correct tool with the right parameters **before** running evaluations. If validation fails, you'll get a clear error:

```
ValueError: Judge tool 'submit_grade' not found in agent file judge.af.
Available tools: ['fetch_webpage', 'search_documents']
```

This fail-fast approach catches configuration errors immediately.

### Checklist: Will Your Judge Agent Work?

- [ ] **Tool exists**: Agent has a tool with the name specified in `judge_tool_name` (default: `submit_grade`)
- [ ] **Tool parameters**: The tool has BOTH `score: float` and `rationale: str` parameters
- [ ] **Tool is callable**: The tool is not disabled or requires-approval-only
- [ ] **Agent system prompt**: Agent understands it's an evaluator (optional but recommended)
- [ ] **No conflicting tools**: Agent doesn't have other tools that might confuse it into answering questions instead of judging

### Example Configuration

**suite.yaml:**
```yaml
name: fetch-webpage-agent-judge-test
description: Test agent responses using a Letta agent as judge
dataset: dataset.csv

target:
  kind: agent
  agent_file: my_agent.af  # Agent being tested
  base_url: http://localhost:8283

graders:
  agent_judge:
    kind: rubric
    agent_file: judge.af  # Judge agent with submit_grade tool
    prompt_path: rubric.txt  # Evaluation criteria
    judge_tool_name: submit_grade  # Tool name (default: submit_grade)
    extractor: last_assistant  # Extract target agent's response

gate:
  metric_key: agent_judge
  op: gte
  value: 0.75  # Pass if avg score ≥ 0.75
```

**rubric.txt:**
```
Evaluate the agent's response based on the following criteria:

1. **Correctness (0.6 weight)**: Does the response contain accurate information from the webpage? Check if the answer matches what was requested in the input.

2. **Format (0.2 weight)**: Is the response formatted correctly? The input often requests answers in a specific format (e.g., in brackets like {Answer}).

3. **Completeness (0.2 weight)**: Does the response fully address the question without unnecessary information?

Scoring Guidelines:
- 1.0: Perfect response - correct, properly formatted, and complete
- 0.75-0.99: Good response - minor formatting or completeness issues
- 0.5-0.74: Adequate response - correct information but format/completeness problems
- 0.25-0.49: Poor response - partially correct or missing key information
- 0.0-0.24: Failed response - incorrect or no relevant information

Use the submit_grade tool to submit your evaluation with a score between 0.0 and 1.0. You will need to use your fetch_webpage tool to fetch the desired webpage and confirm the answer is correct.
```

**Judge agent with tools**: The judge agent in this example has `fetch_webpage` tool, allowing it to independently verify answers by fetching the webpage mentioned in the input.

### How Agent-as-Judge Works

1. **Agent Loading**: Loads judge agent from `.af` file and validates tool signature
2. **Prompt Formatting**: Formats the rubric with `{input}`, `{submission}`, `{ground_truth}` placeholders
3. **Agent Evaluation**: Sends formatted prompt to judge agent as a message
4. **Tool Call Parsing**: Extracts score and rationale from `submit_grade` tool call
5. **Cleanup**: Deletes judge agent after evaluation to free resources
6. **Error Handling**: Returns score 0.0 with error message if judge fails to call the tool

### Agent-as-Judge vs Standard Rubric Grading

| Feature | Standard Rubric | Agent-as-Judge |
|---------|----------------|----------------|
| **LLM Access** | Direct API (OPENAI_API_KEY) | Through Letta agent |
| **Tools** | No tool usage | Judge can use tools |
| **Configuration** | `model`, `temperature`, etc. | `agent_file`, `judge_tool_name` |
| **Output Format** | JSON structured output | Tool call with score/rationale |
| **Validation** | Runtime JSON parsing | Upfront tool signature validation |
| **Use Case** | Teams with API access | Teams using Letta Cloud, judges needing tools |
| **Cost** | API call per sample | Depends on judge agent's LLM config |

### Teacher-Student Pattern

A powerful use case for agent-as-judge is the **teacher-student pattern**, where an experienced, well-configured agent evaluates a student agent being developed.

> **Prerequisites**: This pattern assumes you already have a well-defined, production-ready agent that performs well on your task. This agent becomes the "teacher" that evaluates the "student" agent you're developing.

**Why this works:**
- **Domain expertise**: The teacher agent has specialized knowledge and tools
- **Consistent evaluation**: The teacher applies the same standards across all evaluations
- **Tool-based verification**: The teacher can independently verify answers using its own tools
- **Iterative improvement**: Use the teacher to evaluate multiple versions of the student as you improve it

**Example scenario:**
You have a production-ready customer support agent with domain expertise and access to your tools (knowledge base, CRM, documentation search, etc.). You're developing a new, faster version of this agent. Use the experienced agent as the judge to evaluate whether the new agent meets the same quality standards.

**Configuration:**
```yaml
name: student-agent-evaluation
description: Experienced agent evaluates student agent performance
dataset: support_questions.csv

target:
  kind: agent
  agent_file: student_agent.af  # New agent being developed
  base_url: http://localhost:8283

graders:
  teacher_evaluation:
    kind: rubric
    agent_file: teacher_agent.af  # Experienced production agent with domain tools
    prompt: |
      You are an experienced customer support agent evaluating a new agent's response.

      Customer question: {input}
      Student agent's answer: {submission}

      Use your available tools to verify the answer is correct and complete.
      Grade based on:
      1. Factual accuracy (0.5 weight) - Does the answer contain correct information?
      2. Completeness (0.3 weight) - Does it fully address the question?
      3. Tone and professionalism (0.2 weight) - Is it appropriately worded?

      Submit a score from 0.0 to 1.0 using the submit_grade tool.
    extractor: last_assistant

gate:
  metric_key: teacher_evaluation
  op: gte
  value: 0.8  # Student must score 80% or higher
```

**Benefits of this approach:**
- **Leverage existing expertise**: Your best agent becomes the standard
- **Scalable quality control**: Teacher evaluates hundreds of scenarios automatically
- **Continuous validation**: Run teacher evaluations in CI/CD as you iterate on the student
- **Transfer learning**: Teacher's evaluation helps identify where the student needs improvement

### Complete Example

See [`examples/letta-agent-rubric-grader/`](https://github.com/letta-ai/letta-evals/tree/main/examples/letta-agent-rubric-grader) for a working example with:
- Judge agent with `submit_grade` and `fetch_webpage` tools
- Target agent that fetches webpages and answers questions
- Rubric that instructs judge to verify answers independently
- Complete suite configuration

## Use Cases

### Quality Assessment

```yaml
graders:
  quality:
    kind: rubric
    prompt_path: quality_rubric.txt
    model: gpt-4o-mini
    extractor: last_assistant
```

`quality_rubric.txt`:
```
Evaluate response quality based on:
1. Accuracy of information
2. Completeness of answer
3. Clarity of explanation

Response: {submission}
Ground truth: {ground_truth}

Score from 0.0 to 1.0.
```

### Creativity Evaluation

```yaml
graders:
  creativity:
    kind: rubric
    prompt: |
      Rate the creativity and originality of this story.

      Story: {submission}

      1.0 = Highly creative and original
      0.5 = Some creative elements
      0.0 = Generic or cliché
    model: gpt-4o-mini
    extractor: last_assistant
```

### Multi-Criteria Evaluation

```yaml
graders:
  comprehensive:
    kind: rubric
    prompt: |
      Evaluate the response on multiple criteria:

      1. Technical Accuracy (40%)
      2. Clarity of Explanation (30%)
      3. Completeness (20%)
      4. Conciseness (10%)

      Input: {input}
      Response: {submission}
      Expected: {ground_truth}

      Provide a weighted score from 0.0 to 1.0.
    model: gpt-4o
    extractor: last_assistant
```

### Code Quality

```yaml
graders:
  code_quality:
    kind: rubric
    prompt: |
      Evaluate this code for:
      - Correctness
      - Readability
      - Efficiency
      - Best practices

      Code: {submission}

      Score from 0.0 to 1.0.
    model: gpt-4o
    extractor: last_assistant
```

### Tone and Style

```yaml
graders:
  professionalism:
    kind: rubric
    prompt: |
      Rate the professionalism and appropriate tone of the response.

      Response: {submission}

      1.0 = Highly professional
      0.5 = Acceptable
      0.0 = Unprofessional or inappropriate
    model: gpt-4o-mini
    extractor: last_assistant
```

## Best Practices

### 1. Clear Scoring Criteria

Provide explicit score ranges and what they mean:

```
Score:
- 1.0: Perfect response with no issues
- 0.8-0.9: Minor improvements possible
- 0.6-0.7: Some gaps or errors
- 0.4-0.5: Significant problems
- 0.2-0.3: Major issues
- 0.0-0.1: Complete failure
```

### 2. Use Ground Truth When Available

If you have expected answers, include them:

```
Expected: {ground_truth}
Actual: {submission}

Evaluate how well the actual response matches the expected content.
```

### 3. Be Specific About Criteria

Vague: "Evaluate the quality"
Better: "Evaluate accuracy, completeness, and clarity"

### 4. Use Examples in Rubric

```
Example of 1.0: "A complete, accurate answer with clear explanation"
Example of 0.5: "Partially correct but missing key details"
Example of 0.0: "Incorrect or irrelevant response"
```

### 5. Calibrate with Test Cases

Run on a small set first to ensure the rubric produces expected scores.

### 6. Consider Model Choice

- **gpt-4o-mini**: Fast and cost-effective for simple criteria
- **gpt-4o**: More accurate for complex evaluation
- **claude-3-5-sonnet**: Alternative perspective (via OpenAI-compatible endpoint)

## Environment Setup

Rubric graders require an OpenAI API key:

```bash
export OPENAI_API_KEY=your-api-key
```

For custom endpoints:

```bash
export OPENAI_BASE_URL=https://your-endpoint.com/v1
```

## Error Handling

If grading fails:
- Score is set to 0.0
- Rationale includes error message
- Metadata includes error details
- Evaluation continues (doesn't stop the suite)

Common errors:
- API timeout → Check `timeout` setting
- Invalid API key → Verify `OPENAI_API_KEY`
- Rate limit → Reduce concurrency or add retries

## Cost Considerations

Rubric graders make API calls for each sample:

- **gpt-4o-mini**: ~$0.00015 per evaluation (cheap)
- **gpt-4o**: ~$0.002 per evaluation (more expensive)

For 1000 samples:
- gpt-4o-mini: ~$0.15
- gpt-4o: ~$2.00

Estimate costs before running large evaluations.

## Performance

Rubric graders are slower than tool graders:
- Tool grader: <1ms per sample
- Rubric grader: 500-2000ms per sample (network + LLM)

Use concurrency to speed up:

```bash
letta-evals run suite.yaml --max-concurrent 10
```

## Limitations

Rubric graders:
- **Cost**: API calls cost money
- **Speed**: Slower than tool graders
- **Consistency**: Can vary slightly between runs (use temperature 0.0 for best consistency)
- **API dependency**: Requires network and API availability

For deterministic, fast evaluation, use [Tool Graders](./tool-graders.md).

## Combining Tool and Rubric Graders

Use both in one suite:

```yaml
graders:
  format_check:
    kind: tool
    function: regex_match
    extractor: last_assistant

  quality:
    kind: rubric
    prompt_path: quality.txt
    model: gpt-4o-mini
    extractor: last_assistant

gate:
  metric_key: quality  # Gate on quality, but still check format
  op: gte
  value: 0.7
```

This combines fast deterministic checks with nuanced quality evaluation.

## Next Steps

- [Built-in Extractors](../extractors/builtin.md) - Understanding what to extract from trajectories
- [Tool Graders](./tool-graders.md) - Deterministic evaluation for objective criteria
- [Multi-Metric Evaluation](./multi-metric.md) - Combining multiple graders
- [Custom Graders](../advanced/custom-graders.md) - Writing custom evaluation logic
