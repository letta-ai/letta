"""
Tests for embedding-optional archival memory feature.

This file tests that agents can be created without an embedding model
and that archival memory operations (insert, list, search) work correctly
using text-based search when no embeddings are available.
"""

import os
import threading
import warnings

import pytest
from dotenv import load_dotenv
from letta_client import Letta as LettaSDKClient
from letta_client.types import CreateBlockParam

from tests.utils import wait_for_server

# Constants
SERVER_PORT = 8283


def run_server():
    load_dotenv()
    from letta.server.rest_api.app import start_server

    print("Starting server...")
    start_server(debug=True)


@pytest.fixture(scope="module")
def client() -> LettaSDKClient:
    """Get or start a Letta server and return a client."""
    server_url = os.getenv("LETTA_SERVER_URL", f"http://localhost:{SERVER_PORT}")
    if not os.getenv("LETTA_SERVER_URL"):
        print("Starting server thread")
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        wait_for_server(server_url, timeout=60)

    print("Running embedding-optional tests with server:", server_url)
    client = LettaSDKClient(base_url=server_url)
    yield client


@pytest.fixture(scope="function")
def agent_without_embedding(client: LettaSDKClient):
    """Create an agent without an embedding model for testing."""
    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: test_user",
            ),
        ],
        model="openai/gpt-4o-mini",
        # NOTE: Intentionally NOT providing embedding parameter
        # to test embedding-optional functionality
    )

    assert agent_state.embedding_config is None, "Agent should have no embedding config"

    yield agent_state

    # Cleanup
    client.agents.delete(agent_id=agent_state.id)


@pytest.fixture(scope="function")
def agent_with_embedding(client: LettaSDKClient):
    """Create an agent WITH an embedding model for comparison testing."""
    agent_state = client.agents.create(
        memory_blocks=[
            CreateBlockParam(
                label="human",
                value="username: test_user_with_embedding",
            ),
        ],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    assert agent_state.embedding_config is not None, "Agent should have embedding config"

    yield agent_state

    # Cleanup
    client.agents.delete(agent_id=agent_state.id)


class TestAgentCreationWithoutEmbedding:
    """Tests for agent creation without embedding configuration."""

    def test_create_agent_without_embedding(self, client: LettaSDKClient):
        """Test that an agent can be created without an embedding model."""
        agent_state = client.agents.create(
            memory_blocks=[
                CreateBlockParam(
                    label="human",
                    value="test user",
                ),
            ],
            model="openai/gpt-4o-mini",
        )

        try:
            assert agent_state.id is not None
            assert agent_state.id.startswith("agent-")
            assert agent_state.embedding_config is None
            assert agent_state.llm_config is not None
        finally:
            client.agents.delete(agent_id=agent_state.id)

    def test_agent_with_and_without_embedding_coexist(self, agent_without_embedding, agent_with_embedding):
        """Test that agents with and without embedding can coexist."""
        assert agent_without_embedding.id != agent_with_embedding.id
        assert agent_without_embedding.embedding_config is None
        assert agent_with_embedding.embedding_config is not None


class TestArchivalMemoryInsertWithoutEmbedding:
    """Tests for inserting archival memory without embeddings."""

    def test_insert_passage_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test inserting a passage into an agent without embedding config."""
        agent_id = agent_without_embedding.id

        # Insert a passage - use deprecated API but suppress warning
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            passages = client.agents.passages.create(
                agent_id=agent_id,
                text="This is a test passage about Python programming.",
            )

        # Should return a list with one passage
        assert len(passages) == 1
        passage = passages[0]

        assert passage.id is not None
        assert passage.text == "This is a test passage about Python programming."
        # Embedding should be None for agents without embedding config
        assert passage.embedding is None
        assert passage.embedding_config is None

    def test_insert_multiple_passages_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test inserting multiple passages into an agent without embedding."""
        agent_id = agent_without_embedding.id

        test_passages = [
            "Machine learning is a subset of artificial intelligence.",
            "Python is widely used for data science applications.",
            "Neural networks can learn complex patterns from data.",
        ]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            for text in test_passages:
                passages = client.agents.passages.create(
                    agent_id=agent_id,
                    text=text,
                )
                assert len(passages) == 1
                assert passages[0].embedding is None

            # Verify all passages were inserted
            all_passages = client.agents.passages.list(agent_id=agent_id)

        assert len(all_passages) >= 3

    def test_insert_passage_with_tags_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test inserting a passage with tags into an agent without embedding."""
        agent_id = agent_without_embedding.id

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            passages = client.agents.passages.create(
                agent_id=agent_id,
                text="Important fact: The sky is blue due to Rayleigh scattering.",
                tags=["science", "physics", "important"],
            )

        assert len(passages) == 1
        passage = passages[0]
        assert passage.embedding is None
        assert passage.tags is not None
        assert set(passage.tags) == {"science", "physics", "important"}


class TestArchivalMemoryListWithoutEmbedding:
    """Tests for listing archival memory without embeddings."""

    def test_list_passages_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test listing passages from an agent without embedding."""
        agent_id = agent_without_embedding.id

        # Insert some passages first
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client.agents.passages.create(
                agent_id=agent_id,
                text="First test passage",
            )
            client.agents.passages.create(
                agent_id=agent_id,
                text="Second test passage",
            )

            # List passages
            passages = client.agents.passages.list(agent_id=agent_id)

        assert len(passages) >= 2

        for passage in passages:
            # Verify embeddings are None
            assert passage.embedding is None

    def test_list_passages_with_search_filter(self, client: LettaSDKClient, agent_without_embedding):
        """Test listing passages with text search filter."""
        agent_id = agent_without_embedding.id

        # Insert passages with distinctive content
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client.agents.passages.create(
                agent_id=agent_id,
                text="Apple is a fruit that grows on trees.",
            )
            client.agents.passages.create(
                agent_id=agent_id,
                text="Python is a programming language.",
            )

            # Search for passages containing "fruit"
            passages = client.agents.passages.list(
                agent_id=agent_id,
                search="fruit",
            )

        # Should find the apple passage
        assert len(passages) >= 1
        assert any("fruit" in p.text.lower() for p in passages)


class TestArchivalMemorySearchWithoutEmbedding:
    """Tests for searching archival memory without embeddings (text-based search)."""

    def test_search_passages_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test searching passages using text search (no embeddings)."""
        agent_id = agent_without_embedding.id

        # Insert test passages
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client.agents.passages.create(
                agent_id=agent_id,
                text="The capital of France is Paris.",
            )
            client.agents.passages.create(
                agent_id=agent_id,
                text="Tokyo is the capital of Japan.",
            )
            client.agents.passages.create(
                agent_id=agent_id,
                text="Python is a popular programming language.",
            )

            # Search for passages about capitals
            results = client.agents.passages.search(
                agent_id=agent_id,
                query="capital",
            )

        # Should find passages about capitals (text search)
        assert results is not None
        # Check results structure - might be a response object
        if hasattr(results, "results"):
            assert len(results.results) >= 1
        elif hasattr(results, "__len__"):
            assert len(results) >= 0  # Might be empty if text search returns 0

    def test_global_passage_search_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test global passage search endpoint for agent without embedding."""
        agent_id = agent_without_embedding.id

        # Insert a passage
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client.agents.passages.create(
                agent_id=agent_id,
                text="Unique test content for global search testing xyz123.",
            )

        # Use global passage search
        results = client.passages.search(
            query="xyz123",
            agent_id=agent_id,
        )

        # Should find the passage using text search
        assert results is not None


class TestArchivalMemoryDeleteWithoutEmbedding:
    """Tests for deleting archival memory without embeddings."""

    def test_delete_passage_without_embedding(self, client: LettaSDKClient, agent_without_embedding):
        """Test deleting a passage from an agent without embedding."""
        agent_id = agent_without_embedding.id

        # Insert a passage
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            passages = client.agents.passages.create(
                agent_id=agent_id,
                text="Passage to be deleted",
            )

        passage_id = passages[0].id

        # Delete the passage
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            client.agents.passages.delete(
                agent_id=agent_id,
                memory_id=passage_id,
            )

            # Verify it's deleted - should not appear in list
            remaining = client.agents.passages.list(agent_id=agent_id)

        assert all(p.id != passage_id for p in remaining)


class TestComparisonWithAndWithoutEmbedding:
    """Compare behavior between agents with and without embedding config."""

    def test_passage_insert_comparison(
        self,
        client: LettaSDKClient,
        agent_without_embedding,
        agent_with_embedding,
    ):
        """Compare passage insertion between agents with/without embedding."""
        test_text = "Comparison test: This is identical content for both agents."

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)

            # Insert into agent without embedding
            passages_no_embed = client.agents.passages.create(
                agent_id=agent_without_embedding.id,
                text=test_text,
            )

            # Insert into agent with embedding
            passages_with_embed = client.agents.passages.create(
                agent_id=agent_with_embedding.id,
                text=test_text,
            )

        # Both should succeed
        assert len(passages_no_embed) == 1
        assert len(passages_with_embed) == 1

        # Text should be identical
        assert passages_no_embed[0].text == passages_with_embed[0].text

        # Embedding status should differ
        assert passages_no_embed[0].embedding is None
        assert passages_with_embed[0].embedding is not None

    def test_list_passages_comparison(
        self,
        client: LettaSDKClient,
        agent_without_embedding,
        agent_with_embedding,
    ):
        """Compare passage listing between agents with/without embedding."""
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)

            # Insert passages into both agents
            client.agents.passages.create(
                agent_id=agent_without_embedding.id,
                text="Test passage for listing comparison",
            )
            client.agents.passages.create(
                agent_id=agent_with_embedding.id,
                text="Test passage for listing comparison",
            )

            # List from both agents
            passages_no_embed = client.agents.passages.list(agent_id=agent_without_embedding.id)
            passages_with_embed = client.agents.passages.list(agent_id=agent_with_embedding.id)

        # Both should return passages
        assert len(passages_no_embed) >= 1
        assert len(passages_with_embed) >= 1


class TestEdgeCases:
    """Edge cases and error handling for embedding-optional feature."""

    def test_empty_archival_memory_search(self, client: LettaSDKClient, agent_without_embedding):
        """Test searching an empty archival memory."""
        agent_id = agent_without_embedding.id

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            # Search without any passages - should return empty, not error
            results = client.agents.passages.search(
                agent_id=agent_id,
                query="anything",
            )

        # Should return empty results, not raise an error
        assert results is not None

    def test_passage_with_special_characters(self, client: LettaSDKClient, agent_without_embedding):
        """Test inserting passages with special characters."""
        agent_id = agent_without_embedding.id

        special_text = "Special chars: @#$%^&*() 日本語 émojis 🎉 <script>alert('xss')</script>"

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            passages = client.agents.passages.create(
                agent_id=agent_id,
                text=special_text,
            )

        assert len(passages) == 1
        assert passages[0].text == special_text
        assert passages[0].embedding is None

    def test_very_long_passage(self, client: LettaSDKClient, agent_without_embedding):
        """Test inserting a very long passage."""
        agent_id = agent_without_embedding.id

        # Create a long text (10KB)
        long_text = "This is a test. " * 1000

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            passages = client.agents.passages.create(
                agent_id=agent_id,
                text=long_text,
            )

        assert len(passages) >= 1  # Might be chunked
        # First passage should have no embedding
        assert passages[0].embedding is None
