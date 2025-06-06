from letta.settings import settings


def is_experimental_enabled(feature_name: str, **kwargs) -> bool:
    if feature_name in ("async_agent_loop", "summarize"):
        if not (kwargs.get("eligibility", False) and settings.use_experimental):
            return False
        return True

    # Err on safety here, disabling experimental if not handled here.
    return False
