import os
import threading
import time
import uuid

import pytest
from dotenv import load_dotenv

from letta import RESTClient, create_client
from letta.client.streaming import _sse_post
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import MessageCreate
from letta.schemas.openai.chat_completion_request import (
    ChatCompletionRequest,
    UserMessage,
)
from letta.settings import tool_settings


def run_server():
    load_dotenv()

    # _reset_config()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


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
    # get URL from enviornment
    server_url = os.getenv("LETTA_SERVER_URL")
    if server_url is None:
        # run server in thread
        server_url = "http://localhost:8283"
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)
    print("Running client tests with server:", server_url)
    # create user via admin client
    client = create_client(base_url=server_url, token=None)  # This yields control back to the test function
    client.set_default_llm_config(LLMConfig.default_config("gpt-4"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))
    yield client


# Fixture for test agent
@pytest.fixture(scope="module")
def agent_state(client: RESTClient):
    agent_state = client.create_agent(name=f"test_client_{str(uuid.uuid4())}")
    yield agent_state

    # delete agent
    client.delete_agent(agent_state.id)


@pytest.fixture
def mock_e2b_api_key_none():
    # Store the original value of e2b_api_key
    original_api_key = tool_settings.e2b_api_key

    # Set e2b_api_key to None
    tool_settings.e2b_api_key = None

    # Yield control to the test
    yield

    # Restore the original value of e2b_api_key
    tool_settings.e2b_api_key = original_api_key


def test_streaming_send_message(mock_e2b_api_key_none, client: RESTClient, agent_state: AgentState):
    # First, try streaming just steps
    request = ChatCompletionRequest(
        model="gpt-4o", messages=[UserMessage(content="How's your day today?")], user=agent_state.id, stream=True
    )

    response = _sse_post(f"{client.base_url}/openai/{client.api_prefix}/chat/completions/voice", request.model_dump(), client.headers)

    # Some manual checks to run
    # 1. Check that there were inner thoughts
    # 2. Check that the agent runs `send_message`
    # 3. Check that we get all the start/stop/end tokens we want
    #    This includes all of the MessageStreamStatus enums

    # print(response)
    assert response, "Sending message failed"
    for chunk in response:
        pass
        # print(chunk)
    #     assert isinstance(chunk, LettaStreamingResponse)
    #     if isinstance(chunk, InternalMonologue) and chunk.internal_monologue and chunk.internal_monologue != "":
    #         inner_thoughts_exist = True
    #     if isinstance(chunk, FunctionCallMessage) and chunk.function_call and chunk.function_call.name == "send_message":
    #         send_message_ran = True
    #     if isinstance(chunk, MessageStreamStatus):
    #         if chunk == MessageStreamStatus.done:
    #             assert not done, "Message stream already done"
    #             done = True
    #         elif chunk == MessageStreamStatus.done_step:
    #             assert not done_step, "Message stream already done step"
    #             done_step = True
    #         elif chunk == MessageStreamStatus.done_generation:
    #             assert not done_gen, "Message stream already done generation"
    #             done_gen = True
    #     if isinstance(chunk, LettaUsageStatistics):
    #         # Some rough metrics for a reasonable usage pattern
    #         assert chunk.step_count == 1
    #         assert chunk.completion_tokens > 10
    #         assert chunk.prompt_tokens > 1000
    #         assert chunk.total_tokens > 1000
    #
    # assert inner_thoughts_exist, "No inner thoughts found"
    # assert send_message_ran, "send_message function call not found"
    # assert done, "Message stream not done"
    # assert done_step, "Message stream not done step"
    # assert done_gen, "Message stream not done generation"
