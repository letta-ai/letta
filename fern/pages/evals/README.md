# Letta Evals Documentation

Welcome to the comprehensive documentation for Letta Evals Kit - a framework for evaluating Letta AI agents.

## Table of Contents

### Getting Started
- [Getting Started](./getting-started.md) - Installation, first evaluation, and core concepts

### Core Concepts
- [Overview](./concepts/overview.md) - Understanding the evaluation framework
- [Suites](./concepts/suites.md) - Evaluation suite configuration
- [Datasets](./concepts/datasets.md) - Creating and managing test datasets
- [Targets](./concepts/targets.md) - What you're evaluating
- [Graders](./concepts/graders.md) - How responses are scored
- [Extractors](./concepts/extractors.md) - Extracting submissions from agent output
- [Gates](./concepts/gates.md) - Pass/fail criteria

### Graders
- [Grader Overview](./graders/overview.md) - Understanding grader types
- [Tool Graders](./graders/tool-graders.md) - Built-in and custom function graders
- [Rubric Graders](./graders/rubric-graders.md) - LLM-as-judge evaluation
- [Multi-Metric Grading](./graders/multi-metric.md) - Evaluating with multiple metrics

### Extractors
- [Extractor Overview](./extractors/overview.md) - Understanding extractors
- [Built-in Extractors](./extractors/builtin.md) - All available extractors
- [Custom Extractors](./extractors/custom.md) - Writing your own extractors

### Configuration
- [Suite YAML Reference](./configuration/suite-yaml.md) - Complete YAML schema
- [Target Configuration](./configuration/targets.md) - Target setup options
- [Grader Configuration](./configuration/graders.md) - Grader parameters
- [Environment Variables](./configuration/environment.md) - Environment setup

### Advanced Usage
- [Custom Graders](./advanced/custom-graders.md) - Writing custom grading functions
- [Multi-Turn Conversations](./advanced/multi-turn-conversations.md) - Testing conversational memory and state
- [Agent Factories](./advanced/agent-factories.md) - Programmatic agent creation
- [Multi-Model Evaluation](./advanced/multi-model.md) - Testing across models
- [Setup Scripts](./advanced/setup-scripts.md) - Pre-evaluation setup
- [Memory Block Testing](./advanced/memory-blocks.md) - Testing agent memory
- [Result Streaming](./advanced/streaming.md) - Real-time results and caching

### Results & Metrics
- [Understanding Results](./results/overview.md) - Result structure and interpretation
- [Metrics](./results/metrics.md) - Aggregate statistics
- [Output Formats](./results/output-formats.md) - JSON, JSONL, and console output

### CLI Reference
- [Commands](./cli/commands.md) - All CLI commands
- [Options](./cli/options.md) - Command-line options

### Examples
- [Example Walkthroughs](./examples/README.md) - Detailed example explanations

### API Reference
- [Data Models](./api/models.md) - Pydantic models reference
- [Decorators](./api/decorators.md) - @grader and @extractor decorators

### Best Practices
- [Writing Effective Tests](./best-practices/writing-tests.md)
- [Designing Rubrics](./best-practices/rubrics.md)
- [Performance Optimization](./best-practices/performance.md)

### Troubleshooting
- [Common Issues](./troubleshooting.md)
- [FAQ](./faq.md)
