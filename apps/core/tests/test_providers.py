import pytest

from letta.schemas.providers import (
    AnthropicProvider,
    AzureProvider,
    DeepSeekProvider,
    GoogleAIProvider,
    GoogleVertexProvider,
    GroqProvider,
    OpenAIProvider,
    TogetherProvider,
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


def test_deepseek():
    provider = DeepSeekProvider(name="deepseek", api_key=model_settings.deepseek_api_key)
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_anthropic():
    provider = AnthropicProvider(
        name="anthropic",
        api_key=model_settings.anthropic_api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


@pytest.mark.asyncio
async def test_anthropic_async():
    provider = AnthropicProvider(
        name="anthropic",
        api_key=model_settings.anthropic_api_key,
    )
    models = await provider.list_llm_models_async()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_groq():
    provider = GroqProvider(
        name="groq",
        api_key=model_settings.groq_api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_azure():
    provider = AzureProvider(
        name="azure",
        api_key=model_settings.azure_api_key,
        base_url=model_settings.azure_base_url,
        api_version=model_settings.azure_api_version,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


# def test_ollama():
#     provider = OllamaProvider(
#         name="ollama",
#         base_url=model_settings.ollama_base_url,
#         api_key=None,
#         default_prompt_formatter=model_settings.default_prompt_formatter,
#     )
#     models = provider.list_llm_models()
#     assert len(models) > 0
#     assert models[0].handle == f"{provider.name}/{models[0].model}"
#
#     embedding_models = provider.list_embedding_models()
#     assert len(embedding_models) > 0
#     assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_googleai():
    api_key = model_settings.gemini_api_key
    assert api_key is not None
    provider = GoogleAIProvider(
        name="google_ai",
        api_key=api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_googleai_async():
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


def test_google_vertex():
    provider = GoogleVertexProvider(
        name="google_vertex",
        google_cloud_project=model_settings.google_cloud_project,
        google_cloud_location=model_settings.google_cloud_location,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_together():
    provider = TogetherProvider(
        name="together",
        api_key=model_settings.together_api_key,
        default_prompt_formatter=model_settings.default_prompt_formatter,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    # Handle may be different from raw model name due to LLM_HANDLE_OVERRIDES
    assert models[0].handle.startswith(f"{provider.name}/")
    # Verify the handle is properly constructed via get_handle method
    assert models[0].handle == provider.get_handle(models[0].model)

    # TODO: We don't have embedding models on together for CI
    # embedding_models = provider.list_embedding_models()
    # assert len(embedding_models) > 0
    # assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


@pytest.mark.asyncio
async def test_together_async():
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


def test_custom_anthropic():
    provider = AnthropicProvider(
        name="custom_anthropic",
        api_key=model_settings.anthropic_api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


# def test_vllm():
#    provider = VLLMProvider(base_url=os.getenv("VLLM_API_BASE"))
#    models = provider.list_llm_models()
#    print(models)
#
#    provider.list_embedding_models()
