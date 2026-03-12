import pytest

# Import shared fixtures and constants from conftest
from letta.constants import (
    DEFAULT_ORG_ID,
)
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.helpers.datetime_helpers import AsyncTimer
from letta.schemas.organization import Organization as PydanticOrganization
from letta.schemas.user import User as PydanticUser, UserUpdate
from letta.server.server import SyncServer


# ======================================================================================================================
# User Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_users(server: SyncServer):
    # Create default organization
    org = await server.organization_manager.create_default_organization_async()

    user_name = "user"
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name, organization_id=org.id))

    users = await server.user_manager.list_actors_async()
    assert len(users) == 1
    assert users[0].name == user_name

    # Delete it after
    await server.user_manager.delete_actor_by_id_async(user.id)
    assert len(await server.user_manager.list_actors_async()) == 0


@pytest.mark.asyncio
async def test_create_default_user(server: SyncServer):
    org = await server.organization_manager.create_default_organization_async()
    await server.user_manager.create_default_actor_async(org_id=org.id)
    retrieved = await server.user_manager.get_default_actor_async()
    assert retrieved.name == server.user_manager.DEFAULT_USER_NAME


@pytest.mark.asyncio
async def test_update_user(server: SyncServer):
    # Create default organization
    default_org = await server.organization_manager.create_default_organization_async()
    test_org = await server.organization_manager.create_organization_async(PydanticOrganization(name="test_org"))

    user_name_a = "a"
    user_name_b = "b"

    # Assert it's been created
    user = await server.user_manager.create_actor_async(PydanticUser(name=user_name_a, organization_id=default_org.id))
    assert user.name == user_name_a

    # Adjust name
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, name=user_name_b))
    assert user.name == user_name_b
    assert user.organization_id == DEFAULT_ORG_ID

    # Adjust org id
    user = await server.user_manager.update_actor_async(UserUpdate(id=user.id, organization_id=test_org.id))
    assert user.name == user_name_b
    assert user.organization_id == test_org.id


async def test_user_caching(server: SyncServer, default_user, performance_pct=0.4):
    if isinstance(await get_redis_client(), NoopAsyncRedisClient):
        pytest.skip("redis not available")
    # Invalidate previous cache behavior.
    await server.user_manager._invalidate_actor_cache(default_user.id)
    before_stats = server.user_manager.get_actor_by_id_async.cache_stats
    before_cache_misses = before_stats.misses
    before_cache_hits = before_stats.hits

    # First call (expected to miss the cache)
    async with AsyncTimer() as timer:
        actor = await server.user_manager.get_actor_by_id_async(default_user.id)
    duration_first = timer.elapsed_ns
    print(f"Call 1: {duration_first:.2e}ns")
    assert actor.id == default_user.id
    assert duration_first > 0  # Sanity check: took non-zero time
    cached_hits = 10
    durations = []
    for i in range(cached_hits):
        async with AsyncTimer() as timer:
            actor_cached = await server.user_manager.get_actor_by_id_async(default_user.id)
        duration = timer.elapsed_ns
        durations.append(duration)
        print(f"Call {i + 2}: {duration:.2e}ns")
        assert actor_cached == actor
    for d in durations:
        assert d < duration_first * performance_pct
    stats = server.user_manager.get_actor_by_id_async.cache_stats

    print(f"Before calls: {before_stats}")
    print(f"After calls: {stats}")
    # Assert cache stats
    assert stats.misses - before_cache_misses == 1
    assert stats.hits - before_cache_hits == cached_hits
