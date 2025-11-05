from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

# Import your AnthropicClient and related types
from letta.llm_api.anthropic_client import AnthropicClient
from letta.schemas.enums import AgentType, MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage


@pytest.fixture
def llm_config():
    yield LLMConfig(
        model="claude-3-7-sonnet-20250219",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=32000,
        handle="anthropic/claude-sonnet-4-20250514",
        put_inner_thoughts_in_kwargs=False,
        max_tokens=4096,
        enable_reasoner=True,
        max_reasoning_tokens=1024,
    )


@pytest.fixture
def anthropic_client():
    return AnthropicClient()


@pytest.fixture
def mock_agent_messages():
    return {
        "agent-1": [
            PydanticMessage(
                role=MessageRole.system,
                content=[{"type": "text", "text": "You are a helpful assistant."}],
                created_at=datetime.now(timezone.utc),
            ),
            PydanticMessage(
                role=MessageRole.user, content=[{"type": "text", "text": "What's the weather like?"}], created_at=datetime.now(timezone.utc)
            ),
        ]
    }


@pytest.fixture
def mock_agent_tools():
    return {
        "agent-1": [
            {
                "name": "get_weather",
                "description": "Fetch current weather data",
                "parameters": {
                    "type": "object",
                    "properties": {"location": {"type": "string", "description": "The location to get weather for"}},
                    "required": ["location"],
                },
            }
        ]
    }


@pytest.fixture
def mock_agent_llm_config(llm_config):
    return {"agent-1": llm_config}


@pytest.mark.asyncio
async def test_send_llm_batch_request_async_success(
    anthropic_client, mock_agent_messages, mock_agent_tools, mock_agent_llm_config, dummy_beta_message_batch
):
    """Test a successful batch request using mocked Anthropic client responses."""
    # Patch the _get_anthropic_client_async method so that it returns a mock client.
    with patch.object(anthropic_client, "_get_anthropic_client_async") as mock_get_client:
        mock_client = AsyncMock()
        # Set the create method to return the dummy response asynchronously.
        mock_client.beta.messages.batches.create.return_value = dummy_beta_message_batch
        mock_get_client.return_value = mock_client

        # Call the method under test.
        response = await anthropic_client.send_llm_batch_request_async(
            AgentType.memgpt_agent, mock_agent_messages, mock_agent_tools, mock_agent_llm_config
        )

        # Assert that the response is our dummy response.
        assert response.id == dummy_beta_message_batch.id
        # Assert that the mocked create method was called and received the correct request payload.
        assert mock_client.beta.messages.batches.create.called
        requests_sent = mock_client.beta.messages.batches.create.call_args[1]["requests"]
        assert isinstance(requests_sent, list)
        assert all(isinstance(req, dict) and "custom_id" in req and "params" in req for req in requests_sent)


@pytest.mark.asyncio
async def test_send_llm_batch_request_async_mismatched_keys(anthropic_client, mock_agent_messages, mock_agent_llm_config):
    """
    This test verifies that if the keys in the messages and tools mappings do not match,
    a ValueError is raised.
    """
    mismatched_tools = {"agent-2": []}  # Different agent ID than in the messages mapping.
    with pytest.raises(ValueError, match="Agent mappings for messages and tools must use the same agent_ids."):
        await anthropic_client.send_llm_batch_request_async(
            AgentType.memgpt_agent, mock_agent_messages, mismatched_tools, mock_agent_llm_config
        )


@pytest.mark.asyncio
async def test_count_tokens_with_empty_messages(anthropic_client, llm_config):
    """
    Test that count_tokens properly handles empty messages by replacing them with placeholders,
    while preserving the exemption for the final assistant message.
    """
    import anthropic

    with patch("anthropic.AsyncAnthropic") as mock_anthropic_class:
        mock_client = AsyncMock()
        mock_count_tokens = AsyncMock()

        # Create a mock return value with input_tokens attribute
        mock_response = AsyncMock()
        mock_response.input_tokens = 100
        mock_count_tokens.return_value = mock_response

        mock_client.beta.messages.count_tokens = mock_count_tokens
        mock_anthropic_class.return_value = mock_client

        # Test case 1: Empty string content (non-final message) - should be replaced with "."
        messages_with_empty_string = [
            {"role": "user", "content": ""},
            {"role": "assistant", "content": "response"},
        ]
        await anthropic_client.count_tokens(messages=messages_with_empty_string, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"] == "."
        assert call_args["messages"][1]["content"] == "response"

        # Test case 2: Empty list content (non-final message) - should be replaced with [{"type": "text", "text": "."}]
        mock_count_tokens.reset_mock()
        messages_with_empty_list = [
            {"role": "user", "content": []},
            {"role": "assistant", "content": "response"},
        ]
        await anthropic_client.count_tokens(messages=messages_with_empty_list, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"] == [{"type": "text", "text": "."}]
        assert call_args["messages"][1]["content"] == "response"

        # Test case 3: Empty text block within content list (non-final message) - should be replaced with "."
        mock_count_tokens.reset_mock()
        messages_with_empty_block = [
            {"role": "user", "content": [{"type": "text", "text": ""}]},
            {"role": "assistant", "content": "response"},
        ]
        await anthropic_client.count_tokens(messages=messages_with_empty_block, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"][0]["text"] == "."
        assert call_args["messages"][1]["content"] == "response"

        # Test case 4: Empty final assistant message - should be preserved (allowed by Anthropic)
        mock_count_tokens.reset_mock()
        messages_with_empty_final_assistant = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": ""},
        ]
        await anthropic_client.count_tokens(messages=messages_with_empty_final_assistant, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"] == "hello"
        assert call_args["messages"][1]["content"] == ""

        # Test case 5: Empty text block in final assistant message - should be replaced with "."
        # Note: The API exemption is for truly empty content ("" or []), not for lists with empty text blocks
        mock_count_tokens.reset_mock()
        messages_with_empty_final_assistant_block = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": [{"type": "text", "text": ""}]},
        ]
        await anthropic_client.count_tokens(messages=messages_with_empty_final_assistant_block, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"] == "hello"
        assert call_args["messages"][1]["content"][0]["text"] == "."  # Empty text blocks are always fixed

        # Test case 6: None content (non-final message) - should be replaced with "."
        mock_count_tokens.reset_mock()
        messages_with_none = [
            {"role": "user", "content": None},
            {"role": "assistant", "content": "response"},
        ]
        await anthropic_client.count_tokens(messages=messages_with_none, model=llm_config.model)

        call_args = mock_count_tokens.call_args[1]
        assert call_args["messages"][0]["content"] == "."
        assert call_args["messages"][1]["content"] == "response"
