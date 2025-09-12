import os
import threading
import time
import uuid
from typing import List
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AgentState, ApprovalCreate, Letta, MessageCreate, Tool
from letta_client.core.api_error import ApiError

from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.log import get_logger

logger = get_logger(__name__)

# ------------------------------
# Helper Functions and Constants
# ------------------------------

USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_CONTENT = "This is an automated test message. Call the get_secret_code_tool to get the code for text 'hello world'. Make sure to set request_heartbeat to True."
USER_MESSAGE_TEST_APPROVAL: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=USER_MESSAGE_CONTENT,
        otid=USER_MESSAGE_OTID,
    )
]
FAKE_REQUEST_ID = str(uuid.uuid4())
SECRET_CODE = str(740845635798344975)
USER_MESSAGE_FOLLOW_UP_OTID = str(uuid.uuid4())
USER_MESSAGE_FOLLOW_UP_CONTENT = "Thank you for the secret code."
USER_MESSAGE_FOLLOW_UP: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=USER_MESSAGE_FOLLOW_UP_CONTENT,
        otid=USER_MESSAGE_FOLLOW_UP_OTID,
    )
]


def get_secret_code_tool(input_text: str) -> str:
    """
    A tool that returns the secret code based on the input. This tool requires approval before execution.
    Args:
        input_text (str): The input text to process.
    Returns:
        str: The secret code based on the input text.
    """
    return str(abs(hash(input_text)))


def accumulate_chunks(stream):
    messages = []
    prev_message_type = None
    for chunk in stream:
        current_message_type = chunk.message_type
        if prev_message_type != current_message_type:
            messages.append(chunk)
        prev_message_type = current_message_type
    return messages


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
def approval_tool_fixture(client: Letta) -> Tool:
    """
    Creates and returns a tool that requires approval for testing.
    """
    client.tools.upsert_base_tools()
    approval_tool = client.tools.upsert_from_function(
        func=get_secret_code_tool,
        default_requires_approval=True,
    )
    yield approval_tool

    client.tools.delete(tool_id=approval_tool.id)


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
        model="anthropic/claude-3-5-sonnet",
        embedding="openai/text-embedding-3-small",
        tags=["approval_test"],
    )
    yield agent_state

    client.agents.delete(agent_id=agent_state.id)


# ------------------------------
# Error Test Cases
# ------------------------------


def test_send_approval_without_pending_request(client, agent):
    with pytest.raises(ApiError, match="No tool call is currently awaiting approval"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[ApprovalCreate(approve=True, approval_request_id=FAKE_REQUEST_ID)],
        )


def test_send_user_message_with_pending_request(client, agent):
    client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    with pytest.raises(ApiError, match="Please approve or deny the pending request before continuing"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreate(role="user", content="hi")],
        )


def test_send_approval_message_with_incorrect_request_id(client, agent):
    client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    with pytest.raises(ApiError, match="Invalid approval request ID"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[ApprovalCreate(approve=True, approval_request_id=FAKE_REQUEST_ID)],
        )


# ------------------------------
# Request Test Cases
# ------------------------------


def test_send_message_with_requires_approval_tool(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "approval_request_message"
    assert messages[2].message_type == "stop_reason"
    assert messages[2].stop_reason == "requires_approval"
    assert messages[3].message_type == "usage_statistics"


def test_send_message_after_turning_off_requires_approval(
    client: Letta,
    agent: AgentState,
    approval_tool_fixture: Tool,
) -> None:
    response = client.agents.messages.create_stream(agent_id=agent.id, messages=USER_MESSAGE_TEST_APPROVAL, stream_tokens=True)
    messages = accumulate_chunks(response)
    approval_request_id = messages[0].id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,
                approval_request_id=approval_request_id,
            ),
        ],
        stream_tokens=True,
    )
    messages = accumulate_chunks(response)

    client.agents.tools.modify_approval(
        agent_id=agent.id,
        tool_name=approval_tool_fixture.name,
        requires_approval=False,
    )

    response = client.agents.messages.create_stream(agent_id=agent.id, messages=USER_MESSAGE_TEST_APPROVAL, stream_tokens=True)

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 5 or len(messages) == 7
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "tool_call_message"
    assert messages[2].message_type == "tool_return_message"
    if len(messages) > 5:
        assert messages[3].message_type == "reasoning_message"
        assert messages[4].message_type == "assistant_message"


# ------------------------------
# Approve Test Cases
# ------------------------------


def test_approve_tool_call_request(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id
    tool_call_id = response.messages[1].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,
                approval_request_id=approval_request_id,
            ),
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 3 or len(messages) == 5
    assert messages[0].message_type == "tool_return_message"
    assert messages[0].tool_call_id == tool_call_id
    assert messages[0].status == "success"
    if len(messages) == 3:
        assert messages[1].message_type == "stop_reason"
        assert messages[2].message_type == "usage_statistics"
    else:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "assistant_message"
        assert messages[3].message_type == "stop_reason"
        assert messages[4].message_type == "usage_statistics"


def test_approve_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 3
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "approval_request_message"
    assert messages[2].id == approval_request_id

    last_message_cursor = approval_request_id
    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,
                approval_request_id=approval_request_id,
            ),
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 2 or len(messages) == 5
    assert messages[0].message_type == "approval_response_message"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "success"
    if len(messages) == 5:
        assert messages[2].message_type == "user_message"  # heartbeat
        assert messages[3].message_type == "reasoning_message"
        assert messages[4].message_type == "assistant_message"


def test_approve_and_follow_up(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,
                approval_request_id=approval_request_id,
            ),
        ],
    )

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "stop_reason"
    assert messages[3].message_type == "usage_statistics"


def test_approve_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    # Mock the streaming interface to return no tool call on the follow up request heartbeat message
    with patch.object(AnthropicStreamingInterface, "get_tool_call_object", return_value=None):
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=True,
                    approval_request_id=approval_request_id,
                ),
            ],
            stream_tokens=True,
        )

        messages = accumulate_chunks(response)

    assert messages is not None
    stop_reason_message = [m for m in messages if m.message_type == "stop_reason"][0]
    assert stop_reason_message
    assert stop_reason_message.stop_reason == "no_tool_call"

    # Ensure that agent is not bricked
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "stop_reason"
    assert messages[3].message_type == "usage_statistics"


# ------------------------------
# Deny Test Cases
# ------------------------------


def test_deny_tool_call_request(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id
    tool_call_id = response.messages[1].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,
                approval_request_id=approval_request_id,
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",
            ),
        ],
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 5
    assert messages[0].message_type == "tool_return_message"
    assert messages[0].tool_call_id == tool_call_id
    assert messages[0].status == "error"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert SECRET_CODE in messages[2].content
    assert messages[3].message_type == "stop_reason"
    assert messages[4].message_type == "usage_statistics"


def test_deny_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 3
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "approval_request_message"
    assert messages[2].id == approval_request_id

    last_message_cursor = approval_request_id
    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,
                approval_request_id=approval_request_id,
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",
            ),
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 5
    assert messages[0].message_type == "approval_response_message"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "error"
    assert messages[2].message_type == "user_message"  # heartbeat
    assert messages[3].message_type == "reasoning_message"
    assert messages[4].message_type == "assistant_message"


def test_deny_and_follow_up(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,
                approval_request_id=approval_request_id,
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",
            ),
        ],
    )

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "stop_reason"
    assert messages[3].message_type == "usage_statistics"


def test_deny_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    approval_request_id = response.messages[0].id

    # Mock the streaming interface to return no tool call on the follow up request heartbeat message
    with patch.object(AnthropicStreamingInterface, "get_tool_call_object", return_value=None):
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=False,
                    approval_request_id=approval_request_id,
                    reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                ),
            ],
            stream_tokens=True,
        )

        messages = accumulate_chunks(response)

    assert messages is not None
    stop_reason_message = [m for m in messages if m.message_type == "stop_reason"][0]
    assert stop_reason_message
    assert stop_reason_message.stop_reason == "no_tool_call"

    # Ensure that agent is not bricked
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "stop_reason"
    assert messages[3].message_type == "usage_statistics"
