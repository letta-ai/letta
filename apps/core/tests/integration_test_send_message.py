import base64
import json
import os
import threading
import time
import uuid
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List

import httpx
import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta, MessageCreate, Run
from letta_client.core.api_error import ApiError
from letta_client.types import (
    AssistantMessage,
    Base64Image,
    HiddenReasoningMessage,
    ImageContent,
    LettaStopReason,
    LettaUsageStatistics,
    ReasoningMessage,
    TextContent,
    ToolCallMessage,
    ToolReturnMessage,
    UrlImage,
    UserMessage,
)

from letta.llm_api.openai_client import is_openai_reasoning_model
from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig

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


USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_RESPONSE: str = "Teamwork makes the dream work"
USER_MESSAGE_FORCE_REPLY: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and send me a message with the outcome.",
        otid=USER_MESSAGE_OTID,
    )
]
URL_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg"
USER_MESSAGE_URL_IMAGE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=[
            ImageContent(source=UrlImage(url=URL_IMAGE)),
            TextContent(text="What is in this image?"),
        ],
        otid=USER_MESSAGE_OTID,
    )
]
BASE64_IMAGE = base64.standard_b64encode(httpx.get(URL_IMAGE).content).decode("utf-8")
USER_MESSAGE_BASE64_IMAGE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=[
            ImageContent(source=Base64Image(data=BASE64_IMAGE, media_type="image/jpeg")),
            TextContent(text="What is in this image?"),
        ],
        otid=USER_MESSAGE_OTID,
    )
]
all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-o1.json",
    "openai-o1-mini.json",
    "openai-o3.json",
    "openai-o3-mini.json",
    "azure-gpt-4o-mini.json",
    "claude-3-5-sonnet.json",
    "claude-3-7-sonnet.json",
    "claude-3-7-sonnet-extended.json",
    "gemini-1.5-pro.json",
    "gemini-2.5-flash-vertex.json",
    "gemini-2.5-pro-vertex.json",
    "together-qwen-2.5-72b-instruct.json",
    "ollama.json",
]


requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]


def assert_greeting_with_assistant_message_response(
    messages: List[Any],
    llm_config: LLMConfig,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> AssistantMessage.
    """
    expected_message_count = 4 if streaming else 3 if from_db else 2
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1
    if is_openai_reasoning_model(llm_config.model):
        assert isinstance(messages[index], HiddenReasoningMessage)
    else:
        assert isinstance(messages[index], ReasoningMessage)

    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    assert isinstance(messages[index], AssistantMessage)
    if not token_streaming:
        assert USER_MESSAGE_RESPONSE in messages[index].content
    assert messages[index].otid and messages[index].otid[-1] == "1"
    index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_greeting_without_assistant_message_response(
    messages: List[Any],
    llm_config: LLMConfig,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage.
    """
    expected_message_count = 5 if streaming else 4 if from_db else 3
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1
    if is_openai_reasoning_model(llm_config.model):
        assert isinstance(messages[index], HiddenReasoningMessage)
    else:
        assert isinstance(messages[index], ReasoningMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].tool_call.name == "send_message"
    if not token_streaming:
        assert USER_MESSAGE_RESPONSE in messages[index].tool_call.arguments
    assert messages[index].otid and messages[index].otid[-1] == "1"
    index += 1

    # Agent Step 2
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_tool_call_response(
    messages: List[Any],
    llm_config: LLMConfig,
    streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> ToolCallMessage -> ToolReturnMessage ->
    ReasoningMessage -> AssistantMessage.
    """
    expected_message_count = 7 if streaming or from_db else 5
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1
    if is_openai_reasoning_model(llm_config.model):
        assert isinstance(messages[index], HiddenReasoningMessage)
    else:
        assert isinstance(messages[index], ReasoningMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].otid and messages[index].otid[-1] == "1"
    index += 1

    # Agent Step 2
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    # Hidden User Message
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert "request_heartbeat=true" in messages[index].content
        index += 1

    # Agent Step 3
    if is_openai_reasoning_model(llm_config.model):
        assert isinstance(messages[index], HiddenReasoningMessage)
    else:
        assert isinstance(messages[index], ReasoningMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    assert isinstance(messages[index], AssistantMessage)
    assert messages[index].otid and messages[index].otid[-1] == "1"
    index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


def assert_image_input_response(
    messages: List[Any],
    llm_config: LLMConfig,
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence:
    ReasoningMessage -> AssistantMessage.
    """
    expected_message_count = 4 if streaming else 3 if from_db else 2
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1
    if is_openai_reasoning_model(llm_config.model):
        assert isinstance(messages[index], HiddenReasoningMessage)
    else:
        assert isinstance(messages[index], ReasoningMessage)
    assert messages[index].otid and messages[index].otid[-1] == "0"
    index += 1

    assert isinstance(messages[index], AssistantMessage)
    assert messages[index].otid and messages[index].otid[-1] == "1"
    index += 1

    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


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
def async_client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture(scope="function")
def agent_state(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    client.tools.upsert_base_tools()
    dice_tool = client.tools.upsert_from_function(func=roll_dice)

    send_message_tool = client.tools.list(name="send_message")[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=False,
        tool_ids=[send_message_tool.id, dice_tool.id],
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance

    client.agents.delete(agent_state_instance.id)


@pytest.fixture(scope="function")
def agent_state_no_tools(client: Letta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with no tools.
    """
    send_message_tool = client.tools.list(name="send_message")[0]
    agent_state_instance = client.agents.create(
        name="supervisor",
        include_base_tools=False,
        model="openai/gpt-4o",
        embedding="letta/letta-free",
        tags=["supervisor"],
    )
    yield agent_state_instance

    client.agents.delete(agent_state_instance.id)


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    assert_greeting_with_assistant_message_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
    )
    assert_greeting_without_assistant_message_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_ROLL_DICE,
    )
    assert_tool_call_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_url_image_input(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_URL_IMAGE,
    )
    assert_image_input_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_image_input_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_base64_image_input(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_BASE64_IMAGE,
    )
    assert_image_input_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_image_input_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state_no_tools: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    last_message = client.agents.messages.list(agent_id=agent_state_no_tools.id, limit=1)
    agent_state_no_tools = client.agents.modify(agent_id=agent_state_no_tools.id, llm_config=llm_config)
    with pytest.raises(ApiError):
        client.agents.messages.create(
            agent_id=agent_state_no_tools.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
    messages_from_db = client.agents.messages.list(agent_id=agent_state_no_tools.id, after=last_message[0].id)
    assert len(messages_from_db) == 0


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_step_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_with_assistant_message_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_step_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_without_assistant_message_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_step_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_ROLL_DICE,
    )
    messages = accumulate_chunks(list(response))
    assert_tool_call_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_step_stream_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state_no_tools: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    last_message = client.agents.messages.list(agent_id=agent_state_no_tools.id, limit=1)
    agent_state_no_tools = client.agents.modify(agent_id=agent_state_no_tools.id, llm_config=llm_config)
    with pytest.raises(ApiError):
        response = client.agents.messages.create_stream(
            agent_id=agent_state_no_tools.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
        list(response)

    messages_from_db = client.agents.messages.list(agent_id=agent_state_no_tools.id, after=last_message[0].id)
    assert len(messages_from_db) == 0


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        stream_tokens=True,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_with_assistant_message_response(messages, streaming=True, token_streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
        stream_tokens=True,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_without_assistant_message_response(messages, streaming=True, token_streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_ROLL_DICE,
        stream_tokens=True,
    )
    messages = accumulate_chunks(list(response))
    assert_tool_call_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_token_streaming_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state_no_tools: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    last_message = client.agents.messages.list(agent_id=agent_state_no_tools.id, limit=1)
    agent_state_no_tools = client.agents.modify(agent_id=agent_state_no_tools.id, llm_config=llm_config, tool_ids=[])
    try:
        response = client.agents.messages.create_stream(
            agent_id=agent_state_no_tools.id,
            messages=USER_MESSAGE_FORCE_REPLY,
            stream_tokens=True,
        )
        list(response)
    except:
        pass  # only some models throw an error TODO: make this consistent

    messages_from_db = client.agents.messages.list(agent_id=agent_state_no_tools.id, after=last_message[0].id)
    assert len(messages_from_db) == 0


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
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    assert_tool_response_dict_messages(messages)


class CallbackServer:
    """Mock HTTP server for testing callback functionality."""

    def __init__(self):
        self.received_callbacks = []
        self.server = None
        self.thread = None
        self.port = None

    def start(self):
        """Start the mock server on an available port."""

        class CallbackHandler(BaseHTTPRequestHandler):
            def __init__(self, callback_server, *args, **kwargs):
                self.callback_server = callback_server
                super().__init__(*args, **kwargs)

            def do_POST(self):
                content_length = int(self.headers["Content-Length"])
                post_data = self.rfile.read(content_length)
                try:
                    callback_data = json.loads(post_data.decode("utf-8"))
                    self.callback_server.received_callbacks.append(
                        {"data": callback_data, "headers": dict(self.headers), "timestamp": time.time()}
                    )
                    # Respond with success
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "received"}).encode())
                except Exception as e:
                    # Respond with error
                    self.send_response(400)
                    self.send_header("Content-type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode())

            def log_message(self, format, *args):
                # Suppress log messages during tests
                pass

        # Bind to available port
        self.server = HTTPServer(("localhost", 0), lambda *args: CallbackHandler(self, *args))
        self.port = self.server.server_address[1]

        # Start server in background thread
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        """Stop the mock server."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread:
            self.thread.join(timeout=1)

    @property
    def url(self):
        """Get the callback URL for this server."""
        return f"http://localhost:{self.port}/callback"

    def wait_for_callback(self, timeout=10):
        """Wait for at least one callback to be received."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.received_callbacks:
                return True
            time.sleep(0.1)
        return False


@contextmanager
def callback_server():
    """Context manager for callback server."""
    server = CallbackServer()
    try:
        server.start()
        yield server
    finally:
        server.stop()


# TODO: Add back in a bit
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_async_greeting_with_callback_url(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     llm_config: LLMConfig,
# ) -> None:
#     """
#     Tests sending a message as an asynchronous job with callback URL functionality.
#     Validates that callbacks are properly sent with correct payload structure.
#     """
#     client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
#
#     with callback_server() as server:
#         # Create async job with callback URL
#         run = client.agents.messages.create_async(
#             agent_id=agent_state.id,
#             messages=USER_MESSAGE_FORCE_REPLY,
#             callback_url=server.url,
#         )
#
#         # Wait for job completion
#         run = wait_for_run_completion(client, run.id)
#
#         # Validate job completed successfully
#         result = run.metadata.get("result")
#         assert result is not None, "Run metadata missing 'result' key"
#         messages = result["messages"]
#         assert_tool_response_dict_messages(messages)
#
#         # Validate callback was received
#         assert server.wait_for_callback(timeout=15), "Callback was not received within timeout"
#         assert len(server.received_callbacks) == 1, f"Expected 1 callback, got {len(server.received_callbacks)}"
#
#         # Validate callback payload structure
#         callback = server.received_callbacks[0]
#         callback_data = callback["data"]
#
#         # Check required fields
#         assert "job_id" in callback_data, "Callback missing 'job_id' field"
#         assert "status" in callback_data, "Callback missing 'status' field"
#         assert "completed_at" in callback_data, "Callback missing 'completed_at' field"
#         assert "metadata" in callback_data, "Callback missing 'metadata' field"
#
#         # Validate field values
#         assert callback_data["job_id"] == run.id, f"Job ID mismatch: {callback_data['job_id']} != {run.id}"
#         assert callback_data["status"] == "completed", f"Expected status 'completed', got {callback_data['status']}"
#         assert callback_data["completed_at"] is not None, "completed_at should not be None"
#         assert callback_data["metadata"] is not None, "metadata should not be None"
#
#         # Validate that callback metadata contains the result
#         assert "result" in callback_data["metadata"], "Callback metadata missing 'result' field"
#         callback_result = callback_data["metadata"]["result"]
#         assert callback_result == result, "Callback result doesn't match job result"
#
#         # Validate HTTP headers
#         headers = callback["headers"]
#         assert headers.get("Content-Type") == "application/json", "Callback should have JSON content type"
#
#
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_async_callback_failure_scenarios(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     llm_config: LLMConfig,
# ) -> None:
#     """
#     Tests that job completion works even when callback URLs fail.
#     This ensures callback failures don't affect job processing.
#     """
#     client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
#
#     # Test with invalid callback URL - job should still complete
#     run = client.agents.messages.create_async(
#         agent_id=agent_state.id,
#         messages=USER_MESSAGE_FORCE_REPLY,
#         callback_url="http://invalid-domain-that-does-not-exist.com/callback",
#     )
#
#     # Wait for job completion - should work despite callback failure
#     run = wait_for_run_completion(client, run.id)
#
#     # Validate job completed successfully
#     result = run.metadata.get("result")
#     assert result is not None, "Run metadata missing 'result' key"
#     messages = result["messages"]
#     assert_tool_response_dict_messages(messages)
#
#     # Job should be marked as completed even if callback failed
#     assert run.status == "completed", f"Expected status 'completed', got {run.status}"


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_auto_summarize(disable_e2b_api_key: Any, client: Letta, llm_config: LLMConfig):
    """Test that summarization is automatically triggered."""
    # pydantic prevents us for overriding the context window paramter in the passed LLMConfig
    new_llm_config = llm_config.model_dump()
    new_llm_config["context_window"] = 3000
    pinned_context_window_llm_config = LLMConfig(**new_llm_config)

    send_message_tool = client.tools.list(name="send_message")[0]
    temp_agent_state = client.agents.create(
        include_base_tools=False,
        tool_ids=[send_message_tool.id],
        llm_config=pinned_context_window_llm_config,
        embedding="letta/letta-free",
        tags=["supervisor"],
    )

    philosophical_question_path = os.path.join(os.path.dirname(__file__), "data", "philosophical_question.txt")
    with open(philosophical_question_path, "r", encoding="utf-8") as f:
        philosophical_question = f.read().strip()

    MAX_ATTEMPTS = 10
    prev_length = None

    for attempt in range(MAX_ATTEMPTS):
        client.agents.messages.create(
            agent_id=temp_agent_state.id,
            messages=[MessageCreate(role="user", content=philosophical_question)],
        )

        temp_agent_state = client.agents.retrieve(agent_id=temp_agent_state.id)
        message_ids = temp_agent_state.message_ids
        current_length = len(message_ids)

        print("LENGTH OF IN_CONTEXT_MESSAGES:", current_length)

        if prev_length is not None and current_length <= prev_length:
            # TODO: Add more stringent checks here
            print(f"Summarization was triggered, detected current_length {current_length} is at least prev_length {prev_length}.")
            break

        prev_length = current_length
    else:
        raise AssertionError("Summarization was not triggered after 10 messages")
