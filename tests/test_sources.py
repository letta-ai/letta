import os
import re
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import CreateBlock
from letta_client import Letta as LettaSDKClient
from letta_client.types import AgentState

from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(scope="module")
def client() -> LettaSDKClient:
    # Get URL from environment or start server
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:{SERVER_PORT}")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)
    print("Running client tests with server:", server_url)
    client = LettaSDKClient(base_url=server_url, token=None)
    yield client


@pytest.fixture
def agent_state(client: LettaSDKClient):
    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlock(
                label="human",
                value="username: sarah",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )
    yield agent_state

    # delete agent
    client.agents.delete(agent_id=agent_state.id)


import re
import time

import pytest


@pytest.mark.parametrize(
    "file_path, expected_value, expected_label_regex",
    [
        ("tests/data/test.txt", "test", r"test_[a-z0-9]+\.txt"),
        ("tests/data/memgpt_paper.pdf", "MemGPT", r"memgpt_paper_[a-z0-9]+\.pdf"),
    ],
)
def test_file_upload_creates_source_blocks_correctly(
    client: LettaSDKClient,
    agent_state: AgentState,
    file_path: str,
    expected_value: str,
    expected_label_regex: str,
):
    # Clear existing sources
    for source in client.sources.list():
        client.sources.delete(source_id=source.id)

    # Clear existing jobs
    for job in client.jobs.list():
        client.jobs.delete(job_id=job.id)

    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-ada-002")
    assert len(client.sources.list()) == 1

    # Attach
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Upload the file
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the job to complete
    while job.status != "completed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

    # Get uploaded files
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Check that blocks were created
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 2
    assert any(expected_value in b.value for b in blocks)
    assert any(re.fullmatch(expected_label_regex, b.label) for b in blocks)

    # Remove file from source
    client.sources.files.delete(source_id=source.id, file_id=files[0].id)

    # Confirm blocks were removed
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 1
    assert not any(expected_value in b.value for b in blocks)
    assert not any(re.fullmatch(expected_label_regex, b.label) for b in blocks)


def test_attach_existing_files_creates_source_blocks_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Clear existing sources
    for source in client.sources.list():
        client.sources.delete(source_id=source.id)

    # Clear existing jobs
    for job in client.jobs.list():
        client.jobs.delete(job_id=job.id)

    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-ada-002")
    assert len(client.sources.list()) == 1

    # Load files into the source
    file_path = "tests/data/test.txt"

    # Upload the files
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

    # Get the first file with pagination
    files = client.sources.files.list(source_id=source.id, limit=1)
    assert len(files) == 1
    assert files[0].source_id == source.id

    # Attach after uploading the file
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Get the agent state, check blocks exist
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 2
    assert "test" in [b.value for b in blocks]
    assert any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)

    # Detach the source
    client.agents.sources.detach(source_id=source.id, agent_id=agent_state.id)

    # Get the agent state, check blocks do NOT exist
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 1
    assert "test" not in [b.value for b in blocks]
    assert not any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)


def test_delete_source_removes_source_blocks_correctly(client: LettaSDKClient, agent_state: AgentState):
    # Clear existing sources
    for source in client.sources.list():
        client.sources.delete(source_id=source.id)

    # Clear existing jobs
    for job in client.jobs.list():
        client.jobs.delete(job_id=job.id)

    # Create a new source
    source = client.sources.create(name="test_source", embedding="openai/text-embedding-ada-002")
    assert len(client.sources.list()) == 1

    # Attach
    client.agents.sources.attach(source_id=source.id, agent_id=agent_state.id)

    # Load files into the source
    file_path = "tests/data/test.txt"

    # Upload the files
    with open(file_path, "rb") as f:
        job = client.sources.files.upload(source_id=source.id, file=f)

    # Wait for the jobs to complete
    while job.status != "completed":
        time.sleep(1)
        job = client.jobs.retrieve(job_id=job.id)
        print("Waiting for jobs to complete...", job.status)

    # Get the agent state, check blocks exist
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 2
    assert "test" in [b.value for b in blocks]
    assert any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)

    # Remove file from source
    client.sources.delete(source_id=source.id)

    # Get the agent state, check blocks do NOT exist
    blocks = client.agents.blocks.list(agent_id=agent_state.id)
    assert len(blocks) == 1
    assert "test" not in [b.value for b in blocks]
    assert not any(re.fullmatch(r"test_[a-z0-9]+\.txt", b.label) for b in blocks)
