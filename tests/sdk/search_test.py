"""
End-to-end tests for passage and message search endpoints using the SDK client.

These tests verify that the /v1/passages/search and /v1/messages/search endpoints work correctly
with Turbopuffer integration, including vector search, FTS, hybrid search, filtering, and pagination.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from letta_client import Letta
from letta_client.types import CreateBlockParam, MessageCreateParam

from letta.config import LettaConfig
from letta.schemas.tool import ToolSearchResult
from letta.server.rest_api.routers.v1.passages import PassageSearchResult
from letta.server.server import SyncServer
from letta.settings import model_settings, settings

DEFAULT_ORG_ID = "org-00000000-0000-4000-8000-000000000000"


def cleanup_agent_with_messages(client: Letta, agent_id: str):
    """
    Helper function to properly clean up an agent by first deleting all its messages
    from Turbopuffer before deleting the agent itself.

    Args:
        client: Letta SDK client
        agent_id: ID of the agent to clean up
    """
    try:
        # First, delete all messages for this agent from Turbopuffer
        # This ensures no orphaned messages remain in Turbopuffer
        try:
            import asyncio

            from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

            if should_use_tpuf_for_messages():
                tpuf_client = TurbopufferClient()
                # Delete all messages for this agent from Turbopuffer
                asyncio.run(tpuf_client.delete_all_messages(agent_id, DEFAULT_ORG_ID))
        except Exception as e:
            print(f"Warning: Failed to clean up Turbopuffer messages for agent {agent_id}: {e}")

        # Now delete the agent itself (which will delete SQL messages via cascade)
        client.agents.delete(agent_id=agent_id)
    except Exception as e:
        print(f"Warning: Failed to clean up agent {agent_id}: {e}")


def cleanup_tool(client: Letta, tool_id: str):
    """
    Helper function to properly clean up a tool by deleting it from both
    Turbopuffer and the database.

    Args:
        client: Letta SDK client
        tool_id: ID of the tool to clean up
    """
    try:
        # First, delete from Turbopuffer if tool embedding is enabled
        try:
            import asyncio

            from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_tools

            if should_use_tpuf_for_tools():
                tpuf_client = TurbopufferClient()
                asyncio.run(tpuf_client.delete_tools(DEFAULT_ORG_ID, [tool_id]))
        except Exception as e:
            print(f"Warning: Failed to clean up Turbopuffer tool {tool_id}: {e}")

        # Now delete the tool from the database
        client.tools.delete(tool_id=tool_id)
    except Exception as e:
        print(f"Warning: Failed to clean up tool {tool_id}: {e}")


@pytest.fixture(scope="module")
def server():
    """Server fixture for testing"""
    config = LettaConfig.load()
    config.save()
    server = SyncServer(init_with_default_org_and_user=False)
    return server


@pytest.fixture
def enable_turbopuffer():
    """Temporarily enable Turbopuffer for testing"""
    original_use_tpuf = settings.use_tpuf
    original_api_key = settings.tpuf_api_key
    original_environment = settings.environment

    # Enable Turbopuffer with test key
    settings.use_tpuf = True
    if not settings.tpuf_api_key:
        settings.tpuf_api_key = original_api_key
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


@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
def test_passage_search_basic(client: Letta, enable_turbopuffer):
    """Test basic passage search functionality through the SDK"""
    # Create an agent
    agent = client.agents.create(
        name=f"test_passage_search_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Create an archive and attach to agent
        archive = client.archives.create(name=f"test_archive_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")

        try:
            # Attach archive to agent
            client.agents.archives.attach(agent_id=agent.id, archive_id=archive.id)

            # Insert some passages
            test_passages = [
                "Python is a popular programming language for data science and machine learning.",
                "JavaScript is widely used for web development and frontend applications.",
                "Turbopuffer is a vector database optimized for performance and scalability.",
            ]

            for passage_text in test_passages:
                client.archives.passages.create(archive_id=archive.id, text=passage_text)

            # Wait for indexing
            time.sleep(2)

            # Test search by agent_id
            results = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "python programming",
                    "agent_id": agent.id,
                    "limit": 10,
                },
            )

            assert len(results) > 0, "Should find at least one passage"
            assert any("Python" in result["passage"]["text"] for result in results), "Should find Python-related passage"

            # Verify result structure
            for result in results:
                assert "passage" in result, "Result should have passage field"
                assert "score" in result, "Result should have score field"
                assert "metadata" in result, "Result should have metadata field"
                assert isinstance(result["score"], float), "Score should be a float"

            # Test search by archive_id
            archive_results = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "vector database",
                    "archive_id": archive.id,
                    "limit": 10,
                },
            )

            assert len(archive_results) > 0, "Should find passages in archive"
            assert any("Turbopuffer" in result["passage"]["text"] or "vector" in result["passage"]["text"] for result in archive_results), (
                "Should find vector-related passage"
            )

        finally:
            # Clean up archive
            try:
                client.archives.delete(archive_id=archive.id)
            except:
                pass

    finally:
        # Clean up agent
        cleanup_agent_with_messages(client, agent.id)


@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
def test_passage_search_with_tags(client: Letta, enable_turbopuffer):
    """Test passage search with tag filtering"""
    # Create an agent
    agent = client.agents.create(
        name=f"test_passage_tags_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Create an archive
        archive = client.archives.create(name=f"test_archive_tags_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")

        try:
            # Attach archive to agent
            client.agents.archives.attach(agent_id=agent.id, archive_id=archive.id)

            # Insert passages with tags (if supported)
            # Note: Tag support may depend on the SDK version
            test_passages = [
                "Python tutorial for beginners",
                "Advanced Python techniques",
                "JavaScript basics",
            ]

            for passage_text in test_passages:
                client.archives.passages.create(archive_id=archive.id, text=passage_text)

            # Wait for indexing
            time.sleep(2)

            # Test basic search without tags first
            results = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "programming tutorial",
                    "agent_id": agent.id,
                    "limit": 10,
                },
            )

            assert len(results) > 0, "Should find passages"

            # Test with tag filtering if supported
            # Note: The SDK may not expose tag parameters directly, so this test verifies basic functionality
            # The backend will handle tag filtering when available

        finally:
            # Clean up archive
            try:
                client.archives.delete(archive_id=archive.id)
            except:
                pass

    finally:
        # Clean up agent
        cleanup_agent_with_messages(client, agent.id)


@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
def test_passage_search_with_date_filters(client: Letta, enable_turbopuffer):
    """Test passage search with date range filtering"""
    # Create an agent
    agent = client.agents.create(
        name=f"test_passage_dates_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Create an archive
        archive = client.archives.create(name=f"test_archive_dates_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")

        try:
            # Attach archive to agent
            client.agents.archives.attach(agent_id=agent.id, archive_id=archive.id)

            # Insert passages at different times
            client.archives.passages.create(archive_id=archive.id, text="Recent passage about AI trends")

            # Wait a bit before creating another
            time.sleep(1)

            client.archives.passages.create(archive_id=archive.id, text="Another passage about machine learning")

            # Wait for indexing
            time.sleep(2)

            # Test search with date range
            now = datetime.now(timezone.utc)
            start_date = now - timedelta(hours=1)

            results = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "AI machine learning",
                    "agent_id": agent.id,
                    "limit": 10,
                    "start_date": start_date.isoformat(),
                },
            )

            assert len(results) > 0, "Should find recent passages"

            # Verify all results are within date range
            for result in results:
                passage_date = result["passage"]["created_at"]
                if passage_date:
                    # Convert to datetime if it's a string
                    if isinstance(passage_date, str):
                        passage_date = datetime.fromisoformat(passage_date.replace("Z", "+00:00"))
                    assert passage_date >= start_date, "Passage should be after start_date"

        finally:
            # Clean up archive
            try:
                client.archives.delete(archive_id=archive.id)
            except:
                pass

    finally:
        # Clean up agent
        cleanup_agent_with_messages(client, agent.id)


@pytest.mark.skipif(
    not (settings.use_tpuf and settings.tpuf_api_key and model_settings.openai_api_key and settings.embed_all_messages),
    reason="Message search requires Turbopuffer, OpenAI, and message embedding to be enabled",
)
def test_message_search_basic(client: Letta, enable_message_embedding):
    """Test basic message search functionality through the SDK"""
    # Create an agent
    agent = client.agents.create(
        name=f"test_message_search_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="helpful assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Send messages to the agent
        test_messages = [
            "What is the capital of Saudi Arabia?",
        ]

        for msg_text in test_messages:
            client.agents.messages.create(agent_id=agent.id, messages=[MessageCreateParam(role="user", content=msg_text)])

        # Wait for messages to be indexed and database transactions to complete
        # Extra time needed for async embedding and database commits
        time.sleep(10)

        # Test FTS search for messages
        # Note: The endpoint returns LettaMessageSearchResult (API schema)
        # and we treat the response as generic dicts here to avoid tight
        # coupling to internal server-side models.
        results = client.post(
            "/v1/messages/search",
            cast_to=list[dict[str, Any]],
            body={
                "query": "capital Saudi Arabia",
                "search_mode": "fts",
                "limit": 10,
            },
        )

        print(f"Search returned {len(results)} results")
        if len(results) > 0:
            print(f"First result type: {type(results[0])}")
            print(f"First result keys: {results[0].keys() if isinstance(results[0], dict) else 'N/A'}")

        for result in results:
            assert "agent_id" in result, "Result should have agent_id field"

            # created_at should always be present and parseable
            assert "created_at" in result, "Result should have created_at field"
            assert result["created_at"], "created_at should be set"
            created_at = result["created_at"]
            if isinstance(created_at, str):
                # Handle both "+00:00" and "Z" suffixes
                datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        assert len(results) > 0, f"Should find at least one message. Got {len(results)} results."

    finally:
        # Clean up agent
        cleanup_agent_with_messages(client, agent.id)


@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
def test_passage_search_pagination(client: Letta, enable_turbopuffer):
    """Test passage search pagination"""
    # Create an agent
    agent = client.agents.create(
        name=f"test_passage_pagination_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Create an archive
        archive = client.archives.create(name=f"test_archive_pagination_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")

        try:
            # Attach archive to agent
            client.agents.archives.attach(agent_id=agent.id, archive_id=archive.id)

            # Insert many passages
            for i in range(10):
                client.archives.passages.create(archive_id=archive.id, text=f"Test passage number {i} about programming")

            # Wait for indexing
            time.sleep(2)

            # Test with different limit values
            results_limit_3 = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "programming",
                    "agent_id": agent.id,
                    "limit": 3,
                },
            )

            assert len(results_limit_3) == 3, "Should respect limit parameter"

            results_limit_5 = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "programming",
                    "agent_id": agent.id,
                    "limit": 5,
                },
            )

            assert len(results_limit_5) == 5, "Should return 5 results"

            results_all = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "programming",
                    "agent_id": agent.id,
                    "limit": 20,
                },
            )

            assert len(results_all) >= 10, "Should return all matching passages"

        finally:
            # Clean up archive
            try:
                client.archives.delete(archive_id=archive.id)
            except:
                pass

    finally:
        # Clean up agent
        cleanup_agent_with_messages(client, agent.id)


@pytest.mark.skipif(not settings.tpuf_api_key, reason="Turbopuffer API key not configured")
def test_passage_search_org_wide(client: Letta, enable_turbopuffer):
    """Test organization-wide passage search (without agent_id or archive_id)"""
    # Create multiple agents with archives
    agent1 = client.agents.create(
        name=f"test_org_search_agent1_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant 1")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    agent2 = client.agents.create(
        name=f"test_org_search_agent2_{uuid.uuid4()}",
        memory_blocks=[CreateBlockParam(label="persona", value="test assistant 2")],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
    )

    try:
        # Create archives for both agents
        archive1 = client.archives.create(name=f"test_archive_org1_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")
        archive2 = client.archives.create(name=f"test_archive_org2_{uuid.uuid4()}", embedding="openai/text-embedding-3-small")

        try:
            # Attach archives
            client.agents.archives.attach(agent_id=agent1.id, archive_id=archive1.id)
            client.agents.archives.attach(agent_id=agent2.id, archive_id=archive2.id)

            # Insert passages in both archives
            client.archives.passages.create(archive_id=archive1.id, text="Unique passage in agent1 about quantum computing")

            client.archives.passages.create(archive_id=archive2.id, text="Unique passage in agent2 about blockchain technology")

            # Wait for indexing
            time.sleep(2)

            # Test org-wide search (no agent_id or archive_id)
            results = client.post(
                "/v1/passages/search",
                cast_to=list[PassageSearchResult],
                body={
                    "query": "unique passage",
                    "limit": 20,
                },
            )

            # Should find passages from both agents
            assert len(results) >= 2, "Should find passages from multiple agents"

            found_texts = [result["passage"]["text"] for result in results]
            assert any("quantum computing" in text for text in found_texts), "Should find agent1 passage"
            assert any("blockchain" in text for text in found_texts), "Should find agent2 passage"

        finally:
            # Clean up archives
            try:
                client.archives.delete(archive_id=archive1.id)
            except:
                pass
            try:
                client.archives.delete(archive_id=archive2.id)
            except:
                pass

    finally:
        # Clean up agents
        cleanup_agent_with_messages(client, agent1.id)
        cleanup_agent_with_messages(client, agent2.id)


@pytest.fixture
def enable_tool_embedding():
    """Enable both Turbopuffer and tool embedding"""
    original_use_tpuf = settings.use_tpuf
    original_api_key = settings.tpuf_api_key
    original_embed_tools = settings.embed_tools
    original_environment = settings.environment

    settings.use_tpuf = True
    settings.tpuf_api_key = settings.tpuf_api_key or "test-key"
    settings.embed_tools = True
    settings.environment = "DEV"

    yield

    settings.use_tpuf = original_use_tpuf
    settings.tpuf_api_key = original_api_key
    settings.embed_tools = original_embed_tools
    settings.environment = original_environment


@pytest.mark.skipif(
    not (settings.use_tpuf and settings.tpuf_api_key and model_settings.openai_api_key and settings.embed_tools),
    reason="Tool search requires Turbopuffer, OpenAI, and tool embedding to be enabled",
)
def test_tool_search_basic(client: Letta, enable_tool_embedding):
    """Test basic tool search functionality through the SDK"""
    tool_ids = []

    try:
        # Create test tools with distinct descriptions for semantic search
        test_tools = [
            {
                "source_code": '''
def send_email_to_user(recipient: str, subject: str, body: str) -> str:
    """Send an email message to a specified recipient.

    Args:
        recipient: Email address of the recipient
        subject: Subject line of the email
        body: Body content of the email message

    Returns:
        Confirmation message
    """
    return f"Email sent to {recipient}"
''',
                "description": "Send an email message to a specified recipient with subject and body.",
                "tags": ["communication", "email"],
            },
            {
                "source_code": '''
def fetch_weather_data(city: str, units: str = "celsius") -> str:
    """Fetch current weather information for a city.

    Args:
        city: Name of the city to get weather for
        units: Temperature units (celsius or fahrenheit)

    Returns:
        Weather information string
    """
    return f"Weather in {city}: sunny, 25 {units}"
''',
                "description": "Fetch current weather information for a specified city.",
                "tags": ["weather", "api"],
            },
            {
                "source_code": '''
def calculate_compound_interest(principal: float, rate: float, years: int) -> float:
    """Calculate compound interest on an investment.

    Args:
        principal: Initial investment amount
        rate: Annual interest rate as decimal
        years: Number of years

    Returns:
        Final amount after compound interest
    """
    return principal * (1 + rate) ** years
''',
                "description": "Calculate compound interest on a financial investment over time.",
                "tags": ["finance", "calculator"],
            },
        ]

        # Create tools via SDK
        for tool_data in test_tools:
            tool = client.tools.create(
                source_code=tool_data["source_code"],
                description=tool_data["description"],
                tags=tool_data["tags"],
            )
            tool_ids.append(tool.id)

        # Wait for embeddings to be indexed
        time.sleep(3)

        # Test semantic search - should find email-related tool
        results = client.post(
            "/v1/tools/search",
            cast_to=list[ToolSearchResult],
            body={
                "query": "send message to someone",
                "search_mode": "hybrid",
                "limit": 10,
            },
        )

        assert len(results) > 0, "Should find at least one tool"

        # The email tool should be ranked highly for this query
        tool_names = [result["tool"]["name"] for result in results]
        assert "send_email_to_user" in tool_names, "Should find email tool for messaging query"

        # Verify result structure
        for result in results:
            assert "tool" in result, "Result should have tool field"
            assert "combined_score" in result, "Result should have combined_score field"
            assert isinstance(result["combined_score"], float), "combined_score should be a float"

        # Test search with different query - should find weather tool
        weather_results = client.post(
            "/v1/tools/search",
            cast_to=list[ToolSearchResult],
            body={
                "query": "get temperature forecast",
                "search_mode": "hybrid",
                "limit": 10,
            },
        )

        assert len(weather_results) > 0, "Should find tools for weather query"
        weather_tool_names = [result["tool"]["name"] for result in weather_results]
        assert "fetch_weather_data" in weather_tool_names, "Should find weather tool"

        # Test search with tag filter
        finance_results = client.post(
            "/v1/tools/search",
            cast_to=list[ToolSearchResult],
            body={
                "query": "money calculation",
                "tags": ["finance"],
                "search_mode": "hybrid",
                "limit": 10,
            },
        )

        # Should find the finance tool when filtering by tag
        if len(finance_results) > 0:
            finance_tool_names = [result["tool"]["name"] for result in finance_results]
            assert "calculate_compound_interest" in finance_tool_names, "Should find finance tool with tag filter"

    finally:
        # Clean up all created tools
        for tool_id in tool_ids:
            cleanup_tool(client, tool_id)
