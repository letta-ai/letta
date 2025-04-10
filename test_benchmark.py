#!/usr/bin/env python3

import sys
from letta.benchmark.archival_memory import ArchivalMemoryBenchmark

def main():
    """Test the benchmark implementation."""
    # Use a simple model for testing
    models = ["gpt-3.5-turbo"]
    
    # Create and run the benchmark
    benchmark = ArchivalMemoryBenchmark(models=models, n_tries=1)
    results = benchmark.run(print_messages=True)
    
    # Print results
    print("\nBenchmark Results:")
    for model, model_results in results.items():
        print(f"\nModel: {model}")
        for key, value in model_results.items():
            print(f"  {key}: {value}")
    
    # Save results to CSV
    benchmark.save_results(output_file="benchmark_results.csv")
    print("\nResults saved to benchmark_results.csv")

if __name__ == "__main__":
    main()