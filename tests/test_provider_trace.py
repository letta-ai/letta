import asyncio
import json
import os
import threading
import time
import uuid

import pytest
from dotenv import load_dotenv
from letta_client import Letta

from letta.agents.letta_agent import LettaAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.server.rest_api.streaming_response import StreamingResponseWithStatusCode
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.step_manager import StepManager
from letta.services.telemetry_manager import NoopTelemetryManager, TelemetryManager


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
        time.sleep(5)  # Allow server startup time

    return url


# # --- Client Setup --- #
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
    print_tool = client.tools.upsert_from_function(func=roll_dice_tool_func)
    yield print_tool


@pytest.fixture(scope="function")
def weather_tool(client, weather_tool_func):
    weather_tool = client.tools.upsert_from_function(func=weather_tool_func)
    yield weather_tool


@pytest.fixture(scope="function")
def print_tool(client, print_tool_func):
    print_tool = client.tools.upsert_from_function(func=print_tool_func)
    yield print_tool


@pytest.fixture(scope="function")
def agent_state(client, roll_dice_tool, weather_tool):
    """Creates an agent and ensures cleanup after tests."""
    agent_state = client.agents.create(
        name=f"test_compl_{str(uuid.uuid4())[5:]}",
        tool_ids=[roll_dice_tool.id, weather_tool.id],
        include_base_tools=True,
        memory_blocks=[
            {
                "label": "human",
                "value": "Name: Matt",
            },
            {
                "label": "persona",
                "value": "Friendly agent",
            },
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Get the weather in San Francisco."])
async def test_provider_trace_experimental_step(message, agent_state, default_user):
    experimental_agent = LettaAgent(
        agent_id=agent_state.id,
        message_manager=MessageManager(),
        agent_manager=AgentManager(),
        block_manager=BlockManager(),
        job_manager=JobManager(),
        passage_manager=PassageManager(),
        step_manager=StepManager(),
        telemetry_manager=TelemetryManager(),
        actor=default_user,
    )

    response = await experimental_agent.step([MessageCreate(role="user", content=[TextContent(text=message)])])
    tool_step = response.messages[0].step_id
    reply_step = response.messages[-1].step_id

    tool_telemetry = await experimental_agent.telemetry_manager.get_provider_trace_by_step_id_async(step_id=tool_step, actor=default_user)
    reply_telemetry = await experimental_agent.telemetry_manager.get_provider_trace_by_step_id_async(step_id=reply_step, actor=default_user)
    assert tool_telemetry.request_json
    assert reply_telemetry.request_json


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Get the weather in San Francisco."])
async def test_provider_trace_experimental_step_stream(message, agent_state, default_user):
    experimental_agent = LettaAgent(
        agent_id=agent_state.id,
        message_manager=MessageManager(),
        agent_manager=AgentManager(),
        block_manager=BlockManager(),
        job_manager=JobManager(),
        passage_manager=PassageManager(),
        step_manager=StepManager(),
        telemetry_manager=TelemetryManager(),
        actor=default_user,
    )
    stream = experimental_agent.step_stream([MessageCreate(role="user", content=[TextContent(text=message)])])

    result = StreamingResponseWithStatusCode(
        stream,
        media_type="text/event-stream",
    )

    message_id = None

    async def test_send(message) -> None:
        nonlocal message_id
        if "body" in message and not message_id:
            body = message["body"].decode("utf-8").split("data:")
            message_id = json.loads(body[1])["id"]

    await result.stream_response(send=test_send)

    messages = await experimental_agent.message_manager.get_messages_by_ids_async([message_id], actor=default_user)
    step_ids = set((message.step_id for message in messages))
    for step_id in step_ids:
        telemetry_data = await experimental_agent.telemetry_manager.get_provider_trace_by_step_id_async(step_id=step_id, actor=default_user)
        assert telemetry_data.request_json
        assert telemetry_data.response_json


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Get the weather in San Francisco."])
async def test_provider_trace_step(client, agent_state, default_user, message):
    client.agents.messages.create(agent_id=agent_state.id, messages=[])
    response = client.agents.messages.create(
        agent_id=agent_state.id,
        messages=[MessageCreate(role="user", content=[TextContent(text=message)])],
    )
    tool_step = response.messages[0].step_id
    reply_step = response.messages[-1].step_id

    tool_telemetry = await TelemetryManager().get_provider_trace_by_step_id_async(step_id=tool_step, actor=default_user)
    reply_telemetry = await TelemetryManager().get_provider_trace_by_step_id_async(step_id=reply_step, actor=default_user)
    assert tool_telemetry.request_json
    assert reply_telemetry.request_json


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Get the weather in San Francisco."])
async def test_noop_provider_trace(message, agent_state, default_user):
    experimental_agent = LettaAgent(
        agent_id=agent_state.id,
        message_manager=MessageManager(),
        agent_manager=AgentManager(),
        block_manager=BlockManager(),
        job_manager=JobManager(),
        passage_manager=PassageManager(),
        step_manager=StepManager(),
        telemetry_manager=NoopTelemetryManager(),
        actor=default_user,
    )

    response = await experimental_agent.step([MessageCreate(role="user", content=[TextContent(text=message)])])
    tool_step = response.messages[0].step_id
    reply_step = response.messages[-1].step_id

    tool_telemetry = await experimental_agent.telemetry_manager.get_provider_trace_by_step_id_async(step_id=tool_step, actor=default_user)
    reply_telemetry = await experimental_agent.telemetry_manager.get_provider_trace_by_step_id_async(step_id=reply_step, actor=default_user)
    assert tool_telemetry is None
    assert reply_telemetry is None
