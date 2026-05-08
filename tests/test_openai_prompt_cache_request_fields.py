from letta.llm_api.openai_client import OpenAIClient
from letta.schemas.enums import AgentType, MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message


def _message(text: str = "hello") -> Message:
    return Message(
        role=MessageRole.user,
        content=[TextContent(text=text)],
        agent_id="agent-abc",
    )


def _openai_config(model: str, endpoint_type: str = "openai", provider_name: str | None = "openai") -> LLMConfig:
    return LLMConfig(
        model=model,
        model_endpoint_type=endpoint_type,
        model_endpoint="https://api.openai.com/v1",
        context_window=256000,
        provider_name=provider_name,
    )


def test_responses_request_sets_24h_retention_for_supported_model():
    client = OpenAIClient()
    llm_config = _openai_config(model="gpt-5.1")
    messages = [_message()]

    request_data = client.build_request_data(
        agent_type=AgentType.letta_v1_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )

    assert "input" in request_data
    assert "prompt_cache_key" not in request_data
    assert request_data.get("prompt_cache_retention") == "24h"


def test_responses_request_omits_24h_for_unsupported_model():
    client = OpenAIClient()
    llm_config = _openai_config(model="o3-mini")
    messages = [_message()]

    request_data = client.build_request_data(
        agent_type=AgentType.letta_v1_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )

    assert "prompt_cache_key" not in request_data
    assert "prompt_cache_retention" not in request_data


def test_chat_completions_request_sets_24h_retention_for_supported_model():
    client = OpenAIClient()
    llm_config = _openai_config(model="gpt-4.1")
    messages = [_message()]

    request_data = client.build_request_data(
        agent_type=AgentType.memgpt_v2_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )

    assert "messages" in request_data
    assert "prompt_cache_key" not in request_data
    assert request_data.get("prompt_cache_retention") == "24h"


def test_chat_completions_request_omits_24h_for_unsupported_model():
    client = OpenAIClient()
    llm_config = _openai_config(model="gpt-4o-mini")
    messages = [_message()]

    request_data = client.build_request_data(
        agent_type=AgentType.memgpt_v2_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )

    assert "prompt_cache_key" not in request_data
    assert "prompt_cache_retention" not in request_data


def test_openrouter_request_omits_all_prompt_cache_fields():
    client = OpenAIClient()
    llm_config = LLMConfig(
        model="gpt-5.1",
        handle="openrouter/gpt-5.1",
        model_endpoint_type="openai",
        model_endpoint="https://openrouter.ai/api/v1",
        context_window=256000,
        provider_name="openrouter",
    )
    messages = [_message()]

    responses_request_data = client.build_request_data(
        agent_type=AgentType.letta_v1_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )
    chat_request_data = client.build_request_data(
        agent_type=AgentType.memgpt_v2_agent,
        messages=messages,
        llm_config=llm_config,
        tools=[],
    )

    assert "prompt_cache_key" not in responses_request_data
    assert "prompt_cache_retention" not in responses_request_data
    assert "prompt_cache_key" not in chat_request_data
    assert "prompt_cache_retention" not in chat_request_data


def test_gpt5_family_gets_24h_retention():
    """gpt-5, gpt-5-codex, gpt-5.1, gpt-5.2 all get 24h retention."""
    client = OpenAIClient()

    for model in ["gpt-5", "gpt-5-codex", "gpt-5.1", "gpt-5.1-codex", "gpt-5.2"]:
        llm_config = _openai_config(model=model)
        request_data = client.build_request_data(
            agent_type=AgentType.letta_v1_agent,
            messages=[_message()],
            llm_config=llm_config,
            tools=[],
        )
        assert request_data.get("prompt_cache_retention") == "24h", f"{model} should get 24h retention"


def test_gpt5_mini_excluded_from_24h_retention():
    """gpt-5-mini is not listed in OpenAI docs for extended retention."""
    client = OpenAIClient()
    llm_config = _openai_config(model="gpt-5-mini")

    request_data = client.build_request_data(
        agent_type=AgentType.letta_v1_agent,
        messages=[_message()],
        llm_config=llm_config,
        tools=[],
    )

    assert "prompt_cache_retention" not in request_data
