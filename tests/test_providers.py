import pytest

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
    provider = VLLMProvider(base_url=model_settings.vllm_api_base)
    models = await provider.list_llm_models_async()
    print(models)


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
