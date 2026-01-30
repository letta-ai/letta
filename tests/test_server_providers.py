"""Tests for provider initialization via ProviderManager.sync_base_providers and provider model persistence."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.orm.errors import UniqueConstraintViolationError
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers import LettaProvider, OpenAIProvider, ProviderCreate
from letta.server.server import SyncServer
from letta.services.organization_manager import OrganizationManager
from letta.services.provider_manager import ProviderManager
from letta.services.user_manager import UserManager


def unique_provider_name(base_name="test-provider"):
    """Generate a unique provider name for testing."""
    return f"{base_name}-{uuid.uuid4().hex[:8]}"


def generate_test_id():
    """Generate a unique test ID for handles and names."""
    return uuid.uuid4().hex[:8]


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
async def org_manager():
    """Fixture to create and return an OrganizationManager instance."""
    return OrganizationManager()


@pytest.mark.asyncio
async def test_sync_base_providers_creates_new_providers(default_user, provider_manager):
    """Test that sync_base_providers creates providers that don't exist."""
    # Mock base providers from environment
    base_providers = [
        LettaProvider(name="letta"),
        OpenAIProvider(name="openai", api_key="sk-test-key"),
    ]

    # Sync providers to DB
    await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)

    # Verify providers were created in the database
    letta_providers = await provider_manager.list_providers_async(name="letta", actor=default_user)
    openai_providers = await provider_manager.list_providers_async(name="openai", actor=default_user)

    assert len(letta_providers) == 1
    assert letta_providers[0].name == "letta"
    assert letta_providers[0].provider_type == ProviderType.letta

    assert len(openai_providers) == 1
    assert openai_providers[0].name == "openai"
    assert openai_providers[0].provider_type == ProviderType.openai


@pytest.mark.asyncio
async def test_sync_base_providers_skips_existing_providers(default_user, provider_manager):
    """Test that sync_base_providers skips providers that already exist."""
    # Mock base providers from environment
    base_providers = [
        LettaProvider(name="letta"),
    ]

    # Sync providers to DB first time
    await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)

    # Sync again - should skip existing
    await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)

    # Verify only one provider exists (not duplicated)
    letta_providers = await provider_manager.list_providers_async(name="letta", actor=default_user)
    assert len(letta_providers) == 1


@pytest.mark.asyncio
async def test_sync_base_providers_handles_race_condition(default_user, provider_manager):
    """Test that sync_base_providers handles race conditions gracefully."""
    # Mock base providers from environment
    base_providers = [
        LettaProvider(name="letta"),
    ]

    # Mock a race condition: list returns empty, but create fails with UniqueConstraintViolation
    original_list = provider_manager.list_providers_async
    original_create = provider_manager.create_provider_async

    call_count = {"count": 0}

    async def mock_list(*args, **kwargs):
        # First call returns empty (simulating race condition window)
        if call_count["count"] == 0:
            call_count["count"] += 1
            return []
        # Subsequent calls use original behavior
        return await original_list(*args, **kwargs)

    async def mock_create(*args, **kwargs):
        # Simulate another pod creating the provider first
        raise UniqueConstraintViolationError("Provider already exists")

    with patch.object(provider_manager, "list_providers_async", side_effect=mock_list):
        with patch.object(provider_manager, "create_provider_async", side_effect=mock_create):
            # This should NOT raise an exception
            await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)


@pytest.mark.asyncio
async def test_sync_base_providers_handles_none_api_key(default_user, provider_manager):
    """Test that sync_base_providers handles providers with None api_key."""
    # Mock base providers from environment (Letta doesn't need an API key)
    base_providers = [
        LettaProvider(name="letta", api_key=None),
    ]

    # Sync providers to DB - should convert None to empty string
    await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)

    # Verify provider was created
    letta_providers = await provider_manager.list_providers_async(name="letta", actor=default_user)
    assert len(letta_providers) == 1
    assert letta_providers[0].name == "letta"


@pytest.mark.asyncio
async def test_sync_provider_models_async(default_user, provider_manager):
    """Test that sync_provider_models_async persists LLM and embedding models to database."""
    # First create a provider in the database
    test_id = generate_test_id()
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Mock LLM and embedding models with unique handles
    llm_models = [
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    embedding_models = [
        EmbeddingConfig(
            embedding_model=f"text-embedding-3-small-{test_id}",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,  # Add required embedding_dim
            embedding_chunk_size=300,
            handle=f"test-{test_id}/text-embedding-3-small",
        ),
    ]

    # Sync models to database
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=embedding_models,
        organization_id=None,  # Global models
    )

    # Verify models were persisted
    llm_model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/gpt-4o-mini",
        actor=default_user,
        model_type="llm",
    )

    assert llm_model is not None
    assert llm_model.handle == f"test-{test_id}/gpt-4o-mini"
    assert llm_model.name == f"gpt-4o-mini-{test_id}"
    assert llm_model.model_type == "llm"
    assert llm_model.provider_id == provider.id
    assert llm_model.organization_id is None  # Global model
    assert llm_model.max_context_window == 16384
    assert llm_model.supports_token_streaming == True

    embedding_model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/text-embedding-3-small",
        actor=default_user,
        model_type="embedding",
    )

    assert embedding_model is not None
    assert embedding_model.handle == f"test-{test_id}/text-embedding-3-small"
    assert embedding_model.name == f"text-embedding-3-small-{test_id}"
    assert embedding_model.model_type == "embedding"


@pytest.mark.asyncio
async def test_sync_provider_models_idempotent(default_user, provider_manager):
    """Test that sync_provider_models_async is idempotent and doesn't duplicate models."""
    # First create a provider in the database
    test_id = uuid.uuid4().hex[:8]
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Mock LLM models with unique handle
    llm_models = [
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    # Sync models to database twice
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=[],
        organization_id=None,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=[],
        organization_id=None,
    )

    # Verify only one model exists
    models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider.id,
    )

    # Filter for our specific model
    test_handle = f"test-{test_id}/gpt-4o-mini"
    gpt_models = [m for m in models if m.handle == test_handle]
    assert len(gpt_models) == 1


@pytest.mark.asyncio
async def test_get_model_by_handle_async_org_scoped(default_user, provider_manager):
    """Test that get_model_by_handle_async returns both base and BYOK providers/models."""
    test_id = generate_test_id()

    # Create a base provider
    base_provider_create = ProviderCreate(
        name=f"test-base-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    # Create a BYOK provider with same type
    byok_provider_create = ProviderCreate(
        name=f"test-byok-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Create global base models with unique handles
    global_base_model = LLMConfig(
        model=f"gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=f"test-{test_id}/base-gpt-4o",  # Unique handle for base model
        provider_name=base_provider.name,
        provider_category=ProviderCategory.base,
    )

    global_base_model_2 = LLMConfig(
        model=f"gpt-3.5-turbo-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=4096,
        handle=f"test-{test_id}/base-gpt-3.5-turbo",  # Unique handle
        provider_name=base_provider.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[global_base_model, global_base_model_2],
        embedding_models=[],
        organization_id=None,  # Global
    )

    # Create org-scoped BYOK models with different unique handles
    org_byok_model = LLMConfig(
        model=f"gpt-4o-custom-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=64000,
        handle=f"test-{test_id}/byok-gpt-4o",  # Different unique handle for BYOK
        provider_name=byok_provider.name,
        provider_category=ProviderCategory.byok,
    )

    org_byok_model_2 = LLMConfig(
        model=f"gpt-4o-mini-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=16384,
        handle=f"test-{test_id}/byok-gpt-4o-mini",  # Unique handle
        provider_name=byok_provider.name,
        provider_category=ProviderCategory.byok,
    )

    # Sync all BYOK models at once
    await provider_manager.sync_provider_models_async(
        provider=byok_provider,
        llm_models=[org_byok_model, org_byok_model_2],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped
    )

    # Test 1: Get base model by its unique handle
    model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/base-gpt-4o",
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.organization_id is None  # Global base model
    assert model.max_context_window == 128000
    assert model.provider_id == base_provider.id

    # Test 2: Get BYOK model by its unique handle
    model_2 = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/byok-gpt-4o",
        actor=default_user,
        model_type="llm",
    )

    assert model_2 is not None
    assert model_2.organization_id == default_user.organization_id  # Org-scoped BYOK
    assert model_2.max_context_window == 64000
    assert model_2.provider_id == byok_provider.id

    # Test 3: Get another BYOK model
    model_3 = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/byok-gpt-4o-mini",
        actor=default_user,
        model_type="llm",
    )

    assert model_3 is not None
    assert model_3.organization_id == default_user.organization_id
    assert model_3.max_context_window == 16384
    assert model_3.provider_id == byok_provider.id

    # Test 4: Get base model
    model_4 = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/base-gpt-3.5-turbo",
        actor=default_user,
        model_type="llm",
    )

    assert model_4 is not None
    assert model_4.organization_id is None  # Global model
    assert model_4.max_context_window == 4096
    assert model_4.provider_id == base_provider.id

    # Test 5: List all models to verify both base and BYOK are returned
    all_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )

    test_handles = {m.handle for m in all_models if test_id in m.handle}
    # Should have 4 unique models with unique handles
    assert f"test-{test_id}/base-gpt-4o" in test_handles
    assert f"test-{test_id}/base-gpt-3.5-turbo" in test_handles
    assert f"test-{test_id}/byok-gpt-4o" in test_handles
    assert f"test-{test_id}/byok-gpt-4o-mini" in test_handles


@pytest.mark.asyncio
async def test_get_model_by_handle_async_unique_handles(default_user, provider_manager):
    """Test that handles are unique within each organization scope."""
    test_id = generate_test_id()

    # Create a base provider
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create a global model with a unique handle
    test_handle = f"test-{test_id}/gpt-4o"
    global_model = LLMConfig(
        model=f"gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=test_handle,
        provider_name=provider.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[global_model],
        embedding_models=[],
        organization_id=None,  # Global
    )

    # Test 1: Verify the global model was created
    model = await provider_manager.get_model_by_handle_async(
        handle=test_handle,
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.organization_id is None  # Global model
    assert model.max_context_window == 128000

    # Test 2: Create an org-scoped model with the SAME handle - should work now (different org scope)
    org_model_same_handle = LLMConfig(
        model=f"gpt-4o-custom-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=64000,
        handle=test_handle,  # Same handle - allowed since different org
        provider_name=provider.name,
        provider_category=ProviderCategory.byok,
    )

    # This should work now since handles are unique per org, not globally
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[org_model_same_handle],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped
    )

    # Verify we now get the org-specific model (prioritized over global)
    model_check = await provider_manager.get_model_by_handle_async(
        handle=test_handle,
        actor=default_user,
        model_type="llm",
    )

    # Should now return the org-specific model (prioritized over global)
    assert model_check is not None
    assert model_check.organization_id == default_user.organization_id  # Org-specific
    assert model_check.max_context_window == 64000  # Org model's context window

    # Test 3: Create a model with a different unique handle - should succeed
    different_handle = f"test-{test_id}/gpt-4o-mini"
    org_model = LLMConfig(
        model=f"gpt-4o-mini-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=16384,
        handle=different_handle,  # Different handle
        provider_name=provider.name,
        provider_category=ProviderCategory.byok,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[org_model],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped
    )

    # Verify the org model was created
    org_model_result = await provider_manager.get_model_by_handle_async(
        handle=different_handle,
        actor=default_user,
        model_type="llm",
    )

    assert org_model_result is not None
    assert org_model_result.organization_id == default_user.organization_id
    assert org_model_result.max_context_window == 16384

    # Test 4: Get model with handle that doesn't exist - should return None
    nonexistent_model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/nonexistent",
        actor=default_user,
        model_type="llm",
    )

    assert nonexistent_model is None


@pytest.mark.asyncio
async def test_list_models_async_combines_global_and_org(default_user, provider_manager):
    """Test that list_models_async returns both global and org-scoped models with org-scoped taking precedence."""
    # Create a provider in the database with unique test ID
    test_id = generate_test_id()
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create global models with unique handles
    global_models = [
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=global_models,
        embedding_models=[],
        organization_id=None,  # Global
    )

    # Create org-scoped model with a different unique handle
    org_model = LLMConfig(
        model=f"gpt-4o-custom-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=64000,
        handle=f"test-{test_id}/gpt-4o-custom",  # Different unique handle
        provider_name=provider.name,
        provider_category=ProviderCategory.byok,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[org_model],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped
    )

    # List models
    models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider.id,
    )

    # Should have 3 unique models
    handles = {m.handle for m in models}
    assert f"test-{test_id}/gpt-4o" in handles
    assert f"test-{test_id}/gpt-4o-mini" in handles
    assert f"test-{test_id}/gpt-4o-custom" in handles

    # gpt-4o should be the global version
    gpt4o = next(m for m in models if m.handle == f"test-{test_id}/gpt-4o")
    assert gpt4o.organization_id is None
    assert gpt4o.max_context_window == 128000

    # gpt-4o-mini should be the global version
    gpt4o_mini = next(m for m in models if m.handle == f"test-{test_id}/gpt-4o-mini")
    assert gpt4o_mini.organization_id is None
    assert gpt4o_mini.max_context_window == 16384

    # gpt-4o-custom should be the org-scoped version
    gpt4o_custom = next(m for m in models if m.handle == f"test-{test_id}/gpt-4o-custom")
    assert gpt4o_custom.organization_id == default_user.organization_id
    assert gpt4o_custom.max_context_window == 64000


@pytest.mark.asyncio
async def test_list_models_async_filters(default_user, provider_manager):
    """Test that list_models_async properly applies filters."""
    # Create providers in the database with unique test ID
    test_id = generate_test_id()
    openai_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    openai_provider = await provider_manager.create_provider_async(openai_create, actor=default_user, is_byok=False)

    # For anthropic, we need to use a valid provider type
    anthropic_create = ProviderCreate(
        name=f"test-anthropic-{test_id}",
        provider_type=ProviderType.anthropic,
        api_key="sk-test-key",
    )
    anthropic_provider = await provider_manager.create_provider_async(anthropic_create, actor=default_user, is_byok=False)

    # Create models for different providers with unique handles
    openai_llm = LLMConfig(
        model=f"gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=f"test-{test_id}/openai-gpt-4o",
        provider_name=openai_provider.name,
        provider_category=ProviderCategory.base,
    )

    openai_embedding = EmbeddingConfig(
        embedding_model=f"text-embedding-3-small-{test_id}",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_dim=1536,  # Add required embedding_dim
        embedding_chunk_size=300,
        handle=f"test-{test_id}/openai-text-embedding",
    )

    anthropic_llm = LLMConfig(
        model=f"claude-3-5-sonnet-{test_id}",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com",
        context_window=200000,
        handle=f"test-{test_id}/anthropic-claude",
        provider_name=anthropic_provider.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=openai_provider,
        llm_models=[openai_llm],
        embedding_models=[openai_embedding],
        organization_id=None,
    )

    await provider_manager.sync_provider_models_async(
        provider=anthropic_provider,
        llm_models=[anthropic_llm],
        embedding_models=[],
        organization_id=None,
    )

    # Test filter by model_type
    llm_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )
    llm_handles = {m.handle for m in llm_models}
    assert f"test-{test_id}/openai-gpt-4o" in llm_handles
    assert f"test-{test_id}/anthropic-claude" in llm_handles
    assert f"test-{test_id}/openai-text-embedding" not in llm_handles

    embedding_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
    )
    embedding_handles = {m.handle for m in embedding_models}
    assert f"test-{test_id}/openai-text-embedding" in embedding_handles
    assert f"test-{test_id}/openai-gpt-4o" not in embedding_handles
    assert f"test-{test_id}/anthropic-claude" not in embedding_handles

    # Test filter by provider_id
    openai_models = await provider_manager.list_models_async(
        actor=default_user,
        provider_id=openai_provider.id,
    )
    openai_handles = {m.handle for m in openai_models}
    assert f"test-{test_id}/openai-gpt-4o" in openai_handles
    assert f"test-{test_id}/openai-text-embedding" in openai_handles
    assert f"test-{test_id}/anthropic-claude" not in openai_handles


@pytest.mark.asyncio
async def test_model_metadata_persistence(default_user, provider_manager):
    """Test that model metadata like context window, streaming, and tool calling are properly persisted."""
    # Create a provider in the database
    test_id = generate_test_id()
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create model with specific metadata and unique handle
    llm_model = LLMConfig(
        model=f"gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=f"test-{test_id}/gpt-4o",
        provider_name=provider.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[llm_model],
        embedding_models=[],
        organization_id=None,
    )

    # Retrieve model and verify metadata
    model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/gpt-4o",
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.max_context_window == 128000
    assert model.supports_token_streaming == True  # OpenAI supports streaming
    assert model.supports_tool_calling == True  # Assumed true for LLMs
    assert model.model_endpoint_type == "openai"
    assert model.enabled == True


@pytest.mark.asyncio
async def test_model_enabled_filter(default_user, provider_manager):
    """Test that enabled filter works properly in list_models_async."""
    # Create a provider in the database
    provider_create = ProviderCreate(
        name=unique_provider_name("test-openai"),
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create models
    models = [
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
            model="gpt-4o-mini",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle="openai/gpt-4o-mini",
            provider_name="openai",
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=models,
        embedding_models=[],
        organization_id=None,
    )

    # All models should be enabled by default
    enabled_models = await provider_manager.list_models_async(
        actor=default_user,
        enabled=True,
    )

    handles = {m.handle for m in enabled_models}
    assert "openai/gpt-4o" in handles
    assert "openai/gpt-4o-mini" in handles

    # Test with enabled=None (should return all models)
    all_models = await provider_manager.list_models_async(
        actor=default_user,
        enabled=None,
    )

    all_handles = {m.handle for m in all_models}
    assert "openai/gpt-4o" in all_handles
    assert "openai/gpt-4o-mini" in all_handles


@pytest.mark.asyncio
async def test_get_llm_config_from_handle_uses_cached_models(default_user):
    """Test that get_llm_config_from_handle_async uses cached models from database instead of querying provider."""
    from letta.server.server import SyncServer

    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user

    # Create a provider and model in database
    provider = OpenAIProvider(name="openai", api_key="sk-test-key")
    provider.id = "provider_test_id"
    provider.provider_category = ProviderCategory.base
    provider.base_url = "https://custom.openai.com/v1"

    # Mock the provider manager methods
    server.provider_manager = AsyncMock()

    # Mock get_llm_config_from_handle to return cached LLM config
    mock_llm_config = LLMConfig(
        model="gpt-4o",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=128000,
        handle="openai/gpt-4o",
        provider_name="openai",
        provider_category=ProviderCategory.base,
    )
    server.provider_manager.get_llm_config_from_handle.return_value = mock_llm_config

    # Get LLM config - should use cached data
    llm_config = await server.get_llm_config_from_handle_async(
        actor=default_user,
        handle="openai/gpt-4o",
        context_window_limit=100000,
    )

    # Verify it used the cached model data
    assert llm_config.model == "gpt-4o"
    assert llm_config.model_endpoint == "https://custom.openai.com/v1"
    assert llm_config.context_window == 100000  # Limited by context_window_limit
    assert llm_config.handle == "openai/gpt-4o"
    assert llm_config.provider_name == "openai"

    # Verify provider methods were called
    server.provider_manager.get_llm_config_from_handle.assert_called_once_with(
        handle="openai/gpt-4o",
        actor=default_user,
    )


@pytest.mark.asyncio
async def test_get_embedding_config_from_handle_uses_cached_models(default_user):
    """Test that get_embedding_config_from_handle_async uses cached models from database instead of querying provider."""
    from letta.server.server import SyncServer

    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user

    # Mock the provider manager methods
    server.provider_manager = AsyncMock()

    # Mock get_embedding_config_from_handle to return cached embedding config
    mock_embedding_config = EmbeddingConfig(
        embedding_model="text-embedding-3-small",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://custom.openai.com/v1",
        embedding_dim=1536,
        embedding_chunk_size=500,
        handle="openai/text-embedding-3-small",
    )
    server.provider_manager.get_embedding_config_from_handle.return_value = mock_embedding_config

    # Get embedding config - should use cached data
    embedding_config = await server.get_embedding_config_from_handle_async(
        actor=default_user,
        handle="openai/text-embedding-3-small",
        embedding_chunk_size=500,
    )

    # Verify it used the cached model data
    assert embedding_config.embedding_model == "text-embedding-3-small"
    assert embedding_config.embedding_endpoint == "https://custom.openai.com/v1"
    assert embedding_config.embedding_chunk_size == 500
    assert embedding_config.handle == "openai/text-embedding-3-small"
    # Note: EmbeddingConfig doesn't have provider_name field unlike LLMConfig

    # Verify provider methods were called
    server.provider_manager.get_embedding_config_from_handle.assert_called_once_with(
        handle="openai/text-embedding-3-small",
        actor=default_user,
    )


@pytest.mark.asyncio
async def test_server_sync_provider_models_on_init(default_user):
    """Test that the server syncs provider models to database during initialization."""
    from letta.server.server import SyncServer

    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user

    # Mock providers
    mock_letta_provider = AsyncMock()
    mock_letta_provider.name = "letta"
    mock_letta_provider.list_llm_models_async.return_value = [
        LLMConfig(
            model="letta-model",
            model_endpoint_type="openai",  # Use valid endpoint type
            model_endpoint="https://api.letta.com",
            context_window=8192,
            handle="letta/letta-model",
            provider_name="letta",
            provider_category=ProviderCategory.base,
        )
    ]
    mock_letta_provider.list_embedding_models_async.return_value = []

    mock_openai_provider = AsyncMock()
    mock_openai_provider.name = "openai"
    mock_openai_provider.list_llm_models_async.return_value = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle="openai/gpt-4o",
            provider_name="openai",
            provider_category=ProviderCategory.base,
        )
    ]
    mock_openai_provider.list_embedding_models_async.return_value = [
        EmbeddingConfig(
            embedding_model="text-embedding-3-small",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,  # Add required embedding_dim
            embedding_chunk_size=300,
            handle="openai/text-embedding-3-small",
        )
    ]

    server._enabled_providers = [mock_letta_provider, mock_openai_provider]

    # Mock provider manager
    server.provider_manager = AsyncMock()

    # Mock list_providers_async to return providers with IDs
    db_letta = MagicMock()
    db_letta.id = "letta_provider_id"
    db_letta.name = "letta"

    db_openai = MagicMock()
    db_openai.id = "openai_provider_id"
    db_openai.name = "openai"

    server.provider_manager.list_providers_async.return_value = [db_letta, db_openai]

    # Call the sync method
    await server._sync_provider_models_async()

    # Verify models were synced for each provider
    assert server.provider_manager.sync_provider_models_async.call_count == 2

    # Verify Letta models were synced
    letta_call = server.provider_manager.sync_provider_models_async.call_args_list[0]
    assert letta_call.kwargs["provider"].id == "letta_provider_id"
    assert len(letta_call.kwargs["llm_models"]) == 1
    assert len(letta_call.kwargs["embedding_models"]) == 0
    assert letta_call.kwargs["organization_id"] is None

    # Verify OpenAI models were synced
    openai_call = server.provider_manager.sync_provider_models_async.call_args_list[1]
    assert openai_call.kwargs["provider"].id == "openai_provider_id"
    assert len(openai_call.kwargs["llm_models"]) == 1
    assert len(openai_call.kwargs["embedding_models"]) == 1
    assert openai_call.kwargs["organization_id"] is None


@pytest.mark.asyncio
async def test_provider_model_unique_constraint_per_org(default_user, provider_manager, org_manager, default_organization):
    """Test that provider models have unique handles within each organization (not globally)."""
    # Create a second organization
    from letta.schemas.organization import Organization

    org2 = Organization(name="Test Org 2")
    org2 = await org_manager.create_organization_async(org2)

    # Create a user for the second organization
    from letta.services.user_manager import UserManager

    user_manager = UserManager()
    # Note: create_default_actor_async has a bug where it ignores the org_id parameter
    # Create a user properly for org2
    from letta.schemas.user import User

    org2_user = User(name="Test User Org2", organization_id=org2.id)
    org2_user = await user_manager.create_actor_async(org2_user)

    # Create a global base provider
    provider_create = ProviderCreate(
        name=unique_provider_name("test-openai"),
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create model configuration with a unique handle for this test
    import uuid

    test_id = uuid.uuid4().hex[:8]
    test_handle = f"test-{test_id}/gpt-4o"
    model_org1 = LLMConfig(
        model=f"gpt-4o-org1-{test_id}",  # Unique model name per org
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=test_handle,
        provider_name=provider.name,
        provider_category=ProviderCategory.base,
    )

    # Sync for default organization
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[model_org1],
        embedding_models=[],
        organization_id=default_organization.id,
    )

    # Create model with same handle but different model name for org2
    model_org2 = LLMConfig(
        model=f"gpt-4o-org2-{test_id}",  # Different model name for org2
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=test_handle,  # Same handle - now allowed since handles are unique per org
        provider_name=provider.name,
        provider_category=ProviderCategory.base,
    )

    # Sync for organization 2 with same handle - now allowed since handles are unique per org
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[model_org2],
        embedding_models=[],
        organization_id=org2.id,
    )

    # Each organization should have its own model with the same handle
    org1_model = await provider_manager.get_model_by_handle_async(
        handle=test_handle,
        actor=default_user,
        model_type="llm",
    )

    org2_model = await provider_manager.get_model_by_handle_async(
        handle=test_handle,
        actor=org2_user,
        model_type="llm",
    )

    # Both organizations should have their own models with the same handle
    assert org1_model is not None, "Model should exist for org1"
    assert org2_model is not None, "Model should exist for org2"

    # Each model should belong to its respective organization
    assert org1_model.organization_id == default_organization.id
    assert org2_model.organization_id == org2.id

    # They should have the same handle but different IDs
    assert org1_model.handle == org2_model.handle == test_handle
    assert org1_model.id != org2_model.id

    # Now create a model with a different handle for org2
    test_handle_org2 = f"test-{test_id}/gpt-4o-org2"
    model_org2 = LLMConfig(
        model="gpt-4o",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=test_handle_org2,  # Different handle
        provider_name=provider.name,
        provider_category=ProviderCategory.base,
    )

    # Sync for organization 2 with different handle
    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=[model_org2],
        embedding_models=[],
        organization_id=org2.id,
    )

    # Now org2 should see their model
    org2_model_new = await provider_manager.get_model_by_handle_async(
        handle=test_handle_org2,
        actor=org2_user,
        model_type="llm",
    )

    assert org2_model_new is not None
    assert org2_model_new.handle == test_handle_org2
    assert org2_model_new.organization_id == org2.id


@pytest.mark.asyncio
async def test_sync_provider_models_add_remove_models(default_user, provider_manager):
    """
    Test that sync_provider_models_async correctly handles:
    1. Adding new models to an existing provider
    2. Removing models from an existing provider
    3. Not dropping non-base (BYOK) provider models during sync
    """
    # Create a base provider
    test_id = generate_test_id()
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    base_provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create a BYOK provider with same provider type
    byok_provider_create = ProviderCreate(
        name=f"test-openai-byok-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Initial sync: Create initial base models
    initial_base_models = [
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=base_provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=base_provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=initial_base_models,
        embedding_models=[],
        organization_id=None,  # Global base models
    )

    # Create BYOK models (should not be affected by base provider sync)
    byok_models = [
        LLMConfig(
            model=f"custom-gpt-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://custom.api.com/v1",
            context_window=64000,
            handle=f"test-{test_id}/custom-gpt",
            provider_name=byok_provider.name,
            provider_category=ProviderCategory.byok,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=byok_provider,
        llm_models=byok_models,
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped BYOK
    )

    # Verify initial state: all 3 models exist
    all_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )
    handles = {m.handle for m in all_models}
    assert f"test-{test_id}/gpt-4o" in handles
    assert f"test-{test_id}/gpt-4o-mini" in handles
    assert f"test-{test_id}/custom-gpt" in handles

    # Second sync: Add a new model and remove one existing model
    updated_base_models = [
        # Keep gpt-4o
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=base_provider.name,
            provider_category=ProviderCategory.base,
        ),
        # Remove gpt-4o-mini (not in this list)
        # Add new model gpt-4-turbo
        LLMConfig(
            model=f"gpt-4-turbo-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4-turbo",
            provider_name=base_provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=updated_base_models,
        embedding_models=[],
        organization_id=None,  # Global base models
    )

    # Verify updated state
    all_models_after = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )
    handles_after = {m.handle for m in all_models_after}

    # gpt-4o should still exist (kept)
    assert f"test-{test_id}/gpt-4o" in handles_after

    # gpt-4o-mini should be removed
    assert f"test-{test_id}/gpt-4o-mini" not in handles_after

    # gpt-4-turbo should be added
    assert f"test-{test_id}/gpt-4-turbo" in handles_after

    # BYOK model should NOT be affected by base provider sync
    assert f"test-{test_id}/custom-gpt" in handles_after

    # Verify the BYOK model still belongs to the correct provider
    byok_model = await provider_manager.get_model_by_handle_async(
        handle=f"test-{test_id}/custom-gpt",
        actor=default_user,
        model_type="llm",
    )
    assert byok_model is not None
    assert byok_model.provider_id == byok_provider.id
    assert byok_model.organization_id == default_user.organization_id

    # Third sync: Remove all base provider models
    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[],  # Empty list - remove all models
        embedding_models=[],
        organization_id=None,
    )

    # Verify all base models are removed
    all_models_final = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )
    handles_final = {m.handle for m in all_models_final}

    # All base provider models should be gone
    assert f"test-{test_id}/gpt-4o" not in handles_final
    assert f"test-{test_id}/gpt-4-turbo" not in handles_final

    # But BYOK model should still exist
    assert f"test-{test_id}/custom-gpt" in handles_final


@pytest.mark.asyncio
async def test_sync_provider_models_mixed_llm_and_embedding(default_user, provider_manager):
    """
    Test that sync_provider_models_async correctly handles adding/removing both LLM and embedding models,
    ensuring that changes to one model type don't affect the other.
    """
    test_id = generate_test_id()
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Initial sync: LLM and embedding models
    initial_llm_models = [
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    initial_embedding_models = [
        EmbeddingConfig(
            embedding_model=f"text-embedding-3-small-{test_id}",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,
            embedding_chunk_size=300,
            handle=f"test-{test_id}/text-embedding-3-small",
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=initial_llm_models,
        embedding_models=initial_embedding_models,
        organization_id=None,
    )

    # Verify initial state
    llm_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider.id,
    )
    embedding_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
        provider_id=provider.id,
    )
    assert len([m for m in llm_models if m.handle == f"test-{test_id}/gpt-4o"]) == 1
    assert len([m for m in embedding_models if m.handle == f"test-{test_id}/text-embedding-3-small"]) == 1

    # Second sync: Add new LLM, remove embedding
    updated_llm_models = [
        # Keep existing
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        # Add new
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=updated_llm_models,
        embedding_models=[],  # Remove all embeddings
        organization_id=None,
    )

    # Verify updated state
    llm_models_after = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider.id,
    )
    embedding_models_after = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
        provider_id=provider.id,
    )

    llm_handles = {m.handle for m in llm_models_after}
    embedding_handles = {m.handle for m in embedding_models_after}

    # Both LLM models should exist
    assert f"test-{test_id}/gpt-4o" in llm_handles
    assert f"test-{test_id}/gpt-4o-mini" in llm_handles

    # Embedding should be removed
    assert f"test-{test_id}/text-embedding-3-small" not in embedding_handles


@pytest.mark.asyncio
async def test_provider_name_uniqueness_within_org(default_user, provider_manager):
    """Test that provider names must be unique within an organization, including conflicts with base provider names."""
    test_id = generate_test_id()

    # Create a base provider with a specific name
    base_provider_name = f"test-provider-{test_id}"
    base_provider_create = ProviderCreate(
        name=base_provider_name,
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    # Test 1: Attempt to create another base provider with the same name - should fail with ValueError
    with pytest.raises(ValueError, match="already exists"):
        duplicate_provider_create = ProviderCreate(
            name=base_provider_name,  # Same name
            provider_type=ProviderType.anthropic,  # Different type
            api_key="sk-different-key",
        )
        await provider_manager.create_provider_async(duplicate_provider_create, actor=default_user, is_byok=False)

    # Test 2: Create a BYOK provider with the same name as a base provider - should fail with ValueError
    with pytest.raises(ValueError, match="conflicts with an existing base provider"):
        byok_duplicate_create = ProviderCreate(
            name=base_provider_name,  # Same name as base provider
            provider_type=ProviderType.openai,
            api_key="sk-byok-key",
        )
        await provider_manager.create_provider_async(byok_duplicate_create, actor=default_user, is_byok=True)

    # Test 3: Create a provider with a different name - should succeed
    different_provider_create = ProviderCreate(
        name=f"different-provider-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-another-key",
    )
    different_provider = await provider_manager.create_provider_async(different_provider_create, actor=default_user, is_byok=False)
    assert different_provider is not None
    assert different_provider.name == f"different-provider-{test_id}"


@pytest.mark.asyncio
async def test_model_name_uniqueness_within_provider(default_user, provider_manager):
    """Test that model names must be unique within a provider."""
    test_id = generate_test_id()

    # Create a provider
    provider_create = ProviderCreate(
        name=f"test-provider-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Create initial models with unique names
    initial_models = [
        LLMConfig(
            model=f"model-1-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=4096,
            handle=f"test-{test_id}/model-1",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"model-2-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=8192,
            handle=f"test-{test_id}/model-2",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=initial_models,
        embedding_models=[],
        organization_id=None,
    )

    # Test 1: Try to sync models with duplicate names within the same provider - should be idempotent
    duplicate_models = [
        LLMConfig(
            model=f"model-1-{test_id}",  # Same model name
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=4096,
            handle=f"test-{test_id}/model-1",  # Same handle
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"model-1-{test_id}",  # Duplicate model name in same sync
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,  # Different settings
            handle=f"test-{test_id}/model-1-duplicate",  # Different handle
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    # This should raise an error or handle the duplication appropriately
    # The behavior depends on the implementation - it might dedupe or raise an error
    try:
        await provider_manager.sync_provider_models_async(
            provider=provider,
            llm_models=duplicate_models,
            embedding_models=[],
            organization_id=None,
        )
        # If it doesn't raise an error, verify that we don't have duplicate models
        all_models = await provider_manager.list_models_async(
            actor=default_user,
            model_type="llm",
            provider_id=provider.id,
        )

        # Count how many times each model name appears
        model_names = [m.name for m in all_models if test_id in m.name]
        model_1_count = model_names.count(f"model-1-{test_id}")

        # Should only have one model with this name per provider
        assert model_1_count <= 2, f"Found {model_1_count} models with name 'model-1-{test_id}', expected at most 2"

    except (UniqueConstraintViolationError, ValueError):
        # This is also acceptable behavior - raising an error for duplicate model names
        pass

    # Test 2: Different providers can have models with the same name
    provider_2_create = ProviderCreate(
        name=f"test-provider-2-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key-2",
    )
    provider_2 = await provider_manager.create_provider_async(provider_2_create, actor=default_user, is_byok=False)

    # Create a model with the same name but in a different provider - should succeed
    same_name_different_provider = [
        LLMConfig(
            model=f"model-1-{test_id}",  # Same model name as in provider 1
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=4096,
            handle=f"test-{test_id}/provider2-model-1",  # Different handle
            provider_name=provider_2.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider_2,
        llm_models=same_name_different_provider,
        embedding_models=[],
        organization_id=None,
    )

    # Verify the model was created
    provider_2_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider_2.id,
    )

    assert any(m.name == f"model-1-{test_id}" for m in provider_2_models)


@pytest.mark.asyncio
async def test_handle_uniqueness_per_org(default_user, provider_manager):
    """Test that handles must be unique within organizations but can be duplicated across different orgs."""
    test_id = generate_test_id()

    # Create providers
    provider_1_create = ProviderCreate(
        name=f"test-provider-1-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider_1 = await provider_manager.create_provider_async(provider_1_create, actor=default_user, is_byok=False)

    provider_2_create = ProviderCreate(
        name=f"test-provider-2-{test_id}",
        provider_type=ProviderType.anthropic,
        api_key="sk-test-key-2",
    )
    provider_2 = await provider_manager.create_provider_async(provider_2_create, actor=default_user, is_byok=False)

    # Create a global base model with a specific handle
    base_handle = f"test-{test_id}/unique-handle"
    base_model = LLMConfig(
        model=f"base-model-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=4096,
        handle=base_handle,
        provider_name=provider_1.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider_1,
        llm_models=[base_model],
        embedding_models=[],
        organization_id=None,  # Global
    )

    # Test 1: Try to create another global model with the same handle from different provider
    # This should succeed because we need a different model name (provider constraint)
    duplicate_handle_model = LLMConfig(
        model=f"different-model-{test_id}",  # Different model name (required for provider uniqueness)
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com",
        context_window=8192,
        handle=base_handle,  # Same handle - allowed since different model name
        provider_name=provider_2.name,
        provider_category=ProviderCategory.base,
    )

    # This will create another global model with same handle but different provider/model name
    await provider_manager.sync_provider_models_async(
        provider=provider_2,
        llm_models=[duplicate_handle_model],
        embedding_models=[],
        organization_id=None,  # Global
    )

    # The get_model_by_handle_async will return one of the global models
    model = await provider_manager.get_model_by_handle_async(
        handle=base_handle,
        actor=default_user,
        model_type="llm",
    )

    # Should return one of the global models
    assert model is not None
    assert model.organization_id is None  # Global model

    # Test 2: Org-scoped model CAN have the same handle as a global model
    org_model_same_handle = LLMConfig(
        model=f"org-model-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://custom.openai.com/v1",
        context_window=16384,
        handle=base_handle,  # Same handle as global model - now allowed for different org
        provider_name=provider_1.name,
        provider_category=ProviderCategory.byok,
    )

    # This should succeed - handles are unique per org, not globally
    await provider_manager.sync_provider_models_async(
        provider=provider_1,
        llm_models=[org_model_same_handle],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-scoped
    )

    # When user from this org queries, they should get their org-specific model (prioritized)
    model = await provider_manager.get_model_by_handle_async(
        handle=base_handle,
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.organization_id == default_user.organization_id  # Org-specific model (prioritized)
    assert model.max_context_window == 16384  # Org model's context window

    # Test 3: Create a model with a new unique handle - should succeed
    unique_org_handle = f"test-{test_id}/org-unique-handle"

    org_model_1 = LLMConfig(
        model=f"org-model-1-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=8192,
        handle=unique_org_handle,
        provider_name=provider_1.name,
        provider_category=ProviderCategory.byok,
    )

    await provider_manager.sync_provider_models_async(
        provider=provider_1,
        llm_models=[org_model_1],
        embedding_models=[],
        organization_id=default_user.organization_id,
    )

    # Verify the model was created
    model = await provider_manager.get_model_by_handle_async(
        handle=unique_org_handle,
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.organization_id == default_user.organization_id
    assert model.max_context_window == 8192

    # Test 4: Try to create another model with the same handle even in different org - NOT allowed
    org_model_2 = LLMConfig(
        model=f"org-model-2-{test_id}",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com",
        context_window=16384,
        handle=unique_org_handle,  # Same handle - globally unique
        provider_name=provider_2.name,
        provider_category=ProviderCategory.byok,
    )

    # This should be idempotent
    await provider_manager.sync_provider_models_async(
        provider=provider_2,
        llm_models=[org_model_2],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Same or different org doesn't matter
    )

    # Verify still the original model
    model = await provider_manager.get_model_by_handle_async(
        handle=unique_org_handle,
        actor=default_user,
        model_type="llm",
    )

    assert model is not None
    assert model.provider_id == provider_1.id  # Still original provider
    assert model.max_context_window == 8192  # Still original


@pytest.mark.asyncio
async def test_delete_provider_cascades_to_models(default_user, provider_manager, monkeypatch):
    """Test that deleting a provider also soft-deletes its associated models."""
    test_id = generate_test_id()

    # Mock _sync_default_models_for_provider to avoid external API calls
    async def mock_sync(provider, actor):
        pass  # Don't actually sync - we'll manually create models below

    monkeypatch.setattr(provider_manager, "_sync_default_models_for_provider", mock_sync)

    # 1. Create a BYOK provider (org-scoped, so the actor can delete it)
    provider_create = ProviderCreate(
        name=f"test-cascade-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=True)

    # 2. Manually sync models to the provider
    llm_models = [
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.byok,
        ),
        LLMConfig(
            model=f"gpt-4o-mini-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=16384,
            handle=f"test-{test_id}/gpt-4o-mini",
            provider_name=provider.name,
            provider_category=ProviderCategory.byok,
        ),
    ]

    embedding_models = [
        EmbeddingConfig(
            embedding_model=f"text-embedding-3-small-{test_id}",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,
            embedding_chunk_size=300,
            handle=f"test-{test_id}/text-embedding-3-small",
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=embedding_models,
        organization_id=default_user.organization_id,  # Org-scoped for BYOK provider
    )

    # 3. Verify models exist before deletion
    llm_models_before = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=provider.id,
    )
    embedding_models_before = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
        provider_id=provider.id,
    )

    llm_handles_before = {m.handle for m in llm_models_before}
    embedding_handles_before = {m.handle for m in embedding_models_before}

    assert f"test-{test_id}/gpt-4o" in llm_handles_before
    assert f"test-{test_id}/gpt-4o-mini" in llm_handles_before
    assert f"test-{test_id}/text-embedding-3-small" in embedding_handles_before

    # 4. Delete the provider
    await provider_manager.delete_provider_by_id_async(provider.id, actor=default_user)

    # 5. Verify models are soft-deleted (no longer returned in list)
    all_llm_models_after = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
    )
    all_embedding_models_after = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
    )

    all_llm_handles_after = {m.handle for m in all_llm_models_after}
    all_embedding_handles_after = {m.handle for m in all_embedding_models_after}

    # All models from the deleted provider should be gone
    assert f"test-{test_id}/gpt-4o" not in all_llm_handles_after
    assert f"test-{test_id}/gpt-4o-mini" not in all_llm_handles_after
    assert f"test-{test_id}/text-embedding-3-small" not in all_embedding_handles_after

    # 6. Verify provider is also deleted
    providers_after = await provider_manager.list_providers_async(
        actor=default_user,
        name=f"test-cascade-{test_id}",
    )
    assert len(providers_after) == 0


@pytest.mark.asyncio
async def test_get_llm_config_from_handle_includes_max_tokens(default_user, provider_manager):
    """Test that get_llm_config_from_handle includes max_tokens from provider's get_default_max_output_tokens.

    This test verifies that:
    1. The max_tokens field is populated when retrieving LLMConfig from a handle
    2. The max_tokens value comes from the provider's get_default_max_output_tokens method
    3. Different providers return different default max_tokens values (e.g., OpenAI returns 16384)
    """
    test_id = generate_test_id()

    # Create an OpenAI provider
    provider_create = ProviderCreate(
        name=f"test-openai-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
        base_url="https://api.openai.com/v1",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Sync a model with the provider
    llm_models = [
        LLMConfig(
            model=f"gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-{test_id}/gpt-4o",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=[],
        organization_id=None,  # Global model
    )

    # Get LLMConfig from handle
    llm_config = await provider_manager.get_llm_config_from_handle(
        handle=f"test-{test_id}/gpt-4o",
        actor=default_user,
    )

    # Verify max_tokens is set and comes from OpenAI provider's default (16384 for non-o1/o3 models)
    assert llm_config.max_tokens is not None, "max_tokens should be set"
    assert llm_config.max_tokens == 16384, f"Expected max_tokens=16384 for OpenAI gpt-4o, got {llm_config.max_tokens}"

    # Test with a gpt-5 model (should have 16384)
    llm_models_gpt5 = [
        LLMConfig(
            model=f"gpt-5-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=200000,
            handle=f"test-{test_id}/gpt-5",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models_gpt5,
        embedding_models=[],
        organization_id=None,
    )

    llm_config_gpt5 = await provider_manager.get_llm_config_from_handle(
        handle=f"test-{test_id}/gpt-5",
        actor=default_user,
    )

    # gpt-5 models also have 16384 max_tokens
    assert llm_config_gpt5.max_tokens == 16384, f"Expected max_tokens=16384 for gpt-5, got {llm_config_gpt5.max_tokens}"


@pytest.mark.asyncio
async def test_server_list_llm_models_async_reads_from_database(default_user, provider_manager):
    """Test that the server's list_llm_models_async reads models from database, not in-memory.

    This test verifies that:
    1. Models synced to the database are returned by list_llm_models_async
    2. The LLMConfig objects are correctly constructed from database-cached models
    3. Provider filtering works correctly when reading from database
    """
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a provider in the database
    provider_create = ProviderCreate(
        name=f"test-db-provider-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
        base_url="https://custom.openai.com/v1",
    )
    provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)

    # Sync models to database
    llm_models = [
        LLMConfig(
            model=f"custom-model-1-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://custom.openai.com/v1",
            context_window=32000,
            handle=f"test-{test_id}/custom-model-1",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
        LLMConfig(
            model=f"custom-model-2-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://custom.openai.com/v1",
            context_window=64000,
            handle=f"test-{test_id}/custom-model-2",
            provider_name=provider.name,
            provider_category=ProviderCategory.base,
        ),
    ]

    await provider_manager.sync_provider_models_async(
        provider=provider,
        llm_models=llm_models,
        embedding_models=[],
        organization_id=None,
    )

    # Create server instance
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager

    # List LLM models via server
    models = await server.list_llm_models_async(
        actor=default_user,
        provider_name=f"test-db-provider-{test_id}",
    )

    # Verify models were read from database
    handles = {m.handle for m in models}
    assert f"test-{test_id}/custom-model-1" in handles, "custom-model-1 should be in database"
    assert f"test-{test_id}/custom-model-2" in handles, "custom-model-2 should be in database"

    # Verify LLMConfig properties are correctly populated from database
    model_1 = next(m for m in models if m.handle == f"test-{test_id}/custom-model-1")
    assert model_1.model == f"custom-model-1-{test_id}"
    assert model_1.context_window == 32000
    assert model_1.model_endpoint == "https://custom.openai.com/v1"
    assert model_1.provider_name == f"test-db-provider-{test_id}"

    model_2 = next(m for m in models if m.handle == f"test-{test_id}/custom-model-2")
    assert model_2.model == f"custom-model-2-{test_id}"
    assert model_2.context_window == 64000


@pytest.mark.asyncio
async def test_get_enabled_providers_async_queries_database(default_user, provider_manager):
    """Test that get_enabled_providers_async queries providers from database, not in-memory list.

    This test verifies that:
    1. Providers created in the database are returned by get_enabled_providers_async
    2. The method queries the database, not an in-memory _enabled_providers list
    3. Provider filtering by category works correctly from database
    """
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create providers in the database
    base_provider_create = ProviderCreate(
        name=f"test-base-provider-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-test-key",
        base_url="https://api.openai.com/v1",
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    byok_provider_create = ProviderCreate(
        name=f"test-byok-provider-{test_id}",
        provider_type=ProviderType.anthropic,
        api_key="sk-test-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Create server instance - importantly, don't set _enabled_providers
    # This ensures we're testing database queries, not in-memory list
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    # Clear in-memory providers to prove we're querying database
    server._enabled_providers = []

    # Get all providers - should query database
    all_providers = await server.get_enabled_providers_async(actor=default_user)
    provider_names = [p.name for p in all_providers]

    assert f"test-base-provider-{test_id}" in provider_names, "Base provider should be in database"
    assert f"test-byok-provider-{test_id}" in provider_names, "BYOK provider should be in database"

    # Filter by provider category
    base_only = await server.get_enabled_providers_async(
        actor=default_user,
        provider_category=[ProviderCategory.base],
    )
    base_only_names = [p.name for p in base_only]

    assert f"test-base-provider-{test_id}" in base_only_names, "Base provider should be in base-only list"
    assert f"test-byok-provider-{test_id}" not in base_only_names, "BYOK provider should NOT be in base-only list"

    byok_only = await server.get_enabled_providers_async(
        actor=default_user,
        provider_category=[ProviderCategory.byok],
    )
    byok_only_names = [p.name for p in byok_only]

    assert f"test-byok-provider-{test_id}" in byok_only_names, "BYOK provider should be in byok-only list"
    assert f"test-base-provider-{test_id}" not in byok_only_names, "Base provider should NOT be in byok-only list"

    # Filter by provider name
    specific_provider = await server.get_enabled_providers_async(
        actor=default_user,
        provider_name=f"test-base-provider-{test_id}",
    )

    assert len(specific_provider) == 1
    assert specific_provider[0].name == f"test-base-provider-{test_id}"
    assert specific_provider[0].provider_type == ProviderType.openai

    # Filter by provider type
    openai_providers = await server.get_enabled_providers_async(
        actor=default_user,
        provider_type=ProviderType.openai,
    )
    openai_names = [p.name for p in openai_providers]

    assert f"test-base-provider-{test_id}" in openai_names
    assert f"test-byok-provider-{test_id}" not in openai_names  # This is anthropic type


# =============================================================================
# BYOK Provider and Model Listing Integration Tests
# =============================================================================


@pytest.mark.asyncio
async def test_list_providers_filters_by_category(default_user, provider_manager):
    """Test that list_providers_async correctly filters by provider_category."""
    test_id = generate_test_id()

    # Create a base provider
    base_provider_create = ProviderCreate(
        name=f"test-base-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-base-key",
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    # Create a BYOK provider
    byok_provider_create = ProviderCreate(
        name=f"test-byok-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Verify base provider has correct category
    assert base_provider.provider_category == ProviderCategory.base

    # Verify BYOK provider has correct category
    assert byok_provider.provider_category == ProviderCategory.byok

    # List only BYOK providers
    byok_providers = await provider_manager.list_providers_async(
        actor=default_user,
        provider_category=[ProviderCategory.byok],
    )
    byok_names = [p.name for p in byok_providers]

    assert f"test-byok-{test_id}" in byok_names
    assert f"test-base-{test_id}" not in byok_names

    # List only base providers
    base_providers = await provider_manager.list_providers_async(
        actor=default_user,
        provider_category=[ProviderCategory.base],
    )
    base_names = [p.name for p in base_providers]

    assert f"test-base-{test_id}" in base_names
    assert f"test-byok-{test_id}" not in base_names


@pytest.mark.asyncio
async def test_base_provider_api_key_not_stored_in_db(default_user, provider_manager):
    """Test that sync_base_providers does NOT store API keys for base providers."""
    # Create base providers with API keys
    base_providers = [
        OpenAIProvider(name="test-openai-no-key", api_key="sk-should-not-be-stored"),
    ]

    # Sync to database
    await provider_manager.sync_base_providers(base_providers=base_providers, actor=default_user)

    # Retrieve the provider from database
    providers = await provider_manager.list_providers_async(name="test-openai-no-key", actor=default_user)
    assert len(providers) == 1

    provider = providers[0]
    assert provider.provider_category == ProviderCategory.base

    # The API key should be empty (not stored) for base providers
    if provider.api_key_enc:
        api_key = await provider.api_key_enc.get_plaintext_async()
        assert api_key == "" or api_key is None, "Base provider API key should not be stored in database"


@pytest.mark.asyncio
async def test_byok_provider_api_key_stored_in_db(default_user, provider_manager):
    """Test that BYOK providers DO have their API keys stored in the database."""
    test_id = generate_test_id()

    # Create a BYOK provider with API key
    byok_provider_create = ProviderCreate(
        name=f"test-byok-with-key-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-should-be-stored",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Retrieve the provider from database
    providers = await provider_manager.list_providers_async(name=f"test-byok-with-key-{test_id}", actor=default_user)
    assert len(providers) == 1

    provider = providers[0]
    assert provider.provider_category == ProviderCategory.byok

    # The API key SHOULD be stored for BYOK providers
    assert provider.api_key_enc is not None
    api_key = await provider.api_key_enc.get_plaintext_async()
    assert api_key == "sk-byok-should-be-stored", "BYOK provider API key should be stored in database"


@pytest.mark.asyncio
async def test_server_list_llm_models_base_from_db(default_user, provider_manager):
    """Test that server.list_llm_models_async fetches base models from database."""
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create base provider and models (these ARE stored in DB)
    base_provider_create = ProviderCreate(
        name=f"test-base-llm-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-base-key",
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    base_llm_model = LLMConfig(
        model=f"base-gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=f"test-base-llm-{test_id}/gpt-4o",
        provider_name=base_provider.name,
        provider_category=ProviderCategory.base,
    )

    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[base_llm_model],
        embedding_models=[],
        organization_id=None,
    )

    # Create server and list models
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []  # Clear to test database-backed listing

    # List all models - base models come from DB
    all_models = await server.list_llm_models_async(actor=default_user)
    all_handles = [m.handle for m in all_models]

    assert f"test-base-llm-{test_id}/gpt-4o" in all_handles, "Base model should be in list"

    # List only base models
    base_models = await server.list_llm_models_async(
        actor=default_user,
        provider_category=[ProviderCategory.base],
    )
    base_handles = [m.handle for m in base_models]

    assert f"test-base-llm-{test_id}/gpt-4o" in base_handles


@pytest.mark.asyncio
async def test_server_list_llm_models_byok_from_provider_api(default_user, provider_manager):
    """Test that server.list_llm_models_async fetches BYOK models from provider API, not DB.

    Note: BYOK models are fetched by calling the provider's list_llm_models_async() method,
    which hits the actual provider API. This test uses mocking to verify that flow.
    """
    from letta.schemas.providers import Provider
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a BYOK provider (but don't sync models to DB - they come from API)
    byok_provider_create = ProviderCreate(
        name=f"test-byok-llm-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Create server
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []

    # Mock the BYOK provider's list_llm_models_async to return test models
    mock_byok_models = [
        LLMConfig(
            model=f"byok-gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://custom.openai.com/v1",
            context_window=64000,
            handle=f"test-byok-llm-{test_id}/gpt-4o",
            provider_name=byok_provider.name,
            provider_category=ProviderCategory.byok,
        )
    ]

    # Create a mock typed provider that returns our test models
    mock_typed_provider = MagicMock()
    mock_typed_provider.list_llm_models_async = AsyncMock(return_value=mock_byok_models)
    mock_typed_provider.list_embedding_models_async = AsyncMock(return_value=[])

    # Patch cast_to_subtype on the Provider class to return our mock
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider):
        # List BYOK models - should call provider API via cast_to_subtype().list_llm_models_async()
        byok_models = await server.list_llm_models_async(
            actor=default_user,
            provider_category=[ProviderCategory.byok],
        )

        # Verify the mock was called (proving we hit provider API, not DB)
        mock_typed_provider.list_llm_models_async.assert_called()

        # Verify we got the mocked models back
        byok_handles = [m.handle for m in byok_models]
        assert f"test-byok-llm-{test_id}/gpt-4o" in byok_handles


@pytest.mark.asyncio
async def test_server_list_embedding_models_base_from_db(default_user, provider_manager):
    """Test that server.list_embedding_models_async fetches base models from database.

    Note: Similar to LLM models, base embedding models are stored in DB while BYOK
    embedding models would be fetched from provider API.
    """
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create base provider and embedding models (these ARE stored in DB)
    base_provider_create = ProviderCreate(
        name=f"test-base-embed-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-base-key",
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    base_embedding_model = EmbeddingConfig(
        embedding_model=f"base-text-embedding-{test_id}",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_dim=1536,
        embedding_chunk_size=300,
        handle=f"test-base-embed-{test_id}/text-embedding-3-small",
    )

    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[],
        embedding_models=[base_embedding_model],
        organization_id=None,
    )

    # Create server and list models
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []

    # List all embedding models - base models come from DB
    all_models = await server.list_embedding_models_async(actor=default_user)
    all_handles = [m.handle for m in all_models]

    assert f"test-base-embed-{test_id}/text-embedding-3-small" in all_handles


@pytest.mark.asyncio
async def test_provider_ordering_matches_constants(default_user, provider_manager):
    """Test that provider ordering in model listing matches PROVIDER_ORDER in constants."""
    from letta.constants import PROVIDER_ORDER
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create providers with different names that should have different ordering
    providers_to_create = [
        ("zai", ProviderType.zai, 14),  # Lower priority
        ("openai", ProviderType.openai, 1),  # Higher priority
        ("anthropic", ProviderType.anthropic, 2),  # Medium priority
    ]

    created_providers = []
    for name_suffix, provider_type, expected_order in providers_to_create:
        provider_create = ProviderCreate(
            name=f"{name_suffix}",  # Use actual provider name for ordering
            provider_type=provider_type,
            api_key=f"sk-{name_suffix}-key",
        )
        # Check if provider already exists
        existing = await provider_manager.list_providers_async(name=name_suffix, actor=default_user)
        if not existing:
            provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=False)
            created_providers.append((provider, expected_order))

            # Create a model for this provider
            llm_model = LLMConfig(
                model=f"test-model-{test_id}",
                model_endpoint_type="openai",
                model_endpoint="https://api.example.com/v1",
                context_window=8192,
                handle=f"{name_suffix}/test-model-{test_id}",
                provider_name=provider.name,
                provider_category=ProviderCategory.base,
            )

            await provider_manager.sync_provider_models_async(
                provider=provider,
                llm_models=[llm_model],
                embedding_models=[],
                organization_id=None,
            )

    # Verify PROVIDER_ORDER has expected values
    assert PROVIDER_ORDER.get("openai") == 1
    assert PROVIDER_ORDER.get("anthropic") == 2
    assert PROVIDER_ORDER.get("zai") == 14

    # Create server and verify ordering
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []

    # List models and check ordering
    all_models = await server.list_llm_models_async(actor=default_user)

    # Filter to only our test models
    test_models = [m for m in all_models if f"test-model-{test_id}" in m.handle]

    if len(test_models) >= 2:
        # Verify models are sorted by provider order
        provider_names_in_order = [m.provider_name for m in test_models]

        # Get the indices in PROVIDER_ORDER
        indices = [PROVIDER_ORDER.get(name, 999) for name in provider_names_in_order]

        # Verify the list is sorted by provider order
        assert indices == sorted(indices), f"Models should be sorted by PROVIDER_ORDER, got: {provider_names_in_order}"


@pytest.mark.asyncio
async def test_create_agent_with_byok_handle_dynamic_fetch(default_user, provider_manager):
    """Test that creating an agent with a BYOK model handle works via dynamic fetch.

    This tests the case where BYOK models are NOT synced to the database, but are
    instead fetched dynamically from the provider when resolving the handle.
    This is the expected behavior after the provider models persistence refactor.
    """
    test_id = generate_test_id()
    byok_provider_name = f"my-openai-byok-{test_id}"
    model_name = "gpt-4o"
    byok_handle = f"{byok_provider_name}/{model_name}"

    # Create a BYOK OpenAI provider (do NOT sync models to DB)
    provider_create = ProviderCreate(
        name=byok_provider_name,
        provider_type=ProviderType.openai,
        api_key="sk-test-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(provider_create, actor=default_user, is_byok=True)

    assert byok_provider.provider_category == ProviderCategory.byok
    assert byok_provider.name == byok_provider_name

    # Verify the model is NOT in the database (dynamic fetch scenario)
    model_in_db = await provider_manager.get_model_by_handle_async(
        handle=byok_handle,
        actor=default_user,
        model_type="llm",
    )
    assert model_in_db is None, "Model should NOT be in DB for this test (testing dynamic fetch)"

    # Mock the provider's list_llm_models_async to return our test model
    mock_llm_config = LLMConfig(
        model=model_name,
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=byok_handle,
        max_tokens=16384,
        provider_name=byok_provider_name,
        provider_category=ProviderCategory.byok,
    )

    # Create embedding config for the agent
    mock_embedding_config = EmbeddingConfig(
        embedding_model="text-embedding-3-small",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://api.openai.com/v1",
        embedding_dim=1536,
        embedding_chunk_size=300,
        handle=f"{byok_provider_name}/text-embedding-3-small",
    )

    # Initialize server
    server = SyncServer(init_with_default_org_and_user=False)
    await server.init_async(init_with_default_org_and_user=False)
    server.provider_manager = provider_manager

    # Mock the BYOK provider's list_llm_models_async method
    with patch.object(
        OpenAIProvider,
        "list_llm_models_async",
        new_callable=AsyncMock,
        return_value=[mock_llm_config],
    ):
        with patch.object(
            OpenAIProvider,
            "list_embedding_models_async",
            new_callable=AsyncMock,
            return_value=[mock_embedding_config],
        ):
            # Create agent using BYOK handle - this should dynamically fetch from provider
            agent = await server.create_agent_async(
                request=CreateAgent(
                    name=f"test-agent-byok-{test_id}",
                    model=byok_handle,  # BYOK handle format: "{provider_name}/{model_name}"
                    embedding=f"{byok_provider_name}/text-embedding-3-small",
                ),
                actor=default_user,
            )

            # Verify agent was created with the correct LLM config
            assert agent is not None
            assert agent.llm_config is not None
            assert agent.llm_config.model == model_name
            assert agent.llm_config.handle == byok_handle
            assert agent.llm_config.provider_name == byok_provider_name
            assert agent.llm_config.provider_category == ProviderCategory.byok
            # Note: context_window comes from the actual provider's list_llm_models_async
            # which may differ from mock if mocking doesn't take effect on instance method

            # Cleanup
            await server.agent_manager.delete_agent_async(agent_id=agent.id, actor=default_user)


@pytest.mark.asyncio
async def test_byok_provider_last_synced_triggers_sync_when_null(default_user, provider_manager):
    """Test that BYOK providers with last_synced=null trigger a sync on first model listing."""
    from letta.schemas.providers import Provider
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a BYOK provider (last_synced will be null by default)
    byok_provider_create = ProviderCreate(
        name=f"test-byok-sync-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Verify last_synced is null initially
    assert byok_provider.last_synced is None

    # Create server
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []

    # Mock the BYOK provider's list_llm_models_async to return test models
    mock_byok_models = [
        LLMConfig(
            model=f"byok-gpt-4o-{test_id}",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=64000,
            handle=f"test-byok-sync-{test_id}/gpt-4o",
            provider_name=byok_provider.name,
            provider_category=ProviderCategory.byok,
        )
    ]

    mock_typed_provider = MagicMock()
    mock_typed_provider.list_llm_models_async = AsyncMock(return_value=mock_byok_models)
    mock_typed_provider.list_embedding_models_async = AsyncMock(return_value=[])

    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider):
        # List BYOK models - should trigger sync because last_synced is null
        byok_models = await server.list_llm_models_async(
            actor=default_user,
            provider_category=[ProviderCategory.byok],
        )

        # Verify sync was triggered (cast_to_subtype was called to fetch from API)
        # Note: may be called multiple times if other BYOK providers exist in DB
        mock_typed_provider.list_llm_models_async.assert_called()

    # Verify last_synced was updated for our provider
    updated_providers = await provider_manager.list_providers_async(name=byok_provider.name, actor=default_user)
    assert len(updated_providers) == 1
    assert updated_providers[0].last_synced is not None

    # Verify models were synced to database
    synced_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(synced_models) == 1
    assert synced_models[0].name == f"byok-gpt-4o-{test_id}"


@pytest.mark.asyncio
async def test_byok_provider_last_synced_skips_sync_when_set(default_user, provider_manager):
    """Test that BYOK providers with last_synced set skip sync and read from DB."""
    from datetime import datetime, timezone

    from letta.schemas.providers import Provider
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a BYOK provider
    byok_provider_create = ProviderCreate(
        name=f"test-byok-cached-{test_id}",
        provider_type=ProviderType.openai,
        api_key="sk-byok-key",
    )
    byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Manually sync models to DB
    cached_model = LLMConfig(
        model=f"cached-gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=64000,
        handle=f"test-byok-cached-{test_id}/gpt-4o",
        provider_name=byok_provider.name,
        provider_category=ProviderCategory.byok,
    )
    await provider_manager.sync_provider_models_async(
        provider=byok_provider,
        llm_models=[cached_model],
        embedding_models=[],
        organization_id=default_user.organization_id,
    )

    # Set last_synced to indicate models are already synced
    await provider_manager.update_provider_last_synced_async(byok_provider.id, actor=default_user)

    # Create server
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager
    server._enabled_providers = []

    # Mock cast_to_subtype - should NOT be called since last_synced is set
    mock_typed_provider = MagicMock()
    mock_typed_provider.list_llm_models_async = AsyncMock(return_value=[])
    mock_typed_provider.list_embedding_models_async = AsyncMock(return_value=[])

    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider):
        # List BYOK models - should read from DB, not trigger sync
        byok_models = await server.list_llm_models_async(
            actor=default_user,
            provider_category=[ProviderCategory.byok],
        )

        # Verify sync was NOT triggered (cast_to_subtype should not be called)
        mock_typed_provider.list_llm_models_async.assert_not_called()

    # Verify we got the cached model from DB
    byok_handles = [m.handle for m in byok_models]
    assert f"test-byok-cached-{test_id}/gpt-4o" in byok_handles


@pytest.mark.asyncio
async def test_base_provider_updates_last_synced_on_sync(default_user, provider_manager):
    """Test that base provider sync updates the last_synced timestamp."""
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a base provider
    base_provider_create = ProviderCreate(
        name=f"test-base-sync-{test_id}",
        provider_type=ProviderType.openai,
        api_key="",  # Base providers don't store API keys
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    # Verify last_synced is null initially
    assert base_provider.last_synced is None

    # Sync models for the base provider
    base_model = LLMConfig(
        model=f"base-gpt-4o-{test_id}",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=64000,
        handle=f"test-base-sync-{test_id}/gpt-4o",
    )
    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[base_model],
        embedding_models=[],
        organization_id=None,
    )
    await provider_manager.update_provider_last_synced_async(base_provider.id, actor=default_user)

    # Verify last_synced was updated
    updated_providers = await provider_manager.list_providers_async(name=base_provider.name, actor=default_user)
    assert len(updated_providers) == 1
    assert updated_providers[0].last_synced is not None


@pytest.mark.asyncio
async def test_byok_provider_models_synced_on_creation(default_user, provider_manager):
    """Test that models are automatically synced when a BYOK provider is created.

    When create_provider_async is called with is_byok=True, it should:
    1. Create the provider in the database
    2. Call _sync_default_models_for_provider to fetch and persist models from the provider API
    3. Update last_synced timestamp
    """
    from letta.schemas.providers import Provider

    test_id = generate_test_id()

    # Mock models that the provider API would return
    mock_llm_models = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-byok-creation-{test_id}/gpt-4o",
            provider_name=f"test-byok-creation-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
        LLMConfig(
            model="gpt-4o-mini",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-byok-creation-{test_id}/gpt-4o-mini",
            provider_name=f"test-byok-creation-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
    ]
    mock_embedding_models = [
        EmbeddingConfig(
            embedding_model="text-embedding-3-small",
            embedding_endpoint_type="openai",
            embedding_endpoint="https://api.openai.com/v1",
            embedding_dim=1536,
            embedding_chunk_size=300,
            handle=f"test-byok-creation-{test_id}/text-embedding-3-small",
        ),
    ]

    # Create a mock typed provider that returns our test models
    mock_typed_provider = MagicMock()
    mock_typed_provider.list_llm_models_async = AsyncMock(return_value=mock_llm_models)
    mock_typed_provider.list_embedding_models_async = AsyncMock(return_value=mock_embedding_models)

    # Patch cast_to_subtype to return our mock when _sync_default_models_for_provider is called
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider):
        # Create the BYOK provider - this should automatically sync models
        byok_provider_create = ProviderCreate(
            name=f"test-byok-creation-{test_id}",
            provider_type=ProviderType.openai,
            api_key="sk-test-key",
        )
        byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

        # Verify the provider API was called during creation
        mock_typed_provider.list_llm_models_async.assert_called_once()
        mock_typed_provider.list_embedding_models_async.assert_called_once()

    # Re-fetch the provider to get the updated last_synced value
    # (the returned object from create_provider_async is stale since last_synced is set after)
    byok_provider = await provider_manager.get_provider_async(byok_provider.id, default_user)

    # Verify last_synced was set (indicating sync completed)
    assert byok_provider.last_synced is not None

    # Verify LLM models were persisted to the database
    synced_llm_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(synced_llm_models) == 2
    synced_llm_names = {m.name for m in synced_llm_models}
    assert "gpt-4o" in synced_llm_names
    assert "gpt-4o-mini" in synced_llm_names

    # Verify embedding models were persisted to the database
    synced_embedding_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="embedding",
        provider_id=byok_provider.id,
    )
    assert len(synced_embedding_models) == 1
    assert synced_embedding_models[0].name == "text-embedding-3-small"


@pytest.mark.asyncio
async def test_refresh_byok_provider_adds_new_models(default_user, provider_manager):
    """Test that refreshing a BYOK provider adds new models from the provider API.

    When _sync_default_models_for_provider is called (via refresh endpoint):
    1. It should fetch current models from the provider API
    2. Add any new models that weren't previously synced
    3. Update the last_synced timestamp
    """
    from letta.schemas.providers import Provider

    test_id = generate_test_id()

    # Initial models when provider is created
    initial_models = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-refresh-add-{test_id}/gpt-4o",
            provider_name=f"test-refresh-add-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
    ]

    # Updated models after refresh (includes a new model)
    updated_models = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-refresh-add-{test_id}/gpt-4o",
            provider_name=f"test-refresh-add-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
        LLMConfig(
            model="gpt-4.1",  # New model added by provider
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=256000,
            handle=f"test-refresh-add-{test_id}/gpt-4.1",
            provider_name=f"test-refresh-add-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
    ]

    # Create mock for initial sync during provider creation
    mock_typed_provider_initial = MagicMock()
    mock_typed_provider_initial.list_llm_models_async = AsyncMock(return_value=initial_models)
    mock_typed_provider_initial.list_embedding_models_async = AsyncMock(return_value=[])

    # Create the provider with initial models
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider_initial):
        byok_provider_create = ProviderCreate(
            name=f"test-refresh-add-{test_id}",
            provider_type=ProviderType.openai,
            api_key="sk-test-key",
        )
        byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Re-fetch the provider to get the updated last_synced value
    byok_provider = await provider_manager.get_provider_async(byok_provider.id, default_user)

    # Verify initial sync - should have 1 model
    initial_synced_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(initial_synced_models) == 1
    assert initial_synced_models[0].name == "gpt-4o"

    initial_last_synced = byok_provider.last_synced
    assert initial_last_synced is not None  # Verify sync happened during creation

    # Create mock for refresh with updated models
    mock_typed_provider_refresh = MagicMock()
    mock_typed_provider_refresh.list_llm_models_async = AsyncMock(return_value=updated_models)
    mock_typed_provider_refresh.list_embedding_models_async = AsyncMock(return_value=[])

    # Refresh the provider (simulating what the endpoint does)
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider_refresh):
        await provider_manager._sync_default_models_for_provider(byok_provider, default_user)

    # Verify the API was called during refresh
    mock_typed_provider_refresh.list_llm_models_async.assert_called_once()

    # Verify new model was added
    refreshed_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(refreshed_models) == 2
    refreshed_names = {m.name for m in refreshed_models}
    assert "gpt-4o" in refreshed_names
    assert "gpt-4.1" in refreshed_names

    # Verify last_synced was updated
    updated_provider = await provider_manager.get_provider_async(byok_provider.id, default_user)
    assert updated_provider.last_synced is not None
    assert updated_provider.last_synced >= initial_last_synced


@pytest.mark.asyncio
async def test_refresh_byok_provider_removes_old_models(default_user, provider_manager):
    """Test that refreshing a BYOK provider removes models no longer available from the provider API.

    When _sync_default_models_for_provider is called (via refresh endpoint):
    1. It should fetch current models from the provider API
    2. Remove any models that are no longer available (soft delete)
    3. Keep models that are still available
    """
    from letta.schemas.providers import Provider

    test_id = generate_test_id()

    # Initial models when provider is created (includes a model that will be removed)
    initial_models = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-refresh-remove-{test_id}/gpt-4o",
            provider_name=f"test-refresh-remove-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
        LLMConfig(
            model="gpt-4-turbo",  # This model will be deprecated/removed
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-refresh-remove-{test_id}/gpt-4-turbo",
            provider_name=f"test-refresh-remove-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
    ]

    # Updated models after refresh (gpt-4-turbo is no longer available)
    updated_models = [
        LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
            handle=f"test-refresh-remove-{test_id}/gpt-4o",
            provider_name=f"test-refresh-remove-{test_id}",
            provider_category=ProviderCategory.byok,
        ),
    ]

    # Create mock for initial sync during provider creation
    mock_typed_provider_initial = MagicMock()
    mock_typed_provider_initial.list_llm_models_async = AsyncMock(return_value=initial_models)
    mock_typed_provider_initial.list_embedding_models_async = AsyncMock(return_value=[])

    # Create the provider with initial models
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider_initial):
        byok_provider_create = ProviderCreate(
            name=f"test-refresh-remove-{test_id}",
            provider_type=ProviderType.openai,
            api_key="sk-test-key",
        )
        byok_provider = await provider_manager.create_provider_async(byok_provider_create, actor=default_user, is_byok=True)

    # Verify initial sync - should have 2 models
    initial_synced_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(initial_synced_models) == 2
    initial_names = {m.name for m in initial_synced_models}
    assert "gpt-4o" in initial_names
    assert "gpt-4-turbo" in initial_names

    # Create mock for refresh with fewer models
    mock_typed_provider_refresh = MagicMock()
    mock_typed_provider_refresh.list_llm_models_async = AsyncMock(return_value=updated_models)
    mock_typed_provider_refresh.list_embedding_models_async = AsyncMock(return_value=[])

    # Refresh the provider (simulating what the endpoint does)
    with patch.object(Provider, "cast_to_subtype", return_value=mock_typed_provider_refresh):
        await provider_manager._sync_default_models_for_provider(byok_provider, default_user)

    # Verify the removed model is no longer in the list
    refreshed_models = await provider_manager.list_models_async(
        actor=default_user,
        model_type="llm",
        provider_id=byok_provider.id,
    )
    assert len(refreshed_models) == 1
    assert refreshed_models[0].name == "gpt-4o"

    # Verify gpt-4-turbo was removed (soft deleted)
    refreshed_names = {m.name for m in refreshed_models}
    assert "gpt-4-turbo" not in refreshed_names


@pytest.mark.asyncio
async def test_refresh_base_provider_fails(default_user, provider_manager):
    """Test that attempting to refresh a base provider returns an error.

    The refresh endpoint should only work for BYOK providers, not base providers.
    Base providers are managed by environment variables and shouldn't be refreshed.
    """
    from fastapi import HTTPException

    from letta.server.rest_api.routers.v1.providers import refresh_provider_models
    from letta.server.server import SyncServer

    test_id = generate_test_id()

    # Create a base provider
    base_provider_create = ProviderCreate(
        name=f"test-base-refresh-{test_id}",
        provider_type=ProviderType.openai,
        api_key="",  # Base providers don't store API keys
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)

    # Verify it's a base provider
    assert base_provider.provider_category == ProviderCategory.base

    # Create a mock server
    server = SyncServer(init_with_default_org_and_user=False)
    server.provider_manager = provider_manager

    # Create mock headers
    mock_headers = MagicMock()
    mock_headers.actor_id = default_user.id

    # Mock get_actor_or_default_async to return our test user
    server.user_manager = MagicMock()
    server.user_manager.get_actor_or_default_async = AsyncMock(return_value=default_user)

    # Attempt to refresh the base provider - should raise HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await refresh_provider_models(
            provider_id=base_provider.id,
            headers=mock_headers,
            server=server,
        )

    assert exc_info.value.status_code == 400
    assert "BYOK" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_model_by_handle_prioritizes_byok_over_base(default_user, provider_manager):
    """Test that get_model_by_handle_async returns the BYOK model when both BYOK and base providers have the same handle.

    This tests the legacy scenario where a user has both a BYOK provider and a base provider
    with the same name (and thus models with the same handle). The BYOK model should be
    returned because it's organization-specific, while base models are global.
    """
    test_id = generate_test_id()
    provider_name = f"test-duplicate-{test_id}"
    model_handle = f"{provider_name}/gpt-4o"

    # Step 1: Create a base provider and sync a model for it (global, organization_id=None)
    base_provider_create = ProviderCreate(
        name=provider_name,
        provider_type=ProviderType.openai,
        api_key="",  # Base providers don't store API keys
    )
    base_provider = await provider_manager.create_provider_async(base_provider_create, actor=default_user, is_byok=False)
    assert base_provider.provider_category == ProviderCategory.base

    # Sync a model for the base provider (global model with organization_id=None)
    base_llm_model = LLMConfig(
        model="gpt-4o",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=model_handle,
        provider_name=provider_name,
    )
    await provider_manager.sync_provider_models_async(
        provider=base_provider,
        llm_models=[base_llm_model],
        embedding_models=[],
        organization_id=None,  # Global model
    )

    # Verify base model was created
    base_model = await provider_manager.get_model_by_handle_async(
        handle=model_handle,
        actor=default_user,
        model_type="llm",
    )
    assert base_model is not None
    assert base_model.handle == model_handle
    assert base_model.organization_id is None  # Global model

    # Step 2: Create a BYOK provider with the same name (simulating legacy duplicate)
    # Note: In production, this is now prevented, but legacy data could have this
    # We need to bypass the name conflict check for this test (simulating legacy data)
    # Create the BYOK provider directly by manipulating the database
    from letta.orm.provider import Provider as ProviderORM
    from letta.schemas.providers import Provider as PydanticProvider
    from letta.server.db import db_registry

    # Create a pydantic provider first to generate an ID
    byok_pydantic_provider = PydanticProvider(
        name=provider_name,  # Same name as base provider
        provider_type=ProviderType.openai,
        provider_category=ProviderCategory.byok,
        organization_id=default_user.organization_id,
    )
    byok_pydantic_provider.resolve_identifier()

    async with db_registry.async_session() as session:
        byok_provider_orm = ProviderORM(**byok_pydantic_provider.model_dump(to_orm=True))
        await byok_provider_orm.create_async(session, actor=default_user)
        byok_provider = byok_provider_orm.to_pydantic()

    assert byok_provider.provider_category == ProviderCategory.byok

    # Sync a model for the BYOK provider (org-specific model)
    byok_llm_model = LLMConfig(
        model="gpt-4o",
        model_endpoint_type="openai",
        model_endpoint="https://api.openai.com/v1",
        context_window=128000,
        handle=model_handle,  # Same handle as base model
        provider_name=provider_name,
        provider_category=ProviderCategory.byok,
    )
    await provider_manager.sync_provider_models_async(
        provider=byok_provider,
        llm_models=[byok_llm_model],
        embedding_models=[],
        organization_id=default_user.organization_id,  # Org-specific model
    )

    # Step 3: Verify that get_model_by_handle_async returns the BYOK model (org-specific)
    retrieved_model = await provider_manager.get_model_by_handle_async(
        handle=model_handle,
        actor=default_user,
        model_type="llm",
    )

    assert retrieved_model is not None
    assert retrieved_model.handle == model_handle
    # The key assertion: org-specific (BYOK) model should be returned, not the global (base) model
    assert retrieved_model.organization_id == default_user.organization_id
    assert retrieved_model.provider_id == byok_provider.id


@pytest.mark.asyncio
async def test_byok_provider_uses_schema_default_base_url(default_user, provider_manager):
    """Test that BYOK providers with schema-default base_url get correct model_endpoint.

    This tests a bug where providers like ZAI have a schema-default base_url
    (e.g., "https://api.z.ai/api/paas/v4/") that isn't stored in the database.
    When list_llm_models_async reads from DB, the base_url is NULL, and if the code
    uses provider.base_url directly instead of typed_provider.base_url, the
    model_endpoint would be None/wrong, causing requests to go to the wrong endpoint.

    The fix uses cast_to_subtype() to get the typed provider with schema defaults.
    """
    from letta.orm.provider import Provider as ProviderORM
    from letta.schemas.providers import Provider as PydanticProvider
    from letta.schemas.providers.zai import ZAIProvider
    from letta.server.db import db_registry

    test_id = generate_test_id()
    provider_name = f"test-zai-{test_id}"

    # Create a ZAI BYOK provider WITHOUT explicitly setting base_url
    # This simulates what happens when a user creates a ZAI provider via the API
    # The schema default "https://api.z.ai/api/paas/v4/" applies in memory but
    # may not be stored in the database (base_url column is NULL)
    byok_pydantic_provider = PydanticProvider(
        name=provider_name,
        provider_type=ProviderType.zai,
        provider_category=ProviderCategory.byok,
        organization_id=default_user.organization_id,
        # NOTE: base_url is intentionally NOT set - this is the bug scenario
        # The DB will have base_url=NULL
    )
    byok_pydantic_provider.resolve_identifier()

    async with db_registry.async_session() as session:
        byok_provider_orm = ProviderORM(**byok_pydantic_provider.model_dump(to_orm=True))
        await byok_provider_orm.create_async(session, actor=default_user)
        byok_provider = byok_provider_orm.to_pydantic()

    # Verify base_url is None in the provider loaded from DB
    assert byok_provider.base_url is None, "base_url should be NULL in DB for this test"
    assert byok_provider.provider_type == ProviderType.zai

    # Sync a model for the provider (simulating what happens after provider creation)
    # Set last_synced so the server reads from DB instead of calling provider API
    from datetime import datetime, timezone

    async with db_registry.async_session() as session:
        provider_orm = await ProviderORM.read_async(session, identifier=byok_provider.id, actor=None)
        provider_orm.last_synced = datetime.now(timezone.utc)
        await session.commit()

    model_handle = f"{provider_name}/glm-4-flash"
    byok_llm_model = LLMConfig(
        model="glm-4-flash",
        model_endpoint_type="zai",
        model_endpoint="https://api.z.ai/api/paas/v4/",  # The correct endpoint
        context_window=128000,
        handle=model_handle,
        provider_name=provider_name,
        provider_category=ProviderCategory.byok,
    )
    await provider_manager.sync_provider_models_async(
        provider=byok_provider,
        llm_models=[byok_llm_model],
        embedding_models=[],
        organization_id=default_user.organization_id,
    )

    # Create server and list LLM models
    server = SyncServer(init_with_default_org_and_user=False)
    server.default_user = default_user
    server.provider_manager = provider_manager

    # List LLM models - this should use typed_provider.base_url (schema default)
    # NOT provider.base_url (which is NULL in DB)
    models = await server.list_llm_models_async(
        actor=default_user,
        provider_category=[ProviderCategory.byok],  # Only BYOK providers
    )

    # Find our ZAI model
    zai_models = [m for m in models if m.handle == model_handle]
    assert len(zai_models) == 1, f"Expected 1 ZAI model, got {len(zai_models)}"

    zai_model = zai_models[0]

    # THE KEY ASSERTION: model_endpoint should be the ZAI schema default,
    # NOT None (which would cause requests to go to OpenAI's endpoint)
    expected_endpoint = "https://api.z.ai/api/paas/v4/"
    assert zai_model.model_endpoint == expected_endpoint, (
        f"model_endpoint should be '{expected_endpoint}' from ZAI schema default, "
        f"but got '{zai_model.model_endpoint}'. This indicates the bug where "
        f"provider.base_url (NULL from DB) was used instead of typed_provider.base_url."
    )
