from unittest.mock import AsyncMock, Mock, patch

import openai
import pytest

from letta.errors import ErrorCode, LLMBadRequestError
from letta.schemas.embedding_config import EmbeddingConfig
from letta.services.file_processor.embedder.openai_embedder import OpenAIEmbedder


class TestOpenAIEmbedder:
    """Test suite for OpenAI embedder functionality"""

    @pytest.fixture
    def mock_user(self):
        """Create a mock user for testing"""
        user = Mock()
        user.organization_id = "test_org_id"
        return user

    @pytest.fixture
    def embedding_config(self):
        """Create a test embedding config"""
        return EmbeddingConfig(
            embedding_model="text-embedding-3-small",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=3,  # small dimension for testing
            embedding_chunk_size=300,
            batch_size=2,  # small batch size for testing
        )

    @pytest.fixture
    def embedder(self, embedding_config):
        """Create OpenAI embedder with test config"""
        with patch("letta.services.file_processor.embedder.openai_embedder.LLMClient.create") as mock_create:
            mock_client = Mock()
            mock_client.handle_llm_error = Mock()
            mock_create.return_value = mock_client

            embedder = OpenAIEmbedder(embedding_config)
            embedder.client = mock_client
            return embedder

    @pytest.mark.asyncio
    async def test_successful_embedding_generation(self, embedder, mock_user):
        """Test successful embedding generation for normal cases"""
        # mock successful embedding response
        mock_embeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        embedder.client.request_embeddings = AsyncMock(return_value=mock_embeddings)

        chunks = ["chunk 1", "chunk 2"]
        file_id = "test_file"
        source_id = "test_source"

        passages = await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        assert len(passages) == 2
        assert passages[0].text == "chunk 1"
        assert passages[1].text == "chunk 2"
        # embeddings are padded to MAX_EMBEDDING_DIM, so check first 3 values
        assert passages[0].embedding[:3] == [0.1, 0.2, 0.3]
        assert passages[1].embedding[:3] == [0.4, 0.5, 0.6]
        assert passages[0].file_id == file_id
        assert passages[0].source_id == source_id

    @pytest.mark.asyncio
    async def test_token_limit_retry_splits_batch(self, embedder, mock_user):
        """Test that token limit errors trigger batch splitting and retry"""
        # create a mock token limit error
        mock_error_body = {"error": {"code": "max_tokens_per_request", "message": "Requested 319270 tokens, max 300000 tokens per request"}}
        token_limit_error = openai.BadRequestError(message="Token limit exceeded", response=Mock(status_code=400), body=mock_error_body)

        # first call fails with token limit, subsequent calls succeed
        call_count = 0

        async def mock_request_embeddings(inputs, embedding_config):
            nonlocal call_count
            call_count += 1
            if call_count == 1 and len(inputs) == 4:  # first call with full batch
                raise token_limit_error
            elif len(inputs) == 2:  # split batches succeed
                return [[0.1, 0.2], [0.3, 0.4]] if call_count == 2 else [[0.5, 0.6], [0.7, 0.8]]
            else:
                return [[0.1, 0.2]] * len(inputs)

        embedder.client.request_embeddings = AsyncMock(side_effect=mock_request_embeddings)

        chunks = ["chunk 1", "chunk 2", "chunk 3", "chunk 4"]
        file_id = "test_file"
        source_id = "test_source"

        passages = await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        # should still get all 4 passages despite the retry
        assert len(passages) == 4
        assert all(len(p.embedding) == 4096 for p in passages)  # padded to MAX_EMBEDDING_DIM
        # verify multiple calls were made (original + retries)
        assert call_count >= 2

    @pytest.mark.asyncio
    async def test_token_limit_error_detection(self, embedder):
        """Test various token limit error detection patterns"""
        # test openai BadRequestError with proper structure
        mock_error_body = {"error": {"code": "max_tokens_per_request", "message": "Requested 319270 tokens, max 300000 tokens per request"}}
        openai_error = openai.BadRequestError(message="Token limit exceeded", response=Mock(status_code=400), body=mock_error_body)
        assert embedder._is_token_limit_error(openai_error) is True

        # test error with message but no code
        mock_error_body_no_code = {"error": {"message": "max_tokens_per_request exceeded"}}
        openai_error_no_code = openai.BadRequestError(
            message="Token limit exceeded", response=Mock(status_code=400), body=mock_error_body_no_code
        )
        assert embedder._is_token_limit_error(openai_error_no_code) is True

        # test fallback string detection
        generic_error = Exception("Requested 100000 tokens, max 50000 tokens per request")
        assert embedder._is_token_limit_error(generic_error) is True

        # test non-token errors
        other_error = Exception("Some other error")
        assert embedder._is_token_limit_error(other_error) is False

        auth_error = openai.AuthenticationError(
            message="Invalid API key", response=Mock(status_code=401), body={"error": {"code": "invalid_api_key"}}
        )
        assert embedder._is_token_limit_error(auth_error) is False

    @pytest.mark.asyncio
    async def test_non_token_error_handling(self, embedder, mock_user):
        """Test that non-token errors are properly handled and re-raised"""
        # create a non-token error
        auth_error = openai.AuthenticationError(
            message="Invalid API key", response=Mock(status_code=401), body={"error": {"code": "invalid_api_key"}}
        )

        # mock handle_llm_error to return a standardized error
        handled_error = LLMBadRequestError(message="Handled error", code=ErrorCode.UNAUTHENTICATED)
        embedder.client.handle_llm_error.return_value = handled_error
        embedder.client.request_embeddings = AsyncMock(side_effect=auth_error)

        chunks = ["chunk 1"]
        file_id = "test_file"
        source_id = "test_source"

        with pytest.raises(LLMBadRequestError) as exc_info:
            await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        assert exc_info.value == handled_error
        embedder.client.handle_llm_error.assert_called_once_with(auth_error)

    @pytest.mark.asyncio
    async def test_single_item_batch_no_retry(self, embedder, mock_user):
        """Test that single-item batches don't retry on token limit errors"""
        # create a token limit error
        mock_error_body = {"error": {"code": "max_tokens_per_request", "message": "Requested 319270 tokens, max 300000 tokens per request"}}
        token_limit_error = openai.BadRequestError(message="Token limit exceeded", response=Mock(status_code=400), body=mock_error_body)

        handled_error = LLMBadRequestError(message="Handled token limit error", code=ErrorCode.INVALID_ARGUMENT)
        embedder.client.handle_llm_error.return_value = handled_error
        embedder.client.request_embeddings = AsyncMock(side_effect=token_limit_error)

        chunks = ["very long chunk that exceeds token limit"]
        file_id = "test_file"
        source_id = "test_source"

        with pytest.raises(LLMBadRequestError) as exc_info:
            await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        assert exc_info.value == handled_error
        embedder.client.handle_llm_error.assert_called_once_with(token_limit_error)

    @pytest.mark.asyncio
    async def test_empty_chunks_handling(self, embedder, mock_user):
        """Test handling of empty chunks list"""
        chunks = []
        file_id = "test_file"
        source_id = "test_source"

        passages = await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        assert passages == []
        # should not call request_embeddings for empty input
        embedder.client.request_embeddings.assert_not_called()

    @pytest.mark.asyncio
    async def test_embedding_order_preservation(self, embedder, mock_user):
        """Test that embedding order is preserved even with retries"""
        # set up embedder to split batches (batch_size=2)
        embedder.embedding_config.batch_size = 2

        # mock responses for each batch
        async def mock_request_embeddings(inputs, embedding_config):
            # return embeddings that correspond to input order
            if inputs == ["chunk 1", "chunk 2"]:
                return [[0.1, 0.1], [0.2, 0.2]]
            elif inputs == ["chunk 3", "chunk 4"]:
                return [[0.3, 0.3], [0.4, 0.4]]
            else:
                return [[0.1, 0.1]] * len(inputs)

        embedder.client.request_embeddings = AsyncMock(side_effect=mock_request_embeddings)

        chunks = ["chunk 1", "chunk 2", "chunk 3", "chunk 4"]
        file_id = "test_file"
        source_id = "test_source"

        passages = await embedder.generate_embedded_passages(file_id, source_id, chunks, mock_user)

        # verify order is preserved
        assert len(passages) == 4
        assert passages[0].text == "chunk 1"
        assert passages[0].embedding[:2] == [0.1, 0.1]  # check first 2 values before padding
        assert passages[1].text == "chunk 2"
        assert passages[1].embedding[:2] == [0.2, 0.2]
        assert passages[2].text == "chunk 3"
        assert passages[2].embedding[:2] == [0.3, 0.3]
        assert passages[3].text == "chunk 4"
        assert passages[3].embedding[:2] == [0.4, 0.4]
