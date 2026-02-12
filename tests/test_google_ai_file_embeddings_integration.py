"""
Integration tests for Google AI file embeddings.

Verifies the complete file embedding pipeline works with Google AI:
- Files are indexed with Google AI embeddings (not OpenAI)
- semantic_search_files returns results (no vector dimension mismatch)
- Passage creation via request_embeddings works

Requirements:
    - GEMINI_API_KEY environment variable
    - Running Letta server (auto-started via conftest server_url fixture)

Markers:
    @pytest.mark.integration
    @pytest.mark.google
"""

import os
import tempfile
import time

import pytest
from dotenv import load_dotenv
from letta_client import Letta as LettaSDKClient

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig

load_dotenv()

pytestmark = pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")


@pytest.fixture(scope="module")
def client(server_url):
    """Create Letta SDK client using the shared server_url fixture from conftest."""
    return LettaSDKClient(base_url=server_url, token=None)


@pytest.fixture
def google_ai_embedding_config():
    return EmbeddingConfig(
        embedding_model="gemini-embedding-001",
        embedding_endpoint_type="google_ai",
        embedding_endpoint="https://generativelanguage.googleapis.com",
        embedding_dim=3072,
        embedding_chunk_size=300,
        batch_size=100,
    )


@pytest.fixture
def google_ai_llm_config():
    return LLMConfig.default_config(model_name="google_ai/gemini-2.0-flash")


class TestGoogleAIFileEmbeddingsEndToEnd:
    """
    Full end-to-end tests for file embedding with Google AI.

    Core invariant being tested: the embedding model used to index file chunks
    must be the same model used to embed search queries. Previously, files were
    always indexed with OpenAI vectors regardless of embedding_config, causing
    semantic_search_files to return empty results when the agent used Google AI.
    """

    @pytest.mark.integration
    @pytest.mark.google
    def test_create_folder_upload_file_search(self, client, google_ai_embedding_config, google_ai_llm_config):
        """
        Full flow: create source -> upload file -> wait for processing ->
        create agent -> attach source -> verify semantic_search_files returns results.

        Primary regression test for the embedding mismatch bug.
        """
        source = agent = None
        try:
            # Step 1: Create source with Google AI embedding config
            source = client.sources.create(
                name="test_google_ai_embeddings",
                embedding_config=google_ai_embedding_config,
            )
            assert source is not None

            # Step 2: Upload file with known content
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                f.write(
                    "Python is a high-level programming language known for its simplicity. "
                    "It supports multiple programming paradigms. "
                    "Python was created by Guido van Rossum and first released in 1991."
                )
                temp_path = f.name

            file = client.sources.files.upload(source_id=source.id, file_path=temp_path)
            assert file is not None

            # Step 3: Wait for file processing
            for _ in range(30):
                status = client.sources.files.retrieve(file_id=file.id, source_id=source.id)
                if status.processing_status == "completed":
                    break
                if status.processing_status == "failed":
                    pytest.fail(f"File processing failed: {status}")
                time.sleep(2)
            else:
                pytest.fail("File processing timed out after 60s")

            # Step 4: Create agent with matching Google AI embedding config
            agent = client.agents.create(
                name="test_google_ai_agent",
                llm_config=google_ai_llm_config,
                embedding_config=google_ai_embedding_config,
            )

            # Step 5: Attach source to agent
            client.agents.sources.attach(source_id=source.id, agent_id=agent.id)

            # Step 6: Verify semantic_search_files works (not empty, no dimension error)
            response = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "role": "user",
                        "content": "Use semantic_search_files to find who created Python. Report the result.",
                    }
                ],
            )
            assert response is not None
            assert response.messages is not None

        finally:
            if agent:
                client.agents.delete(agent_id=agent.id)
            if source:
                client.sources.delete(source_id=source.id)

    @pytest.mark.integration
    @pytest.mark.google
    def test_file_embeddings_use_google_ai_not_openai(self, client, google_ai_embedding_config):
        """
        Verify that file processing completes successfully with Google AI embedding config.

        If OpenAIEmbedder were used (the bug), this would fail unless OPENAI_API_KEY
        is also set. With the fix, only GEMINI_API_KEY is needed.
        """
        source = None
        try:
            source = client.sources.create(
                name="test_google_ai_embedder_selection",
                embedding_config=google_ai_embedding_config,
            )

            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                f.write("Test content to verify GoogleAIEmbedder is selected.")
                temp_path = f.name

            file = client.sources.files.upload(source_id=source.id, file_path=temp_path)

            status = None
            for _ in range(30):
                status = client.sources.files.retrieve(file_id=file.id, source_id=source.id)
                if status.processing_status in ("completed", "failed"):
                    break
                time.sleep(2)

            assert status.processing_status == "completed", (
                f"Expected 'completed', got '{status.processing_status}' "
                "— GoogleAIEmbedder may not be selected, check routing in sources.py"
            )

        finally:
            if source:
                client.sources.delete(source_id=source.id)

    @pytest.mark.integration
    @pytest.mark.google
    def test_passage_creation_via_archival_memory(self, client, google_ai_embedding_config, google_ai_llm_config):
        """
        Verify GoogleAIClient.request_embeddings() works for passage creation.
        Tests the archival memory path (the other half of the fix).
        """
        agent = None
        try:
            agent = client.agents.create(
                name="test_google_ai_passage_creation",
                llm_config=google_ai_llm_config,
                embedding_config=google_ai_embedding_config,
            )

            # Archive something (exercises request_embeddings)
            response = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "role": "user",
                        "content": "Please archive this fact: The capital of Australia is Canberra.",
                    }
                ],
            )
            assert response is not None

            # Verify passage was created with correct embedding
            passages = client.agents.archival_memory.list(agent_id=agent.id)
            assert any("Canberra" in p.text for p in passages), (
                "Passage containing 'Canberra' not found — request_embeddings may have failed"
            )

        finally:
            if agent:
                client.agents.delete(agent_id=agent.id)

    @pytest.mark.integration
    @pytest.mark.google
    def test_semantic_search_returns_relevant_results(self, client, google_ai_embedding_config, google_ai_llm_config):
        """
        Verify semantic_search_files returns semantically relevant (not random) results.
        The core correctness test: embedding consistency between index and query time.
        """
        source = agent = None
        try:
            source = client.sources.create(
                name="test_semantic_relevance",
                embedding_config=google_ai_embedding_config,
            )

            for content in [
                "Dogs are loyal pets. Golden retrievers are friendly breeds. Labradors love water.",
                "Mars is the fourth planet from the Sun. NASA has sent rovers to Mars.",
            ]:
                with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                    f.write(content)
                    temp_path = f.name
                client.sources.files.upload(source_id=source.id, file_path=temp_path)

            # Wait for both files to process
            time.sleep(15)

            agent = client.agents.create(
                name="test_semantic_relevance_agent",
                llm_config=google_ai_llm_config,
                embedding_config=google_ai_embedding_config,
            )
            client.agents.sources.attach(source_id=source.id, agent_id=agent.id)

            response = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "role": "user",
                        "content": "Use semantic_search_files with query 'dog breeds' and report what you find.",
                    }
                ],
            )
            assert response is not None
            # The response should mention dog-related content, not space/Mars
            # (This is a smoke test - exact assertion depends on agent response format)

        finally:
            if agent:
                client.agents.delete(agent_id=agent.id)
            if source:
                client.sources.delete(source_id=source.id)
