"""Test DeepSeek Reasoner streaming with reasoning content and function calling.

This test verifies:
1. JSON function call parsing (single and parallel calls)
2. Streaming behavior with reasoning content
3. Function call execution with manual JSON parsing
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from letta_client import Letta, MessageCreate

from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
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
        return OpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            requires_approval_tools=[],
            model="deepseek-reasoner",
        )

    def test_parse_complete_single_function_call(self, interface):
        """Test parsing a complete single function call."""
        json_text = '{"name": "memory_insert", "arguments": {"label": "human", "new_str": "Age: 37"}}'
        
        is_complete, parsed = interface._try_parse_json_function_call(json_text)
        
        assert is_complete is True
        assert isinstance(parsed, dict)
        assert parsed["name"] == "memory_insert"
        assert parsed["arguments"]["label"] == "human"
        assert parsed["arguments"]["new_str"] == "Age: 37"

    def test_parse_complete_parallel_function_calls(self, interface):
        """Test parsing parallel function calls (array)."""
        json_text = '''[
            {"name": "memory_insert", "arguments": {"label": "human", "new_str": "Age: 37"}},
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
# Mock-based Streaming Tests
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
        chunk.model = kwargs.get('model', 'deepseek-reasoner')
        chunk.id = kwargs.get('id', 'test-id')
        chunk.usage = kwargs.get('usage', None)
        return chunk

    @pytest.mark.asyncio
    async def test_streaming_with_reasoning_content(self):
        """Test that reasoning content chunks are processed correctly."""
        interface = OpenAIStreamingInterface(
            is_openai_proxy=False,
            messages=[],
            tools=[],
            model="deepseek-reasoner",
        )

        # Create mock chunks with reasoning content
        mock_chunks = [
            self.create_mock_chunk(reasoning_content="First, "),
            self.create_mock_chunk(reasoning_content="I need to "),
            self.create_mock_chunk(reasoning_content="think about this..."),
        ]

        # Create async mock stream
        async def async_iter(items):
            for item in items:
                yield item

        mock_stream = async_iter(mock_chunks)

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
        interface = OpenAIStreamingInterface(
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

        async def async_iter(items):
            for item in items:
                yield item

        mock_stream = async_iter(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got a tool call message
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) == 1
        assert tool_msgs[0].tool_call.name == "memory_insert"

        # Verify interface state was set for agent execution
        assert interface.tool_call_name == "memory_insert"
        assert interface.tool_call_args is not None
        assert interface.tool_call_id is not None

    @pytest.mark.asyncio
    async def test_streaming_with_parallel_function_calls(self):
        """Test that parallel function calls (array) are handled correctly."""
        interface = OpenAIStreamingInterface(
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

        async def async_iter(items):
            for item in items:
                yield item

        mock_stream = async_iter(mock_chunks)

        # Process the stream
        messages = []
        async for msg in interface.process(mock_stream):
            messages.append(msg)

        # Verify we got a tool call message (should only process first call)
        tool_msgs = [m for m in messages if isinstance(m, ToolCallMessage)]
        assert len(tool_msgs) == 1
        assert tool_msgs[0].tool_call.name == "memory_insert"

        # Verify interface state was set with the first function call
        assert interface.tool_call_name == "memory_insert"


# ============================================================================
# Integration Tests with Real Server (Optional)
# ============================================================================


def run_server():
    """Start the Letta server."""
    from dotenv import load_dotenv

    load_dotenv()
    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(scope="module")
def client():
    """Create a Letta client for testing."""
    import threading

    # Get URL from environment or start server
    api_url = os.getenv("LETTA_API_URL")
    server_url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)
    print("Running client tests with server:", server_url)

    base_url = api_url if api_url else server_url
    yield Letta(base_url=base_url, token=None)


@pytest.fixture
def agent_factory(client: Letta):
    """Factory fixture to create agents with different models."""
    created_agents = []

    def _create_agent(model_name: str):
        """Create an agent with the specified model."""
        # Check for DeepSeek API key
        if "deepseek" in model_name.lower():
            deepseek_key = os.getenv("DEEPSEEK_API_KEY")
            if not deepseek_key:
                pytest.skip("DEEPSEEK_API_KEY not set, skipping DeepSeek test")

        agent_state = client.agents.create(
            name=f"test_agent_{model_name.replace('/', '_').replace('.', '_')}",
            memory_blocks=[
                {"label": "human", "value": "Name: John\nLocation: Brighton, UK"},
                {"label": "persona", "value": "You are a helpful assistant."}
            ],
            model=model_name,
            embedding="letta/letta-free",
        )
        created_agents.append(agent_state)
        return agent_state

    yield _create_agent

    # Cleanup all created agents
    for agent_state in created_agents:
        try:
            client.agents.delete(agent_state.id)
        except:
            pass


@pytest.mark.integration
def test_deepseek_reasoner_with_function_calls(client: Letta, agent_factory):
    """
    Integration test: Verify DeepSeek Reasoner can execute function calls via streaming.
    
    Note: This test requires DEEPSEEK_API_KEY and will make real API calls.
    Mark with @pytest.mark.integration and skip if key not present.
    """
    print("\n=== Testing DeepSeek Reasoner Function Calling ===")

    # Create agent with deepseek-reasoner
    agent = agent_factory("deepseek-reasoner")

    # Send a message that should trigger a memory update
    user_message = "I just moved to Hove, UK. Please update my location."

    # Create the stream
    response_stream = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content=user_message)],
        stream_tokens=True,
    )

    # Collect chunks
    reasoning_chunks = []
    assistant_chunks = []
    tool_call_chunks = []

    for chunk in response_stream:
        if hasattr(chunk, "message_type"):
            if chunk.message_type == "reasoning_message":
                reasoning_chunks.append(chunk)
            elif chunk.message_type == "assistant_message":
                assistant_chunks.append(chunk)
            elif chunk.message_type == "tool_call_message":
                tool_call_chunks.append(chunk)

    # Verify we got reasoning content
    assert len(reasoning_chunks) > 0, "Expected reasoning chunks from deepseek-reasoner"
    print(f"✓ Received {len(reasoning_chunks)} reasoning chunks")

    # Verify we got a function call
    assert len(tool_call_chunks) > 0, "Expected tool call chunk for memory update"
    print(f"✓ Received {len(tool_call_chunks)} tool call chunks")

    # Verify the function call was for memory update
    tool_call = tool_call_chunks[0].tool_call
    assert tool_call.name in ["memory_replace", "memory_insert"], f"Expected memory function, got {tool_call.name}"
    print(f"✓ Function call was for memory update: {tool_call.name}")

    print("\n✓ Test PASSED: DeepSeek Reasoner streaming with function calls works correctly")


if __name__ == "__main__":
    # Allow running directly for debugging
    pytest.main([__file__, "-v", "-s"])

