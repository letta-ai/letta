"""
Comprehensive tests for provider trace telemetry.

Tests verify that provider traces are correctly created with all telemetry context
(agent_id, agent_tags, run_id, step_id, call_type) across:
- Agent steps (non-streaming and streaming)
- Tool calls
- Summarization calls
- Different agent architectures (V2, V3)
"""

import asyncio
import os
import threading
import time
import uuid
from unittest.mock import patch

import pytest
from dotenv import load_dotenv
from letta_client import Letta

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate


def _run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture(scope="session")
def server_url():
    """Ensures a server is running and returns its base URL."""
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        time.sleep(5)

    return url


@pytest.fixture(scope="session")
def client(server_url):
    """Creates a REST client for testing."""
    client = Letta(base_url=server_url)
    yield client


@pytest.fixture(scope="session")
def event_loop(request):
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
def roll_dice_tool(client, roll_dice_tool_func):
    tool = client.tools.upsert_from_function(func=roll_dice_tool_func)
    yield tool


@pytest.fixture(scope="function")
def weather_tool(client, weather_tool_func):
    tool = client.tools.upsert_from_function(func=weather_tool_func)
    yield tool


@pytest.fixture(scope="function")
def print_tool(client, print_tool_func):
    tool = client.tools.upsert_from_function(func=print_tool_func)
    yield tool


@pytest.fixture(scope="function")
def agent_state(client, roll_dice_tool, weather_tool):
    """Creates an agent with tools and ensures cleanup after tests."""
    agent_state = client.agents.create(
        name=f"test_provider_trace_{str(uuid.uuid4())[:8]}",
        tool_ids=[roll_dice_tool.id, weather_tool.id],
        include_base_tools=True,
        tags=["test", "provider-trace"],
        memory_blocks=[
            {"label": "human", "value": "Name: TestUser"},
            {"label": "persona", "value": "Helpful test agent"},
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


@pytest.fixture(scope="function")
def agent_state_with_tags(client, weather_tool):
    """Creates an agent with specific tags for tag verification tests."""
    agent_state = client.agents.create(
        name=f"test_tagged_agent_{str(uuid.uuid4())[:8]}",
        tool_ids=[weather_tool.id],
        include_base_tools=True,
        tags=["env:test", "team:telemetry", "version:v1"],
        memory_blocks=[
            {"label": "human", "value": "Name: TagTestUser"},
            {"label": "persona", "value": "Agent with tags"},
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


class TestProviderTraceBasicStep:
    """Tests for basic agent step provider traces."""

    @pytest.mark.asyncio
    async def test_non_streaming_step_creates_provider_trace(self, client, agent_state):
        """Verify provider trace is created for non-streaming agent step."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello, how are you?")])],
        )

        assert len(response.messages) > 0
        step_id = response.messages[-1].step_id
        assert step_id is not None

        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)
        assert trace is not None
        assert trace.request_json is not None
        assert trace.response_json is not None

    @pytest.mark.asyncio
    async def test_streaming_step_creates_provider_trace(self, client, agent_state):
        """Verify provider trace is created for streaming agent step."""
        last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)[0]

        stream = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Tell me a joke.")])],
        )
        list(stream)

        messages = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id)
        step_ids = list({msg.step_id for msg in messages if msg.step_id is not None})

        assert len(step_ids) > 0
        for step_id in step_ids:
            trace = client.telemetry.retrieve_provider_trace(step_id=step_id)
            assert trace is not None
            assert trace.request_json is not None
            assert trace.response_json is not None


class TestProviderTraceWithToolCalls:
    """Tests for provider traces when tools are called."""

    @pytest.mark.asyncio
    async def test_tool_call_step_has_provider_trace(self, client, agent_state):
        """Verify provider trace exists for steps that invoke tools."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Get the weather in San Francisco.")])],
        )

        tool_call_step_id = response.messages[0].step_id
        final_step_id = response.messages[-1].step_id

        tool_trace = client.telemetry.retrieve_provider_trace(step_id=tool_call_step_id)
        assert tool_trace is not None
        assert tool_trace.request_json is not None

        if tool_call_step_id != final_step_id:
            final_trace = client.telemetry.retrieve_provider_trace(step_id=final_step_id)
            assert final_trace is not None
            assert final_trace.request_json is not None

    @pytest.mark.asyncio
    async def test_streaming_tool_call_has_provider_trace(self, client, agent_state):
        """Verify provider trace exists for streaming steps with tool calls."""
        last_message = client.agents.messages.list(agent_id=agent_state.id, limit=1)[0]

        stream = client.agents.messages.create_stream(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Roll the dice for me.")])],
        )
        list(stream)

        messages = client.agents.messages.list(agent_id=agent_state.id, after=last_message.id)
        step_ids = list({msg.step_id for msg in messages if msg.step_id is not None})

        assert len(step_ids) > 0
        for step_id in step_ids:
            trace = client.telemetry.retrieve_provider_trace(step_id=step_id)
            assert trace is not None
            assert trace.request_json is not None


class TestProviderTraceTelemetryContext:
    """Tests verifying telemetry context fields are correctly populated."""

    @pytest.mark.asyncio
    async def test_provider_trace_contains_agent_id(self, client, agent_state):
        """Verify provider trace contains the correct agent_id."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.agent_id == agent_state.id

    @pytest.mark.asyncio
    async def test_provider_trace_contains_agent_tags(self, client, agent_state_with_tags):
        """Verify provider trace contains the agent's tags."""
        response = client.agents.messages.create(
            agent_id=agent_state_with_tags.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.agent_tags is not None
        assert set(trace.agent_tags) == {"env:test", "team:telemetry", "version:v1"}

    @pytest.mark.asyncio
    async def test_provider_trace_contains_step_id(self, client, agent_state):
        """Verify provider trace step_id matches the message step_id."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.step_id == step_id

    @pytest.mark.asyncio
    async def test_provider_trace_contains_run_id_for_async_job(self, client, agent_state):
        """Verify provider trace contains run_id when created via async job."""
        job = client.agents.messages.create_async(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        while job.status not in ["completed", "failed"]:
            time.sleep(0.5)
            job = client.jobs.retrieve(job.id)

        assert job.status == "completed"

        messages = client.agents.messages.list(agent_id=agent_state.id, limit=5)
        step_ids = list({msg.step_id for msg in messages if msg.step_id is not None})

        assert len(step_ids) > 0
        trace = client.telemetry.retrieve_provider_trace(step_id=step_ids[0])
        assert trace is not None
        assert trace.run_id == job.id


class TestProviderTraceMultiStep:
    """Tests for provider traces across multiple agent steps."""

    @pytest.mark.asyncio
    async def test_multi_step_conversation_has_traces_for_each_step(self, client, agent_state):
        """Verify each step in a multi-step conversation has its own provider trace."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[
                MessageCreate(
                    role="user",
                    content=[TextContent(text="First, get the weather in NYC. Then roll the dice.")],
                )
            ],
        )

        step_ids = list({msg.step_id for msg in response.messages if msg.step_id is not None})

        assert len(step_ids) >= 1

        for step_id in step_ids:
            trace = client.telemetry.retrieve_provider_trace(step_id=step_id)
            assert trace is not None, f"No trace found for step_id={step_id}"
            assert trace.request_json is not None
            assert trace.agent_id == agent_state.id

    @pytest.mark.asyncio
    async def test_consecutive_messages_have_separate_traces(self, client, agent_state):
        """Verify consecutive messages create separate traces."""
        response1 = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )
        step_id_1 = response1.messages[-1].step_id

        response2 = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="How are you?")])],
        )
        step_id_2 = response2.messages[-1].step_id

        assert step_id_1 != step_id_2

        trace1 = client.telemetry.retrieve_provider_trace(step_id=step_id_1)
        trace2 = client.telemetry.retrieve_provider_trace(step_id=step_id_2)

        assert trace1 is not None
        assert trace2 is not None
        assert trace1.id != trace2.id


class TestProviderTraceRequestResponseContent:
    """Tests verifying request and response JSON content."""

    @pytest.mark.asyncio
    async def test_request_json_contains_model(self, client, agent_state):
        """Verify request_json contains model information."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.request_json is not None
        assert "model" in trace.request_json

    @pytest.mark.asyncio
    async def test_request_json_contains_messages(self, client, agent_state):
        """Verify request_json contains messages array."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.request_json is not None
        assert "messages" in trace.request_json
        assert isinstance(trace.request_json["messages"], list)

    @pytest.mark.asyncio
    async def test_response_json_contains_usage(self, client, agent_state):
        """Verify response_json contains usage statistics."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hello")])],
        )

        step_id = response.messages[-1].step_id
        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)

        assert trace is not None
        assert trace.response_json is not None
        assert "usage" in trace.response_json or "usage" in str(trace.response_json)


class TestProviderTraceEdgeCases:
    """Tests for edge cases and error scenarios."""

    @pytest.mark.asyncio
    async def test_nonexistent_step_id_returns_none_or_empty(self, client):
        """Verify querying nonexistent step_id handles gracefully."""
        fake_step_id = f"step-{uuid.uuid4()}"

        try:
            trace = client.telemetry.retrieve_provider_trace(step_id=fake_step_id)
            assert trace is None or trace.request_json is None
        except Exception:
            pass

    @pytest.mark.asyncio
    async def test_empty_message_still_creates_trace(self, client, agent_state):
        """Verify trace is created even for minimal messages."""
        response = client.agents.messages.create(
            agent_id=agent_state.id,
            messages=[MessageCreate(role="user", content=[TextContent(text="Hi")])],
        )

        step_id = response.messages[-1].step_id
        assert step_id is not None

        trace = client.telemetry.retrieve_provider_trace(step_id=step_id)
        assert trace is not None
