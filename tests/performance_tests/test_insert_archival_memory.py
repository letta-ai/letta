import asyncio
import logging
import os
import threading
import time
import uuid
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pytest
from dotenv import load_dotenv
from faker import Faker
from letta_client import AsyncLetta
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
    client = AsyncLetta(base_url=server_url)
    yield client


# --- Load Test --- #

NUM_AGENTS = 30


@pytest.mark.asyncio
async def test_insert_archival_memories_concurrent(client):
    fake = Faker()

    # 1) Create agents
    agent_ids = []
    for i in tqdm(range(NUM_AGENTS), desc="Creating agents"):
        agent = await client.agents.create(
            name=f"complex_agent_{i}_{uuid.uuid4().hex[:6]}",
            include_base_tools=True,
            memory_blocks=[
                {"label": "human", "value": "Name: Matt"},
                {"label": "persona", "value": "Friendly agent"},
            ],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
        )
        agent_ids.append(agent.id)

    # 2) Measure start and duration of each call
    timeline = []

    async def measure(agent_index, aid):
        t0 = time.perf_counter()
        await client.agents.passages.create(agent_id=aid, text=fake.paragraph())
        t1 = time.perf_counter()
        timeline.append((agent_index, t0, t1 - t0))

    await asyncio.gather(*(measure(idx, aid) for idx, aid in enumerate(agent_ids)))

    # 3) Convert to arrays
    timeline.sort(key=lambda x: x[0])
    indices = np.array([t[0] for t in timeline])
    starts = np.array([t[1] for t in timeline])
    durs = np.array([t[2] for t in timeline])
    start_offset = starts - starts.min()

    print(f"Latency stats (s): min={durs.min():.3f}, mean={durs.mean():.3f}, max={durs.max():.3f}, std={durs.std():.3f}")

    # 4) Generate improved plots
    # Helper: concurrency over time
    events = np.concatenate([np.column_stack([starts, np.ones_like(starts)]), np.column_stack([starts + durs, -np.ones_like(durs)])])
    events = events[events[:, 0].argsort()]
    concurrency_t = np.cumsum(events[:, 1])
    concurrency_x = events[:, 0] - starts.min()

    # Helper: latency CDF
    durs_sorted = np.sort(durs)
    cdf_y = np.arange(1, len(durs_sorted) + 1) / len(durs_sorted)

    # Plot all 6 subplots
    fig, axes = plt.subplots(2, 3, figsize=(15, 8))
    axs = axes.ravel()

    # 1) Kickoff timeline
    axs[0].scatter(indices, start_offset, s=15)
    axs[0].set_title("Kick-off timeline")
    axs[0].set_xlabel("Call index")
    axs[0].set_ylabel("Start offset (s)")

    # 2) Per-call latency
    axs[1].plot(indices, durs, marker="o", linestyle="")
    axs[1].set_title("Per-call latency")
    axs[1].set_xlabel("Call index")
    axs[1].set_ylabel("Duration (s)")

    # 3) Latency distribution (histogram)
    axs[2].hist(durs, bins="auto")
    axs[2].set_title("Latency distribution")
    axs[2].set_xlabel("Duration (s)")
    axs[2].set_ylabel("Count")

    # 4) Empirical CDF
    axs[3].step(durs_sorted, cdf_y, where="post")
    axs[3].set_title("Latency CDF")
    axs[3].set_xlabel("Duration (s)")
    axs[3].set_ylabel("Fraction ≤ x")

    # 5) Concurrency over time
    axs[4].step(concurrency_x, concurrency_t, where="post")
    axs[4].set_title("Concurrency vs. time")
    axs[4].set_xlabel("Time since first start (s)")
    axs[4].set_ylabel("# in-flight")

    # 6) Summary stats
    axs[5].axis("off")
    summary_text = (
        f"n = {len(durs)}\n"
        f"min   = {durs.min():.3f} s\n"
        f"p50   = {np.percentile(durs, 50):.3f} s\n"
        f"mean  = {durs.mean():.3f} s\n"
        f"p95   = {np.percentile(durs, 95):.3f} s\n"
        f"max   = {durs.max():.3f} s\n"
        f"stdev = {durs.std():.3f} s"
    )
    axs[5].text(0.02, 0.98, summary_text, va="top", ha="left", fontsize=11, family="monospace", transform=axs[5].transAxes)

    plt.tight_layout()
    plt.savefig("latency_diagnostics.png", dpi=150)
    print("Saved latency_diagnostics.png")


@pytest.mark.asyncio
async def test_insert_large_archival_memory(client):
    # 1) Create 30 agents
    agent = await client.agents.create(
        include_base_tools=True,
        memory_blocks=[
            {"label": "human", "value": "Name: Matt"},
            {"label": "persona", "value": "Friendly agent"},
        ],
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )

    file_path = Path(__file__).parent / "data" / "paper1.txt"
    text = file_path.read_text()

    t0 = time.perf_counter()
    await client.agents.passages.create(agent_id=agent.id, text=text)
    t1 = time.perf_counter()

    print(f"Total time: {t1 - t0}")
