from conftest import create_test_module

AGENTS_CREATE_PARAMS = [
    (
        "caren_agent",
        {"name": "caren", "model": "openai/gpt-4o-mini", "embedding": "openai/text-embedding-3-small"},
        {
            # Verify model_settings is populated with config values
            # Note: The 'model' field itself is separate from model_settings
            "model_settings": {
                "max_output_tokens": 4096,
                "parallel_tool_calls": False,
                "provider_type": "openai",
                "temperature": 0.7,
                "reasoning": {"reasoning_effort": "minimal"},
                "response_format": None,
            }
        },
        None,
    ),
]

AGENTS_UPDATE_PARAMS = [
    (
        "caren_agent",
        {"name": "caren_updated"},
        {
            # After updating just the name, model_settings should still be present
            "model_settings": {
                "max_output_tokens": 4096,
                "parallel_tool_calls": False,
                "provider_type": "openai",
                "temperature": 0.7,
                "reasoning": {"reasoning_effort": "minimal"},
                "response_format": None,
            }
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
        update_params=AGENTS_UPDATE_PARAMS,
        list_params=AGENTS_LIST_PARAMS,
    )
)
