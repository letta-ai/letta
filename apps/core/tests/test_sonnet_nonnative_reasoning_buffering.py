"""Test to verify streaming behavior of Anthropic models with and without native reasoning.

This test confirms:
1. Sonnet 3.5 (20241022) with non-native reasoning exhibits batch streaming (API limitation)
   - UPDATE: With fine-grained-tool-streaming beta header, this may improve
2. Sonnet 4 (20250514) with native reasoning should stream progressively
3. GPT-4.1 streams progressively as expected

Note: We've added the 'fine-grained-tool-streaming-2025-05-14' beta header to potentially
improve streaming performance with Anthropic models, especially for tool call parameters.
"""

import os
import time
from typing import List, Tuple

import pytest
from letta_client import Letta, MessageCreate

from tests.utils import wait_for_server


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

    # Override the base_url if the LETTA_API_URL is set
    base_url = api_url if api_url else server_url
    # create the Letta client
    yield Letta(base_url=base_url, token=None)


@pytest.fixture
def agent_factory(client: Letta):
    """Factory fixture to create agents with different models."""
    created_agents = []

    def _create_agent(model_name: str):
        """Create an agent with the specified model."""
        # Check for required API keys
        if "claude" in model_name.lower():
            anthropic_key = os.getenv("ANTHROPIC_API_KEY")
            if not anthropic_key:
                pytest.skip("ANTHROPIC_API_KEY not set, skipping Anthropic test")
        elif "gpt" in model_name.lower():
            openai_key = os.getenv("OPENAI_API_KEY")
            if not openai_key:
                pytest.skip("OPENAI_API_KEY not set, skipping OpenAI test")

        agent_state = client.agents.create(
            name=f"test_agent_{model_name.replace('/', '_').replace('.', '_')}",
            memory_blocks=[{"label": "human", "value": "Test user"}, {"label": "persona", "value": "You are a creative storyteller."}],
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
            pass  # Agent might have already been deleted


def detect_burst_chunks(chunks: List[Tuple[float, any]], burst_threshold: float = 0.05) -> List[List[int]]:
    """
    Detect bursts of chunks arriving close together in time.

    Args:
        chunks: List of (timestamp, chunk) tuples
        burst_threshold: Maximum time difference (in seconds) to consider chunks as part of the same burst

    Returns:
        List of bursts, where each burst is a list of chunk indices
    """
    if not chunks:
        return []

    bursts = []
    current_burst = [0]

    for i in range(1, len(chunks)):
        time_diff = chunks[i][0] - chunks[i - 1][0]
        if time_diff <= burst_threshold:
            # Part of the same burst
            current_burst.append(i)
        else:
            # New burst
            if len(current_burst) > 1:  # Only count as burst if more than 1 chunk
                bursts.append(current_burst)
            current_burst = [i]

    # Don't forget the last burst
    if len(current_burst) > 1:
        bursts.append(current_burst)

    return bursts


@pytest.mark.parametrize(
    "model,expected_buffering",
    [
        ("anthropic/claude-3-5-sonnet-20241022", False),  # With fine-grained streaming beta, should stream better
        ("anthropic/claude-sonnet-4-20250514", False),  # Sonnet 4 should NOT show buffering (has native reasoning)
        ("openai/gpt-4.1", False),  # GPT-4.1 should NOT show buffering (uses native reasoning)
    ],
)
def test_streaming_buffering_behavior(client: Letta, agent_factory, model: str, expected_buffering: bool):
    """
    Test streaming behavior for different models.

    With fine-grained-tool-streaming beta header:
    - Sonnet 3.5 (20241022) should now stream progressively (beta feature improves tool streaming)
    - Sonnet 4 (20250514) with native reasoning should stream progressively without buffering
    - GPT-4.1 should stream progressively without buffering
    """
    print(f"\n=== Testing Streaming Behavior for {model} ===")
    print(f"Expected buffering: {expected_buffering}")

    # Create agent with the specified model
    agent = agent_factory(model)

    # Send a message that should generate reasoning and tool calls
    # This prompt should trigger inner thoughts and then a response
    user_message = "Think step by step about what makes a good story, then write me a creative story about a toad named Ted. Make it exactly 3 paragraphs long."

    # Create the stream
    response_stream = client.agents.messages.create_stream(
        agent_id=agent.id, messages=[MessageCreate(role="user", content=user_message)], stream_tokens=True  # Enable token streaming
    )

    # Collect chunks with timestamps
    chunks_with_time = []
    reasoning_chunks = []
    assistant_chunks = []
    tool_chunks = []

    start_time = time.time()

    try:
        for chunk in response_stream:
            elapsed = time.time() - start_time
            chunks_with_time.append((elapsed, chunk))

            # Categorize chunks by type
            chunk_type = type(chunk).__name__
            chunk_info = f"[{elapsed:.3f}s] {chunk_type}"

            # Check for different message types
            if hasattr(chunk, "message_type"):
                chunk_info += f" (message_type: {chunk.message_type})"
                if chunk.message_type == "reasoning_message":
                    reasoning_chunks.append((elapsed, chunk))
                elif chunk.message_type == "assistant_message":
                    assistant_chunks.append((elapsed, chunk))
                elif chunk.message_type == "tool_call_message":
                    tool_chunks.append((elapsed, chunk))
            elif type(chunk).__name__ == "ReasoningMessage":
                chunk_info += " (ReasoningMessage)"
                reasoning_chunks.append((elapsed, chunk))
            elif type(chunk).__name__ == "AssistantMessage":
                chunk_info += " (AssistantMessage)"
                assistant_chunks.append((elapsed, chunk))
            elif type(chunk).__name__ == "ToolCallMessage":
                chunk_info += " (ToolCallMessage)"
                tool_chunks.append((elapsed, chunk))

            # Check for inner thoughts (in tool calls for non-native reasoning)
            if hasattr(chunk, "tool_calls") and chunk.tool_calls:
                for tool_call in chunk.tool_calls:
                    if hasattr(tool_call, "function") and hasattr(tool_call.function, "arguments"):
                        # Check if this is inner thoughts
                        if "inner_thoughts" in str(tool_call.function.arguments):
                            chunk_info += " [contains inner_thoughts]"
                            tool_chunks.append((elapsed, chunk))

            print(chunk_info)

            # Optional: print chunk content snippet for debugging
            if hasattr(chunk, "content") and chunk.content:
                content_preview = str(chunk.content)[:100]
                if content_preview:
                    print(f"  Content: {content_preview}...")

    except Exception as e:
        print(f"Stream error: {e}")
        import traceback

        traceback.print_exc()

    # Analyze results
    print(f"\n=== Analysis ===")
    print(f"Total chunks: {len(chunks_with_time)}")
    print(f"Reasoning chunks: {len(reasoning_chunks)}")
    print(f"Assistant chunks: {len(assistant_chunks)}")
    print(f"Tool chunks: {len(tool_chunks)}")

    # Detect bursts for each type
    if reasoning_chunks:
        reasoning_bursts = detect_burst_chunks(reasoning_chunks)
        print(f"\nReasoning bursts detected: {len(reasoning_bursts)}")
        for i, burst in enumerate(reasoning_bursts):
            burst_times = [reasoning_chunks[idx][0] for idx in burst]
            print(f"  Burst {i+1}: {len(burst)} chunks from {burst_times[0]:.3f}s to {burst_times[-1]:.3f}s")

    if assistant_chunks:
        assistant_bursts = detect_burst_chunks(assistant_chunks)
        print(f"\nAssistant bursts detected: {len(assistant_bursts)}")
        for i, burst in enumerate(assistant_bursts):
            burst_times = [assistant_chunks[idx][0] for idx in burst]
            print(f"  Burst {i+1}: {len(burst)} chunks from {burst_times[0]:.3f}s to {burst_times[-1]:.3f}s")

    if tool_chunks:
        tool_bursts = detect_burst_chunks(tool_chunks)
        print(f"\nTool call bursts detected: {len(tool_bursts)}")
        for i, burst in enumerate(tool_bursts):
            burst_times = [tool_chunks[idx][0] for idx in burst]
            print(f"  Burst {i+1}: {len(burst)} chunks from {burst_times[0]:.3f}s to {burst_times[-1]:.3f}s")

    # Analyze results based on expected behavior
    print(f"\n=== Test Results ===")

    # Check if we detected large bursts
    has_significant_bursts = False

    if reasoning_chunks:
        reasoning_bursts = detect_burst_chunks(reasoning_chunks, burst_threshold=0.1)
        if reasoning_bursts:
            largest_burst = max(reasoning_bursts, key=len)
            burst_percentage = len(largest_burst) / len(reasoning_chunks) * 100
            print(f"\nLargest reasoning burst: {len(largest_burst)}/{len(reasoning_chunks)} chunks ({burst_percentage:.1f}%)")

            if burst_percentage >= 80:  # Consider 80%+ as significant buffering
                has_significant_bursts = True
                print(f"  -> BUFFERING DETECTED: {burst_percentage:.1f}% of reasoning chunks in single burst")

    if assistant_chunks:
        assistant_bursts = detect_burst_chunks(assistant_chunks, burst_threshold=0.1)
        if assistant_bursts:
            largest_burst = max(assistant_bursts, key=len)
            burst_percentage = len(largest_burst) / len(assistant_chunks) * 100
            print(f"Largest assistant burst: {len(largest_burst)}/{len(assistant_chunks)} chunks ({burst_percentage:.1f}%)")

            if burst_percentage >= 80:
                has_significant_bursts = True
                print(f"  -> BUFFERING DETECTED: {burst_percentage:.1f}% of assistant chunks in single burst")

    if tool_chunks:
        tool_bursts = detect_burst_chunks(tool_chunks, burst_threshold=0.1)
        if tool_bursts:
            largest_burst = max(tool_bursts, key=len)
            burst_percentage = len(largest_burst) / len(tool_chunks) * 100
            print(f"Largest tool burst: {len(largest_burst)}/{len(tool_chunks)} chunks ({burst_percentage:.1f}%)")

            if burst_percentage >= 80:
                has_significant_bursts = True
                print(f"  -> BUFFERING DETECTED: {burst_percentage:.1f}% of tool chunks in single burst")

    # Overall streaming analysis
    total_time = chunks_with_time[-1][0] if chunks_with_time else 0
    avg_time_between = total_time / len(chunks_with_time) if chunks_with_time else 0
    print(f"\nTotal streaming time: {total_time:.2f}s")
    print(f"Average time between chunks: {avg_time_between:.3f}s")

    # Verify test expectations
    if expected_buffering:
        assert has_significant_bursts, (
            f"Expected buffering behavior for {model}, but streaming appeared progressive. "
            f"This suggests the issue may be fixed or the test isn't detecting it properly."
        )
        print(f"\n✓ Test PASSED: {model} shows expected buffering behavior")
    else:
        assert not has_significant_bursts, (
            f"Did NOT expect buffering for {model}, but detected significant burst behavior. "
            f"This suggests {model} may also have streaming issues."
        )
        print(f"\n✓ Test PASSED: {model} shows expected progressive streaming")


if __name__ == "__main__":
    # Allow running directly for debugging
    pytest.main([__file__, "-v", "-s"])
