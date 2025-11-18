import os
import threading
import time
import uuid
from typing import List
from unittest.mock import patch

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AgentState, ApprovalCreate, Letta, LlmConfig, MessageCreate, Tool
from letta_client.core.api_error import ApiError

from letta.adapters.simple_llm_stream_adapter import SimpleLLMStreamAdapter
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.log import get_logger
from letta.schemas.enums import AgentType

logger = get_logger(__name__)

# ------------------------------
# Helper Functions and Constants
# ------------------------------

USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_CONTENT = "This is an automated test message. Call the get_secret_code_tool to get the code for text 'hello world'."
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
USER_MESSAGE_PARALLEL_TOOL_CALL_CONTENT = "This is an automated test message. Call the get_secret_code_tool 3 times in parallel for the following inputs: 'hello world', 'hello letta', 'hello test', and also call the roll_dice_tool once with a 16-sided dice."
USER_MESSAGE_PARALLEL_TOOL_CALL: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=USER_MESSAGE_PARALLEL_TOOL_CALL_CONTENT,
        otid=USER_MESSAGE_OTID,
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


def roll_dice_tool(num_sides: int) -> str:
    """
    A tool that returns a random number between 1 and num_sides.
    Args:
        num_sides (int): The number of sides on the die.
    Returns:
        str: The random number between 1 and num_sides.
    """
    import random

    return str(random.randint(1, num_sides))


def accumulate_chunks(stream):
    messages = []
    prev_message_type = None
    for chunk in stream:
        current_message_type = chunk.message_type
        if prev_message_type != current_message_type:
            messages.append(chunk)
        prev_message_type = current_message_type
    return messages


def approve_tool_call(client: Letta, agent_id: str, tool_call_id: str):
    client.agents.messages.create(
        agent_id=agent_id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            ),
        ],
    )


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
def dice_tool_fixture(client: Letta) -> Tool:
    client.tools.upsert_base_tools()
    dice_tool = client.tools.upsert_from_function(
        func=roll_dice_tool,
    )
    yield dice_tool

    client.tools.delete(tool_id=dice_tool.id)


@pytest.fixture(scope="function")
def agent(client: Letta, approval_tool_fixture, dice_tool_fixture) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is configured with the requires_approval_tool.
    """
    agent_state = client.agents.create(
        name="approval_test_agent",
        agent_type=AgentType.letta_v1_agent,
        include_base_tools=False,
        tool_ids=[approval_tool_fixture.id, dice_tool_fixture.id],
        include_base_tool_rules=False,
        tool_rules=[],
        # parallel_tool_calls=True,
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        tags=["approval_test"],
    )
    agent_state = client.agents.modify(
        agent_id=agent_state.id, llm_config=dict(agent_state.llm_config.model_dump(), **{"parallel_tool_calls": True})
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
            messages=[
                ApprovalCreate(
                    approve=True,  # legacy
                    approval_request_id=FAKE_REQUEST_ID,  # legacy
                    approvals=[
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": FAKE_REQUEST_ID,
                        },
                    ],
                ),
            ],
        )


def test_send_user_message_with_pending_request(client, agent):
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    with pytest.raises(ApiError, match="Please approve or deny the pending request before continuing"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[MessageCreate(role="user", content="hi")],
        )

    approve_tool_call(client, agent.id, response.messages[2].tool_call.tool_call_id)


def test_send_approval_message_with_incorrect_request_id(client, agent):
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    with pytest.raises(ApiError, match="Invalid tool call IDs"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=True,  # legacy
                    approval_request_id=FAKE_REQUEST_ID,  # legacy
                    approvals=[
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": FAKE_REQUEST_ID,
                        },
                    ],
                ),
            ],
        )

    approve_tool_call(client, agent.id, response.messages[2].tool_call.tool_call_id)


# ------------------------------
# Request Test Cases
# ------------------------------


def test_invoke_approval_request(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    messages = response.messages

    assert messages is not None
    assert len(messages) == 3
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "approval_request_message"
    assert messages[2].tool_call is not None
    assert messages[2].tool_call.name == "get_secret_code_tool"
    assert messages[2].tool_calls is not None
    assert len(messages[2].tool_calls) == 1
    assert messages[2].tool_calls[0]["name"] == "get_secret_code_tool"

    # v3/v1 path: approval request tool args must not include request_heartbeat
    import json as _json

    _args = _json.loads(messages[2].tool_call.arguments)
    assert "request_heartbeat" not in _args

    client.agents.context.retrieve(agent_id=agent.id)

    approve_tool_call(client, agent.id, response.messages[2].tool_call.tool_call_id)


def test_invoke_approval_request_stream(
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
    assert len(messages) == 5
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "approval_request_message"
    assert messages[2].tool_call is not None
    assert messages[2].tool_call.name == "get_secret_code_tool"
    assert messages[3].message_type == "stop_reason"
    assert messages[4].message_type == "usage_statistics"

    client.agents.context.retrieve(agent_id=agent.id)

    approve_tool_call(client, agent.id, messages[2].tool_call.tool_call_id)


def test_invoke_tool_after_turning_off_requires_approval(
    client: Letta,
    agent: AgentState,
    approval_tool_fixture: Tool,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
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
    assert 6 <= len(messages) <= 9
    idx = 0

    assert messages[idx].message_type == "reasoning_message"
    idx += 1

    try:
        assert messages[idx].message_type == "assistant_message"
        idx += 1
    except:
        pass

    assert messages[idx].message_type == "tool_call_message"
    idx += 1
    assert messages[idx].message_type == "tool_return_message"
    idx += 1

    assert messages[idx].message_type == "reasoning_message"
    idx += 1
    try:
        assert messages[idx].message_type == "assistant_message"
        idx += 1
    except:
        assert messages[idx].message_type == "tool_call_message"
        idx += 1
        assert messages[idx].message_type == "tool_return_message"
        idx += 1


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
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            ),
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 3 or len(messages) == 5 or len(messages) == 6
    assert messages[0].message_type == "tool_return_message"
    assert messages[0].tool_call_id == tool_call_id
    assert messages[0].status == "success"
    if len(messages) == 4:
        assert messages[1].message_type == "stop_reason"
        assert messages[2].message_type == "usage_statistics"
    elif len(messages) == 5:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "assistant_message"
        assert messages[3].message_type == "stop_reason"
        assert messages[4].message_type == "usage_statistics"
    elif len(messages) == 6:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "tool_call_message"
        assert messages[3].message_type == "tool_return_message"
        assert messages[4].message_type == "stop_reason"
        assert messages[5].message_type == "usage_statistics"


def test_approve_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[2].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 4
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert messages[3].message_type == "approval_request_message"
    # Ensure no request_heartbeat on approval request
    import json as _json

    _args = _json.loads(messages[3].tool_call.arguments)
    assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            ),
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id)
    assert len(messages) == 2 or len(messages) == 4
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approval_request_id == tool_call_id
    assert messages[0].approve is True
    assert messages[0].approvals[0]["approve"] is True
    assert messages[0].approvals[0]["tool_call_id"] == tool_call_id
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "success"
    if len(messages) == 4:
        assert messages[2].message_type == "reasoning_message"
        assert messages[3].message_type == "assistant_message"


def test_approve_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            ),
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.agents.context.retrieve(agent_id=agent.id)
    except Exception as e:
        if len(messages) > 4:
            raise ValueError("Model did not respond with only reasoning content, please rerun test to repro edge case.")
        raise e


def test_approve_and_follow_up(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
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
    assert len(messages) == 4 or len(messages) == 5
    if len(messages) == 4:
        assert messages[0].message_type == "reasoning_message"
        assert messages[1].message_type == "assistant_message"
        assert messages[2].message_type == "stop_reason"
        assert messages[3].message_type == "usage_statistics"
    elif len(messages) == 5:
        assert messages[0].message_type == "reasoning_message"
        assert messages[1].message_type == "tool_call_message"
        assert messages[2].message_type == "tool_return_message"
        assert messages[3].message_type == "stop_reason"
        assert messages[4].message_type == "usage_statistics"


def test_approve_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                    approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                    approvals=[
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": tool_call_id,
                        },
                    ],
                ),
            ],
            stream_tokens=True,
        )

        messages = accumulate_chunks(response)

    assert messages is not None
    stop_reason_message = [m for m in messages if m.message_type == "stop_reason"][0]
    assert stop_reason_message
    assert stop_reason_message.stop_reason == "invalid_llm_response"

    # Ensure that agent is not bricked
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 4 or len(messages) == 5
    assert messages[0].message_type == "reasoning_message"
    if len(messages) == 4:
        assert messages[1].message_type == "assistant_message"
    else:
        assert messages[1].message_type == "tool_call_message"
        assert messages[2].message_type == "tool_return_message"


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
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
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
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[2].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 4
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert messages[3].message_type == "approval_request_message"
    assert messages[3].tool_call.tool_call_id == tool_call_id
    # Ensure no request_heartbeat on approval request
    # import json as _json

    # _args = _json.loads(messages[2].tool_call.arguments)
    # assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
            ),
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id)
    assert len(messages) == 4
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approvals[0]["approve"] == False
    assert messages[0].approvals[0]["tool_call_id"] == tool_call_id
    assert messages[0].approvals[0]["reason"] == f"You don't need to call the tool, the secret code is {SECRET_CODE}"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "error"
    assert messages[2].message_type == "reasoning_message"
    assert messages[3].message_type == "assistant_message"


def test_deny_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason="Cancelled by user. Instead of responding, wait for next user input before replying.",  # legacy
                approvals=[
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": "Cancelled by user. Instead of responding, wait for next user input before replying.",
                    },
                ],
            ),
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.agents.context.retrieve(agent_id=agent.id)
    except Exception as e:
        if len(messages) > 4:
            raise ValueError("Model did not respond with only reasoning content, please rerun test to repro edge case.")
        raise e


def test_deny_and_follow_up(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
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
    tool_call_id = response.messages[2].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                    approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                    reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                    approvals=[
                        {
                            "type": "approval",
                            "approve": False,
                            "tool_call_id": tool_call_id,
                            "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                        },
                    ],
                ),
            ],
            stream_tokens=True,
        )

        messages = accumulate_chunks(response)

    assert messages is not None
    stop_reason_message = [m for m in messages if m.message_type == "stop_reason"][0]
    assert stop_reason_message
    assert stop_reason_message.stop_reason == "invalid_llm_response"

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


# --------------------------------
# Client-Side Execution Test Cases
# --------------------------------


def test_client_side_tool_call_request(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            ),
        ],
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) == 5
    assert messages[0].message_type == "tool_return_message"
    assert messages[0].tool_call_id == tool_call_id
    assert messages[0].status == "success"
    assert messages[0].tool_return == SECRET_CODE
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert SECRET_CODE in messages[2].content
    assert messages[3].message_type == "stop_reason"
    assert messages[4].message_type == "usage_statistics"


def test_client_side_tool_call_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[2].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) == 4
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert messages[3].message_type == "approval_request_message"
    assert messages[3].tool_call.tool_call_id == tool_call_id
    # Ensure no request_heartbeat on approval request
    # import json as _json

    # _args = _json.loads(messages[2].tool_call.arguments)
    # assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            ),
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id)
    assert len(messages) == 4
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approvals[0]["type"] == "tool"
    assert messages[0].approvals[0]["tool_call_id"] == tool_call_id
    assert messages[0].approvals[0]["tool_return"] == SECRET_CODE
    assert messages[0].approvals[0]["status"] == "success"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "success"
    assert messages[1].tool_call_id == tool_call_id
    assert messages[1].tool_return == SECRET_CODE
    assert messages[2].message_type == "reasoning_message"
    assert messages[3].message_type == "assistant_message"


def test_client_side_tool_call_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason="Cancelled by user. Instead of responding, wait for next user input before replying.",  # legacy
                approvals=[
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            ),
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.agents.context.retrieve(agent_id=agent.id)
    except Exception as e:
        if len(messages) > 4:
            raise ValueError("Model did not respond with only reasoning content, please rerun test to repro edge case.")
        raise e


def test_client_side_tool_call_and_follow_up(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                approvals=[
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
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


def test_client_side_tool_call_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[2].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                ApprovalCreate(
                    approve=True,  # legacy (passing incorrect value to ensure it is overridden)
                    approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                    reason=f"You don't need to call the tool, the secret code is {SECRET_CODE}",  # legacy
                    approvals=[
                        {
                            "type": "tool",
                            "tool_call_id": tool_call_id,
                            "tool_return": SECRET_CODE,
                            "status": "success",
                        },
                    ],
                ),
            ],
            stream_tokens=True,
        )

        messages = accumulate_chunks(response)

    assert messages is not None
    stop_reason_message = [m for m in messages if m.message_type == "stop_reason"][0]
    assert stop_reason_message
    assert stop_reason_message.stop_reason == "invalid_llm_response"

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


def test_parallel_tool_calling(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_PARALLEL_TOOL_CALL,
    )

    messages = response.messages

    assert messages is not None
    assert len(messages) == 4
    assert messages[0].message_type == "reasoning_message"
    assert messages[1].message_type == "assistant_message"
    assert messages[2].message_type == "tool_call_message"
    assert len(messages[2].tool_calls) == 1
    assert messages[2].tool_calls[0]["name"] == "roll_dice_tool"
    assert "6" in messages[2].tool_calls[0]["arguments"]
    dice_tool_call_id = messages[2].tool_calls[0]["tool_call_id"]

    assert messages[3].message_type == "approval_request_message"
    assert messages[3].tool_call is not None
    assert messages[3].tool_call.name == "get_secret_code_tool"

    assert len(messages[3].tool_calls) == 3
    assert messages[3].tool_calls[0]["name"] == "get_secret_code_tool"
    assert "hello world" in messages[3].tool_calls[0]["arguments"]
    approve_tool_call_id = messages[3].tool_calls[0]["tool_call_id"]
    assert messages[3].tool_calls[1]["name"] == "get_secret_code_tool"
    assert "hello letta" in messages[3].tool_calls[1]["arguments"]
    deny_tool_call_id = messages[3].tool_calls[1]["tool_call_id"]
    assert messages[3].tool_calls[2]["name"] == "get_secret_code_tool"
    assert "hello test" in messages[3].tool_calls[2]["arguments"]
    client_side_tool_call_id = messages[3].tool_calls[2]["tool_call_id"]

    # ensure context is not bricked
    client.agents.context.retrieve(agent_id=agent.id)

    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            ApprovalCreate(
                approve=False,  # legacy (passing incorrect value to ensure it is overridden)
                approval_request_id=FAKE_REQUEST_ID,  # legacy (passing incorrect value to ensure it is overridden)
                approvals=[
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": approve_tool_call_id,
                    },
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": deny_tool_call_id,
                    },
                    {
                        "type": "tool",
                        "tool_call_id": client_side_tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            ),
        ],
    )

    messages = response.messages

    assert messages is not None
    assert len(messages) == 1 or len(messages) == 3 or len(messages) == 4
    assert messages[0].message_type == "tool_return_message"
    assert len(messages[0].tool_returns) == 4
    for tool_return in messages[0].tool_returns:
        if tool_return["tool_call_id"] == approve_tool_call_id:
            assert tool_return["status"] == "success"
        elif tool_return["tool_call_id"] == deny_tool_call_id:
            assert tool_return["status"] == "error"
        elif tool_return["tool_call_id"] == client_side_tool_call_id:
            assert tool_return["status"] == "success"
            assert tool_return["tool_return"] == SECRET_CODE
        else:
            assert tool_return["tool_call_id"] == dice_tool_call_id
            assert tool_return["status"] == "success"
    if len(messages) == 3:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "assistant_message"
    elif len(messages) == 4:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "tool_call_message"
        assert messages[3].message_type == "tool_return_message"

    # ensure context is not bricked
    client.agents.context.retrieve(agent_id=agent.id)

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor)
    assert len(messages) > 6
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert messages[3].message_type == "tool_call_message"
    assert messages[4].message_type == "approval_request_message"
    assert messages[5].message_type == "approval_response_message"
    assert messages[6].message_type == "tool_return_message"

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


def test_agent_records_last_stop_reason_after_approval_flow(
    client: Letta,
    agent: AgentState,
) -> None:
    """
    Test that the agent's last_stop_reason is properly updated after a human-in-the-loop flow.
    This verifies the integration between run completion and agent state updates.
    """
    # Get initial agent state
    initial_agent = client.agents.retrieve(agent_id=agent.id)
    initial_stop_reason = initial_agent.last_stop_reason

    # Trigger approval request
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    # Verify we got an approval request
    messages = response.messages
    assert messages is not None
    assert len(messages) == 3
    assert messages[2].message_type == "approval_request_message"

    # Check agent after approval request (run should be paused with requires_approval)
    agent_after_request = client.agents.retrieve(agent_id=agent.id)
    assert agent_after_request.last_stop_reason == "requires_approval"

    # Approve the tool call
    approve_tool_call(client, agent.id, response.messages[2].tool_call.tool_call_id)

    # Check agent after approval (run should complete with end_turn or similar)
    agent_after_approval = client.agents.retrieve(agent_id=agent.id)
    # After approval and run completion, stop reason should be updated (could be end_turn or other terminal reason)
    assert agent_after_approval.last_stop_reason is not None
    assert agent_after_approval.last_stop_reason != initial_stop_reason  # Should be different from initial

    # Send follow-up message to complete the flow
    response2 = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    # Verify final agent state has the most recent stop reason
    final_agent = client.agents.retrieve(agent_id=agent.id)
    assert final_agent.last_stop_reason is not None
