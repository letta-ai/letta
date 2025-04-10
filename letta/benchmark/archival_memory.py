import time
import uuid
import os
from typing import Dict, List, Any, Union, Optional

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


def query_in_search_results(search_results: List[Dict[str, Any]], query: str) -> bool:
    """Check if a query term appears in search results."""
    for result in search_results:
        if query.lower() in result["content"].lower():
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
        self.test_cases = [
            "basic_insertion_retrieval",
            "semantic_search",
            "pagination",
            "complex_text_patterns",
            "error_handling"
        ]
        
    def test_archival(self, agent_obj: Any) -> Dict[str, bool]:
        """Test archival memory functions comprehensively.
        
        Args:
            agent_obj: Agent object to test
            
        Returns:
            Dictionary with test results
        """
        results = {
            "basic_insertion_retrieval": False,
            "semantic_search": False,
            "pagination": False,
            "complex_text_patterns": False,
            "error_handling": False
        }
        
        try:
            # Test 1: Basic insertion and retrieval
            base_functions.archival_memory_insert(agent_obj, "The cat sleeps on the mat")
            base_functions.archival_memory_insert(agent_obj, "The dog plays in the park")
            base_functions.archival_memory_insert(agent_obj, "Python is a programming language")

            # Test exact text search
            results_data, _ = base_functions.archival_memory_search(agent_obj, "cat")
            basic_test_1 = query_in_search_results(results_data, "cat")

            # Test semantic search (should return animal-related content)
            results_data, _ = base_functions.archival_memory_search(agent_obj, "animal pets")
            basic_test_2 = query_in_search_results(results_data, "cat") or query_in_search_results(results_data, "dog")

            # Test unrelated search (should not return animal content)
            results_data, _ = base_functions.archival_memory_search(agent_obj, "programming computers")
            basic_test_3 = query_in_search_results(results_data, "python")
            
            results["basic_insertion_retrieval"] = basic_test_1 and basic_test_2 and basic_test_3
            
            # Test 2: Test pagination
            # Insert more items to test pagination
            for i in range(10):
                base_functions.archival_memory_insert(agent_obj, f"Test passage number {i}")

            # Get first page
            page0_results, next_page = base_functions.archival_memory_search(agent_obj, "Test passage", page=0)
            # Get second page
            page1_results, _ = base_functions.archival_memory_search(agent_obj, "Test passage", page=1, start=next_page)

            pagination_test_1 = page0_results != page1_results
            pagination_test_2 = query_in_search_results(page0_results, "Test passage")
            pagination_test_3 = query_in_search_results(page1_results, "Test passage")
            
            results["pagination"] = pagination_test_1 and pagination_test_2 and pagination_test_3

            # Test 3: Test complex text patterns
            base_functions.archival_memory_insert(agent_obj, "Important meeting on 2024-01-15 with John")
            base_functions.archival_memory_insert(agent_obj, "Follow-up meeting scheduled for next week")
            base_functions.archival_memory_insert(agent_obj, "Project deadline is approaching")

            # Search for meeting-related content
            results_data, _ = base_functions.archival_memory_search(agent_obj, "meeting schedule")
            complex_test_1 = query_in_search_results(results_data, "meeting")
            complex_test_2 = query_in_search_results(results_data, "2024-01-15") or query_in_search_results(results_data, "next week")
            
            results["complex_text_patterns"] = complex_test_1 and complex_test_2

            # Test 4: Test semantic search capabilities
            base_functions.archival_memory_insert(agent_obj, "The feline was resting on the carpet")
            base_functions.archival_memory_insert(agent_obj, "The canine was playing in the garden")
            
            results_data, _ = base_functions.archival_memory_search(agent_obj, "cat dog")
            semantic_test = query_in_search_results(results_data, "feline") or query_in_search_results(results_data, "canine")
            
            results["semantic_search"] = semantic_test

            # Test 5: Test error handling
            # Test invalid page number
            try:
                base_functions.archival_memory_search(agent_obj, "test", page="invalid")
                results["error_handling"] = False
            except ValueError:
                results["error_handling"] = True
                
        except Exception as e:
            print(f"Error during archival memory test: {e}")
            # Mark any remaining tests as failed
            
        return results
            
    def run(self, **kwargs) -> Dict[str, Dict[str, Any]]:
        """Run the archival memory benchmark tests.
        
        Returns:
            Dictionary containing benchmark results
        """
        print(f"\nRunning archival memory benchmark on {len(self.models)} models with {self.n_tries} tries per test case.")
        print(f"This will create {self.n_tries * len(self.models)} new agents.\n")
        
        # Store results for each model
        for model in self.models:
            print(f"\nBenchmarking model: {model}")
            model_results = {}
            total_score = 0
            total_time = 0
            
            # Run multiple tries for each model
            for i in range(self.n_tries):
                start_time = time.time()
                bench_id = uuid.uuid4()
                
                print(f"\t-> Running test {i+1}/{self.n_tries}")
                
                # Create a new agent for each try
                agent = self.client.create_agent(
                    name=f"benchmark_{bench_id}_agent_{i}",
                    embedding_config=self.client.list_embedding_configs()[0],
                    llm_config=self.client.list_llm_configs()[0],
                )
                
                # Load the agent object for direct function testing
                agent_obj = self.client.server.load_agent(agent_id=agent.id, actor=self.client.user)
                
                # Run the archival memory tests
                test_results = self.test_archival(agent_obj)
                
                # Update scores for each test case
                for test_case, result in test_results.items():
                    if test_case not in model_results:
                        model_results[test_case] = {"score": 0, "total": self.n_tries}
                    
                    if result:
                        model_results[test_case]["score"] += 1
                        total_score += 1
                
                # Clean up the agent
                try:
                    self.client.delete_agent(agent.id)
                except Exception as e:
                    print(f"Warning: Failed to delete agent: {e}")
                
                elapsed_time = round(time.time() - start_time, 2)
                total_time += elapsed_time
                
            # Calculate overall results
            for test_case in self.test_cases:
                if test_case in model_results:
                    success_rate = round(model_results[test_case]["score"] / model_results[test_case]["total"] * 100, 2)
                    model_results[test_case]["success_rate"] = success_rate
                    print(f"Score for {test_case}: {model_results[test_case]['score']}/{model_results[test_case]['total']} ({success_rate}%)")
            
            # Calculate overall results
            model_results["total_score"] = total_score
            model_results["total_tries"] = len(self.test_cases) * self.n_tries
            model_results["total_time"] = total_time
            model_results["success_rate"] = round(total_score / (len(self.test_cases) * self.n_tries) * 100, 2)
            
            print(f"Overall success rate: {model_results['success_rate']}% (took {total_time} seconds)")
            
            # Store results for this model
            self.results[model] = model_results
            
        return self.results