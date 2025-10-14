import glob
import json
import os
from unittest.mock import AsyncMock, patch

import pytest

from letta.config import LettaConfig
from letta.llm_api.llm_client import LLMClient
from letta.llm_api.openai_client import OpenAIClient
from letta.schemas.embedding_config import EmbeddingConfig
from letta.server.server import SyncServer

included_files = [
    # "ollama.json",
    "letta-hosted.json",
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
