import os
import threading
import time
import uuid
from typing import Any, List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate

from letta.log import get_logger
from letta.schemas.agent import AgentState

logger = get_logger(__name__)

# ------------------------------
# Helper Functions and Constants
# ------------------------------


def requires_approval_tool(input_text: str) -> str:
    """
    A tool that requires approval before execution.
    Args:
        input_text (str): The input text to process.
    Returns:
        str: The processed text with 'APPROVED:' prefix.
    """
    return f"APPROVED: {input_text}"


USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_TEST_APPROVAL: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="This is an automated test message. Call the requires_approval_tool with the text 'test approval'.",
        otid=USER_MESSAGE_OTID,
    )
]

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 30
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    return url


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def approval_tool_fixture(client: Letta):
    """
    Creates and returns a tool that requires approval for testing.
    """
    client.tools.upsert_base_tools()
    approval_tool = client.tools.upsert_from_function(
        func=requires_approval_tool,
        # default_requires_approval=True,
    )
    yield approval_tool


@pytest.fixture(scope="function")
def agent(client: Letta, approval_tool_fixture) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is configured with the requires_approval_tool.
    """
    send_message_tool = client.tools.list(name="send_message")[0]
    agent_state = client.agents.create(
        name="approval_test_agent",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, approval_tool_fixture.id],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["approval_test"],
    )
    yield agent_state


# ------------------------------
# Test Cases
# ------------------------------


def test_send_message_with_approval_tool(
    disable_e2b_api_key: Any,
    client: Letta,
    agent: AgentState,
) -> None:
    """
    Tests sending a message to an agent with a tool that requires approval.
    This test just verifies that the agent can send a message successfully.
    The actual approval logic testing will be filled out by the user.
    """
    # Send a simple greeting message to test basic functionality
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    # Basic assertion that we got a response with an approval request
    assert response.messages is not None
    assert len(response.messages) == 2
    assert response.messages[0].message_type == "reasoning_message"
    assert response.messages[1].message_type == "approval_request_message"
