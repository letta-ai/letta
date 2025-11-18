from conftest import create_test_module

IDENTITIES_CREATE_PARAMS = [
    ("caren1", {"identifier_key": "123", "name": "caren", "identity_type": "user"}, {}, None),
    ("caren2", {"identifier_key": "456", "name": "caren", "identity_type": "user"}, {}, None),
]

IDENTITIES_UPDATE_PARAMS = [
    ("caren1", {"properties": [{"key": "email", "value": "caren@letta.com", "type": "string"}]}, {}, None),
    ("caren2", {"properties": [{"key": "email", "value": "caren@gmail.com", "type": "string"}]}, {}, None),
]

IDENTITIES_UPSERT_PARAMS = [
    (
        "caren2",
        {
            "identifier_key": "456",
            "name": "caren",
            "identity_type": "user",
            "properties": [{"key": "email", "value": "caren@yahoo.com", "type": "string"}],
        },
        {},
        None,
    ),
]

IDENTITIES_LIST_PARAMS = [
    ({}, 2),
    ({"name": "caren"}, 2),
    ({"identifier_key": "123"}, 1),
]

# Create all test module components at once
globals().update(
    create_test_module(
        resource_name="identities",
        id_param_name="identity_id",
        create_params=IDENTITIES_CREATE_PARAMS,
        upsert_params=IDENTITIES_UPSERT_PARAMS,
        update_params=IDENTITIES_UPDATE_PARAMS,
        list_params=IDENTITIES_LIST_PARAMS,
    )
)
