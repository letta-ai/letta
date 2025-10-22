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
    VoyageAIProvider,
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


def test_voyageai():
    """Test VoyageAI provider listing embedding models."""
    provider = VoyageAIProvider(
        name="voyageai",
        api_key="test_api_key",  # API key not needed for listing hardcoded models
    )

    # VoyageAI doesn't provide LLM models, only embeddings
    llm_models = provider.list_llm_models()
    assert len(llm_models) == 0

    # Test embedding models
    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0

    # Verify all expected models are present
    model_names = [m.embedding_model for m in embedding_models]

    # Text models
    assert "voyage-3" in model_names
    assert "voyage-3-large" in model_names
    assert "voyage-3.5" in model_names
    assert "voyage-3.5-lite" in model_names
    assert "voyage-code-3" in model_names
    assert "voyage-finance-2" in model_names
    assert "voyage-law-2" in model_names

    # Contextual model
    assert "voyage-context-3" in model_names

    # Multimodal model
    assert "voyage-multimodal-3" in model_names

    # Verify handle format
    for model in embedding_models:
        assert model.handle == f"{provider.name}/{model.embedding_model}"
        assert model.embedding_endpoint_type == "voyageai"
        assert model.embedding_endpoint == "https://api.voyageai.com/v1"
        assert model.embedding_dim in [512, 1024, 1536]  # Valid dimensions
        assert model.batch_size > 0


def test_voyageai_model_config():
    """Test VoyageAI provider model configuration details."""
    provider = VoyageAIProvider(
        name="voyageai",
        api_key="test_api_key",
    )

    embedding_models = provider.list_embedding_models()
    model_dict = {m.embedding_model: m for m in embedding_models}

    # Test voyage-3 configuration
    voyage_3 = model_dict.get("voyage-3")
    assert voyage_3 is not None
    assert voyage_3.embedding_dim == 1024
    assert voyage_3.batch_size == 120

    # Test voyage-3.5-lite (high throughput model)
    voyage_lite = model_dict.get("voyage-3.5-lite")
    assert voyage_lite is not None
    assert voyage_lite.embedding_dim == 512
    assert voyage_lite.batch_size == 1000  # Higher batch size for lite model

    # Test voyage-context-3 (contextual model with lower batch size)
    voyage_context = model_dict.get("voyage-context-3")
    assert voyage_context is not None
    assert voyage_context.embedding_dim == 1024
    assert voyage_context.batch_size == 32  # Lower batch size due to token limits

    # Test voyage-multimodal-3
    voyage_multimodal = model_dict.get("voyage-multimodal-3")
    assert voyage_multimodal is not None
    assert voyage_multimodal.embedding_dim == 1024
    assert voyage_multimodal.batch_size == 120


@pytest.mark.skipif(model_settings.voyageai_api_key is None, reason="Only run if VOYAGEAI_API_KEY is set.")
@pytest.mark.asyncio
async def test_voyageai_real_api():
    """Test VoyageAI provider with real API (integration test)."""
    provider = VoyageAIProvider(
        name="voyageai",
        api_key=model_settings.voyageai_api_key,
    )

    # Test that models are listed correctly
    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0

    # All models should be configured with voyageai endpoint type
    for model in embedding_models:
        assert model.embedding_endpoint_type == "voyageai"
        assert model.handle.startswith("voyageai/")
