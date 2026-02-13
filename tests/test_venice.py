"""Tests for Venice OpenAI-proxy integration.

Covers:
- venice_get_model_list_async (letta/llm_api/venice.py)
- OpenAIProvider Venice model normalization and filtering (letta/schemas/providers/openai.py)
- OpenAIClient Venice request/response hooks (letta/llm_api/openai_client.py)
"""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# ---------------------------------------------------------------------------
# Fixtures: realistic Venice API payloads
# ---------------------------------------------------------------------------

VENICE_MODELS_RESPONSE = {
    "data": [
        {
            "id": "llama-3.3-70b",
            "type": "text",
            "model_spec": {
                "availableContextTokens": 131072,
                "capabilities": {
                    "supportsFunctionCalling": True,
                    "supportsVision": False,
                },
            },
        },
        {
            "id": "deepseek-r1-671b",
            "type": "chat",
            "model_spec": {
                "context_length": 65536,
                "capabilities": {
                    "supportsFunctionCalling": False,
                    "supportsVision": False,
                },
            },
        },
        {
            "id": "llama-3.2-vision-11b",
            "type": "language",
            "model_spec": {
                "availableContextTokens": 32768,
                "capabilities": {
                    "supportsFunctionCalling": True,
                    "supportsVision": True,
                },
            },
        },
        {
            "id": "text-embedding-ada",
            "type": "embedding",
            "model_spec": {
                "availableContextTokens": 8192,
                "capabilities": {},
            },
        },
        {
            "id": "no-spec-model",
            "type": "text",
            # No model_spec at all
        },
        {
            # No id — should be skipped
            "type": "text",
            "model_spec": {"availableContextTokens": 4096},
        },
    ]
}


# ===========================================================================
# 1) venice_get_model_list_async
# ===========================================================================


@pytest.mark.asyncio
async def test_venice_get_model_list_async_success():
    """venice_get_model_list_async returns parsed JSON on 200."""
    from letta.llm_api.venice import venice_get_model_list_async

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = VENICE_MODELS_RESPONSE
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    result = await venice_get_model_list_async(
        "https://api.venice.ai/api/v1",
        api_key="test-key",
        client=mock_client,
    )

    assert result == VENICE_MODELS_RESPONSE
    mock_client.get.assert_called_once()
    call_args = mock_client.get.call_args
    assert "models" in call_args[0][0]
    assert call_args[1]["headers"]["Authorization"] == "Bearer test-key"


@pytest.mark.asyncio
async def test_venice_get_model_list_async_no_key():
    """venice_get_model_list_async omits Authorization header when no key."""
    from letta.llm_api.venice import venice_get_model_list_async

    mock_response = MagicMock()
    mock_response.json.return_value = {"data": []}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    await venice_get_model_list_async("https://api.venice.ai/api/v1", client=mock_client)

    headers = mock_client.get.call_args[1]["headers"]
    assert "Authorization" not in headers


@pytest.mark.asyncio
async def test_venice_get_model_list_async_http_error():
    """venice_get_model_list_async raises on HTTP error."""
    from letta.llm_api.venice import venice_get_model_list_async

    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.text = "Unauthorized"
    mock_response.json.side_effect = Exception("not json")
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "401", request=MagicMock(), response=mock_response
    )

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with pytest.raises(httpx.HTTPStatusError):
        await venice_get_model_list_async(
            "https://api.venice.ai/api/v1",
            api_key="bad-key",
            client=mock_client,
        )


# ===========================================================================
# 2) OpenAIProvider Venice model normalization
# ===========================================================================


@pytest.mark.asyncio
async def test_venice_model_normalization():
    """_get_venice_models_normalized_async normalizes Venice response correctly."""
    from letta.schemas.providers.openai import OpenAIProvider
    from letta.schemas.secret import Secret

    provider = OpenAIProvider(
        name="venice-test",
        api_key_enc=Secret.from_plaintext("test-key"),
        base_url="https://api.venice.ai/api/v1",
    )

    with patch("letta.llm_api.venice.venice_get_model_list_async", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = VENICE_MODELS_RESPONSE

        models = await provider._get_venice_models_normalized_async()

    # Should have 5 models (skips only the one with no id; embedding is included
    # at normalization stage — type filtering happens later in _list_llm_models)
    assert len(models) == 5

    # Check first model: availableContextTokens
    m0 = next(m for m in models if m["id"] == "llama-3.3-70b")
    assert m0["context_length"] == 131072
    assert m0["type"] == "text"

    # Check second model: context_length from model_spec
    m1 = next(m for m in models if m["id"] == "deepseek-r1-671b")
    assert m1["context_length"] == 65536
    assert m1["type"] == "chat"

    # Check vision model
    m2 = next(m for m in models if m["id"] == "llama-3.2-vision-11b")
    assert m2["context_length"] == 32768
    assert m2["type"] == "language"

    # Check model with no model_spec: falls back to MIN_CONTEXT_WINDOW
    from letta.constants import MIN_CONTEXT_WINDOW

    m4 = next(m for m in models if m["id"] == "no-spec-model")
    assert m4["context_length"] == MIN_CONTEXT_WINDOW


@pytest.mark.asyncio
async def test_venice_model_normalization_bad_payload():
    """_get_venice_models_normalized_async handles non-list payload gracefully."""
    from letta.schemas.providers.openai import OpenAIProvider
    from letta.schemas.secret import Secret

    provider = OpenAIProvider(
        name="venice-test",
        api_key_enc=Secret.from_plaintext("test-key"),
        base_url="https://api.venice.ai/api/v1",
    )

    with patch("letta.llm_api.venice.venice_get_model_list_async", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = {"data": "not-a-list"}
        models = await provider._get_venice_models_normalized_async()

    assert models == []


@pytest.mark.asyncio
async def test_venice_get_models_async_dispatches():
    """_get_models_async dispatches to Venice normalizer when base_url is Venice."""
    from letta.schemas.providers.openai import OpenAIProvider
    from letta.schemas.secret import Secret

    provider = OpenAIProvider(
        name="venice-test",
        api_key_enc=Secret.from_plaintext("test-key"),
        base_url="https://api.venice.ai/api/v1",
    )

    with patch.object(provider, "_get_venice_models_normalized_async", new_callable=AsyncMock) as mock_norm:
        mock_norm.return_value = [{"id": "test-model", "type": "text", "context_length": 8192}]
        data = await provider._get_models_async()

    mock_norm.assert_called_once()
    assert data == [{"id": "test-model", "type": "text", "context_length": 8192}]


@pytest.mark.asyncio
async def test_venice_model_type_filtering():
    """_list_llm_models filters Venice models to text/chat/language only."""
    from letta.schemas.providers.openai import OpenAIProvider
    from letta.schemas.secret import Secret

    provider = OpenAIProvider(
        name="venice-test",
        api_key_enc=Secret.from_plaintext("test-key"),
        base_url="https://api.venice.ai/api/v1",
    )

    # Normalized data includes an embedding model that should be filtered out
    normalized_data = [
        {"id": "llama-3.3-70b", "type": "text", "context_length": 131072},
        {"id": "deepseek-r1-671b", "type": "chat", "context_length": 65536},
        {"id": "llama-3.2-vision-11b", "type": "language", "context_length": 32768},
        {"id": "text-embedding-ada", "type": "embedding", "context_length": 8192},
    ]

    configs = await provider._list_llm_models(normalized_data)

    model_ids = [c.model for c in configs]
    assert "llama-3.3-70b" in model_ids
    assert "deepseek-r1-671b" in model_ids
    assert "llama-3.2-vision-11b" in model_ids
    assert "text-embedding-ada" not in model_ids


@pytest.mark.asyncio
async def test_venice_context_length_passthrough():
    """_do_model_checks uses context_length from model dict (skips litellm)."""
    from letta.schemas.providers.openai import OpenAIProvider
    from letta.schemas.secret import Secret

    provider = OpenAIProvider(
        name="venice-test",
        api_key_enc=Secret.from_plaintext("test-key"),
        base_url="https://api.venice.ai/api/v1",
    )

    model = {"id": "venice-model-xyz", "context_length": 99999}
    result = await provider._do_model_checks_for_name_and_context_size_async(model)

    assert result is not None
    name, ctx = result
    assert name == "venice-model-xyz"
    assert ctx == 99999


# ===========================================================================
# 3) OpenAIClient Venice request/response hooks
# ===========================================================================


class TestOpenAIClientVeniceHelpers:
    """Test Venice helper methods on OpenAIClient directly."""

    def _make_client(self):
        from letta.llm_api.openai_client import OpenAIClient

        client = OpenAIClient.__new__(OpenAIClient)
        client._venice_capabilities_cache = {}
        client.actor = None
        return client

    def _make_venice_config(self, model="llama-3.3-70b"):
        from letta.schemas.llm_config import LLMConfig

        return LLMConfig(
            model=model,
            model_endpoint_type="openai",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=131072,
        )

    def _make_non_venice_config(self):
        from letta.schemas.llm_config import LLMConfig

        return LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
        )

    def test_is_venice_endpoint_true(self):
        client = self._make_client()
        assert client._is_venice_endpoint(self._make_venice_config()) is True

    def test_is_venice_endpoint_false(self):
        client = self._make_client()
        assert client._is_venice_endpoint(self._make_non_venice_config()) is False

    def test_is_venice_endpoint_none_config(self):
        client = self._make_client()
        assert client._is_venice_endpoint(None) is False

    def test_filter_none_values(self):
        client = self._make_client()
        data = {"model": "llama", "temperature": None, "tools": None, "messages": []}
        result = client._venice_filter_none_values(data)
        assert result == {"model": "llama", "messages": []}

    def test_filter_none_values_no_nones(self):
        client = self._make_client()
        data = {"model": "llama", "messages": []}
        result = client._venice_filter_none_values(data)
        assert result == data

    def test_extract_think_reasoning_with_tags(self):
        client = self._make_client()
        content = "Hello! <think>I need to consider this carefully.</think> Here is my answer."
        cleaned, reasoning = client._venice_extract_think_reasoning(content)
        assert cleaned == "Hello!  Here is my answer."
        assert reasoning == "I need to consider this carefully."

    def test_extract_think_reasoning_multiple_tags(self):
        client = self._make_client()
        content = "<think>First thought</think>Middle text<think>Second thought</think>End"
        cleaned, reasoning = client._venice_extract_think_reasoning(content)
        assert "Middle text" in cleaned
        assert "End" in cleaned
        assert "First thought" in reasoning
        assert "Second thought" in reasoning

    def test_extract_think_reasoning_multiline(self):
        client = self._make_client()
        content = "<think>\nLine 1\nLine 2\n</think>Answer here"
        cleaned, reasoning = client._venice_extract_think_reasoning(content)
        assert cleaned == "Answer here"
        assert "Line 1" in reasoning
        assert "Line 2" in reasoning

    def test_extract_think_reasoning_no_tags(self):
        client = self._make_client()
        content = "Just a normal response with no think tags."
        cleaned, reasoning = client._venice_extract_think_reasoning(content)
        assert cleaned == content
        assert reasoning is None

    def test_extract_think_reasoning_empty_content(self):
        client = self._make_client()
        cleaned, reasoning = client._venice_extract_think_reasoning(None)
        assert cleaned is None
        assert reasoning is None

        cleaned, reasoning = client._venice_extract_think_reasoning("")
        assert cleaned == ""
        assert reasoning is None

    def test_extract_think_reasoning_only_think(self):
        client = self._make_client()
        content = "<think>All reasoning, no answer</think>"
        cleaned, reasoning = client._venice_extract_think_reasoning(content)
        assert cleaned is None  # empty string becomes None
        assert reasoning == "All reasoning, no answer"

    def test_filter_image_content_non_vision(self):
        client = self._make_client()
        messages = [
            {"role": "user", "content": [
                {"type": "text", "text": "What is this?"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
            ]},
            {"role": "assistant", "content": "I see an image."},
        ]
        result = client._venice_filter_image_content(messages, "no-vision-model")
        # First message should have image stripped
        assert len(result) == 2
        assert result[0]["content"] == [{"type": "text", "text": "What is this?"}]
        # Second message (text) unchanged
        assert result[1]["content"] == "I see an image."

    def test_filter_image_content_only_images(self):
        client = self._make_client()
        messages = [
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
            ]},
        ]
        result = client._venice_filter_image_content(messages, "no-vision-model")
        assert result[0]["content"] == "[Image content removed - model does not support vision]"

    def test_filter_request_data_no_tools_model(self):
        """When model doesn't support tools, tools/tool_choice are removed and tool messages converted."""
        client = self._make_client()
        client._venice_capabilities_cache = {
            "deepseek-r1-671b": {"supports_tools": False, "supports_vision": False}
        }
        config = self._make_venice_config(model="deepseek-r1-671b")
        request_data = {
            "model": "deepseek-r1-671b",
            "messages": [
                {"role": "user", "content": "hi"},
                {"role": "tool", "tool_call_id": "call_123", "content": '{"result": "ok"}'},
            ],
            "tools": [{"type": "function", "function": {"name": "test"}}],
            "tool_choice": "auto",
            "temperature": 0.7,
        }
        result = client._venice_filter_request_data(request_data, config)

        assert "tools" not in result
        assert "tool_choice" not in result
        assert result["temperature"] == 0.7
        # Tool message should be converted to user message
        assert result["messages"][1]["role"] == "user"
        assert "call_123" in result["messages"][1]["content"]

    def test_filter_request_data_tool_supporting_model(self):
        """When model supports tools, request passes through (minus None)."""
        client = self._make_client()
        client._venice_capabilities_cache = {
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False}
        }
        config = self._make_venice_config(model="llama-3.3-70b")
        request_data = {
            "model": "llama-3.3-70b",
            "messages": [{"role": "user", "content": "hi"}],
            "tools": [{"type": "function", "function": {"name": "test"}}],
            "tool_choice": "auto",
            "temperature": None,
        }
        result = client._venice_filter_request_data(request_data, config)

        assert "tools" in result
        assert "tool_choice" in result
        assert "temperature" not in result  # None stripped

    def test_filter_request_data_responses_api_passthrough(self):
        """Responses API requests (with 'input' key) only get None filtered."""
        client = self._make_client()
        client._venice_capabilities_cache = {
            "deepseek-r1-671b": {"supports_tools": False, "supports_vision": False}
        }
        config = self._make_venice_config(model="deepseek-r1-671b")
        request_data = {
            "model": "deepseek-r1-671b",
            "input": [{"role": "user", "content": "hi"}],
            "tools": [{"type": "function"}],
            "temperature": None,
        }
        result = client._venice_filter_request_data(request_data, config)
        # Should only strip None, not filter tools (Responses API path)
        assert "tools" in result
        assert "temperature" not in result

    def test_filter_request_data_unknown_model_defaults_permissive(self):
        """Unknown model (not in cache) defaults to supports_tools=True, supports_vision=False."""
        client = self._make_client()
        client._venice_capabilities_cache = {}  # empty cache
        config = self._make_venice_config(model="unknown-model")
        request_data = {
            "model": "unknown-model",
            "messages": [{"role": "user", "content": "hi"}],
            "tools": [{"type": "function", "function": {"name": "test"}}],
        }
        result = client._venice_filter_request_data(request_data, config)
        # Tools should be preserved (default supports_tools=True)
        assert "tools" in result


@pytest.mark.asyncio
async def test_venice_ensure_capabilities_async():
    """_venice_ensure_capabilities_async populates the cache from Venice API."""
    from letta.llm_api.openai_client import OpenAIClient
    from letta.schemas.llm_config import LLMConfig

    client = OpenAIClient.__new__(OpenAIClient)
    client._venice_capabilities_cache = {}
    client.actor = None

    config = LLMConfig(
        model="llama-3.3-70b",
        model_endpoint_type="openai",
        model_endpoint="https://api.venice.ai/api/v1",
        context_window=131072,
    )

    with patch("letta.llm_api.venice.venice_get_model_list_async", new_callable=AsyncMock) as mock_list, \
         patch.object(OpenAIClient, "get_byok_overrides_async", new_callable=AsyncMock) as mock_byok:
        mock_list.return_value = VENICE_MODELS_RESPONSE
        mock_byok.return_value = ("test-key", None, None)

        await client._venice_ensure_capabilities_async(config)

    cache = client._venice_capabilities_cache
    assert "llama-3.3-70b" in cache
    assert cache["llama-3.3-70b"]["supports_tools"] is True
    assert cache["llama-3.3-70b"]["supports_vision"] is False

    assert "deepseek-r1-671b" in cache
    assert cache["deepseek-r1-671b"]["supports_tools"] is False

    assert "llama-3.2-vision-11b" in cache
    assert cache["llama-3.2-vision-11b"]["supports_vision"] is True


@pytest.mark.asyncio
async def test_venice_ensure_capabilities_async_no_double_fetch():
    """_venice_ensure_capabilities_async doesn't re-fetch if cache is populated."""
    from letta.llm_api.openai_client import OpenAIClient
    from letta.schemas.llm_config import LLMConfig

    client = OpenAIClient.__new__(OpenAIClient)
    client._venice_capabilities_cache = {"already": {"supports_tools": True, "supports_vision": False}}
    client.actor = None

    config = LLMConfig(
        model="llama-3.3-70b",
        model_endpoint_type="openai",
        model_endpoint="https://api.venice.ai/api/v1",
        context_window=131072,
    )

    with patch("letta.llm_api.venice.venice_get_model_list_async", new_callable=AsyncMock) as mock_list:
        await client._venice_ensure_capabilities_async(config)

    mock_list.assert_not_called()


@pytest.mark.asyncio
async def test_venice_ensure_capabilities_async_api_failure():
    """_venice_ensure_capabilities_async handles API failure gracefully."""
    from letta.llm_api.openai_client import OpenAIClient
    from letta.schemas.llm_config import LLMConfig

    client = OpenAIClient.__new__(OpenAIClient)
    client._venice_capabilities_cache = {}
    client.actor = None

    config = LLMConfig(
        model="llama-3.3-70b",
        model_endpoint_type="openai",
        model_endpoint="https://api.venice.ai/api/v1",
        context_window=131072,
    )

    with patch("letta.llm_api.venice.venice_get_model_list_async", new_callable=AsyncMock) as mock_list, \
         patch.object(OpenAIClient, "get_byok_overrides_async", new_callable=AsyncMock) as mock_byok:
        mock_list.side_effect = Exception("network error")
        mock_byok.return_value = ("test-key", None, None)

        # Should not raise
        await client._venice_ensure_capabilities_async(config)

    # Cache should still be empty (not populated with bad data)
    assert client._venice_capabilities_cache == {}
