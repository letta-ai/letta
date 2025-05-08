from abc import ABC, abstractmethod
import csv
import logging
import os
import time
from typing import Dict, List, Optional, Any

from letta import LocalClient, RESTClient, create_client
from letta.schemas.llm_config import LLMConfig
from letta.schemas.embedding_config import EmbeddingConfig


class SilenceHttpxLogs:
    """Context manager to temporarily silence httpx logs during benchmark runs."""
    
    def __init__(self):
        self.httpx_logger = logging.getLogger("httpx")
        self.original_level = self.httpx_logger.level
        
    def __enter__(self):
        # Set httpx logger level to WARNING to silence INFO messages
        self.httpx_logger.setLevel(logging.WARNING)
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore original logging level
        self.httpx_logger.setLevel(self.original_level)


class Benchmark(ABC):
    """Abstract base class for benchmarking model function calls."""
    
    def __init__(self, models: List[str], client: Optional[Any] = None):
        """Initialize the benchmark with a list of models to test.
        
        Args:
            models: List of model names to benchmark
            client: Optional client instance, will create one if not provided
        """
        self.models = models
        self.client = client or create_client()
        self.results = {}
        
    @abstractmethod
    def run(self, **kwargs) -> Dict[str, Any]:
        """Run the benchmark tests.
        
        Returns:
            Dictionary containing benchmark results
        """
        pass
    
    def save_results(self, output_file: str = "benchmark_results.csv"):
        """Save benchmark results to a CSV file.
        
        Args:
            output_file: Path to the output CSV file
        """
        if not self.results:
            raise ValueError("No results to save. Run the benchmark first.")
            
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
        
        # Write results to CSV
        with open(output_file, 'w', newline='') as csvfile:
            fieldnames = ['model'] + list(next(iter(self.results.values())).keys())
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for model, result in self.results.items():
                row = {'model': model}
                row.update(result)
                writer.writerow(row)
                
        print(f"Results saved to {output_file}")