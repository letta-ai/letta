# Letta Benchmark

The Letta Benchmark tool allows you to evaluate how well different models call the base functions in Letta.

## Usage

```bash
letta benchmark run MODEL1 MODEL2 [MODEL3...] [OPTIONS]
```

### Options

- `--target`: Benchmark target to run (default: archival_memory)
- `--n-tries`: Number of benchmark tries to perform for each function (default: 3)
- `--output`: Output CSV file path (default: benchmark_results.csv)
- `--messages`: Print function calls and messages from the agent (default: False)

### Examples

Benchmark a single model:
```bash
letta benchmark run gpt-4o --target archival_memory
```

Benchmark multiple models:
```bash
letta benchmark run gpt-4o gpt-3.5-turbo claude-3-opus --target archival_memory
```

Customize the number of tries:
```bash
letta benchmark run gpt-4o --target archival_memory --n-tries 5
```

Save results to a custom file:
```bash
letta benchmark run gpt-4o --target archival_memory --output results/gpt4o_benchmark.csv
```

## Available Benchmark Targets

Currently, the following benchmark targets are available:

- `archival_memory`: Tests the archival_memory_insert and archival_memory_search functions

## Output

The benchmark generates a CSV file with the following columns:

- `model`: The model name
- Function-specific metrics (e.g., `archival_memory_insert`, `archival_memory_search`)
- `total_score`: Total number of successful function calls
- `total_tries`: Total number of function call attempts
- `total_time`: Total time taken for all benchmark tests
- `success_rate`: Percentage of successful function calls

## Extending

To add new benchmark targets, create a new class that inherits from the `Benchmark` base class and implements the `run()` method. Then add the new target to the `BenchmarkTarget` enum in `letta/benchmark/cli.py`.