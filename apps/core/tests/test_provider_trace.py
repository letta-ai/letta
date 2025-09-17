import asyncio
import os
import threading
import time
import uuid

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
async def test_provider_trace_experimental_step(client, message, agent_state):
    response = client.agents.messages.create(
        agent_id=agent_state.id, messages=[MessageCreate(role="user", content=[TextContent(text=message)])]
    )
    tool_step = response.messages[0].step_id
    reply_step = response.messages[-1].step_id

    tool_telemetry = client.telemetry.retrieve_provider_trace(step_id=tool_step)
    reply_telemetry = client.telemetry.retrieve_provider_trace(step_id=reply_step)
    assert tool_telemetry.request_json
    assert reply_telemetry.request_json


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Get the weather in San Francisco."])
async def test_provider_trace_experimental_step_stream(client, message, agent_state):
    last_message_id = client.agents.messages.list(agent_id=agent_state.id, limit=1)[0]
    stream = client.agents.messages.create_stream(
        agent_id=agent_state.id, messages=[MessageCreate(role="user", content=[TextContent(text=message)])]
    )

    list(stream)

    messages = client.agents.messages.list(agent_id=agent_state.id, after=last_message_id)
    step_ids = [id for id in set((message.step_id for message in messages)) if id is not None]
    for step_id in step_ids:
        telemetry_data = client.telemetry.retrieve_provider_trace(step_id=step_id)
        assert telemetry_data.request_json
        assert telemetry_data.response_json
