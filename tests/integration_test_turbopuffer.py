import asyncio
import uuid
from datetime import datetime, timezone

import pytest

from letta.config import LettaConfig
from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf, should_use_tpuf_for_messages
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole, TagMatchMode, VectorDBProvider
from letta.schemas.letta_message_content import ReasoningContent, TextContent, ToolCallContent, ToolReturnContent
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


async def wait_for_embedding(
    agent_id: str, message_id: str, organization_id: str, actor, max_wait: float = 10.0, poll_interval: float = 0.5
) -> bool:
    """Poll Turbopuffer directly to check if a message has been embedded.

    Args:
        agent_id: Agent ID for the message
        message_id: ID of the message to find
        organization_id: Organization ID
        max_wait: Maximum time to wait in seconds
        poll_interval: Time between polls in seconds

    Returns:
        True if message was found in Turbopuffer within timeout, False otherwise
    """
    import asyncio

    from letta.helpers.tpuf_client import TurbopufferClient

    client = TurbopufferClient()
    start_time = asyncio.get_event_loop().time()

    while asyncio.get_event_loop().time() - start_time < max_wait:
        try:
            # Query Turbopuffer directly using timestamp mode to get all messages
            results = await client.query_messages_by_agent_id(
                agent_id=agent_id,
                organization_id=organization_id,
                actor=actor,
                search_mode="timestamp",
                top_k=100,  # Get more messages to ensure we find it
            )

            # Check if our message ID is in the results
            if any(msg["id"] == message_id for msg, _, _ in results):
                return True

        except Exception as e:
            # Log but don't fail - Turbopuffer might still be processing
            pass

        await asyncio.sleep(poll_interval)

    return False


def test_should_use_tpuf_with_settings():
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
async def test_archive_creation_with_tpuf_enabled(server, default_user, enable_turbopuffer):
    """Test that archives are created with correct vector_db_provider when TPUF is enabled"""
    archive = await server.archive_manager.create_archive_async(
        name="Test Archive with TPUF", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )
    assert archive.vector_db_provider == VectorDBProvider.TPUF
    # TODO: Add cleanup when delete_archive method is available


@pytest.mark.asyncio
async def test_archive_creation_with_tpuf_disabled(server, default_user, disable_turbopuffer):
    """Test that archives default to NATIVE when TPUF is disabled"""
    archive = await server.archive_manager.create_archive_async(
        name="Test Archive without TPUF", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )
    assert archive.vector_db_provider == VectorDBProvider.NATIVE
    # TODO: Add cleanup when delete_archive method is available


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured for testing")
async def test_dual_write_and_query_with_real_tpuf(server, default_user, sarah_agent, enable_turbopuffer):
    """Test that passages are written to both SQL and Turbopuffer with real connection and can be queried"""

    # Create a TPUF-enabled archive
    archive = await server.archive_manager.create_archive_async(
        name="Test TPUF Archive for Real Dual Write", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )
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
            passages = await server.passage_manager.insert_passage(agent_state=sarah_agent, text=text, actor=default_user, strict_mode=True)
            assert passages is not None
            assert len(passages) > 0

        # Verify passages are in SQL - use agent_manager to list passages
        sql_passages = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
        assert len(sql_passages) >= len(test_passages)
        for text in test_passages:
            assert any(p.text == text for p, _, _ in sql_passages)

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
        assert any("Turbopuffer" in p.text or "vector" in p.text for p, _, _ in vector_results)

        # Test deletion - should delete from both
        passage_to_delete = sql_passages[0][0]  # Extract passage from tuple
        await server.passage_manager.delete_agent_passages_async([passage_to_delete], default_user, strict_mode=True)

        # Verify deleted from SQL
        remaining = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
        assert not any(p.id == passage_to_delete.id for p, _, _ in remaining)

        # Verify vector search no longer returns deleted passage
        vector_results_after_delete = await server.agent_manager.query_agent_passages_async(
            actor=default_user,
            agent_id=sarah_agent.id,
            query_text=passage_to_delete.text,
            embedding_config=embedding_config,
            embed_query=True,
            limit=10,
        )
        assert not any(p.id == passage_to_delete.id for p, _, _ in vector_results_after_delete)

    finally:
        # TODO: Clean up archive when delete_archive method is available
        pass


@pytest.mark.asyncio
async def test_turbopuffer_metadata_attributes(default_user, enable_turbopuffer):
    """Test that Turbopuffer properly stores and retrieves metadata attributes"""

    # Only run if we have a real API key
    if not settings.tpuf_api_key:
        pytest.skip("No Turbopuffer API key available")

    client = TurbopufferClient()
    archive_id = f"archive-{uuid.uuid4()}"

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
            passage_ids=[d["id"] for d in test_data],
            organization_id="org-123",  # Default org
            actor=default_user,
            created_at=datetime.now(timezone.utc),
        )

        assert len(result) == 3

        # Query all passages (no tag filtering)
        results = await client.query_passages(archive_id=archive_id, actor=default_user, top_k=10)

        # Should get all passages
        assert len(results) == 3  # All three passages
        for passage, score, metadata in results:
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
async def test_native_only_operations(server, default_user, sarah_agent, disable_turbopuffer):
    """Test that operations work correctly when using only native PostgreSQL"""

    # Create archive (should be NATIVE since turbopuffer is disabled)
    archive = await server.archive_manager.get_or_create_default_archive_for_agent_async(agent_state=sarah_agent, actor=default_user)
    assert archive.vector_db_provider == VectorDBProvider.NATIVE

    # Insert passages - should only write to SQL
    text_content = "This is a test passage for native PostgreSQL only."
    passages = await server.passage_manager.insert_passage(agent_state=sarah_agent, text=text_content, actor=default_user, strict_mode=True)

    assert passages is not None
    assert len(passages) > 0

    # List passages - should work from SQL
    sql_passages = await server.agent_manager.query_agent_passages_async(actor=default_user, agent_id=sarah_agent.id, limit=10)
    assert any(p.text == text_content for p, _, _ in sql_passages)

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
async def test_hybrid_search_with_real_tpuf(default_user, enable_turbopuffer):
    """Test hybrid search functionality combining vector and full-text search"""

    import uuid

    from letta.helpers.tpuf_client import TurbopufferClient

    client = TurbopufferClient()
    archive_id = f"archive-{uuid.uuid4()}"
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
            archive_id=archive_id, text_chunks=texts, passage_ids=passage_ids, organization_id=org_id, actor=default_user
        )

        # Test vector-only search
        vector_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="python programming tutorial",
            search_mode="vector",
            top_k=3,
        )
        assert 0 < len(vector_results) <= 3
        # all results should have scores
        assert all(isinstance(score, float) for _, score, _ in vector_results)

        # Test FTS-only search
        fts_results = await client.query_passages(
            archive_id=archive_id, actor=default_user, query_text="Turbopuffer vector database", search_mode="fts", top_k=3
        )
        assert 0 < len(fts_results) <= 3
        # should find passages mentioning Turbopuffer
        assert any("Turbopuffer" in passage.text for passage, _, _ in fts_results)
        # all results should have scores
        assert all(isinstance(score, float) for _, score, _ in fts_results)

        # Test hybrid search
        hybrid_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="vector search Turbopuffer",
            search_mode="hybrid",
            top_k=3,
            vector_weight=0.5,
            fts_weight=0.5,
        )
        assert 0 < len(hybrid_results) <= 3
        # hybrid should combine both vector and text relevance
        assert any("Turbopuffer" in passage.text or "vector" in passage.text for passage, _, _ in hybrid_results)
        # all results should have scores
        assert all(isinstance(score, float) for _, score, _ in hybrid_results)
        # results should be sorted by score (highest first)
        scores = [score for _, score, _ in hybrid_results]
        assert scores == sorted(scores, reverse=True)

        # Test with different weights
        vector_heavy_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="quick brown fox",  # matches second passage
            search_mode="hybrid",
            top_k=3,
            vector_weight=0.8,  # emphasize vector search
            fts_weight=0.2,
        )
        assert 0 < len(vector_heavy_results) <= 3
        # all results should have scores
        assert all(isinstance(score, float) for _, score, _ in vector_heavy_results)

        # Test with different search modes
        await client.query_passages(archive_id=archive_id, actor=default_user, query_text="test", search_mode="vector", top_k=3)
        await client.query_passages(archive_id=archive_id, actor=default_user, query_text="test", search_mode="fts", top_k=3)
        await client.query_passages(archive_id=archive_id, actor=default_user, query_text="test", search_mode="hybrid", top_k=3)

        # Test explicit timestamp mode
        timestamp_results = await client.query_passages(archive_id=archive_id, actor=default_user, search_mode="timestamp", top_k=3)
        assert len(timestamp_results) <= 3
        # Should return passages ordered by timestamp (most recent first)
        assert all(isinstance(passage, Passage) for passage, _, _ in timestamp_results)

    finally:
        # Clean up
        try:
            await client.delete_all_passages(archive_id)
        except:
            pass


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured for testing")
async def test_tag_filtering_with_real_tpuf(default_user, enable_turbopuffer):
    """Test tag filtering functionality with AND and OR logic"""

    import uuid

    from letta.helpers.tpuf_client import TurbopufferClient

    client = TurbopufferClient()
    archive_id = f"archive-{uuid.uuid4()}"
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
        for i, (text, tags, passage_id) in enumerate(zip(texts, tag_sets, passage_ids)):
            await client.insert_archival_memories(
                archive_id=archive_id,
                text_chunks=[text],
                passage_ids=[passage_id],
                organization_id=org_id,
                actor=default_user,
                tags=tags,
                created_at=datetime.now(timezone.utc),
            )

        # Test tag filtering with "any" mode (should find passages with any of the specified tags)
        python_any_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="python programming",
            search_mode="vector",
            top_k=10,
            tags=["python"],
            tag_match_mode=TagMatchMode.ANY,
        )

        # Should find 3 passages with python tag
        python_passages = [passage for passage, _, _ in python_any_results]
        python_texts = [p.text for p in python_passages]
        assert len(python_passages) == 3
        assert "Python programming tutorial" in python_texts
        assert "Machine learning with Python" in python_texts
        assert "Python data science tutorial" in python_texts

        # Test tag filtering with "all" mode
        python_tutorial_all_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="python tutorial",
            search_mode="vector",
            top_k=10,
            tags=["python", "tutorial"],
            tag_match_mode=TagMatchMode.ALL,
        )

        # Should find 2 passages that have both python AND tutorial tags
        tutorial_passages = [passage for passage, _, _ in python_tutorial_all_results]
        tutorial_texts = [p.text for p in tutorial_passages]
        assert len(tutorial_passages) == 2
        assert "Python programming tutorial" in tutorial_texts
        assert "Python data science tutorial" in tutorial_texts

        # Test tag filtering with FTS mode
        js_fts_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="javascript",
            search_mode="fts",
            top_k=10,
            tags=["javascript"],
            tag_match_mode=TagMatchMode.ANY,
        )

        # Should find 2 passages with javascript tag
        js_passages = [passage for passage, _, _ in js_fts_results]
        js_texts = [p.text for p in js_passages]
        assert len(js_passages) == 2
        assert "JavaScript web development" in js_texts
        assert "React JavaScript framework" in js_texts

        # Test hybrid search with tags
        python_hybrid_results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="python programming",
            search_mode="hybrid",
            top_k=10,
            tags=["python"],
            tag_match_mode=TagMatchMode.ANY,
            vector_weight=0.6,
            fts_weight=0.4,
        )

        # Should find python-tagged passages
        hybrid_passages = [passage for passage, _, _ in python_hybrid_results]
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
async def test_temporal_filtering_with_real_tpuf(default_user, enable_turbopuffer):
    """Test temporal filtering with date ranges"""
    from datetime import datetime, timedelta, timezone

    # Skip if Turbopuffer is not properly configured
    if not should_use_tpuf():
        pytest.skip("Turbopuffer not configured - skipping TPUF temporal filtering test")

    # Create client
    client = TurbopufferClient()

    # Create a unique archive ID for this test
    archive_id = f"archive-{uuid.uuid4()}"

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
            passage_id = f"passage-{uuid.uuid4()}"

            await client.insert_archival_memories(
                archive_id=archive_id,
                text_chunks=[text],
                passage_ids=[passage_id],
                organization_id="test-org",
                actor=default_user,
                created_at=timestamp,
            )

        # Test 1: Query with date range (last 3 days)
        three_days_ago = now - timedelta(days=3)
        results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="meeting notes",
            search_mode="vector",
            top_k=10,
            start_date=three_days_ago,
            end_date=now,
        )

        # Should only get today's and yesterday's passages
        passages = [p for p, _, _ in results]
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
            actor=default_user,
            query_text="meeting notes",
            search_mode="vector",
            top_k=10,
            start_date=two_weeks_ago,
        )

        # Should get all except last month's passage
        passages = [p for p, _, _ in results]
        assert len(passages) == 3
        texts = [p.text for p in passages]
        assert "Last month's quarterly" not in str(texts)

        # Test 3: Query with only end_date (everything before yesterday)
        results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="meeting notes",
            search_mode="vector",
            top_k=10,
            end_date=yesterday + timedelta(hours=12),  # Middle of yesterday
        )

        # Should get yesterday and older passages
        passages = [p for p, _, _ in results]
        assert len(passages) >= 3  # yesterday, last week, last month
        texts = [p.text for p in passages]
        assert "Today's meeting notes" not in str(texts)

        # Test 4: Test with FTS mode and date filtering
        results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="meeting notes project",
            search_mode="fts",
            top_k=10,
            start_date=yesterday,
        )

        # Should only find today's meeting notes
        passages = [p for p, _, _ in results]
        if len(passages) > 0:  # FTS might not match if text search doesn't find keywords
            texts = [p.text for p in passages]
            assert "Today's meeting notes" in texts[0]

        # Test 5: Test with hybrid mode and date filtering
        results = await client.query_passages(
            archive_id=archive_id,
            actor=default_user,
            query_text="sprint review",
            search_mode="hybrid",
            top_k=10,
            start_date=last_week - timedelta(days=1),
            end_date=last_week + timedelta(days=1),
        )

        # Should find last week's sprint review
        passages = [p for p, _, _ in results]
        if len(passages) > 0:
            texts = [p.text for p in passages]
            assert "Last week's sprint review" in texts[0]

    finally:
        # Clean up
        try:
            await client.delete_all_passages(archive_id)
        except:
            pass


def test_should_use_tpuf_for_messages_settings():
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


def test_message_text_extraction(server, default_user):
    """Test extraction of text from various message content structures"""
    manager = server.message_manager

    # Test 1: List with single string-like TextContent
    msg1 = PydanticMessage(
        role=MessageRole.user,
        content=[TextContent(text="Simple text content")],
        agent_id="test-agent",
    )
    text1 = manager._extract_message_text(msg1)
    assert text1 == '{"content": "Simple text content"}'

    # Test 2: List with single TextContent
    msg2 = PydanticMessage(
        role=MessageRole.user,
        content=[TextContent(text="Single text content")],
        agent_id="test-agent",
    )
    text2 = manager._extract_message_text(msg2)
    assert text2 == '{"content": "Single text content"}'

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
    assert text3 == '{"content": "First part Second part Third part"}'

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

    # Test 6: Mixed content types with to_text() methods
    msg6 = PydanticMessage(
        role=MessageRole.assistant,
        content=[
            TextContent(text="User said:"),
            ToolCallContent(id="call-123", name="search", input={"query": "test"}),
            ToolReturnContent(tool_call_id="call-123", content="Found 5 results", is_error=False),
            ReasoningContent(is_native=True, reasoning="I should help the user", signature="step-1"),
        ],
        agent_id="test-agent",
    )
    text6 = manager._extract_message_text(msg6)
    expected_parts = [
        "User said:",
        'Tool call: search({\n  "query": "test"\n})',
        "Tool result: Found 5 results",
        "I should help the user",
    ]
    assert (
        text6
        == '{"content": "User said: Tool call: search({\\n  \\"query\\": \\"test\\"\\n}) Tool result: Found 5 results I should help the user"}'
    )


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_embedding_without_config(server, default_user, sarah_agent, enable_message_embedding):
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

    created = await server.message_manager.create_many_messages_async(
        pydantic_msgs=messages,
        actor=default_user,
    )

    assert len(created) == 2
    assert all(msg.agent_id == sarah_agent.id for msg in created)

    # Messages should be in SQL
    sql_messages = await server.message_manager.list_messages(
        agent_id=sarah_agent.id,
        actor=default_user,
        limit=10,
    )
    assert len(sql_messages) >= 2

    # Clean up
    message_ids = [msg.id for msg in created]
    await server.message_manager.delete_messages_by_ids_async(message_ids, default_user)


@pytest.mark.asyncio
async def test_generic_reciprocal_rank_fusion():
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

    # Test with passages using the RRF function
    combined = client._reciprocal_rank_fusion(
        vector_results=[passage for passage, _ in vector_results],
        fts_results=[passage for passage, _ in fts_results],
        get_id_func=lambda p: p.id,
        vector_weight=0.5,
        fts_weight=0.5,
        top_k=2,
    )

    assert len(combined) == 2
    # Both passages should be in results - now returns (passage, score, metadata)
    result_ids = [p.id for p, _, _ in combined]
    assert p1_id in result_ids
    assert p2_id in result_ids

    # Test with message dicts using generic function
    msg1 = {"id": "m1", "text": "First message"}
    msg2 = {"id": "m2", "text": "Second message"}
    msg3 = {"id": "m3", "text": "Third message"}

    vector_msg_results = [(msg1, 0.95), (msg2, 0.85), (msg3, 0.75)]
    fts_msg_results = [(msg2, 0.90), (msg3, 0.80), (msg1, 0.70)]

    combined_msgs = client._reciprocal_rank_fusion(
        vector_results=[msg for msg, _ in vector_msg_results],
        fts_results=[msg for msg, _ in fts_msg_results],
        get_id_func=lambda m: m["id"],
        vector_weight=0.6,
        fts_weight=0.4,
        top_k=3,
    )

    assert len(combined_msgs) == 3
    msg_ids = [m["id"] for m, _, _ in combined_msgs]
    assert "m1" in msg_ids
    assert "m2" in msg_ids
    assert "m3" in msg_ids

    # Test edge cases
    # Empty results
    empty_combined = client._reciprocal_rank_fusion(
        vector_results=[],
        fts_results=[],
        get_id_func=lambda x: x["id"],
        vector_weight=0.5,
        fts_weight=0.5,
        top_k=10,
    )
    assert len(empty_combined) == 0

    # Single result list
    single_combined = client._reciprocal_rank_fusion(
        vector_results=[msg1],
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
async def test_message_dual_write_with_real_tpuf(enable_message_embedding, default_user):
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
            message_ids=message_ids,
            organization_id=org_id,
            actor=default_user,
            roles=roles,
            created_ats=created_ats,
        )

        assert success == True

        # Verify we can query the messages
        results = await client.query_messages_by_agent_id(
            agent_id=agent_id, organization_id=org_id, search_mode="timestamp", top_k=10, actor=default_user
        )

        assert len(results) == 3
        # Results should be ordered by timestamp (most recent first)
        for msg_dict, score, metadata in results:
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
async def test_message_vector_search_with_real_tpuf(enable_message_embedding, default_user):
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
        # Insert messages
        await client.insert_messages(
            agent_id=agent_id,
            message_texts=message_texts,
            message_ids=message_ids,
            organization_id=org_id,
            actor=default_user,
            roles=roles,
            created_ats=created_ats,
        )

        # Search for Python-related messages using vector search
        results = await client.query_messages_by_agent_id(
            agent_id=agent_id,
            organization_id=org_id,
            actor=default_user,
            query_text="Python programming",
            search_mode="vector",
            top_k=2,
        )

        assert len(results) == 2
        # Should return Python-related messages first
        result_texts = [msg["text"] for msg, _, _ in results]
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
async def test_message_hybrid_search_with_real_tpuf(enable_message_embedding, default_user):
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

        # Insert messages
        await client.insert_messages(
            agent_id=agent_id,
            message_texts=message_texts,
            message_ids=message_ids,
            organization_id=org_id,
            actor=default_user,
            roles=roles,
            created_ats=created_ats,
        )

        # Hybrid search - text search for "quick"
        results = await client.query_messages_by_agent_id(
            agent_id=agent_id,
            organization_id=org_id,
            actor=default_user,
            query_text="quick",  # Text search for "quick"
            search_mode="hybrid",
            top_k=3,
            vector_weight=0.5,
            fts_weight=0.5,
        )

        assert len(results) > 0
        # Should get a mix of results based on both vector and text similarity
        result_texts = [msg["text"] for msg, _, _ in results]
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
async def test_message_role_filtering_with_real_tpuf(enable_message_embedding, default_user):
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

        # Insert messages
        await client.insert_messages(
            agent_id=agent_id,
            message_texts=message_texts,
            message_ids=message_ids,
            organization_id=org_id,
            actor=default_user,
            roles=roles,
            created_ats=created_ats,
        )

        # Query only user messages
        user_results = await client.query_messages_by_agent_id(
            agent_id=agent_id, organization_id=org_id, search_mode="timestamp", top_k=10, roles=[MessageRole.user], actor=default_user
        )

        assert len(user_results) == 2
        for msg, _, _ in user_results:
            assert msg["role"] == "user"
            assert msg["text"] in ["I need help with Python", "Can you explain this?"]

        # Query assistant and system messages
        non_user_results = await client.query_messages_by_agent_id(
            agent_id=agent_id,
            organization_id=org_id,
            search_mode="timestamp",
            top_k=10,
            roles=[MessageRole.assistant, MessageRole.system],
            actor=default_user,
        )

        assert len(non_user_results) == 3
        for msg, _, _ in non_user_results:
            assert msg["role"] in ["assistant", "system"]

    finally:
        # Clean up namespace
        try:
            await client.delete_all_messages(agent_id)
        except:
            pass


@pytest.mark.asyncio
async def test_message_search_fallback_to_sql(server, default_user, sarah_agent):
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
        for msg, metadata in results:
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
async def test_message_update_reindexes_in_turbopuffer(server, default_user, sarah_agent, enable_message_embedding):
    """Test that updating a message properly deletes and re-inserts with new embedding in Turbopuffer"""
    from letta.schemas.message import MessageUpdate

    embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")

    # Create initial message
    messages = await server.message_manager.create_many_messages_async(
        pydantic_msgs=[
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(text="Original content about Python programming")],
                agent_id=sarah_agent.id,
            )
        ],
        actor=default_user,
        strict_mode=True,
    )

    assert len(messages) == 1
    message_id = messages[0].id

    # Search for "Python" - should find it
    python_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="Python",
        search_mode="fts",
        limit=10,
    )
    assert len(python_results) > 0
    assert any(msg.id == message_id for msg, metadata in python_results)

    # Update the message content
    updated_message = await server.message_manager.update_message_by_id_async(
        message_id=message_id,
        message_update=MessageUpdate(content="Updated content about JavaScript development"),
        actor=default_user,
        strict_mode=True,
    )

    assert updated_message.id == message_id  # ID should remain the same

    # Search for "Python" - should NOT find it anymore
    python_results_after = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="Python",
        search_mode="fts",
        limit=10,
    )
    # Should either find no results or results that don't include our message
    assert not any(msg.id == message_id for msg, metadata in python_results_after)

    # Search for "JavaScript" - should find the updated message
    js_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="JavaScript",
        search_mode="fts",
        limit=10,
    )
    assert len(js_results) > 0
    assert any(msg.id == message_id for msg, metadata in js_results)

    # Clean up
    await server.message_manager.delete_messages_by_ids_async([message_id], default_user, strict_mode=True)


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_deletion_syncs_with_turbopuffer(server, default_user, enable_message_embedding):
    """Test that all deletion methods properly sync with Turbopuffer"""
    from letta.schemas.agent import CreateAgent
    from letta.schemas.llm_config import LLMConfig

    # Create two test agents
    agent_a = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Agent A",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    agent_b = await server.agent_manager.create_agent_async(
        agent_create=CreateAgent(
            name="Agent B",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    embedding_config = agent_a.embedding_config

    try:
        # Create 5 messages for agent A
        agent_a_messages = []
        for i in range(5):
            msgs = await server.message_manager.create_many_messages_async(
                pydantic_msgs=[
                    PydanticMessage(
                        role=MessageRole.user,
                        content=[TextContent(text=f"Agent A message {i + 1}")],
                        agent_id=agent_a.id,
                    )
                ],
                actor=default_user,
                strict_mode=True,
            )
            agent_a_messages.extend(msgs)

        # Create 3 messages for agent B
        agent_b_messages = []
        for i in range(3):
            msgs = await server.message_manager.create_many_messages_async(
                pydantic_msgs=[
                    PydanticMessage(
                        role=MessageRole.user,
                        content=[TextContent(text=f"Agent B message {i + 1}")],
                        agent_id=agent_b.id,
                    )
                ],
                actor=default_user,
                strict_mode=True,
            )
            agent_b_messages.extend(msgs)

        # Verify initial state - all messages are searchable
        agent_a_search = await server.message_manager.search_messages_async(
            agent_id=agent_a.id,
            actor=default_user,
            query_text="Agent A",
            search_mode="fts",
            limit=10,
        )
        assert len(agent_a_search) == 5

        agent_b_search = await server.message_manager.search_messages_async(
            agent_id=agent_b.id,
            actor=default_user,
            query_text="Agent B",
            search_mode="fts",
            limit=10,
        )
        assert len(agent_b_search) == 3

        # Test 1: Delete single message from agent A
        await server.message_manager.delete_message_by_id_async(agent_a_messages[0].id, default_user, strict_mode=True)

        # Test 2: Batch delete 2 messages from agent A
        await server.message_manager.delete_messages_by_ids_async(
            [agent_a_messages[1].id, agent_a_messages[2].id], default_user, strict_mode=True
        )

        # Test 3: Delete all messages for agent B
        await server.message_manager.delete_all_messages_for_agent_async(agent_b.id, default_user, strict_mode=True)

        # Verify final state
        # Agent A should have 2 messages left (5 - 1 - 2 = 2)
        agent_a_final = await server.message_manager.search_messages_async(
            agent_id=agent_a.id,
            actor=default_user,
            query_text="Agent A",
            search_mode="fts",
            limit=10,
        )
        assert len(agent_a_final) == 2
        # Verify the remaining messages are the correct ones
        remaining_ids = {msg.id for msg, metadata in agent_a_final}
        assert agent_a_messages[3].id in remaining_ids
        assert agent_a_messages[4].id in remaining_ids

        # Agent B should have 0 messages
        agent_b_final = await server.message_manager.search_messages_async(
            agent_id=agent_b.id,
            actor=default_user,
            query_text="Agent B",
            search_mode="fts",
            limit=10,
        )
        assert len(agent_b_final) == 0

    finally:
        # Clean up agents
        await server.agent_manager.delete_agent_async(agent_a.id, default_user)
        await server.agent_manager.delete_agent_async(agent_b.id, default_user)


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_turbopuffer_failure_does_not_break_postgres(server, default_user, sarah_agent, enable_message_embedding):
    """Test that postgres operations succeed even if turbopuffer fails"""
    from unittest.mock import AsyncMock, patch

    from letta.schemas.message import MessageUpdate

    embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")

    # Create initial messages
    messages = await server.message_manager.create_many_messages_async(
        pydantic_msgs=[
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(text="Test message for error handling")],
                agent_id=sarah_agent.id,
            )
        ],
        actor=default_user,
    )

    assert len(messages) == 1
    message_id = messages[0].id

    # Mock turbopuffer client to raise exceptions
    with patch(
        "letta.helpers.tpuf_client.TurbopufferClient.delete_messages",
        new=AsyncMock(side_effect=Exception("Turbopuffer connection failed")),
    ):
        with patch(
            "letta.helpers.tpuf_client.TurbopufferClient.insert_messages",
            new=AsyncMock(side_effect=Exception("Turbopuffer insert failed")),
        ):
            # Test 1: Update should succeed in postgres despite turbopuffer failure
            # NOTE: strict_mode=False here because we're testing error resilience
            updated_message = await server.message_manager.update_message_by_id_async(
                message_id=message_id,
                message_update=MessageUpdate(content="Updated despite turbopuffer failure"),
                actor=default_user,
                strict_mode=False,  # Don't fail on turbopuffer errors - that's what we're testing!
            )

            # Verify postgres was updated successfully
            assert updated_message.id == message_id
            updated_text = server.message_manager._extract_message_text(updated_message)
            assert "Updated despite turbopuffer failure" in updated_text

            # Test 2: Delete should succeed in postgres despite turbopuffer failure
            # First create another message to delete
            messages2 = await server.message_manager.create_many_messages_async(
                pydantic_msgs=[
                    PydanticMessage(
                        role=MessageRole.user,
                        content=[TextContent(text="Message to delete")],
                        agent_id=sarah_agent.id,
                    )
                ],
                actor=default_user,
            )
            message_to_delete_id = messages2[0].id

            # Delete with mocked turbopuffer failure
            # NOTE: strict_mode=False here because we're testing error resilience
            deletion_result = await server.message_manager.delete_message_by_id_async(message_to_delete_id, default_user, strict_mode=False)
            assert deletion_result == True

            # Verify message is deleted from postgres
            deleted_msg = await server.message_manager.get_message_by_id_async(message_to_delete_id, default_user)
            assert deleted_msg is None

    # Clean up remaining message (use strict_mode=False since turbopuffer might be mocked)
    await server.message_manager.delete_messages_by_ids_async([message_id], default_user, strict_mode=False)


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_creation_background_mode(server, default_user, sarah_agent, enable_message_embedding):
    """Test that messages are embedded in background when strict_mode=False"""
    embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")

    # Create message in background mode
    messages = await server.message_manager.create_many_messages_async(
        pydantic_msgs=[
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(text="Background test message about Python programming")],
                agent_id=sarah_agent.id,
            )
        ],
        actor=default_user,
        strict_mode=False,  # Background mode
    )

    assert len(messages) == 1
    message_id = messages[0].id

    # Message should be in PostgreSQL immediately
    sql_message = await server.message_manager.get_message_by_id_async(message_id, default_user)
    assert sql_message is not None
    assert sql_message.id == message_id

    # Poll for embedding completion by querying Turbopuffer directly
    embedded = await wait_for_embedding(
        agent_id=sarah_agent.id,
        message_id=message_id,
        organization_id=default_user.organization_id,
        actor=default_user,
        max_wait=10.0,
        poll_interval=0.5,
    )
    assert embedded, "Message was not embedded in Turbopuffer within timeout"

    # Now verify it's also searchable through the search API
    search_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="Python programming",
        search_mode="fts",
        limit=10,
    )
    assert len(search_results) > 0
    assert any(msg.id == message_id for msg, _ in search_results)

    # Clean up
    await server.message_manager.delete_messages_by_ids_async([message_id], default_user, strict_mode=True)


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_update_background_mode(server, default_user, sarah_agent, enable_message_embedding):
    """Test that message updates work in background mode"""
    from letta.schemas.message import MessageUpdate

    embedding_config = sarah_agent.embedding_config or EmbeddingConfig.default_config(provider="openai")

    # Create initial message with strict_mode=True to ensure it's embedded
    messages = await server.message_manager.create_many_messages_async(
        pydantic_msgs=[
            PydanticMessage(
                role=MessageRole.user,
                content=[TextContent(text="Original content about databases")],
                agent_id=sarah_agent.id,
            )
        ],
        actor=default_user,
        strict_mode=True,  # Ensure initial embedding
    )

    assert len(messages) == 1
    message_id = messages[0].id

    # Verify initial content is searchable
    initial_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="databases",
        search_mode="fts",
        limit=10,
    )
    assert any(msg.id == message_id for msg, _ in initial_results)

    # Update message in background mode
    updated_message = await server.message_manager.update_message_by_id_async(
        message_id=message_id,
        message_update=MessageUpdate(content="Updated content about machine learning"),
        actor=default_user,
        strict_mode=False,  # Background mode
    )

    assert updated_message.id == message_id

    # PostgreSQL should be updated immediately
    sql_message = await server.message_manager.get_message_by_id_async(message_id, default_user)
    assert "machine learning" in server.message_manager._extract_message_text(sql_message)

    # Wait a bit for the background update to process
    await asyncio.sleep(1.0)

    # Poll for the update to be reflected in Turbopuffer
    # We check by searching for the new content
    embedded = await wait_for_embedding(
        agent_id=sarah_agent.id,
        message_id=message_id,
        organization_id=default_user.organization_id,
        actor=default_user,
        max_wait=10.0,
        poll_interval=0.5,
    )
    assert embedded, "Updated message was not re-embedded within timeout"

    # Now verify the new content is searchable
    new_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="machine learning",
        search_mode="fts",
        limit=10,
    )
    assert any(msg.id == message_id for msg, _ in new_results)

    # Old content should eventually no longer be searchable
    # (may take a moment for the delete to process)
    await asyncio.sleep(2.0)
    old_results = await server.message_manager.search_messages_async(
        agent_id=sarah_agent.id,
        actor=default_user,
        query_text="databases",
        search_mode="fts",
        limit=10,
    )
    # The message shouldn't match the old search term anymore
    if len(old_results) > 0:
        # If we find results, verify our message doesn't contain the old content
        for msg, _ in old_results:
            if msg.id == message_id:
                text = server.message_manager._extract_message_text(msg)
                assert "databases" not in text.lower()

    # Clean up
    await server.message_manager.delete_messages_by_ids_async([message_id], default_user, strict_mode=True)


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_date_filtering_with_real_tpuf(enable_message_embedding, default_user):
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
                message_ids=[str(uuid.uuid4())],
                organization_id=org_id,
                actor=default_user,
                roles=[MessageRole.assistant],
                created_ats=[timestamp],
            )

        # Query messages from the last 3 days
        three_days_ago = now - timedelta(days=3)
        recent_results = await client.query_messages_by_agent_id(
            agent_id=agent_id, organization_id=org_id, search_mode="timestamp", top_k=10, start_date=three_days_ago, actor=default_user
        )

        # Should get today's and yesterday's messages
        assert len(recent_results) == 2
        result_texts = [msg["text"] for msg, _, _ in recent_results]
        assert "Today's message" in result_texts
        assert "Yesterday's message" in result_texts

        # Query messages between 2 weeks ago and 1 week ago
        two_weeks_ago = now - timedelta(days=14)
        week_results = await client.query_messages_by_agent_id(
            agent_id=agent_id,
            organization_id=org_id,
            search_mode="timestamp",
            top_k=10,
            start_date=two_weeks_ago,
            end_date=last_week + timedelta(days=1),  # Include last week's message
            actor=default_user,
        )

        # Should get only last week's message
        assert len(week_results) == 1
        assert week_results[0][0]["text"] == "Last week's message"

        # Query with vector search and date filtering
        filtered_vector_results = await client.query_messages_by_agent_id(
            agent_id=agent_id,
            organization_id=org_id,
            actor=default_user,
            query_text="message",
            search_mode="vector",
            top_k=10,
            start_date=three_days_ago,
        )

        # Should get only recent messages
        assert len(filtered_vector_results) == 2
        for msg, _, _ in filtered_vector_results:
            assert msg["text"] in ["Today's message", "Yesterday's message"]

    finally:
        # Clean up namespace
        try:
            await client.delete_all_messages(agent_id)
        except:
            pass


@pytest.mark.asyncio
async def test_archive_namespace_tracking(server, default_user, enable_turbopuffer):
    """Test that archive namespaces are properly tracked in database"""
    # Create an archive
    archive = await server.archive_manager.create_archive_async(
        name="Test Archive for Namespace", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )

    # Get namespace - should be generated and stored
    namespace = await server.archive_manager.get_or_set_vector_db_namespace_async(archive.id)

    # Should have archive_ prefix and environment suffix
    expected_prefix = "archive_"
    assert namespace.startswith(expected_prefix)
    assert archive.id in namespace
    if settings.environment:
        assert settings.environment.lower() in namespace

    # Call again - should return same namespace from database
    namespace2 = await server.archive_manager.get_or_set_vector_db_namespace_async(archive.id)
    assert namespace == namespace2


@pytest.mark.asyncio
async def test_namespace_consistency_with_tpuf_client(server, default_user, enable_turbopuffer):
    """Test that the namespace from managers matches what tpuf_client would generate"""
    # Create archive and agent
    archive = await server.archive_manager.create_archive_async(
        name="Test Consistency Archive", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
    )

    # Get namespace from manager
    archive_namespace = await server.archive_manager.get_or_set_vector_db_namespace_async(archive.id)

    # Create TurbopufferClient and get what it would generate
    client = TurbopufferClient()
    tpuf_namespace = await client._get_archive_namespace_name(archive.id)

    # Should match
    assert archive_namespace == tpuf_namespace


@pytest.mark.asyncio
async def test_environment_namespace_variation(server, default_user):
    """Test namespace generation with different environment settings"""
    # Test with no environment
    original_env = settings.environment
    try:
        settings.environment = None

        archive = await server.archive_manager.create_archive_async(
            name="No Env Archive", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
        )
        namespace_no_env = await server.archive_manager.get_or_set_vector_db_namespace_async(archive.id)
        assert namespace_no_env == f"archive_{archive.id}"

        # Test with environment
        settings.environment = "TESTING"

        archive2 = await server.archive_manager.create_archive_async(
            name="With Env Archive", embedding_config=EmbeddingConfig.default_config(provider="openai"), actor=default_user
        )
        namespace_with_env = await server.archive_manager.get_or_set_vector_db_namespace_async(archive2.id)
        assert namespace_with_env == f"archive_{archive2.id}_testing"

    finally:
        settings.environment = original_env


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_project_id_filtering(server, sarah_agent, default_user, enable_turbopuffer, enable_message_embedding):
    """Test that project_id filtering works correctly in query_messages_by_agent_id"""
    from letta.schemas.letta_message_content import TextContent

    # Create two project IDs
    project_a_id = str(uuid.uuid4())
    project_b_id = str(uuid.uuid4())

    # Create messages with different project IDs
    message_a = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Message for project A about Python")],
    )

    message_b = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Message for project B about JavaScript")],
    )

    # Insert messages with their respective project IDs
    tpuf_client = TurbopufferClient()

    # Embeddings will be generated automatically by the client

    # Insert message A with project_a_id
    await tpuf_client.insert_messages(
        agent_id=sarah_agent.id,
        message_texts=[message_a.content[0].text],
        message_ids=[message_a.id],
        organization_id=default_user.organization_id,
        actor=default_user,
        roles=[message_a.role],
        created_ats=[message_a.created_at],
        project_id=project_a_id,
    )

    # Insert message B with project_b_id
    await tpuf_client.insert_messages(
        agent_id=sarah_agent.id,
        message_texts=[message_b.content[0].text],
        message_ids=[message_b.id],
        organization_id=default_user.organization_id,
        actor=default_user,
        roles=[message_b.role],
        created_ats=[message_b.created_at],
        project_id=project_b_id,
    )

    # Poll for message A with project_a_id filter
    max_retries = 10
    for i in range(max_retries):
        results_a = await tpuf_client.query_messages_by_agent_id(
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            search_mode="timestamp",  # Simple timestamp retrieval
            top_k=10,
            project_id=project_a_id,
            actor=default_user,
        )
        if len(results_a) == 1 and results_a[0][0]["id"] == message_a.id:
            break
        await asyncio.sleep(0.5)
    else:
        pytest.fail(f"Message A not found after {max_retries} retries")

    assert "Python" in results_a[0][0]["text"]

    # Poll for message B with project_b_id filter
    for i in range(max_retries):
        results_b = await tpuf_client.query_messages_by_agent_id(
            agent_id=sarah_agent.id,
            organization_id=default_user.organization_id,
            search_mode="timestamp",
            top_k=10,
            project_id=project_b_id,
            actor=default_user,
        )
        if len(results_b) == 1 and results_b[0][0]["id"] == message_b.id:
            break
        await asyncio.sleep(0.5)
    else:
        pytest.fail(f"Message B not found after {max_retries} retries")

    assert "JavaScript" in results_b[0][0]["text"]

    # Query without project filter - should find both
    results_all = await tpuf_client.query_messages_by_agent_id(
        agent_id=sarah_agent.id,
        organization_id=default_user.organization_id,
        search_mode="timestamp",
        top_k=10,
        project_id=None,  # No filter
        actor=default_user,
    )

    assert len(results_all) >= 2  # May have other messages from setup
    message_ids = [r[0]["id"] for r in results_all]
    assert message_a.id in message_ids
    assert message_b.id in message_ids

    # Clean up
    await tpuf_client.delete_messages(
        agent_id=sarah_agent.id, organization_id=default_user.organization_id, message_ids=[message_a.id, message_b.id]
    )


@pytest.mark.asyncio
@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
async def test_message_template_id_filtering(server, sarah_agent, default_user, enable_turbopuffer, enable_message_embedding):
    """Test that template_id filtering works correctly in message queries"""
    from letta.schemas.letta_message_content import TextContent

    # Create two template IDs
    template_a_id = str(uuid.uuid4())
    template_b_id = str(uuid.uuid4())

    # Create messages with different template IDs
    message_a = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Message for template A")],
    )

    message_b = PydanticMessage(
        agent_id=sarah_agent.id,
        role=MessageRole.user,
        content=[TextContent(text="Message for template B")],
    )

    # Insert messages with their respective template IDs
    tpuf_client = TurbopufferClient()

    await tpuf_client.insert_messages(
        agent_id=sarah_agent.id,
        message_texts=[message_a.content[0].text],
        message_ids=[message_a.id],
        organization_id=default_user.organization_id,
        actor=default_user,
        roles=[message_a.role],
        created_ats=[message_a.created_at],
        template_id=template_a_id,
    )

    await tpuf_client.insert_messages(
        agent_id=sarah_agent.id,
        message_texts=[message_b.content[0].text],
        message_ids=[message_b.id],
        organization_id=default_user.organization_id,
        actor=default_user,
        roles=[message_b.role],
        created_ats=[message_b.created_at],
        template_id=template_b_id,
    )

    # Wait for indexing
    await asyncio.sleep(1)

    # Query for template A - should find only message A
    results_a = await tpuf_client.query_messages_by_agent_id(
        agent_id=sarah_agent.id,
        organization_id=default_user.organization_id,
        search_mode="timestamp",
        top_k=10,
        template_id=template_a_id,
        actor=default_user,
    )

    assert len(results_a) == 1
    assert results_a[0][0]["id"] == message_a.id
    assert "template A" in results_a[0][0]["text"]

    # Query for template B - should find only message B
    results_b = await tpuf_client.query_messages_by_agent_id(
        agent_id=sarah_agent.id,
        organization_id=default_user.organization_id,
        search_mode="timestamp",
        top_k=10,
        template_id=template_b_id,
        actor=default_user,
    )

    assert len(results_b) == 1
    assert results_b[0][0]["id"] == message_b.id
    assert "template B" in results_b[0][0]["text"]

    # Clean up
    await tpuf_client.delete_messages(
        agent_id=sarah_agent.id, organization_id=default_user.organization_id, message_ids=[message_a.id, message_b.id]
    )
