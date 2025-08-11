import base64
import json
import os
import socket
import threading
import time
import uuid
from typing import Any, Dict, List

import httpx
import pytest
import requests
from dotenv import load_dotenv
from letta_client import Letta, MessageCreate, Run
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


def prefix_message_content_for_ollama(content: str, llm_config: LLMConfig) -> str:
    """
    Prefix message content with '/no_think' if model_endpoint is 'http://localhost:11434'
    """
    if llm_config.model_endpoint == "http://localhost:11434":
        return f"/no_think {content}"
    return content


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
def get_user_message_force_reply(llm_config: LLMConfig) -> List[MessageCreate]:
    content = f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'."
    content = prefix_message_content_for_ollama(content, llm_config)
    return [
        MessageCreate(
            role="user",
            content=content,
            otid=USER_MESSAGE_OTID,
        )
    ]


USER_MESSAGE_FORCE_REPLY: List[MessageCreate] = [
    MessageCreate(
        role="user",
        content=f"This is an automated test message. Call the send_message tool with the message '{USER_MESSAGE_RESPONSE}'.",
        otid=USER_MESSAGE_OTID,
    )
]
def get_user_message_roll_dice(llm_config: LLMConfig) -> List[MessageCreate]:
    content = "This is an automated test message. Call the roll_dice tool with 16 sides and send me a message with the outcome."
    content = prefix_message_content_for_ollama(content, llm_config)
    return [
        MessageCreate(
            role="user",
            content=content,
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
def get_user_message_url_image(llm_config: LLMConfig) -> List[MessageCreate]:
    text_content = "What is in this image?"
    text_content = prefix_message_content_for_ollama(text_content, llm_config)
    return [
        MessageCreate(
            role="user",
            content=[
                ImageContent(source=UrlImage(url=URL_IMAGE)),
                TextContent(text=text_content),
            ],
            otid=USER_MESSAGE_OTID,
        )
    ]


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
def get_user_message_base64_image(llm_config: LLMConfig) -> List[MessageCreate]:
    text_content = "What is in this image?"
    text_content = prefix_message_content_for_ollama(text_content, llm_config)
    return [
        MessageCreate(
            role="user",
            content=[
                ImageContent(source=Base64Image(data=BASE64_IMAGE, media_type="image/jpeg")),
                TextContent(text=text_content),
            ],
            otid=USER_MESSAGE_OTID,
        )
    ]


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
    if LLMConfig.is_reasoning_model(llm_config):
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
    if LLMConfig.is_reasoning_model(llm_config):
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
    if LLMConfig.is_reasoning_model(llm_config):
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
    if LLMConfig.is_reasoning_model(llm_config):
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
    if LLMConfig.is_reasoning_model(llm_config):
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
                assert chunk_count > 1, f"Expected more than one chunk for {current_message.message_type}"
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

    try:
        client.agents.delete(agent_state_instance.id)
    except Exception as e:
        logger.error(f"Failed to delete agent {agent_state_instance.name}: {str(e)}")


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

    try:
        client.agents.delete(agent_state_instance.id)
    except Exception as e:
        logger.error(f"Failed to delete agent {agent_state_instance.name}: {str(e)}")

# ------------------------------
# Test Cases
# ------------------------------

# def test_that_ci_workflow_works(
#     disable_e2b_api_key: Any,
#     client: Letta,
#     agent_state: AgentState,
#     llm_config: LLMConfig,
#     json_metadata: pytest.FixtureRequest,
# ) -> None:
#     """
#     Tests that the CI workflow works.
#     """
#     json_metadata["test_type"] = "debug"


def test_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    agent_state: AgentState,
    llm_config: LLMConfig,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
    )
    assert_greeting_with_assistant_message_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
        use_assistant_message=False,
    )
    assert_greeting_without_assistant_message_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    json_metadata["llm_config"] = dict(llm_config)
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=get_user_message_roll_dice(llm_config),
    )
    assert_tool_call_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_url_image_input(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=get_user_message_url_image(llm_config),
    )
    assert_image_input_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_image_input_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_base64_image_input(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that the response messages follow the expected order.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=get_user_message_base64_image(llm_config),
    )
    assert_image_input_response(response.messages, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_image_input_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    tools = agent_state.tools
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config, tool_ids=[])
    with pytest.raises(ApiError):
        client.agents.messages.create(
            agent_id=agent_state.id,
            messages=get_user_message_force_reply(llm_config),
        )
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert len(messages_from_db) == 0
    client.agents.modify(agent_id=agent_state.id, tool_ids=[t.id for t in tools])


def test_step_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, llm_config=llm_config, streaming=True)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_step_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
        use_assistant_message=False,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config, streaming=True)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_step_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    agent_state = client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_roll_dice(llm_config),
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_tool_call_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


def test_step_stream_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    tools = agent_state.tools
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config, tool_ids=[])
    with pytest.raises(ApiError):
        response = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=get_user_message_force_reply(llm_config),
        )
        list(response)

    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert len(messages_from_db) == 0
    client.agents.modify(agent_id=agent_state.id, tool_ids=[t.id for t in tools])


def test_token_streaming_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_with_assistant_message_response(messages, llm_config=llm_config, streaming=True, token_streaming=True)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_greeting_with_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_token_streaming_greeting_without_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
        use_assistant_message=False,
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(chunks)
    assert_greeting_without_assistant_message_response(messages, llm_config=llm_config, streaming=True, token_streaming=True)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id, use_assistant_message=False)
    assert_greeting_without_assistant_message_response(messages_from_db, llm_config=llm_config, from_db=True)


def test_token_streaming_tool_call(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a streaming message with a synchronous client.
    Checks that each chunk in the stream has the correct message types.
    """
    json_metadata["llm_config"] = dict(llm_config)
    dice_tool = client.tools.upsert_from_function(func=roll_dice)
    agent_state = client.agents.tools.attach(agent_id=agent_state.id, tool_id=dice_tool.id)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)
    response = client.agents.messages.create_stream(
        agent_id=agent_state.id,
        messages=get_user_message_roll_dice(llm_config),
        stream_tokens=True,
    )
    chunks = list(response)
    messages = accumulate_chunks(
        chunks, verify_token_streaming=(llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock"])
    )
    assert_tool_call_response(messages, streaming=True, llm_config=llm_config)
    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert_tool_call_response(messages_from_db, from_db=True, llm_config=llm_config)


def test_token_streaming_agent_loop_error(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message with a synchronous client.
    Verifies that no new messages are persisted on error.
    """
    json_metadata["llm_config"] = dict(llm_config)
    last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)
    tools = agent_state.tools
    agent_state = client.agents.modify(agent_id=agent_state.id, llm_config=llm_config, tool_ids=[])
    try:
        response = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=get_user_message_force_reply(llm_config),
            stream_tokens=True,
        )
        list(response)
    except:
        pass  # only some models throw an error TODO: make this consistent

    messages_from_db = client.agents.messages.list(agent_id=agent_state.id, after=last_message[0].id)
    assert len(messages_from_db) == 0
    client.agents.modify(agent_id=agent_state.id, tool_ids=[t.id for t in tools])


def test_async_greeting_with_assistant_message(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    agent_state: AgentState,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """
    Tests sending a message as an asynchronous job using the synchronous client.
    Waits for job completion and asserts that the result messages are as expected.
    """
    json_metadata["llm_config"] = dict(llm_config)
    client.agents.modify(agent_id=agent_state.id, llm_config=llm_config)

    run = client.agents.messages.create_async(
        agent_id=agent_state.id,
        messages=get_user_message_force_reply(llm_config),
    )
    run = wait_for_run_completion(client, run.id)

    result = run.metadata.get("result")
    assert result is not None, "Run metadata missing 'result' key"

    messages = result["messages"]
    messages = cast_message_dict_to_messages(messages)
    assert_greeting_with_assistant_message_response(messages, llm_config=llm_config)


def test_auto_summarize(
    disable_e2b_api_key: Any,
    client: Letta,
    llm_config: LLMConfig,
    json_metadata: pytest.FixtureRequest,
) -> None:
    """Test that summarization is automatically triggered."""
    json_metadata["llm_config"] = dict(llm_config)

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

    philosophical_question = """
You know, sometimes I wonder if the entire structure of our lives is built on a series of unexamined assumptions we just silently agreed to somewhere along the way—like how we all just decided that five days a week of work and two days of “rest” constitutes balance, or how 9-to-5 became the default rhythm of a meaningful life, or even how the idea of “success” got boiled down to job titles and property ownership and productivity metrics on a LinkedIn profile, when maybe none of that is actually what makes a life feel full, or grounded, or real. And then there’s the weird paradox of ambition, how we're taught to chase it like a finish line that keeps moving, constantly redefining itself right as you’re about to grasp it—because even when you get the job, or the degree, or the validation, there's always something next, something more, like a treadmill with invisible settings you didn’t realize were turned up all the way.

And have you noticed how we rarely stop to ask who set those definitions for us? Like was there ever a council that decided, yes, owning a home by thirty-five and retiring by sixty-five is the universal template for fulfillment? Or did it just accumulate like cultural sediment over generations, layered into us so deeply that questioning it feels uncomfortable, even dangerous? And isn’t it strange that we spend so much of our lives trying to optimize things—our workflows, our diets, our sleep, our morning routines—as though the point of life is to operate more efficiently rather than to experience it more richly? We build these intricate systems, these rulebooks for being a “high-functioning” human, but where in all of that is the space for feeling lost, for being soft, for wandering without a purpose just because it’s a sunny day and your heart is tugging you toward nowhere in particular?

Sometimes I lie awake at night and wonder if all the noise we wrap around ourselves—notifications, updates, performance reviews, even our internal monologues—might be crowding out the questions we were meant to live into slowly, like how to love better, or how to forgive ourselves, or what the hell we’re even doing here in the first place. And when you strip it all down—no goals, no KPIs, no curated identity—what’s actually left of us? Are we just a sum of the roles we perform, or is there something quieter underneath that we've forgotten how to hear?

And if there is something underneath all of it—something real, something worth listening to—then how do we begin to uncover it, gently, without rushing or reducing it to another task on our to-do list?
    """

    MAX_ATTEMPTS = 10
    prev_length = None

    for attempt in range(MAX_ATTEMPTS):
        content = prefix_message_content_for_ollama(philosophical_question, llm_config)
        client.agents.messages.create(
            agent_id=temp_agent_state.id,
            messages=[MessageCreate(role="user", content=content)],
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
