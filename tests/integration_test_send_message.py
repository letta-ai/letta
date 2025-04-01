import os
import threading
import time
from typing import Any, Dict, List

import pytest
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta, Run, Tool
from letta_client.types import AssistantMessage, LettaUsageStatistics, ReasoningMessage, ToolCallMessage, ToolReturnMessage

from letta.schemas.agent import AgentState

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If the environment variable 'LETTA_SERVER_URL' is not set, this fixture
    will start the Letta server in a background thread and return the default URL.
    """

    def _run_server() -> None:
        """Starts the Letta server in a background thread."""
        load_dotenv()  # Load environment variables from .env file
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    # Retrieve server URL from environment, or default to localhost
    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    # If no environment variable is set, start the server in a background thread
    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        time.sleep(5)  # Allow time for the server to start

    return url


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="module")
def async_client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture(scope="module")
def roll_dice_tool(client: Letta) -> Tool:
    """
    Registers a simple roll dice tool with the provided client.

    The tool simulates rolling a six-sided die but returns a fixed result.
    """

    def roll_dice() -> str:
        """
        Simulates rolling a die.

        Returns:
            str: The roll result.
        """
        # Note: The result here is intentionally incorrect for demonstration purposes.
        return "Rolled a 10!"

    tool = client.tools.upsert_from_function(func=roll_dice)
    yield tool


@pytest.fixture(scope="module")
def agent_state(client: Letta, roll_dice_tool: Tool) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=True,
        tool_ids=[roll_dice_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance


# ------------------------------
# Helper Functions and Constants
# ------------------------------

USER_MESSAGE: List[Dict[str, str]] = [{"role": "user", "content": "Roll the dice."}]
TESTED_MODELS: List[str] = ["openai/gpt-4o"]


def assert_tool_response_messages(messages: List[Any]) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage ->
    ReasoningMessage -> AssistantMessage.
    """
    assert isinstance(messages[0], ReasoningMessage)
    assert isinstance(messages[1], ToolCallMessage)
    assert isinstance(messages[2], ToolReturnMessage)
    assert isinstance(messages[3], ReasoningMessage)
    assert isinstance(messages[4], AssistantMessage)


def assert_streaming_tool_response_messages(chunks: List[Any]) -> None:
    """
    Validates that streaming responses contain at least one reasoning message,
    one tool call, one tool return, one assistant message, and one usage statistics message.
    """

    def msg_groups(msg_type: Any) -> List[Any]:
        return [c for c in chunks if isinstance(c, msg_type)]

    reasoning_msgs = msg_groups(ReasoningMessage)
    tool_calls = msg_groups(ToolCallMessage)
    tool_returns = msg_groups(ToolReturnMessage)
    assistant_msgs = msg_groups(AssistantMessage)
    usage_stats = msg_groups(LettaUsageStatistics)

    assert len(reasoning_msgs) >= 1
    assert len(tool_calls) == 1
    assert len(tool_returns) == 1
    assert len(assistant_msgs) == 1
    assert len(usage_stats) == 1


def wait_for_run_completion(client: Letta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
    """
    Polls the run status until it completes or fails.

    Args:
        client (Letta): The synchronous Letta client.
        run_id (str): The identifier of the run to wait for.
        timeout (float): Maximum time to wait (in seconds).
        interval (float): Interval between status checks (in seconds).

    Returns:
        Run: The completed run object.

    Raises:
        RuntimeError: If the run fails.
        TimeoutError: If the run does not complete within the specified timeout.
    """
    start = time.time()
    while True:
        run = client.runs.retrieve_run(run_id)
        if run.status == "completed":
            return run
        if run.status == "failed":
            raise RuntimeError(f"Run {run_id} did not complete: status = {run.status}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


def assert_tool_response_dict_messages(messages: List[Dict[str, Any]]) -> None:
    """
    Asserts that a list of message dictionaries contains the expected types and statuses.

    Expected order:
        1. reasoning_message
        2. tool_call_message
        3. tool_return_message (with status 'success')
        4. reasoning_message
        5. assistant_message
    """
    assert isinstance(messages, list)
    assert messages[0]["message_type"] == "reasoning_message"
    assert messages[1]["message_type"] == "tool_call_message"
    assert messages[2]["message_type"] == "tool_return_message"
    assert messages[3]["message_type"] == "reasoning_message"
    assert messages[4]["message_type"] == "assistant_message"

    tool_return = messages[2]
    assert tool_return["status"] == "success"


# ------------------------------
# Test Cases
# ------------------------------


@pytest.mark.parametrize("model", TESTED_MODELS)
def test_send_message_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    client.agents.modify(agent_id=agent_state.id, model=model)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    assert_tool_response_messages(response.messages)


@pytest.mark.asyncio
@pytest.mark.parametrize("model", TESTED_MODELS)
async def test_send_message_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a message with an asynchronous client.
    Validates that the response messages match the expected sequence.
    """
    await async_client.agents.modify(agent_id=agent_state.id, model=model)
    response = await async_client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    assert_tool_response_messages(response.messages)


@pytest.mark.parametrize("model", TESTED_MODELS)
def test_send_message_streaming_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    client.agents.modify(agent_id=agent_state.id, model=model)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    chunks = list(response)
    assert_streaming_tool_response_messages(chunks)


@pytest.mark.asyncio
@pytest.mark.parametrize("model", TESTED_MODELS)
async def test_send_message_streaming_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a streaming message with an asynchronous client.
    Validates that the streaming response chunks include the correct message types.
    """
    await async_client.agents.modify(agent_id=agent_state.id, model=model)
    response = async_client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    chunks = [chunk async for chunk in response]
    assert_streaming_tool_response_messages(chunks)


@pytest.mark.parametrize("model", TESTED_MODELS)
def test_send_message_job_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    client.agents.modify(agent_id=agent_state.id, model=model)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    assert_tool_response_dict_messages(messages)


@pytest.mark.asyncio
@pytest.mark.parametrize("model", TESTED_MODELS)
async def test_send_message_job_async_client(
    disable_e2b_api_key: Any,
    client: Letta,
    async_client: AsyncLetta,
    agent_state: AgentState,
    model: str,
) -> None:
    """
    Tests sending a message as an asynchronous job using the asynchronous client.
    Waits for job completion and verifies that the resulting messages meet the expected format.
    """
    await async_client.agents.modify(agent_id=agent_state.id, model=model)

    run = await async_client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    # Use the synchronous client to check job completion
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    assert_tool_response_dict_messages(messages)
