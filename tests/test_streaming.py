import os
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import AgentState, Letta, LlmConfig, MessageCreate


def run_server():
    load_dotenv()

    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(
    scope="module",
)
def client(request):
    # Get URL from environment or start server
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)
    print("Running client tests with server:", server_url)

    # create the Letta client
    yield Letta(base_url=server_url, token=None)


# Fixture for test agent
@pytest.fixture(scope="module")
def agent(client: Letta):
    agent_state = client.agents.create(
        name="test_client",
        memory_blocks=[{"label": "human", "value": ""}, {"label": "persona", "value": ""}],
        model="letta/letta-free",
        embedding="letta/letta-free",
    )

    yield agent_state

    # delete agent
    client.agents.delete(agent_state.id)


@pytest.mark.parametrize(
    "stream_tokens,model",
    [
        (True, "openai/gpt-4o-mini"),
        (True, "anthropic/claude-3-sonnet-20240229"),
        (False, "openai/gpt-4o-mini"),
        (False, "anthropic/claude-3-sonnet-20240229"),
    ],
)
def test_streaming_send_message(
    mock_e2b_api_key_none,
    client: Letta,
    agent: AgentState,
    stream_tokens: bool,
    model: str,
):
    # Update agent's model
    config = client.agents.retrieve(agent_id=agent.id).llm_config
    config_dump = config.model_dump()
    config_dump["model"] = model
    config = LlmConfig(**config_dump)
    client.agents.modify(agent_id=agent.id, llm_config=config)

    # Send streaming message
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[MessageCreate(role="user", content="This is a test. Repeat after me: 'banana'")],
        stream_tokens=stream_tokens,
    )

    # Tracking variables for test validation
    inner_thoughts_exist = False
    inner_thoughts_count = 0
    send_message_ran = False
    done = False

    assert response, "Sending message failed"
    for chunk in response:
        # Check chunk type and content based on the current client API
        if hasattr(chunk, "message_type") and chunk.message_type == "reasoning_message":
            inner_thoughts_exist = True
            inner_thoughts_count += 1

        if chunk.message_type == "tool_call_message" and hasattr(chunk, "tool_call") and chunk.tool_call.name == "send_message":
            send_message_ran = True
        if chunk.message_type == "assistant_message":
            send_message_ran = True

        if chunk.message_type == "usage_statistics":
            # Validate usage statistics
            assert chunk.step_count == 1
            assert chunk.completion_tokens > 10
            assert chunk.prompt_tokens > 1000
            assert chunk.total_tokens > 1000
            done = True
        print(chunk)

    # If stream tokens, we expect at least one inner thought
    assert inner_thoughts_count >= 1, "Expected more than one inner thought"
    assert inner_thoughts_exist, "No inner thoughts found"
    assert send_message_ran, "send_message function call not found"
    assert done, "Message stream not done"
