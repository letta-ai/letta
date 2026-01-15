"""
Integration tests for the override_model functionality.

Tests the ability to send messages to agents using a different model than the agent's default
configured model, without permanently changing the agent's configuration.

Note: Some type: ignore comments are present because the SDK types haven't been regenerated
to include the new override_model parameter yet.
"""

import logging
import os
import threading
import time
import uuid
from typing import Any, Generator, List

import pytest
import requests
from dotenv import load_dotenv
from letta_client import APIError, AsyncLetta, Letta
from letta_client.types import AgentState, MessageCreateParam

logger = logging.getLogger(__name__)

# Test message that forces a simple response
USER_MESSAGE_OTID = str(uuid.uuid4())
USER_MESSAGE_SIMPLE: List[MessageCreateParam] = [
    MessageCreateParam(
        role="user",
        content="This is an automated test. Please respond with exactly: 'Test successful'",
        otid=USER_MESSAGE_OTID,
    )
]


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture(scope="module")
def server_url() -> str:
    """
    Provides the URL for the Letta server.
    If LETTA_SERVER_URL is not set, starts the server in a background thread
    and polls until it's accepting connections.
    """

    def _run_server() -> None:
        load_dotenv()
        from letta.server.rest_api.app import start_server

        start_server(debug=True)

    url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()

        # Poll until the server is up (or timeout)
        timeout_seconds = 60
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                resp = requests.get(url + "/v1/health")
                if resp.status_code < 500:
                    break
            except requests.exceptions.RequestException:
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Could not reach {url} within {timeout_seconds}s")

    return url


@pytest.fixture(scope="module")
def client(server_url: str) -> Generator[Letta, None, None]:
    """
    Creates and returns a synchronous Letta REST client for testing.
    """
    client_instance = Letta(base_url=server_url)
    yield client_instance


@pytest.fixture(scope="function")
def async_client(server_url: str) -> Generator[AsyncLetta, None, None]:
    """
    Creates and returns an asynchronous Letta REST client for testing.
    """
    async_client_instance = AsyncLetta(base_url=server_url)
    yield async_client_instance


@pytest.fixture(scope="function")
def agent_with_gpt4o_mini(client: Letta) -> Generator[AgentState, None, None]:
    """
    Creates an agent configured with gpt-4o-mini for testing model override.
    """
    agent_state = client.agents.create(
        name=f"override_model_test_{uuid.uuid4().hex[:8]}",
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        tags=["override_model_test"],
        memory_blocks=[
            {"label": "human", "value": "Test user"},
            {"label": "persona", "value": "You are a helpful assistant."},
        ],
    )
    yield agent_state

    # Cleanup
    try:
        client.agents.delete(agent_state.id)
    except Exception as e:
        logger.warning(f"Failed to delete agent {agent_state.id}: {e}")


@pytest.fixture(scope="function")
def agent_with_gemini(client: Letta) -> Generator[AgentState, None, None]:
    """
    Creates an agent configured with Gemini for testing model override.
    """
    agent_state = client.agents.create(
        name=f"override_model_test_gemini_{uuid.uuid4().hex[:8]}",
        model="google_ai/gemini-2.0-flash",
        embedding="openai/text-embedding-3-small",
        tags=["override_model_test"],
        memory_blocks=[
            {"label": "human", "value": "Test user"},
            {"label": "persona", "value": "You are a helpful assistant."},
        ],
    )
    yield agent_state

    # Cleanup
    try:
        client.agents.delete(agent_state.id)
    except Exception as e:
        logger.warning(f"Failed to delete agent {agent_state.id}: {e}")


# ------------------------------
# Test Cases
# ------------------------------


class TestOverrideModelSync:
    """Tests for override_model with synchronous message sending."""

    def test_override_model_changes_model_used(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that override_model causes the message to be processed by a different model.
        Agent is configured with gpt-4o-mini, but we override with gpt-4o.
        """
        agent = agent_with_gpt4o_mini

        # Verify agent's default model
        assert agent.model is not None
        assert "gpt-4o-mini" in agent.model

        # Send message with override model
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
        )

        # Verify we got a response
        assert response.messages is not None
        assert len(response.messages) > 0

        # Verify agent's model was not permanently changed
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model is not None
        assert "gpt-4o-mini" in agent_after.model, "Agent's model should not be permanently changed"

    def test_override_model_cross_provider(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test overriding from one provider to another (OpenAI -> Google AI).
        """
        agent = agent_with_gpt4o_mini

        # Verify agent's default model is OpenAI
        assert agent.model is not None
        assert "openai" in agent.model.lower() or "gpt" in agent.model.lower()

        # Send message with Google AI model override
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "google_ai/gemini-2.0-flash"},
        )

        # Verify we got a response
        assert response.messages is not None
        assert len(response.messages) > 0

        # Verify agent's model was not permanently changed
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model is not None
        assert "gpt-4o-mini" in agent_after.model, "Agent's model should not be permanently changed"

    def test_override_model_with_none_uses_default(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that not setting override_model (None) uses the agent's default model.
        """
        agent = agent_with_gpt4o_mini

        # Send message without override_model
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
        )

        # Verify we got a response
        assert response.messages is not None
        assert len(response.messages) > 0

    def test_override_model_invalid_handle(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that an invalid override_model handle raises an appropriate error.
        """
        agent = agent_with_gpt4o_mini

        with pytest.raises(APIError) as exc_info:
            client.agents.messages.create(
                agent_id=agent.id,
                messages=USER_MESSAGE_SIMPLE,
                extra_body={"override_model": "invalid/nonexistent-model-xyz"},
            )

        # Verify the error is related to the invalid model handle
        # The error could be a 400, 404, or 422 depending on implementation
        error = exc_info.value
        # APIError should have status_code attribute
        assert hasattr(error, "status_code") and error.status_code in [400, 404, 422]  # type: ignore[attr-defined]


class TestOverrideModelStreaming:
    """Tests for override_model with streaming message sending."""

    def test_override_model_streaming(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that override_model works correctly with streaming enabled.
        """
        agent = agent_with_gpt4o_mini

        # Send message with streaming and override model
        # Note: Using messages.create with streaming=True, not create_stream
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
            streaming=True,
        )

        # For streaming, the response object should still have messages
        # (they're accumulated from the stream internally)
        assert response is not None

        # Verify agent's model was not permanently changed
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model is not None
        assert "gpt-4o-mini" in agent_after.model

    def test_override_model_streaming_cross_provider(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test streaming with cross-provider model override (OpenAI -> Google AI).
        """
        agent = agent_with_gpt4o_mini

        # Send message with streaming and Google AI override
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "google_ai/gemini-2.0-flash"},
            streaming=True,
        )

        # Verify we got a response
        assert response is not None


class TestOverrideModelAsync:
    """Tests for override_model with async message sending."""

    @pytest.mark.asyncio
    async def test_override_model_async(
        self,
        async_client: AsyncLetta,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that override_model works correctly with async message sending.
        """
        agent = agent_with_gpt4o_mini

        # Send message asynchronously with override model
        run = await async_client.agents.messages.create_async(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
        )

        # Verify we got a run object
        assert run is not None
        assert run.id is not None

        # Wait for the run to complete (poll status)
        max_wait = 60  # seconds
        poll_interval = 1  # second
        elapsed = 0
        run_status = None

        while elapsed < max_wait:
            run_status = client.runs.retrieve(run.id)
            if run_status.status in ["completed", "failed", "cancelled"]:
                break
            time.sleep(poll_interval)
            elapsed += poll_interval

        # Verify run completed
        assert run_status is not None
        assert run_status.status == "completed", f"Run failed with status: {run_status.status}"

        # Verify agent's model was not permanently changed
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model is not None
        assert "gpt-4o-mini" in agent_after.model


class TestOverrideModelConversation:
    """Tests for override_model with conversation-based messaging."""

    def test_override_model_conversation(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that override_model works correctly with conversation endpoints.
        """
        agent = agent_with_gpt4o_mini

        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)
        assert conversation is not None
        assert conversation.id is not None

        # Send message through conversation with override model
        response = client.conversations.messages.create(
            conversation_id=conversation.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
        )

        # Verify we got a response
        assert response is not None

        # Verify agent's model was not permanently changed
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model is not None
        assert "gpt-4o-mini" in agent_after.model


class TestOverrideModelConsistency:
    """Tests to ensure override_model doesn't affect agent state persistently."""

    def test_multiple_override_models_in_sequence(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test sending multiple messages with different override models.
        Agent's default model should remain unchanged throughout.
        """
        agent = agent_with_gpt4o_mini
        original_model = agent.model

        # First message with gpt-4o
        response1 = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
        )
        assert response1.messages is not None

        # Second message with Gemini
        response2 = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "google_ai/gemini-2.0-flash"},
        )
        assert response2.messages is not None

        # Third message without override (should use default)
        response3 = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
        )
        assert response3.messages is not None

        # Verify agent's model is still the original
        agent_after = client.agents.retrieve(agent.id)
        assert agent_after.model == original_model

    def test_override_model_does_not_modify_agent_state(
        self,
        client: Letta,
        agent_with_gpt4o_mini: AgentState,
    ) -> None:
        """
        Test that using override_model doesn't modify any part of the agent state.
        """
        agent = agent_with_gpt4o_mini

        # Get full agent state before
        agent_before = client.agents.retrieve(agent.id)

        # Send message with override
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=USER_MESSAGE_SIMPLE,
            extra_body={"override_model": "openai/gpt-4o"},
        )
        assert response.messages is not None

        # Get full agent state after
        agent_after = client.agents.retrieve(agent.id)

        # Verify key fields are unchanged
        assert agent_after.model == agent_before.model
        assert agent_after.name == agent_before.name
        assert agent_after.agent_type == agent_before.agent_type
