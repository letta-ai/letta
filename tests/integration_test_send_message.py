import json
import os
import threading
import time
from typing import Any, Dict, List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta, Run
from letta_client.types import AssistantMessage, LettaUsageStatistics, ReasoningMessage, ToolCallMessage, ToolReturnMessage

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


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def async_client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture(scope="module")
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

    client.agents.delete(agent_state_instance.id)


# ------------------------------
# Helper Functions and Constants
# ------------------------------


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    filename = os.path.join(llm_config_dir, filename)
    config_data = json.load(open(filename, "r"))
    llm_config = LLMConfig(**config_data)
    return llm_config


def roll_dice(num_sides: int) -> int:
    """
    Returns a random number between 1 and num_sides.
    Args:
        num_sides (int): The number of sides on the die.
    Returns:
        int: A random integer between 1 and num_sides, representing the die roll.
    """
    import random

    return random.randint(1, num_sides)


USER_MESSAGE_GREETING: List[Dict[str, str]] = [{"role": "user", "content": "Hi there."}]
USER_MESSAGE_TOOL_CALL: List[Dict[str, str]] = [
    {"role": "user", "content": "Call the roll_dice tool with 16 sides and tell me the outcome."}
]
all_configs = [
    "openai-gpt-4o-mini.json",
    "azure-gpt-4o-mini.json",
    "claude-3-5-sonnet.json",
    "claude-3-7-sonnet.json",
    "claude-3-7-sonnet-extended.json",
    "gemini-1.5-pro.json",
    "gemini-2.5-flash-vertex.json",
    "gemini-2.5-pro-vertex.json",
]
requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]


def assert_greeting_with_assistant_message_response(messages: List[Any], streaming: bool = False) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> AssistantMessage.
    """
    expected_message_count = 3 if streaming else 2
    assert len(messages) == expected_message_count

    assert isinstance(messages[0], ReasoningMessage)
    assert isinstance(messages[1], AssistantMessage)

    if streaming:
        assert isinstance(messages[2], LettaUsageStatistics)


def assert_greeting_without_assistant_message_response(messages: List[Any], streaming: bool = False) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage.
    """
    expected_message_count = 4 if streaming else 3
    assert len(messages) == expected_message_count

    assert isinstance(messages[0], ReasoningMessage)
    assert isinstance(messages[1], ToolCallMessage)
    assert isinstance(messages[2], ToolReturnMessage)

    if streaming:
        assert isinstance(messages[3], LettaUsageStatistics)


def assert_tool_call_response(messages: List[Any], streaming: bool = False) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage ->
    ReasoningMessage -> AssistantMessage.
    """
    expected_message_count = 6 if streaming else 5
    assert len(messages) == expected_message_count

    assert isinstance(messages[0], ReasoningMessage)
    assert isinstance(messages[1], ToolCallMessage)
    assert isinstance(messages[2], ToolReturnMessage)
    assert isinstance(messages[3], ReasoningMessage)
    assert isinstance(messages[4], AssistantMessage)

    if streaming:
        assert isinstance(messages[5], LettaUsageStatistics)


def accumulate_chunks(chunks: List[Any]) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    """
    messages = []
    current_message = None
    prev_message_type = None
    for chunk in chunks:
        current_message_type = chunk.message_type
        if prev_message_type != current_message_type:
            messages.append(current_message)
            current_message = None
        if current_message is None:
            current_message = chunk
        else:
            pass  # TODO: actually accumulate the chunks. For now we only care about the count
        prev_message_type = current_message_type
    messages.append(current_message)
    return [m for m in messages if m is not None]


def wait_for_run_completion(client: Letta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
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


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
    )
    assert_greeting_with_assistant_message_response(response.messages)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
    )
    assert_greeting_without_assistant_message_response(response.messages)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
    )
    assert_tool_call_response(response.messages)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_greeting_with_assistant_message_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with an asynchronous client.
    Validates that the response messages match the expected sequence.
    """
    agent_state = await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = await async_client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
    )
    assert_greeting_with_assistant_message_response(response.messages)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_greeting_without_assistant_message_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with an asynchronous client.
    Validates that the response messages match the expected sequence.
    """
    agent_state = await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = await async_client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
    )
    assert_greeting_without_assistant_message_response(response.messages)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_tool_call_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with an asynchronous client.
    Validates that the response messages match the expected sequence.
    """
    dice_tool = await async_client.tools.upsert_from_function(func=roll_dice)
    agent_state = await async_client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = await async_client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
    )
    assert_tool_call_response(response.messages)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    agent_state = client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_tool_call_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_streaming_greeting_with_assistant_message_async_client(
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
        messages=USER_MESSAGE_GREETING,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_streaming_greeting_without_assistant_message_async_client(
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
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_streaming_tool_call_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with an asynchronous client.
    Validates that the streaming response chunks include the correct message types.
    """
    dice_tool = await async_client.tools.upsert_from_function(func=roll_dice)
    agent_state = await async_client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = async_client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_tool_call_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_token_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_token_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_token_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    agent_state = client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_tool_call_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_token_streaming_greeting_with_assistant_message_async_client(
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
        messages=USER_MESSAGE_GREETING,
        stream_tokens=True,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_token_streaming_greeting_without_assistant_message_async_client(
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
        messages=USER_MESSAGE_GREETING,
        use_assistant_message=False,
        stream_tokens=True,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, streaming=True)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_token_streaming_tool_call_async_client(
    disable_e2b_api_key: Any,
    async_client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with an asynchronous client.
    Validates that the streaming response chunks include the correct message types.
    """
    dice_tool = await async_client.tools.upsert_from_function(func=roll_dice)
    agent_state = await async_client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    agent_state = await async_client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = async_client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_TOOL_CALL,
        stream_tokens=True,
    )
    chunks = [chunk async for chunk in response]
    messages = accumulate_chunks(chunks)
    assert_tool_call_response(messages, streaming=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_async_greeting_with_assistant_message(
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
        messages=USER_MESSAGE_GREETING,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    assert_tool_response_dict_messages(messages)


@pytest.mark.asyncio
@pytest.mark.async_client_test
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
async def test_async_greeting_with_assistant_message_async_client(
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
        messages=USER_MESSAGE_GREETING,
    )
    # Use the synchronous client to check job completion
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    assert_tool_response_dict_messages(messages)
