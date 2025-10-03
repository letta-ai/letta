import base64
import json
import os
import threading
import time
import uuid
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Tuple
from unittest.mock import patch

import httpx
import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta, Letta, LettaRequest, MessageCreate, Run
from letta_client.core.api_error import ApiError
from letta_client.types import (
    AssistantMessage,
    Base64Image,
    HiddenReasoningMessage,
    ImageContent,
    LettaMessageUnion,
    LettaStopReason,
    LettaUsageStatistics,
    ReasoningMessage,
    TextContent,
    ToolCallMessage,
    ToolReturnMessage,
    UrlImage,
    UserMessage,
)

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentType, JobStatus
from letta.schemas.letta_ping import LettaPing
from letta.schemas.llm_config import LLMConfig

logger = get_logger(__name__)


# ------------------------------
# Helper Functions and Constants
# ------------------------------


all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-o3.json",
    "openai-gpt-5.json",
    "claude-3-5-sonnet.json",
    "claude-3-7-sonnet-extended.json",
    "gemini-2.5-flash.json",
]


def get_llm_config(filename: str, llm_config_dir: str = "tests/configs/llm_model_configs") -> LLMConfig:
    filename = os.path.join(llm_config_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    llm_config = LLMConfig(**config_data)
    return llm_config


requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_LLM_CONFIGS: List[LLMConfig] = [get_llm_config(fn) for fn in filenames]


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
        content=f"This is an automated test message. Reply with the message '{USER_MESSAGE_RESPONSE}'.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and reply back to me with the outcome.",
        otid=USER_MESSAGE_OTID,
    )
]


def assert_greeting_response(
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
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        llm_config, streaming=streaming, from_db=from_db
    )
    assert expected_message_count_min <= len(messages) <= expected_message_count_max

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(llm_config):
            assert isinstance(messages[index], ReasoningMessage)
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Assistant message
    assert isinstance(messages[index], AssistantMessage)
    if not token_streaming:
        assert "teamwork" in messages[index].content.lower()
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1
    otid_suffix += 1

    # Stop reason and usage statistics if streaming
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
    # Filter out LettaPing messages which are keep-alive messages for SSE streams
    messages = [
        msg for msg in messages if not (isinstance(msg, LettaPing) or (hasattr(msg, "message_type") and msg.message_type == "ping"))
    ]

    expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
        llm_config, tool_call=True, streaming=streaming, from_db=from_db
    )
    assert expected_message_count_min <= len(messages) <= expected_message_count_max

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(llm_config):
            assert isinstance(messages[index], ReasoningMessage)
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Assistant message
    if llm_config.model_endpoint_type == "anthropic":
        assert isinstance(messages[index], AssistantMessage)
        assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
        index += 1
        otid_suffix += 1

    # Tool call message
    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Tool return message
    otid_suffix = 0
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(llm_config):
            assert isinstance(messages[index], ReasoningMessage)
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Assistant message
    assert isinstance(messages[index], AssistantMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1
    otid_suffix += 1

    # Stop reason and usage statistics if streaming
    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == "end_turn"
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


async def accumulate_chunks(chunks: List[Any], verify_token_streaming: bool = False) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    """
    messages = []
    current_message = None
    prev_message_type = None
    chunk_count = 0
    async for chunk in chunks:
        current_message_type = chunk.message_type
        if prev_message_type != current_message_type:
            messages.append(current_message)
            if (
                prev_message_type
                and verify_token_streaming
                and current_message.message_type in ["reasoning_message", "assistant_message", "tool_call_message"]
            ):
                assert chunk_count > 1, f"Expected more than one chunk for {current_message.message_type}. Messages: {messages}"
            current_message = None
            chunk_count = 0
        if current_message is None:
            current_message = chunk
        else:
            pass  # TODO: actually accumulate the chunks. For now we only care about the count
        prev_message_type = current_message_type
        chunk_count += 1
    messages.append(current_message)
    if verify_token_streaming and current_message.message_type in ["reasoning_message", "assistant_message", "tool_call_message"]:
        assert chunk_count > 1, f"Expected more than one chunk for {current_message.message_type}"

    return [m for m in messages if m is not None]


async def wait_for_run_completion(client: AsyncLetta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
    start = time.time()
    while True:
        run = await client.runs.retrieve(run_id)
        if run.status == "completed":
            return run
        if run.status == "failed":
            raise RuntimeError(f"Run {run_id} did not complete: status = {run.status}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


def get_expected_message_count_range(
    llm_config: LLMConfig, tool_call: bool = False, streaming: bool = False, from_db: bool = False
) -> Tuple[int, int]:
    """
    Returns the expected range of number of messages for a given LLM configuration. Uses range to account for possible variations in the number of reasoning messages.

    Greeting:
    ------------------------------------------------------------------------------------------------------------------------------------------------------------------
    | gpt-4o                   |  gpt-o3 (med effort)     |  gpt-5 (high effort)     |  sonnet-3-5              |  sonnet-3.7-thinking     |  flash-2.5-thinking      |
    | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
    | AssistantMessage         |  AssistantMessage        |  ReasoningMessage        |  AssistantMessage        |  ReasoningMessage        |  ReasoningMessage        |
    |                          |                          |  AssistantMessage        |                          |  AssistantMessage        |  AssistantMessage        |


    Tool Call:
    ------------------------------------------------------------------------------------------------------------------------------------------------------------------
    | gpt-4o                   |  gpt-o3 (med effort)     |  gpt-5 (high effort)     |  sonnet-3-5              |  sonnet-3.7-thinking     |  flash-2.5-thinking      |
    | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
    | ToolCallMessage          |  ToolCallMessage         |  ReasoningMessage        |  AssistantMessage        |  ReasoningMessage        |  ReasoningMessage        |
    | ToolReturnMessage        |  ToolReturnMessage       |  ToolCallMessage         |  ToolCallMessage         |  AssistantMessage        |  ToolCallMessage         |
    | AssistantMessage         |  AssistantMessage        |  ToolReturnMessage       |  ToolReturnMessage       |  ToolCallMessage         |  ToolReturnMessage       |
    |                          |                          |  ReasoningMessage        |  AssistantMessage        |  ToolReturnMessage       |  ReasoningMessage        |
    |                          |                          |  AssistantMessage        |                          |  AssistantMessage        |  AssistantMessage        |

    """
    # assistant message
    expected_message_count = 1
    expected_range = 0

    if is_reasoner_model(llm_config):
        # reasoning message
        expected_range += 1
        if tool_call and not LLMConfig.is_anthropic_reasoning_model(llm_config):
            # reasoning message for additional turn, only for openai and google models
            expected_range += 1

    if tool_call:
        # tool call and tool return messages
        expected_message_count += 2
        if llm_config.model_endpoint_type == "anthropic":
            # anthropic models return an assistant message first before the tool call message
            expected_message_count += 1

    if from_db:
        # user message
        expected_message_count += 1

    if streaming:
        # stop reason and usage statistics
        expected_message_count += 2

    return expected_message_count, expected_message_count + expected_range


def is_reasoner_model(llm_config: LLMConfig) -> bool:
    return (
        (LLMConfig.is_openai_reasoning_model(llm_config) and llm_config.reasoning_effort == "high")
        or LLMConfig.is_anthropic_reasoning_model(llm_config)
        or LLMConfig.is_google_vertex_reasoning_model(llm_config)
        or LLMConfig.is_google_ai_reasoning_model(llm_config)
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


@pytest.fixture(scope="function")
async def client(server_url: str) -> AsyncLetta:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    client_instance = AsyncLetta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
async def agent_state(client: AsyncLetta) -> AgentState:
    """
    Creates and returns an agent state for testing with a pre-configured agent.
    The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
    """
    dice_tool = await client.tools.upsert_from_function(func=roll_dice)

    agent_state_instance = await client.agents.create(
        agent_type=AgentType.letta_v1_agent,
        name="test_agent",
        include_base_tools=False,
        tool_ids=[dice_tool.id],
        model="openai/gpt-4o",
        embedding="openai/text-embedding-3-small",
        tags=["test"],
    )
    yield agent_state_instance

    await client.agents.delete(agent_state_instance.id)


# ------------------------------
# Test Cases
# ------------------------------


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
@pytest.mark.parametrize("send_type", ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"])
@pytest.mark.asyncio(loop_scope="function")
async def test_greeting(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
    send_type: str,
) -> None:
    last_message = await client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = await client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    if send_type == "step":
        response = await client.agents.messages.create(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
        messages = response.messages
        run_id = messages[0].run_id
    elif send_type == "async":
        run = await client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
        run = await wait_for_run_completion(client, run.id)
        messages = await client.runs.messages.list(run_id=run.id)
        messages = [m for m in messages if m.message_type != "user_message"]
        run_id = run.id
    else:
        response = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
            stream_tokens=(send_type == "stream_tokens"),
            background=(send_type == "stream_tokens_background"),
        )
        messages = await accumulate_chunks(response)
        run_id = messages[0].run_id

    assert_greeting_response(
        messages, streaming=("stream" in send_type), token_streaming=(send_type == "stream_tokens"), llm_config=llm_config
    )

    if "background" in send_type:
        response = client.runs.stream(run_id=run_id, starting_after=0)
        messages = await accumulate_chunks(response)
        assert_greeting_response(
            messages, streaming=("stream" in send_type), token_streaming=(send_type == "stream_tokens"), llm_config=llm_config
        )

    messages_from_db = await client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_response(messages_from_db, from_db=True, llm_config=llm_config)

    assert run_id is not None
    run = await client.runs.retrieve(run_id=run_id)
    assert run.status == JobStatus.completed


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
@pytest.mark.parametrize("send_type", ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"])
@pytest.mark.asyncio(loop_scope="function")
async def test_tool_call(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    llm_config: LLMConfig,
    send_type: str,
) -> None:
    last_message = await client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = await client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    if send_type == "step":
        response = await client.agents.messages.create(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
        )
        messages = response.messages
        run_id = messages[0].run_id
    elif send_type == "async":
        run = await client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
        )
        run = await wait_for_run_completion(client, run.id)
        messages = await client.runs.messages.list(run_id=run.id)
        messages = [m for m in messages if m.message_type != "user_message"]
        run_id = run.id
    else:
        response = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
            stream_tokens=(send_type == "stream_tokens"),
            background=(send_type == "stream_tokens_background"),
        )
        messages = await accumulate_chunks(response)
        run_id = messages[0].run_id

    assert_tool_call_response(messages, streaming=("stream" in send_type), llm_config=llm_config)

    if "background" in send_type:
        response = client.runs.stream(run_id=run_id, starting_after=0)
        messages = await accumulate_chunks(response)
        assert_tool_call_response(messages, streaming=("stream" in send_type), llm_config=llm_config)

    messages_from_db = await client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)

    assert run_id is not None
    run = await client.runs.retrieve(run_id=run_id)
    assert run.status == JobStatus.completed
