"""Tests for LettaRequest schema validation"""

import pytest
from pydantic import ValidationError

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.letta_request import CreateBatch, LettaBatchRequest, LettaRequest, LettaStreamingRequest
from letta.schemas.message import MessageCreate


class TestLettaRequest:
    """Test cases for LettaRequest schema"""

    def test_letta_request_with_default_max_steps(self):
        """Test that LettaRequest uses default max_steps value"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(messages=messages)

        assert request.max_steps == 10
        assert request.messages == messages
        assert request.use_assistant_message is True
        assert request.assistant_message_tool_name == DEFAULT_MESSAGE_TOOL
        assert request.assistant_message_tool_kwarg == DEFAULT_MESSAGE_TOOL_KWARG

    def test_letta_request_with_custom_max_steps(self):
        """Test that LettaRequest accepts custom max_steps value"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(messages=messages, max_steps=5)

        assert request.max_steps == 5
        assert request.messages == messages

    def test_letta_request_with_zero_max_steps(self):
        """Test that LettaRequest accepts zero max_steps"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(messages=messages, max_steps=0)

        assert request.max_steps == 0

    def test_letta_request_with_negative_max_steps(self):
        """Test that LettaRequest accepts negative max_steps (edge case)"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(messages=messages, max_steps=-1)

        assert request.max_steps == -1

    def test_letta_request_required_fields(self):
        """Test that messages field is required"""
        with pytest.raises(ValidationError) as exc_info:
            LettaRequest()

        assert "messages" in str(exc_info.value)

    def test_letta_request_with_all_fields(self):
        """Test LettaRequest with all fields specified"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(
            messages=messages,
            max_steps=15,
            use_assistant_message=False,
            assistant_message_tool_name="custom_tool",
            assistant_message_tool_kwarg="custom_kwarg",
        )

        assert request.max_steps == 15
        assert request.use_assistant_message is False
        assert request.assistant_message_tool_name == "custom_tool"
        assert request.assistant_message_tool_kwarg == "custom_kwarg"

    def test_letta_request_json_serialization(self):
        """Test that LettaRequest can be serialized to/from JSON"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaRequest(messages=messages, max_steps=7)

        # Serialize to dict
        request_dict = request.model_dump()
        assert request_dict["max_steps"] == 7

        # Deserialize from dict
        request_from_dict = LettaRequest.model_validate(request_dict)
        assert request_from_dict.max_steps == 7
        assert request_from_dict.messages[0].role == "user"


class TestLettaStreamingRequest:
    """Test cases for LettaStreamingRequest schema"""

    def test_letta_streaming_request_inherits_max_steps(self):
        """Test that LettaStreamingRequest inherits max_steps from LettaRequest"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaStreamingRequest(messages=messages, max_steps=12)

        assert request.max_steps == 12
        assert request.stream_tokens is False  # Default value

    def test_letta_streaming_request_with_streaming_options(self):
        """Test LettaStreamingRequest with streaming-specific options"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaStreamingRequest(messages=messages, max_steps=8, stream_tokens=True)

        assert request.max_steps == 8
        assert request.stream_tokens is True


class TestLettaBatchRequest:
    """Test cases for LettaBatchRequest schema"""

    def test_letta_batch_request_inherits_max_steps(self):
        """Test that LettaBatchRequest inherits max_steps from LettaRequest"""
        messages = [MessageCreate(role="user", content="Test message")]
        request = LettaBatchRequest(messages=messages, agent_id="test-agent-id", max_steps=20)

        assert request.max_steps == 20
        assert request.agent_id == "test-agent-id"

    def test_letta_batch_request_required_agent_id(self):
        """Test that agent_id is required for LettaBatchRequest"""
        messages = [MessageCreate(role="user", content="Test message")]

        with pytest.raises(ValidationError) as exc_info:
            LettaBatchRequest(messages=messages)

        assert "agent_id" in str(exc_info.value)


class TestCreateBatch:
    """Test cases for CreateBatch schema"""

    def test_create_batch_with_max_steps(self):
        """Test CreateBatch containing requests with max_steps"""
        messages = [MessageCreate(role="user", content="Test message")]
        batch_requests = [
            LettaBatchRequest(messages=messages, agent_id="agent-1", max_steps=5),
            LettaBatchRequest(messages=messages, agent_id="agent-2", max_steps=10),
        ]

        batch = CreateBatch(requests=batch_requests)

        assert len(batch.requests) == 2
        assert batch.requests[0].max_steps == 5
        assert batch.requests[1].max_steps == 10

    def test_create_batch_with_callback_url(self):
        """Test CreateBatch with callback URL"""
        messages = [MessageCreate(role="user", content="Test message")]
        batch_requests = [LettaBatchRequest(messages=messages, agent_id="agent-1", max_steps=3)]

        batch = CreateBatch(requests=batch_requests, callback_url="https://example.com/callback")

        assert str(batch.callback_url) == "https://example.com/callback"
        assert batch.requests[0].max_steps == 3


class TestLettaRequestIntegration:
    """Integration tests for LettaRequest usage patterns"""

    def test_max_steps_propagation_in_inheritance_chain(self):
        """Test that max_steps works correctly across the inheritance chain"""
        messages = [MessageCreate(role="user", content="Test message")]

        # Test base LettaRequest
        base_request = LettaRequest(messages=messages, max_steps=3)
        assert base_request.max_steps == 3

        # Test LettaStreamingRequest inheritance
        streaming_request = LettaStreamingRequest(messages=messages, max_steps=6)
        assert streaming_request.max_steps == 6

        # Test LettaBatchRequest inheritance
        batch_request = LettaBatchRequest(messages=messages, agent_id="test-agent", max_steps=9)
        assert batch_request.max_steps == 9

    def test_backwards_compatibility(self):
        """Test that existing code without max_steps still works"""
        messages = [MessageCreate(role="user", content="Test message")]

        # Should work without max_steps (uses default)
        request = LettaRequest(messages=messages)
        assert request.max_steps == 10

        # Should work with all other fields
        request = LettaRequest(messages=messages, use_assistant_message=False, assistant_message_tool_name="custom_tool")
        assert request.max_steps == 10  # Still uses default
