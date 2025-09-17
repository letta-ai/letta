import pytest

from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.helpers.decorators import experimental
from letta.settings import settings


@pytest.mark.asyncio
async def test_default_experimental_decorator():
    settings.plugin_register = "experimental_check=tests.helpers.plugins_helper:is_experimental_okay"

    @experimental("test_just_pass", fallback_function=lambda: False, kwarg1=3)
    def _return_true():
        return True

    assert _return_true()
    settings.plugin_register = ""


@pytest.mark.asyncio
async def test_overwrite_arg_success():
    settings.plugin_register = "experimental_check=tests.helpers.plugins_helper:is_experimental_okay"

    @experimental("test_override_kwarg", fallback_function=lambda *args, **kwargs: False, bool_val=True)
    async def _return_true(a_val: bool, bool_val: bool):
        assert bool_val is False
        return True

    assert _return_true(False, False)
    settings.plugin_register = ""


@pytest.mark.asyncio
async def test_overwrite_arg_fail():
    # Should fallback to lambda
    settings.plugin_register = "experimental_check=tests.helpers.plugins_helper:is_experimental_okay"

    @experimental("test_override_kwarg", fallback_function=lambda *args, **kwargs: True, bool_val=False)
    async def _return_false(a_val: bool, bool_val: bool):
        assert bool_val is True
        return False

    assert _return_false(False, True)

    @experimental("test_override_kwarg", fallback_function=lambda *args, **kwargs: False, bool_val=True)
    async def _return_true(a_val: bool, bool_val: bool):
        assert bool_val is False
        return True

    assert _return_true(False, bool_val=False)

    @experimental("test_override_kwarg", fallback_function=lambda *args, **kwargs: True)
    async def _get_true(a_val: bool, bool_val: bool):
        return True

    assert await _get_true(True, bool_val=True)
    with pytest.raises(Exception):
        # kwarg must be included in either experimental flag or function call
        assert await _get_true(True, True)
    settings.plugin_register = ""


@pytest.mark.asyncio
async def test_redis_flag():
    settings.plugin_register = "experimental_check=tests.helpers.plugins_helper:is_experimental_okay"

    @experimental("test_redis_flag", fallback_function=lambda *args, **kwargs: _raise())
    async def _new_feature(user_id: str) -> str:
        return "new_feature"

    def _raise():
        raise Exception()

    redis_client = await get_redis_client()

    group_name = "TEST_GROUP"
    include_key = redis_client._get_group_inclusion_key(group_name)
    exclude_key = redis_client._get_group_exclusion_key(group_name)
    test_user = "user123"
    # reset
    for member in await redis_client.smembers(include_key):
        await redis_client.srem(include_key, member)
    for member in await redis_client.smembers(exclude_key):
        await redis_client.srem(exclude_key, member)

    await redis_client.create_inclusion_exclusion_keys(group=group_name)
    await redis_client.sadd(include_key, test_user)

    if not isinstance(redis_client, NoopAsyncRedisClient):
        assert await _new_feature(user_id=test_user) == "new_feature"
        with pytest.raises(Exception):
            await _new_feature(user_id=test_user + "1")
        print("members: ", await redis_client.smembers(include_key))
    else:
        with pytest.raises(Exception):
            await _new_feature(user_id=test_user)
