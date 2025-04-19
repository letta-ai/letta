import logging
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

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


def create_agents_for_user(client, roll_dice_tool, rethink_tool, user_index: int) -> float:
    """Create agents and return E2E latency in seconds."""
    start_time = time.time()

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

    num_agents_per_user = 100
    for i in range(num_agents_per_user):
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
    return end_time - start_time


@pytest.mark.slow
def test_parallel_create_many_agents(client, roll_dice_tool, rethink_tool):
    num_users = 10
    max_workers = min(num_users, 20)

    latencies = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(create_agents_for_user, client, roll_dice_tool, rethink_tool, user_idx): user_idx
            for user_idx in range(num_users)
        }

        with tqdm(total=num_users, desc="Creating agents") as pbar:
            for future in as_completed(futures):
                user_idx = futures[future]
                try:
                    latency = future.result()
                    latencies.append(latency)
                    tqdm.write(f"[User {user_idx}] Agent creation latency: {latency:.2f} seconds")
                except Exception as e:
                    tqdm.write(f"[User {user_idx}] Error during agent creation: {str(e)}")
                pbar.update(1)

    if latencies:
        avg_latency = sum(latencies) / len(latencies)
        print(f"Average agent creation latency per user: {avg_latency:.2f} seconds")
