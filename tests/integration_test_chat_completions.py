import os
import threading
import time
import uuid

import pytest
from dotenv import load_dotenv
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta import RESTClient, create_client
from letta.client.streaming import _sse_post
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, UserMessage
from letta.schemas.usage import LettaUsageStatistics


def run_server():
    load_dotenv()

    # _reset_config()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


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
    client.set_default_llm_config(LLMConfig.default_config("gpt-4o-mini"))
    client.set_default_embedding_config(EmbeddingConfig.default_config(provider="openai"))
    yield client


# Fixture for test agent
@pytest.fixture(scope="module")
def agent_state(client: RESTClient):
    agent_state = client.create_agent(name=f"test_client_{str(uuid.uuid4())}")
    yield agent_state

    # delete agent
    client.delete_agent(agent_state.id)


def test_voice_streaming(mock_e2b_api_key_none, client: RESTClient, agent_state: AgentState):
    """
    Test voice streaming for chat completions using the streaming API.

    This test ensures the SSE (Server-Sent Events) response from the voice streaming endpoint
    adheres to the expected structure and contains valid data for each type of chunk.
    """

    # Prepare the chat completion request with streaming enabled
    request = ChatCompletionRequest(
        model="gpt-4o-mini",
        messages=[UserMessage(content="Tell me something interesting about bananas.")],
        user=agent_state.id,
        stream=True,
    )

    # Perform a POST request to the voice/chat/completions endpoint and collect the streaming response
    response = _sse_post(
        f"{client.base_url}/openai/{client.api_prefix}/chat/completions", request.model_dump(exclude_none=True), client.headers
    )

    # Convert the streaming response into a list of chunks for processing
    chunks = list(response)

    for idx, chunk in enumerate(chunks):
        if isinstance(chunk, ChatCompletionChunk):
            # Assert that the chunk has at least one choice (a response from the model)
            assert len(chunk.choices) > 0, "Each ChatCompletionChunk should have at least one choice."

        elif isinstance(chunk, LettaUsageStatistics):
            # Assert that the usage statistics contain valid token counts
            assert chunk.completion_tokens > 0, "Completion tokens should be greater than 0 in LettaUsageStatistics."
            assert chunk.prompt_tokens > 0, "Prompt tokens should be greater than 0 in LettaUsageStatistics."
            assert chunk.total_tokens > 0, "Total tokens should be greater than 0 in LettaUsageStatistics."
            assert chunk.step_count == 1, "Step count in LettaUsageStatistics should always be 1 for a single request."

        elif isinstance(chunk, MessageStreamStatus):
            # Assert that the stream ends with a 'done' status
            assert chunk == MessageStreamStatus.done, "The last chunk should indicate the stream has completed."
            assert idx == len(chunks) - 1, "The 'done' status must be the last chunk in the stream."

        else:
            # Fail the test if an unexpected chunk type is encountered
            pytest.fail(f"Unexpected chunk type: {chunk}", pytrace=True)
