import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import List

import pytest

from letta.agent import Agent
from letta.agents.agent_loop import AgentLoop
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.config import LettaConfig
from letta.llm_api.helpers import calculate_summarizer_cutoff
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.server.server import SyncServer
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
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


def get_summarizer(agent_state, default_user, server, percentage: float):
    return Summarizer(
        mode=SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER,
        summarizer_agent=None,
        message_buffer_limit=None,
        message_buffer_min=None,
        partial_evict_summarizer_percentage=percentage,
        agent_manager=server.agent_manager,
        message_manager=server.message_manager,
        actor=default_user,
        agent_id=agent_state.id,
    )


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


all_configs = [
    "ollama.json",
    "together-qwen-2.5-72b-instruct.json",
    "vllm.json",
    "lmstudio.json",
    "groq.json",
    "openai-gpt-4o-mini.json",
    "openai-o4-mini.json",
    "azure-gpt-4o-mini.json",
    "claude-3-5-sonnet.json",
    "gemini-2.5-pro-vertex.json",
]


@pytest.mark.asyncio
@pytest.mark.parametrize("llm_config", all_configs, ids=[c.model for c in all_configs])
async def test_summarizer_message_is_first_user_message(agent_state, default_user, server, llm_config):
    # update the agent state
    agent_state.llm_config = LLMConfig(**llm_config)

    # get the summarizer
    summarizer = get_summarizer(agent_state, default_user, server, 0.6)
    in_context_messages = [
        generate_message("system"),
        generate_message("user"),
        generate_message("assistant"),
        generate_message("user"),
        generate_message("assistant"),
        generate_message("user"),
    ]
    new_letta_messages = [
        generate_message("user"),
        generate_message("assistant"),
    ]
    new_in_context_messages, summarized = await summarizer.summarize(in_context_messages, new_letta_messages, force=True, clear=True)
    assert summarized, "Summarizer should have summarized the messages"
    summary_expected_index = 1
    assert new_in_context_messages[summary_expected_index].role == MessageRole.user
    assert SUMMARY_KEY_PHRASE in new_in_context_messages[summary_expected_index].content[0].text, (
        f"Summary key phrase not found in summary message: {new_in_context_messages[summary_expected_index].content[0].text}"
    )

    # assert message size is less
    assert len(new_in_context_messages) < len(in_context_messages + new_letta_messages), (
        f"New in context messages (size {len(new_in_context_messages)}) should be less than in context messages (size {len(in_context_messages)}) + new letta messages (size {len(new_letta_messages)})"
    )

    # assert not in any other messages
    for i in range(len(new_in_context_messages)):
        if i != summary_expected_index:
            assert new_in_context_messages[i].content[0].text != MessageRole.user, (
                f"Summary message found in message {new_in_context_messages[i].content[0].text}"
            )

    for i in range(len(new_in_context_messages)):
        print(new_in_context_messages[i].role, new_in_context_messages[i].content[0].text)


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
