import asyncio
import uuid

import pytest

from letta import LocalClient, create_client
from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.server.rest_api.interface import StreamingServerInterface
from letta.server.rest_api.utils import sse_async_generator


@pytest.fixture
def mock_messages():
    message = MessageCreate(
        role=MessageRole.user,
        text="say apple",
    )

    yield [message]


@pytest.fixture(
    scope="module",
)
def client():
    client = create_client()
    client.set_default_llm_config(LLMConfig.default_config("gpt-4"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))
    yield client


# Fixture for test agent
@pytest.fixture(scope="module")
def agent_state(client: LocalClient):
    agent_state = client.create_agent(name=f"test_client_{str(uuid.uuid4())}")
    yield agent_state

    # delete agent
    client.delete_agent(agent_state.id)


@pytest.mark.asyncio
async def test_parse_openai_stream(client, agent_state, mock_messages):

    # Create a new interface per request
    letta_agent = client.server.load_agent(agent_id=agent_state.id)
    letta_agent.interface = StreamingServerInterface()
    streaming_interface = letta_agent.interface
    if not isinstance(streaming_interface, StreamingServerInterface):
        raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

    # Enable token-streaming within the request if desired
    streaming_interface.streaming_mode = True
    streaming_interface.streaming_chat_completion_mode = False

    # Allow AssistantMessage is desired by client
    streaming_interface.assistant_message_tool_name = DEFAULT_MESSAGE_TOOL
    streaming_interface.assistant_message_tool_kwarg = DEFAULT_MESSAGE_TOOL_KWARG

    # Related to JSON buffer reader
    streaming_interface.inner_thoughts_in_kwargs = True

    # Offload the synchronous message_func to a separate thread
    streaming_interface.stream_start()
    task = asyncio.create_task(
        asyncio.to_thread(
            client.server.send_messages,
            user_id=client.user.id,
            agent_id=agent_state.id,
            messages=mock_messages,
            interface=streaming_interface,
        )
    )

    generator = sse_async_generator(
        streaming_interface.get_generator(),
        usage_task=task,
        finish_message=True,
    )

    async for chunk in generator:
        print(chunk)
