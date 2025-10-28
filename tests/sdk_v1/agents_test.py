from conftest import create_test_module

AGENTS_CREATE_PARAMS = [
    ("caren_agent", {"name": "caren", "model": "openai/gpt-4o-mini", "embedding": "openai/text-embedding-3-small"}, {}, None),
]

AGENTS_MODIFY_PARAMS = [
    ("caren_agent", {"name": "caren_updated"}, {}, None),
]

AGENTS_LIST_PARAMS = [
    ({}, 1),
    ({"name": "caren_updated"}, 1),
]

# Create all test module components at once
globals().update(
    create_test_module(
        resource_name="agents",
        id_param_name="agent_id",
        create_params=AGENTS_CREATE_PARAMS,
        modify_params=AGENTS_MODIFY_PARAMS,
        list_params=AGENTS_LIST_PARAMS,
    )
)
