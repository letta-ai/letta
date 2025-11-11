from conftest import create_test_module

AGENTS_CREATE_PARAMS = [
    (
        "caren_agent",
        {"name": "caren", "model": "openai/gpt-4o-mini", "embedding": "openai/text-embedding-3-small"},
        {
            # Verify model field contains the model name and settings
            # Note: we override 'model' here since the input is a string but the output is a ModelSettings object
            "model": {"model": "gpt-4o-mini", "max_output_tokens": 4096, "parallel_tool_calls": False},
            # Note: we override 'embedding' here since it's currently not populated in AgentState (remains None)
            "embedding": None,
        },
        None,
    ),
]

AGENTS_MODIFY_PARAMS = [
    (
        "caren_agent",
        {"name": "caren_updated"},
        {
            # After modifying just the name, model field should still be present and unchanged
            "model": {"model": "gpt-4o-mini", "max_output_tokens": 4096, "parallel_tool_calls": False}
        },
        None,
    ),
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
