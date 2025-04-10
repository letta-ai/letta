import time
import uuid
import os
import csv
import datetime
import requests
from pathlib import Path
from typing import Dict, List, Any, Union, Optional, Tuple

import letta.functions.function_sets.base as base_functions
from letta import LocalClient, RESTClient
from letta.benchmark.base import Benchmark
from letta.benchmark.constants import HUMAN, PERSONA, TRIES
from letta.errors import LLMJSONParsingError
from letta.utils import get_human_text, get_persona_text

# Check if we're using SQLite or PostgreSQL
USING_SQLITE = not bool(os.getenv("LETTA_PG_URI"))
# Add a small delay for SQLite to avoid timestamp collisions
CREATE_DELAY_SQLITE = 0.1 if USING_SQLITE else 0

# LongBench subsets to use
LONGBENCH_SUBSETS = [
    "2wikimqa_e", 
    "rec_e",
    "samsum_e", 
    "qasper_e", 
    "triviaqa_e", 
    "narrativeqa", 
    "musique"
]

# Minimum context length to include in benchmark
MIN_CONTEXT_LENGTH = 10000


def query_in_search_results(search_results: List[Dict[str, Any]], query: str) -> bool:
    """Check if a query term appears in search results."""
    for result in search_results:
        if query.lower() in result["content"].lower():
            return True
    return False


def answer_in_search_results(search_results: List[Dict[str, Any]], answers: List[str]) -> bool:
    """Check if at least one of the answers appears in search results."""
    for result in search_results:
        content = result["content"].lower()
        for answer in answers:
            if answer.lower() in content:
                return True
    return False


class ArchivalMemoryBenchmark(Benchmark):
    """Benchmark for testing archival memory functions."""
    
    def __init__(self, models: List[str], client: Optional[Any] = None, n_tries: int = TRIES):
        """Initialize the archival memory benchmark.
        
        Args:
            models: List of model names to benchmark
            client: Optional client instance, will create one if not provided
            n_tries: Number of benchmark tries to perform for each function
        """
        super().__init__(models, client)
        self.n_tries = n_tries
        self.test_cases = LONGBENCH_SUBSETS
        self.dataset_cache = {}
        

    
    def download_subset_sample(self, subset_name: str, split: str = "test", max_samples: int = 5) -> List[Dict]:
        """Download a sample of examples from a LongBench subset.
        
        Args:
            subset_name: Name of the LongBench subset
            split: Dataset split to use (default: "test")
            max_samples: Maximum number of samples to download
            
        Returns:
            List of examples from the subset
        """
        cache_key = f"{subset_name}_{split}"
        if cache_key in self.dataset_cache:
            return self.dataset_cache[cache_key]
            
        # HuggingFace API endpoint for dataset info
        api_url = f"https://huggingface.co/api/datasets/THUDM/LongBench/parquet/{subset_name}/{split}"
        
        try:
            # Get dataset info
            response = requests.get(api_url)
            response.raise_for_status()
            
            # Get the first few rows that match our criteria
            examples = []
            count = 0
            
            # Download and process the data in chunks to avoid memory issues
            for i in range(min(3, len(response.json()))):  # Limit to first 3 chunks to avoid downloading too much
                chunk_url = f"{api_url}/{i}"
                chunk_response = requests.get(chunk_url)
                chunk_response.raise_for_status()
                
                # Parse the chunk data
                chunk_data = chunk_response.json()
                
                # Process each example in the chunk
                for example in chunk_data:
                    # Check if the context is long enough
                    if "context" in example and len(example["context"]) >= MIN_CONTEXT_LENGTH:
                        # Make sure we have the required fields
                        if "input" in example and "answers" in example:
                            examples.append(example)
                            count += 1
                            
                            # Stop if we have enough examples
                            if count >= max_samples:
                                break
                
                # Stop if we have enough examples
                if count >= max_samples:
                    break
            
            # Cache the examples
            self.dataset_cache[cache_key] = examples
            return examples
            
        except Exception as e:
            print(f"Error downloading subset {subset_name}: {e}")
            return []
    
    def test_longbench_subset(self, agent_obj: Any, subset_name: str) -> Tuple[int, int]:
        """Test archival memory using examples from a LongBench subset.
        
        Args:
            agent_obj: Agent object to test
            subset_name: Name of the LongBench subset
            
        Returns:
            Tuple of (number of successful tests, total number of tests)
        """
        examples = self.download_subset_sample(subset_name)
        if not examples:
            print(f"No examples found for subset {subset_name}")
            return 0, 0
            
        successful = 0
        total = len(examples)
        
        for i, example in enumerate(examples):
            try:
                print(f"  Testing example {i+1}/{total} from {subset_name}")
                
                # Insert the context into archival memory
                base_functions.archival_memory_insert(agent_obj, example["context"])
                
                # Search for the input in archival memory
                results_data, _ = base_functions.archival_memory_search(agent_obj, example["input"])
                
                # Check if at least one of the answers is in the search results
                answers = example["answers"]
                if isinstance(answers, str):
                    answers = [answers]
                
                if answer_in_search_results(results_data, answers):
                    successful += 1
                    print(f"    [PASS] Test passed")
                else:
                    print(f"    [FAIL] Test failed - answer not found in search results")
                    
            except Exception as e:
                print(f"    [ERROR] Error during test: {e}")
                
        return successful, total
    
    def test_archival(self, agent_obj: Any) -> Dict[str, bool]:
        """Test archival memory functions comprehensively.
        
        Args:
            agent_obj: Agent object to test
            
        Returns:
            Dictionary with test results
        """
        # For LongBench, we'll return an empty dict since we handle the tests differently
        return {}
            
    def write_results_to_csv(self, results: Dict[str, Dict[str, Any]], csv_path: str = None) -> None:
        """Write benchmark results to a CSV file.
        
        Args:
            results: Dictionary containing benchmark results
            csv_path: Path to the CSV file to write to, defaults to benchmark/results.csv
        """
        if csv_path is None:
            # Use the default path in the benchmark directory
            csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "benchmark", "results.csv")
        
        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(csv_path), exist_ok=True)
        
        # Check if the file exists to determine if we need to write headers
        file_exists = os.path.isfile(csv_path)
        
        # Get the current timestamp
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open(csv_path, mode='a', newline='') as file:
            # Define the CSV writer
            writer = csv.writer(file)
            
            # Write headers if the file doesn't exist
            if not file_exists:
                headers = ["timestamp", "model", "test_case", "score", "total", "success_rate", "time"]
                writer.writerow(headers)
            
            # Write results for each model and test case
            for model, model_data in results.items():
                # Write individual test case results
                for test_case in self.test_cases:
                    if test_case in model_data:
                        test_data = model_data[test_case]
                        writer.writerow([
                            timestamp,
                            model,
                            test_case,
                            test_data["score"],
                            test_data["total"],
                            test_data["success_rate"],
                            test_data.get("time", "N/A")
                        ])
                
                # Write overall results
                writer.writerow([
                    timestamp,
                    model,
                    "overall",
                    model_data["total_score"],
                    model_data["total_tries"],
                    model_data["success_rate"],
                    model_data["total_time"]
                ])
        
        print(f"Results written to {csv_path}")
    
    def run(self, **kwargs) -> Dict[str, Dict[str, Any]]:
        """Run the archival memory benchmark tests.
        
        Args:
            **kwargs: Additional keyword arguments
                csv_path: Path to the CSV file to write results to
                
        Returns:
            Dictionary containing benchmark results
        """
        # LongBench benchmark
        print(f"\nRunning LongBench memory benchmark on {len(self.models)} models.")
        print(f"Testing with subsets: {', '.join(self.test_cases)}")
        print(f"Minimum context length: {MIN_CONTEXT_LENGTH} characters\n")
        
        # Store results for each model
        for model in self.models:
            print(f"\nBenchmarking model: {model}")
            model_results = {}
            total_score = 0
            total_tries = 0
            total_time = 0
            
            # Run tests for each subset
            for subset in self.test_cases:
                start_time = time.time()
                bench_id = uuid.uuid4()
                
                print(f"\n-> Testing subset: {subset}")
                
                # Create a new agent for each subset
                agent = self.client.create_agent(
                    name=f"benchmark_{bench_id}_agent_{subset}",
                    embedding_config=self.client.list_embedding_configs()[0],
                    llm_config=self.client.list_llm_configs()[0],
                )
                
                # Load the agent object for direct function testing
                agent_obj = self.client.server.load_agent(agent_id=agent.id, actor=self.client.user)
                
                # Run the tests for this subset
                score, total = self.test_longbench_subset(agent_obj, subset)
                
                # Update scores for this subset
                if total > 0:
                    success_rate = round(score / total * 100, 2)
                    model_results[subset] = {
                        "score": score,
                        "total": total,
                        "success_rate": success_rate,
                        "time": round(time.time() - start_time, 2)
                    }
                    total_score += score
                    total_tries += total
                    print(f"Score for {subset}: {score}/{total} ({success_rate}%)")
                else:
                    model_results[subset] = {
                        "score": 0,
                        "total": 0,
                        "success_rate": 0,
                        "time": round(time.time() - start_time, 2)
                    }
                    print(f"No tests run for {subset}")
                
                # Clean up the agent
                try:
                    self.client.delete_agent(agent.id)
                except Exception as e:
                    print(f"Warning: Failed to delete agent: {e}")
                
                elapsed_time = round(time.time() - start_time, 2)
                total_time += elapsed_time
            
            # Calculate overall results
            if total_tries > 0:
                model_results["total_score"] = total_score
                model_results["total_tries"] = total_tries
                model_results["total_time"] = total_time
                model_results["success_rate"] = round(total_score / total_tries * 100, 2)
                
                print(f"\nOverall success rate: {model_results['success_rate']}% (took {total_time} seconds)")
            else:
                model_results["total_score"] = 0
                model_results["total_tries"] = 0
                model_results["total_time"] = total_time
                model_results["success_rate"] = 0
                
                print(f"\nNo tests were run successfully")
            
            # Store results for this model
            self.results[model] = model_results
        
        # Write results to CSV file
        csv_path = kwargs.get("csv_path", None)
        self.write_results_to_csv(self.results, csv_path)
            
        return self.results