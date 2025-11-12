from conftest import create_test_module

# Sample code for tools
FRIENDLY_FUNC_SOURCE_CODE = '''
def friendly_func():
    """
    Returns a friendly message.

    Returns:
        str: A friendly message.
    """
    return "HI HI HI HI HI!"
'''

UNFRIENDLY_FUNC_SOURCE_CODE = '''
def unfriendly_func():
    """
    Returns an unfriendly message.

    Returns:
        str: An unfriendly message.
    """
    return "NO NO NO NO NO!"
'''

UNFRIENDLY_FUNC_SOURCE_CODE_V2 = '''
def unfriendly_func():
    """
    Returns an unfriendly message.

    Returns:
        str: An unfriendly message.
    """
    return "BYE BYE BYE BYE BYE!"
'''

# Define test parameters for tools
TOOLS_CREATE_PARAMS = [
    ("friendly_func", {"source_code": FRIENDLY_FUNC_SOURCE_CODE}, {"name": "friendly_func"}, None),
    ("unfriendly_func", {"source_code": UNFRIENDLY_FUNC_SOURCE_CODE}, {"name": "unfriendly_func"}, None),
]

TOOLS_UPSERT_PARAMS = [
    ("unfriendly_func", {"source_code": UNFRIENDLY_FUNC_SOURCE_CODE_V2}, {}, None),
]

TOOLS_UPDATE_PARAMS = [
    ("friendly_func", {"tags": ["sdk_test"]}, {}, None),
    ("unfriendly_func", {"return_char_limit": 300}, {}, None),
]

TOOLS_LIST_PARAMS = [
    ({}, 2),
    ({"name": "friendly_func"}, 1),
]

# Create all test module components at once
globals().update(
    create_test_module(
        resource_name="tools",
        id_param_name="tool_id",
        create_params=TOOLS_CREATE_PARAMS,
        upsert_params=TOOLS_UPSERT_PARAMS,
        update_params=TOOLS_UPDATE_PARAMS,
        list_params=TOOLS_LIST_PARAMS,
    )
)
