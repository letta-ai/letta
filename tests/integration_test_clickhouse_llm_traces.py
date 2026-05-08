"""
Integration tests for ClickHouse-backed LLM raw traces.

Validates that:
1) Agent message requests are stored in ClickHouse (request_json contains the message)
2) Summarization traces are stored and retrievable by step_id
3) Error traces are stored with is_error, error_type, and error_message
4) llm_config_json is properly stored
5) Cache and usage statistics are stored (cached_input_tokens, cache_write_tokens, reasoning_tokens)
"""

import asyncio
import json
import os
import time
import uuid

import pytest

from letta.agents.letta_agent_v3 import LettaAgentV3
from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.run import Run
from letta.server.server import SyncServer
from letta.services.llm_trace_reader import get_llm_trace_reader
from letta.services.provider_trace_backends import get_provider_trace_backends
from letta.services.summarizer.summarizer import simple_summary
from letta.settings import settings, telemetry_settings


def _require_clickhouse_env() -> dict[str, str]:
    endpoint = os.getenv("CLICKHOUSE_ENDPOINT")
    password = os.getenv("CLICKHOUSE_PASSWORD")
    if not endpoint or not password:
        pytest.skip("ClickHouse env vars not set (CLICKHOUSE_ENDPOINT, CLICKHOUSE_PASSWORD)")
    return {
        "endpoint": endpoint,
        "password": password,
        "username": os.getenv("CLICKHOUSE_USERNAME", "default"),
        "database": os.getenv("CLICKHOUSE_DATABASE", "otel"),
    }


def _anthropic_llm_config() -> LLMConfig:
    return LLMConfig(
        model="claude-haiku-4-5-20251001",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=200000,
        max_tokens=2048,
        put_inner_thoughts_in_kwargs=False,
        enable_reasoner=False,
    )


@pytest.fixture
async def server():
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=True)
    await server.init_async()
    await server.tool_manager.upsert_base_tools_async(actor=server.default_user)
    yield server


@pytest.fixture
async def actor(server: SyncServer):
    return server.default_user


@pytest.fixture
def clickhouse_settings():
    env = _require_clickhouse_env()

    original_values = {
        "endpoint": settings.clickhouse_endpoint,
        "username": settings.clickhouse_username,
        "password": settings.clickhouse_password,
        "database": settings.clickhouse_database,
        "store_llm_traces": settings.store_llm_traces,
        "provider_trace_backend": telemetry_settings.provider_trace_backend,
    }

    settings.clickhouse_endpoint = env["endpoint"]
    settings.clickhouse_username = env["username"]
    settings.clickhouse_password = env["password"]
    settings.clickhouse_database = env["database"]
    settings.store_llm_traces = True

    # Configure telemetry to use clickhouse backend (set the underlying field, not the property)
    telemetry_settings.provider_trace_backend = "clickhouse"
    # Clear the cached backends so they get recreated with new settings
    get_provider_trace_backends.cache_clear()

    yield

    settings.clickhouse_endpoint = original_values["endpoint"]
    settings.clickhouse_username = original_values["username"]
    settings.clickhouse_password = original_values["password"]
    settings.clickhouse_database = original_values["database"]
    settings.store_llm_traces = original_values["store_llm_traces"]
    telemetry_settings.provider_trace_backend = original_values["provider_trace_backend"]
    # Clear cache again to restore original backends
    get_provider_trace_backends.cache_clear()


async def _wait_for_raw_trace(step_id: str, organization_id: str, timeout_seconds: int = 30):
    """Wait for a trace to appear in ClickHouse.

    With async_insert + wait_for_async_insert=1, traces should appear quickly,
    but we poll to handle any propagation delay.
    """
    reader = get_llm_trace_reader()
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        trace = await reader.get_by_step_id_async(step_id=step_id, organization_id=organization_id)
        if trace is not None:
            return trace
        await asyncio.sleep(0.5)

    raise AssertionError(f"Timed out waiting for raw trace with step_id={step_id}")


@pytest.mark.asyncio
async def test_agent_message_stored_in_clickhouse(server: SyncServer, actor, clickhouse_settings):
    """Test that agent step traces are stored with all fields including llm_config_json."""
    message_text = f"ClickHouse trace test {uuid.uuid4()}"
    llm_config = _anthropic_llm_config()

    agent_state = await server.agent_manager.create_agent_async(
        CreateAgent(
            name=f"clickhouse_agent_{uuid.uuid4().hex[:8]}",
            llm_config=llm_config,
            embedding_config=EmbeddingConfig.default_config(model_name="letta"),
        ),
        actor=actor,
    )

    agent = LettaAgentV3(agent_state=agent_state, actor=actor)
    run = await server.run_manager.create_run(
        Run(agent_id=agent_state.id),
        actor=actor,
    )
    run_id = run.id
    response = await agent.step(
        [MessageCreate(role=MessageRole.user, content=[TextContent(text=message_text)])],
        run_id=run_id,
    )

    step_id = next(msg.step_id for msg in reversed(response.messages) if msg.step_id)
    trace = await _wait_for_raw_trace(step_id=step_id, organization_id=actor.organization_id)

    # Basic trace fields
    assert trace.step_id == step_id
    assert message_text in trace.request_json
    assert trace.is_error is False
    assert trace.error_type is None
    assert trace.error_message is None

    # Verify llm_config_json is stored and contains expected fields
    assert trace.llm_config_json, "llm_config_json should not be empty"
    config_data = json.loads(trace.llm_config_json)
    assert config_data.get("model") == llm_config.model
    assert "context_window" in config_data
    assert "max_tokens" in config_data

    # Token usage should be populated
    assert trace.prompt_tokens > 0
    assert trace.completion_tokens >= 0
    assert trace.total_tokens > 0


@pytest.mark.asyncio
async def test_summary_stored_with_content_and_usage(server: SyncServer, actor, clickhouse_settings):
    """Test that summarization traces are stored with content, usage, and cache info."""
    step_id = f"step-{uuid.uuid4()}"
    llm_config = _anthropic_llm_config()
    summary_source_messages = [
        Message(role=MessageRole.system, content=[TextContent(text="System prompt")]),
        Message(role=MessageRole.user, content=[TextContent(text="User message 1")]),
        Message(role=MessageRole.assistant, content=[TextContent(text="Assistant response 1")]),
        Message(role=MessageRole.user, content=[TextContent(text="User message 2")]),
    ]

    summary_text = await simple_summary(
        messages=summary_source_messages,
        llm_config=llm_config,
        actor=actor,
        agent_id=f"agent-{uuid.uuid4()}",
        agent_tags=["test", "clickhouse"],
        run_id=f"run-{uuid.uuid4()}",
        step_id=step_id,
        compaction_settings={"mode": "partial_evict", "message_buffer_limit": 60},
    )

    trace = await _wait_for_raw_trace(step_id=step_id, organization_id=actor.organization_id)

    # Basic assertions
    assert trace.step_id == step_id
    assert trace.call_type == "summarization"
    assert trace.is_error is False

    # Verify llm_config_json is stored
    assert trace.llm_config_json, "llm_config_json should not be empty"
    config_data = json.loads(trace.llm_config_json)
    assert config_data.get("model") == llm_config.model

    # Verify summary content in response
    summary_in_response = False
    try:
        response_payload = json.loads(trace.response_json)
        if isinstance(response_payload, dict):
            if "choices" in response_payload:
                content = response_payload.get("choices", [{}])[0].get("message", {}).get("content", "")
                summary_in_response = summary_text.strip() in (content or "")
            elif "content" in response_payload:
                summary_in_response = summary_text.strip() in (response_payload.get("content") or "")
    except Exception:
        summary_in_response = False

    assert summary_in_response or summary_text in trace.response_json

    # Token usage should be populated
    assert trace.prompt_tokens > 0
    assert trace.total_tokens > 0

    # Cache fields may or may not be populated depending on provider response
    # Just verify they're accessible (not erroring)
    _ = trace.cached_input_tokens
    _ = trace.cache_write_tokens
    _ = trace.reasoning_tokens


@pytest.mark.asyncio
async def test_error_trace_stored_in_clickhouse(server: SyncServer, actor, clickhouse_settings):
    """Test that error traces are stored with is_error=True and error details."""
    from letta.llm_api.anthropic_client import AnthropicClient

    step_id = f"step-error-{uuid.uuid4()}"

    # Create a client with invalid config to trigger an error
    invalid_llm_config = LLMConfig(
        model="invalid-model-that-does-not-exist",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=200000,
        max_tokens=2048,
    )

    from letta.services.telemetry_manager import TelemetryManager

    client = AnthropicClient()
    client.set_telemetry_context(
        telemetry_manager=TelemetryManager(),
        agent_id=f"agent-{uuid.uuid4()}",
        run_id=f"run-{uuid.uuid4()}",
        step_id=step_id,
        call_type="agent_step",
        org_id=actor.organization_id,
    )
    client.actor = actor

    # Make a request that will fail
    request_data = {
        "model": invalid_llm_config.model,
        "messages": [{"role": "user", "content": "test"}],
        "max_tokens": 100,
    }

    try:
        await client.request_async_with_telemetry(request_data, invalid_llm_config)
    except Exception:
        pass  # Expected to fail

    # Wait for the error trace to be written
    trace = await _wait_for_raw_trace(step_id=step_id, organization_id=actor.organization_id)

    # Verify error fields
    assert trace.step_id == step_id
    assert trace.is_error is True
    assert trace.error_type is not None, "error_type should be set for error traces"
    assert trace.error_message is not None, "error_message should be set for error traces"

    # Verify llm_config_json is still stored even for errors
    assert trace.llm_config_json, "llm_config_json should be stored even for error traces"
    config_data = json.loads(trace.llm_config_json)
    assert config_data.get("model") == invalid_llm_config.model


@pytest.mark.asyncio
async def test_cache_tokens_stored_for_anthropic(server: SyncServer, actor, clickhouse_settings):
    """Test that Anthropic cache tokens (cached_input_tokens, cache_write_tokens) are stored.

    Note: This test verifies the fields are properly stored when present in the response.
    Actual cache token values depend on Anthropic's prompt caching behavior.
    """
    message_text = f"Cache test {uuid.uuid4()}"
    llm_config = _anthropic_llm_config()

    agent_state = await server.agent_manager.create_agent_async(
        CreateAgent(
            name=f"cache_test_agent_{uuid.uuid4().hex[:8]}",
            llm_config=llm_config,
            embedding_config=EmbeddingConfig.default_config(model_name="letta"),
        ),
        actor=actor,
    )

    agent = LettaAgentV3(agent_state=agent_state, actor=actor)
    run = await server.run_manager.create_run(
        Run(agent_id=agent_state.id),
        actor=actor,
    )

    # Make two requests - second may benefit from caching
    response1 = await agent.step(
        [MessageCreate(role=MessageRole.user, content=[TextContent(text=message_text)])],
        run_id=run.id,
    )
    step_id_1 = next(msg.step_id for msg in reversed(response1.messages) if msg.step_id)

    response2 = await agent.step(
        [MessageCreate(role=MessageRole.user, content=[TextContent(text="Follow up question")])],
        run_id=run.id,
    )
    step_id_2 = next(msg.step_id for msg in reversed(response2.messages) if msg.step_id)

    # Check traces for both requests
    trace1 = await _wait_for_raw_trace(step_id=step_id_1, organization_id=actor.organization_id)
    trace2 = await _wait_for_raw_trace(step_id=step_id_2, organization_id=actor.organization_id)

    # Verify cache fields are accessible (may be None if no caching occurred)
    # The important thing is they're stored correctly when present
    for trace in [trace1, trace2]:
        assert trace.prompt_tokens > 0
        # Cache fields should be stored (may be None or int)
        assert trace.cached_input_tokens is None or isinstance(trace.cached_input_tokens, int)
        assert trace.cache_write_tokens is None or isinstance(trace.cache_write_tokens, int)
        assert trace.reasoning_tokens is None or isinstance(trace.reasoning_tokens, int)

        # Verify llm_config_json
        assert trace.llm_config_json
        config_data = json.loads(trace.llm_config_json)
        assert config_data.get("model") == llm_config.model
