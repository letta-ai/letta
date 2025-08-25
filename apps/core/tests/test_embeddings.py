import glob
import json
import os

import pytest

from letta.llm_api.llm_client import LLMClient
from letta.schemas.embedding_config import EmbeddingConfig
from letta.server.server import SyncServer

included_files = [
    # "ollama.json",
    "letta-hosted.json",
    "openai_embed.json",
]
config_dir = "tests/configs/embedding_model_configs"
config_files = glob.glob(os.path.join(config_dir, "*.json"))
embedding_configs = [
    EmbeddingConfig(**json.load(open(config_file))) for config_file in config_files if config_file.split("/")[-1] in included_files
]


@pytest.fixture
async def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    org = server.organization_manager.create_default_organization()
    yield org


@pytest.fixture
def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = server.user_manager.create_default_user(org_id=default_organization.id)
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
