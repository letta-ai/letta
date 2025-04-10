import time
import uuid
from typing import Dict, List, Any, Union, Optional

import letta.functions.function_sets.base as base_functions
from letta import LocalClient, RESTClient
from letta.benchmark.base import Benchmark
from letta.benchmark.constants import HUMAN, PERSONA, TRIES
from letta.errors import LLMJSONParsingError
from letta.utils import get_human_text, get_persona_text


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
        self.prompts = {
            "archival_memory_insert": "Can you make sure to remember that I like programming for me so you can look it up later?",
            "archival_memory_search": "Can you retrieve information about programming that I asked you to remember?",
        }
        
    def send_message(
        self, 
        client: Union[LocalClient, RESTClient], 
        message: str, 
        agent_id: str, 
        turn: int, 
        fn_type: str, 
        print_msg: bool = False
    ) -> tuple:
        """Send a message to the agent and check if the expected function is called.
        
        Args:
            client: Client instance to use
            message: Message to send
            agent_id: ID of the agent to send the message to
            turn: Current turn number
            fn_type: Function type to check for
            print_msg: Whether to print messages
            
        Returns:
            Tuple of (success, message)
        """
        try:
            print_msg = f"\t-> Now running {fn_type}. Progress: {turn}/{self.n_tries}"
            print(print_msg, end="\r", flush=True)
            response = client.user_message(agent_id=agent_id, message=message)

            if turn + 1 == self.n_tries:
                print(" " * len(print_msg), end="\r", flush=True)

            for r in response:
                if "function_call" in r and fn_type in r["function_call"] and any("assistant_message" in re for re in response):
                    return True, r["function_call"]

            return False, "No function called."
        except LLMJSONParsingError as e:
            print(f"Error in parsing Letta JSON: {e}")
            return False, "Failed to decode valid Letta JSON from LLM output."
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return False, "An unexpected error occurred."
            
    def run(self, **kwargs) -> Dict[str, Dict[str, Any]]:
        """Run the archival memory benchmark tests.
        
        Returns:
            Dictionary containing benchmark results
        """
        print(f"\nRunning archival memory benchmark on {len(self.models)} models with {self.n_tries} tries per function.")
        print(f"This will create {self.n_tries * len(self.prompts) * len(self.models)} new agents.\n")
        
        # Store results for each model
        for model in self.models:
            print(f"\nBenchmarking model: {model}")
            model_results = {}
            total_score = 0
            total_time = 0
            
            # Test each function type
            for fn_type, message in self.prompts.items():
                score = 0
                start_time = time.time()
                bench_id = uuid.uuid4()
                
                # Run multiple tries
                for i in range(self.n_tries):
                    # Create a new agent for each try
                    agent = self.client.create_agent(
                        name=f"benchmark_{bench_id}_agent_{i}",
                        persona=get_persona_text(PERSONA),
                        human=get_human_text(HUMAN),
                        llm_config=self.client.get_llm_config(model),
                    )
                    
                    agent_id = agent.id
                    result, msg = self.send_message(
                        client=self.client, 
                        message=message, 
                        agent_id=agent_id, 
                        turn=i, 
                        fn_type=fn_type, 
                        print_msg=kwargs.get("print_messages", False)
                    )
                    
                    if kwargs.get("print_messages", False):
                        print(f"\t{msg}")
                        
                    if result:
                        score += 1
                        
                elapsed_time = round(time.time() - start_time, 2)
                print(f"Score for {fn_type}: {score}/{self.n_tries}, took {elapsed_time} seconds")
                
                # Store results for this function
                model_results[fn_type] = {
                    "score": score,
                    "total": self.n_tries,
                    "time": elapsed_time,
                }
                
                total_score += score
                total_time += elapsed_time
                
            # Calculate overall results
            model_results["total_score"] = total_score
            model_results["total_tries"] = len(self.prompts) * self.n_tries
            model_results["total_time"] = total_time
            model_results["success_rate"] = round(total_score / (len(self.prompts) * self.n_tries) * 100, 2)
            
            # Store results for this model
            self.results[model] = model_results
            
        return self.results