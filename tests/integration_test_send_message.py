import json
import os
import threading
import time
from typing import Any, Dict, List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta, Run
from letta_client.types import AssistantMessage, ReasoningMessage

from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig

# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it’s accepting connections.
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


@pytest.fixture
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture
def async_client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    client.tools.upsert_base_tools()

    send_message_tool = client.tools.list(name="send_message")[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=False,
        tool_ids=[send_message_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance


# ------------------------------
# Helper Functions and Constants
# ------------------------------


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    filename = os.path.join(llm_config_dir, filename)
    config_data = json.load(open(filename, "r"))
    llm_config = LLMConfig(**config_data)
    return llm_config


USER_MESSAGE: List[Dict[str, str]] = [{"role": "user", "content": "Hi there."}]
all_configs = [
    "openai-gpt-4o-mini.json",
    "azure-gpt-4o-mini.json",
    "claude-3-5-sonnet.json",
    "claude-3-7-sonnet.json",
    "claude-3-7-sonnet-extended.json",
    "gemini-pro.json",
    "gemini-vertex.json",
]
requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]


def assert_tool_response_messages(messages: List[Any]) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage ->
    ReasoningMessage -> AssistantMessage.
    """
    assert isinstance(messages[0], ReasoningMessage)
    assert isinstance(messages[1], AssistantMessage)


def assert_streaming_tool_response_messages(chunks: List[Any]) -> None:
    """
    Validates that streaming responses contain at least one reasoning message,
    one tool call, one tool return, one assistant message, and one usage statistics message.
    """

    def msg_groups(msg_type: Any) -> List[Any]:
        return [c for c in chunks if isinstance(c, msg_type)]

    reasoning_msgs = msg_groups(ReasoningMessage)
    assistant_msgs = msg_groups(AssistantMessage)

    assert len(reasoning_msgs) == 1
    assert len(assistant_msgs) == 1


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
        run = client.runs.retrieve(run_id)
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
    assert messages[1]["message_type"] == "assistant_message"


# ------------------------------
# Test Cases
# ------------------------------


@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
def test_send_message_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    assert_tool_response_messages(response.messages)


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
async def test_send_message_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with an asynchronous client.
    Validates that the response messages match the expected sequence.
    """
    await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = await async_client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    assert_tool_response_messages(response.messages)


@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
def test_send_message_streaming_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    chunks = list(response)
    assert_streaming_tool_response_messages(chunks)


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
async def test_send_message_streaming_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with an asynchronous client.
    Validates that the streaming response chunks include the correct message types.
    """
    await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = async_client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE,
    )
    chunks = [chunk async for chunk in response]
    assert_streaming_tool_response_messages(chunks)


@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
def test_send_message_job_sync_client(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

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
@pytest.mark.parametrize("llm_config", TESTED_LLM_CONFIGS)
async def test_send_message_job_async_client(
    disable_e2b_api_key: Any,
    client: Letta,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message as an asynchronous job using the asynchronous client.
    Waits for job completion and verifies that the resulting messages meet the expected format.
    """
    await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

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
