from conftest import create_test_module
from letta_client import UnprocessableEntityError

from letta.constants import CORE_MEMORY_HUMAN_CHAR_LIMIT, CORE_MEMORY_PERSONA_CHAR_LIMIT

BLOCKS_CREATE_PARAMS = [
    ("human_block", {"label": "human", "value": "test"}, {"limit": CORE_MEMORY_HUMAN_CHAR_LIMIT}, None),
    ("persona_block", {"label": "persona", "value": "test1"}, {"limit": CORE_MEMORY_PERSONA_CHAR_LIMIT}, None),
]

BLOCKS_UPDATE_PARAMS = [
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
        update_params=BLOCKS_UPDATE_PARAMS,
        list_params=BLOCKS_LIST_PARAMS,
    )
)
