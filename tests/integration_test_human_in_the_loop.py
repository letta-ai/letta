import logging
import uuid
from typing import Any, List
from unittest.mock import patch

import pytest
from letta_client import APIError, Letta
from letta_client.types import AgentState, MessageCreateParam, Tool
from letta_client.types.agents import ApprovalCreateParam

from letta.adapters.simple_llm_stream_adapter import SimpleLLMStreamAdapter

logger = logging.getLogger(__name__)

# ------------------------------
# Helper Functions and Constants
# ------------------------------

USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_CONTENT = "This is an automated test message. Call the get_secret_code_tool to get the code for text 'hello world'."
USER_MESSAGE_TEST_APPROVAL: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=USER_MESSAGE_CONTENT,
        otid=USER_MESSAGE_OTID,
    )
]
FAKE_REQUEST_ID = str(uuid.uuid4())
SECRET_CODE = str(740845635798344975)
USER_MESSAGE_FOLLOW_UP_OTID = str(uuid.uuid4())
USER_MESSAGE_FOLLOW_UP_CONTENT = "Thank you for the secret code."
USER_MESSAGE_FOLLOW_UP: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=USER_MESSAGE_FOLLOW_UP_CONTENT,
        otid=USER_MESSAGE_FOLLOW_UP_OTID,
    )
]
USER_MESSAGE_PARALLEL_TOOL_CALL_CONTENT = "This is an automated test message. Call the get_secret_code_tool 3 times in parallel for the following inputs: 'hello world', 'hello letta', 'hello test', and also call the roll_dice_tool once with a 16-sided dice."
USER_MESSAGE_PARALLEL_TOOL_CALL: List[MessageCreateParam] = [
    MessageCreateParam(
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
    current_message = None
    prev_message_type = None

    for chunk in stream:
        # Handle chunks that might not have message_type (like pings)
        if not hasattr(chunk, "message_type"):
            continue

        current_message_type = getattr(chunk, "message_type", None)

        if prev_message_type != current_message_type:
            # Save the previous message if it exists
            if current_message is not None:
                messages.append(current_message)
            # Start a new message
            current_message = chunk
        else:
            # Accumulate content for same message type (token streaming)
            if current_message is not None and hasattr(current_message, "content") and hasattr(chunk, "content"):
                current_message.content += chunk.content

        prev_message_type = current_message_type

    # Don't forget the last message
    if current_message is not None:
        messages.append(current_message)

    return [m for m in messages if m is not None]


def approve_tool_call(client: Letta, agent_id: str, tool_call_id: str):
    client.agents.messages.create(
        agent_id=agent_id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
    )


# ------------------------------
# Fixtures
# ------------------------------
# Note: server_url and client fixtures are inherited from tests/conftest.py


@pytest.fixture(scope="function")
def approval_tool_fixture(client: Letta):
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
def dice_tool_fixture(client: Letta):
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
        agent_type="letta_v1_agent",
        include_base_tools=False,
        tool_ids=[approval_tool_fixture.id, dice_tool_fixture.id],
        include_base_tool_rules=False,
        tool_rules=[],
        model="anthropic/claude-sonnet-4-5-20250929",
        embedding="openai/text-embedding-3-small",
        tags=["approval_test"],
    )
    # Enable parallel tool calls for testing
    agent_state = client.agents.update(agent_id=agent_state.id, parallel_tool_calls=True)
    yield agent_state

    client.agents.delete(agent_id=agent_state.id)


# ------------------------------
# Error Test Cases
# ------------------------------


def test_send_approval_without_pending_request(client, agent):
    with pytest.raises(APIError, match="No tool call is currently awaiting approval"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                {
                    "type": "approval",
                    "approvals": [
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": FAKE_REQUEST_ID,
                        },
                    ],
                },
            ],
        )


def test_send_user_message_with_pending_request(client, agent):
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    print("RESPONSE", response)
    for message in response.messages:
        print("MESSAGE", message)

    with pytest.raises(APIError, match="Please approve or deny the pending request before continuing"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[{"role": "user", "content": "hi"}],
        )

    approve_tool_call(client, agent.id, response.messages[-1].tool_call.tool_call_id)


def test_send_approval_message_with_incorrect_request_id(client, agent):
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )

    with pytest.raises(APIError, match="Invalid tool call IDs"):
        client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                {
                    "type": "approval",
                    "approvals": [
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": FAKE_REQUEST_ID,
                        },
                    ],
                },
            ],
        )

    approve_tool_call(client, agent.id, response.messages[-1].tool_call.tool_call_id)


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
    assert messages[-1].message_type == "approval_request_message"
    assert messages[-1].tool_call is not None
    assert messages[-1].tool_call.name == "get_secret_code_tool"
    assert messages[-1].tool_calls is not None
    assert len(messages[-1].tool_calls) == 1
    assert messages[-1].tool_calls[0].name == "get_secret_code_tool"

    # v3/v1 path: approval request tool args must not include request_heartbeat
    import json as _json

    _args = _json.loads(messages[-1].tool_call.arguments)
    assert "request_heartbeat" not in _args

    client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])

    approve_tool_call(client, agent.id, response.messages[-1].tool_call.tool_call_id)


def test_invoke_approval_request_stream(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert messages[-3].message_type == "approval_request_message"
    assert messages[-3].tool_call is not None
    assert messages[-3].tool_call.name == "get_secret_code_tool"
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"

    client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])

    approve_tool_call(client, agent.id, messages[-3].tool_call.tool_call_id)


def test_invoke_tool_after_turning_off_requires_approval(
    client: Letta,
    agent: AgentState,
    approval_tool_fixture: Tool,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
        stream_tokens=True,
    )
    messages = accumulate_chunks(response)

    client.agents.tools.update_approval(
        agent_id=agent.id,
        tool_name=approval_tool_fixture.name,
        body_requires_approval=False,
    )

    response = client.agents.messages.stream(agent_id=agent.id, messages=USER_MESSAGE_TEST_APPROVAL, stream_tokens=True)

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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert messages[0].message_type == "tool_return_message"
    assert messages[0].tool_call_id == tool_call_id
    assert messages[0].status == "success"
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_approve_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1).items[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor).items
    assert messages[0].message_type == "user_message"
    assert messages[-1].message_type == "approval_request_message"
    # Ensure no request_heartbeat on approval request
    import json as _json

    _args = _json.loads(messages[-1].tool_call.arguments)
    assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id).items
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approval_request_id == tool_call_id
    assert messages[0].approve is True
    assert messages[0].approvals[0].approve is True
    assert messages[0].approvals[0].tool_call_id == tool_call_id
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "success"


def test_approve_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])
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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert messages[0].message_type in ["reasoning_message", "assistant_message", "tool_call_message"]
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_approve_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.stream(
            agent_id=agent.id,
            messages=[
                {
                    "type": "approval",
                    "approvals": [
                        {
                            "type": "approval",
                            "approve": True,
                            "tool_call_id": tool_call_id,
                        },
                    ],
                },
            ],
            stream_tokens=True,
        )

        with pytest.raises(APIError, match="TEST: Mocked error"):
            messages = accumulate_chunks(response)

    # Ensure that agent is not bricked
    response = client.agents.messages.stream(
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


def test_approve_with_user_message(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": True,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
            {
                "type": "message",
                "role": "user",
                "content": "The secret code should not contain any special characters.",
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert messages[0].message_type in ["reasoning_message", "assistant_message", "tool_call_message"]
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
            },
        ],
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    if messages[0].message_type == "assistant_message":
        assert SECRET_CODE in messages[0].content
    elif messages[1].message_type == "assistant_message":
        assert SECRET_CODE in messages[1].content


def test_deny_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1).items[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor).items
    assert messages[0].message_type == "user_message"
    assert messages[-1].message_type == "approval_request_message"
    assert messages[-1].tool_call.tool_call_id == tool_call_id
    # Ensure no request_heartbeat on approval request
    # import json as _json

    # _args = _json.loads(messages[2].tool_call.arguments)
    # assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
            },
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id).items
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approvals[0].approve == False
    assert messages[0].approvals[0].tool_call_id == tool_call_id
    assert messages[0].approvals[0].reason == f"You don't need to call the tool, the secret code is {SECRET_CODE}"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "error"


def test_deny_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": "Cancelled by user. Instead of responding, wait for next user input before replying.",
                    },
                ],
            },
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])
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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                        "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                    },
                ],
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_deny_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.stream(
            agent_id=agent.id,
            messages=[
                {
                    "type": "approval",
                    "approvals": [
                        {
                            "type": "approval",
                            "approve": False,
                            "tool_call_id": tool_call_id,
                            "reason": f"You don't need to call the tool, the secret code is {SECRET_CODE}",
                        },
                    ],
                },
            ],
            stream_tokens=True,
        )

        with pytest.raises(APIError, match="TEST: Mocked error"):
            messages = accumulate_chunks(response)

    # Ensure that agent is not bricked
    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_deny_with_user_message(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "approval",
                        "approve": False,
                        "tool_call_id": tool_call_id,
                    },
                ],
            },
            {
                "type": "message",
                "role": "user",
                "content": f"Actually, you don't need to call the tool, the secret code is {SECRET_CODE}",
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            },
        ],
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    if messages[0].message_type == "assistant_message":
        assert SECRET_CODE in messages[1].content
    elif messages[1].message_type == "assistant_message":
        assert SECRET_CODE in messages[2].content
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_client_side_tool_call_cursor_fetch(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1).items[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    last_message_id = response.messages[0].id
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor).items
    assert messages[0].message_type == "user_message"
    assert messages[-1].message_type == "approval_request_message"
    assert messages[-1].tool_call.tool_call_id == tool_call_id
    # Ensure no request_heartbeat on approval request
    # import json as _json

    # _args = _json.loads(messages[2].tool_call.arguments)
    # assert "request_heartbeat" not in _args

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            },
        ],
    )

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id).items
    assert messages[0].message_type == "approval_response_message"
    assert messages[0].approvals[0].type == "tool"
    assert messages[0].approvals[0].tool_call_id == tool_call_id
    assert messages[0].approvals[0].tool_return == SECRET_CODE
    assert messages[0].approvals[0].status == "success"
    assert messages[1].message_type == "tool_return_message"
    assert messages[1].status == "success"
    assert messages[1].tool_call_id == tool_call_id
    assert messages[1].tool_return == SECRET_CODE


def test_client_side_tool_call_with_context_check(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            },
        ],
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    try:
        client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])
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
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_client_side_tool_call_and_follow_up_with_error(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    # Mock the streaming adapter to return llm invocation failure on the follow up turn
    with patch.object(SimpleLLMStreamAdapter, "invoke_llm", side_effect=ValueError("TEST: Mocked error")):
        response = client.agents.messages.stream(
            agent_id=agent.id,
            messages=[
                {
                    "type": "approval",
                    "approvals": [
                        {
                            "type": "tool",
                            "tool_call_id": tool_call_id,
                            "tool_return": SECRET_CODE,
                            "status": "success",
                        },
                    ],
                },
            ],
            stream_tokens=True,
        )

        with pytest.raises(APIError, match="TEST: Mocked error"):
            messages = accumulate_chunks(response)

    # Ensure that agent is not bricked
    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_client_side_tool_call_with_user_message(
    client: Letta,
    agent: AgentState,
) -> None:
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_TEST_APPROVAL,
    )
    tool_call_id = response.messages[-1].tool_call.tool_call_id

    client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
                    {
                        "type": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_return": SECRET_CODE,
                        "status": "success",
                    },
                ],
            },
            {
                "type": "message",
                "role": "user",
                "content": "The secret code should not contain any special characters.",
            },
        ],
    )

    response = client.agents.messages.stream(
        agent_id=agent.id,
        messages=USER_MESSAGE_FOLLOW_UP,
        stream_tokens=True,
    )

    messages = accumulate_chunks(response)

    assert messages is not None
    assert len(messages) > 2
    assert messages[-2].message_type == "stop_reason"
    assert messages[-1].message_type == "usage_statistics"


def test_parallel_tool_calling(
    client: Letta,
    agent: AgentState,
) -> None:
    last_message_cursor = client.agents.messages.list(agent_id=agent.id, limit=1).items[0].id
    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=USER_MESSAGE_PARALLEL_TOOL_CALL,
    )

    messages = response.messages

    assert messages is not None
    assert messages[-2].message_type == "tool_call_message"
    assert len(messages[-2].tool_calls) == 1
    assert messages[-2].tool_calls[0].name == "roll_dice_tool"
    assert "6" in messages[-2].tool_calls[0].arguments
    dice_tool_call_id = messages[-2].tool_calls[0].tool_call_id

    assert messages[-1].message_type == "approval_request_message"
    assert messages[-1].tool_call is not None
    assert messages[-1].tool_call.name == "get_secret_code_tool"

    assert len(messages[-1].tool_calls) == 3
    assert messages[-1].tool_calls[0].name == "get_secret_code_tool"
    assert "hello world" in messages[-1].tool_calls[0].arguments
    approve_tool_call_id = messages[-1].tool_calls[0].tool_call_id
    assert messages[-1].tool_calls[1].name == "get_secret_code_tool"
    assert "hello letta" in messages[-1].tool_calls[1].arguments
    deny_tool_call_id = messages[-1].tool_calls[1].tool_call_id
    assert messages[-1].tool_calls[2].name == "get_secret_code_tool"
    assert "hello test" in messages[-1].tool_calls[2].arguments
    client_side_tool_call_id = messages[-1].tool_calls[2].tool_call_id

    # ensure context is not bricked
    client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])

    response = client.agents.messages.create(
        agent_id=agent.id,
        messages=[
            {
                "type": "approval",
                "approvals": [
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
            },
        ],
    )

    messages = response.messages

    assert messages is not None
    assert len(messages) == 1 or len(messages) == 3 or len(messages) == 4
    assert messages[0].message_type == "tool_return_message"
    assert len(messages[0].tool_returns) == 4
    for tool_return in messages[0].tool_returns:
        if tool_return.tool_call_id == approve_tool_call_id:
            assert tool_return.status == "success"
        elif tool_return.tool_call_id == deny_tool_call_id:
            assert tool_return.status == "error"
        elif tool_return.tool_call_id == client_side_tool_call_id:
            assert tool_return.status == "success"
            assert tool_return.tool_return == SECRET_CODE
        else:
            assert tool_return.tool_call_id == dice_tool_call_id
            assert tool_return.status == "success"
    if len(messages) == 3:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "assistant_message"
    elif len(messages) == 4:
        assert messages[1].message_type == "reasoning_message"
        assert messages[2].message_type == "tool_call_message"
        assert messages[3].message_type == "tool_return_message"

    # ensure context is not bricked
    client.get(f"/v1/agents/{agent.id}/context", cast_to=dict[str, Any])

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_cursor).items
    assert len(messages) > 6
    assert messages[0].message_type == "user_message"
    assert messages[1].message_type == "reasoning_message"
    assert messages[2].message_type == "assistant_message"
    assert messages[3].message_type == "tool_call_message"
    assert messages[4].message_type == "approval_request_message"
    assert messages[5].message_type == "approval_response_message"
    assert messages[6].message_type == "tool_return_message"

    response = client.agents.messages.stream(
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
    assert messages[-1].message_type == "approval_request_message"

    # Check agent after approval request (run should be paused with requires_approval)
    agent_after_request = client.agents.retrieve(agent_id=agent.id)
    assert agent_after_request.last_stop_reason == "requires_approval"

    # Approve the tool call
    approve_tool_call(client, agent.id, response.messages[-1].tool_call.tool_call_id)

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
