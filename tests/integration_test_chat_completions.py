import os
import threading
import uuid

import pytest
from dotenv import load_dotenv
from letta_client import Letta
from openai import AsyncOpenAI
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.openai.chat_completion_request import UserMessage as OpenAIUserMessage
from letta.schemas.tool import ToolCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.services.tool_manager import ToolManager
from tests.utils import wait_for_server

# --- Server Management --- #


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
        wait_for_server(url)  # Allow server startup time

    return url


# --- Client Setup --- #


@pytest.fixture(scope="session")
def client(server_url):
    """Creates a REST client for testing."""
    client = Letta(base_url=server_url)
    yield client


@pytest.fixture(scope="function")
def roll_dice_tool(client):
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        return "Rolled a 10!"

    tool = client.tools.upsert_from_function(func=roll_dice)
    # Yield the created tool
    yield tool


@pytest.fixture(scope="function")
def weather_tool(client):
    def get_weather(location: str) -> str:
        """
        Fetches the current weather for a given location.

        Parameters:
            location (str): The location to get the weather for.

        Returns:
            str: A formatted string describing the weather in the given location.

        Raises:
            RuntimeError: If the request to fetch weather data fails.
        """
        import requests

        url = f"https://wttr.in/{location}?format=%C+%t"

        response = requests.get(url)
        if response.status_code == 200:
            weather_data = response.text
            return f"The weather in {location} is {weather_data}."
        else:
            raise RuntimeError(f"Failed to get weather data, status code: {response.status_code}")

    tool = client.tools.upsert_from_function(func=get_weather)
    # Yield the created tool
    yield tool


@pytest.fixture(scope="function")
def composio_gmail_get_profile_tool(default_user):
    tool_create = ToolCreate.from_composio(action_name="GMAIL_GET_PROFILE")
    tool = ToolManager().create_or_update_composio_tool(tool_create=tool_create, actor=default_user)
    yield tool


@pytest.fixture(scope="function")
def agent(client, roll_dice_tool, weather_tool):
    """Creates an agent and ensures cleanup after tests."""
    agent_state = client.agents.create(
        name=f"test_compl_{str(uuid.uuid4())[5:]}",
        tool_ids=[roll_dice_tool.id, weather_tool.id],
        include_base_tools=True,
        memory_blocks=[
            {"label": "human", "value": "(I know nothing about the human)"},
            {"label": "persona", "value": "Friendly agent"},
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
    )
    yield agent_state
    client.agents.delete(agent_state.id)


# --- Helper Functions --- #


def _get_chat_request(message, stream=True):
    """Returns a chat completion request with streaming enabled."""
    return ChatCompletionRequest(
        model="gpt-4o-mini",
        messages=[OpenAIUserMessage(content=message)],
        stream=stream,
    )


def _assert_valid_chunk(chunk, idx, chunks):
    """Validates the structure of each streaming chunk."""
    if isinstance(chunk, ChatCompletionChunk):
        assert chunk.choices, "Each ChatCompletionChunk should have at least one choice."

    elif isinstance(chunk, LettaUsageStatistics):
        assert chunk.completion_tokens > 0, "Completion tokens must be > 0."
        assert chunk.prompt_tokens > 0, "Prompt tokens must be > 0."
        assert chunk.total_tokens > 0, "Total tokens must be > 0."
        assert chunk.step_count == 1, "Step count must be 1."

    elif isinstance(chunk, MessageStreamStatus):
        assert chunk == MessageStreamStatus.done, "Stream should end with 'done' status."
        assert idx == len(chunks) - 1, "The last chunk must be 'done'."

    else:
        pytest.fail(f"Unexpected chunk type: {chunk}")


# --- Test Cases --- #


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Tell me something interesting about bananas.", "What's the weather in SF?"])
@pytest.mark.parametrize("endpoint", ["openai/v1"])
async def test_chat_completions_streaming_openai_client(disable_e2b_api_key, client, agent, message, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request(message)

    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{agent.id}", max_retries=0)
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))

    received_chunks = 0
    stop_chunk_count = 0
    last_chunk = None

    try:
        async with stream:
            async for chunk in stream:
                assert isinstance(chunk, ChatCompletionChunk), f"Unexpected chunk type: {type(chunk)}"
                assert chunk.choices, "Each ChatCompletionChunk should have at least one choice."

                # Track last chunk for final verification
                last_chunk = chunk

                # If this chunk has a finish reason of "stop", track it
                if chunk.choices[0].finish_reason == "stop":
                    stop_chunk_count += 1
                    # Fail early if more than one stop chunk is sent
                    assert stop_chunk_count == 1, f"Multiple stop chunks detected: {chunk.model_dump_json(indent=4)}"
                    continue

                # Validate regular content chunks
                assert chunk.choices[0].delta.content, f"Chunk at index {received_chunks} has no content: {chunk.model_dump_json(indent=4)}"
                received_chunks += 1
    except Exception as e:
        pytest.fail(f"Streaming failed with exception: {e}")

    assert received_chunks > 0, "No valid streaming chunks were received."

    # Ensure the last chunk is the expected stop chunk
    assert last_chunk is not None, "No last chunk received."
