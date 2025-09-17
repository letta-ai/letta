from conftest import create_test_module

GROUPS_CREATE_PARAMS = [
    ("round_robin_group", {"agent_ids": [], "description": ""}, {"manager_type": "round_robin"}, None),
    (
        "supervisor_group",
        {"agent_ids": [], "description": "", "manager_config": {"manager_type": "supervisor", "manager_agent_id": "caren_agent.id"}},
        {"manager_type": "supervisor"},
        None,
    ),
]

GROUPS_MODIFY_PARAMS = [
    (
        "round_robin_group",
        {"manager_config": {"manager_type": "round_robin", "max_turns": 10}},
        {"manager_type": "round_robin", "max_turns": 10},
        None,
    ),
]

GROUPS_LIST_PARAMS = [
    ({}, 2),
    ({"manager_type": "round_robin"}, 1),
]

# Create all test module components at once
globals().update(
    create_test_module(
        resource_name="groups",
        id_param_name="group_id",
        create_params=GROUPS_CREATE_PARAMS,
        modify_params=GROUPS_MODIFY_PARAMS,
        list_params=GROUPS_LIST_PARAMS,
    )
)
