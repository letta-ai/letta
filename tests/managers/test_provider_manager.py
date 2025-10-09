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
