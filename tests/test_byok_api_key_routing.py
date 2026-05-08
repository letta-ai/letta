from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.llm_api.anthropic_client import AnthropicClient
from letta.llm_api.azure_client import AzureClient
from letta.llm_api.google_ai_client import GoogleAIClient
from letta.llm_api.google_vertex_client import GoogleVertexClient
from letta.llm_api.minimax_client import MiniMaxClient
from letta.llm_api.openai_client import OpenAIClient
from letta.llm_api.together_client import TogetherClient
from letta.llm_api.zai_client import ZAIClient
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig


def _make_byok_llm_config(model_endpoint_type: str, model_endpoint: str) -> LLMConfig:
    return LLMConfig(
        model="test-model",
        model_endpoint_type=model_endpoint_type,
        model_endpoint=model_endpoint,
        context_window=128000,
        provider_name="test-byok-provider",
        provider_category=ProviderCategory.byok,
    )


def test_openai_client_uses_byok_override_key():
    client = OpenAIClient()
    llm_config = _make_byok_llm_config("openai", "https://api.openai.com/v1")

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-openai", None, None))

    kwargs = client._prepare_client_kwargs(llm_config)

    assert kwargs["api_key"] == "sk-byok-openai"


def test_anthropic_client_uses_byok_override_key():
    client = AnthropicClient()
    llm_config = _make_byok_llm_config("anthropic", "https://api.anthropic.com/v1")

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-anthropic", None, None))

    with patch("letta.llm_api.anthropic_client.anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = MagicMock()

        client._get_anthropic_client(llm_config, async_client=False)

    assert mock_anthropic.Anthropic.call_args.kwargs["api_key"] == "sk-byok-anthropic"


def test_minimax_client_uses_byok_override_key():
    client = MiniMaxClient()
    llm_config = _make_byok_llm_config("minimax", "https://api.minimax.io/anthropic")

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-minimax", None, None))

    with patch("letta.llm_api.minimax_client.anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = MagicMock()

        client._get_anthropic_client(llm_config, async_client=False)

    called_kwargs = mock_anthropic.Anthropic.call_args.kwargs
    assert called_kwargs["api_key"] == "sk-byok-minimax"
    assert called_kwargs["base_url"] == llm_config.model_endpoint


def test_together_client_uses_byok_override_key():
    client = TogetherClient()
    llm_config = _make_byok_llm_config("together", "https://api.together.xyz/v1")
    request_data = {"model": "test-model", "messages": [{"role": "user", "content": "hello"}]}

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-together", None, None))

    with patch("letta.llm_api.together_client.OpenAI") as mock_openai:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {"id": "resp-together"}
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        client.request(request_data=request_data, llm_config=llm_config)

    assert mock_openai.call_args.kwargs["api_key"] == "sk-byok-together"


def test_zai_client_uses_byok_override_key_sync_request():
    client = ZAIClient()
    llm_config = _make_byok_llm_config("zai", "https://api.z.ai/api/paas/v4/")
    request_data = {"model": "test-model", "messages": [{"role": "user", "content": "hello"}]}

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-zai", None, None))

    with patch("letta.llm_api.zai_client.OpenAI") as mock_openai:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {"id": "resp-zai"}
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client

        client.request(request_data=request_data, llm_config=llm_config)

    assert mock_openai.call_args.kwargs["api_key"] == "sk-byok-zai"


@pytest.mark.asyncio
async def test_zai_client_uses_byok_override_key_async_request():
    client = ZAIClient()
    llm_config = _make_byok_llm_config("zai", "https://api.z.ai/api/paas/v4/")
    request_data = {"model": "test-model", "messages": [{"role": "user", "content": "hello"}]}

    client.get_byok_overrides_async = AsyncMock(return_value=("sk-byok-zai-async", None, None))

    with patch("letta.llm_api.zai_client.AsyncOpenAI") as mock_async_openai:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {"id": "resp-zai-async"}
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_async_openai.return_value = mock_client

        await client.request_async(request_data=request_data, llm_config=llm_config)

    assert mock_async_openai.call_args.kwargs["api_key"] == "sk-byok-zai-async"


def test_google_ai_client_uses_byok_override_key():
    client = GoogleAIClient()
    llm_config = _make_byok_llm_config("google_ai", "https://generativelanguage.googleapis.com")

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-gemini", None, None))

    with patch("letta.llm_api.google_ai_client.genai.Client") as mock_gemini_client:
        client._get_client(llm_config)

    assert mock_gemini_client.call_args.kwargs["api_key"] == "sk-byok-gemini"


def test_google_vertex_client_uses_byok_override_key():
    client = GoogleVertexClient()
    llm_config = _make_byok_llm_config("google_vertex", "https://unused")

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-vertex", None, None))

    with patch("letta.llm_api.google_vertex_client.Client") as mock_vertex_client:
        client._get_client(llm_config)

    assert mock_vertex_client.call_args.kwargs["api_key"] == "sk-byok-vertex"


def test_azure_client_uses_byok_override_key():
    client = AzureClient()
    llm_config = _make_byok_llm_config("azure", "https://unused")
    request_data = {"model": "test-model", "messages": [{"role": "user", "content": "hello"}]}

    client.get_byok_overrides = MagicMock(return_value=("sk-byok-azure", "https://my-azure.openai.azure.com", "2024-02-15-preview"))

    with patch("letta.llm_api.azure_client.AzureOpenAI") as mock_azure_openai:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.model_dump.return_value = {"id": "resp-azure"}
        mock_client.chat.completions.create.return_value = mock_response
        mock_azure_openai.return_value = mock_client

        client.request(request_data=request_data, llm_config=llm_config)

    called_kwargs = mock_azure_openai.call_args.kwargs
    assert called_kwargs["api_key"] == "sk-byok-azure"
    assert called_kwargs["azure_endpoint"] == "https://my-azure.openai.azure.com"
