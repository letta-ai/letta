import os
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(
    scope="module",
)
def client(request):
    # Get URL from environment or start server
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)
    print("Running client tests with server:", server_url)

    # create the Letta client
    yield Letta(base_url=server_url, token=None)


def test_initial_sequence(client: Letta):
    # create an agent
    agent = client.agents.create(
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
        initial_message_sequence=[
            MessageCreate(
                role="assistant",
                content="Hello, how are you?",
            ),
            MessageCreate(role="user", content="I'm good, and you?"),
        ],
    )

    # list messages
    messages = client.agents.messages.list(agent_id=agent.id)
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            MessageCreate(
                role="user",
                content="hello assistant!",
            )
        ],
    )
    assert len(messages) == 3
    assert messages[0].message_type == "system_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "user_message"
