from letta.services.helpers.agent_manager_helper import safe_format

CORE_MEMORY_VAR = "My core memory is that I like to eat bananas"
VARS_DICT = {"CORE_MEMORY": CORE_MEMORY_VAR}


def test_formatter():

    # Example system prompt that has no vars
    NO_VARS = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    """

    assert NO_VARS == safe_format(NO_VARS, VARS_DICT)

    # Example system prompt that has {CORE_MEMORY}
    CORE_MEMORY_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {CORE_MEMORY}
    """

    CORE_MEMORY_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    My core memory is that I like to eat bananas
    """

    assert CORE_MEMORY_VAR_SOL == safe_format(CORE_MEMORY_VAR, VARS_DICT)

    # Example system prompt that has {CORE_MEMORY} and {USER_MEMORY} (latter doesn't exist)
    UNUSED_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {USER_MEMORY}
    {CORE_MEMORY}
    """

    UNUSED_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {USER_MEMORY}
    My core memory is that I like to eat bananas
    """

    assert UNUSED_VAR_SOL == safe_format(UNUSED_VAR, VARS_DICT)

    # Example system prompt that has {CORE_MEMORY} and {USER_MEMORY} (latter doesn't exist), AND an empty {}
    UNUSED_AND_EMPRY_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {}
    {USER_MEMORY}
    {CORE_MEMORY}
    """

    UNUSED_AND_EMPRY_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {}
    {USER_MEMORY}
    My core memory is that I like to eat bananas
    """

    assert UNUSED_AND_EMPRY_VAR_SOL == safe_format(UNUSED_AND_EMPRY_VAR, VARS_DICT)
