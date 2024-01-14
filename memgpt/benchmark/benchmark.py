from memgpt import MemGPT
from memgpt.config import MemGPTConfig
# from memgpt.agent import Agent
from memgpt.errors import LLMJSONParsingError
from memgpt.benchmark.constants import TRIES, PERSONA, HUMAN, PROMPTS
import typer
import time

app = typer.Typer()
client = MemGPT()

def send_message(message: str, agent_id, turn: int, fn_type: str, print_msg: bool = False, n_tries: int = TRIES):
    try:
        print_msg = f"\t-> Now running {fn_type}. Progress: {turn}/{n_tries}"
        print(print_msg, end="\r", flush=True)
        response, tokens_accumulated = client.user_message(agent_id=agent_id, message=message)

        if turn + 1 == n_tries:
            print("  " * len(print_msg), end='\r', flush=True)

        for r in response:
            if "function_call" in r and fn_type in r['function_call'] and any("assistant_message" in re for re in response):
                return True, r['function_call'], tokens_accumulated
        
        return False, "No function called.", tokens_accumulated
    except LLMJSONParsingError as e:
        print(f"Error in parsing MemGPT JSON: {e}")
        return False, "Failed to decode valid MemGPT JSON from LLM output.", tokens_accumulated
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False, "An unexpected error occurred.", tokens_accumulated


@app.command()
def bench(
    print_messages: bool = typer.Option(False, "--messages", help="Print functions calls and messages from the agent."),
    n_tries: int = typer.Option(TRIES, "--n-tries", help="Number of benchmark tries to perform for each function.")
):
    print(f"\nDepending on your hardware, this may take up to 30 minutes. This will also create {n_tries * len(PROMPTS)} new agents.\n")

    total_score, total_tokens_accumulated, elapsed_time = 0, 0, 0

    for fn_type, message in PROMPTS.items():
        score = 0
        start_time_run = time.time()

        for i in range(n_tries):
            agent = client.create_agent(agent_config={"name": f"benchmark_agent_{i}", "persona": PERSONA, "human": HUMAN}, throw_if_exists=True)
        
            agent_id = agent.id
            result, msg, tokens_accumulated = send_message(message=message, agent_id=agent_id, turn=i, fn_type=fn_type, print_msg=print_messages, n_tries=n_tries)
            
            if print_messages:
                print(f"\t{msg}")

            if result:
                score += 1

            total_tokens_accumulated += tokens_accumulated

        elapsed_time_run = round(time.time() - start_time_run, 2)
        print(f"Score for {fn_type}: {score}/{n_tries}, took {elapsed_time_run} seconds")

        elapsed_time += elapsed_time_run
        total_score += score     

    config = MemGPTConfig.load()
    print(f"\nMEMGPT VERSION: {config.memgpt_version}")
    print(f"CONTEXT WINDOW: {config.context_window}")
    print(f"MODEL WRAPPER: {config.model_wrapper}")
    print(f"PRESET: {config.preset}")
    print(f"PERSONA: {config.persona}")
    print(f"HUMAN: {config.human}")
    print(f"AGENT: {config.agent}")

    print(f"\n\t-> Total score: {total_score}/{len(PROMPTS) * n_tries}, took {elapsed_time} seconds at average of {round(total_tokens_accumulated/elapsed_time, 2)} t/s\n")
