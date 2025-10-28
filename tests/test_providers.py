from typing import Literal, Optional

import pytest

from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.providers import (
    AnthropicProvider,
    AzureProvider,
    DeepSeekProvider,
    GoogleAIProvider,
    GoogleVertexProvider,
    GroqProvider,
    OllamaProvider,
    OpenAIProvider,
    TogetherProvider,
    VLLMProvider,
)
from letta.settings import model_settings


def test_openai():
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_openai_async():
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_anthropic():
    provider = AnthropicProvider(
        name="anthropic",
        api_key=model_settings.anthropic_api_key,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


@pytest.mark.asyncio
async def test_googleai():
    api_key = model_settings.gemini_api_key
    assert api_key is not None
    provider = GoogleAIProvider(
        name="google_ai",
        api_key=api_key,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_google_vertex():
    provider = GoogleVertexProvider(
        name="google_vertex",
        google_cloud_project=model_settings.google_cloud_project,
        google_cloud_location=model_settings.google_cloud_location,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.skipif(model_settings.deepseek_api_key is None, reason="Only run if DEEPSEEK_API_KEY is set.")
@pytest.mark.asyncio
async def test_deepseek():
    provider = DeepSeekProvider(name="deepseek", api_key=model_settings.deepseek_api_key)
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


@pytest.mark.skipif(model_settings.groq_api_key is None, reason="Only run if GROQ_API_KEY is set.")
@pytest.mark.asyncio
async def test_groq():
    provider = GroqProvider(
        name="groq",
        api_key=model_settings.groq_api_key,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


@pytest.mark.skipif(model_settings.azure_api_key is None, reason="Only run if AZURE_API_KEY is set.")
@pytest.mark.asyncio
async def test_azure():
    provider = AzureProvider(
        name="azure",
        api_key=model_settings.azure_api_key,
        base_url=model_settings.azure_base_url,
        api_version=model_settings.azure_api_version,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.skipif(model_settings.together_api_key is None, reason="Only run if TOGETHER_API_KEY is set.")
@pytest.mark.asyncio
async def test_together():
    provider = TogetherProvider(
        name="together",
        api_key=model_settings.together_api_key,
        default_prompt_formatter=model_settings.default_prompt_formatter,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    # Handle may be different from raw model name due to LLM_HANDLE_OVERRIDES
    assert models[0].handle.startswith(f"{provider.name}/")
    # Verify the handle is properly constructed via get_handle method
    assert models[0].handle == provider.get_handle(models[0].model)

    # TODO: We don't have embedding models on together for CI
    # embedding_models = provider.list_embedding_models()
    # assert len(embedding_models) > 0
    # assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


# ===== Local Models =====
@pytest.mark.skipif(model_settings.ollama_base_url is None, reason="Only run if OLLAMA_BASE_URL is set.")
@pytest.mark.asyncio
async def test_ollama():
    provider = OllamaProvider(
        name="ollama",
        base_url=model_settings.ollama_base_url,
        api_key=None,
        default_prompt_formatter=model_settings.default_prompt_formatter,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.skipif(model_settings.vllm_api_base is None, reason="Only run if VLLM_API_BASE is set.")
@pytest.mark.asyncio
async def test_vllm():
    provider = VLLMProvider(name="vllm", base_url=model_settings.vllm_api_base)
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = await provider.list_embedding_models_async()
    assert len(embedding_models) == 0  # embedding models currently not supported by vLLM


# TODO: Add back in, difficulty adding this to CI properly, need boto credentials
# def test_anthropic_bedrock():
#     from letta.settings import model_settings
#
#     provider = AnthropicBedrockProvider(name="bedrock", aws_region=model_settings.aws_region)
#     models = provider.list_llm_models()
#     assert len(models) > 0
#     assert models[0].handle == f"{provider.name}/{models[0].model}"
#
#     embedding_models = provider.list_embedding_models()
#     assert len(embedding_models) > 0
#     assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_custom_anthropic():
    provider = AnthropicProvider(
        name="custom_anthropic",
        api_key=model_settings.anthropic_api_key,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_provider_context_window():
    """Test that providers implement context window methods correctly."""
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )

    # Test both sync and async context window methods
    context_window = provider.get_model_context_window("gpt-4")
    assert context_window is not None
    assert isinstance(context_window, int)
    assert context_window > 0


@pytest.mark.asyncio
async def test_provider_context_window_async():
    """Test that providers implement async context window methods correctly."""
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )

    context_window = await provider.get_model_context_window_async("gpt-4")
    assert context_window is not None
    assert isinstance(context_window, int)
    assert context_window > 0


def test_provider_handle_generation():
    """Test that providers generate handles correctly."""
    provider = OpenAIProvider(
        name="test_openai",
        api_key="test_key",
        base_url="https://api.openai.com/v1",
    )

    # Test LLM handle
    llm_handle = provider.get_handle("gpt-4")
    assert llm_handle == "test_openai/gpt-4"

    # Test embedding handle
    embedding_handle = provider.get_handle("text-embedding-ada-002", is_embedding=True)
    assert embedding_handle == "test_openai/text-embedding-ada-002"


def test_provider_casting():
    """Test that providers can be cast to their specific subtypes."""
    from letta.schemas.enums import ProviderCategory, ProviderType
    from letta.schemas.providers.base import Provider

    base_provider = Provider(
        name="test_provider",
        provider_type=ProviderType.openai,
        provider_category=ProviderCategory.base,
        api_key="test_key",
        base_url="https://api.openai.com/v1",
    )

    cast_provider = base_provider.cast_to_subtype()
    assert isinstance(cast_provider, OpenAIProvider)
    assert cast_provider.name == "test_provider"
    assert cast_provider.api_key == "test_key"


@pytest.mark.asyncio
async def test_provider_embedding_models_consistency():
    """Test that providers return consistent embedding model formats."""
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )

    embedding_models = await provider.list_embedding_models_async()
    if embedding_models:  # Only test if provider supports embedding models
        for model in embedding_models:
            assert hasattr(model, "embedding_model")
            assert hasattr(model, "embedding_endpoint_type")
            assert hasattr(model, "embedding_endpoint")
            assert hasattr(model, "embedding_dim")
            assert hasattr(model, "handle")
            assert model.handle.startswith(f"{provider.name}/")


@pytest.mark.asyncio
async def test_provider_llm_models_consistency():
    """Test that providers return consistent LLM model formats."""
    provider = OpenAIProvider(
        name="openai",
        api_key=model_settings.openai_api_key,
        base_url=model_settings.openai_api_base,
    )

    models = await provider.list_llm_models_async()
    assert len(models) > 0

    for model in models:
        assert hasattr(model, "model")
        assert hasattr(model, "model_endpoint_type")
        assert hasattr(model, "model_endpoint")
        assert hasattr(model, "context_window")
        assert hasattr(model, "handle")
        assert hasattr(model, "provider_name")
        assert hasattr(model, "provider_category")
        assert model.handle.startswith(f"{provider.name}/")
        assert model.provider_name == provider.name
        assert model.context_window > 0


@pytest.mark.parametrize(
    "handle, agent_type, reasoning, expected_enable_reasoner, expected_put_inner_thoughts_in_kwargs, expected_max_reasoning_tokens, expected_reasoning_effort",
    [
        # send message agent loop
        ("openai/gpt-4o-mini", AgentType.memgpt_v2_agent, True, True, True, 0, None),
        ("openai/gpt-4o-mini", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("openai/o3-mini", AgentType.memgpt_v2_agent, True, True, False, 0, "medium"),
        ("openai/o3-mini", AgentType.memgpt_v2_agent, False, True, False, 0, "medium"),
        ("anthropic/claude-3.5-sonnet", AgentType.memgpt_v2_agent, True, True, True, 0, None),
        ("anthropic/claude-3.5-sonnet", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("anthropic/claude-3-7-sonnet", AgentType.memgpt_v2_agent, True, True, False, 1024, None),
        ("anthropic/claude-3-7-sonnet", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("anthropic/claude-sonnet-4", AgentType.memgpt_v2_agent, True, True, False, 1024, None),
        ("anthropic/claude-sonnet-4", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.0-flash", AgentType.memgpt_v2_agent, True, True, True, 0, None),
        ("google_vertex/gemini-2.0-flash", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.5-flash", AgentType.memgpt_v2_agent, True, True, True, 1024, None),
        ("google_vertex/gemini-2.5-flash", AgentType.memgpt_v2_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.5-pro", AgentType.memgpt_v2_agent, True, True, True, 1024, None),
        ("google_vertex/gemini-2.5-pro", AgentType.memgpt_v2_agent, True, True, True, 1024, None),
        # letta_v1_agent loop
        ("openai/gpt-4o-mini", AgentType.letta_v1_agent, True, False, False, 0, None),
        ("openai/gpt-4o-mini", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("openai/o3-mini", AgentType.letta_v1_agent, True, True, False, 0, "medium"),
        ("openai/o3-mini", AgentType.letta_v1_agent, False, True, False, 0, "medium"),
        ("anthropic/claude-3.5-sonnet", AgentType.letta_v1_agent, True, False, False, 0, None),
        ("anthropic/claude-3.5-sonnet", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("anthropic/claude-3-7-sonnet", AgentType.letta_v1_agent, True, True, False, 1024, None),
        ("anthropic/claude-3-7-sonnet", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("anthropic/claude-sonnet-4", AgentType.letta_v1_agent, True, True, False, 1024, None),
        ("anthropic/claude-sonnet-4", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.0-flash", AgentType.letta_v1_agent, True, False, False, 0, None),
        ("google_vertex/gemini-2.0-flash", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.5-flash", AgentType.letta_v1_agent, True, True, False, 1024, None),
        ("google_vertex/gemini-2.5-flash", AgentType.letta_v1_agent, False, False, False, 0, None),
        ("google_vertex/gemini-2.5-pro", AgentType.letta_v1_agent, True, True, False, 1024, None),
        ("google_vertex/gemini-2.5-pro", AgentType.letta_v1_agent, False, True, False, 1024, None),
    ],
)
def test_reasoning_toggle_by_provider(
    handle: str,
    agent_type: AgentType,
    reasoning: bool,
    expected_enable_reasoner: bool,
    expected_put_inner_thoughts_in_kwargs: bool,
    expected_max_reasoning_tokens: int,
    expected_reasoning_effort: Optional[Literal["minimal", "low", "medium", "high"]],
):
    model_endpoint_type, model = handle.split("/")
    config = LLMConfig(
        model_endpoint_type=model_endpoint_type,
        model=model,
        handle=handle,
        context_window=1024,
    )
    new_config = LLMConfig.apply_reasoning_setting_to_config(config, reasoning=reasoning, agent_type=agent_type)

    assert new_config.enable_reasoner == expected_enable_reasoner
    assert new_config.put_inner_thoughts_in_kwargs == expected_put_inner_thoughts_in_kwargs
    assert new_config.reasoning_effort == expected_reasoning_effort
    assert new_config.max_reasoning_tokens == expected_max_reasoning_tokens


def test_codex_default_reasoning_effort():
    """Test that gpt-5-codex defaults to 'medium' reasoning effort, not 'minimal'."""
    # Test with apply_reasoning_setting_to_config for v2 agent
    config = LLMConfig(
        model="gpt-5-codex",
        model_endpoint_type="openai",
        context_window=272000,
    )

    # For v2 agent with reasoning=True
    new_config = LLMConfig.apply_reasoning_setting_to_config(config, reasoning=True, agent_type=AgentType.memgpt_v2_agent)
    assert new_config.reasoning_effort == "medium", "gpt-5-codex should default to 'medium', not 'minimal'"

    # For v2 agent with reasoning=False (still can't disable for reasoning models)
    new_config = LLMConfig.apply_reasoning_setting_to_config(config, reasoning=False, agent_type=AgentType.memgpt_v2_agent)
    assert new_config.reasoning_effort == "medium", "gpt-5-codex should default to 'medium', not 'minimal'"

    # For v1 agent with reasoning=True
    new_config = LLMConfig.apply_reasoning_setting_to_config(config, reasoning=True, agent_type=AgentType.letta_v1_agent)
    assert new_config.reasoning_effort == "medium", "gpt-5-codex should default to 'medium', not 'minimal'"
