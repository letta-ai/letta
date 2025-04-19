import logging
import os
import random
import threading
import time
import uuid

import matplotlib.pyplot as plt
import pandas as pd
import pytest
from dotenv import load_dotenv
from letta_client import Letta
from tqdm import tqdm

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


# --- Server Management --- #


def _run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture(scope="session")
def server_url():
    """Ensures a server is running and returns its base URL."""
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        time.sleep(2)  # Allow server startup time

    return url


# --- Client Setup --- #


@pytest.fixture(scope="session")
def client(server_url):
    """Creates a REST client for testing."""
    client = Letta(base_url=server_url)
    yield client


@pytest.fixture()
def roll_dice_tool(client):
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        return "Rolled a 10!"

    tool = client.tools.upsert_from_function(func=roll_dice)
    # Yield the created tool
    yield tool


@pytest.fixture()
def rethink_tool(client):
    def rethink_memory(agent_state: "AgentState", new_memory: str, target_block_label: str) -> str:  # type: ignore
        """
        Re-evaluate the memory in block_name, integrating new and updated facts.
        Replace outdated information with the most likely truths, avoiding redundancy with original memories.
        Ensure consistency with other memory blocks.

        Args:
            new_memory (str): The new memory with information integrated from the memory block. If there is no new information, then this should be the same as the content in the source block.
            target_block_label (str): The name of the block to write to.
        Returns:
            str: None is always returned as this function does not produce a response.
        """
        agent_state.memory.update_block_value(label=target_block_label, value=new_memory)
        return None

    tool = client.tools.upsert_from_function(func=rethink_memory)
    yield tool


@pytest.fixture(scope="function")
def weather_tool(client):
    def get_weather(location: str) -> str:
        """
        Fetches the current weather for a given location.

        Parameters:
            location (str): The location to get the weather for.

        Returns:
            str: A formatted string describing the weather in the given location.

        Raises:
            RuntimeError: If the request to fetch weather data fails.
        """
        import requests

        url = f"https://wttr.in/{location}?format=%C+%t"

        response = requests.get(url)
        if response.status_code == 200:
            weather_data = response.text
            return f"The weather in {location} is {weather_data}."
        else:
            raise RuntimeError(f"Failed to get weather data, status code: {response.status_code}")

    tool = client.tools.upsert_from_function(func=get_weather)
    # Yield the created tool
    yield tool


# --- Load Test --- #


@pytest.mark.slow
def test_sequential_mass_update_agents_complex(client, roll_dice_tool, weather_tool, rethink_tool):
    # 1) Create 30 agents WITHOUT the rethink_tool initially
    AGENT_COUNT = 30
    UPDATES_PER_AGENT = 50

    agent_ids = []
    for i in range(AGENT_COUNT):
        agent = client.agents.create(
            name=f"seq_agent_{i}_{uuid.uuid4().hex[:6]}",
            tool_ids=[roll_dice_tool.id, weather_tool.id],
            include_base_tools=False,
            memory_blocks=[
                {"label": "human", "value": "Name: Matt"},
                {"label": "persona", "value": "Friendly agent"},
            ],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        )
        agent_ids.append(agent.id)

    # 2) Pre-create 10 new blocks *per* agent
    per_agent_blocks = {}
    for aid in agent_ids:
        block_ids = []
        for j in range(10):
            blk = client.blocks.create(
                label=f"{aid[:6]}_blk{j}",
                value="Precreated block content",
                description="Load-test block",
                limit=500,
                metadata={"idx": str(j)},
            )
            block_ids.append(blk.id)
        per_agent_blocks[aid] = block_ids

    # 3) Sequential updates: measure latency for each (agent, iteration)
    latencies = []
    total_ops = AGENT_COUNT * UPDATES_PER_AGENT

    idx = 0
    with tqdm(total=total_ops, desc="Sequential updates") as pbar:
        for aid in agent_ids:
            for _ in range(UPDATES_PER_AGENT):
                start = time.time()
                if random.random() < 0.5:
                    client.agents.modify(agent_id=aid, tool_ids=[rethink_tool.id])
                else:
                    bid = random.choice(per_agent_blocks[aid])
                    client.agents.modify(agent_id=aid, block_ids=[bid])
                elapsed = time.time() - start

                latencies.append(elapsed)
                idx += 1
                pbar.update(1)

    # 4) Cleanup
    for aid in agent_ids:
        client.agents.delete(aid)

    # 5) Line‐plot every single latency
    df = pd.DataFrame({"latency": latencies})
    plt.figure(figsize=(10, 5))
    plt.plot(df["latency"].values, marker=".", linestyle="-", alpha=0.7)
    plt.title("Sequential Update Latencies Over Time")
    plt.xlabel("Operation Index")
    plt.ylabel("Latency (s)")
    plt.grid(True, alpha=0.3)

    plot_file = f"seq_update_latency_{int(time.time())}.png"
    plt.tight_layout()
    plt.savefig(plot_file)
    plt.close()

    # 6) Summary
    mean = df["latency"].mean()
    median = df["latency"].median()
    minimum = df["latency"].min()
    maximum = df["latency"].max()
    stdev = df["latency"].std()

    print("\n===== Sequential Complex Update Latencies =====")
    print(f"Total ops : {len(latencies)}")
    print(f"Mean      : {mean:.3f}s")
    print(f"Median    : {median:.3f}s")
    print(f"Min       : {minimum:.3f}s")
    print(f"Max       : {maximum:.3f}s")
    print(f"Std dev   : {stdev:.3f}s")
    print(f"Plot saved: {plot_file}")
