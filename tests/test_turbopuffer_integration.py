import uuid
from datetime import datetime, timezone

import pytest

from letta.config import LettaConfig
from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import TagMatchMode, VectorDBProvider
from letta.server.server import SyncServer
from letta.settings import settings


@pytest.fixture(scope="module")
def server():
    """Server fixture for testing"""
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=False)
    return server


@pytest.fixture
async def sarah_agent(server, default_user):
    """Create a test agent named Sarah"""
    from letta.schemas.agent import CreateAgent
    from letta.schemas.embedding_config import EmbeddingConfig
    from letta.schemas.llm_config import LLMConfig

    agent = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Sarah",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    yield agent
    # Cleanup
    try:
        await server.agent_manager.delete_agent_async(agent.id, default_user)
    except:
        pass


@pytest.fixture
def enable_turbopuffer():
    """Temporarily enable Turbopuffer for testing with a test API key"""
    original_use_tpuf = settings.use_tpuf
    original_api_key = settings.tpuf_api_key
    original_environment = settings.environment

    # Enable Turbopuffer with test key
    settings.use_tpuf = True
    # Use the existing tpuf_api_key if set, otherwise keep original
    if not settings.tpuf_api_key:
        settings.tpuf_api_key = original_api_key
    # Set environment to DEV for testing
    settings.environment = "DEV"

    yield

    # Restore original values
    settings.use_tpuf = original_use_tpuf
    settings.tpuf_api_key = original_api_key
    settings.environment = original_environment


class TestTurbopufferIntegration:
    """Test Turbopuffer integration functionality with real connections"""

    def test_should_use_tpuf_with_settings(self):
        """Test that should_use_tpuf correctly reads settings"""
        # Save original values
        original_use_tpuf = settings.use_tpuf
        original_api_key = settings.tpuf_api_key

        try:
            # Test when both are set
            settings.use_tpuf = True
            settings.tpuf_api_key = "test-key"
            assert should_use_tpuf() is True

            # Test when use_tpuf is False
            settings.use_tpuf = False
            assert should_use_tpuf() is False

            # Test when API key is missing
            settings.use_tpuf = True
            settings.tpuf_api_key = None
            assert should_use_tpuf() is False
        finally:
            # Restore original values
            settings.use_tpuf = original_use_tpuf
            settings.tpuf_api_key = original_api_key

    @pytest.mark.asyncio
    async def test_archive_creation_with_tpuf_enabled(self, server, default_user, enable_turbopuffer):
        """Test that archives are created with correct vector_db_provider when TPUF is enabled"""
        archive = await server.archive_manager.create_archive_async(name="Test Archive with TPUF", actor=default_user)
        assert archive.vector_db_provider == VectorDBProvider.TPUF
        # TODO: Add cleanup when delete_archive method is available

    @pytest.mark.asyncio
    async def test_archive_creation_with_tpuf_disabled(self, server, default_user, disable_turbopuffer):
        """Test that archives default to NATIVE when TPUF is disabled"""
        archive = await server.archive_manager.create_archive_async(name="Test Archive without TPUF", actor=default_user)
        assert archive.vector_db_provider == VectorDBProvider.NATIVE
        # TODO: Add cleanup when delete_archive method is available

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured for testing")
    async def test_dual_write_and_query_with_real_tpuf(self, server, default_user, sarah_agent, enable_turbopuffer):
        """Test that passages are written to both SQL and Turbopuffer with real connection and can be queried"""

        # Create a TPUF-enabled archive
        archive = await server.archive_manager.create_archive_async(name="Test TPUF Archive for Real Dual Write", actor=default_user)
        assert archive.vector_db_provider == VectorDBProvider.TPUF

        # Attach the agent to the archive
        await server.archive_manager.attach_agent_to_archive_async(
            agent_id=sarah_agent.id, archive_id=archive.id, is_owner=True, actor=default_user
        )

        try:
            # Insert passages - this should trigger dual write
            test_passages = [
                "Turbopuffer is a vector database optimized for performance.",
                "This integration test verifies dual-write functionality.",
                "Metadata attributes should be properly stored in Turbopuffer.",
            ]

            for text in test_passages:
                passages = await server.passage_manager.insert_passage(agent_state=sarah_agent, text=text, actor=default_user)
                assert passages is not None
                assert len(passages) > 0

            # Verify passages are in SQL - use agent_manager to list passages
            sql_passages = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
            assert len(sql_passages) >= len(test_passages)
            for text in test_passages:
                assert any(p.text == text for p in sql_passages)

            # Test vector search which should use Turbopuffer
            embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")

            # Perform vector search
            vector_results = await server.agent_manager.query_agent_passages_async(
                actor=default_user,
                agent_id=sarah_agent.id,
                query_text="turbopuffer vector database",
                embedding_config=embedding_config,
                embed_query=True,
                limit=5,
            )

            # Should find relevant passages via Turbopuffer vector search
            assert len(vector_results) > 0
            # The most relevant result should be about Turbopuffer
            assert any("Turbopuffer" in p.text or "vector" in p.text for p in vector_results)

            # Test deletion - should delete from both
            passage_to_delete = sql_passages[0]
            await server.passage_manager.delete_agent_passages_async([passage_to_delete], default_user)

            # Verify deleted from SQL
            remaining = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
            assert not any(p.id == passage_to_delete.id for p in remaining)

            # Verify vector search no longer returns deleted passage
            vector_results_after_delete = await server.agent_manager.query_agent_passages_async(
                actor=default_user,
                agent_id=sarah_agent.id,
                query_text=passage_to_delete.text,
                embedding_config=embedding_config,
                embed_query=True,
                limit=10,
            )
            assert not any(p.id == passage_to_delete.id for p in vector_results_after_delete)

        finally:
            # TODO: Clean up archive when delete_archive method is available
            pass

    @pytest.mark.asyncio
    async def test_turbopuffer_metadata_attributes(self, enable_turbopuffer):
        """Test that Turbopuffer properly stores and retrieves metadata attributes"""

        # Only run if we have a real API key
        if not settings.tpuf_api_key:
            pytest.skip("No Turbopuffer API key available")

        client = TurbopufferClient()
        archive_id = f"test-archive-{datetime.now().timestamp()}"

        try:
            # Insert passages with various metadata
            test_data = [
                {
                    "id": f"passage-{uuid.uuid4()}",
                    "text": "First test passage",
                    "vector": [0.1] * 1536,
                    "organization_id": "org-123",
                    "created_at": datetime.now(timezone.utc),
                },
                {
                    "id": f"passage-{uuid.uuid4()}",
                    "text": "Second test passage",
                    "vector": [0.2] * 1536,
                    "organization_id": "org-123",
                    "created_at": datetime.now(timezone.utc),
                },
                {
                    "id": f"passage-{uuid.uuid4()}",
                    "text": "Third test passage from different org",
                    "vector": [0.3] * 1536,
                    "organization_id": "org-456",
                    "created_at": datetime.now(timezone.utc),
                },
            ]

            # Insert all passages
            result = await client.insert_archival_memories(
                archive_id=archive_id,
                text_chunks=[d["text"] for d in test_data],
                embeddings=[d["vector"] for d in test_data],
                passage_ids=[d["id"] for d in test_data],
                organization_id="org-123",  # Default org
                created_at=datetime.now(timezone.utc),
            )

            assert len(result) == 3

            # Query all passages (no tag filtering)
            query_vector = [0.15] * 1536
            results = await client.query_passages(archive_id=archive_id, query_embedding=query_vector, top_k=10)

            # Should get all passages
            assert len(results) == 3  # All three passages
            for passage, score in results:
                assert passage.organization_id is not None

            # Clean up
            await client.delete_passages(archive_id=archive_id, passage_ids=[d["id"] for d in test_data])

        except Exception as e:
            # Clean up on error
            try:
                await client.delete_all_passages(archive_id)
            except:
                pass
            raise e

    @pytest.mark.asyncio
    async def test_native_only_operations(self, server, default_user, sarah_agent, disable_turbopuffer):
        """Test that operations work correctly when using only native PostgreSQL"""

        # Create archive (should be NATIVE since turbopuffer is disabled)
        archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
            agent_id=sarah_agent.id, agent_name=sarah_agent.name, actor=default_user
        )
        assert archive.vector_db_provider == VectorDBProvider.NATIVE

        # Insert passages - should only write to SQL
        text_content = "This is a test passage for native PostgreSQL only."
        passages = await server.passage_manager.insert_passage(agent_state=sarah_agent, text=text_content, actor=default_user)

        assert passages is not None
        assert len(passages) > 0

        # List passages - should work from SQL
        sql_passages = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
        assert any(p.text == text_content for p in sql_passages)

        # Vector search should use PostgreSQL pgvector
        embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")
        vector_results = await server.agent_manager.query_agent_passages_async(
            actor=default_user,
            agent_id=sarah_agent.id,
            query_text="native postgresql",
            embedding_config=embedding_config,
            embed_query=True,
        )

        # Should still work with native PostgreSQL
        assert isinstance(vector_results, list)

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured for testing")
    async def test_hybrid_search_with_real_tpuf(self, enable_turbopuffer):
        """Test hybrid search functionality combining vector and full-text search"""

        import uuid

        from letta.helpers.tpuf_client import TurbopufferClient

        client = TurbopufferClient()
        archive_id = f"test-hybrid-{datetime.now().timestamp()}"
        org_id = str(uuid.uuid4())

        try:
            # Insert test passages with different characteristics
            texts = [
                "Turbopuffer is a vector database optimized for high-performance similarity search",
                "The quick brown fox jumps over the lazy dog",
                "Machine learning models require vector embeddings for semantic search",
                "Database optimization techniques improve query performance",
                "Turbopuffer supports both vector and full-text search capabilities",
            ]

            # Create simple embeddings for testing (normally you'd use a real embedding model)
            embeddings = [[float(i), float(i + 5), float(i + 10)] for i in range(len(texts))]
            passage_ids = [f"passage-{str(uuid.uuid4())}" for _ in texts]

            # Insert passages
            await client.insert_archival_memories(
                archive_id=archive_id, text_chunks=texts, embeddings=embeddings, passage_ids=passage_ids, organization_id=org_id
            )

            # Test vector-only search
            vector_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 6.0, 11.0],  # similar to second passage embedding
                search_mode="vector",
                top_k=3,
            )
            assert 0 < len(vector_results) <= 3
            # all results should have scores
            assert all(isinstance(score, float) for _, score in vector_results)

            # Test FTS-only search
            fts_results = await client.query_passages(
                archive_id=archive_id, query_text="Turbopuffer vector database", search_mode="fts", top_k=3
            )
            assert 0 < len(fts_results) <= 3
            # should find passages mentioning Turbopuffer
            assert any("Turbopuffer" in passage.text for passage, _ in fts_results)
            # all results should have scores
            assert all(isinstance(score, float) for _, score in fts_results)

            # Test hybrid search
            hybrid_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[2.0, 7.0, 12.0],
                query_text="vector search Turbopuffer",
                search_mode="hybrid",
                top_k=3,
                vector_weight=0.5,
                fts_weight=0.5,
            )
            assert 0 < len(hybrid_results) <= 3
            # hybrid should combine both vector and text relevance
            assert any("Turbopuffer" in passage.text or "vector" in passage.text for passage, _ in hybrid_results)
            # all results should have scores
            assert all(isinstance(score, float) for _, score in hybrid_results)
            # results should be sorted by score (highest first)
            scores = [score for _, score in hybrid_results]
            assert scores == sorted(scores, reverse=True)

            # Test with different weights
            vector_heavy_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[0.0, 5.0, 10.0],  # very similar to first passage
                query_text="quick brown fox",  # matches second passage
                search_mode="hybrid",
                top_k=3,
                vector_weight=0.8,  # emphasize vector search
                fts_weight=0.2,
            )
            assert 0 < len(vector_heavy_results) <= 3
            # all results should have scores
            assert all(isinstance(score, float) for _, score in vector_heavy_results)

            # Test error handling - missing embedding for vector mode
            with pytest.raises(ValueError, match="query_embedding is required"):
                await client.query_passages(archive_id=archive_id, search_mode="vector", top_k=3)

            # Test error handling - missing text for FTS mode
            with pytest.raises(ValueError, match="query_text is required"):
                await client.query_passages(archive_id=archive_id, search_mode="fts", top_k=3)

            # Test error handling - missing both for hybrid mode
            with pytest.raises(ValueError, match="Both query_embedding and query_text are required"):
                await client.query_passages(archive_id=archive_id, query_embedding=[1.0, 2.0, 3.0], search_mode="hybrid", top_k=3)

        finally:
            # Clean up
            try:
                await client.delete_all_passages(archive_id)
            except:
                pass

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured for testing")
    async def test_tag_filtering_with_real_tpuf(self, enable_turbopuffer):
        """Test tag filtering functionality with AND and OR logic"""

        import uuid

        from letta.helpers.tpuf_client import TurbopufferClient

        client = TurbopufferClient()
        archive_id = f"test-tags-{datetime.now().timestamp()}"
        org_id = str(uuid.uuid4())

        try:
            # Insert passages with different tag combinations
            texts = [
                "Python programming tutorial",
                "Machine learning with Python",
                "JavaScript web development",
                "Python data science tutorial",
                "React JavaScript framework",
            ]

            tag_sets = [
                ["python", "tutorial"],
                ["python", "ml"],
                ["javascript", "web"],
                ["python", "tutorial", "data"],
                ["javascript", "react"],
            ]

            embeddings = [[float(i), float(i + 5), float(i + 10)] for i in range(len(texts))]
            passage_ids = [f"passage-{str(uuid.uuid4())}" for _ in texts]

            # Insert passages with tags
            for i, (text, tags, embedding, passage_id) in enumerate(zip(texts, tag_sets, embeddings, passage_ids)):
                await client.insert_archival_memories(
                    archive_id=archive_id,
                    text_chunks=[text],
                    embeddings=[embedding],
                    passage_ids=[passage_id],
                    organization_id=org_id,
                    tags=tags,
                    created_at=datetime.now(timezone.utc),
                )

            # Test tag filtering with "any" mode (should find passages with any of the specified tags)
            python_any_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 6.0, 11.0],
                search_mode="vector",
                top_k=10,
                tags=["python"],
                tag_match_mode=TagMatchMode.ANY,
            )

            # Should find 3 passages with python tag
            python_passages = [passage for passage, _ in python_any_results]
            python_texts = [p.text for p in python_passages]
            assert len(python_passages) == 3
            assert "Python programming tutorial" in python_texts
            assert "Machine learning with Python" in python_texts
            assert "Python data science tutorial" in python_texts

            # Test tag filtering with "all" mode
            python_tutorial_all_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 6.0, 11.0],
                search_mode="vector",
                top_k=10,
                tags=["python", "tutorial"],
                tag_match_mode=TagMatchMode.ALL,
            )

            # Should find 2 passages that have both python AND tutorial tags
            tutorial_passages = [passage for passage, _ in python_tutorial_all_results]
            tutorial_texts = [p.text for p in tutorial_passages]
            assert len(tutorial_passages) == 2
            assert "Python programming tutorial" in tutorial_texts
            assert "Python data science tutorial" in tutorial_texts

            # Test tag filtering with FTS mode
            js_fts_results = await client.query_passages(
                archive_id=archive_id,
                query_text="javascript",
                search_mode="fts",
                top_k=10,
                tags=["javascript"],
                tag_match_mode=TagMatchMode.ANY,
            )

            # Should find 2 passages with javascript tag
            js_passages = [passage for passage, _ in js_fts_results]
            js_texts = [p.text for p in js_passages]
            assert len(js_passages) == 2
            assert "JavaScript web development" in js_texts
            assert "React JavaScript framework" in js_texts

            # Test hybrid search with tags
            python_hybrid_results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[2.0, 7.0, 12.0],
                query_text="python programming",
                search_mode="hybrid",
                top_k=10,
                tags=["python"],
                tag_match_mode=TagMatchMode.ANY,
                vector_weight=0.6,
                fts_weight=0.4,
            )

            # Should find python-tagged passages
            hybrid_passages = [passage for passage, _ in python_hybrid_results]
            hybrid_texts = [p.text for p in hybrid_passages]
            assert len(hybrid_passages) == 3
            assert all("Python" in text for text in hybrid_texts)

        finally:
            # Clean up
            try:
                await client.delete_all_passages(archive_id)
            except:
                pass


@pytest.mark.parametrize("turbopuffer_mode", [True, False], indirect=True)
class TestTurbopufferParametrized:
    """Test that functionality works with and without Turbopuffer enabled"""

    @pytest.mark.asyncio
    async def test_passage_operations_with_mode(self, turbopuffer_mode, server, default_user, sarah_agent):
        """Test that passage operations work in both modes"""

        # Get or create archive
        archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(
            agent_id=sarah_agent.id, agent_name=sarah_agent.name, actor=default_user
        )

        # Check that vector_db_provider matches the mode
        if settings.use_tpuf and settings.tpuf_api_key:
            expected_provider = VectorDBProvider.TPUF
        else:
            expected_provider = VectorDBProvider.NATIVE
        assert archive.vector_db_provider == expected_provider

        # Test inserting a passage (should work in both modes)
        test_text = f"Test passage for {expected_provider} mode"
        passages = await server.passage_manager.insert_passage(agent_state=sarah_agent, text=test_text, actor=default_user)

        assert passages is not None
        assert len(passages) > 0
        assert passages[0].text == test_text

        # List passages should work in both modes
        listed = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
        assert any(p.text == test_text for p in listed)

        # Delete should work in both modes
        await server.passage_manager.delete_agent_passages_async(passages, default_user)

        # Verify deletion
        remaining = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
        assert not any(p.id == passages[0].id for p in remaining)
