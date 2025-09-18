from letta.data_sources.redis_client import get_redis_client
from letta.services.agent_manager import AgentManager


async def is_experimental_okay(feature_name: str, **kwargs) -> bool:
    print(feature_name, kwargs)
    if feature_name == "test_pass_with_kwarg":
        return isinstance(kwargs["agent_manager"], AgentManager)
    if feature_name == "test_just_pass":
        return True
    if feature_name == "test_fail":
        return False
    if feature_name == "test_override_kwarg":
        return kwargs["bool_val"]
    if feature_name == "test_redis_flag":
        client = await get_redis_client()
        user_id = kwargs["user_id"]
        return await client.check_inclusion_and_exclusion(member=user_id, group="TEST_GROUP")
    # Err on safety here, disabling experimental if not handled here.
    return False
