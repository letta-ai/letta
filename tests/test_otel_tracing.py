"""
Unit tests for OTEL tracing span attribute handling.

Tests that the @trace_method decorator properly excludes or truncates
large parameters to prevent memory bloat and RESOURCE_EXHAUSTED errors.
"""

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

from letta.otel.tracing import trace_method
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageRole


class CaptureSpanProcessor:
    """Span processor that captures spans for testing."""

    def __init__(self):
        self.spans = []

    def on_start(self, span, parent_context):
        pass

    def on_end(self, span):
        self.spans.append(span)

    def shutdown(self):
        pass

    def force_flush(self, timeout_millis=None):
        pass


class MockAgentState:
    """Mock agent state with configurable size."""

    def __init__(self, size_mb=5):
        self.id = "agent-test-123"
        self.name = "Test Agent"
        self.memory = {"large_data": "X" * int(size_mb * 1024 * 1024)}
        self.message_ids = [f"msg-{i}" for i in range(1000)]

    def __str__(self):
        return f"AgentState(id={self.id}, memory_size={len(str(self.memory))})"


@pytest.fixture(scope="module")
def span_processor():
    """Setup OTEL tracing with span capture."""
    provider = TracerProvider()
    processor = CaptureSpanProcessor()
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    # Initialize letta tracing
    import letta.otel.tracing as tracing_module

    tracing_module._is_tracing_initialized = True

    yield processor

    # Reset
    tracing_module._is_tracing_initialized = False


@pytest.fixture(scope="function", autouse=True)
def clear_spans(span_processor):
    """Clear captured spans before each test."""
    span_processor.spans.clear()
    yield


def create_large_messages(size_mb=5):
    """Create large message list simulating production data."""
    large_text = "CRYPTO SECURITY REPORT:\n" + ("X" * int(size_mb * 1024 * 1024))

    return [
        Message(
            id="message-12345678",
            role=MessageRole.user,
            content=[TextContent(text=large_text)],
            agent_id="agent-12345678-1234-1234-1234-123456789012",
        ),
        Message(
            id="message-87654321",
            role=MessageRole.assistant,
            content=[TextContent(text="I'll analyze that report...")],
            agent_id="agent-12345678-1234-1234-1234-123456789012",
        ),
    ]


def get_span_attributes(span):
    """Extract parameter attributes from a span."""
    attrs = span.attributes or {}
    return {key.replace("parameter.", ""): value for key, value in attrs.items() if key.startswith("parameter.")}


def test_messages_parameter_excluded(span_processor):
    """Test that large messages parameter is excluded from span attributes."""

    @trace_method
    def test_func(messages, agent_state):
        return "success"

    large_messages = create_large_messages(size_mb=5)
    agent_state = MockAgentState(size_mb=5)

    result = test_func(messages=large_messages, agent_state=agent_state)

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # Check messages parameter is excluded
    assert "messages" in attrs
    messages_value = str(attrs["messages"])
    assert "excluded" in messages_value
    assert len(messages_value) < 200  # Should be small (may include IDs)

    # Check agent_state parameter is excluded
    assert "agent_state" in attrs
    agent_state_value = str(attrs["agent_state"])
    assert "excluded" in agent_state_value
    assert len(agent_state_value) < 200


def test_content_parameter_excluded(span_processor):
    """Test that large content parameter is excluded from span attributes."""

    @trace_method
    def test_func(content, agent_state):
        return "success"

    large_content = "C" * (5 * 1024 * 1024)  # 5MB
    agent_state = MockAgentState(size_mb=3)

    result = test_func(content=large_content, agent_state=agent_state)

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # Check content parameter is excluded
    assert "content" in attrs
    content_value = str(attrs["content"])
    assert "excluded" in content_value
    assert len(content_value) < 200


def test_source_code_parameter_excluded(span_processor):
    """Test that large source_code parameter is excluded from span attributes."""

    @trace_method
    def test_func(source_code, tool_name):
        return "success"

    large_source_code = (
        '''
def large_tool(query: str):
    """Tool with large source code."""
    padding = """'''
        + ("X" * (5 * 1024 * 1024))
        + '''"""
    return "test"
'''
    )

    result = test_func(source_code=large_source_code, tool_name="test_tool")

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # Check source_code parameter is excluded
    assert "source_code" in attrs
    source_code_value = str(attrs["source_code"])
    assert "excluded" in source_code_value
    assert len(source_code_value) < 200

    # Check small parameter is kept
    assert "tool_name" in attrs
    assert attrs["tool_name"] == "test_tool"


def test_large_parameter_truncated(span_processor):
    """Test that non-excluded large parameters are truncated."""

    @trace_method
    def test_func(data, small_param):
        return "success"

    # Use a parameter name not in the exclusion list
    large_data = "D" * (2 * 1024 * 1024)  # 2MB
    small_param = "test"

    result = test_func(data=large_data, small_param=small_param)

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # Check large data is truncated
    assert "data" in attrs
    data_value = str(attrs["data"])
    assert len(data_value) < 2048  # Should be truncated to ~1KB + message
    assert "truncated" in data_value

    # Check small param is kept
    assert "small_param" in attrs
    assert attrs["small_param"] == "test"


def test_small_parameters_kept(span_processor):
    """Test that small parameters are kept in full."""

    @trace_method
    def test_func(param1, param2, param3):
        return "success"

    result = test_func(param1="test", param2=123, param3={"key": "value"})

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # All small params should be present
    assert "param1" in attrs
    assert "param2" in attrs
    assert "param3" in attrs

    # Values should match
    assert attrs["param1"] == "test"
    assert "123" in str(attrs["param2"])


def test_total_span_size_reasonable(span_processor):
    """Test that total span attribute size remains reasonable with multiple large params."""

    @trace_method
    def test_func(messages, agent_state, content, source_code):
        return "success"

    large_messages = create_large_messages(size_mb=5)
    agent_state = MockAgentState(size_mb=5)
    large_content = "C" * (5 * 1024 * 1024)
    large_source = "def tool(): padding = '" + ("X" * (5 * 1024 * 1024)) + "'"

    result = test_func(messages=large_messages, agent_state=agent_state, content=large_content, source_code=large_source)

    assert result == "success"
    assert len(span_processor.spans) == 1

    # Calculate total size of all attributes
    attrs = get_span_attributes(span_processor.spans[0])
    total_size = sum(len(str(v)) for v in attrs.values())

    # Total should be < 10KB even though input was ~20MB
    assert total_size < 10 * 1024, f"Total span size {total_size} bytes is too large"

    # Calculate reduction factor
    input_size = 20 * 1024 * 1024  # 20MB
    reduction = input_size / total_size
    assert reduction > 1000, f"Reduction factor {reduction}x is too low"


def test_serialization_failure_handled(span_processor):
    """Test that serialization failures are handled gracefully."""

    class UnserializableObject:
        def __str__(self):
            raise Exception("Cannot serialize")

    @trace_method
    def test_func(obj, normal_param):
        return "success"

    obj = UnserializableObject()

    # Should not raise exception
    result = test_func(obj=obj, normal_param="test")

    assert result == "success"
    assert len(span_processor.spans) == 1

    attrs = get_span_attributes(span_processor.spans[0])

    # Should have a fallback value
    assert "obj" in attrs
    assert "serialization failed" in str(attrs["obj"]) or "excluded" in str(attrs["obj"])

    # Normal param should work
    assert "normal_param" in attrs
    assert attrs["normal_param"] == "test"
