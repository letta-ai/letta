import os
import threading
import time
import uuid

import pytest
from dotenv import load_dotenv
from letta_client import Letta
from openai import AsyncOpenAI
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.agents.ephemeral_memory_agent import EphemeralMemoryAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, MessageStreamStatus
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, UserMessage
from letta.schemas.tool import ToolCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.tool_manager import ToolManager
from letta.services.user_manager import UserManager

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
        time.sleep(5)  # Allow server startup time

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
        messages=[UserMessage(content=message)],
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
@pytest.mark.parametrize("message", ["How are you?"])
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_latency(disable_e2b_api_key, client, agent, message, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request(message)

    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{agent.id}", max_retries=0)
    import time

    print(f"SENT OFF REQUEST {time.perf_counter()}")
    first = True
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            print(chunk)
            if first:
                print(f"FIRST RECEIVED FROM REQUEST{time.perf_counter()}")
                first = False
            continue


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_multiple_messages(disable_e2b_api_key, client, agent, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request("How are you?")
    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{agent.id}", max_retries=0)

    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            print(chunk)
    print("============================================")
    request = _get_chat_request("What are you up to?")
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            print(chunk)


@pytest.mark.asyncio
async def test_ephemeral_memory_agent(disable_e2b_api_key, agent):
    """Tests chat completion streaming using the Async OpenAI client."""
    async_client = AsyncOpenAI()
    message_transcripts = [
        "user: Hey, I’ve been thinking about planning a road trip up the California coast next month.",
        "assistant: That sounds amazing! Do you have any particular cities or sights in mind?",
        "user: I definitely want to stop in Big Sur and maybe Santa Barbara. Also, I love craft coffee shops.",
        "assistant: Great choices. Would you like recommendations for top-rated coffee spots along the way?",
        "user: Yes, please. Also, I prefer independent cafés over chains, and I’m vegan.",
        "assistant: Noted—independent, vegan-friendly cafés. Anything else?",
        "user: I’d also like to listen to something upbeat, maybe a podcast or playlist suggestion.",
        "assistant: Sure—perhaps an indie rock playlist or a travel podcast like “Zero To Travel.”",
        "user: Perfect. By the way, my birthday is June 12th, so I’ll be turning 30 on the trip.",
        "assistant: Happy early birthday! Would you like gift ideas or celebration tips?",
        "user: Maybe just a recommendation for a nice vegan bakery to grab a birthday treat.",
        "assistant: How about Vegan Treats in Santa Barbara? They’re highly rated.",
        "user: Sounds good. Also, I work remotely as a UX designer, usually on a MacBook Pro.",
        "user: I want to make sure my itinerary isn’t too tight—aiming for 3–4 days total.",
        "assistant: Understood. I can draft a relaxed 4-day schedule with driving and stops.",
        "user: Yes, let’s do that.",
        "assistant: I’ll put together a day-by-day plan now.",
    ]

    memory_agent = EphemeralMemoryAgent(
        agent_id=agent.id,
        openai_client=async_client,
        message_manager=MessageManager(),
        agent_manager=AgentManager(),
        actor=UserManager().get_user_or_default(),
        block_manager=BlockManager(),
        target_block_label="human",
        message_transcripts=message_transcripts,
    )

    summary_request_text = """
Here is the conversation history. Lines marked (Older) are about to be evicted; lines marked (Newer) are still in context for clarity:

(Older)
0. user: Hey, I’ve been thinking about planning a road trip up the California coast next month.
1. assistant: That sounds amazing! Do you have any particular cities or sights in mind?
2. user: I definitely want to stop in Big Sur and maybe Santa Barbara. Also, I love craft coffee shops.
3. assistant: Great choices. Would you like recommendations for top-rated coffee spots along the way?
4. user: Yes, please. Also, I prefer independent cafés over chains, and I’m vegan.
5. assistant: Noted—independent, vegan-friendly cafés. Anything else?
6. user: I’d also like to listen to something upbeat, maybe a podcast or playlist suggestion.
7. assistant: Sure—perhaps an indie rock playlist or a travel podcast like “Zero To Travel.”
8. user: Perfect. By the way, my birthday is June 12th, so I’ll be turning 30 on the trip.
9. assistant: Happy early birthday! Would you like gift ideas or celebration tips?
10. user: Maybe just a recommendation for a nice vegan bakery to grab a birthday treat.
11. assistant: How about Vegan Treats in Santa Barbara? They’re highly rated.
12. user: Sounds good. Also, I work remotely as a UX designer, usually on a MacBook Pro.

(Newer)
13. user: I want to make sure my itinerary isn’t too tight—aiming for 3–4 days total.
14. assistant: Understood. I can draft a relaxed 4-day schedule with driving and stops.
15. user: Yes, let’s do that.
16. assistant: I’ll put together a day-by-day plan now.

Please segment the (Older) portion into coherent chunks and—using **only** the `store_memory` tool—output a JSON call that lists each chunk’s `start_index`, `end_index`, and a one-sentence `contextual_description`.
    """

    results = await memory_agent.step([MessageCreate(role=MessageRole.user, content=[TextContent(text=summary_request_text)])])
    print(results)


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Use search memory tool to recall what my name is."])
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_voice_recall_memory(disable_e2b_api_key, client, agent, message, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request(message)

    # Insert some messages about my name
    client.agents.messages.create(
        agent.id,
        messages=[
            MessageCreate(
                role=MessageRole.user,
                content=[
                    TextContent(text="My name is Matt, don't do anything with this information other than call send_message right after.")
                ],
            )
        ],
    )

    # Wipe the in context messages
    actor = UserManager().get_default_user()
    AgentManager().set_in_context_messages(agent_id=agent.id, message_ids=[agent.message_ids[0]], actor=actor)

    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{agent.id}", max_retries=0)
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Tell me something interesting about bananas.", "What's the weather in SF?"])
@pytest.mark.parametrize("endpoint", ["openai/v1"])  # , "v1/voice-beta"])
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
