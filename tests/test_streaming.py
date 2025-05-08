import os
import threading
import time

import pytest
from dotenv import load_dotenv
from letta_client import AgentState, Letta, LlmConfig, MessageCreate

from letta.schemas.message import Message


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
    api_url = os.getenv("LETTA_API_URL")
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(5)
    print("Running client tests with server:", server_url)

    # Overide the base_url if the LETTA_API_URL is set
    base_url = api_url if api_url else server_url
    # create the Letta client
    yield Letta(base_url=base_url, token=None)


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
    disable_e2b_api_key,
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
    user_message_otid = Message.generate_otid()
    response = client.agents.messages.create_stream(
        agent_id=agent.id,
        messages=[
            MessageCreate(
                role="user",
                content="This is a test. Repeat after me: 'banana'",
                otid=user_message_otid,
            ),
        ],
        stream_tokens=stream_tokens,
    )

    # Tracking variables for test validation
    inner_thoughts_exist = False
    inner_thoughts_count = 0
    send_message_ran = False
    done = False
    last_message_id = client.agents.messages.list(agent_id=agent.id, limit=1)[0].id
    letta_message_otids = [user_message_otid]

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
        else:
            letta_message_otids.append(chunk.otid)
        print(chunk)

    # If stream tokens, we expect at least one inner thought
    assert inner_thoughts_count >= 1, "Expected more than one inner thought"
    assert inner_thoughts_exist, "No inner thoughts found"
    assert send_message_ran, "send_message function call not found"
    assert done, "Message stream not done"

    messages = client.agents.messages.list(agent_id=agent.id, after=last_message_id)
    assert [message.otid for message in messages] == letta_message_otids
