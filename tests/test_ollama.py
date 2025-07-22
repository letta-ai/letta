import pytest
from letta_client import Letta

from letta.schemas.providers import OllamaProvider
from letta.settings import model_settings


@pytest.fixture
def ollama_provider():
    """Create an Ollama provider for testing"""
    return OllamaProvider(
        name="ollama",
        base_url=model_settings.ollama_base_url or "http://localhost:11434",
        api_key=None,
        default_prompt_formatter="chatml",
    )


@pytest.mark.asyncio
async def test_list_llm_models_async(ollama_provider):
    """Test async listing of LLM models from Ollama"""
    models = await ollama_provider.list_llm_models_async()
    assert len(models) >= 0

    model = models[0]
    assert model.handle == f"{ollama_provider.name}/{model.model}"
    assert model.model_endpoint_type == "ollama"
    assert model.model_endpoint == ollama_provider.base_url
    assert model.context_window is not None
    assert model.context_window > 0


# noinspection DuplicatedCode
@pytest.mark.asyncio
async def test_list_embedding_models_async(ollama_provider):
    """Test async listing of embedding models from Ollama"""
    embedding_models = await ollama_provider.list_embedding_models_async()
    assert len(embedding_models) >= 0

    model = embedding_models[0]
    assert model.handle == f"{ollama_provider.name}/{model.embedding_model}"
    assert model.embedding_endpoint_type == "ollama"
    assert model.embedding_endpoint == ollama_provider.base_url
    assert model.embedding_dim is not None
    assert model.embedding_dim > 0


def test_send_message_with_ollama_sync(ollama_provider):
    """Test sending a message with Ollama (sync version)"""
    import os
    import threading

    from letta_client import MessageCreate

    from tests.utils import wait_for_server

    # Skip if no models available
    models = ollama_provider.list_llm_models()
    if len(models) == 0:
        pytest.skip("No Ollama models available for testing")

    # Use the first available model
    model = models[0]

    # Set up client (similar to other tests)
    def run_server():
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    server_url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)

    client = Letta(base_url=server_url, token=None)

    # Create agent with Ollama model
    agent = client.agents.create(
        name="test_ollama_agent",
        memory_blocks=[{"label": "human", "value": "username: test_user"}, {"label": "persona", "value": "you are a helpful assistant"}],
        model=model.handle,
        embedding="letta/letta-free",
    )

    try:
        # Send a simple message
        response = client.agents.messages.create(
            agent_id=agent.id, messages=[MessageCreate(role="user", content="Hello, respond with just 'Hi there!'")]
        )

        # Verify response
        assert response is not None
        assert len(response.messages) > 0

        # Find the assistant response
        assistant_response = None
        for msg in response.messages:
            if msg.message_type == "assistant_message":
                assistant_response = msg
                break

        assert assistant_response is not None
        assert len(assistant_response.text) > 0

    finally:
        # Clean up
        client.agents.delete(agent.id)


@pytest.mark.asyncio
async def test_send_message_with_ollama_async_streaming(ollama_provider):
    """Test sending a message with Ollama using async streaming"""
    import os
    import threading

    from letta_client import MessageCreate

    from tests.utils import wait_for_server

    # Skip if no models available
    models = await ollama_provider.list_llm_models_async()
    if len(models) == 0:
        pytest.skip("No Ollama models available for testing")

    # Use the first available model
    model = models[0]

    # Set up client
    def run_server():
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    server_url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)

    client = Letta(base_url=server_url, token=None)

    # Create agent with Ollama model
    agent = client.agents.create(
        name="test_ollama_streaming_agent",
        memory_blocks=[{"label": "human", "value": "username: test_user"}, {"label": "persona", "value": "you are a helpful assistant"}],
        model=model.handle,
        embedding="letta/letta-free",
    )

    try:
        # Test step streaming (no token streaming)
        response_stream = client.agents.messages.create_stream(
            agent_id=agent.id, messages=[MessageCreate(role="user", content="Hello, respond briefly!")], stream_tokens=False
        )

        # Collect streamed messages
        streamed_messages = []
        for chunk in response_stream:
            if hasattr(chunk, "messages"):
                streamed_messages.extend(chunk.messages)

        # Verify streaming response
        assert len(streamed_messages) > 0

        # Find assistant response in stream
        assistant_response = None
        for msg in streamed_messages:
            if msg.message_type == "assistant_message":
                assistant_response = msg
                break

        assert assistant_response is not None
        assert len(assistant_response.text) > 0

    finally:
        # Clean up
        client.agents.delete(agent.id)


@pytest.mark.asyncio
async def test_send_message_with_ollama_async_job(ollama_provider):
    """Test sending a message with Ollama using async background job"""
    import os
    import threading
    import time

    from letta_client import MessageCreate

    from tests.utils import wait_for_server

    # Skip if no models available
    models = await ollama_provider.list_llm_models_async()
    if len(models) == 0:
        pytest.skip("No Ollama models available for testing")

    # Use the first available model
    model = models[0]

    # Set up client
    def run_server():
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    server_url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")
    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url)

    client = Letta(base_url=server_url, token=None)

    # Create agent with Ollama model
    agent = client.agents.create(
        name="test_ollama_async_agent",
        memory_blocks=[{"label": "human", "value": "username: test_user"}, {"label": "persona", "value": "you are a helpful assistant"}],
        model=model.handle,
        embedding="letta/letta-free",
    )

    try:
        # Start async job
        run = client.agents.messages.create_async(
            agent_id=agent.id, messages=[MessageCreate(role="user", content="Hello, respond briefly!")]
        )

        # Wait for completion
        def wait_for_run_completion(run_id: str, timeout: float = 30.0):
            start = time.time()
            while True:
                current_run = client.runs.retrieve(run_id)
                if current_run.status == "completed":
                    return current_run
                if current_run.status == "failed":
                    raise RuntimeError(f"Run {run_id} failed: {current_run.metadata}")
                if time.time() - start > timeout:
                    raise TimeoutError(f"Run {run_id} timed out")
                time.sleep(0.5)

        completed_run = wait_for_run_completion(run.id)

        # Verify the job completed successfully
        assert completed_run.status == "completed"
        assert "result" in completed_run.metadata

        # Get messages from the result
        result = completed_run.metadata["result"]
        assert "messages" in result
        messages = result["messages"]
        assert len(messages) > 0

        # Find assistant response
        assistant_response = None
        for msg in messages:
            if msg.get("message_type") == "assistant_message":
                assistant_response = msg
                break

        assert assistant_response is not None
        assert len(assistant_response.get("text", "")) > 0

    finally:
        # Clean up
        client.agents.delete(agent.id)
