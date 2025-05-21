import os
import threading
from unittest.mock import MagicMock

import pytest
from dotenv import load_dotenv
from letta_client import AsyncLetta
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk

from letta.agents.voice_sleeptime_agent import VoiceSleeptimeAgent
from letta.config import LettaConfig
from letta.constants import DEFAULT_MAX_MESSAGE_BUFFER_LENGTH, DEFAULT_MIN_MESSAGE_BUFFER_LENGTH
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentType, CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, MessageStreamStatus
from letta.schemas.group import GroupUpdate, ManagerType, VoiceSleeptimeManagerUpdate
from letta.schemas.letta_message import AssistantMessage, ReasoningMessage, ToolCallMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.openai.chat_completion_request import UserMessage as OpenAIUserMessage
from letta.schemas.tool import ToolCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.server.server import SyncServer
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
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
    "assistant: Understood. I can draft a relaxed 4-day schedule with driving and stops.",
    "user: Yes, let’s do that.",
    "assistant: I’ll put together a day-by-day plan now.",
]

SYSTEM_MESSAGE = Message(role=MessageRole.system, content=[TextContent(text="System message")])
MESSAGE_OBJECTS = [SYSTEM_MESSAGE]
for entry in MESSAGE_TRANSCRIPTS:
    role_str, text = entry.split(":", 1)
    role = MessageRole.user if role_str.strip() == "user" else MessageRole.assistant
    MESSAGE_OBJECTS.append(Message(role=role, content=[TextContent(text=text.strip())]))
MESSAGE_EVICT_BREAKPOINT = 14

SUMMARY_REQ_TEXT = """
You’re a memory-recall helper for an AI that can only keep the last 4 messages. Scan the conversation history, focusing on messages about to drop out of that window, and write crisp notes that capture any important facts or insights about the human so they aren’t lost.

(Older) Evicted Messages:

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

(Newer) In-Context Messages:

12. user: Sounds good. Also, I work remotely as a UX designer, usually on a MacBook Pro.
13. assistant: Understood. I can draft a relaxed 4-day schedule with driving and stops.
14. user: Yes, let’s do that.
15. assistant: I’ll put together a day-by-day plan now."""

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
    client = AsyncLetta(base_url=server_url)
    yield client


@pytest.fixture(scope="function")
async def roll_dice_tool(client):
    def roll_dice():
        """
        Rolls a 6 sided die.

        Returns:
            str: The roll result.
        """
        return "Rolled a 10!"

    tool = await client.tools.upsert_from_function(func=roll_dice)
    # Yield the created tool
    yield tool


@pytest.fixture(scope="function")
async def weather_tool(client):
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

    tool = await client.tools.upsert_from_function(func=get_weather)
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


@pytest.fixture
def group_id(voice_agent):
    return voice_agent.multi_agent_group.id


@pytest.fixture(scope="module")
def org_id(server):
    org = server.organization_manager.create_default_organization()

    yield org.id


@pytest.fixture(scope="module")
def actor(server, org_id):
    user = server.user_manager.create_default_user()
    yield user


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


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("model", ["openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet-20241022"])
async def test_model_compatibility(disable_e2b_api_key, voice_agent, model, server, group_id, actor):
    request = _get_chat_request("How are you?")
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
            model=model,
            embedding="openai/text-embedding-ada-002",
            enable_sleeptime=True,
        ),
        actor=actor,
    )
    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/v1/voice-beta/{main_agent.id}", max_retries=0)

    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("message", ["Use search memory tool to recall what my name is."])
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_voice_recall_memory(disable_e2b_api_key, voice_agent, message, endpoint):
    """Tests chat completion streaming using the Async OpenAI client."""
    request = _get_chat_request(message)

    async_client = AsyncOpenAI(base_url=f"http://localhost:8283/{endpoint}/{voice_agent.id}", max_retries=0)
    stream = await async_client.chat.completions.create(**request.model_dump(exclude_none=True))
    async with stream:
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content)


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("endpoint", ["v1/voice-beta"])
async def test_trigger_summarization(disable_e2b_api_key, server, voice_agent, group_id, endpoint, actor):
    server.group_manager.modify_group(
        group_id=group_id,
        group_update=GroupUpdate(
            manager_config=VoiceSleeptimeManagerUpdate(
                manager_type=ManagerType.voice_sleeptime,
                max_message_buffer_length=6,
                min_message_buffer_length=5,
            )
        ),
        actor=actor,
    )

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


@pytest.mark.asyncio(loop_scope="session")
async def test_summarization(disable_e2b_api_key, voice_agent):
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

    memory_agent = VoiceSleeptimeAgent(
        agent_id=sleeptime_agent.id,
        convo_agent_state=sleeptime_agent,  # In reality, this will be the main convo agent
        message_manager=MessageManager(),
        agent_manager=agent_manager,
        actor=actor,
        block_manager=BlockManager(),
        passage_manager=PassageManager(),
        target_block_label="human",
    )
    memory_agent.update_message_transcript(MESSAGE_TRANSCRIPTS)

    summarizer = Summarizer(
        mode=SummarizationMode.STATIC_MESSAGE_BUFFER,
        summarizer_agent=memory_agent,
        message_buffer_limit=8,
        message_buffer_min=4,
    )

    # stub out the agent.step so it returns a known sentinel
    memory_agent.step = MagicMock(return_value="STEP_RESULT")

    # patch fire_and_forget on *this* summarizer instance to a MagicMock
    summarizer.fire_and_forget = MagicMock()

    # now call the method under test
    in_ctx = MESSAGE_OBJECTS[:MESSAGE_EVICT_BREAKPOINT]
    new_msgs = MESSAGE_OBJECTS[MESSAGE_EVICT_BREAKPOINT:]
    # call under test (this is sync)
    updated, did_summarize = summarizer._static_buffer_summarization(
        in_context_messages=in_ctx,
        new_letta_messages=new_msgs,
    )

    assert did_summarize is True
    assert len(updated) == summarizer.message_buffer_min + 1  # One extra for system message
    assert updated[0].role == MessageRole.system  # Preserved system message

    # 2) the summarizer_agent.step() should have been *called* exactly once
    memory_agent.step.assert_called_once()
    call_args = memory_agent.step.call_args.args[0]  # the single positional argument: a list of MessageCreate
    assert isinstance(call_args, list)
    assert isinstance(call_args[0], MessageCreate)
    assert call_args[0].role == MessageRole.user
    assert "15. assistant: I’ll put together a day-by-day plan now." in call_args[0].content[0].text

    # 3) fire_and_forget should have been called once, and its argument must be the coroutine returned by step()
    summarizer.fire_and_forget.assert_called_once()


@pytest.mark.asyncio(loop_scope="session")
async def test_voice_sleeptime_agent(disable_e2b_api_key, voice_agent):
    """Tests chat completion streaming using the Async OpenAI client."""
    agent_manager = AgentManager()
    tool_manager = ToolManager()
    user_manager = UserManager()
    actor = user_manager.get_default_user()

    finish_rethinking_memory_tool = tool_manager.get_tool_by_name(tool_name="finish_rethinking_memory", actor=actor)
    store_memories_tool = tool_manager.get_tool_by_name(tool_name="store_memories", actor=actor)
    rethink_user_memory_tool = tool_manager.get_tool_by_name(tool_name="rethink_user_memory", actor=actor)
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
        tool_ids=[finish_rethinking_memory_tool.id, store_memories_tool.id, rethink_user_memory_tool.id],
    )
    sleeptime_agent = agent_manager.create_agent(request, actor=actor)

    memory_agent = VoiceSleeptimeAgent(
        agent_id=sleeptime_agent.id,
        convo_agent_state=sleeptime_agent,  # In reality, this will be the main convo agent
        message_manager=MessageManager(),
        agent_manager=agent_manager,
        actor=actor,
        block_manager=BlockManager(),
        passage_manager=PassageManager(),
        target_block_label="human",
    )
    memory_agent.update_message_transcript(MESSAGE_TRANSCRIPTS)

    results = await memory_agent.step([MessageCreate(role=MessageRole.user, content=[TextContent(text=SUMMARY_REQ_TEXT)])])

    messages = results.messages
    # collect the names of every tool call
    seen_tool_calls = set()

    for idx, msg in enumerate(messages):
        # 1) Print whatever “content” this message carries
        if hasattr(msg, "content") and msg.content is not None:
            print(f"Message {idx} content:\n{msg.content}\n")
        # 2) If it’s a ToolCallMessage, also grab its name and print the raw args
        elif isinstance(msg, ToolCallMessage):
            name = msg.tool_call.name
            args = msg.tool_call.arguments
            seen_tool_calls.add(name)
            print(f"Message {idx} TOOL CALL: {name}\nArguments:\n{args}\n")
        # 3) Otherwise just dump the repr
        else:
            print(f"Message {idx} repr:\n{msg!r}\n")

    # now verify we saw each of the three calls at least once
    expected = {"store_memories", "rethink_user_memory", "finish_rethinking_memory"}
    missing = expected - seen_tool_calls
    assert not missing, f"Did not see calls to: {', '.join(missing)}"


@pytest.mark.asyncio(loop_scope="session")
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
    agents = await server.block_manager.get_agents_for_block_async(block_id=shared_block.id, actor=actor)
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


def _modify(group_id, server, actor, max_val, min_val):
    """Helper to invoke modify_group with voice_sleeptime config."""
    return server.group_manager.modify_group(
        group_id=group_id,
        group_update=GroupUpdate(
            manager_config=VoiceSleeptimeManagerUpdate(
                manager_type=ManagerType.voice_sleeptime,
                max_message_buffer_length=max_val,
                min_message_buffer_length=min_val,
            )
        ),
        actor=actor,
    )


def test_valid_buffer_lengths_above_four(group_id, server, actor):
    # both > 4 and max > min
    updated = _modify(group_id, server, actor, max_val=10, min_val=5)
    assert updated.max_message_buffer_length == 10
    assert updated.min_message_buffer_length == 5


def test_valid_buffer_lengths_only_max(group_id, server, actor):
    # both > 4 and max > min
    updated = _modify(group_id, server, actor, max_val=DEFAULT_MAX_MESSAGE_BUFFER_LENGTH + 1, min_val=None)
    assert updated.max_message_buffer_length == DEFAULT_MAX_MESSAGE_BUFFER_LENGTH + 1
    assert updated.min_message_buffer_length == DEFAULT_MIN_MESSAGE_BUFFER_LENGTH


def test_valid_buffer_lengths_only_min(group_id, server, actor):
    # both > 4 and max > min
    updated = _modify(group_id, server, actor, max_val=None, min_val=DEFAULT_MIN_MESSAGE_BUFFER_LENGTH + 1)
    assert updated.max_message_buffer_length == DEFAULT_MAX_MESSAGE_BUFFER_LENGTH
    assert updated.min_message_buffer_length == DEFAULT_MIN_MESSAGE_BUFFER_LENGTH + 1


@pytest.mark.parametrize(
    "max_val,min_val,err_part",
    [
        # only one set → both-or-none
        (None, DEFAULT_MAX_MESSAGE_BUFFER_LENGTH, "must be greater than"),
        (DEFAULT_MIN_MESSAGE_BUFFER_LENGTH, None, "must be greater than"),
        # ordering violations
        (5, 5, "must be greater than"),
        (6, 7, "must be greater than"),
        # lower-bound (must both be > 4)
        (4, 5, "greater than 4"),
        (5, 4, "greater than 4"),
        (1, 10, "greater than 4"),
        (10, 1, "greater than 4"),
    ],
)
def test_invalid_buffer_lengths(group_id, server, actor, max_val, min_val, err_part):
    with pytest.raises(ValueError) as exc:
        _modify(group_id, server, actor, max_val, min_val)
    assert err_part in str(exc.value)
