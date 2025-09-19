EXPERIMENTAL_NS = "LETTA_FLAG"

# user_eligible = actor.organization_id not in ["org-4a3af5dd-4c6a-48cb-ac13-3f73ecaaa4bf", "org-4ab3f6e8-9a44-4bee-aeb6-c681cbbc7bf6"]
org11x = (
    "org-4a3af5dd-4c6a-48cb-ac13-3f73ecaaa4bf",
    "org-4ab3f6e8-9a44-4bee-aeb6-c681cbbc7bf6",
)


async def is_experimental_enabled(feature_name: str, **kwargs) -> bool:
    """Fetches the experimental flag from redis. This is not limited to org filtering,
    but the usages below are just on the org level right now.
    """
    # base_key = f"{EXPERIMENTAL_NS}_{feature_name.upper()}_ORG"
    # redis_client = await get_redis_client()

    # if feature_name in ("async_agent_loop", "summarize"):
    #     if not (kwargs.get("eligibility", False) and settings.use_experimental):
    #         return False
    #     if kwargs.get("actor"):
    #         organization_id = kwargs["actor"].organization_id
    #         # LETTA_FLAG_ASYNC_AGENT_LOOP_ORG_{INCLUDE,EXCLUDE}
    #         return await redis_client.check_inclusion_and_exclusion(member=organization_id, group=base_key)
    #     else:
    #         return True

    # Err on safety here, disabling experimental if not handled here.
    return False
