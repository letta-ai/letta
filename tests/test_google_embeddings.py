import httpx
import pytest
from dotenv import load_dotenv

from letta.embeddings import GoogleEmbeddings  # Adjust the import based on your module structure

load_dotenv()
import os
import threading
import time

import pytest
from letta_client import CreateBlock, Letta as LettaSDKClient, MessageCreate

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
        time.sleep(5)
    print("Running client tests with server:", server_url)
    client = LettaSDKClient(base_url=server_url, token=None)
    yield client


def test_google_embeddings_response():
    api_key = os.environ.get("GEMINI_API_KEY")
    model = "text-embedding-004"
    base_url = "https://generativelanguage.googleapis.com"
    text = "Hello, world!"

    embedding_model = GoogleEmbeddings(api_key, model, base_url)
    response = None

    try:
        response = embedding_model.get_text_embedding(text)
    except httpx.HTTPStatusError as e:
        pytest.fail(f"Request failed with status code {e.response.status_code}")

    assert response is not None, "No response received from API"
    assert isinstance(response, list), "Response is not a list of embeddings"


def test_archival_insert_text_embedding_004(client: LettaSDKClient):
    """
    Test that an agent with model 'gemini-2.0-flash-exp' and embedding 'text_embedding_004'
    correctly inserts a message into its archival memory.

    The test works by:
      1. Creating an agent with the desired model and embedding.
      2. Sending a message prefixed with 'archive :' to instruct the agent to store the message in archival.
      3. Retrieving the archival memory via the agent messaging API.
      4. Verifying that the archival message is stored.
    """
    # Create an agent with the specified model and embedding.
    agent = client.agents.create(
        name="archival_insert_text_embedding_004",
        memory_blocks=[
            CreateBlock(label="human", value="name: archival_test"),
            CreateBlock(label="persona", value="You are a helpful assistant that loves helping out the user"),
        ],
        model="google_ai/gemini-2.0-flash-exp",
        embedding="google_ai/text-embedding-004",
    )

    # Define the archival message.
    archival_message = "Archival insertion test message"

    # Send a message instructing the agent to archive it.
    res = client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content=f"Store this in your archive memory: {archival_message}")],
    )
    print(res.messages)

    # Retrieve the archival messages through the agent messaging API.
    archived_messages = client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content=f"retrieve from archival memory : {archival_message}")],
    )

    print(archived_messages.messages)
    # Assert that the archival message is present.
    assert any(message.status == "success" for message in archived_messages.messages if message.message_type == "tool_return_message"), (
        f"Archival message '{archival_message}' not found. Archived messages: {archived_messages}"
    )

    # Cleanup: Delete the agent.
    client.agents.delete(agent.id)


def test_archival_insert_embedding_001(client: LettaSDKClient):
    """
    Test that an agent with model 'gemini-2.0-flash-exp' and embedding 'embedding_001'
    correctly inserts a message into its archival memory.

    The test works by:
      1. Creating an agent with the desired model and embedding.
      2. Sending a message prefixed with 'archive :' to instruct the agent to store the message in archival.
      3. Retrieving the archival memory via the agent messaging API.
      4. Verifying that the archival message is stored.
    """
    # Create an agent with the specified model and embedding.
    agent = client.agents.create(
        name="archival_insert_embedding_001",
        memory_blocks=[
            CreateBlock(label="human", value="name: archival_test"),
            CreateBlock(label="persona", value="You are a helpful assistant that loves helping out the user"),
        ],
        model="google_ai/gemini-2.0-flash-exp",
        embedding="google_ai/embedding-001",
    )

    # Define the archival message.
    archival_message = "Archival insertion test message"

    # Send a message instructing the agent to archive it.
    client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content=f"archive : {archival_message}")],
    )

    # Retrieve the archival messages through the agent messaging API.
    archived_messages = client.agents.messages.create(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content=f"retrieve from archival memory : {archival_message}")],
    )

    # Assert that the archival message is present.
    assert any(message.status == "success" for message in archived_messages.messages if message.message_type == "tool_return_message"), (
        f"Archival message '{archival_message}' not found. Archived messages: {archived_messages}"
    )

    # Cleanup: Delete the agent.
    client.agents.delete(agent.id)
