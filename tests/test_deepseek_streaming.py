"""Test DeepSeek streaming for both deepseek-chat and deepseek-reasoner models.

This comprehensive test suite covers all DeepSeek streaming functionality:
1. deepseek-chat: Standard OpenAI-compatible streaming with native tool calling
2. deepseek-reasoner: Streaming with reasoning content and manual JSON function call parsing
3. JSON function call parsing (single and parallel calls) for deepseek-reasoner
4. Function call execution in both native (chat) and manual (reasoner) modes
5. End-to-end agent interactions for both models
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from letta_client import Letta, MessageCreate

from letta.interfaces.openai_streaming_interface import SimpleOpenAIStreamingInterface
from letta.schemas.letta_message import ReasoningMessage, ToolCallMessage
from tests.utils import wait_for_server


# ============================================================================
# Unit Tests for JSON Function Call Parser
# ============================================================================


class TestJSONFunctionCallParser:
    """Unit tests for the JSON function call parsing logic."""

    @pytest.fixture
    def interface(self):
        """Create a streaming interface instance for testing."""
        return SimpleOpenAIStreamingInterface()

    def test_parse_complete_single_function_call(self, interface):
        """Test parsing a complete single function call."""
        json_text = '{"name": "memory_insert", "arguments": {"label": "human", "new_str": "Age: 25"}}'
        
        is_complete, parsed = interface._try_parse_json_function_call(json_text)
        
        assert is_complete is True
        assert isinstance(parsed, dict)
        assert parsed["name"] == "memory_insert"
        assert parsed["arguments"]["label"] == "human"
        assert parsed["arguments"]["new_str"] == "Age: 25"

    def test_parse_complete_parallel_function_calls(self, interface):
        """Test parsing parallel function calls (array)."""
        json_text = '''[
            {"name": "memory_insert", "arguments": {"label": "human", "new_str": "Age: 25"}},
            {"name": "conversation_search", "arguments": {"query": "age"}}
        ]'''
        
        is_complete, parsed = interface._try_parse_json_function_call(json_text)
        
        assert is_complete is True
        assert isinstance(parsed, list)
        assert len(parsed) == 2
        assert parsed[0]["name"] == "memory_insert"
        assert parsed[1]["name"] == "conversation_search"

    def test_parse_incomplete_json(self, interface):
        """Test that incomplete JSON returns incomplete status."""
        incomplete_jsons = [
            '{"name": "memory_insert"',  # Unclosed brace
            '{"name": "memory_insert", "arguments": {',  # Nested unclosed
            '[{"name": "memory_insert"}',  # Unclosed array
            '{"name":',  # Incomplete key-value
        ]
        
        for json_text in incomplete_jsons:
            is_complete, _ = interface._try_parse_json_function_call(json_text)
            assert is_complete is False, f"Should be incomplete: {json_text}"

    def test_parse_json_not_function_call(self, interface):
        """Test that valid JSON that isn't a function call returns None."""
        non_function_jsons = [
            '{"foo": "bar"}',  # Missing name/arguments
            '{"name": "test"}',  # Missing arguments
            '{"arguments": {}}',  # Missing name
            '[{"foo": "bar"}]',  # Array with non-function objects
        ]
        
        for json_text in non_function_jsons:
            is_complete, parsed = interface._try_parse_json_function_call(json_text)
            assert is_complete is True
            assert parsed is None, f"Should return None for: {json_text}"

    def test_parse_malformed_json(self, interface):
        """Test that malformed JSON returns incomplete status."""
        malformed_jsons = [
            '{name: "test"}',  # Unquoted key
            "{'name': 'test'}",  # Single quotes
            '{"name": undefined}',  # Invalid value
        ]
        
        for json_text in malformed_jsons:
            is_complete, _ = interface._try_parse_json_function_call(json_text)
            assert is_complete is False, f"Should be incomplete: {json_text}"

    def test_parse_with_nested_json_arguments(self, interface):
        """Test parsing function call with nested JSON in arguments."""
        json_text = '''{"name": "send_message", "arguments": {"content": {"text": "Hello", "metadata": {"key": "value"}}}}'''
        
        is_complete, parsed = interface._try_parse_json_function_call(json_text)
        
        assert is_complete is True
        assert parsed["name"] == "send_message"
        assert parsed["arguments"]["content"]["text"] == "Hello"
        assert parsed["arguments"]["content"]["metadata"]["key"] == "value"

    def test_parse_with_string_arguments(self, interface):
        """Test parsing function call where arguments is a JSON string."""
        json_text = '''{"name": "memory_insert", "arguments": "{\\"label\\": \\"human\\", \\"new_str\\": \\"test\\"}"}'''
        
        is_complete, parsed = interface._try_parse_json_function_call(json_text)
        
        assert is_complete is True
        assert parsed["name"] == "memory_insert"
        assert isinstance(parsed["arguments"], str)  # Should remain as string for now


# ============================================================================
# Tests for get_content() and get_tool_call_object() Methods
# ============================================================================


class TestInterfaceMethods:
    """Test the public interface methods of SimpleOpenAIStreamingInterface."""

    @pytest.fixture
    def interface(self):
        """Create a streaming interface instance for testing."""
        return SimpleOpenAIStreamingInterface()

    def test_get_content_empty(self, interface):
        """Test get_content() with no messages."""
        content = interface.get_content()
        assert isinstance(content, list)
        assert len(content) == 0

    def test_get_content_with_reasoning_only(self, interface):
        """Test get_content() with only reasoning messages."""
        from letta.schemas.letta_message import ReasoningMessage
        from letta.schemas.letta_message_content import ReasoningContent
        from datetime import datetime, timezone
        from letta.schemas.message import Message
        
        # Add reasoning messages
        reasoning_msg1 = ReasoningMessage(
            id=Message.generate_id(),
            date=datetime.now(timezone.utc),
            otid=Message.generate_otid_from_id(Message.generate_id(), 0),
            source="reasoner_model",
            reasoning="First thought: ",
        )
        reasoning_msg2 = ReasoningMessage(
            id=Message.generate_id(),
            date=datetime.now(timezone.utc),
            otid=Message.generate_otid_from_id(Message.generate_id(), 1),
            source="reasoner_model",
            reasoning="Second thought.",
        )
        
        interface.reasoning_messages.append(reasoning_msg1)
        interface.reasoning_messages.append(reasoning_msg2)
        
        content = interface.get_content()
        assert len(content) == 1
        assert isinstance(content[0], ReasoningContent)
        assert content[0].reasoning == "First thought: Second thought."
        assert content[0].is_native is True

    def test_get_content_with_text_only(self, interface):
        """Test get_content() with only text content messages."""
        from letta.schemas.letta_message import AssistantMessage
        from letta.schemas.letta_message_content import TextContent
        from datetime import datetime, timezone
        from letta.schemas.message import Message
        
        # Add assistant messages
        assistant_msg1 = AssistantMessage(
            id=Message.generate_id(),
            content=[TextContent(text="Hello ")],
            date=datetime.now(timezone.utc).isoformat(),
            otid=Message.generate_otid_from_id(Message.generate_id(), 0),
        )
        assistant_msg2 = AssistantMessage(
            id=Message.generate_id(),
            content=[TextContent(text="world!")],
            date=datetime.now(timezone.utc).isoformat(),
            otid=Message.generate_otid_from_id(Message.generate_id(), 1),
        )
        
        interface.content_messages.append(assistant_msg1)
        interface.content_messages.append(assistant_msg2)
        
        content = interface.get_content()
        assert len(content) == 1
        assert isinstance(content[0], TextContent)
        assert content[0].text == "Hello world!"

    def test_get_content_with_reasoning_and_text(self, interface):
        """Test get_content() properly merges reasoning and text content."""
        from letta.schemas.letta_message import ReasoningMessage, AssistantMessage
        from letta.schemas.letta_message_content import TextContent, ReasoningContent
        from datetime import datetime, timezone
        from letta.schemas.message import Message
        
        # Add reasoning messages
        reasoning_msg = ReasoningMessage(
            id=Message.generate_id(),
            date=datetime.now(timezone.utc),
            otid=Message.generate_otid_from_id(Message.generate_id(), 0),
            source="reasoner_model",
            reasoning="I should respond helpfully.",
        )
        interface.reasoning_messages.append(reasoning_msg)
        
        # Add assistant messages
        assistant_msg = AssistantMessage(
            id=Message.generate_id(),
            content=[TextContent(text="Here is my response.")],
            date=datetime.now(timezone.utc).isoformat(),
            otid=Message.generate_otid_from_id(Message.generate_id(), 1),
        )
        interface.content_messages.append(assistant_msg)
        
        content = interface.get_content()
        assert len(content) == 2
        assert isinstance(content[0], ReasoningContent)
        assert content[0].reasoning == "I should respond helpfully."
        assert isinstance(content[1], TextContent)
        assert content[1].text == "Here is my response."

    def test_get_content_with_hidden_reasoning(self, interface):
        """Test get_content() with HiddenReasoningMessage (omitted reasoning)."""
        from letta.schemas.letta_message import HiddenReasoningMessage, AssistantMessage
        from letta.schemas.letta_message_content import TextContent, OmittedReasoningContent
        from datetime import datetime, timezone
        from letta.schemas.message import Message
        
        # Add hidden reasoning message
        hidden_msg = HiddenReasoningMessage(
            id=Message.generate_id(),
            date=datetime.now(timezone.utc),
            state="omitted",
            hidden_reasoning=None,
            otid=Message.generate_otid_from_id(Message.generate_id(), 0),
        )
        interface.content_messages.append(hidden_msg)
        
        # Add assistant message
        assistant_msg = AssistantMessage(
            id=Message.generate_id(),
            content=[TextContent(text="Response")],
            date=datetime.now(timezone.utc).isoformat(),
            otid=Message.generate_otid_from_id(Message.generate_id(), 1),
        )
        interface.content_messages.append(assistant_msg)
        
        content = interface.get_content()
        assert len(content) == 2
        assert isinstance(content[0], OmittedReasoningContent)
        assert isinstance(content[1], TextContent)

    def test_get_tool_call_object_success(self, interface):
        """Test get_tool_call_object() with valid tool call state."""
        from letta.schemas.openai.chat_completion_response import ToolCall
        
        # Set up tool call state
        interface.tool_call_name = "memory_insert"
        interface.tool_call_args = '{"label": "human", "new_str": "test"}'
        interface.tool_call_id = "call_123"
        
        tool_call = interface.get_tool_call_object()
        
        assert isinstance(tool_call, ToolCall)
        assert tool_call.id == "call_123"
        assert tool_call.function.name == "memory_insert"
        assert tool_call.function.arguments == '{"label": "human", "new_str": "test"}'

    def test_get_tool_call_object_missing_name(self, interface):
        """Test get_tool_call_object() raises error when name is missing."""
        interface.tool_call_name = ""
        interface.tool_call_args = '{"test": "value"}'
        interface.tool_call_id = "call_123"
        
        with pytest.raises(ValueError, match="No tool call name available"):
            interface.get_tool_call_object()

    def test_get_tool_call_object_missing_args(self, interface):
        """Test get_tool_call_object() raises error when args are missing."""
        interface.tool_call_name = "test_tool"
        interface.tool_call_args = ""
        interface.tool_call_id = "call_123"
        
        with pytest.raises(ValueError, match="No tool call arguments available"):
            interface.get_tool_call_object()

    def test_get_tool_call_object_missing_id(self, interface):
        """Test get_tool_call_object() raises error when id is missing."""
        interface.tool_call_name = "test_tool"
        interface.tool_call_args = '{"test": "value"}'
        interface.tool_call_id = ""
        
        with pytest.raises(ValueError, match="No tool call ID available"):
            interface.get_tool_call_object()


# ============================================================================
# Mock-based Streaming Tests
# ============================================================================


class MockAsyncStream:
    """Mock AsyncStream that supports async context manager protocol."""
    
    def __init__(self, chunks):
        self.chunks = chunks
        self.index = 0
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self.index >= len(self.chunks):
            raise StopAsyncIteration
        chunk = self.chunks[self.index]
        self.index += 1
        return chunk


# ============================================================================
# Mock Tests for DeepSeek Chat (Standard OpenAI-Compatible Tool Calling)
# ============================================================================


class TestDeepSeekChatStreaming:
    """Test deepseek-chat model with native OpenAI-compatible tool calling.
    
    This tests the original DeepSeek support for basic streaming and native
    tool calls (not the special deepseek-reasoner handling).
    """

    def create_mock_chunk(self, **kwargs):
        """Helper to create mock ChatCompletionChunk objects for deepseek-chat."""
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta = MagicMock()
        chunk.choices[0].delta.content = kwargs.get('content', None)
        chunk.choices[0].delta.role = kwargs.get('role', None)
        chunk.choices[0].delta.tool_calls = kwargs.get('tool_calls', None)
        chunk.choices[0].delta.reasoning_content = None  # deepseek-chat doesn't have reasoning
        chunk.choices[0].finish_reason = kwargs.get('finish_reason', None)
        chunk.model = "deepseek-chat"
        chunk.id = "chatcmpl-test"
        chunk.usage = None
        return chunk

    @pytest.mark.asyncio
    async def test_deepseek_chat_basic_streaming(self):
        """Test basic streaming with deepseek-chat (no tool calls)."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[{"role": "user", "content": "Hello"}],
            tools=[],
            model="deepseek-chat",
        )
        
        # Create mock chunks for a simple text response
        mock_chunks = [
            self.create_mock_chunk(role="assistant", content="Hello"),
            self.create_mock_chunk(content=" there"),
            self.create_mock_chunk(content="!"),
            self.create_mock_chunk(finish_reason="stop"),
        ]
        
        mock_stream = MockAsyncStream(mock_chunks)
        
        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)
        
        # Verify we got assistant messages
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        assert len(assistant_msgs) > 0, "Should have assistant messages"
        
        print("\n✓ DeepSeek Chat basic streaming test passed")

    @pytest.mark.asyncio
    async def test_deepseek_chat_native_tool_calling(self):
        """Test deepseek-chat with native OpenAI-style tool calling."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[{"role": "user", "content": "Update my age to 25"}],
            tools=[{"name": "memory_replace", "description": "Replace memory content"}],
            model="deepseek-chat",
        )
        
        # Create mock chunks simulating native tool call streaming
        # This is how OpenAI (and deepseek-chat) stream tool calls
        def create_tool_call_mock(index, tool_id, name="", arguments=""):
            tc = MagicMock()
            tc.index = index
            tc.id = tool_id
            tc.type = "function"
            tc.function = MagicMock()
            tc.function.name = name
            tc.function.arguments = arguments
            return tc
        
        mock_chunks = [
            self.create_mock_chunk(role="assistant"),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_123", name="memory_replace", arguments="")]
            ),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_123", name="", arguments='{"label":')]
            ),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_123", name="", arguments=' "human",')]
            ),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_123", name="", arguments=' "old_str": "Age: 30",')]
            ),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_123", name="", arguments=' "new_str": "Age: 25"}')]
            ),
            self.create_mock_chunk(finish_reason="tool_calls"),
        ]
        
        mock_stream = MockAsyncStream(mock_chunks)
        
        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)
        
        # Verify we got a tool call message with native tool calling
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) > 0, "Should have tool call messages"
        
        # Verify interface state was set for agent execution
        assert interface.tool_call_name == "memory_replace", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify the tool call was properly parsed
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj is not None, "Should have a tool call object"
        assert tool_call_obj.function.name == "memory_replace"
        
        import json
        args = json.loads(tool_call_obj.function.arguments)
        assert args["label"] == "human"
        assert args["new_str"] == "Age: 25"
        
        print("\n✓ DeepSeek Chat native tool calling test passed")

    @pytest.mark.asyncio
    async def test_deepseek_chat_no_reasoning_content(self):
        """Test that deepseek-chat does not produce reasoning content.
        
        This verifies we don't break when reasoning_content is absent.
        """
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[{"role": "user", "content": "What is 2+2?"}],
            tools=[],
            model="deepseek-chat",
        )
        
        # Create mock chunks with no reasoning_content field
        mock_chunks = [
            self.create_mock_chunk(role="assistant", content="2+2"),
            self.create_mock_chunk(content=" equals"),
            self.create_mock_chunk(content=" 4"),
            self.create_mock_chunk(finish_reason="stop"),
        ]
        
        mock_stream = MockAsyncStream(mock_chunks)
        
        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)
        
        # Verify we got assistant messages but no reasoning messages
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        
        assert len(assistant_msgs) > 0, "Should have assistant messages"
        assert len(reasoning_msgs) == 0, "Should NOT have reasoning messages for deepseek-chat"
        
        print("\n✓ DeepSeek Chat no reasoning content test passed")

    @pytest.mark.asyncio
    async def test_deepseek_chat_end_to_end(self):
        """Complete end-to-end test for deepseek-chat with native tool calling.
        
        This tests the full flow: user message -> assistant response -> tool call
        """
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[
                {"role": "user", "content": "I moved to New York, please update my location"}
            ],
            tools=[
                {"name": "memory_replace", "description": "Replace memory content"},
                {"name": "send_message", "description": "Send message to user"},
            ],
            model="deepseek-chat",
        )
        
        # Create mock chunks simulating:
        # 1. Brief assistant thinking text (optional)
        # 2. Native tool call
        def create_tool_call_mock(index, tool_id, name="", arguments=""):
            tc = MagicMock()
            tc.index = index
            tc.id = tool_id
            tc.type = "function"
            tc.function = MagicMock()
            tc.function.name = name
            tc.function.arguments = arguments
            return tc
        
        mock_chunks = [
            # Optional content before tool call
            self.create_mock_chunk(role="assistant", content="I'll"),
            self.create_mock_chunk(content=" update"),
            self.create_mock_chunk(content=" that."),
            # Native tool call
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(0, "call_456", name="memory_replace", arguments="")]
            ),
            self.create_mock_chunk(
                tool_calls=[create_tool_call_mock(
                    0, "call_456", name="",
                    arguments='{"label": "human", "old_str": "Location: San Francisco, CA", "new_str": "Location: New York, NY"}'
                )]
            ),
            self.create_mock_chunk(finish_reason="tool_calls"),
        ]
        
        mock_stream = MockAsyncStream(mock_chunks)
        
        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)
        
        # Verify we got both assistant content and tool call
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        
        # Should have some assistant messages (the "I'll update that." text)
        assert len(assistant_msgs) > 0, "Should have assistant messages"
        
        # Should have exactly one tool call
        assert len(tool_msgs) > 0, "Should have tool call messages"
        
        # Verify interface state was set for agent execution
        assert interface.tool_call_name == "memory_replace", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify the tool call details
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj is not None
        assert tool_call_obj.function.name == "memory_replace"
        
        import json
        args = json.loads(tool_call_obj.function.arguments)
        assert args["label"] == "human"
        assert "San Francisco" in args["old_str"]
        assert "New York" in args["new_str"]
        
        print("\n✓ DeepSeek Chat end-to-end test passed")


# ============================================================================
# Mock Tests for DeepSeek Reasoner (Manual JSON Function Call Parsing)
# ============================================================================


class TestDeepSeekStreamingWithMocks:
    """Test streaming interface behavior with mocked chunks."""

    def create_mock_chunk(self, **kwargs):
        """Helper to create mock ChatCompletionChunk objects."""
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta = MagicMock()
        chunk.choices[0].delta.content = kwargs.get('content', None)
        chunk.choices[0].delta.reasoning_content = kwargs.get('reasoning_content', None)
        chunk.choices[0].delta.tool_calls = None
        chunk.choices[0].finish_reason = kwargs.get('finish_reason', None)
        chunk.model = kwargs.get('model', 'deepseek-reasoner')
        chunk.id = kwargs.get('id', 'test-id')
        chunk.usage = kwargs.get('usage', None)
        return chunk

    @pytest.mark.asyncio
    async def test_streaming_with_reasoning_content(self):
        """Test that reasoning content chunks are processed correctly."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
        )

        # Create mock chunks with reasoning content
        mock_chunks = [
            self.create_mock_chunk(reasoning_content="First, ", model="deepseek-reasoner"),
            self.create_mock_chunk(reasoning_content="I need to ", model="deepseek-reasoner"),
            self.create_mock_chunk(reasoning_content="think about this...", model="deepseek-reasoner"),
            self.create_mock_chunk(finish_reason="stop", model="deepseek-reasoner"),
        ]

        # Create mock stream
        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got reasoning messages
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        assert len(reasoning_msgs) == 3
        assert all(hasattr(m, 'reasoning') for m in reasoning_msgs)

    @pytest.mark.asyncio
    async def test_streaming_with_single_function_call(self):
        """Test that single function calls are parsed and converted to ToolCallMessage."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[{"name": "memory_insert"}],
            model="deepseek-reasoner",
        )

        # Create mock chunks that form a function call
        mock_chunks = [
            self.create_mock_chunk(content='{"name":'),
            self.create_mock_chunk(content=' "memory_insert"'),
            self.create_mock_chunk(content=', "arguments": '),
            self.create_mock_chunk(content='{"label": "human", "new_str": "test"}'),
            self.create_mock_chunk(content='}'),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got a tool call message
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) == 1, "Should have exactly one tool call message"
        assert tool_msgs[0].tool_calls[0].name == "memory_insert", "Tool call name should be memory_insert"

        # Verify interface state was set for agent execution
        assert interface.tool_call_name == "memory_insert", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify get_tool_call_object() works correctly
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj.function.name == "memory_insert"
        import json
        args = json.loads(tool_call_obj.function.arguments)
        assert args["label"] == "human"
        assert args["new_str"] == "test"

    @pytest.mark.asyncio
    async def test_streaming_with_parallel_function_calls(self):
        """Test that parallel function calls (array) are handled correctly."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[{"name": "memory_insert"}, {"name": "conversation_search"}],
            model="deepseek-reasoner",
        )

        # Create mock chunks that form parallel function calls
        mock_chunks = [
            self.create_mock_chunk(content='[{"name": "memory_insert", '),
            self.create_mock_chunk(content='"arguments": {"label": "human"}}, '),
            self.create_mock_chunk(content='{"name": "conversation_search", '),
            self.create_mock_chunk(content='"arguments": {"query": "test"}}]'),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got a tool call message (should only process first call)
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) == 1, "Should have exactly one tool call message"
        assert tool_msgs[0].tool_calls[0].name == "memory_insert", "Tool call name should be memory_insert"

        # Verify interface state was set with the first function call
        assert interface.tool_call_name == "memory_insert", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify get_tool_call_object() works correctly
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj.function.name == "memory_insert"

    @pytest.mark.asyncio
    async def test_streaming_with_reasoning_and_function_call(self):
        """Test complete DeepSeek Reasoner flow: reasoning followed by function call."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[{"name": "memory_replace"}],
        )

        # Create mock chunks simulating DeepSeek Reasoner's typical response:
        # 1. Reasoning content chunks
        # 2. Function call in content field (as JSON)
        mock_chunks = [
            # Reasoning phase
            self.create_mock_chunk(reasoning_content="The user mentioned ", model="deepseek-reasoner"),
            self.create_mock_chunk(reasoning_content="moving to New York. ", model="deepseek-reasoner"),
            self.create_mock_chunk(reasoning_content="I should update their location in memory.", model="deepseek-reasoner"),
            # Function call phase (JSON in content field)
            self.create_mock_chunk(content='{"name": "memory_replace", ', model="deepseek-reasoner"),
            self.create_mock_chunk(content='"arguments": {"label": "human", ', model="deepseek-reasoner"),
            self.create_mock_chunk(content='"old_str": "Location: San Francisco, CA", ', model="deepseek-reasoner"),
            self.create_mock_chunk(content='"new_str": "Location: New York, NY"}}', model="deepseek-reasoner"),
            self.create_mock_chunk(finish_reason="stop", model="deepseek-reasoner"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got reasoning messages
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        assert len(reasoning_msgs) > 0, "Should have reasoning messages"
        
        # Verify reasoning content
        total_reasoning = "".join(m.reasoning for m in reasoning_msgs)
        assert "moving to new york" in total_reasoning.lower()

        # Verify we got a tool call message
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) == 1, "Should have exactly one tool call message"
        assert tool_msgs[0].tool_calls[0].name == "memory_replace", "Tool call name should be memory_replace"
        
        # Verify interface state for agent execution
        assert interface.tool_call_name == "memory_replace", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify arguments were parsed correctly
        import json
        args = json.loads(interface.tool_call_args)
        assert args["label"] == "human"
        assert "New York" in args["new_str"]
        
        # Verify get_tool_call_object() works correctly
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj.function.name == "memory_replace"
        assert tool_call_obj.id is not None

        print(f"\n✓ Mock test passed: {len(reasoning_msgs)} reasoning chunks, 1 function call")

    @pytest.mark.asyncio
    async def test_end_to_end_agent_interaction(self):
        """
        Complete end-to-end test simulating a full agent interaction with DeepSeek Reasoner.
        This replaces the integration test but uses mocks instead of real API calls.
        
        Scenario: User tells agent they moved to New York, agent reasons about it and updates memory.
        """
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[
                {"role": "user", "content": "I just moved to New York, NY. Please update my location."}
            ],
            tools=[
                {
                    "name": "memory_replace",
                    "description": "Replace content in memory",
                },
                {
                    "name": "send_message",
                    "description": "Send message to user",
                }
            ],
        )

        # Simulate DeepSeek Reasoner's complete response:
        # 1. Reasoning about what to do
        # 2. Function call to update memory
        mock_chunks = [
            # Reasoning phase
            self.create_mock_chunk(
                reasoning_content="The user has informed me they moved from San Francisco to New York. ",
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(
                reasoning_content="I need to update their location in memory. ",
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(
                reasoning_content="Then I should acknowledge the update to them.",
                model="deepseek-reasoner"
            ),
            # Function call: memory_replace
            self.create_mock_chunk(
                content='{"name": "memory_replace", ',
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(
                content='"arguments": {"label": "human", ',
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(
                content='"old_str": "Location: San Francisco, CA", ',
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(
                content='"new_str": "Location: New York, NY"}}',
                model="deepseek-reasoner"
            ),
            self.create_mock_chunk(finish_reason="stop", model="deepseek-reasoner"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify complete interaction
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        
        # Should have reasoning
        assert len(reasoning_msgs) > 0, "Should have reasoning messages"
        total_reasoning = "".join(m.reasoning for m in reasoning_msgs)
        assert "san francisco" in total_reasoning.lower() or "new york" in total_reasoning.lower()
        
        # Should have function call
        assert len(tool_msgs) == 1, "Should have exactly one tool call"
        assert tool_msgs[0].tool_calls[0].name == "memory_replace", "Tool call name should be memory_replace"
        
        # Verify interface state was set correctly for agent execution
        assert interface.tool_call_name == "memory_replace", "Interface should have tool_call_name set"
        assert interface.tool_call_args is not None, "Interface should have tool_call_args set"
        assert interface.tool_call_id is not None, "Interface should have tool_call_id set"
        
        # Verify arguments are correct
        import json
        args = json.loads(interface.tool_call_args)
        assert args["label"] == "human"
        assert "San Francisco" in args["old_str"]
        assert "New York" in args["new_str"]
        
        # Verify get_tool_call_object() works correctly
        tool_call_obj = interface.get_tool_call_object()
        assert tool_call_obj.function.name == "memory_replace"
        assert tool_call_obj.id is not None
        assert "San Francisco" in tool_call_obj.function.arguments
        
        print("\n✓ End-to-end mock test passed: Full agent interaction simulated successfully")


# ============================================================================
# Tests for None Handling (Bug Fixes from DEEPSEEK_REASONER_NONE_HANDLING_ISSUE.md)
# ============================================================================


class TestNoneHandling:
    """Test proper handling of None values in reasoning_content, content, and tool_calls.
    
    These tests verify the fixes for the bugs documented in DEEPSEEK_REASONER_NONE_HANDLING_ISSUE.md:
    - TypeError when content is None (string concatenation with None)
    - TypeError when tool_calls is None (iterating over None)
    """

    def create_mock_chunk(self, **kwargs):
        """Helper to create mock ChatCompletionChunk objects."""
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta = MagicMock()
        chunk.choices[0].delta.content = kwargs.get('content', None)
        chunk.choices[0].delta.reasoning_content = kwargs.get('reasoning_content', None)
        chunk.choices[0].delta.tool_calls = kwargs.get('tool_calls', None)
        chunk.choices[0].finish_reason = kwargs.get('finish_reason', None)
        chunk.model = kwargs.get('model', 'deepseek-reasoner')
        chunk.id = kwargs.get('id', 'test-id')
        chunk.usage = kwargs.get('usage', None)
        return chunk

    @pytest.mark.asyncio
    async def test_none_reasoning_content_handling(self):
        """Test that None reasoning_content doesn't cause crashes."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Create mock chunks with None reasoning_content (should not crash)
        mock_chunks = [
            self.create_mock_chunk(reasoning_content=None, content="Hello"),
            self.create_mock_chunk(reasoning_content=None, content=" world"),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream - should not crash
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got assistant messages but no reasoning messages
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        
        assert len(assistant_msgs) > 0, "Should have assistant messages"
        assert len(reasoning_msgs) == 0, "Should NOT have reasoning messages when reasoning_content is None"

    @pytest.mark.asyncio
    async def test_none_content_handling(self):
        """Test that None content doesn't cause string concatenation errors."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Create mock chunks with None content (common for tool-only responses)
        mock_chunks = [
            self.create_mock_chunk(content=None, reasoning_content="Thinking..."),
            self.create_mock_chunk(content=None, reasoning_content="More thoughts"),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream - should not crash
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got reasoning messages
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        assert len(reasoning_msgs) > 0, "Should have reasoning messages"

    @pytest.mark.asyncio
    async def test_empty_string_content_handling(self):
        """Test that empty string content is handled correctly (not yielded)."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Create mock chunks with empty string content
        mock_chunks = [
            self.create_mock_chunk(content="", reasoning_content="Thinking"),
            self.create_mock_chunk(content="Real content"),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got reasoning and assistant messages
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        
        assert len(reasoning_msgs) > 0, "Should have reasoning messages"
        assert len(assistant_msgs) > 0, "Should have assistant messages"

    @pytest.mark.asyncio
    async def test_none_tool_calls_handling(self):
        """Test that None tool_calls field doesn't cause iteration errors."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[{"name": "test_tool"}],
            model="deepseek-chat",  # deepseek-chat uses native tool_calls
        )

        # Create mock chunks where tool_calls is explicitly None
        mock_chunks = [
            self.create_mock_chunk(content="Response", tool_calls=None),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream - should not crash
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Should get assistant messages without tool calls
        from letta.schemas.letta_message import AssistantMessage
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        assert len(assistant_msgs) > 0, "Should have assistant messages"

    @pytest.mark.asyncio
    async def test_mixed_none_and_content(self):
        """Test streaming with mixed None and actual content values."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Realistic scenario: reasoning first (with None content), then content
        mock_chunks = [
            self.create_mock_chunk(reasoning_content="Analyzing request", content=None),
            self.create_mock_chunk(reasoning_content="Planning response", content=None),
            self.create_mock_chunk(reasoning_content=None, content="Here is"),
            self.create_mock_chunk(reasoning_content=None, content=" my answer"),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got both reasoning and assistant messages
        from letta.schemas.letta_message import AssistantMessage
        reasoning_msgs = [m for m in messages if isinstance(m, ReasoningMessage)]
        assistant_msgs = [m for m in messages if isinstance(m, AssistantMessage)]
        
        assert len(reasoning_msgs) == 2, "Should have 2 reasoning messages"
        assert len(assistant_msgs) == 2, "Should have 2 assistant messages"

    @pytest.mark.asyncio
    async def test_all_none_fields(self):
        """Test chunk with all None fields (edge case)."""
        interface = SimpleOpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Edge case: chunk with all None fields (might happen in practice)
        mock_chunks = [
            self.create_mock_chunk(reasoning_content=None, content=None, tool_calls=None),
            self.create_mock_chunk(content="Real content"),
            self.create_mock_chunk(finish_reason="stop"),
        ]

        mock_stream = MockAsyncStream(mock_chunks)

        # Process the stream - should not crash
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Should get at least some messages
        assert len(messages) > 0, "Should get some messages"


if __name__ == "__main__":
    # Allow running directly for debugging
    pytest.main([__file__, "-v", "-s"])
