from typing import List, Optional
import typer
from enum import Enum

from letta.benchmark.archival_memory import ArchivalMemoryBenchmark
from letta.benchmark.constants import TRIES


class BenchmarkTarget(str, Enum):
    ARCHIVAL_MEMORY = "archival_memory"


app = typer.Typer()


@app.callback()
def callback():
    """Benchmark model performance on function calling."""
    pass


@app.command()
def run(
    models: List[str] = typer.Argument(
        ..., help="Models to benchmark (can specify multiple)"
    ),
    target: BenchmarkTarget = typer.Option(
        BenchmarkTarget.ARCHIVAL_MEMORY, "--target", help="Benchmark target to run"
    ),
    n_tries: int = typer.Option(
        TRIES, "--n-tries", help="Number of benchmark tries to perform for each function"
    ),
    output: Optional[str] = typer.Option(
        "benchmark_results.csv", "--output", help="Output CSV file path"
    ),
    print_messages: bool = typer.Option(
        False, "--messages", help="Print functions calls and messages from the agent"
    ),
):
    """Run benchmarks for model function calling.
    
    Example: letta benchmark run gpt-4o gpt-3.5-turbo --target archival_memory
    """
    if target == BenchmarkTarget.ARCHIVAL_MEMORY:
        benchmark = ArchivalMemoryBenchmark(models=models, n_tries=n_tries)
        benchmark.run(print_messages=print_messages)
        benchmark.save_results(output_file=output)
    else:
        typer.echo(f"Unknown benchmark target: {target}")
        raise typer.Exit(code=1)