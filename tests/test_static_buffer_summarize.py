import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from letta.agents.base_agent import BaseAgent
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer

# Constants for test parameters
MESSAGE_BUFFER_LIMIT = 10
MESSAGE_BUFFER_MIN = 3
SUMMARY_TEXT = "Summarized memory"


@pytest.fixture
def mock_summarizer_agent():
    agent = AsyncMock(spec=BaseAgent)
    agent.step.return_value = [Message(role=MessageRole.assistant, content=[TextContent(type="text", text=SUMMARY_TEXT)])]
    agent.update_message_transcript = AsyncMock()
    return agent


@pytest.fixture
def messages():
    return [
        Message(
            role=MessageRole.user if i % 2 == 0 else MessageRole.assistant,
            content=[TextContent(type="text", text=json.dumps({"message": f"Test message {i}"}))],
            created_at=datetime.now(timezone.utc),
        )
        for i in range(15)
    ]


@pytest.mark.asyncio
async def test_static_buffer_summarization_no_trim_needed(mock_summarizer_agent, messages):
    summarizer = Summarizer(SummarizationMode.STATIC_MESSAGE_BUFFER, mock_summarizer_agent, message_buffer_limit=20)
    updated_messages, updated = summarizer._static_buffer_summarization(messages[:5], [])

    assert len(updated_messages) == 5
    assert not updated


@pytest.mark.asyncio
async def test_static_buffer_summarization_trim_needed(mock_summarizer_agent, messages):
    summarizer = Summarizer(
        SummarizationMode.STATIC_MESSAGE_BUFFER,
        mock_summarizer_agent,
        message_buffer_limit=MESSAGE_BUFFER_LIMIT,
        message_buffer_min=MESSAGE_BUFFER_MIN,
    )
    updated_messages, updated = summarizer._static_buffer_summarization(messages[:12], [])

    assert len(updated_messages) == MESSAGE_BUFFER_MIN
    assert updated
    mock_summarizer_agent.step.assert_called()


@pytest.mark.asyncio
async def test_static_buffer_summarization_trim_user_message(mock_summarizer_agent, messages):
    summarizer = Summarizer(
        SummarizationMode.STATIC_MESSAGE_BUFFER,
        mock_summarizer_agent,
        message_buffer_limit=MESSAGE_BUFFER_LIMIT,
        message_buffer_min=MESSAGE_BUFFER_MIN,
    )

    # Modify messages to ensure a user message is available to trim at the correct index
    messages[5].role = MessageRole.user  # Ensure a user message exists in trimming range

    updated_messages, updated = summarizer._static_buffer_summarization(messages[:12], [])

    assert len(updated_messages) == MESSAGE_BUFFER_MIN
    assert updated
    mock_summarizer_agent.step.assert_called()


@pytest.mark.asyncio
async def test_static_buffer_summarization_no_trim_no_summarization(mock_summarizer_agent, messages):
    summarizer = Summarizer(SummarizationMode.STATIC_MESSAGE_BUFFER, mock_summarizer_agent, message_buffer_limit=15)
    updated_messages, updated = summarizer._static_buffer_summarization(messages[:8], [])

    assert len(updated_messages) == 8
    assert not updated
    mock_summarizer_agent.step.assert_not_called()


@pytest.mark.asyncio
async def test_static_buffer_summarization_json_parsing_failure(mock_summarizer_agent, messages):
    summarizer = Summarizer(
        SummarizationMode.STATIC_MESSAGE_BUFFER,
        mock_summarizer_agent,
        message_buffer_limit=MESSAGE_BUFFER_LIMIT,
        message_buffer_min=MESSAGE_BUFFER_MIN,
    )

    # Inject malformed JSON
    messages[2].content = [TextContent(type="text", text="malformed json")]

    updated_messages, updated = summarizer._static_buffer_summarization(messages[:12], [])

    assert len(updated_messages) == MESSAGE_BUFFER_MIN
    assert updated
    mock_summarizer_agent.step.assert_called()


@pytest.mark.asyncio
async def test_static_buffer_summarization_all_user_messages_trimmed(mock_summarizer_agent, messages):
    summarizer = Summarizer(
        SummarizationMode.STATIC_MESSAGE_BUFFER,
        mock_summarizer_agent,
        message_buffer_limit=MESSAGE_BUFFER_LIMIT,
        message_buffer_min=MESSAGE_BUFFER_MIN,
    )

    # Ensure all messages being trimmed are user messages
    for i in range(12):
        messages[i].role = MessageRole.user

    updated_messages, updated = summarizer._static_buffer_summarization(messages[:12], [])

    assert len(updated_messages) == MESSAGE_BUFFER_MIN + 1
    assert updated
    mock_summarizer_agent.step.assert_called()


@pytest.mark.asyncio
async def test_static_buffer_summarization_no_assistant_messages_trimmed(mock_summarizer_agent, messages):
    summarizer = Summarizer(
        SummarizationMode.STATIC_MESSAGE_BUFFER,
        mock_summarizer_agent,
        message_buffer_limit=MESSAGE_BUFFER_LIMIT,
        message_buffer_min=MESSAGE_BUFFER_MIN,
    )

    # Ensure all messages being trimmed are assistant messages
    for i in range(12):
        messages[i].role = MessageRole.assistant

    updated_messages, updated = summarizer._static_buffer_summarization(messages[:12], [])

    # Yeah, so this actually has to end on 1, because we basically can find no user, so we trim everything
    assert len(updated_messages) == 1
    assert updated
    mock_summarizer_agent.step.assert_called()
