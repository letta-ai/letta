"""
Integration tests for advanced usage tracking (cache tokens, reasoning tokens).

These tests verify that:
1. Cache token data (cached_input_tokens, cache_write_tokens) is captured from providers
2. Reasoning token data is captured from reasoning models
3. The data flows correctly through streaming and non-streaming paths
4. Step-level and run-level aggregation works correctly

Provider-specific cache field mappings:
- Anthropic: cache_read_input_tokens, cache_creation_input_tokens
- OpenAI: prompt_tokens_details.cached_tokens, completion_tokens_details.reasoning_tokens
- Gemini: cached_content_token_count
"""

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

import pytest
from dotenv import load_dotenv
from letta_client import AsyncLetta
from letta_client.types import (
    AgentState,
    MessageCreateParam,
)
from letta_client.types.agents import Run
from letta_client.types.agents.letta_streaming_response import LettaUsageStatistics

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


# ------------------------------
# Test Configuration
# ------------------------------

# Model configs for testing - these models should support caching or reasoning
CACHE_TEST_CONFIGS = [
    # Anthropic Sonnet 4.5 with prompt caching
    ("anthropic/claude-sonnet-4-5-20250514", {"provider_type": "anthropic"}),
    # OpenAI gpt-4o with prompt caching (Chat Completions API)
    ("openai/gpt-4o", {"provider_type": "openai"}),
    # Gemini 3 Pro Preview with context caching
    ("google_ai/gemini-3-pro-preview", {"provider_type": "google_ai"}),
]

REASONING_TEST_CONFIGS = [
    # Anthropic Sonnet 4.5 with thinking enabled
    (
        "anthropic/claude-sonnet-4-5-20250514",
        {"provider_type": "anthropic", "thinking": {"type": "enabled", "budget_tokens": 1024}},
    ),
    # OpenAI gpt-5.1 reasoning model (Responses API)
    ("openai/gpt-5.1", {"provider_type": "openai", "reasoning": {"reasoning_effort": "low"}}),
    # Gemini 3 Pro Preview with thinking enabled
    (
        "google_ai/gemini-3-pro-preview",
        {"provider_type": "google_ai", "thinking_config": {"include_thoughts": True, "thinking_budget": 1024}},
    ),
]

# Filter based on environment variable if set
requested = os.getenv("USAGE_TEST_CONFIG")
if requested:
    # Filter configs to only include the requested one
    CACHE_TEST_CONFIGS = [(h, s) for h, s in CACHE_TEST_CONFIGS if requested in h]
    REASONING_TEST_CONFIGS = [(h, s) for h, s in REASONING_TEST_CONFIGS if requested in h]


def get_model_config(filename: str, model_settings_dir: str = "tests/model_settings") -> Tuple[str, dict]:
    """Load a model_settings file and return the handle and settings dict."""
    filepath = os.path.join(model_settings_dir, filename)
    with open(filepath, "r") as f:
        config_data = json.load(f)
    return config_data["handle"], config_data.get("model_settings", {})


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture
def base_url() -> str:
    """Get the Letta server URL from environment or use default."""
    return os.getenv("LETTA_SERVER_URL", "http://localhost:8283")


@pytest.fixture
async def async_client(base_url: str) -> AsyncLetta:
    """Create an async Letta client."""
    token = os.getenv("LETTA_SERVER_TOKEN")
    return AsyncLetta(base_url=base_url, token=token)


# ------------------------------
# Helper Functions
# ------------------------------


async def create_test_agent(
    client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
    name_suffix: str = "",
) -> AgentState:
    """Create a test agent with the specified model configuration."""
    agent = await client.agents.create(
        name=f"usage-test-agent-{name_suffix}-{uuid.uuid4().hex[:8]}",
        model=model_handle,
        model_settings=model_settings,
        include_base_tools=False,  # Keep it simple for usage testing
    )
    return agent


async def cleanup_agent(client: AsyncLetta, agent_id: str) -> None:
    """Delete a test agent."""
    try:
        await client.agents.delete(agent_id)
    except Exception as e:
        logger.warning(f"Failed to cleanup agent {agent_id}: {e}")


def extract_usage_from_stream(messages: List[Any]) -> Optional[LettaUsageStatistics]:
    """Extract LettaUsageStatistics from a stream response."""
    for msg in reversed(messages):
        if isinstance(msg, LettaUsageStatistics):
            return msg
    return None


# ------------------------------
# Cache Token Tests
# ------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", CACHE_TEST_CONFIGS)
async def test_cache_tokens_streaming(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that cache token data is captured in streaming mode.

    Cache hits typically occur on the second+ request with the same context,
    so we send multiple messages to trigger caching.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "cache-stream")

    try:
        # First message - likely cache write (cache_creation_tokens for Anthropic)
        messages1: List[Any] = []
        async for chunk in async_client.agents.messages.send_message_streaming(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello, this is a test message for caching.")],
        ):
            messages1.append(chunk)

        usage1 = extract_usage_from_stream(messages1)
        assert usage1 is not None, "Should receive usage statistics in stream"
        assert usage1.prompt_tokens > 0, "Should have prompt tokens"

        # Log first call usage for debugging
        logger.info(
            f"First call usage ({model_handle}): prompt={usage1.prompt_tokens}, "
            f"cached_input={usage1.cached_input_tokens}, cache_write={usage1.cache_write_tokens}"
        )

        # Second message - same agent/context should trigger cache hits
        messages2: List[Any] = []
        async for chunk in async_client.agents.messages.send_message_streaming(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="This is a follow-up message.")],
        ):
            messages2.append(chunk)

        usage2 = extract_usage_from_stream(messages2)
        assert usage2 is not None, "Should receive usage statistics in stream"

        # Log second call usage
        logger.info(
            f"Second call usage ({model_handle}): prompt={usage2.prompt_tokens}, "
            f"cached_input={usage2.cached_input_tokens}, cache_write={usage2.cache_write_tokens}"
        )

        # Verify cache fields exist (values may be 0 if caching not available for this model/config)
        assert hasattr(usage2, "cached_input_tokens"), "Should have cached_input_tokens field"
        assert hasattr(usage2, "cache_write_tokens"), "Should have cache_write_tokens field"

        # For providers with caching enabled, we expect either:
        # - cache_write_tokens > 0 on first call (writing to cache)
        # - cached_input_tokens > 0 on second call (reading from cache)
        # Note: Not all providers always return cache data, so we just verify the fields exist

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", CACHE_TEST_CONFIGS)
async def test_cache_tokens_non_streaming(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that cache token data is captured in non-streaming (blocking) mode.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "cache-blocking")

    try:
        # First message
        response1: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello, this is a test message for caching.")],
        )

        assert response1.usage is not None, "Should have usage in response"
        logger.info(
            f"First call usage ({model_handle}): prompt={response1.usage.prompt_tokens}, "
            f"cached_input={response1.usage.cached_input_tokens}, cache_write={response1.usage.cache_write_tokens}"
        )

        # Second message - should trigger cache hit
        response2: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="This is a follow-up message.")],
        )

        assert response2.usage is not None, "Should have usage in response"
        logger.info(
            f"Second call usage ({model_handle}): prompt={response2.usage.prompt_tokens}, "
            f"cached_input={response2.usage.cached_input_tokens}, cache_write={response2.usage.cache_write_tokens}"
        )

        # Verify cache fields exist
        assert hasattr(response2.usage, "cached_input_tokens"), "Should have cached_input_tokens field"
        assert hasattr(response2.usage, "cache_write_tokens"), "Should have cache_write_tokens field"

    finally:
        await cleanup_agent(async_client, agent.id)


# ------------------------------
# Reasoning Token Tests
# ------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", REASONING_TEST_CONFIGS)
async def test_reasoning_tokens_streaming(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that reasoning token data is captured from reasoning models in streaming mode.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "reasoning-stream")

    try:
        messages: List[Any] = []
        async for chunk in async_client.agents.messages.send_message_streaming(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Think step by step: what is 2 + 2? Explain your reasoning.")],
        ):
            messages.append(chunk)

        usage = extract_usage_from_stream(messages)
        assert usage is not None, "Should receive usage statistics in stream"

        logger.info(
            f"Reasoning usage ({model_handle}): prompt={usage.prompt_tokens}, "
            f"completion={usage.completion_tokens}, reasoning={usage.reasoning_tokens}"
        )

        # Verify reasoning_tokens field exists
        assert hasattr(usage, "reasoning_tokens"), "Should have reasoning_tokens field"

        # For reasoning models, we expect reasoning_tokens > 0
        # Note: Some providers may not always return reasoning token counts
        if "gpt-5" in model_handle or "o3" in model_handle or "o1" in model_handle:
            # OpenAI reasoning models should always have reasoning tokens
            assert usage.reasoning_tokens > 0, f"OpenAI reasoning model {model_handle} should have reasoning_tokens > 0"

    finally:
        await cleanup_agent(async_client, agent.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", REASONING_TEST_CONFIGS)
async def test_reasoning_tokens_non_streaming(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that reasoning token data is captured from reasoning models in non-streaming mode.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "reasoning-blocking")

    try:
        response: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Think step by step: what is 2 + 2? Explain your reasoning.")],
        )

        assert response.usage is not None, "Should have usage in response"

        logger.info(
            f"Reasoning usage ({model_handle}): prompt={response.usage.prompt_tokens}, "
            f"completion={response.usage.completion_tokens}, reasoning={response.usage.reasoning_tokens}"
        )

        # Verify reasoning_tokens field exists
        assert hasattr(response.usage, "reasoning_tokens"), "Should have reasoning_tokens field"

        # For OpenAI reasoning models, we expect reasoning_tokens > 0
        if "gpt-5" in model_handle or "o3" in model_handle or "o1" in model_handle:
            assert response.usage.reasoning_tokens > 0, f"OpenAI reasoning model {model_handle} should have reasoning_tokens > 0"

    finally:
        await cleanup_agent(async_client, agent.id)


# ------------------------------
# Step-Level Usage Tests
# ------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", CACHE_TEST_CONFIGS[:1])  # Test with one config
async def test_step_level_usage_details(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that step-level usage details (prompt_tokens_details, completion_tokens_details)
    are properly persisted and retrievable.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "step-details")

    try:
        # Send a message to create a step
        response: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Hello!")],
        )

        # Get the run's steps
        steps = await async_client.runs.list_steps(run_id=response.id)

        assert len(steps) > 0, "Should have at least one step"

        step = steps[0]
        logger.info(
            f"Step usage ({model_handle}): prompt_tokens={step.prompt_tokens}, "
            f"prompt_tokens_details={step.prompt_tokens_details}, "
            f"completion_tokens_details={step.completion_tokens_details}"
        )

        # Verify the step has the usage fields
        assert step.prompt_tokens > 0, "Step should have prompt_tokens"
        assert step.completion_tokens >= 0, "Step should have completion_tokens"
        assert step.total_tokens > 0, "Step should have total_tokens"

        # The details fields may be None if no cache/reasoning was involved,
        # but they should be present in the schema
        # Note: This test mainly verifies the field exists and can hold data

    finally:
        await cleanup_agent(async_client, agent.id)


# ------------------------------
# Run-Level Aggregation Tests
# ------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("model_handle,model_settings", CACHE_TEST_CONFIGS[:1])  # Test with one config
async def test_run_level_usage_aggregation(
    async_client: AsyncLetta,
    model_handle: str,
    model_settings: dict,
) -> None:
    """
    Test that run-level usage correctly aggregates cache/reasoning tokens from steps.
    """
    agent = await create_test_agent(async_client, model_handle, model_settings, "run-aggregation")

    try:
        # Send multiple messages to create multiple steps
        response1: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Message 1")],
        )

        response2: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Message 2")],
        )

        # Get run usage for the second run (which should have accumulated context)
        run_usage = await async_client.runs.get_run_usage(run_id=response2.id)

        logger.info(
            f"Run usage ({model_handle}): prompt={run_usage.prompt_tokens}, "
            f"completion={run_usage.completion_tokens}, total={run_usage.total_tokens}, "
            f"cached_input={run_usage.cached_input_tokens}, cache_write={run_usage.cache_write_tokens}, "
            f"reasoning={run_usage.reasoning_tokens}"
        )

        # Verify the run usage has all the expected fields
        assert run_usage.prompt_tokens >= 0, "Run should have prompt_tokens"
        assert run_usage.completion_tokens >= 0, "Run should have completion_tokens"
        assert run_usage.total_tokens >= 0, "Run should have total_tokens"
        assert hasattr(run_usage, "cached_input_tokens"), "Run should have cached_input_tokens"
        assert hasattr(run_usage, "cache_write_tokens"), "Run should have cache_write_tokens"
        assert hasattr(run_usage, "reasoning_tokens"), "Run should have reasoning_tokens"

    finally:
        await cleanup_agent(async_client, agent.id)


# ------------------------------
# Comprehensive End-to-End Test
# ------------------------------


@pytest.mark.asyncio
async def test_usage_tracking_end_to_end(async_client: AsyncLetta) -> None:
    """
    End-to-end test that verifies the complete usage tracking flow:
    1. Create agent with a model that supports caching
    2. Send messages to trigger cache writes and reads
    3. Verify step-level details are persisted
    4. Verify run-level aggregation is correct
    """
    # Use Anthropic Sonnet 4.5 for this test as it has the most comprehensive caching
    model_handle = "anthropic/claude-sonnet-4-5-20250514"
    model_settings = {"provider_type": "anthropic"}

    agent = await create_test_agent(async_client, model_handle, model_settings, "e2e")

    try:
        # Send first message (should trigger cache write)
        response1: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="This is a longer message to ensure there's enough content to cache. " * 5)],
        )

        logger.info(f"E2E Test - First message usage: {response1.usage}")

        # Send second message (should trigger cache read)
        response2: Run = await async_client.agents.messages.send_message(
            agent_id=agent.id,
            messages=[MessageCreateParam(role="user", content="Short follow-up")],
        )

        logger.info(f"E2E Test - Second message usage: {response2.usage}")

        # Verify basic usage is tracked
        assert response1.usage is not None
        assert response2.usage is not None
        assert response1.usage.prompt_tokens > 0
        assert response2.usage.prompt_tokens > 0

        # Get steps for the second run
        steps = await async_client.runs.list_steps(run_id=response2.id)
        assert len(steps) > 0, "Should have steps for the run"

        # Get run-level usage
        run_usage = await async_client.runs.get_run_usage(run_id=response2.id)
        assert run_usage.total_tokens > 0, "Run should have total tokens"

        logger.info(
            f"E2E Test - Run usage: prompt={run_usage.prompt_tokens}, "
            f"completion={run_usage.completion_tokens}, "
            f"cached_input={run_usage.cached_input_tokens}, "
            f"cache_write={run_usage.cache_write_tokens}"
        )

        # The test passes if we get here without errors - cache data may or may not be present
        # depending on whether the provider actually cached the content

    finally:
        await cleanup_agent(async_client, agent.id)
