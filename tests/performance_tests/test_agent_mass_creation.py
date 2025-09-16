import logging
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import matplotlib.pyplot as plt
import pandas as pd
import pytest
from dotenv import load_dotenv
from letta_client import Letta
from tqdm import tqdm

from letta.schemas.block import Block
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.services.block_manager import BlockManager

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


@pytest.fixture
def default_block(default_user):
    """Fixture to create and return a default block."""
    block_manager = BlockManager()
    block_data = Block(
        label="default_label",
        value="Default Block Content",
        description="A default test block",
        limit=1000,
        metadata={"type": "test"},
    )
    block = block_manager.create_or_update_block(block_data, actor=default_user)
    yield block


@pytest.fixture(scope="function")
def agent_state(client, roll_dice_tool, weather_tool, rethink_tool):
    agent_state = client.agents.create(
        name=f"test_compl_{str(uuid.uuid4())[5:]}",
        tool_ids=[roll_dice_tool.id, weather_tool.id, rethink_tool.id],
        include_base_tools=True,
        memory_blocks=[
            {
                "label": "human",
                "value": "Name: Matt",
            },
            {
                "label": "persona",
                "value": "Friendly agent",
            },
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


# --- Load Test --- #


def create_agents_for_user(client, roll_dice_tool, rethink_tool, user_index: int) -> tuple:
    """Create agents and return E2E latencies in seconds along with user index."""
    # Setup blocks first
    num_blocks = 10
    blocks = []
    for i in range(num_blocks):
        block = client.blocks.create(
            label=f"user{user_index}_block{i}",
            value="Default Block Content",
            description="A default test block",
            limit=1000,
            metadata={"index": str(i)},
        )
        blocks.append(block)
    block_ids = [b.id for b in blocks]

    # Now create agents and track individual latencies
    agent_latencies = []
    num_agents_per_user = 100
    for i in range(num_agents_per_user):
        start_time = time.time()

        client.agents.create(
            name=f"user{user_index}_agent_{str(uuid.uuid4())[5:]}",
            tool_ids=[roll_dice_tool.id, rethink_tool.id],
            include_base_tools=True,
            memory_blocks=[
                {"label": "human", "value": "Name: Matt"},
                {"label": "persona", "value": "Friendly agent"},
            ],
            model="openai/gpt-4o",
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            block_ids=block_ids,
        )

        end_time = time.time()
        latency = end_time - start_time
        agent_latencies.append({"user_index": user_index, "agent_index": i, "latency": latency})

    return user_index, agent_latencies


def plot_agent_creation_latencies(latency_data):
    """
    Plot the distribution of agent creation latencies.

    Args:
        latency_data: List of dictionaries with latency information
    """
    # Convert to DataFrame for easier analysis
    df = pd.DataFrame(latency_data)

    # Overall latency distribution
    plt.figure(figsize=(12, 10))

    # Plot 1: Overall latency histogram
    plt.subplot(2, 2, 1)
    plt.hist(df["latency"], bins=30, alpha=0.7, color="blue")
    plt.title(f"Agent Creation Latency Distribution (n={len(df)})")
    plt.xlabel("Latency (seconds)")
    plt.ylabel("Frequency")
    plt.grid(True, alpha=0.3)

    # Plot 2: Latency by user (boxplot)
    plt.subplot(2, 2, 2)
    user_groups = df.groupby("user_index")
    plt.boxplot([group["latency"] for _, group in user_groups])
    plt.title("Latency Distribution by User")
    plt.xlabel("User Index")
    plt.ylabel("Latency (seconds)")
    plt.xticks(range(1, len(user_groups) + 1), sorted(df["user_index"].unique()))
    plt.grid(True, alpha=0.3)

    # Plot 3: Time series of latencies
    plt.subplot(2, 1, 2)
    for user_idx in sorted(df["user_index"].unique()):
        user_data = df[df["user_index"] == user_idx]
        plt.plot(user_data["agent_index"], user_data["latency"], marker=".", linestyle="-", alpha=0.7, label=f"User {user_idx}")

    plt.title("Agent Creation Latency Over Time")
    plt.xlabel("Agent Creation Sequence")
    plt.ylabel("Latency (seconds)")
    plt.legend(loc="upper right")
    plt.grid(True, alpha=0.3)

    # Add statistics as text
    stats_text = (
        f"Mean: {df['latency'].mean():.2f}s\n"
        f"Median: {df['latency'].median():.2f}s\n"
        f"Min: {df['latency'].min():.2f}s\n"
        f"Max: {df['latency'].max():.2f}s\n"
        f"Std Dev: {df['latency'].std():.2f}s"
    )
    plt.figtext(0.02, 0.02, stats_text, fontsize=10, bbox=dict(facecolor="white", alpha=0.8))

    plt.tight_layout()

    # Save the plot
    plot_file = f"agent_creation_latency_plot_{time.strftime('%Y%m%d_%H%M%S')}.png"
    plt.savefig(plot_file)
    plt.close()

    print(f"Latency plot saved to {plot_file}")

    # Return statistics for reporting
    return {
        "mean": df["latency"].mean(),
        "median": df["latency"].median(),
        "min": df["latency"].min(),
        "max": df["latency"].max(),
        "std": df["latency"].std(),
        "count": len(df),
        "plot_file": plot_file,
    }


@pytest.mark.slow
def test_parallel_create_many_agents(client, roll_dice_tool, rethink_tool):
    num_users = 7
    max_workers = min(num_users, 20)

    # To collect all latency data across users
    all_latency_data = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(create_agents_for_user, client, roll_dice_tool, rethink_tool, user_idx): user_idx
            for user_idx in range(num_users)
        }

        with tqdm(total=num_users, desc="Creating agents") as pbar:
            for future in as_completed(futures):
                try:
                    user_idx, user_latencies = future.result()
                    all_latency_data.extend(user_latencies)

                    # Calculate and display per-user statistics
                    latencies = [data["latency"] for data in user_latencies]
                    avg_latency = sum(latencies) / len(latencies)
                    tqdm.write(f"[User {user_idx}] Completed {len(latencies)} agents")
                    tqdm.write(f"[User {user_idx}] Avg: {avg_latency:.2f}s, Min: {min(latencies):.2f}s, Max: {max(latencies):.2f}s")
                except Exception as e:
                    user_idx = futures[future]
                    tqdm.write(f"[User {user_idx}] Error during agent creation: {str(e)}")
                pbar.update(1)

    if all_latency_data:
        # Plot all collected latency data
        stats = plot_agent_creation_latencies(all_latency_data)

        print("\n===== Agent Creation Latency Statistics =====")
        print(f"Total agents created: {stats['count']}")
        print(f"Mean latency: {stats['mean']:.2f} seconds")
        print(f"Median latency: {stats['median']:.2f} seconds")
        print(f"Min latency: {stats['min']:.2f} seconds")
        print(f"Max latency: {stats['max']:.2f} seconds")
        print(f"Standard deviation: {stats['std']:.2f} seconds")
        print(f"Latency plot saved to: {stats['plot_file']}")
        print("============================================")
