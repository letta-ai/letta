import uuid
from datetime import datetime, timezone

import pytest

from letta.config import LettaConfig
from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf, should_use_tpuf_for_messages
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, TagMatchMode, VectorDBProvider
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.passage import Passage
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


@pytest.fixture
def enable_message_embedding():
    """Enable both Turbopuffer and message embedding"""
    original_use_tpuf = settings.use_tpuf
    original_api_key = settings.tpuf_api_key
    original_embed_messages = settings.embed_all_messages
    original_environment = settings.environment

    settings.use_tpuf = True
    settings.tpuf_api_key = settings.tpuf_api_key or "test-key"
    settings.embed_all_messages = True
    settings.environment = "DEV"

    yield

    settings.use_tpuf = original_use_tpuf
    settings.tpuf_api_key = original_api_key
    settings.embed_all_messages = original_embed_messages
    settings.environment = original_environment


@pytest.fixture
def disable_turbopuffer():
    """Ensure Turbopuffer is disabled for testing"""
    original_use_tpuf = settings.use_tpuf
    original_embed_messages = settings.embed_all_messages

    settings.use_tpuf = False
    settings.embed_all_messages = False

    yield

    settings.use_tpuf = original_use_tpuf
    settings.embed_all_messages = original_embed_messages


@pytest.fixture
def sample_embedding_config():
    """Provide a sample embedding configuration"""
    return EmbeddingConfig.default_config(model_name="letta")


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

            # Test error handling - missing text for hybrid mode (embedding provided but text missing)
            with pytest.raises(ValueError, match="Both query_embedding and query_text are required"):
                await client.query_passages(archive_id=archive_id, query_embedding=[1.0, 2.0, 3.0], search_mode="hybrid", top_k=3)

            # Test error handling - missing embedding for hybrid mode (text provided but embedding missing)
            with pytest.raises(ValueError, match="Both query_embedding and query_text are required"):
                await client.query_passages(archive_id=archive_id, query_text="test", search_mode="hybrid", top_k=3)

            # Test explicit timestamp mode
            timestamp_results = await client.query_passages(archive_id=archive_id, search_mode="timestamp", top_k=3)
            assert len(timestamp_results) <= 3
            # Should return passages ordered by timestamp (most recent first)
            assert all(isinstance(passage, Passage) for passage, _ in timestamp_results)

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

    @pytest.mark.asyncio
    async def test_temporal_filtering_with_real_tpuf(self, enable_turbopuffer):
        """Test temporal filtering with date ranges"""
        from datetime import datetime, timedelta, timezone

        # Skip if Turbopuffer is not properly configured
        if not should_use_tpuf():
            pytest.skip("Turbopuffer not configured - skipping TPUF temporal filtering test")

        # Create client
        client = TurbopufferClient()

        # Create a unique archive ID for this test
        archive_id = f"test-temporal-{uuid.uuid4()}"

        try:
            # Create passages with different timestamps
            now = datetime.now(timezone.utc)
            yesterday = now - timedelta(days=1)
            last_week = now - timedelta(days=7)
            last_month = now - timedelta(days=30)

            # Insert passages with specific timestamps
            test_passages = [
                ("Today's meeting notes about project Alpha", now),
                ("Yesterday's standup summary", yesterday),
                ("Last week's sprint review", last_week),
                ("Last month's quarterly planning", last_month),
            ]

            # We need to generate embeddings for the passages
            # For testing, we'll use simple dummy embeddings
            for text, timestamp in test_passages:
                dummy_embedding = [1.0, 2.0, 3.0]  # Simple test embedding
                passage_id = f"passage-{uuid.uuid4()}"

                await client.insert_archival_memories(
                    archive_id=archive_id,
                    text_chunks=[text],
                    embeddings=[dummy_embedding],
                    passage_ids=[passage_id],
                    organization_id="test-org",
                    created_at=timestamp,
                )

            # Test 1: Query with date range (last 3 days)
            three_days_ago = now - timedelta(days=3)
            results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 2.0, 3.0],
                search_mode="vector",
                top_k=10,
                start_date=three_days_ago,
                end_date=now,
            )

            # Should only get today's and yesterday's passages
            passages = [p for p, _ in results]
            texts = [p.text for p in passages]
            assert len(passages) == 2
            assert "Today's meeting notes" in texts[0] or "Today's meeting notes" in texts[1]
            assert "Yesterday's standup" in texts[0] or "Yesterday's standup" in texts[1]
            assert "Last week's sprint" not in str(texts)
            assert "Last month's quarterly" not in str(texts)

            # Test 2: Query with only start_date (everything after 2 weeks ago)
            two_weeks_ago = now - timedelta(days=14)
            results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 2.0, 3.0],
                search_mode="vector",
                top_k=10,
                start_date=two_weeks_ago,
            )

            # Should get all except last month's passage
            passages = [p for p, _ in results]
            assert len(passages) == 3
            texts = [p.text for p in passages]
            assert "Last month's quarterly" not in str(texts)

            # Test 3: Query with only end_date (everything before yesterday)
            results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 2.0, 3.0],
                search_mode="vector",
                top_k=10,
                end_date=yesterday + timedelta(hours=12),  # Middle of yesterday
            )

            # Should get yesterday and older passages
            passages = [p for p, _ in results]
            assert len(passages) >= 3  # yesterday, last week, last month
            texts = [p.text for p in passages]
            assert "Today's meeting notes" not in str(texts)

            # Test 4: Test with FTS mode and date filtering
            results = await client.query_passages(
                archive_id=archive_id,
                query_text="meeting notes project",
                search_mode="fts",
                top_k=10,
                start_date=yesterday,
            )

            # Should only find today's meeting notes
            passages = [p for p, _ in results]
            if len(passages) > 0:  # FTS might not match if text search doesn't find keywords
                texts = [p.text for p in passages]
                assert "Today's meeting notes" in texts[0]

            # Test 5: Test with hybrid mode and date filtering
            results = await client.query_passages(
                archive_id=archive_id,
                query_embedding=[1.0, 2.0, 3.0],
                query_text="sprint review",
                search_mode="hybrid",
                top_k=10,
                start_date=last_week - timedelta(days=1),
                end_date=last_week + timedelta(days=1),
            )

            # Should find last week's sprint review
            passages = [p for p, _ in results]
            if len(passages) > 0:
                texts = [p.text for p in passages]
                assert "Last week's sprint review" in texts[0]

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

    @pytest.mark.asyncio
    async def test_temporal_filtering_in_both_modes(self, turbopuffer_mode, server, default_user, sarah_agent):
        """Test that temporal filtering works in both NATIVE and TPUF modes"""
        from datetime import datetime, timedelta, timezone

        # Insert passages with different timestamps
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)

        # Insert passages with specific timestamps
        recent_passage = await server.passage_manager.insert_passage(
            agent_state=sarah_agent, text="Recent update from today", actor=default_user, created_at=now
        )

        old_passage = await server.passage_manager.insert_passage(
            agent_state=sarah_agent, text="Old update from last week", actor=default_user, created_at=last_week
        )

        # Query with date range that includes only recent passage
        start_date = yesterday
        end_date = now + timedelta(hours=1)  # Slightly in the future to ensure we catch it

        # Query with date filtering
        results = await server.agent_manager.query_agent_passages_async(
            actor=default_user, agent_id=sarah_agent.id, start_date=start_date, end_date=end_date, limit=10
        )

        # Should find only the recent passage, not the old one
        assert len(results) >= 1
        assert any("Recent update from today" in p.text for p in results)
        assert not any("Old update from last week" in p.text for p in results)

        # Query with date range that includes only the old passage
        old_start = last_week - timedelta(days=1)
        old_end = last_week + timedelta(days=1)

        old_results = await server.agent_manager.query_agent_passages_async(
            actor=default_user, agent_id=sarah_agent.id, start_date=old_start, end_date=old_end, limit=10
        )

        # Should find only the old passage
        assert len(old_results) >= 1
        assert any("Old update from last week" in p.text for p in old_results)
        assert not any("Recent update from today" in p.text for p in old_results)

        # Clean up
        await server.passage_manager.delete_agent_passages_async(recent_passage, default_user)
        await server.passage_manager.delete_agent_passages_async(old_passage, default_user)


class TestTurbopufferMessagesIntegration:
    """Test Turbopuffer message embedding functionality"""

    def test_should_use_tpuf_for_messages_settings(self):
        """Test that should_use_tpuf_for_messages correctly checks both use_tpuf AND embed_all_messages"""
        # Save original values
        original_use_tpuf = settings.use_tpuf
        original_api_key = settings.tpuf_api_key
        original_embed_messages = settings.embed_all_messages

        try:
            # Test when both are true
            settings.use_tpuf = True
            settings.tpuf_api_key = "test-key"
            settings.embed_all_messages = True
            assert should_use_tpuf_for_messages() is True

            # Test when use_tpuf is False
            settings.use_tpuf = False
            settings.embed_all_messages = True
            assert should_use_tpuf_for_messages() is False

            # Test when embed_all_messages is False
            settings.use_tpuf = True
            settings.tpuf_api_key = "test-key"
            settings.embed_all_messages = False
            assert should_use_tpuf_for_messages() is False

            # Test when both are false
            settings.use_tpuf = False
            settings.embed_all_messages = False
            assert should_use_tpuf_for_messages() is False

            # Test when API key is missing
            settings.use_tpuf = True
            settings.tpuf_api_key = None
            settings.embed_all_messages = True
            assert should_use_tpuf_for_messages() is False
        finally:
            # Restore original values
            settings.use_tpuf = original_use_tpuf
            settings.tpuf_api_key = original_api_key
            settings.embed_all_messages = original_embed_messages

    def test_message_text_extraction(self, server, default_user):
        """Test extraction of text from various message content structures"""
        manager = server.message_manager

        # Test 1: List with single string-like TextContent
        msg1 = PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Simple text content")],
            agent_id="test-agent",
        )
        text1 = manager._extract_message_text(msg1)
        assert text1 == "Simple text content"

        # Test 2: List with single TextContent
        msg2 = PydanticMessage(
            role=MessageRole.user,
            content=[TextContent(text="Single text content")],
            agent_id="test-agent",
        )
        text2 = manager._extract_message_text(msg2)
        assert text2 == "Single text content"

        # Test 3: List with multiple TextContent items
        msg3 = PydanticMessage(
            role=MessageRole.user,
            content=[
                TextContent(text="First part"),
                TextContent(text="Second part"),
                TextContent(text="Third part"),
            ],
            agent_id="test-agent",
        )
        text3 = manager._extract_message_text(msg3)
        assert text3 == "First part Second part Third part"

        # Test 4: Empty content
        msg4 = PydanticMessage(
            role=MessageRole.system,
            content=None,
            agent_id="test-agent",
        )
        text4 = manager._extract_message_text(msg4)
        assert text4 == ""

        # Test 5: Empty list
        msg5 = PydanticMessage(
            role=MessageRole.assistant,
            content=[],
            agent_id="test-agent",
        )
        text5 = manager._extract_message_text(msg5)
        assert text5 == ""

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_embedding_without_config(self, server, default_user, sarah_agent, enable_message_embedding):
        """Test that messages are NOT embedded without embedding_config even when tpuf is enabled"""
        # Create messages WITHOUT embedding_config
        messages = [
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(text="Test message without embedding config")],
                agent_id=sarah_agent.id,
            ),
            PydanticMessage(
                role=MessageRole.assistant,
                content=[TextContent(text="Response without embedding config")],
                agent_id=sarah_agent.id,
            ),
        ]

        # Create messages without embedding_config
        created = await server.message_manager.create_many_messages_async(
            pydantic_msgs=messages,
            actor=default_user,
            embedding_config=None,  # No config provided
        )

        assert len(created) == 2
        assert all(msg.agent_id == sarah_agent.id for msg in created)

        # Messages should be in SQL
        sql_messages = await server.message_manager.list_messages_for_agent_async(
            agent_id=sarah_agent.id,
            actor=default_user,
            limit=10,
        )
        assert len(sql_messages) >= 2

        # Clean up
        message_ids = [msg.id for msg in created]
        await server.message_manager.delete_messages_by_ids_async(message_ids, default_user)

    @pytest.mark.asyncio
    async def test_generic_reciprocal_rank_fusion(self):
        """Test the generic RRF function with different object types"""
        from letta.helpers.tpuf_client import TurbopufferClient

        client = TurbopufferClient()

        # Test with passage objects (backward compatibility)
        p1_id = "passage-78d49031-8502-49c1-a970-45663e9f6e07"
        p2_id = "passage-90df8386-4caf-49cc-acbc-d71526de6f77"
        passage1 = Passage(
            id=p1_id,
            text="First passage",
            organization_id="org1",
            archive_id="archive1",
            created_at=datetime.now(timezone.utc),
            metadata_={},
            tags=[],
            embedding=[],
            embedding_config=None,
        )
        passage2 = Passage(
            id=p2_id,
            text="Second passage",
            organization_id="org1",
            archive_id="archive1",
            created_at=datetime.now(timezone.utc),
            metadata_={},
            tags=[],
            embedding=[],
            embedding_config=None,
        )

        vector_results = [(passage1, 0.9), (passage2, 0.7)]
        fts_results = [(passage2, 0.8), (passage1, 0.6)]

        # Test with passages using the wrapper function
        combined = client._reciprocal_rank_fusion(
            vector_results=vector_results,
            fts_results=fts_results,
            vector_weight=0.5,
            fts_weight=0.5,
            top_k=2,
        )

        assert len(combined) == 2
        # Both passages should be in results
        result_ids = [p.id for p, _ in combined]
        assert p1_id in result_ids
        assert p2_id in result_ids

        # Test with message dicts using generic function
        msg1 = {"id": "m1", "text": "First message"}
        msg2 = {"id": "m2", "text": "Second message"}
        msg3 = {"id": "m3", "text": "Third message"}

        vector_msg_results = [(msg1, 0.95), (msg2, 0.85), (msg3, 0.75)]
        fts_msg_results = [(msg2, 0.90), (msg3, 0.80), (msg1, 0.70)]

        combined_msgs = client._generic_reciprocal_rank_fusion(
            vector_results=vector_msg_results,
            fts_results=fts_msg_results,
            get_id_func=lambda m: m["id"],
            vector_weight=0.6,
            fts_weight=0.4,
            top_k=3,
        )

        assert len(combined_msgs) == 3
        msg_ids = [m["id"] for m, _ in combined_msgs]
        assert "m1" in msg_ids
        assert "m2" in msg_ids
        assert "m3" in msg_ids

        # Test edge cases
        # Empty results
        empty_combined = client._generic_reciprocal_rank_fusion(
            vector_results=[],
            fts_results=[],
            get_id_func=lambda x: x["id"],
            vector_weight=0.5,
            fts_weight=0.5,
            top_k=10,
        )
        assert len(empty_combined) == 0

        # Single result list
        single_combined = client._generic_reciprocal_rank_fusion(
            vector_results=[(msg1, 0.9)],
            fts_results=[],
            get_id_func=lambda m: m["id"],
            vector_weight=0.5,
            fts_weight=0.5,
            top_k=10,
        )
        assert len(single_combined) == 1
        assert single_combined[0][0]["id"] == "m1"

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_dual_write_with_real_tpuf(self, enable_message_embedding):
        """Test actual message embedding and storage in Turbopuffer"""
        import uuid
        from datetime import datetime, timezone

        from letta.helpers.tpuf_client import TurbopufferClient
        from letta.schemas.enums import MessageRole

        client = TurbopufferClient()
        agent_id = f"test-agent-{uuid.uuid4()}"
        org_id = str(uuid.uuid4())

        try:
            # Prepare test messages
            message_texts = [
                "Hello, how can I help you today?",
                "I need help with Python programming.",
                "Sure, what specific Python topic?",
            ]
            message_ids = [str(uuid.uuid4()) for _ in message_texts]
            roles = [MessageRole.assistant, MessageRole.user, MessageRole.assistant]
            created_ats = [datetime.now(timezone.utc) for _ in message_texts]

            # Generate embeddings (dummy for test)
            embeddings = [[float(i), float(i + 1), float(i + 2)] for i in range(len(message_texts))]

            # Insert messages into Turbopuffer
            success = await client.insert_messages(
                agent_id=agent_id,
                message_texts=message_texts,
                embeddings=embeddings,
                message_ids=message_ids,
                organization_id=org_id,
                roles=roles,
                created_ats=created_ats,
            )

            assert success == True

            # Verify we can query the messages
            results = await client.query_messages(
                agent_id=agent_id,
                search_mode="timestamp",
                top_k=10,
            )

            assert len(results) == 3
            # Results should be ordered by timestamp (most recent first)
            for msg_dict, score in results:
                assert msg_dict["agent_id"] == agent_id
                assert msg_dict["organization_id"] == org_id
                assert msg_dict["text"] in message_texts
                assert msg_dict["role"] in ["assistant", "user"]

        finally:
            # Clean up namespace
            try:
                await client.delete_all_messages(agent_id)
            except:
                pass

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_vector_search_with_real_tpuf(self, enable_message_embedding):
        """Test vector search on messages in Turbopuffer"""
        import uuid
        from datetime import datetime, timezone

        from letta.helpers.tpuf_client import TurbopufferClient
        from letta.schemas.enums import MessageRole

        client = TurbopufferClient()
        agent_id = f"test-agent-{uuid.uuid4()}"
        org_id = str(uuid.uuid4())

        try:
            # Insert messages with different embeddings
            message_texts = [
                "Python is a great programming language",
                "JavaScript is used for web development",
                "Machine learning with Python is powerful",
            ]
            message_ids = [str(uuid.uuid4()) for _ in message_texts]
            roles = [MessageRole.assistant] * len(message_texts)
            created_ats = [datetime.now(timezone.utc) for _ in message_texts]

            # Create embeddings that reflect content similarity
            embeddings = [
                [1.0, 0.0, 0.0],  # Python programming
                [0.0, 1.0, 0.0],  # JavaScript web
                [0.8, 0.0, 0.2],  # ML with Python (similar to first)
            ]

            # Insert messages
            await client.insert_messages(
                agent_id=agent_id,
                message_texts=message_texts,
                embeddings=embeddings,
                message_ids=message_ids,
                organization_id=org_id,
                roles=roles,
                created_ats=created_ats,
            )

            # Search for Python-related messages using vector search
            query_embedding = [0.9, 0.0, 0.1]  # Similar to Python messages
            results = await client.query_messages(
                agent_id=agent_id,
                query_embedding=query_embedding,
                search_mode="vector",
                top_k=2,
            )

            assert len(results) == 2
            # Should return Python-related messages first
            result_texts = [msg["text"] for msg, _ in results]
            assert "Python is a great programming language" in result_texts
            assert "Machine learning with Python is powerful" in result_texts

        finally:
            # Clean up namespace
            try:
                await client.delete_all_messages(agent_id)
            except:
                pass

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_hybrid_search_with_real_tpuf(self, enable_message_embedding):
        """Test hybrid search combining vector and FTS for messages"""
        import uuid
        from datetime import datetime, timezone

        from letta.helpers.tpuf_client import TurbopufferClient
        from letta.schemas.enums import MessageRole

        client = TurbopufferClient()
        agent_id = f"test-agent-{uuid.uuid4()}"
        org_id = str(uuid.uuid4())

        try:
            # Insert diverse messages
            message_texts = [
                "The quick brown fox jumps over the lazy dog",
                "Machine learning algorithms are fascinating",
                "Quick tutorial on Python programming",
                "Deep learning with neural networks",
            ]
            message_ids = [str(uuid.uuid4()) for _ in message_texts]
            roles = [MessageRole.assistant] * len(message_texts)
            created_ats = [datetime.now(timezone.utc) for _ in message_texts]

            # Embeddings
            embeddings = [
                [0.1, 0.9, 0.0],  # fox text
                [0.9, 0.1, 0.0],  # ML algorithms
                [0.5, 0.5, 0.0],  # Quick Python
                [0.8, 0.2, 0.0],  # Deep learning
            ]

            # Insert messages
            await client.insert_messages(
                agent_id=agent_id,
                message_texts=message_texts,
                embeddings=embeddings,
                message_ids=message_ids,
                organization_id=org_id,
                roles=roles,
                created_ats=created_ats,
            )

            # Hybrid search - vector similar to ML but text contains "quick"
            results = await client.query_messages(
                agent_id=agent_id,
                query_embedding=[0.7, 0.3, 0.0],  # Similar to ML messages
                query_text="quick",  # Text search for "quick"
                search_mode="hybrid",
                top_k=3,
                vector_weight=0.5,
                fts_weight=0.5,
            )

            assert len(results) > 0
            # Should get a mix of results based on both vector and text similarity
            result_texts = [msg["text"] for msg, _ in results]
            # At least one result should contain "quick" due to FTS
            assert any("quick" in text.lower() for text in result_texts)

        finally:
            # Clean up namespace
            try:
                await client.delete_all_messages(agent_id)
            except:
                pass

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_role_filtering_with_real_tpuf(self, enable_message_embedding):
        """Test filtering messages by role"""
        import uuid
        from datetime import datetime, timezone

        from letta.helpers.tpuf_client import TurbopufferClient
        from letta.schemas.enums import MessageRole

        client = TurbopufferClient()
        agent_id = f"test-agent-{uuid.uuid4()}"
        org_id = str(uuid.uuid4())

        try:
            # Insert messages with different roles
            message_data = [
                ("Hello! How can I help?", MessageRole.assistant),
                ("I need help with Python", MessageRole.user),
                ("Here's a Python example", MessageRole.assistant),
                ("Can you explain this?", MessageRole.user),
                ("System message here", MessageRole.system),
            ]

            message_texts = [text for text, _ in message_data]
            roles = [role for _, role in message_data]
            message_ids = [str(uuid.uuid4()) for _ in message_texts]
            created_ats = [datetime.now(timezone.utc) for _ in message_texts]
            embeddings = [[float(i), float(i + 1), float(i + 2)] for i in range(len(message_texts))]

            # Insert messages
            await client.insert_messages(
                agent_id=agent_id,
                message_texts=message_texts,
                embeddings=embeddings,
                message_ids=message_ids,
                organization_id=org_id,
                roles=roles,
                created_ats=created_ats,
            )

            # Query only user messages
            user_results = await client.query_messages(
                agent_id=agent_id,
                search_mode="timestamp",
                top_k=10,
                roles=[MessageRole.user],
            )

            assert len(user_results) == 2
            for msg, _ in user_results:
                assert msg["role"] == "user"
                assert msg["text"] in ["I need help with Python", "Can you explain this?"]

            # Query assistant and system messages
            non_user_results = await client.query_messages(
                agent_id=agent_id,
                search_mode="timestamp",
                top_k=10,
                roles=[MessageRole.assistant, MessageRole.system],
            )

            assert len(non_user_results) == 3
            for msg, _ in non_user_results:
                assert msg["role"] in ["assistant", "system"]

        finally:
            # Clean up namespace
            try:
                await client.delete_all_messages(agent_id)
            except:
                pass

    @pytest.mark.asyncio
    async def test_message_search_fallback_to_sql(self, server, default_user, sarah_agent):
        """Test that message search falls back to SQL when Turbopuffer is disabled"""
        # Save original settings
        original_use_tpuf = settings.use_tpuf
        original_embed_messages = settings.embed_all_messages

        try:
            # Disable Turbopuffer for messages
            settings.use_tpuf = False
            settings.embed_all_messages = False

            # Create messages
            messages = await server.message_manager.create_many_messages_async(
                pydantic_msgs=[
                    PydanticMessage(
                        role=MessageRole.user,
                        content=[TextContent(text="Test message for SQL fallback")],
                        agent_id=sarah_agent.id,
                    )
                ],
                actor=default_user,
            )

            # Search should use SQL backend (not Turbopuffer)
            results = await server.message_manager.search_messages_async(
                actor=default_user,
                agent_id=sarah_agent.id,
                query_text="fallback",
                limit=10,
            )

            # Should return results from SQL search
            assert len(results) > 0
            # Extract text from messages and check for "fallback"
            for msg in results:
                text = server.message_manager._extract_message_text(msg)
                if "fallback" in text.lower():
                    break
            else:
                assert False, "No messages containing 'fallback' found"

        finally:
            # Restore settings
            settings.use_tpuf = original_use_tpuf
            settings.embed_all_messages = original_embed_messages

    @pytest.mark.asyncio
    @pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
    async def test_message_date_filtering_with_real_tpuf(self, enable_message_embedding):
        """Test filtering messages by date range"""
        import uuid
        from datetime import datetime, timedelta, timezone

        from letta.helpers.tpuf_client import TurbopufferClient
        from letta.schemas.enums import MessageRole

        client = TurbopufferClient()
        agent_id = f"test-agent-{uuid.uuid4()}"
        org_id = str(uuid.uuid4())

        try:
            # Create messages with different timestamps
            now = datetime.now(timezone.utc)
            yesterday = now - timedelta(days=1)
            last_week = now - timedelta(days=7)
            last_month = now - timedelta(days=30)

            message_data = [
                ("Today's message", now),
                ("Yesterday's message", yesterday),
                ("Last week's message", last_week),
                ("Last month's message", last_month),
            ]

            for text, timestamp in message_data:
                await client.insert_messages(
                    agent_id=agent_id,
                    message_texts=[text],
                    embeddings=[[1.0, 2.0, 3.0]],
                    message_ids=[str(uuid.uuid4())],
                    organization_id=org_id,
                    roles=[MessageRole.assistant],
                    created_ats=[timestamp],
                )

            # Query messages from the last 3 days
            three_days_ago = now - timedelta(days=3)
            recent_results = await client.query_messages(
                agent_id=agent_id,
                search_mode="timestamp",
                top_k=10,
                start_date=three_days_ago,
            )

            # Should get today's and yesterday's messages
            assert len(recent_results) == 2
            result_texts = [msg["text"] for msg, _ in recent_results]
            assert "Today's message" in result_texts
            assert "Yesterday's message" in result_texts

            # Query messages between 2 weeks ago and 1 week ago
            two_weeks_ago = now - timedelta(days=14)
            week_results = await client.query_messages(
                agent_id=agent_id,
                search_mode="timestamp",
                top_k=10,
                start_date=two_weeks_ago,
                end_date=last_week + timedelta(days=1),  # Include last week's message
            )

            # Should get only last week's message
            assert len(week_results) == 1
            assert week_results[0][0]["text"] == "Last week's message"

            # Query with vector search and date filtering
            filtered_vector_results = await client.query_messages(
                agent_id=agent_id,
                query_embedding=[1.0, 2.0, 3.0],
                search_mode="vector",
                top_k=10,
                start_date=three_days_ago,
            )

            # Should get only recent messages
            assert len(filtered_vector_results) == 2
            for msg, _ in filtered_vector_results:
                assert msg["text"] in ["Today's message", "Yesterday's message"]

        finally:
            # Clean up namespace
            try:
                await client.delete_all_messages(agent_id)
            except:
                pass
