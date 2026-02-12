import glob
import json
import os
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from letta.config import LettaConfig
from letta.llm_api.llm_client import LLMClient
from letta.llm_api.openai_client import OpenAIClient
from letta.schemas.embedding_config import EmbeddingConfig
from letta.server.server import SyncServer

included_files = [
    # "ollama.json",
    "openai_embed.json",
]
config_dir = "tests/configs/embedding_model_configs"
config_files = glob.glob(os.path.join(config_dir, "*.json"))
embedding_configs = []
for config_file in config_files:
    if config_file.split("/")[-1] in included_files:
        with open(config_file, "r") as f:
            embedding_configs.append(EmbeddingConfig(**json.load(f)))


@pytest.fixture
async def server():
    config = LettaConfig.load()
    config.save()

    server = SyncServer()
    await server.init_async()
    return server


@pytest.fixture
async def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = await server.organization_manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await server.user_manager.create_default_actor_async(org_id=default_organization.id)
    yield user


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "embedding_config",
    embedding_configs,
    ids=[c.embedding_model for c in embedding_configs],
)
async def test_embeddings(embedding_config: EmbeddingConfig, default_user):
    embedding_client = LLMClient.create(
        provider_type=embedding_config.embedding_endpoint_type,
        actor=default_user,
    )

    test_input = "This is a test input."
    embeddings = await embedding_client.request_embeddings([test_input], embedding_config)
    assert len(embeddings) == 1
    assert len(embeddings[0]) == embedding_config.embedding_dim


@pytest.mark.asyncio
async def test_openai_embedding_chunking(default_user):
    """Test that large inputs are split into 2048-sized chunks"""
    embedding_config = EmbeddingConfig(
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_model="text-embedding-3-small",
        embedding_dim=1536,
    )

    client = OpenAIClient(actor=default_user)

    with patch("letta.llm_api.openai_client.AsyncOpenAI") as mock_openai:
        mock_client = AsyncMock()
        mock_openai.return_value = mock_client

        async def mock_create(**kwargs):
            input_size = len(kwargs["input"])
            assert input_size <= 2048  # verify chunking
            mock_response = AsyncMock()
            mock_response.data = [AsyncMock(embedding=[0.1] * 1536) for _ in range(input_size)]
            return mock_response

        mock_client.embeddings.create.side_effect = mock_create

        # test with 5000 inputs (should be split into 3 chunks: 2048, 2048, 904)
        test_inputs = [f"Input {i}" for i in range(5000)]
        embeddings = await client.request_embeddings(test_inputs, embedding_config)

        assert len(embeddings) == 5000
        assert mock_client.embeddings.create.call_count == 3


@pytest.mark.asyncio
async def test_openai_embedding_retry_logic(default_user):
    """Test that failed chunks are retried with reduced batch size"""
    embedding_config = EmbeddingConfig(
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_model="text-embedding-3-small",
        embedding_dim=1536,
    )

    client = OpenAIClient(actor=default_user)

    with patch("letta.llm_api.openai_client.AsyncOpenAI") as mock_openai:
        mock_client = AsyncMock()
        mock_openai.return_value = mock_client

        call_count = 0

        async def mock_create(**kwargs):
            nonlocal call_count
            call_count += 1
            input_size = len(kwargs["input"])

            # fail on first attempt for large batches only
            if input_size == 2048 and call_count <= 2:
                raise Exception("Too many inputs")

            mock_response = AsyncMock()
            mock_response.data = [AsyncMock(embedding=[0.1] * 1536) for _ in range(input_size)]
            return mock_response

        mock_client.embeddings.create.side_effect = mock_create

        test_inputs = [f"Input {i}" for i in range(3000)]
        embeddings = await client.request_embeddings(test_inputs, embedding_config)

        assert len(embeddings) == 3000
        # initial: 2 chunks (2048, 952)
        # after retry: first 2048 splits into 2x1024 with reduced batch_size, so total 3 successful calls + 2 failed = 5
        assert call_count > 3


@pytest.mark.asyncio
async def test_openai_embedding_order_preserved(default_user):
    """Test that order is maintained despite chunking and retries"""
    embedding_config = EmbeddingConfig(
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_model="text-embedding-3-small",
        embedding_dim=1536,
    )

    client = OpenAIClient(actor=default_user)

    with patch("letta.llm_api.openai_client.AsyncOpenAI") as mock_openai:
        mock_client = AsyncMock()
        mock_openai.return_value = mock_client

        async def mock_create(**kwargs):
            # return embeddings where first element = input index
            mock_response = AsyncMock()
            mock_response.data = []
            for text in kwargs["input"]:
                idx = int(text.split()[-1])
                embedding = [float(idx)] + [0.0] * 1535
                mock_response.data.append(AsyncMock(embedding=embedding))
            return mock_response

        mock_client.embeddings.create.side_effect = mock_create

        test_inputs = [f"Text {i}" for i in range(100)]
        embeddings = await client.request_embeddings(test_inputs, embedding_config)

        assert len(embeddings) == 100
        for i in range(100):
            assert embeddings[i][0] == float(i)


@pytest.mark.asyncio
async def test_openai_embedding_minimum_chunk_failure(default_user):
    """Test that persistent failures at minimum chunk size raise error"""
    embedding_config = EmbeddingConfig(
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_model="text-embedding-3-small",
        embedding_dim=1536,
    )

    client = OpenAIClient(actor=default_user)

    with patch("letta.llm_api.openai_client.AsyncOpenAI") as mock_openai:
        mock_client = AsyncMock()
        mock_openai.return_value = mock_client

        async def mock_create(**kwargs):
            raise Exception("API error")

        mock_client.embeddings.create.side_effect = mock_create

        # test with 300 inputs - will retry down to 256 minimum then fail
        test_inputs = [f"Input {i}" for i in range(300)]

        with pytest.raises(Exception, match="API error"):
            await client.request_embeddings(test_inputs, embedding_config)


class TestGoogleVertexClientEmbeddings:
    """Unit tests for GoogleVertexClient.request_embeddings() method.

    GoogleVertexClient uses Vertex AI authentication (project + location) rather than
    a Gemini API key, but the request_embeddings implementation is identical in structure.
    These tests verify that the Vertex path works correctly with the same edge cases.
    """

    @pytest.fixture
    def mock_user(self):
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.fixture
    def embedding_config(self):
        return EmbeddingConfig(
            embedding_endpoint_type="google_vertex",
            embedding_endpoint="https://us-central1-aiplatform.googleapis.com",
            embedding_model="text-embedding-005",
            embedding_dim=768,
        )

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_basic(self, mock_user, embedding_config):
        """Test GoogleVertexClient.request_embeddings returns correct structure."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 768
        mock_response = Mock()
        mock_response.embeddings = [mock_embedding]

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings(["test input"], embedding_config)

        assert len(embeddings) == 1
        assert len(embeddings[0]) == 768

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_batch_size_limit(self, mock_user, embedding_config):
        """Test that inputs are batched at 100 (Google AI limit also applies to Vertex)."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        api_call_sizes = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 768

        async def mock_embed_content(model, contents):
            api_call_sizes.append(len(contents))
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings([f"Input {i}" for i in range(250)], embedding_config)

        assert len(embeddings) == 250
        assert all(size <= 100 for size in api_call_sizes), f"Batch exceeded 100: {api_call_sizes}"
        assert len(api_call_sizes) >= 3  # 100 + 100 + 50

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_empty_string_handling(self, mock_user, embedding_config):
        """Test that empty strings are replaced with single space placeholder."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        contents_received = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 768

        async def mock_embed_content(model, contents):
            contents_received.extend(contents)
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            await client.request_embeddings(["", "  ", "valid text"], embedding_config)

        assert contents_received[0] == " "
        assert contents_received[1] == " "
        assert contents_received[2] == "valid text"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_empty_input_returns_empty(self, mock_user, embedding_config):
        """Test that empty input list returns empty list without making API calls."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock()
            mock_get_client.return_value = mock_genai_client

            result = await client.request_embeddings([], embedding_config)

        assert result == []
        mock_genai_client.aio.models.embed_content.assert_not_called()

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_non_string_raises_value_error(self, mock_user, embedding_config):
        """Test that non-string inputs raise ValueError."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_get_client.return_value = MagicMock()

            with pytest.raises(ValueError, match="not a string"):
                await client.request_embeddings([123], embedding_config)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_error_propagation(self, mock_user, embedding_config):
        """Test that API errors are propagated to the caller."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock(side_effect=Exception("Vertex AI quota exceeded"))
            mock_get_client.return_value = mock_genai_client

            with pytest.raises(Exception, match="Vertex AI quota exceeded"):
                await client.request_embeddings(["text"], embedding_config)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_correct_model_name(self, mock_user, embedding_config):
        """Test that the correct model name from embedding_config is passed to the Vertex API."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        called_with_model = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 768

        async def mock_embed_content(model, contents):
            called_with_model.append(model)
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            await client.request_embeddings(["hello"], embedding_config)

        assert len(called_with_model) >= 1
        assert called_with_model[0] == "text-embedding-005"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_order_preserved(self, mock_user, embedding_config):
        """Test that embedding order matches input order despite batching."""
        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        async def ordered_embed(model, contents):
            mock_response = Mock()
            mock_response.embeddings = []
            for text in contents:
                idx = int(text.split()[-1])
                mock_emb = Mock()
                mock_emb.values = [float(idx)] + [0.0] * 767
                mock_response.embeddings.append(mock_emb)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = ordered_embed
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings([f"Text {i}" for i in range(50)], embedding_config)

        assert len(embeddings) == 50
        for i in range(50):
            assert embeddings[i][0] == float(i), f"Order mismatch at index {i}"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_vertex_request_embeddings_parallel_gather(self, mock_user, embedding_config):
        """Test that multiple batches are dispatched concurrently via asyncio.gather."""
        import asyncio

        from letta.llm_api.google_vertex_client import GoogleVertexClient

        client = GoogleVertexClient(actor=mock_user)

        concurrent_calls = []

        async def slow_embed_content(model, contents):
            concurrent_calls.append(("start", len(contents)))
            await asyncio.sleep(0)  # yield to event loop so other tasks can start
            concurrent_calls.append(("end", len(contents)))
            mock_response = Mock()
            mock_embedding = Mock()
            mock_embedding.values = [0.1] * 768
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = slow_embed_content
            mock_get_client.return_value = mock_genai_client

            # 250 inputs → 3 batches (100, 100, 50), should be gathered in parallel
            embeddings = await client.request_embeddings([f"text {i}" for i in range(250)], embedding_config)

        assert len(embeddings) == 250
        # All batches started before any finished (interleaved = parallel)
        starts = [e for e in concurrent_calls if e[0] == "start"]
        assert len(starts) == 3


class TestGoogleAIClientEmbeddings:
    """Unit tests for GoogleAIClient.request_embeddings() method."""

    @pytest.fixture
    def mock_user(self):
        """Create a mock user for testing - avoids server dependency."""
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.fixture
    def embedding_config(self):
        return EmbeddingConfig(
            embedding_endpoint_type="google_ai",
            embedding_endpoint="https://generativelanguage.googleapis.com",
            embedding_model="gemini-embedding-001",
            embedding_dim=3072,
        )

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_basic(self, mock_user, embedding_config):
        """Test GoogleAIClient.request_embeddings returns correct structure."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 3072
        mock_response = Mock()
        mock_response.embeddings = [mock_embedding]

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings(["test input"], embedding_config)

        assert len(embeddings) == 1
        assert len(embeddings[0]) == 3072

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_batch_size_limit(self, mock_user, embedding_config):
        """Test that inputs are batched at 100 (Google AI limit)."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        api_call_sizes = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 3072

        async def mock_embed_content(model, contents):
            api_call_sizes.append(len(contents))
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings([f"Input {i}" for i in range(250)], embedding_config)

        assert len(embeddings) == 250
        assert all(size <= 100 for size in api_call_sizes), f"Batch exceeded 100: {api_call_sizes}"
        assert len(api_call_sizes) >= 3  # 100 + 100 + 50

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_empty_string_handling(self, mock_user, embedding_config):
        """Test that empty strings are replaced with single space."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        contents_received = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 3072

        async def mock_embed_content(model, contents):
            contents_received.extend(contents)
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            await client.request_embeddings(["", "  ", "valid text"], embedding_config)

        assert contents_received[0] == " "
        assert contents_received[1] == " "
        assert contents_received[2] == "valid text"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_order_preserved(self, mock_user, embedding_config):
        """Test that embedding order matches input order despite batching."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        async def ordered_embed(model, contents):
            mock_response = Mock()
            mock_response.embeddings = []
            for text in contents:
                idx = int(text.split()[-1])
                mock_emb = Mock()
                mock_emb.values = [float(idx)] + [0.0] * 3071
                mock_response.embeddings.append(mock_emb)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = ordered_embed
            mock_get_client.return_value = mock_genai_client

            embeddings = await client.request_embeddings([f"Text {i}" for i in range(50)], embedding_config)

        assert len(embeddings) == 50
        for i in range(50):
            assert embeddings[i][0] == float(i), f"Order mismatch at index {i}"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_error_propagation(self, mock_user, embedding_config):
        """Test that API errors are propagated to the caller."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock(side_effect=Exception("Google AI API quota exceeded"))
            mock_get_client.return_value = mock_genai_client

            with pytest.raises(Exception, match="Google AI API quota exceeded"):
                await client.request_embeddings(["text"], embedding_config)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_correct_model_name(self, mock_user, embedding_config):
        """Test that the correct model name from embedding_config is passed to the API."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        called_with_model = []
        mock_embedding = Mock()
        mock_embedding.values = [0.1] * 3072

        async def mock_embed_content(model, contents):
            called_with_model.append(model)
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = mock_embed_content
            mock_get_client.return_value = mock_genai_client

            await client.request_embeddings(["hello"], embedding_config)

        assert len(called_with_model) >= 1
        assert called_with_model[0] == "gemini-embedding-001"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_empty_input_returns_empty(self, mock_user, embedding_config):
        """Test that empty input list returns empty list without making API calls."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = AsyncMock()
            mock_get_client.return_value = mock_genai_client

            result = await client.request_embeddings([], embedding_config)

        assert result == []
        mock_genai_client.aio.models.embed_content.assert_not_called()

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_non_string_raises_value_error(self, mock_user, embedding_config):
        """Test that non-string inputs raise ValueError."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        with patch.object(client, "_get_client") as mock_get_client:
            mock_get_client.return_value = MagicMock()

            with pytest.raises(ValueError, match="not a string"):
                await client.request_embeddings([123], embedding_config)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_google_ai_request_embeddings_parallel_gather(self, mock_user, embedding_config):
        """Test that multiple batches are dispatched concurrently via asyncio.gather."""
        from letta.llm_api.google_ai_client import GoogleAIClient

        client = GoogleAIClient(actor=mock_user)

        concurrent_calls = []
        import asyncio

        async def slow_embed_content(model, contents):
            concurrent_calls.append(("start", len(contents)))
            await asyncio.sleep(0)  # yield to event loop so other tasks can start
            concurrent_calls.append(("end", len(contents)))
            mock_response = Mock()
            mock_embedding = Mock()
            mock_embedding.values = [0.1] * 3072
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        with patch.object(client, "_get_client") as mock_get_client:
            mock_genai_client = MagicMock()
            mock_genai_client.aio.models.embed_content = slow_embed_content
            mock_get_client.return_value = mock_genai_client

            # 250 inputs → 3 batches (100, 100, 50), should be gathered in parallel
            embeddings = await client.request_embeddings([f"text {i}" for i in range(250)], embedding_config)

        assert len(embeddings) == 250
        # All batches started before any finished (interleaved = parallel)
        starts = [e for e in concurrent_calls if e[0] == "start"]
        assert len(starts) == 3
