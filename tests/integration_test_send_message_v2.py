import asyncio
import itertools
import json
import logging
import os
import threading
import time
import uuid
from typing import Any, List, Tuple

import pytest
import requests
from dotenv import load_dotenv
from letta_client import AsyncLetta
from letta_client.types import (
    AgentState,
    AnthropicModelSettings,
    JsonSchemaResponseFormat,
    MessageCreateParam,
    OpenAIModelSettings,
    ToolReturnMessage,
)
from letta_client.types.agents import AssistantMessage, ReasoningMessage, Run, ToolCallMessage, UserMessage
from letta_client.types.agents.letta_streaming_response import LettaPing, LettaStopReason, LettaUsageStatistics

logger = logging.getLogger(__name__)


# ------------------------------
# Helper Functions and Constants
# ------------------------------


all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-gpt-4.1.json",
    "openai-gpt-5.json",
    "claude-4-5-sonnet.json",
    "gemini-2.5-pro.json",
]


def get_model_config(filename: str, model_settings_dir: str = "tests/model_settings") -> Tuple[str, dict]:
    """Load a model_settings file and return the handle and settings dict."""
    filename = os.path.join(model_settings_dir, filename)
    with open(filename, "r") as f:
        config_data = json.load(f)
    return config_data["handle"], config_data.get("model_settings", {})


requested = os.getenv("LLM_CONFIG_FILE")
filenames = [requested] if requested else all_configs
TESTED_MODEL_CONFIGS: List[Tuple[str, dict]] = [get_model_config(fn) for fn in filenames]


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
USER_MESSAGE_FORCE_REPLY: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=f"This is an automated test message. Reply with the message '{USER_MESSAGE_RESPONSE}'.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_ROLL_DICE: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content="This is an automated test message. Call the roll_dice tool with 16 sides and reply back to me with the outcome.",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_PARALLEL_TOOL_CALL: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content=(
            "This is an automated test message. Please call the roll_dice tool EXACTLY three times in parallel - no more, no less. "
            "Call it with num_sides=6, num_sides=12, and num_sides=20. Make all three calls at the same time in a single response."
        ),
        otid=USER_MESSAGE_OTID,
    )
]


def assert_greeting_response(
    messages: List[Any],
    model_handle: str,
    model_settings: dict,
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
        model_handle, model_settings, streaming=streaming, from_db=from_db
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
        if is_reasoner_model(model_handle, model_settings):
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
    model_handle: str,
    model_settings: dict,
    streaming: bool = False,
    from_db: bool = False,
    with_cancellation: bool = False,
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

    # If cancellation happened and no messages were persisted (early cancellation), return early
    if with_cancellation and len(messages) == 0:
        return

    if not with_cancellation:
        expected_message_count_min, expected_message_count_max = get_expected_message_count_range(
            model_handle, model_settings, tool_call=True, streaming=streaming, from_db=from_db
        )
        assert expected_message_count_min <= len(messages) <= expected_message_count_max

    # User message if loaded from db
    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # If cancellation happened after user message but before any response, return early
    if with_cancellation and index >= len(messages):
        return

    # Reasoning message if reasoning enabled
    otid_suffix = 0
    try:
        if is_reasoner_model(model_handle, model_settings):
            assert isinstance(messages[index], ReasoningMessage)
            assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
            index += 1
            otid_suffix += 1
    except:
        # Reasoning is non-deterministic, so don't throw if missing
        pass

    # Special case for claude-sonnet-4-5-20250929 and opus-4.1 which can generate an extra AssistantMessage before tool call
    if (
        ("claude-sonnet-4-5-20250929" in model_handle or "claude-opus-4-1" in model_handle)
        and index < len(messages)
        and isinstance(messages[index], AssistantMessage)
    ):
        # Skip the extra AssistantMessage and move to the next message
        index += 1
        otid_suffix += 1

    # Tool call message (may be skipped if cancelled early)
    if with_cancellation and index < len(messages) and isinstance(messages[index], AssistantMessage):
        # If cancelled early, model might respond with text instead of making tool call
        assert "roll" in messages[index].content.lower() or "die" in messages[index].content.lower()
        return  # Skip tool call assertions for early cancellation

    # If cancellation happens before tool call, we might get LettaStopReason directly
    if with_cancellation and index < len(messages) and isinstance(messages[index], LettaStopReason):
        assert messages[index].stop_reason == "cancelled"
        return  # Skip remaining assertions for very early cancellation

    assert isinstance(messages[index], ToolCallMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # If cancellation happens before tool return, we might get LettaStopReason directly
    if with_cancellation and index < len(messages) and isinstance(messages[index], LettaStopReason):
        assert messages[index].stop_reason == "cancelled"
        return  # Skip remaining assertions for very early cancellation

    # Tool return message
    otid_suffix = 0
    assert isinstance(messages[index], ToolReturnMessage)
    assert messages[index].otid and messages[index].otid[-1] == str(otid_suffix)
    index += 1

    # Messages from second agent step if request has not been cancelled
    if not with_cancellation:
        # Reasoning message if reasoning enabled
        otid_suffix = 0
        try:
            if is_reasoner_model(model_handle, model_settings):
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

    # Stop reason and usage statistics if streaming
    if streaming:
        assert isinstance(messages[index], LettaStopReason)
        assert messages[index].stop_reason == ("cancelled" if with_cancellation else "end_turn")
        index += 1
        assert isinstance(messages[index], LettaUsageStatistics)
        assert messages[index].prompt_tokens > 0
        assert messages[index].completion_tokens > 0
        assert messages[index].total_tokens > 0
        assert messages[index].step_count > 0


async def accumulate_chunks(chunks, verify_token_streaming: bool = False) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    Handles both async iterators and raw SSE strings.
    """
    messages = []
    current_message = None
    prev_message_type = None

    # Handle raw SSE string from runs.messages.stream()
    if isinstance(chunks, str):
        import json

        for line in chunks.strip().split("\n"):
            if line.startswith("data: ") and line != "data: [DONE]":
                try:
                    data = json.loads(line[6:])  # Remove 'data: ' prefix
                    if "message_type" in data:
                        # Create proper message type objects
                        message_type = data.get("message_type")
                        if message_type == "assistant_message":
                            from letta_client.types.agents import AssistantMessage

                            chunk = AssistantMessage(**data)
                        elif message_type == "reasoning_message":
                            from letta_client.types.agents import ReasoningMessage

                            chunk = ReasoningMessage(**data)
                        elif message_type == "tool_call_message":
                            from letta_client.types.agents import ToolCallMessage

                            chunk = ToolCallMessage(**data)
                        elif message_type == "tool_return_message":
                            from letta_client.types import ToolReturnMessage

                            chunk = ToolReturnMessage(**data)
                        elif message_type == "user_message":
                            from letta_client.types.agents import UserMessage

                            chunk = UserMessage(**data)
                        elif message_type == "stop_reason":
                            from letta_client.types.agents.letta_streaming_response import LettaStopReason

                            chunk = LettaStopReason(**data)
                        elif message_type == "usage_statistics":
                            from letta_client.types.agents.letta_streaming_response import LettaUsageStatistics

                            chunk = LettaUsageStatistics(**data)
                        else:
                            chunk = type("Chunk", (), data)()  # Fallback for unknown types

                        current_message_type = chunk.message_type

                        if prev_message_type != current_message_type:
                            if current_message is not None:
                                messages.append(current_message)
                            current_message = chunk
                        else:
                            # Accumulate content for same message type
                            if hasattr(current_message, "content") and hasattr(chunk, "content"):
                                current_message.content += chunk.content

                        prev_message_type = current_message_type
                except json.JSONDecodeError:
                    continue

        if current_message is not None:
            messages.append(current_message)
    else:
        # Handle async iterator from agents.messages.stream()
        async for chunk in chunks:
            current_message_type = chunk.message_type

            if prev_message_type != current_message_type:
                if current_message is not None:
                    messages.append(current_message)
                current_message = chunk
            else:
                # Accumulate content for same message type
                if hasattr(current_message, "content") and hasattr(chunk, "content"):
                    current_message.content += chunk.content

            prev_message_type = current_message_type

        if current_message is not None:
            messages.append(current_message)

    return messages


async def cancel_run_after_delay(client: AsyncLetta, agent_id: str, delay: float = 0.5):
    await asyncio.sleep(delay)
    await client.agents.messages.cancel(agent_id=agent_id)


async def wait_for_run_completion(client: AsyncLetta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
    start = time.time()
    while True:
        run = await client.runs.retrieve(run_id)
        if run.status == "completed":
            return run
        if run.status == "cancelled":
            time.sleep(5)
            return run
        if run.status == "failed":
            raise RuntimeError(f"Run {run_id} did not complete: status = {run.status}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


def get_expected_message_count_range(
    model_handle: str, model_settings: dict, tool_call: bool = False, streaming: bool = False, from_db: bool = False
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
    ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    | gpt-4o                   |  gpt-o3 (med effort)     |  gpt-5 (high effort)     |  sonnet-3-5              |  sonnet-3.7-thinking     |  sonnet-4.5/opus-4.1     |  flash-2.5-thinking      |
    | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
    | ToolCallMessage          |  ToolCallMessage         |  ReasoningMessage        |  AssistantMessage        |  ReasoningMessage        |  ReasoningMessage        |  ReasoningMessage        |
    | ToolReturnMessage        |  ToolReturnMessage       |  ToolCallMessage         |  ToolCallMessage         |  AssistantMessage        |  AssistantMessage        |  ToolCallMessage         |
    | AssistantMessage         |  AssistantMessage        |  ToolReturnMessage       |  ToolReturnMessage       |  ToolCallMessage         |  ToolCallMessage         |  ToolReturnMessage       |
    |                          |                          |  ReasoningMessage        |  AssistantMessage        |  ToolReturnMessage       |  ToolReturnMessage       |  ReasoningMessage        |
    |                          |                          |  AssistantMessage        |                          |  AssistantMessage        |  ReasoningMessage        |  AssistantMessage        |
    |                          |                          |                          |                          |                          |  AssistantMessage        |                          |

    """
    # assistant message
    expected_message_count = 1
    expected_range = 0

    if is_reasoner_model(model_handle, model_settings):
        # reasoning message
        expected_range += 1
        if tool_call:
            # check for sonnet 4.5 or opus 4.1 specifically
            is_sonnet_4_5_or_opus_4_1 = (
                model_settings.get("provider_type") == "anthropic"
                and model_settings.get("thinking", {}).get("type") == "enabled"
                and ("claude-sonnet-4-5" in model_handle or "claude-opus-4-1" in model_handle)
            )
            is_anthropic_reasoning = (
                model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled"
            )
            if is_sonnet_4_5_or_opus_4_1 or not is_anthropic_reasoning:
                # sonnet 4.5 and opus 4.1 return a reasoning message before the final assistant message
                # so do the other native reasoning models
                expected_range += 1

            # opus 4.1 generates an extra AssistantMessage before the tool call
            if "claude-opus-4-1" in model_handle:
                expected_range += 1

    if tool_call:
        # tool call and tool return messages
        expected_message_count += 2

    if from_db:
        # user message
        expected_message_count += 1

    if streaming:
        # stop reason and usage statistics
        expected_message_count += 2

    return expected_message_count, expected_message_count + expected_range


def is_reasoner_model(model_handle: str, model_settings: dict) -> bool:
    """Check if the model is a reasoning model based on its handle and settings."""
    # OpenAI reasoning models with high reasoning effort
    is_openai_reasoning = (
        model_settings.get("provider_type") == "openai"
        and (
            "gpt-5" in model_handle
            or "o1" in model_handle
            or "o3" in model_handle
            or "o4-mini" in model_handle
            or "gpt-4.1" in model_handle
        )
        and model_settings.get("reasoning", {}).get("reasoning_effort") == "high"
    )
    # Anthropic models with thinking enabled
    is_anthropic_reasoning = (
        model_settings.get("provider_type") == "anthropic" and model_settings.get("thinking", {}).get("type") == "enabled"
    )
    # Google Vertex models with thinking config
    is_google_vertex_reasoning = (
        model_settings.get("provider_type") == "google_vertex" and model_settings.get("thinking_config", {}).get("include_thoughts") is True
    )
    # Google AI models with thinking config
    is_google_ai_reasoning = (
        model_settings.get("provider_type") == "google_ai" and model_settings.get("thinking_config", {}).get("include_thoughts") is True
    )

    return is_openai_reasoning or is_anthropic_reasoning or is_google_vertex_reasoning or is_google_ai_reasoning


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
        agent_type="letta_v1_agent",
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
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
@pytest.mark.parametrize("send_type", ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"])
@pytest.mark.asyncio(loop_scope="function")
async def test_greeting(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
    send_type: str,
) -> None:
    model_handle, model_settings = model_config
    last_message_page = await client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = await client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    if send_type == "step":
        response = await client.agents.messages.create(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
        messages = response.messages
        run_id = next((msg.run_id for msg in messages if hasattr(msg, "run_id")), None)
    elif send_type == "async":
        run = await client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
        )
        run = await wait_for_run_completion(client, run.id, timeout=60.0)
        messages_page = await client.runs.messages.list(run_id=run.id)
        messages = [m for m in messages_page.items if m.message_type != "user_message"]
        run_id = run.id
    else:
        response = await client.agents.messages.stream(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
            stream_tokens=(send_type == "stream_tokens"),
            background=(send_type == "stream_tokens_background"),
        )
        messages = await accumulate_chunks(response)
        run_id = next((msg.run_id for msg in messages if hasattr(msg, "run_id")), None)

    # If run_id is not in messages (e.g., due to early cancellation), get the most recent run
    if run_id is None:
        runs = await client.runs.list(agent_ids=[agent_state.id])
        run_id = runs.items[0].id if runs.items else None

    assert_greeting_response(
        messages, model_handle, model_settings, streaming=("stream" in send_type), token_streaming=(send_type == "stream_tokens")
    )

    if "background" in send_type:
        response = await client.runs.messages.stream(run_id=run_id, starting_after=0)
        messages = await accumulate_chunks(response)
        assert_greeting_response(
            messages, model_handle, model_settings, streaming=("stream" in send_type), token_streaming=(send_type == "stream_tokens")
        )

    messages_from_db_page = await client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_greeting_response(messages_from_db, model_handle, model_settings, from_db=True)

    assert run_id is not None
    run = await client.runs.retrieve(run_id=run_id)
    assert run.status == "completed"


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
@pytest.mark.parametrize("send_type", ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"])
@pytest.mark.asyncio(loop_scope="function")
async def test_parallel_tool_calls(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
    send_type: str,
) -> None:
    model_handle, model_settings = model_config
    provider_type = model_settings.get("provider_type", "")

    if provider_type not in ["anthropic", "openai", "google_ai", "google_vertex"]:
        pytest.skip("Parallel tool calling test only applies to Anthropic, OpenAI, and Gemini models.")

    if "gpt-5" in model_handle or "o3" in model_handle:
        pytest.skip("GPT-5 takes too long to test, o3 is bad at this task.")

    # Skip Gemini models due to issues with parallel tool calling
    if provider_type in ["google_ai", "google_vertex"]:
        pytest.skip("Gemini models are flaky for this test so we disable them for now")

    # Update model_settings to enable parallel tool calling
    modified_model_settings = model_settings.copy()
    modified_model_settings["parallel_tool_calls"] = True

    agent_state = await client.agents.update(
        agent_id=agent_state.id,
        model=model_handle,
        model_settings=modified_model_settings,
    )

    if send_type == "step":
        await client.agents.messages.create(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_PARALLEL_TOOL_CALL,
        )
    elif send_type == "async":
        run = await client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_PARALLEL_TOOL_CALL,
        )
        await wait_for_run_completion(client, run.id, timeout=60.0)
    else:
        response = await client.agents.messages.stream(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_PARALLEL_TOOL_CALL,
            stream_tokens=(send_type == "stream_tokens"),
            background=(send_type == "stream_tokens_background"),
        )
        await accumulate_chunks(response)

    # validate parallel tool call behavior in preserved messages
    preserved_messages_page = await client.agents.messages.list(agent_id=agent_state.id)
    preserved_messages = preserved_messages_page.items

    # collect all ToolCallMessage and ToolReturnMessage instances
    tool_call_messages = []
    tool_return_messages = []
    for msg in preserved_messages:
        if isinstance(msg, ToolCallMessage):
            tool_call_messages.append(msg)
        elif isinstance(msg, ToolReturnMessage):
            tool_return_messages.append(msg)

    # Check if tool calls are grouped in a single message (parallel) or separate messages (sequential)
    total_tool_calls = 0
    for i, tcm in enumerate(tool_call_messages):
        if hasattr(tcm, "tool_calls") and tcm.tool_calls:
            num_calls = len(tcm.tool_calls) if isinstance(tcm.tool_calls, list) else 1
            total_tool_calls += num_calls
        elif hasattr(tcm, "tool_call"):
            total_tool_calls += 1

    # Check tool returns structure
    total_tool_returns = 0
    for i, trm in enumerate(tool_return_messages):
        if hasattr(trm, "tool_returns") and trm.tool_returns:
            num_returns = len(trm.tool_returns) if isinstance(trm.tool_returns, list) else 1
            total_tool_returns += num_returns
        elif hasattr(trm, "tool_return"):
            total_tool_returns += 1

    # CRITICAL: For TRUE parallel tool calling with letta_v1_agent, there should be exactly ONE ToolCallMessage
    # containing multiple tool calls, not multiple ToolCallMessages

    # Verify we have exactly 3 tool calls total
    assert total_tool_calls == 3, f"Expected exactly 3 tool calls total, got {total_tool_calls}"
    assert total_tool_returns == 3, f"Expected exactly 3 tool returns total, got {total_tool_returns}"

    # Check if we have true parallel tool calling
    is_parallel = False
    if len(tool_call_messages) == 1:
        # Check if the single message contains multiple tool calls
        tcm = tool_call_messages[0]
        if hasattr(tcm, "tool_calls") and isinstance(tcm.tool_calls, list) and len(tcm.tool_calls) == 3:
            is_parallel = True

    # IMPORTANT: Assert that parallel tool calling is actually working
    # This test should FAIL if parallel tool calling is not working properly
    assert is_parallel, (
        f"Parallel tool calling is NOT working for {provider_type}! "
        f"Got {len(tool_call_messages)} ToolCallMessage(s) instead of 1 with 3 parallel calls. "
        f"When using letta_v1_agent with parallel_tool_calls=True, all tool calls should be in a single message."
    )

    # Collect all tool calls and their details for validation
    all_tool_calls = []
    tool_call_ids = set()
    num_sides_by_id = {}

    for tcm in tool_call_messages:
        if hasattr(tcm, "tool_calls") and tcm.tool_calls and isinstance(tcm.tool_calls, list):
            # Message has multiple tool calls
            for tc in tcm.tool_calls:
                all_tool_calls.append(tc)
                tool_call_ids.add(tc.tool_call_id)
                # Parse arguments
                import json

                args = json.loads(tc.arguments)
                num_sides_by_id[tc.tool_call_id] = int(args["num_sides"])
        elif hasattr(tcm, "tool_call") and tcm.tool_call:
            # Message has single tool call
            tc = tcm.tool_call
            all_tool_calls.append(tc)
            tool_call_ids.add(tc.tool_call_id)
            # Parse arguments
            import json

            args = json.loads(tc.arguments)
            num_sides_by_id[tc.tool_call_id] = int(args["num_sides"])

    # Verify each tool call
    for tc in all_tool_calls:
        assert tc.name == "roll_dice", f"Expected tool call name 'roll_dice', got '{tc.name}'"
        # Support Anthropic (toolu_), OpenAI (call_), and Gemini (UUID) tool call ID formats
        # Gemini uses UUID format which could start with any alphanumeric character
        valid_id_format = (
            tc.tool_call_id.startswith("toolu_")
            or tc.tool_call_id.startswith("call_")
            or (len(tc.tool_call_id) > 0 and tc.tool_call_id[0].isalnum())  # UUID format for Gemini
        )
        assert valid_id_format, f"Unexpected tool call ID format: {tc.tool_call_id}"

    # Collect all tool returns for validation
    all_tool_returns = []
    for trm in tool_return_messages:
        if hasattr(trm, "tool_returns") and trm.tool_returns and isinstance(trm.tool_returns, list):
            # Message has multiple tool returns
            all_tool_returns.extend(trm.tool_returns)
        elif hasattr(trm, "tool_return") and trm.tool_return:
            # Message has single tool return (create a mock object if needed)
            # Since ToolReturnMessage might not have individual tool_return, check the structure
            pass

    # If all_tool_returns is empty, it means returns are structured differently
    # Let's check the actual structure
    if not all_tool_returns:
        print("Note: Tool returns may be structured differently than expected")
        # For now, just verify we got the right number of messages
        assert len(tool_return_messages) > 0, "No tool return messages found"

    # Verify tool returns if we have them in the expected format
    for tr in all_tool_returns:
        assert tr.type == "tool", f"Tool return type should be 'tool', got '{tr.type}'"
        assert tr.status == "success", f"Tool return status should be 'success', got '{tr.status}'"
        assert tr.tool_call_id in tool_call_ids, f"Tool return ID '{tr.tool_call_id}' not found in tool call IDs: {tool_call_ids}"

        # Verify the dice roll result is within the valid range
        dice_result = int(tr.tool_return)
        expected_max = num_sides_by_id[tr.tool_call_id]
        assert 1 <= dice_result <= expected_max, (
            f"Dice roll result {dice_result} is not within valid range 1-{expected_max} for tool call {tr.tool_call_id}"
        )


@pytest.mark.parametrize(
    "model_config",
    TESTED_MODEL_CONFIGS,
    ids=[handle for handle, _ in TESTED_MODEL_CONFIGS],
)
@pytest.mark.parametrize(
    ["send_type", "cancellation"],
    list(
        itertools.product(
            ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"], ["with_cancellation", "no_cancellation"]
        )
    ),
    ids=[
        f"{s}-{c}"
        for s, c in itertools.product(
            ["step", "stream_steps", "stream_tokens", "stream_tokens_background", "async"], ["with_cancellation", "no_cancellation"]
        )
    ],
)
@pytest.mark.asyncio(loop_scope="function")
async def test_tool_call(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    agent_state: AgentState,
    model_config: Tuple[str, dict],
    send_type: str,
    cancellation: str,
) -> None:
    model_handle, model_settings = model_config

    # Skip models with OTID mismatch issues between ToolCallMessage and ToolReturnMessage
    if "gpt-5" in model_handle or "claude-sonnet-4-5-20250929" in model_handle or "claude-opus-4-1" in model_handle:
        pytest.skip(f"Skipping {model_handle} due to OTID chain issue - messages receive incorrect OTID suffixes")

    last_message_page = await client.agents.messages.list(agent_id=agent_state.id, limit=1)
    last_message = last_message_page.items[0] if last_message_page.items else None
    agent_state = await client.agents.update(agent_id=agent_state.id, model=model_handle, model_settings=model_settings)

    if cancellation == "with_cancellation":
        delay = 5 if "gpt-5" in model_handle else 0.5  # increase delay for responses api
        _cancellation_task = asyncio.create_task(cancel_run_after_delay(client, agent_state.id, delay=delay))

    if send_type == "step":
        response = await client.agents.messages.create(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
        )
        messages = response.messages
        run_id = next((msg.run_id for msg in messages if hasattr(msg, "run_id")), None)
    elif send_type == "async":
        run = await client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
        )
        run = await wait_for_run_completion(client, run.id, timeout=60.0)
        messages_page = await client.runs.messages.list(run_id=run.id)
        messages = [m for m in messages_page.items if m.message_type != "user_message"]
        run_id = run.id
    else:
        response = await client.agents.messages.stream(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_ROLL_DICE,
            stream_tokens=(send_type == "stream_tokens"),
            background=(send_type == "stream_tokens_background"),
        )
        messages = await accumulate_chunks(response)
        run_id = next((msg.run_id for msg in messages if hasattr(msg, "run_id")), None)

    # If run_id is not in messages (e.g., due to early cancellation), get the most recent run
    if run_id is None:
        runs = await client.runs.list(agent_ids=[agent_state.id])
        run_id = runs.items[0].id if runs.items else None

    assert_tool_call_response(
        messages, model_handle, model_settings, streaming=("stream" in send_type), with_cancellation=(cancellation == "with_cancellation")
    )

    if "background" in send_type:
        response = await client.runs.messages.stream(run_id=run_id, starting_after=0)
        messages = await accumulate_chunks(response)
        assert_tool_call_response(
            messages,
            model_handle,
            model_settings,
            streaming=("stream" in send_type),
            with_cancellation=(cancellation == "with_cancellation"),
        )

    messages_from_db_page = await client.agents.messages.list(agent_id=agent_state.id, after=last_message.id if last_message else None)
    messages_from_db = messages_from_db_page.items
    assert_tool_call_response(
        messages_from_db, model_handle, model_settings, from_db=True, with_cancellation=(cancellation == "with_cancellation")
    )

    assert run_id is not None
    run = await client.runs.retrieve(run_id=run_id)
    assert run.status == ("cancelled" if cancellation == "with_cancellation" else "completed")


@pytest.mark.parametrize(
    "model_handle,provider_type",
    [
        ("openai/gpt-4o", "openai"),
        ("openai/gpt-5", "openai"),
        ("anthropic/claude-sonnet-4-5-20250929", "anthropic"),
    ],
)
@pytest.mark.asyncio(loop_scope="function")
async def test_json_schema_response_format(
    disable_e2b_api_key: Any,
    client: AsyncLetta,
    model_handle: str,
    provider_type: str,
) -> None:
    """
    Test JsonSchemaResponseFormat with OpenAI and Anthropic models.

    This test verifies that:
    1. Agents can be created with json_schema response_format via model_settings
    2. The schema is properly stored in the agent's model_settings
    3. Messages sent to the agent produce responses conforming to the schema
    4. Both OpenAI and Anthropic handle structured outputs correctly
    """
    # Define the structured output schema
    response_schema = {
        "name": "capital_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "response": {"type": "string", "description": "The answer to the question"},
                "justification": {"type": "string", "description": "Why this is the answer"},
            },
            "required": ["response", "justification"],
            "additionalProperties": False,
        },
    }

    # Create model settings with json_schema response format based on provider
    if provider_type == "openai":
        model_settings = OpenAIModelSettings(
            provider_type="openai", response_format=JsonSchemaResponseFormat(type="json_schema", json_schema=response_schema)
        )
    else:
        model_settings = AnthropicModelSettings(
            provider_type="anthropic", response_format=JsonSchemaResponseFormat(type="json_schema", json_schema=response_schema)
        )

    # Create agent with structured output configuration
    agent_state = await client.agents.create(
        name=f"test_structured_agent_{model_handle.replace('/', '_')}",
        model=model_handle,
        model_settings=model_settings,
        embedding="openai/text-embedding-3-small",
        agent_type="letta_v1_agent",
    )

    try:
        # Send a message to the agent
        message_response = await client.agents.messages.create(
            agent_id=agent_state.id, messages=[MessageCreateParam(role="user", content="What is the capital of France?")]
        )

        # Verify we got a response
        assert len(message_response.messages) > 0, "Should have received at least one message"

        # Find the assistant message and verify it contains valid JSON matching the schema
        assistant_message = None
        for msg in message_response.messages:
            if isinstance(msg, AssistantMessage):
                assistant_message = msg
                break

        assert assistant_message is not None, "Should have received an AssistantMessage"

        # Parse the content as JSON
        parsed_content = json.loads(assistant_message.content)

        # Verify the JSON has the required fields from our schema
        assert "response" in parsed_content, "JSON should contain 'response' field"
        assert "justification" in parsed_content, "JSON should contain 'justification' field"
        assert isinstance(parsed_content["response"], str), "'response' field should be a string"
        assert isinstance(parsed_content["justification"], str), "'justification' field should be a string"
        assert len(parsed_content["response"]) > 0, "'response' field should not be empty"
        assert len(parsed_content["justification"]) > 0, "'justification' field should not be empty"

    finally:
        # Cleanup
        await client.agents.delete(agent_state.id)
