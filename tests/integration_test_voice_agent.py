import os
import threading

import pytest
from dotenv import load_dotenv
from letta_client import Letta
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk
from sqlalchemy import delete

from letta.agents.voice_sleeptime_agent import VoiceSleeptimeAgent
from letta.config import LettaConfig
from letta.orm import Provider, Step
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentType, CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, MessageStreamStatus
from letta.schemas.group import ManagerType
from letta.schemas.letta_message import AssistantMessage, ReasoningMessage, ToolCallMessage, ToolReturnMessage, UserMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.openai.chat_completion_request import UserMessage as OpenAIUserMessage
from letta.schemas.tool import ToolCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.server.server import SyncServer
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.tool_manager import ToolManager
from letta.services.user_manager import UserManager
from letta.utils import get_persona_text
from tests.utils import wait_for_server

MESSAGE_TRANSCRIPTS = [
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

SUMMARY_REQ_TEXT = """
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

# --- Server Management --- #


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    server = SyncServer()
    return server


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
def voice_agent(server, actor):
    server.tool_manager.upsert_base_tools(actor=actor)

    main_agent = server.create_agent(
        request=CreateAgent(
            agent_type=AgentType.voice_convo_agent,
            name="main_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a personal assistant that helps users with requests.",
                ),
                CreateBlock(
                    label="human",
                    value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    return main_agent


@pytest.fixture(scope="module")
def org_id(server):
    org = server.organization_manager.create_default_organization()

    yield org.id

    # cleanup
    with server.organization_manager.session_maker() as session:
        session.execute(delete(Step))
        session.execute(delete(Provider))
        session.commit()
    server.organization_manager.delete_organization_by_id(org.id)


@pytest.fixture(scope="module")
def actor(server, org_id):
    user = server.user_manager.create_default_user()
    yield user

    # cleanup
    server.user_manager.delete_user_by_id(user.id)


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


# --- Tests --- #


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["Use search memory tool to recall what my name is."])
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_voice_recall_memory(disable_e2b_api_key, client, voice_agent, message, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request(message)

    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{voice_agent.id}", max_retries=0)
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_multiple_messages(disable_e2b_api_key, client, voice_agent, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request("How are you?")
    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{voice_agent.id}", max_retries=0)

    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)
    print("============================================")
    request = _get_chat_request("What are you up to?")
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)


@pytest.mark.asyncio
async def test_voice_sleeptime_agent(disable_e2b_api_key, voice_agent):
    """Tests chat completion streaming using the Async OpenAI client."""
    agent_manager = AgentManager()
    user_manager = UserManager()
    actor = user_manager.get_default_user()

    request = CreateAgent(
        name=voice_agent.name + "-sleeptime",
        agent_type=AgentType.voice_sleeptime_agent,
        block_ids=[block.id for block in voice_agent.memory.blocks],
        memory_blocks=[
            CreateBlock(
                label="memory_persona",
                value=get_persona_text("voice_memory_persona"),
            ),
        ],
        llm_config=LLMConfig.default_config(model_name="gpt-4o-mini"),
        embedding_config=EmbeddingConfig.default_config(provider="openai"),
        project_id=voice_agent.project_id,
    )
    sleeptime_agent = agent_manager.create_agent(request, actor=actor)

    async_client = AsyncOpenAI()

    memory_agent = VoiceSleeptimeAgent(
        agent_id=sleeptime_agent.id,
        convo_agent_state=sleeptime_agent,  # In reality, this will be the main convo agent
        openai_client=async_client,
        message_manager=MessageManager(),
        agent_manager=agent_manager,
        actor=actor,
        block_manager=BlockManager(),
        target_block_label="human",
        message_transcripts=MESSAGE_TRANSCRIPTS,
    )

    results = await memory_agent.step([MessageCreate(role=MessageRole.user, content=[TextContent(text=SUMMARY_REQ_TEXT)])])

    messages = results.messages
    # --- Basic structural check ---
    assert isinstance(messages, list)
    assert len(messages) >= 5, "Expected at least 5 messages in the sequence"

    # --- Message 0: initial UserMessage ---
    assert isinstance(messages[0], UserMessage), "First message should be a UserMessage"

    # --- Message 1: store_memories ToolCall ---
    assert isinstance(messages[1], ToolCallMessage), "Second message should be ToolCallMessage"
    assert messages[1].name == "store_memories", "Expected store_memories tool call"

    # --- Message 2: store_memories ToolReturn ---
    assert isinstance(messages[2], ToolReturnMessage), "Third message should be ToolReturnMessage"
    assert messages[2].name == "store_memories", "Expected store_memories tool return"
    assert messages[2].status == "success", "store_memories tool return should be successful"

    # --- Message 3: rethink_user_memory ToolCall ---
    assert isinstance(messages[3], ToolCallMessage), "Fourth message should be ToolCallMessage"
    assert messages[3].name == "rethink_user_memory", "Expected rethink_user_memory tool call"

    # --- Message 4: rethink_user_memory ToolReturn ---
    assert isinstance(messages[4], ToolReturnMessage), "Fifth message should be ToolReturnMessage"
    assert messages[4].name == "rethink_user_memory", "Expected rethink_user_memory tool return"
    assert messages[4].status == "success", "rethink_user_memory tool return should be successful"


@pytest.mark.asyncio
async def test_init_voice_convo_agent(voice_agent, server, actor):

    assert voice_agent.enable_sleeptime == True
    main_agent_tools = [tool.name for tool in voice_agent.tools]
    assert len(main_agent_tools) == 2
    assert "send_message" in main_agent_tools
    assert "search_memory" in main_agent_tools
    assert "core_memory_append" not in main_agent_tools
    assert "core_memory_replace" not in main_agent_tools
    assert "archival_memory_insert" not in main_agent_tools

    # 2. Check that a group was created
    group = server.group_manager.retrieve_group(
        group_id=voice_agent.multi_agent_group.id,
        actor=actor,
    )
    assert group.manager_type == ManagerType.voice_sleeptime
    assert len(group.agent_ids) == 1

    # 3. Verify shared blocks
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = server.agent_manager.get_block_with_label(agent_id=voice_agent.id, block_label="human", actor=actor)
    agents = server.block_manager.get_agents_for_block(block_id=shared_block.id, actor=actor)
    assert len(agents) == 2
    assert sleeptime_agent_id in [agent.id for agent in agents]
    assert voice_agent.id in [agent.id for agent in agents]

    # 4 Verify sleeptime agent tools
    sleeptime_agent = server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
    sleeptime_agent_tools = [tool.name for tool in sleeptime_agent.tools]
    assert "store_memories" in sleeptime_agent_tools
    assert "rethink_user_memory" in sleeptime_agent_tools
    assert "finish_rethinking_memory" in sleeptime_agent_tools

    # 5. Send a message as a sanity check
    response = await server.send_message_to_agent(
        agent_id=voice_agent.id,
        actor=actor,
        input_messages=[
            MessageCreate(
                role="user",
                content="Hey there.",
            ),
        ],
        stream_steps=False,
        stream_tokens=False,
    )
    assert len(response.messages) > 0
    message_types = [type(message) for message in response.messages]
    assert ReasoningMessage in message_types
    assert AssistantMessage in message_types

    # 6. Delete agent
    server.agent_manager.delete_agent(agent_id=voice_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
