"""
Unit tests for GoogleAIEmbedder.

Mirrors test_file_processor.py::TestOpenAIEmbedder pattern.
All tests mock the Google AI API - no API key needed.

Markers:
  @pytest.mark.unit
  @pytest.mark.google
"""

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from letta.schemas.embedding_config import EmbeddingConfig
from letta.services.file_processor.embedder.google_ai_embedder import GoogleAIEmbedder


class TestGoogleAIEmbedder:
    """Test suite for GoogleAIEmbedder - mirrors TestOpenAIEmbedder pattern."""

    @pytest.fixture
    def mock_user(self):
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.fixture
    def embedding_config(self):
        return EmbeddingConfig(
            embedding_model="gemini-embedding-001",
            embedding_endpoint_type="google_ai",
            embedding_endpoint="https://generativelanguage.googleapis.com",
            embedding_dim=3072,
            embedding_chunk_size=300,
            batch_size=2,
        )

    @pytest.fixture
    def embedder(self, embedding_config):
        with patch("letta.services.file_processor.embedder.google_ai_embedder.genai.Client"):
            return GoogleAIEmbedder(embedding_config=embedding_config)

    # --- Core functionality ---

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_successful_embedding_generation(self, embedder, mock_user):
        """Test successful embedding generation returns correct Passage objects."""
        with patch.object(embedder, "_embed_batch", new=AsyncMock(return_value=[(0, [0.1, 0.2, 0.3]), (1, [0.4, 0.5, 0.6])])):
            passages = await embedder.generate_embedded_passages("test_file", "test_source", ["chunk 1", "chunk 2"], mock_user)

        assert len(passages) == 2
        assert passages[0].text == "chunk 1"
        assert passages[1].text == "chunk 2"
        assert passages[0].embedding == [0.1, 0.2, 0.3]
        assert passages[1].embedding == [0.4, 0.5, 0.6]
        assert passages[0].file_id == "test_file"
        assert passages[0].source_id == "test_source"
        assert passages[0].organization_id == "test_org_id"

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_empty_chunks_returns_empty_list(self, embedder, mock_user):
        """Test that empty chunk list returns empty passages without API call."""
        passages = await embedder.generate_embedded_passages("file_id", "source_id", [], mock_user)
        assert passages == []

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_whitespace_only_chunks_filtered(self, embedder, mock_user):
        """Test that whitespace-only chunks are filtered out."""
        passages = await embedder.generate_embedded_passages("file_id", "source_id", ["   ", "\n", "\t"], mock_user)
        assert passages == []

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_mixed_valid_and_empty_chunks(self, embedder, mock_user):
        """Test that empty chunks are filtered while valid ones are processed."""
        with patch.object(embedder, "_embed_batch", new=AsyncMock(return_value=[(0, [0.1, 0.2, 0.3])])):
            passages = await embedder.generate_embedded_passages("file_id", "source_id", ["valid chunk", "   "], mock_user)
        assert len(passages) == 1
        assert passages[0].text == "valid chunk"

    # --- Batch splitting retry logic ---

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_batch_split_retry_on_failure(self, embedder, mock_user):
        """Test that _embed_batch failures trigger recursive halving retry.

        The retry logic lives inside _embed_batch (recursive halving on error).
        We verify this by mocking the underlying API client:
        - First call (large batch) fails
        - Subsequent calls (half-size batches) succeed
        """
        # Use a batch_size of 4 so we get one big batch, then halving produces 2+2
        embedder.embedding_config.batch_size = 100
        api_call_sizes = []

        mock_embedding = Mock()
        mock_embedding.values = [0.1, 0.2]

        async def mock_embed_content(model, contents):
            api_call_sizes.append(len(contents))
            # Fail only the first call (size 4), succeed for smaller batches
            if len(api_call_sizes) == 1 and len(contents) > 2:
                raise Exception("Google AI API rate limit")
            mock_response = Mock()
            mock_response.embeddings = [mock_embedding] * len(contents)
            return mock_response

        mock_client = MagicMock()
        mock_client.aio.models.embed_content = mock_embed_content

        with patch.object(embedder, "_get_client", return_value=mock_client):
            passages = await embedder.generate_embedded_passages(
                "file_id", "source_id", ["chunk 1", "chunk 2", "chunk 3", "chunk 4"], mock_user
            )

        assert len(passages) == 4
        assert len(api_call_sizes) > 1  # verifies retry occurred (multiple API calls)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_single_item_batch_no_retry_raises(self, embedder, mock_user):
        """Test that single-item batch failure raises (no further splitting possible)."""

        async def always_fail(batch, indices):
            raise Exception("Persistent Google AI error")

        with patch.object(embedder, "_embed_batch", side_effect=always_fail):
            with pytest.raises(Exception, match="Persistent Google AI error"):
                await embedder.generate_embedded_passages("file_id", "source_id", ["single chunk"], mock_user)

    # --- Embed batch internals ---

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_embed_batch_sanitizes_empty_strings(self, embedder):
        """Test that _embed_batch replaces empty strings with single space."""
        captured_contents = []

        mock_embedding = Mock()
        mock_embedding.values = [0.1, 0.2]
        mock_response = Mock()
        mock_response.embeddings = [mock_embedding, mock_embedding]

        async def mock_embed_content(model, contents):
            captured_contents.extend(contents)
            return mock_response

        mock_client = MagicMock()
        mock_client.aio.models.embed_content = mock_embed_content

        with patch.object(embedder, "_get_client", return_value=mock_client):
            await embedder._embed_batch(["", "  "], [0, 1])

        assert all(c == " " for c in captured_contents)

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_embed_batch_uses_correct_model(self, embedder):
        """Test that _embed_batch uses the model from embedding_config."""
        called_with_model = []

        mock_embedding = Mock()
        mock_embedding.values = [0.1]
        mock_response = Mock()
        mock_response.embeddings = [mock_embedding]

        async def mock_embed_content(model, contents):
            called_with_model.append(model)
            return mock_response

        mock_client = MagicMock()
        mock_client.aio.models.embed_content = mock_embed_content

        with patch.object(embedder, "_get_client", return_value=mock_client):
            await embedder._embed_batch(["test text"], [0])

        assert called_with_model[0] == "gemini-embedding-001"

    # --- Order preservation ---

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_embedding_order_preserved_across_batches(self, embedder, mock_user):
        """Test that embedding order matches chunk order even with multiple batches."""
        embedder.embedding_config.batch_size = 2

        async def ordered_mock_embed(batch, indices):
            return [(idx, [float(idx), 0.0]) for idx in indices]

        with patch.object(embedder, "_embed_batch", new=AsyncMock(side_effect=ordered_mock_embed)):
            chunks = ["chunk 0", "chunk 1", "chunk 2", "chunk 3"]
            passages = await embedder.generate_embedded_passages("file_id", "source_id", chunks, mock_user)

        assert len(passages) == 4
        for i, passage in enumerate(passages):
            assert passage.embedding[0] == float(i), f"Passage {i} has wrong embedding order"

    # --- Passage metadata ---

    @pytest.mark.asyncio
    @pytest.mark.unit
    @pytest.mark.google
    async def test_passages_contain_correct_metadata(self, embedder, mock_user):
        """Test that created Passage objects have correct file_id, source_id, org_id."""
        with patch.object(embedder, "_embed_batch", new=AsyncMock(return_value=[(0, [0.5, 0.6, 0.7])])):
            passages = await embedder.generate_embedded_passages("file-abc123", "source-xyz789", ["some text"], mock_user)

        assert passages[0].file_id == "file-abc123"
        assert passages[0].source_id == "source-xyz789"
        assert passages[0].organization_id == mock_user.organization_id
        assert passages[0].embedding_config == embedder.embedding_config


class TestGoogleAIEmbedderConfig:
    """Test GoogleAIEmbedder configuration and initialization."""

    @pytest.mark.unit
    @pytest.mark.google
    def test_default_config_uses_gemini_embedding_001(self):
        """Test that default config uses gemini-embedding-001 model."""
        with patch("letta.services.file_processor.embedder.google_ai_embedder.model_settings") as mock_settings:
            mock_settings.gemini_api_key = "test_key"
            with patch("letta.services.file_processor.embedder.google_ai_embedder.EmbeddingConfig") as mock_config_class:
                mock_config = Mock()
                mock_config.embedding_model = "gemini-embedding-001"
                mock_config.embedding_endpoint_type = "google_ai"
                mock_config_class.default_config.return_value = mock_config
                embedder = GoogleAIEmbedder()
        assert embedder.embedding_config.embedding_model == "gemini-embedding-001"
        assert embedder.embedding_config.embedding_endpoint_type == "google_ai"

    @pytest.mark.unit
    @pytest.mark.google
    def test_custom_config_is_used(self):
        """Test that provided embedding_config overrides default."""
        custom_config = EmbeddingConfig(
            embedding_model="text-embedding-004",
            embedding_endpoint_type="google_ai",
            embedding_endpoint="https://generativelanguage.googleapis.com",
            embedding_dim=768,
        )
        embedder = GoogleAIEmbedder(embedding_config=custom_config)
        assert embedder.embedding_config.embedding_model == "text-embedding-004"
        assert embedder.embedding_config.embedding_dim == 768

    @pytest.mark.unit
    @pytest.mark.google
    def test_get_client_uses_gemini_api_key(self):
        """Test that _get_client creates genai.Client with the API key from model_settings."""
        custom_config = EmbeddingConfig(
            embedding_model="gemini-embedding-001",
            embedding_endpoint_type="google_ai",
            embedding_endpoint="https://generativelanguage.googleapis.com",
            embedding_dim=3072,
        )
        embedder = GoogleAIEmbedder(embedding_config=custom_config)

        with (
            patch("letta.services.file_processor.embedder.google_ai_embedder.genai.Client") as mock_client_class,
            patch("letta.services.file_processor.embedder.google_ai_embedder.model_settings") as mock_model_settings,
            patch("letta.services.file_processor.embedder.google_ai_embedder.settings") as mock_settings,
        ):
            mock_model_settings.gemini_api_key = "test-api-key-123"
            mock_settings.llm_request_timeout_seconds = 30
            mock_client_class.return_value = MagicMock()

            embedder._get_client()

        mock_client_class.assert_called_once()
        call_kwargs = mock_client_class.call_args
        assert call_kwargs.kwargs.get("api_key") == "test-api-key-123"


class TestGoogleAIEmbedderRouting:
    """Test that embedding_endpoint_type == 'google_ai' routes to GoogleAIEmbedder."""

    @pytest.mark.unit
    @pytest.mark.google
    def test_sources_load_file_uses_google_ai_embedder_when_configured(self):
        """Test that load_file_to_source_cloud instantiates GoogleAIEmbedder for google_ai endpoint type."""
        from letta.server.rest_api.routers.v1.sources import load_file_to_source_cloud

        google_ai_config = EmbeddingConfig(
            embedding_model="gemini-embedding-001",
            embedding_endpoint_type="google_ai",
            embedding_endpoint="https://generativelanguage.googleapis.com",
            embedding_dim=3072,
        )

        mock_file_metadata = Mock()
        mock_file_metadata.file_name = "test.txt"

        with (
            patch("letta.server.rest_api.routers.v1.sources.should_use_tpuf", return_value=False),
            patch("letta.server.rest_api.routers.v1.sources.should_use_pinecone", return_value=False),
            patch("letta.server.rest_api.routers.v1.sources.GoogleAIEmbedder") as mock_embedder_class,
            patch("letta.server.rest_api.routers.v1.sources.FileProcessor") as mock_file_processor_class,
            patch("letta.server.rest_api.routers.v1.sources.settings") as mock_settings,
        ):
            mock_settings.mistral_api_key = None
            mock_embedder_instance = Mock()
            mock_embedder_class.return_value = mock_embedder_instance
            mock_processor_instance = AsyncMock()
            mock_processor_instance.process = AsyncMock()
            mock_file_processor_class.return_value = mock_processor_instance

            import asyncio

            asyncio.run(
                load_file_to_source_cloud(
                    server=Mock(),
                    agent_states=[],
                    content=b"test content",
                    source_id="source-123",
                    actor=Mock(),
                    embedding_config=google_ai_config,
                    file_metadata=mock_file_metadata,
                )
            )

        mock_embedder_class.assert_called_once_with(embedding_config=google_ai_config)

    @pytest.mark.unit
    @pytest.mark.google
    def test_sources_load_file_uses_openai_embedder_by_default(self):
        """Test that load_file_to_source_cloud falls back to OpenAIEmbedder when not google_ai."""
        from letta.server.rest_api.routers.v1.sources import load_file_to_source_cloud

        openai_config = EmbeddingConfig(
            embedding_model="text-embedding-3-small",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,
        )

        with (
            patch("letta.server.rest_api.routers.v1.sources.should_use_tpuf", return_value=False),
            patch("letta.server.rest_api.routers.v1.sources.should_use_pinecone", return_value=False),
            patch("letta.server.rest_api.routers.v1.sources.OpenAIEmbedder") as mock_openai_class,
            patch("letta.server.rest_api.routers.v1.sources.GoogleAIEmbedder") as mock_google_class,
            patch("letta.server.rest_api.routers.v1.sources.FileProcessor") as mock_file_processor_class,
            patch("letta.server.rest_api.routers.v1.sources.settings") as mock_settings,
        ):
            mock_settings.mistral_api_key = None
            mock_openai_class.return_value = Mock()
            mock_processor_instance = AsyncMock()
            mock_processor_instance.process = AsyncMock()
            mock_file_processor_class.return_value = mock_processor_instance

            import asyncio

            asyncio.run(
                load_file_to_source_cloud(
                    server=Mock(),
                    agent_states=[],
                    content=b"test content",
                    source_id="source-123",
                    actor=Mock(),
                    embedding_config=openai_config,
                    file_metadata=Mock(),
                )
            )

        mock_google_class.assert_not_called()
        mock_openai_class.assert_called_once_with(embedding_config=openai_config)
