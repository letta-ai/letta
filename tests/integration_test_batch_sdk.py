import os
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import Letta, LettaBatchRequest, MessageCreate, TextContent

from letta.config import LettaConfig
from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.orm import Base
from letta.schemas.enums import JobStatus
from letta.server.db import db_context
from letta.server.server import SyncServer


@pytest.fixture(autouse=True)
def clear_batch_tables():
    """Clear batch-related tables before each test."""
    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in {"jobs", "llm_batch_job", "llm_batch_items"}:
                session.execute(table.delete())  # Truncate table
        session.commit()


def run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture(scope="session")
def server_url():
    """
    Ensures a server is running and returns its base URL.

    Uses environment variable if available, otherwise starts a server
    in a background thread.
    """
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)  # Give server time to start

    return url


@pytest.fixture(scope="module")
def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()
    config.save()
    return SyncServer()


@pytest.fixture(scope="session")
def client(server_url):
    """Creates a REST client connected to the test server."""
    return Letta(base_url=server_url)


@pytest.mark.asyncio
async def test_create_batch(client: Letta, server: SyncServer):
    # create agents
    agent1 = client.agents.create(
        name="agent1_batch",
        memory_blocks=[{"label": "persona", "value": "you are agent 1"}],
        model="anthropic/claude-3-7-sonnet-20250219",
        embedding="letta/letta-free",
    )
    agent2 = client.agents.create(
        name="agent2_batch",
        memory_blocks=[{"label": "persona", "value": "you are agent 2"}],
        model="anthropic/claude-3-7-sonnet-20250219",
        embedding="letta/letta-free",
    )

    # create a run
    run = client.batches.create(
        requests=[
            LettaBatchRequest(
                messages=[
                    MessageCreate(
                        role="user",
                        content=[
                            TextContent(
                                text="hi",
                            )
                        ],
                    )
                ],
                agent_id=agent1.id,
            ),
            LettaBatchRequest(
                messages=[
                    MessageCreate(
                        role="user",
                        content=[
                            TextContent(
                                text="hi",
                            )
                        ],
                    )
                ],
                agent_id=agent2.id,
            ),
        ]
    )
    assert run is not None

    # list batches
    batches = client.batches.list()
    assert len(batches) == 1, f"Expected 1 batch, got {len(batches)}"
    assert batches[0].status == JobStatus.running

    # Poll it once
    await poll_running_llm_batches(server)

    # get the batch results
    results = client.batches.retrieve(
        batch_id=run.id,
    )
    assert results is not None

    # cancel
    client.batches.cancel(batch_id=run.id)
    batch_job = client.batches.retrieve(
        batch_id=run.id,
    )
    assert batch_job.status == JobStatus.cancelled
