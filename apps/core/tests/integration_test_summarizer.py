import json
import os
import uuid
from datetime import datetime, timezone
from typing import List

import pytest

from letta.agent import Agent
from letta.config import LettaConfig
from letta.llm_api.helpers import calculate_summarizer_cutoff
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.server.server import SyncServer
from letta.streaming_interface import StreamingRefreshCLIInterface
from tests.helpers.endpoints_helper import EMBEDDING_CONFIG_PATH
from tests.helpers.utils import cleanup

# constants
LLM_CONFIG_DIR = "tests/configs/llm_model_configs"
SUMMARY_KEY_PHRASE = "The following is a summary"

test_agent_name = f"test_client_{str(uuid.uuid4())}"

# TODO: these tests should include looping through LLM providers, since behavior may vary across providers
# TODO: these tests should add function calls into the summarized message sequence:W


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    config.save()

    server = SyncServer()
    return server


@pytest.fixture(scope="module")
def default_user(server):
    yield server.user_manager.get_user_or_default()


@pytest.fixture(scope="module")
def agent_state(server, default_user):
    # Generate uuid for agent name for this example
    agent_state = server.create_agent(
        CreateAgent(
            name=test_agent_name,
            include_base_tools=True,
            model="openai/gpt-4o-mini",
            embedding="letta/letta-free",
        ),
        actor=default_user,
    )
    yield agent_state

    server.agent_manager.delete_agent(agent_state.id, default_user)


# Sample data setup
def generate_message(role: str, text: str = None, tool_calls: List = None) -> Message:
    """Helper to generate a Message object."""
    return Message(
        id="message-" + str(uuid.uuid4()),
        role=MessageRole(role),
        content=[TextContent(text=text or f"{role} message text")],
        created_at=datetime.now(timezone.utc),
        tool_calls=tool_calls or [],
    )


def test_cutoff_calculation(mocker):
    """Test basic scenarios where the function calculates the cutoff correctly."""
    # Arrange
    logger = mocker.Mock()  # Mock logger
    messages = [
        generate_message("system"),
        generate_message("user"),
        generate_message("assistant"),
        generate_message("user"),
        generate_message("assistant"),
    ]
    mocker.patch("letta.settings.summarizer_settings.desired_memory_token_pressure", 0.5)
    mocker.patch("letta.settings.summarizer_settings.evict_all_messages", False)

    # Basic tests
    token_counts = [4, 2, 8, 2, 2]
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 3
    assert messages[cutoff - 1].role == MessageRole.assistant

    token_counts = [4, 2, 2, 2, 2]
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 5
    assert messages[cutoff - 1].role == MessageRole.assistant

    token_counts = [2, 2, 3, 2, 2]
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 3
    assert messages[cutoff - 1].role == MessageRole.assistant

    # Evict all messages
    # Should give the end of the token_counts, even though it is not necessary (can just evict up to the 100)
    mocker.patch("letta.settings.summarizer_settings.evict_all_messages", True)
    token_counts = [1, 1, 100, 1, 1]
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 5
    assert messages[cutoff - 1].role == MessageRole.assistant

    # Don't evict all messages with same token_counts, cutoff now should be at the 100
    # Should give the end of the token_counts, even though it is not necessary (can just evict up to the 100)
    mocker.patch("letta.settings.summarizer_settings.evict_all_messages", False)
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 3
    assert messages[cutoff - 1].role == MessageRole.assistant

    # Set `keep_last_n_messages`
    mocker.patch("letta.settings.summarizer_settings.keep_last_n_messages", 3)
    token_counts = [4, 2, 2, 2, 2]
    cutoff = calculate_summarizer_cutoff(messages, token_counts, logger)
    assert cutoff == 2
    assert messages[cutoff - 1].role == MessageRole.user


def test_cutoff_calculation_with_tool_call(mocker, server, agent_state, default_user):
    """Test that trim_older_in_context_messages properly handles tool responses with _trim_tool_response."""
    agent_state = server.agent_manager.get_agent_by_id(agent_id=agent_state.id, actor=default_user)

    # Setup
    messages = [
        generate_message("system"),
        generate_message("user", text="First user message"),
        generate_message(
            "assistant", tool_calls=[{"id": "tool_call_1", "type": "function", "function": {"name": "test_function", "arguments": "{}"}}]
        ),
        generate_message("tool", text="First tool response"),
        generate_message("assistant", text="First assistant response after tool"),
        generate_message("user", text="Second user message"),
        generate_message("assistant", text="Second assistant response"),
    ]

    def mock_get_messages_by_ids(message_ids, actor):
        return [msg for msg in messages if msg.id in message_ids]

    mocker.patch.object(server.agent_manager.message_manager, "get_messages_by_ids", side_effect=mock_get_messages_by_ids)

    # Mock get_agent_by_id to return an agent with our message IDs
    mock_agent = mocker.Mock()
    mock_agent.message_ids = [msg.id for msg in messages]
    mocker.patch.object(server.agent_manager, "get_agent_by_id", return_value=mock_agent)

    # Mock set_in_context_messages to capture what messages are being set
    mock_set_messages = mocker.patch.object(server.agent_manager, "set_in_context_messages", return_value=agent_state)

    # Test Case: Trim to remove orphaned tool response
    server.agent_manager.trim_older_in_context_messages(agent_id=agent_state.id, num=3, actor=default_user)

    test1 = mock_set_messages.call_args_list[0][1]
    assert len(test1["message_ids"]) == 5

    mock_set_messages.reset_mock()

    # Test Case: Does not result in trimming the orphaned tool response
    server.agent_manager.trim_older_in_context_messages(agent_id=agent_state.id, num=2, actor=default_user)
    test2 = mock_set_messages.call_args_list[0][1]
    assert len(test2["message_ids"]) == 6


def test_summarize_many_messages_basic(server, default_user):
    """Test that a small-context agent gets enough messages for summarization."""
    small_context_llm_config = LLMConfig.default_config("gpt-4o-mini")
    small_context_llm_config.context_window = 3000

    agent_state = server.create_agent(
        CreateAgent(
            name="small_context_agent",
            llm_config=small_context_llm_config,
            embedding="letta/letta-free",
        ),
        actor=default_user,
    )

    try:
        for _ in range(10):
            server.send_messages(
                actor=default_user,
                agent_id=agent_state.id,
                input_messages=[MessageCreate(role="user", content="hi " * 60)],
            )
    finally:
        server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)


def test_summarize_messages_inplace(server, agent_state, default_user):
    """Test summarization logic via agent object API."""
    for msg in [
        "Hey, how's it going? What do you think about this whole shindig?",
        "Any thoughts on the meaning of life?",
        "Does the number 42 ring a bell?",
        "Would you be surprised to learn that you're actually conversing with an AI right now?",
    ]:
        response = server.send_messages(
            actor=default_user,
            agent_id=agent_state.id,
            input_messages=[MessageCreate(role="user", content=msg)],
        )
        assert response.steps_messages

    agent = server.load_agent(agent_id=agent_state.id, actor=default_user)
    agent.summarize_messages_inplace()


def test_auto_summarize(server, default_user):
    """Test that summarization is automatically triggered."""
    small_context_llm_config = LLMConfig.default_config("gpt-4o-mini")
    small_context_llm_config.context_window = 3000

    agent_state = server.create_agent(
        CreateAgent(
            name="small_context_agent",
            llm_config=small_context_llm_config,
            embedding="letta/letta-free",
        ),
        actor=default_user,
    )

    def summarize_message_exists(messages: list[Message]) -> bool:
        for message in messages:
            if message.content[0].text and "The following is a summary of the previous" in message.content[0].text:
                return True
        return False

    try:
        MAX_ATTEMPTS = 10
        for attempt in range(MAX_ATTEMPTS):
            server.send_messages(
                actor=default_user,
                agent_id=agent_state.id,
                input_messages=[MessageCreate(role="user", content="What is the meaning of life?")],
            )

            in_context_messages = server.agent_manager.get_in_context_messages(agent_id=agent_state.id, actor=default_user)

            if summarize_message_exists(in_context_messages):
                return

        raise AssertionError("Summarization was not triggered after 10 messages")
    finally:
        server.agent_manager.delete_agent(agent_id=agent_state.id, actor=default_user)


@pytest.mark.parametrize(
    "config_filename",
    [
        "openai-gpt-4o.json",
        # "azure-gpt-4o-mini.json",
        "claude-3-5-haiku.json",
        # "groq.json",  # rate limits
        # "gemini-pro.json",  # broken
    ],
)
def test_summarizer(config_filename, server, default_user):
    """Test summarization across different LLM configs."""
    namespace = uuid.NAMESPACE_DNS
    agent_name = str(uuid.uuid5(namespace, f"integration-test-summarizer-{config_filename}"))

    # Load configs
    config_data = json.load(open(os.path.join(LLM_CONFIG_DIR, config_filename)))
    llm_config = LLMConfig(**config_data)
    embedding_config = EmbeddingConfig(**json.load(open(EMBEDDING_CONFIG_PATH)))

    # Ensure cleanup
    cleanup(server=server, agent_uuid=agent_name, actor=default_user)

    # Create agent
    agent_state = server.create_agent(
        CreateAgent(
            name=agent_name,
            llm_config=llm_config,
            embedding_config=embedding_config,
        ),
        actor=default_user,
    )

    full_agent_state = server.agent_manager.get_agent_by_id(agent_id=agent_state.id, actor=default_user)

    letta_agent = Agent(
        interface=StreamingRefreshCLIInterface(),
        agent_state=full_agent_state,
        first_message_verify_mono=False,
        user=default_user,
    )

    for msg in [
        "Did you know that honey never spoils? Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
        "Octopuses have three hearts, and two of them stop beating when they swim.",
    ]:
        letta_agent.step_user_message(
            user_message_str=msg,
            first_message=False,
            skip_verify=False,
            stream=False,
        )

    letta_agent.summarize_messages_inplace()
    in_context_messages = server.agent_manager.get_in_context_messages(agent_state.id, actor=default_user)
    assert SUMMARY_KEY_PHRASE in in_context_messages[1].content[0].text, f"Test failed for config: {config_filename}"
