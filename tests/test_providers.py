import os

from letta.schemas.providers import (
    AnthropicBedrockProvider,
    AnthropicProvider,
    AzureProvider,
    DeepSeekProvider,
    GoogleAIProvider,
    GoogleVertexProvider,
    GroqProvider,
    MistralProvider,
    OllamaProvider,
    OpenAIProvider,
    TogetherProvider,
)
from letta.settings import model_settings


def test_openai():
    api_key = os.getenv("OPENAI_API_KEY")
    assert api_key is not None
    provider = OpenAIProvider(
        name="openai",
        api_key=api_key,
        base_url=model_settings.openai_api_base,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_deepseek():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    assert api_key is not None
    provider = DeepSeekProvider(
        name="deepseek",
        api_key=api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_anthropic():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    assert api_key is not None
    provider = AnthropicProvider(
        name="anthropic",
        api_key=api_key,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_groq():
    provider = GroqProvider(
        name="groq",
        api_key=os.getenv("GROQ_API_KEY"),
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_azure():
    provider = AzureProvider(
        name="azure",
        api_key=os.getenv("AZURE_API_KEY"),
        base_url=os.getenv("AZURE_BASE_URL"),
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_ollama():
    base_url = os.getenv("OLLAMA_BASE_URL")
    assert base_url is not None
    provider = OllamaProvider(
        name="ollama",
        base_url=base_url,
        default_prompt_formatter=model_settings.default_prompt_formatter,
        api_key=None,
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_googleai():
    api_key = os.getenv("GEMINI_API_KEY")
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


def test_google_vertex():
    provider = GoogleVertexProvider(
        name="google_vertex",
        google_cloud_project=os.getenv("GCP_PROJECT_ID"),
        google_cloud_location=os.getenv("GCP_REGION"),
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_mistral():
    provider = MistralProvider(
        name="mistral",
        api_key=os.getenv("MISTRAL_API_KEY"),
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"


def test_together():
    provider = TogetherProvider(
        name="together",
        api_key=os.getenv("TOGETHER_API_KEY"),
        default_prompt_formatter="chatml",
    )
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_anthropic_bedrock():
    from letta.settings import model_settings

    provider = AnthropicBedrockProvider(name="bedrock", aws_region=model_settings.aws_region)
    models = provider.list_llm_models()
    assert len(models) > 0
    assert models[0].handle == f"{provider.name}/{models[0].model}"

    embedding_models = provider.list_embedding_models()
    assert len(embedding_models) > 0
    assert embedding_models[0].handle == f"{provider.name}/{embedding_models[0].embedding_model}"


def test_custom_anthropic():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    assert api_key is not None
    provider = AnthropicProvider(
        name="custom_anthropic",
        api_key=api_key,
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
