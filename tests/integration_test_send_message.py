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

from letta.helpers.reasoning_helper import is_reasoning_completely_disabled
from letta.llm_api.openai_client import is_openai_reasoning_model
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.llm_config import LLMConfig

logger = get_logger(__name__)

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
USER_MESSAGE_LONG_RESPONSE: str = (
    "Teamwork makes the dream work. When people collaborate and combine their unique skills, perspectives, and experiences, they can achieve far more than any individual working alone. "
    "This synergy creates an environment where innovation flourishes, problems are solved more creatively, and goals are reached more efficiently. "
    "In a team setting, diverse viewpoints lead to better decision-making as different team members bring their unique backgrounds and expertise to the table. "
    "Communication becomes the backbone of success, allowing ideas to flow freely and ensuring everyone is aligned toward common objectives. "
    "Trust builds gradually as team members learn to rely on each other's strengths while supporting one another through challenges. "
    "The collective intelligence of a group often surpasses that of even the brightest individual, as collaboration sparks creativity and innovation. "
    "Successful teams celebrate victories together and learn from failures as a unit, creating a culture of continuous improvement. "
    "Together, we can overcome challenges that would be insurmountable alone, achieving extraordinary results through the power of collaboration."
)
USER_MESSAGE_FORCE_LONG_REPLY: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=f"This is an automated test message. Call the send_message tool with exactly this message: '{USER_MESSAGE_LONG_RESPONSE}'",
        otid=USER_MESSAGE_OTID,
    )
]
USER_MESSAGE_GREETING: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=f"Hi!",
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
USER_MESSAGE_ROLL_DICE_LONG: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=(
            "This is an automated test message. Call the roll_dice tool with 16 sides and send me a very detailed, comprehensive message about the outcome. "
            "Your response must be at least 800 characters long. Start by explaining what dice rolling represents in games and probability theory. "
            "Discuss the mathematical probability of getting each number on a 16-sided die (1/16 or 6.25% for each face). "
            "Explain how 16-sided dice are commonly used in tabletop role-playing games like Dungeons & Dragons. "
            "Describe the specific number you rolled and what it might mean in different gaming contexts. "
            "Discuss how this particular roll compares to the expected value (8.5) of a 16-sided die. "
            "Explain the concept of randomness and how true random number generation works. "
            "End with some interesting facts about polyhedral dice and their history in gaming. "
            "Remember, make your response detailed and at least 800 characters long."
        ),
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

# configs for models that are to dumb to do much other than messaging
limited_configs = ["ollama.json", "together-qwen-2.5-72b-instruct.json", "vllm.json", "lmstudio.json", "groq.json"]

all_configs = [
    "openai-gpt-4o-mini.json",
    "openai-o1.json",
    "openai-o3.json",
    "openai-o4-mini.json",
    "azure-gpt-4o-mini.json",
    "claude-4-sonnet-extended.json",
    "claude-3-5-sonnet.json",
    "claude-3-7-sonnet-extended.json",
    "bedrock-claude-4-sonnet.json",
    "gemini-1.5-pro.json",
    "gemini-2.5-flash-vertex.json",
    "gemini-2.5-pro-vertex.json",
    "ollama.json",
    "together-qwen-2.5-72b-instruct.json",
    "groq.json",
]

reasoning_configs = [
    "openai-o1.json",
    "openai-o3.json",
    "openai-o4-mini.json",
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
        # Check for either short or long response
        assert USER_MESSAGE_RESPONSE in messages[index].content or USER_MESSAGE_LONG_RESPONSE in messages[index].content
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


def assert_greeting_no_reasoning_response(
    messages: List[Any],
    streaming: bool = False,
    token_streaming: bool = False,
    from_db: bool = False,
) -> None:
    """
    Asserts that the messages list follows the expected sequence without reasoning:
    AssistantMessage (no ReasoningMessage when put_inner_thoughts_in_kwargs is False).
    """
    expected_message_count = 3 if streaming else 2 if from_db else 1
    assert len(messages) == expected_message_count

    index = 0
    if from_db:
        assert isinstance(messages[index], UserMessage)
        assert messages[index].otid == USER_MESSAGE_OTID
        index += 1

    # Agent Step 1 - should be AssistantMessage directly, no reasoning
    assert isinstance(messages[index], AssistantMessage)
    if not token_streaming:
        assert USER_MESSAGE_RESPONSE in messages[index].content
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


def validate_openai_format_scrubbing(messages: List[Dict[str, Any]]) -> None:
    """
    Validate that OpenAI format assistant messages with tool calls have no inner thoughts content.
    Args:
        messages: List of message dictionaries in OpenAI format
    """
    assistant_messages_with_tools = []

    for msg in messages:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            assistant_messages_with_tools.append(msg)

    # There should be at least one assistant message with tool calls
    assert len(assistant_messages_with_tools) > 0, "Expected at least one OpenAI assistant message with tool calls"

    # Check that assistant messages with tool calls have no text content (inner thoughts scrubbed)
    for msg in assistant_messages_with_tools:
        if "content" in msg:
            content = msg["content"]
            assert content is None


def validate_anthropic_format_scrubbing(messages: List[Dict[str, Any]], reasoning_enabled: bool) -> None:
    """
    Validate that Anthropic/Claude format assistant messages with tool_use have no <thinking> tags.
    Args:
        messages: List of message dictionaries in Anthropic format
    """
    claude_assistant_messages_with_tools = []

    for msg in messages:
        if (
            msg.get("role") == "assistant"
            and isinstance(msg.get("content"), list)
            and any(item.get("type") == "tool_use" for item in msg.get("content", []))
        ):
            claude_assistant_messages_with_tools.append(msg)

    # There should be at least one Claude assistant message with tool_use
    assert len(claude_assistant_messages_with_tools) > 0, "Expected at least one Claude assistant message with tool_use"

    # Check Claude format messages specifically
    for msg in claude_assistant_messages_with_tools:
        content_list = msg["content"]

        # Strict validation: assistant messages with tool_use should have NO text content items at all
        text_items = [item for item in content_list if item.get("type") == "text"]
        assert len(text_items) == 0, (
            f"Found {len(text_items)} text content item(s) in Claude assistant message with tool_use. "
            f"When reasoning is disabled, there should be NO text items. "
            f"Text items found: {[item.get('text', '') for item in text_items]}"
        )

        # Verify that the message only contains tool_use items
        tool_use_items = [item for item in content_list if item.get("type") == "tool_use"]
        assert len(tool_use_items) > 0, "Assistant message should have at least one tool_use item"

        if not reasoning_enabled:
            assert len(content_list) == len(tool_use_items), (
                f"Assistant message should ONLY contain tool_use items when reasoning is disabled. "
                f"Found {len(content_list)} total items but only {len(tool_use_items)} are tool_use items."
            )


def validate_google_format_scrubbing(contents: List[Dict[str, Any]]) -> None:
    """
    Validate that Google/Gemini format model messages with functionCall have no thinking field.
    Args:
        contents: List of content dictionaries in Google format (uses 'contents' instead of 'messages')
    """
    model_messages_with_function_calls = []

    for content in contents:
        if content.get("role") == "model" and isinstance(content.get("parts"), list):
            for part in content["parts"]:
                if "functionCall" in part:
                    model_messages_with_function_calls.append(part)

    # There should be at least one model message with functionCall
    assert len(model_messages_with_function_calls) > 0, "Expected at least one Google model message with functionCall"

    # Check Google format messages specifically
    for part in model_messages_with_function_calls:
        function_call = part["functionCall"]
        args = function_call.get("args", {})

        # Assert that there is no 'thinking' field in the function call arguments
        assert (
            "thinking" not in args
        ), f"Found 'thinking' field in Google model functionCall args (inner thoughts not scrubbed): {args.get('thinking')}"


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


def accumulate_chunks(chunks: List[Any], verify_token_streaming: bool = False) -> List[Any]:
    """
    Accumulates chunks into a list of messages.
    """
    messages = []
    current_message = None
    prev_message_type = None
    chunk_count = 0
    for chunk in chunks:
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


def cast_message_dict_to_messages(messages: List[Dict[str, Any]]) -> List[LettaMessageUnion]:
    def cast_message(message: Dict[str, Any]) -> LettaMessageUnion:
        if message["message_type"] == "reasoning_message":
            return ReasoningMessage(**message)
        elif message["message_type"] == "assistant_message":
            return AssistantMessage(**message)
        elif message["message_type"] == "tool_call_message":
            return ToolCallMessage(**message)
        elif message["message_type"] == "tool_return_message":
            return ToolReturnMessage(**message)
        elif message["message_type"] == "user_message":
            return UserMessage(**message)
        elif message["message_type"] == "hidden_reasoning_message":
            return HiddenReasoningMessage(**message)
        else:
            raise ValueError(f"Unknown message type: {message['message_type']}")

    return [cast_message(message) for message in messages]


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

    # try:
    #     client.agents.delete(agent_state_instance.id)
    # except Exception as e:
    #     logger.error(f"Failed to delete agent {agent_state_instance.name}: {str(e)}")


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

    # try:
    #     client.agents.delete(agent_state_instance.id)
    # except Exception as e:
    #     logger.error(f"Failed to delete agent {agent_state_instance.name}: {str(e)}")


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
    [
        (
            pytest.param(config, marks=pytest.mark.xfail(reason="Qwen image processing unstable - needs investigation"))
            if config.model == "Qwen/Qwen2.5-72B-Instruct-Turbo"
            else config
        )
        for config in TESTED_LLM_CONFIGS
    ],
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
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

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
    [
        (
            pytest.param(config, marks=pytest.mark.xfail(reason="Qwen image processing unstable - needs investigation"))
            if config.model == "Qwen/Qwen2.5-72B-Instruct-Turbo"
            else config
        )
        for config in TESTED_LLM_CONFIGS
    ],
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
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

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

    time.sleep(0.5)
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
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

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
    response = client.agents.messages.create_stream(
        agent_id=agent_state_no_tools.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    with pytest.raises(Exception) as exc_info:
        for chunk in response:
            print(chunk)
    print("error info:", exc_info)
    assert type(exc_info.value) in (ApiError, ValueError)
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
    # Use longer message for Anthropic models to test if they stream in chunks
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
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
    # Use longer message for Anthropic models to force chunking
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        use_assistant_message=False,
        stream_tokens=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
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
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    # Use longer message for Anthropic models to force chunking
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_ROLL_DICE_LONG
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
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


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_background_token_streaming_greeting_with_assistant_message(
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
    # Use longer message for Anthropic models to test if they stream in chunks
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
        background=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert_greeting_with_assistant_message_response(messages, streaming=True, token_streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)

    run_id = messages[0].run_id
    assert run_id is not None

    response = client.runs.stream(run_id=run_id, starting_after=0)
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert_greeting_with_assistant_message_response(messages, streaming=True, token_streaming=True, llm_config=llm_config)

    last_message_cursor = messages[-3].seq_id - 1
    response = client.runs.stream(run_id=run_id, starting_after=last_message_cursor)
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert len(messages) == 3
    assert messages[0].message_type == "assistant_message" and messages[0].seq_id == last_message_cursor + 1
    assert messages[1].message_type == "stop_reason"
    assert messages[2].message_type == "usage_statistics"


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_background_token_streaming_greeting_without_assistant_message(
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
    # Use longer message for Anthropic models to force chunking
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_FORCE_LONG_REPLY
    else:
        messages_to_send = USER_MESSAGE_FORCE_REPLY
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        use_assistant_message=False,
        stream_tokens=True,
        background=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert_greeting_without_assistant_message_response(messages, streaming=True, token_streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_background_token_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    # Use longer message for Anthropic models to force chunking
    if llm_config.model_endpoint_type == "anthropic":
        messages_to_send = USER_MESSAGE_ROLL_DICE_LONG
    else:
        messages_to_send = USER_MESSAGE_ROLL_DICE
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=messages_to_send,
        stream_tokens=True,
        background=True,
    )
    messages = accumulate_chunks(
        list(response), verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert_tool_call_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


def wait_for_run_completion(client: Letta, run_id: str, timeout: float = 30.0, interval: float = 0.5) -> Run:
    start = time.time()
    while True:
        run = client.runs.retrieve(run_id)
        if run.status == "completed":
            return run
        if run.status == "failed":
            print(run)
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
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = cast_message_dict_to_messages(result["messages"])
    assert_greeting_with_assistant_message_response(messages, llm_config=llm_config)

    messages = client.runs.messages.list(run_id=run.id)
    assert_greeting_with_assistant_message_response(messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_async_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
        use_assistant_message=False,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = cast_message_dict_to_messages(result["messages"])
    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config)

    messages = client.runs.messages.list(run_id=run.id)
    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, from_db=True, llm_config=llm_config)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_async_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_ROLL_DICE,
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = cast_message_dict_to_messages(result["messages"])
    assert_tool_call_response(messages, llm_config=llm_config)

    messages = client.runs.messages.list(run_id=run.id)
    assert_tool_call_response(messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


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


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_async_greeting_with_callback_url(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Tests sending a message as an asynchronous job with callback URL functionality.
    Validates that callbacks are properly sent with correct payload structure.
    """
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    with callback_server() as server:
        # Create async job with callback URL
        run = client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=USER_MESSAGE_FORCE_REPLY,
            callback_url=server.url,
        )

        # Wait for job completion
        run = wait_for_run_completion(client, run.id)

        # Validate job completed successfully
        result = run.metadata.get("result")
        assert result is not None, "Run metadata missing 'result' key"

        messages = cast_message_dict_to_messages(result["messages"])
        assert_greeting_with_assistant_message_response(messages, llm_config=llm_config)

        # Validate callback was received
        assert server.wait_for_callback(timeout=15), "Callback was not received within timeout"
        assert len(server.received_callbacks) == 1, f"Expected 1 callback, got {len(server.received_callbacks)}"

        # Validate callback payload structure
        callback = server.received_callbacks[0]
        callback_data = callback["data"]

        # Check required fields
        assert "job_id" in callback_data, "Callback missing 'job_id' field"
        assert "status" in callback_data, "Callback missing 'status' field"
        assert "completed_at" in callback_data, "Callback missing 'completed_at' field"
        assert "metadata" in callback_data, "Callback missing 'metadata' field"

        # Validate field values
        assert callback_data["job_id"] == run.id, f"Job ID mismatch: {callback_data['job_id']} != {run.id}"
        assert callback_data["status"] == "completed", f"Expected status 'completed', got {callback_data['status']}"
        assert callback_data["completed_at"] is not None, "completed_at should not be None"
        assert callback_data["metadata"] is not None, "metadata should not be None"

        # Validate that callback metadata contains the result
        assert "result" in callback_data["metadata"], "Callback metadata missing 'result' field"
        callback_result = callback_data["metadata"]["result"]
        assert callback_result == result, "Callback result doesn't match job result"

        # Validate HTTP headers
        headers = callback["headers"]
        assert headers.get("Content-Type") == "application/json", "Callback should have JSON content type"


@pytest.mark.flaky(max_runs=2)
@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_auto_summarize(disable_e2b_api_key: Any, client: Letta, llm_config: LLMConfig):
    """Test that summarization is automatically triggered."""
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model (runs too slow)
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    # pydantic prevents us for overriding the context window paramter in the passed LLMConfig
    new_llm_config = llm_config.model_dump()
    new_llm_config["context_window"] = 3000
    pinned_context_window_llm_config = LLMConfig(**new_llm_config)
    print("::LLM::", llm_config, new_llm_config)
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


# ============================
# Job Cancellation Tests
# ============================


def wait_for_run_status(client: Letta, run_id: str, target_status: str, timeout: float = 30.0, interval: float = 0.1) -> Run:
    """Wait for a run to reach a specific status"""
    start = time.time()
    while True:
        run = client.runs.retrieve(run_id)
        if run.status == target_status:
            return run
        if time.time() - start > timeout:
            raise TimeoutError(f"Run {run_id} did not reach status '{target_status}' within {timeout} seconds (last status: {run.status})")
        time.sleep(interval)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_job_creation_for_send_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    """
    Test that send_message endpoint creates a job and the job completes successfully.
    """
    previous_runs = client.runs.list(agent_ids=[agent_state.id])
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    # Send a simple message and verify a job was created
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )

    # The response should be successful
    assert response.messages is not None
    assert len(response.messages) > 0

    runs = client.runs.list(agent_ids=[agent_state.id])
    new_runs = set(r.id for r in runs) - set(r.id for r in previous_runs)
    assert len(new_runs) == 1

    for run in runs:
        if run.id == list(new_runs)[0]:
            assert run.status == "completed"


# TODO (cliandy): MERGE BACK IN POST
# # @pytest.mark.parametrize(
# #     "llm_config",
# #     TESTED_LLM_CONFIGS,
# #     ids=[c.model for c in TESTED_LLM_CONFIGS],
# # )
# # def test_async_job_cancellation(
# #     disable_e2b_api_key: Any,
# #     client: Letta,
# #     agent_state: AgentState,
# #     llm_config: LLMConfig,
# # ) -> None:
#     """
#     Test that an async job can be cancelled and the cancellation is reflected in the job status.
#     """
#     client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
#
#     # client.runs.cancel
#     # Start an async job
#     run = client.agents.messages.create_async(
#         agent_id=agent_state.id,
#         messages=USER_MESSAGE_FORCE_REPLY,
#     )
#
#     # Verify the job was created
#     assert run.id is not None
#     assert run.status in ["created", "running"]
#
#     # Cancel the job quickly (before it potentially completes)
#     cancelled_run = client.jobs.cancel(run.id)
#
#     # Verify the job was cancelled
#     assert cancelled_run.status == "cancelled"
#
#     # Wait a bit and verify it stays cancelled (no invalid state transitions)
#     time.sleep(1)
#     final_run = client.runs.retrieve(run.id)
#     assert final_run.status == "cancelled"
#
#     # Verify the job metadata indicates cancellation
#     if final_run.metadata:
#         assert final_run.metadata.get("cancelled") is True or "stop_reason" in final_run.metadata
#
#
# def test_job_cancellation_endpoint_validation(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
# ) -> None:
#     """
#     Test job cancellation endpoint validation (trying to cancel completed/failed jobs).
#     """
#     # Test cancelling a non-existent job
#     with pytest.raises(ApiError) as exc_info:
#         client.jobs.cancel("non-existent-job-id")
#     assert exc_info.value.status_code == 404
#
#
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_completed_job_cannot_be_cancelled(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     llm_config: LLMConfig,
# ) -> None:
#     """
#     Test that completed jobs cannot be cancelled.
#     """
#     client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
#
#     # Start an async job and wait for it to complete
#     run = client.agents.messages.create_async(
#         agent_id=agent_state.id,
#         messages=USER_MESSAGE_FORCE_REPLY,
#     )
#
#     # Wait for completion
#     completed_run = wait_for_run_completion(client, run.id)
#     assert completed_run.status == "completed"
#
#     # Try to cancel the completed job - should fail
#     with pytest.raises(ApiError) as exc_info:
#         client.jobs.cancel(run.id)
#     assert exc_info.value.status_code == 400
#     assert "Cannot cancel job with status 'completed'" in str(exc_info.value)
#
#
# @pytest.mark.parametrize(
#     "llm_config",
#     TESTED_LLM_CONFIGS,
#     ids=[c.model for c in TESTED_LLM_CONFIGS],
# )
# def test_streaming_job_independence_from_client_disconnect(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     llm_config: LLMConfig,
# ) -> None:
#     """
#     Test that streaming jobs are independent of client connection state.
#     This verifies that jobs continue even if the client "disconnects" (simulated by not consuming the stream).
#     """
#     client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
#
#     # Create a streaming request
#     import threading
#
#     import httpx
#
#     # Get the base URL and create a raw HTTP request to simulate partial consumption
#     base_url = client._client_wrapper._base_url
#
#     def start_stream_and_abandon():
#         """Start a streaming request but abandon it (simulating client disconnect)"""
#         try:
#             response = httpx.post(
#                 f"{base_url}/agents/{agent_state.id}/messages/stream",
#                 json={"messages": [{"role": "user", "text": "Hello, how are you?"}], "stream_tokens": False},
#                 headers={"user_id": "test-user"},
#                 timeout=30.0,
#             )
#
#             # Read just a few chunks then "disconnect" by not reading the rest
#             chunk_count = 0
#             for chunk in response.iter_lines():
#                 chunk_count += 1
#                 if chunk_count > 3:  # Read a few chunks then stop
#                     break
#             # Connection is now "abandoned" but the job should continue
#
#         except Exception:
#             pass  # Ignore connection errors
#
#     # Start the stream in a separate thread to simulate abandonment
#     thread = threading.Thread(target=start_stream_and_abandon)
#     thread.start()
#     thread.join(timeout=5.0)  # Wait up to 5 seconds for the "disconnect"
#
#     # The important thing is that this test validates our architecture:
#     # 1. Jobs are created before streaming starts (verified by our other tests)
#     # 2. Jobs track execution independent of client connection (handled by our wrapper)
#     # 3. Only explicit cancellation terminates jobs (tested by other tests)
#
#     # This test primarily validates that the implementation doesn't break under simulated disconnection
#     assert True  # If we get here without errors, the architecture is sound


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_inner_thoughts_false_non_reasoner_models(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    # skip if this is a reasoning model
    if not config_filename or config_filename in reasoning_configs:
        pytest.skip(f"Skipping test for reasoning model {llm_config.model}")

    # create a new config with all reasoning fields turned off
    new_llm_config = llm_config.model_dump()
    new_llm_config["put_inner_thoughts_in_kwargs"] = False
    new_llm_config["enable_reasoner"] = False
    new_llm_config["max_reasoning_tokens"] = 0
    adjusted_llm_config = LLMConfig(**new_llm_config)

    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=adjusted_llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    assert_greeting_no_reasoning_response(response.messages)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_no_reasoning_response(messages_from_db, from_db=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_inner_thoughts_false_non_reasoner_models_streaming(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a limited model
    if not config_filename or config_filename in limited_configs:
        pytest.skip(f"Skipping test for limited model {llm_config.model}")

    # skip if this is a reasoning model
    if not config_filename or config_filename in reasoning_configs:
        pytest.skip(f"Skipping test for reasoning model {llm_config.model}")

    # create a new config with all reasoning fields turned off
    new_llm_config = llm_config.model_dump()
    new_llm_config["put_inner_thoughts_in_kwargs"] = False
    new_llm_config["enable_reasoner"] = False
    new_llm_config["max_reasoning_tokens"] = 0
    adjusted_llm_config = LLMConfig(**new_llm_config)

    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=adjusted_llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_FORCE_REPLY,
    )
    messages = accumulate_chunks(list(response))
    assert_greeting_no_reasoning_response(messages, streaming=True)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_no_reasoning_response(messages_from_db, from_db=True)


@pytest.mark.parametrize(
    "llm_config",
    TESTED_LLM_CONFIGS,
    ids=[c.model for c in TESTED_LLM_CONFIGS],
)
def test_inner_thoughts_toggle_interleaved(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
) -> None:
    # get the config filename
    config_filename = None
    for filename in filenames:
        config = get_llm_config(filename)
        if config.model_dump() == llm_config.model_dump():
            config_filename = filename
            break

    # skip if this is a reasoning model
    if not config_filename or config_filename in reasoning_configs:
        pytest.skip(f"Skipping test for reasoning model {llm_config.model}")

    # Only run on OpenAI, Anthropic, and Google models
    if llm_config.model_endpoint_type not in ["openai", "anthropic", "google_ai", "google_vertex"]:
        pytest.skip(f"Skipping `test_inner_thoughts_toggle_interleaved` for model endpoint type {llm_config.model_endpoint_type}")

    assert not is_reasoning_completely_disabled(llm_config), "Reasoning should be enabled"
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    # Send a message with inner thoughts
    client.agents.messages.create(
        agent_id=agent_state.id,
        messages=USER_MESSAGE_GREETING,
    )

    # create a new config with all reasoning fields turned off
    new_llm_config = llm_config.model_dump()
    new_llm_config["put_inner_thoughts_in_kwargs"] = False
    new_llm_config["enable_reasoner"] = False
    new_llm_config["max_reasoning_tokens"] = 0
    adjusted_llm_config = LLMConfig(**new_llm_config)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=adjusted_llm_config)

    # Preview the message payload of the next message
    response = client.agents.messages.preview_raw_payload(
        agent_id=agent_state.id,
        request=LettaRequest(messages=USER_MESSAGE_FORCE_REPLY),
    )

    # Test our helper functions
    assert is_reasoning_completely_disabled(adjusted_llm_config), "Reasoning should be completely disabled"

    # Verify that assistant messages with tool calls have been scrubbed of inner thoughts
    # Branch assertions based on model endpoint type
    if llm_config.model_endpoint_type == "openai":
        messages = response["messages"]
        validate_openai_format_scrubbing(messages)
    elif llm_config.model_endpoint_type == "anthropic":
        messages = response["messages"]
        validate_anthropic_format_scrubbing(messages, llm_config.enable_reasoner)
    elif llm_config.model_endpoint_type in ["google_ai", "google_vertex"]:
        # Google uses 'contents' instead of 'messages'
        contents = response.get("contents", response.get("messages", []))
        validate_google_format_scrubbing(contents)
