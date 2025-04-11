from conftest import create_test_module
from letta_client.errors import UnprocessableEntityError

BLOCKS_CREATE_PARAMS = [
    ("human_block", {"label": "human", "value": "test"}, {"limit": 5000}, None),
    ("persona_block", {"label": "persona", "value": "test1"}, {"limit": 5000}, None),
]

BLOCKS_MODIFY_PARAMS = [
    ("human_block", {"value": "test2"}, {}, None),
    ("persona_block", {"value": "testing testing testing", "limit": 10}, {}, UnprocessableEntityError),
]

BLOCKS_LIST_PARAMS = [
    ({}, 2),
    ({"label": "human"}, 1),
    ({"label": "persona"}, 1),
]

# Create all test module components at once
globals().update(
    create_test_module(
        resource_name="blocks",
        id_param_name="block_id",
        create_params=BLOCKS_CREATE_PARAMS,
        modify_params=BLOCKS_MODIFY_PARAMS,
        list_params=BLOCKS_LIST_PARAMS,
    )
)
