"""Tests for ProviderManager encryption/decryption logic."""

import os

import pytest

from letta.orm.provider import Provider as ProviderModel
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.providers import Provider, ProviderCreate, ProviderUpdate
from letta.schemas.secret import Secret
from letta.server.db import db_registry
from letta.services.organization_manager import OrganizationManager
from letta.services.provider_manager import ProviderManager
from letta.services.user_manager import UserManager
from letta.settings import settings


@pytest.fixture
async def default_organization():
    """Fixture to create and return the default organization."""
    manager = OrganizationManager()
    org = await manager.create_default_organization_async()
    yield org


@pytest.fixture
async def default_user(default_organization):
    """Fixture to create and return the default user within the default organization."""
    manager = UserManager()
    user = await manager.create_default_actor_async(org_id=default_organization.id)
    yield user


@pytest.fixture
async def provider_manager():
    """Fixture to create and return a ProviderManager instance."""
    return ProviderManager()


@pytest.fixture
def encryption_key():
    """Fixture to ensure encryption key is set for tests."""
    original_key = settings.encryption_key
    # Set a test encryption key if not already set
    if not settings.encryption_key:
        settings.encryption_key = "test-encryption-key-32-bytes!!"
    yield settings.encryption_key
    # Restore original
    settings.encryption_key = original_key


# ======================================================================================================================
# Provider Encryption Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_provider_create_encrypts_api_key(provider_manager, default_user, encryption_key):
    """Test that creating a provider encrypts the api_key and stores it in api_key_enc."""
    # Create a provider with plaintext api_key
    provider_create = ProviderCreate(
        name="test-openai-provider",
        provider_type=ProviderType.openai,
        api_key="sk-test-plaintext-api-key-12345",
        base_url="https://api.openai.com/v1",
    )

    # Create provider through manager
    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)

    # Verify provider was created
    assert created_provider is not None
    assert created_provider.name == "test-openai-provider"
    assert created_provider.provider_type == ProviderType.openai

    # Verify plaintext api_key is still accessible (dual-write during migration)
    assert created_provider.api_key == "sk-test-plaintext-api-key-12345"

    # Read directly from database to verify encryption
    async with db_registry.async_session() as session:
        provider_orm = await ProviderModel.read_async(
            db_session=session,
            identifier=created_provider.id,
            actor=default_user,
        )

        # Verify plaintext column has the value (dual-write)
        assert provider_orm.api_key == "sk-test-plaintext-api-key-12345"

        # Verify encrypted column is populated and different from plaintext
        assert provider_orm.api_key_enc is not None
        assert provider_orm.api_key_enc != "sk-test-plaintext-api-key-12345"
        # Encrypted value should be base64-encoded and longer
        assert len(provider_orm.api_key_enc) > len("sk-test-plaintext-api-key-12345")


@pytest.mark.asyncio
async def test_provider_read_decrypts_api_key(provider_manager, default_user, encryption_key):
    """Test that reading a provider decrypts the api_key from api_key_enc."""
    # Create a provider
    provider_create = ProviderCreate(
        name="test-anthropic-provider",
        provider_type=ProviderType.anthropic,
        api_key="sk-ant-test-key-67890",
    )

    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)
    provider_id = created_provider.id

    # Read the provider back
    retrieved_provider = await provider_manager.get_provider_async(provider_id, actor=default_user)

    # Verify the api_key is decrypted correctly
    assert retrieved_provider.api_key == "sk-ant-test-key-67890"

    # Verify we can get the decrypted key through the secret getter
    api_key_secret = retrieved_provider.get_api_key_secret()
    assert isinstance(api_key_secret, Secret)
    decrypted_key = api_key_secret.get_plaintext()
    assert decrypted_key == "sk-ant-test-key-67890"


@pytest.mark.asyncio
async def test_provider_update_encrypts_new_api_key(provider_manager, default_user, encryption_key):
    """Test that updating a provider's api_key encrypts the new value."""
    # Create initial provider
    provider_create = ProviderCreate(
        name="test-groq-provider",
        provider_type=ProviderType.groq,
        api_key="gsk-initial-key-123",
    )

    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)
    provider_id = created_provider.id

    # Update the api_key
    provider_update = ProviderUpdate(
        api_key="gsk-updated-key-456",
    )

    updated_provider = await provider_manager.update_provider_async(provider_id, provider_update, actor=default_user)

    # Verify the updated key is accessible
    assert updated_provider.api_key == "gsk-updated-key-456"

    # Read from DB to verify new encrypted value
    async with db_registry.async_session() as session:
        provider_orm = await ProviderModel.read_async(
            db_session=session,
            identifier=provider_id,
            actor=default_user,
        )

        # Verify both columns are updated
        assert provider_orm.api_key == "gsk-updated-key-456"
        assert provider_orm.api_key_enc is not None

        # Decrypt and verify
        decrypted = Secret.from_encrypted(provider_orm.api_key_enc).get_plaintext()
        assert decrypted == "gsk-updated-key-456"


@pytest.mark.asyncio
async def test_bedrock_credentials_encryption(provider_manager, default_user, encryption_key):
    """Test that Bedrock provider encrypts both access_key and api_key (secret_key)."""
    # Create Bedrock provider with both keys
    provider_create = ProviderCreate(
        name="test-bedrock-provider",
        provider_type=ProviderType.bedrock,
        api_key="secret-access-key-xyz",  # This is the secret key
        access_key="access-key-id-abc",  # This is the access key ID
        region="us-east-1",
    )

    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)

    # Verify both keys are accessible
    assert created_provider.api_key == "secret-access-key-xyz"
    assert created_provider.access_key == "access-key-id-abc"

    # Read from DB to verify both are encrypted
    async with db_registry.async_session() as session:
        provider_orm = await ProviderModel.read_async(
            db_session=session,
            identifier=created_provider.id,
            actor=default_user,
        )

        # Verify both encrypted columns are populated
        assert provider_orm.api_key_enc is not None
        assert provider_orm.access_key_enc is not None

        # Verify encrypted values are different from plaintext
        assert provider_orm.api_key_enc != "secret-access-key-xyz"
        assert provider_orm.access_key_enc != "access-key-id-abc"

    # Test the manager method for getting Bedrock credentials
    access_key, secret_key, region = await provider_manager.get_bedrock_credentials_async("test-bedrock-provider", actor=default_user)

    assert access_key == "access-key-id-abc"
    assert secret_key == "secret-access-key-xyz"
    assert region == "us-east-1"


@pytest.mark.asyncio
async def test_provider_secret_not_exposed_in_logs(provider_manager, default_user, encryption_key):
    """Test that Secret objects don't expose plaintext in string representations."""
    # Create a provider
    provider_create = ProviderCreate(
        name="test-secret-provider",
        provider_type=ProviderType.openai,
        api_key="sk-very-secret-key-do-not-log",
    )

    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)

    # Get the Secret object
    api_key_secret = created_provider.get_api_key_secret()

    # Verify string representation doesn't expose the key
    secret_str = str(api_key_secret)
    secret_repr = repr(api_key_secret)

    assert "sk-very-secret-key-do-not-log" not in secret_str
    assert "sk-very-secret-key-do-not-log" not in secret_repr
    assert "****" in secret_str or "Secret" in secret_str
    assert "****" in secret_repr or "Secret" in secret_repr


@pytest.mark.asyncio
async def test_provider_pydantic_to_orm_serialization(provider_manager, default_user, encryption_key):
    """Test the full Pydantic → ORM → Pydantic round-trip maintains data integrity."""
    # Create a provider through the normal flow
    provider_create = ProviderCreate(
        name="test-roundtrip-provider",
        provider_type=ProviderType.openai,
        api_key="sk-roundtrip-test-key-999",
        base_url="https://api.openai.com/v1",
    )

    # Step 1: Create provider (Pydantic → ORM)
    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)
    original_api_key = created_provider.api_key

    # Step 2: Read provider back (ORM → Pydantic)
    retrieved_provider = await provider_manager.get_provider_async(created_provider.id, actor=default_user)

    # Verify data integrity
    assert retrieved_provider.api_key == original_api_key
    assert retrieved_provider.name == "test-roundtrip-provider"
    assert retrieved_provider.provider_type == ProviderType.openai
    assert retrieved_provider.base_url == "https://api.openai.com/v1"

    # Verify Secret object works correctly
    api_key_secret = retrieved_provider.get_api_key_secret()
    assert api_key_secret.get_plaintext() == original_api_key

    # Step 3: Convert to ORM again (should preserve encrypted field)
    orm_data = retrieved_provider.model_dump(to_orm=True)

    # Verify encrypted field is in the ORM data
    assert "api_key_enc" in orm_data
    assert orm_data["api_key_enc"] is not None
    assert orm_data["api_key"] == original_api_key


@pytest.mark.asyncio
async def test_provider_with_none_api_key(provider_manager, default_user, encryption_key):
    """Test that providers can be created with None api_key (some providers may not need it)."""
    # Create a provider without an api_key
    provider_create = ProviderCreate(
        name="test-no-key-provider",
        provider_type=ProviderType.ollama,
        api_key="",  # Empty string
        base_url="http://localhost:11434",
    )

    created_provider = await provider_manager.create_provider_async(provider_create, actor=default_user)

    # Verify provider was created
    assert created_provider is not None
    assert created_provider.name == "test-no-key-provider"

    # Read from DB
    async with db_registry.async_session() as session:
        provider_orm = await ProviderModel.read_async(
            db_session=session,
            identifier=created_provider.id,
            actor=default_user,
        )

        # api_key_enc should handle empty string appropriately
        # (encrypt empty string or store as None)
        assert provider_orm.api_key_enc is not None or provider_orm.api_key == ""


@pytest.mark.asyncio
async def test_list_providers_decrypts_all(provider_manager, default_user, encryption_key):
    """Test that listing multiple providers decrypts all their api_keys correctly."""
    # Create multiple providers
    providers_to_create = [
        ProviderCreate(name=f"test-provider-{i}", provider_type=ProviderType.openai, api_key=f"sk-key-{i}") for i in range(3)
    ]

    created_ids = []
    for provider_create in providers_to_create:
        provider = await provider_manager.create_provider_async(provider_create, actor=default_user)
        created_ids.append(provider.id)

    # List all providers
    all_providers = await provider_manager.list_providers_async(actor=default_user)

    # Filter to our test providers
    test_providers = [p for p in all_providers if p.id in created_ids]

    # Verify all are decrypted correctly
    assert len(test_providers) == 3
    for i, provider in enumerate(sorted(test_providers, key=lambda p: p.name)):
        assert provider.api_key == f"sk-key-{i}"
        # Verify Secret getter works
        secret = provider.get_api_key_secret()
        assert secret.get_plaintext() == f"sk-key-{i}"


# ======================================================================================================================
# Handle to Config Conversion Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_handle_to_llm_config_conversion(provider_manager, default_user):
    """Test that handle to LLMConfig conversion works correctly with database lookup."""
    from letta.orm.errors import NoResultFound
    from letta.schemas.embedding_config import EmbeddingConfig
    from letta.schemas.llm_config import LLMConfig

    # Create a test provider
    provider_create = ProviderCreate(
        name="test-handle-provider", provider_type=ProviderType.openai, api_key="sk-test-handle-key", base_url="https://api.openai.com/v1"
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user)

    # Sync some test models
    llm_models = [
        LLMConfig(
            model="gpt-4",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=8192,
            handle="test-handle-provider/gpt-4",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model="gpt-3.5-turbo",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=4096,
            handle="test-handle-provider/gpt-3.5-turbo",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    embedding_models = [
        EmbeddingConfig(
            embedding_model="text-embedding-ada-002",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,
            embedding_chunk_size=300,
            handle="test-handle-provider/text-embedding-ada-002",
        )
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider, llm_models=llm_models, embedding_models=embedding_models, organization_id=default_user.organization_id
    )

    # Test LLM config from handle
    llm_config = await provider_manager.get_llm_config_from_handle(handle="test-handle-provider/gpt-4", actor=default_user)

    # Verify the returned config
    assert llm_config.model == "gpt-4"
    assert llm_config.handle == "test-handle-provider/gpt-4"
    assert llm_config.context_window == 8192
    assert llm_config.model_endpoint == "https://api.openai.com/v1"
    assert llm_config.provider_name == "test-handle-provider"

    # Test embedding config from handle
    embedding_config = await provider_manager.get_embedding_config_from_handle(
        handle="test-handle-provider/text-embedding-ada-002", actor=default_user
    )

    # Verify the returned config
    assert embedding_config.embedding_model == "text-embedding-ada-002"
    assert embedding_config.handle == "test-handle-provider/text-embedding-ada-002"
    assert embedding_config.embedding_dim == 1536
    assert embedding_config.embedding_chunk_size == 300
    assert embedding_config.embedding_endpoint == "https://api.openai.com/v1"

    # Test context window limit override would be done at server level
    # The provider_manager method doesn't support context_window_limit directly

    # Test error handling for non-existent handle
    with pytest.raises(NoResultFound):
        await provider_manager.get_llm_config_from_handle(handle="nonexistent/model", actor=default_user)


@pytest.mark.asyncio
async def test_byok_provider_auto_syncs_models(provider_manager, default_user, monkeypatch):
    """Test that creating a BYOK provider attempts to sync its models."""
    from letta.schemas.embedding_config import EmbeddingConfig
    from letta.schemas.llm_config import LLMConfig

    # Mock the list_llm_models_async method
    async def mock_list_llm():
        return [
            LLMConfig(
                model="gpt-4o",
                model_endpoint_type="openai",
                model_endpoint="https://api.openai.com/v1",
                context_window=128000,
                handle="openai/gpt-4o",
                provider_name="openai",
                provider_category=ProviderCategory.base,
            ),
            LLMConfig(
                model="gpt-4",
                model_endpoint_type="openai",
                model_endpoint="https://api.openai.com/v1",
                context_window=8192,
                handle="openai/gpt-4",
                provider_name="openai",
                provider_category=ProviderCategory.base,
            ),
        ]

    # Mock the list_embedding_models_async method
    async def mock_list_embedding():
        return [
            EmbeddingConfig(
                embedding_model="text-embedding-ada-002",
                embedding_endpoint_type="openai",
                embedding_endpoint="https://api.openai.com/v1",
                embedding_dim=1536,
                embedding_chunk_size=300,
                handle="openai/text-embedding-ada-002",
            )
        ]

    # Mock the _sync_default_models_for_provider method directly
    async def mock_sync(provider, actor):
        # Get mock models and update them for this provider
        llm_models = await mock_list_llm()
        embedding_models = await mock_list_embedding()

        # Update models to match the BYOK provider
        for model in llm_models:
            model.provider_name = provider.name
            model.handle = f"{provider.name}/{model.model}"
            model.provider_category = provider.provider_category

        for model in embedding_models:
            model.handle = f"{provider.name}/{model.embedding_model}"

        # Call sync_provider_models_async with mock data
        await provider_manager.sync_provider_models_async(
            provider=provider, llm_models=llm_models, embedding_models=embedding_models, organization_id=actor.organization_id
        )

    monkeypatch.setattr(provider_manager, "_sync_default_models_for_provider", mock_sync)

    # Create a BYOK OpenAI provider (simulates UI "Add API Key" flow)
    provider_create = ProviderCreate(name="my-openai-key", provider_type=ProviderType.openai, api_key="sk-my-personal-key-123")

    # Create the BYOK provider (is_byok=True is the default)
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=True)

    # Verify provider was created
    assert provider.name == "my-openai-key"
    assert provider.provider_type == ProviderType.openai

    # List models for this provider - they should have been auto-synced
    models = await provider_manager.list_models_async(actor=default_user, provider_id=provider.id)

    # Should have both LLM and embedding models
    llm_models = [m for m in models if m.model_type == "llm"]
    embedding_models = [m for m in models if m.model_type == "embedding"]

    assert len(llm_models) > 0, "No LLM models were synced"
    assert len(embedding_models) > 0, "No embedding models were synced"

    # Verify handles are correctly formatted with BYOK provider name
    for model in models:
        assert model.handle.startswith(f"{provider.name}/")

    # Test that we can get LLM config from handle
    llm_config = await provider_manager.get_llm_config_from_handle(handle="my-openai-key/gpt-4o", actor=default_user)
    assert llm_config.model == "gpt-4o"
    assert llm_config.provider_name == "my-openai-key"
