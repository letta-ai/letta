import pytest

from letta.data_sources.redis_client import get_redis_client


@pytest.mark.asyncio
async def test_redis_client():
    test_values = {"LETTA_TEST_0": [1, 2, 3], "LETTA_TEST_1": ["apple", "pear", "banana"], "LETTA_TEST_2": ["{}", 3.2, "cat"]}
    redis_client = await get_redis_client()

    # Clear out keys
    await redis_client.delete(*test_values.keys())

    # Add items
    for k, v in test_values.items():
        assert await redis_client.sadd(k, *v) == 3

    # Check Membership
    for k, v in test_values.items():
        assert await redis_client.smembers(k) == set(str(val) for val in v)

    for k, v in test_values.items():
        assert await redis_client.smismember(k, "invalid") == 0
        assert await redis_client.smismember(k, v[0]) == 1
        assert await redis_client.smismember(k, v[:2]) == [1, 1]
        assert await redis_client.smismember(k, v[2:] + ["invalid"]) == [1, 0]
