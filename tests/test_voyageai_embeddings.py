"""Unit and integration tests for VoyageAI embeddings."""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from letta.llm_api.voyageai_client import (
    DEFAULT_BATCH_SIZE,
    VOYAGE_TOTAL_TOKEN_LIMITS,
    get_token_limit,
    is_contextual_model,
    is_multimodal_model,
    voyageai_count_tokens_async,
    voyageai_get_embeddings_async,
    voyageai_multimodal_get_embeddings_async,
)
from letta.schemas.embedding_config import EmbeddingConfig
from letta.services.file_processor.embedder.voyageai_embedder import VoyageAIEmbedder
from letta.settings import model_settings


class TestVoyageAIClientHelpers:
    """Test suite for VoyageAI client helper functions."""

    def test_is_contextual_model(self):
        """Test contextual model detection."""
        assert is_contextual_model("voyage-context-3") is True
        assert is_contextual_model("voyage-3") is False
        assert is_contextual_model("voyage-multimodal-3") is False
        assert is_contextual_model("voyage-multimodal-3.5") is False

    def test_is_multimodal_model(self):
        """Test multimodal model detection."""
        assert is_multimodal_model("voyage-multimodal-3") is True
        assert is_multimodal_model("voyage-multimodal-3.5") is True
        assert is_multimodal_model("voyage-3") is False
        assert is_multimodal_model("voyage-context-3") is False

    def test_get_token_limit(self):
        """Test token limit retrieval."""
        assert get_token_limit("voyage-context-3") == 32_000
        assert get_token_limit("voyage-3.5-lite") == 1_000_000
        assert get_token_limit("voyage-3") == 120_000
        assert get_token_limit("voyage-multimodal-3") == 32_000
        assert get_token_limit("voyage-multimodal-3.5") == 32_000
        assert get_token_limit("unknown-model") == 120_000  # default


class TestVoyageAIClientFunctions:
    """Test suite for VoyageAI client API functions."""

    @pytest.fixture
    def embedding_config(self):
        """Create a test embedding config."""
        return EmbeddingConfig(
            embedding_model="voyage-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=120,
        )

    @pytest.fixture
    def contextual_embedding_config(self):
        """Create a test contextual embedding config."""
        return EmbeddingConfig(
            embedding_model="voyage-context-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=3,
            batch_size=32,
        )

    @pytest.fixture
    def multimodal_embedding_config(self):
        """Create a test multimodal embedding config."""
        return EmbeddingConfig(
            embedding_model="voyage-multimodal-3.5",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=100,
        )

    @pytest.mark.asyncio
    async def test_voyageai_get_embeddings_regular_model(self, embedding_config):
        """Test regular embeddings API call."""
        with patch("voyageai.AsyncClient") as mock_client_class:
            # Mock client and response
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client

            mock_result = Mock()
            mock_result.embeddings = [[0.1, 0.2], [0.3, 0.4]]
            mock_client.embed.return_value = mock_result

            texts = ["text 1", "text 2"]
            embeddings = await voyageai_get_embeddings_async(
                texts=texts, embedding_config=embedding_config, api_key="test_key"
            )

            assert len(embeddings) == 2
            assert embeddings[0] == [0.1, 0.2]
            assert embeddings[1] == [0.3, 0.4]

            # Verify embed was called with correct params
            mock_client.embed.assert_called_once()
            call_kwargs = mock_client.embed.call_args[1]
            assert call_kwargs["texts"] == texts
            assert call_kwargs["model"] == "voyage-3"
            assert call_kwargs["truncation"] is True

    @pytest.mark.asyncio
    async def test_voyageai_get_embeddings_contextual_model(self, contextual_embedding_config):
        """Test contextual embeddings API call."""
        with patch("voyageai.AsyncClient") as mock_client_class:
            # Mock client and response
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client

            mock_result = Mock()
            mock_result.results = [Mock(embeddings=[[0.1, 0.2], [0.3, 0.4]])]
            mock_client.contextualized_embed.return_value = mock_result

            texts = ["chunk 1", "chunk 2"]
            embeddings = await voyageai_get_embeddings_async(
                texts=texts, embedding_config=contextual_embedding_config, api_key="test_key"
            )

            assert len(embeddings) == 2
            assert embeddings[0] == [0.1, 0.2]
            assert embeddings[1] == [0.3, 0.4]

            # Verify contextualized_embed was called
            mock_client.contextualized_embed.assert_called_once()
            call_kwargs = mock_client.contextualized_embed.call_args[1]
            assert call_kwargs["inputs"] == [texts]  # wrapped in list for contextualized
            assert call_kwargs["model"] == "voyage-context-3"

    @pytest.mark.asyncio
    async def test_voyageai_multimodal_get_embeddings(self, embedding_config):
        """Test multimodal embeddings API call."""
        with patch("voyageai.AsyncClient") as mock_client_class:
            # Mock client and response
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client

            mock_result = Mock()
            mock_result.embeddings = [[0.1, 0.2], [0.3, 0.4]]
            mock_client.multimodal_embed.return_value = mock_result

            inputs = ["text input", {"image": "base64_data"}]
            embeddings = await voyageai_multimodal_get_embeddings_async(
                inputs=inputs, embedding_config=embedding_config, api_key="test_key"
            )

            assert len(embeddings) == 2
            assert embeddings[0] == [0.1, 0.2]
            assert embeddings[1] == [0.3, 0.4]

            # Verify multimodal_embed was called
            mock_client.multimodal_embed.assert_called_once()
            call_kwargs = mock_client.multimodal_embed.call_args[1]
            assert call_kwargs["inputs"] == inputs

    @pytest.mark.asyncio
    async def test_voyageai_multimodal_get_embeddings_with_output_dimension(self, multimodal_embedding_config):
        """Test multimodal embeddings API call with custom output dimension."""
        with patch("voyageai.AsyncClient") as mock_client_class:
            # Mock client and response
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client

            # Return embeddings with custom dimension (512)
            mock_result = Mock()
            mock_result.embeddings = [[0.1] * 512, [0.2] * 512]
            mock_client.multimodal_embed.return_value = mock_result

            inputs = ["text input", {"content": [{"type": "image", "image_base64": "base64_data"}]}]
            embeddings = await voyageai_multimodal_get_embeddings_async(
                inputs=inputs,
                embedding_config=multimodal_embedding_config,
                api_key="test_key",
                output_dimension=512,
            )

            assert len(embeddings) == 2
            assert len(embeddings[0]) == 512
            assert len(embeddings[1]) == 512

            # Verify multimodal_embed was called with output_dimension
            mock_client.multimodal_embed.assert_called_once()
            call_kwargs = mock_client.multimodal_embed.call_args[1]
            assert call_kwargs["output_dimension"] == 512

    @pytest.mark.asyncio
    async def test_voyageai_count_tokens(self):
        """Test token counting API call."""
        with patch("voyageai.AsyncClient") as mock_client_class:
            # Mock client - use regular Mock since tokenize is synchronous
            mock_client = Mock()
            mock_client_class.return_value = mock_client

            # Mock tokenize returns list of token lists (synchronous method)
            mock_client.tokenize.return_value = [[1, 2, 3], [4, 5, 6, 7], [8, 9]]

            texts = ["short text", "longer text here", "ok"]
            token_counts = await voyageai_count_tokens_async(texts=texts, model="voyage-3", api_key="test_key")

            assert token_counts == [3, 4, 2]

            # Verify tokenize was called
            mock_client.tokenize.assert_called_once_with(texts, model="voyage-3")


class TestVoyageAIEmbedder:
    """Test suite for VoyageAI embedder with token-based batching."""

    @pytest.fixture
    def mock_user(self):
        """Create a mock user for testing."""
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.fixture
    def embedding_config(self):
        """Create a test embedding config."""
        return EmbeddingConfig(
            embedding_model="voyage-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=5,  # small batch for testing
        )

    @pytest.fixture
    def embedder(self, embedding_config):
        """Create VoyageAI embedder with test config."""
        with patch("letta.services.file_processor.embedder.voyageai_embedder.model_settings") as mock_settings:
            mock_settings.voyageai_api_key = "test_api_key"
            return VoyageAIEmbedder(embedding_config)

    def test_build_batches_respects_item_limit(self, embedder):
        """Test that batching respects maximum items per batch."""
        texts = [f"text {i}" for i in range(12)]
        token_counts = [10] * 12  # all texts have 10 tokens

        batches = list(embedder._build_batches(texts, token_counts))

        # With batch_size=5, should create 3 batches: [5, 5, 2]
        assert len(batches) == 3
        assert len(batches[0][0]) == 5
        assert len(batches[1][0]) == 5
        assert len(batches[2][0]) == 2

    def test_build_batches_respects_token_limit(self, embedder):
        """Test that batching respects token limits."""
        # voyage-3 has 120,000 token limit
        # Create texts that would exceed limit if batched together
        texts = [f"text {i}" for i in range(5)]
        token_counts = [30_000, 30_000, 30_000, 30_000, 30_000]  # 150k total

        batches = list(embedder._build_batches(texts, token_counts))

        # Should split into multiple batches to respect 120k limit
        # Batch 1: 30k + 30k + 30k + 30k = 120k (4 items)
        # Batch 2: 30k (1 item)
        assert len(batches) == 2
        assert len(batches[0][0]) == 4
        assert len(batches[1][0]) == 1

    def test_build_batches_respects_both_limits(self, embedder):
        """Test that batching respects both item and token limits."""
        texts = [f"text {i}" for i in range(10)]
        # Mix of token counts - some high, some low
        token_counts = [50_000, 10, 10, 50_000, 10, 10, 50_000, 10, 10, 10]

        batches = list(embedder._build_batches(texts, token_counts))

        # Should respect both 5-item limit and 120k token limit
        for batch_texts, batch_indices in batches:
            assert len(batch_texts) <= 5  # item limit
            batch_token_count = sum(token_counts[i] for i in batch_indices)
            assert batch_token_count <= 120_000  # token limit

    def test_build_batches_maintains_order(self, embedder):
        """Test that batching maintains original order via indices."""
        texts = [f"text {i}" for i in range(10)]
        token_counts = [10] * 10

        all_indices = []
        for _, batch_indices in embedder._build_batches(texts, token_counts):
            all_indices.extend(batch_indices)

        assert all_indices == list(range(10))

    @pytest.mark.asyncio
    async def test_embed_batch_success(self, embedder, mock_user):
        """Test successful embedding of a single batch."""
        with patch("letta.services.file_processor.embedder.voyageai_embedder.voyageai_get_embeddings_async") as mock_embed:
            mock_embed.return_value = [[0.1] * 1024, [0.2] * 1024]

            batch = ["text 1", "text 2"]
            batch_indices = [0, 1]

            result = await embedder._embed_batch(batch, batch_indices)

            assert len(result) == 2
            assert result[0] == (0, [0.1] * 1024)
            assert result[1] == (1, [0.2] * 1024)

    @pytest.mark.asyncio
    async def test_generate_embedded_passages(self, embedder, mock_user):
        """Test full passage generation with token-based batching."""
        chunks = [f"chunk {i}" for i in range(10)]

        with patch(
            "letta.services.file_processor.embedder.voyageai_embedder.voyageai_count_tokens_async"
        ) as mock_count, patch(
            "letta.services.file_processor.embedder.voyageai_embedder.voyageai_get_embeddings_async"
        ) as mock_embed:
            # Mock token counting
            mock_count.return_value = [100] * 10

            # Mock embeddings - return different embeddings for each batch
            async def mock_embed_fn(texts, **kwargs):
                return [[float(i)] * 1024 for i in range(len(texts))]

            mock_embed.side_effect = mock_embed_fn

            passages = await embedder.generate_embedded_passages(
                file_id="test_file", source_id="test_source", chunks=chunks, actor=mock_user
            )

            assert len(passages) == 10
            for i, passage in enumerate(passages):
                assert passage.text == f"chunk {i}"
                assert passage.file_id == "test_file"
                assert passage.source_id == "test_source"
                assert passage.organization_id == "test_org_id"
                assert len(passage.embedding) == 1024

    @pytest.mark.asyncio
    async def test_empty_chunks(self, embedder, mock_user):
        """Test handling of empty chunk list."""
        passages = await embedder.generate_embedded_passages(
            file_id="test_file", source_id="test_source", chunks=[], actor=mock_user
        )

        assert passages == []


# Integration tests (require actual API key)
@pytest.mark.skipif(model_settings.voyageai_api_key is None, reason="VOYAGEAI_API_KEY not set")
class TestVoyageAIIntegration:
    """Integration tests for VoyageAI embeddings (requires API key)."""

    @pytest.fixture
    def mock_user(self):
        """Create a mock user for testing."""
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.mark.asyncio
    async def test_real_embeddings_voyage_3(self):
        """Test real API call with voyage-3 model."""
        config = EmbeddingConfig(
            embedding_model="voyage-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=120,
        )

        texts = ["This is a test sentence.", "Another test sentence for embeddings."]
        embeddings = await voyageai_get_embeddings_async(
            texts=texts, embedding_config=config, api_key=model_settings.voyageai_api_key
        )

        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1024
        assert len(embeddings[1]) == 1024
        assert all(isinstance(x, float) for x in embeddings[0])

    @pytest.mark.asyncio
    async def test_real_embeddings_voyage_context_3(self):
        """Test real API call with voyage-context-3 contextual model."""
        config = EmbeddingConfig(
            embedding_model="voyage-context-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=3,
            batch_size=32,
        )

        texts = ["This is chunk 1.", "This is chunk 2.", "This is chunk 3."]
        embeddings = await voyageai_get_embeddings_async(
            texts=texts, embedding_config=config, api_key=model_settings.voyageai_api_key
        )

        assert len(embeddings) == 3
        assert len(embeddings[0]) == 1024
        assert all(isinstance(x, float) for x in embeddings[0])

    @pytest.mark.asyncio
    async def test_real_token_counting(self):
        """Test real token counting API."""
        texts = ["Short text.", "A longer text with more words and tokens.", "Medium length."]
        token_counts = await voyageai_count_tokens_async(
            texts=texts, model="voyage-3", api_key=model_settings.voyageai_api_key
        )

        assert len(token_counts) == 3
        assert all(isinstance(count, int) for count in token_counts)
        assert token_counts[1] > token_counts[0]  # longer text should have more tokens

    @pytest.mark.asyncio
    async def test_real_embedder_end_to_end(self, mock_user):
        """Test real end-to-end embedding generation with VoyageAI embedder."""
        config = EmbeddingConfig(
            embedding_model="voyage-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=120,
        )

        # VoyageAIEmbedder reads from model_settings which should have the API key
        # since we're in the Integration test class that requires VOYAGEAI_API_KEY
        embedder = VoyageAIEmbedder(config)

        chunks = [
            "Machine learning is a subset of artificial intelligence.",
            "Neural networks are inspired by biological neural networks.",
            "Deep learning uses multiple layers to learn representations.",
        ]

        passages = await embedder.generate_embedded_passages(
            file_id="test_file", source_id="test_source", chunks=chunks, actor=mock_user
        )

        assert len(passages) == 3
        for i, passage in enumerate(passages):
            assert passage.text == chunks[i]
            assert len(passage.embedding) == 1024  # Native model dimension (padding to 4096 only with Postgres)
            assert any(passage.embedding[j] != 0 for j in range(1024))
            assert passage.file_id == "test_file"
            assert passage.source_id == "test_source"

    @pytest.mark.asyncio
    async def test_real_large_batch_token_optimization(self, mock_user):
        """Test token-based batching with a larger set of texts."""
        config = EmbeddingConfig(
            embedding_model="voyage-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=1000,  # large batch size
        )

        # VoyageAIEmbedder reads from model_settings which should have the API key
        embedder = VoyageAIEmbedder(config)

        # Create 50 chunks of varying lengths
        chunks = [f"This is test chunk number {i}. " * (i % 10 + 1) for i in range(50)]

        passages = await embedder.generate_embedded_passages(
            file_id="test_file", source_id="test_source", chunks=chunks, actor=mock_user
        )

        assert len(passages) == 50
        for passage in passages:
            assert len(passage.embedding) == 1024  # Native model dimension (padding to 4096 only with Postgres)
            assert passage.file_id == "test_file"

    @pytest.mark.asyncio
    async def test_real_multimodal_embeddings_voyage_multimodal_3(self):
        """Test real API call with voyage-multimodal-3 model (text only)."""
        config = EmbeddingConfig(
            embedding_model="voyage-multimodal-3",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=100,
        )

        # Multimodal inputs must be list-of-lists format
        inputs = [
            ["A photo of a cat sitting on a couch."],
            ["An image showing a mountain landscape at sunset."],
        ]
        embeddings = await voyageai_multimodal_get_embeddings_async(
            inputs=inputs,
            embedding_config=config,
            api_key=model_settings.voyageai_api_key,
        )

        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1024
        assert len(embeddings[1]) == 1024
        assert all(isinstance(x, float) for x in embeddings[0])

    @pytest.mark.asyncio
    async def test_real_multimodal_embeddings_voyage_multimodal_3_5(self):
        """Test real API call with voyage-multimodal-3.5 model (text only)."""
        config = EmbeddingConfig(
            embedding_model="voyage-multimodal-3.5",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=100,
        )

        # Multimodal inputs must be list-of-lists format
        inputs = [
            ["A photo of a cat sitting on a couch."],
            ["An image showing a mountain landscape at sunset."],
        ]
        embeddings = await voyageai_multimodal_get_embeddings_async(
            inputs=inputs,
            embedding_config=config,
            api_key=model_settings.voyageai_api_key,
        )

        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1024
        assert len(embeddings[1]) == 1024
        assert all(isinstance(x, float) for x in embeddings[0])

    @pytest.mark.asyncio
    async def test_real_multimodal_embeddings_flexible_output_dimension(self):
        """Test voyage-multimodal-3.5 with flexible output dimensions (256, 512, 1024, 2048)."""
        config = EmbeddingConfig(
            embedding_model="voyage-multimodal-3.5",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,  # Default, but we'll override with output_dimension
            embedding_chunk_size=10,
            batch_size=100,
        )

        # Multimodal inputs must be list-of-lists format
        inputs = [["A test sentence for dimension testing."]]

        # Test different output dimensions supported by voyage-multimodal-3.5
        for dim in [256, 512, 1024, 2048]:
            embeddings = await voyageai_multimodal_get_embeddings_async(
                inputs=inputs,
                embedding_config=config,
                api_key=model_settings.voyageai_api_key,
                output_dimension=dim,
            )

            assert len(embeddings) == 1
            assert len(embeddings[0]) == dim, f"Expected dimension {dim}, got {len(embeddings[0])}"
            assert all(isinstance(x, float) for x in embeddings[0])

    @pytest.mark.asyncio
    async def test_real_multimodal_3_5_token_limit(self):
        """Test that voyage-multimodal-3.5 respects its 32k token limit."""
        # Verify token limit is configured correctly
        assert get_token_limit("voyage-multimodal-3.5") == 32_000
        assert get_token_limit("voyage-multimodal-3") == 32_000

        config = EmbeddingConfig(
            embedding_model="voyage-multimodal-3.5",
            embedding_endpoint_type="voyageai",
            embedding_endpoint="https://api.voyageai.com/v1",
            embedding_dim=1024,
            embedding_chunk_size=10,
            batch_size=100,
        )

        # Multimodal inputs must be list-of-lists format
        inputs = [[f"Test input number {i} for batching verification."] for i in range(10)]
        embeddings = await voyageai_multimodal_get_embeddings_async(
            inputs=inputs,
            embedding_config=config,
            api_key=model_settings.voyageai_api_key,
        )

        assert len(embeddings) == 10
        for emb in embeddings:
            assert len(emb) == 1024
