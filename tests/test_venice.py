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


# ---------------------------------------------------------------------------
# VeniceThinkTagStreamBuffer tests
# ---------------------------------------------------------------------------

from letta.interfaces.openai_streaming_interface import VeniceThinkTagStreamBuffer


class TestVeniceThinkTagStreamBuffer:
    """Tests for the streaming <think> tag extraction buffer."""

    def test_no_think_tags(self):
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("Hello, world!"))
        assert segments == [(False, "Hello, world!")]

    def test_complete_think_tag_single_chunk(self):
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("<think>reasoning here</think>actual reply"))
        assert segments == [(True, "reasoning here"), (False, "actual reply")]

    def test_think_tag_split_across_chunks(self):
        """Tag is split across multiple feed() calls."""
        buf = VeniceThinkTagStreamBuffer()
        all_segments = []
        all_segments.extend(buf.feed("<thi"))
        all_segments.extend(buf.feed("nk>I am thinking"))
        all_segments.extend(buf.feed("</think>OK done"))
        all_segments.extend(buf.flush())
        # Filter out empty
        all_segments = [(r, t) for r, t in all_segments if t]
        reasoning = "".join(t for r, t in all_segments if r)
        content = "".join(t for r, t in all_segments if not r)
        assert "I am thinking" in reasoning
        assert "OK done" in content

    def test_think_tag_content_before_and_after(self):
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("before<think>middle</think>after"))
        assert (False, "before") in segments
        assert (True, "middle") in segments
        assert (False, "after") in segments

    def test_empty_think_tag(self):
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("<think></think>content"))
        # Empty think tag should not produce reasoning segment
        segments = [(r, t) for r, t in segments if t]
        assert (False, "content") in segments

    def test_partial_closing_tag_buffered(self):
        """Partial </think> at chunk boundary should be buffered."""
        buf = VeniceThinkTagStreamBuffer()
        seg1 = list(buf.feed("<think>reasoning</th"))
        seg2 = list(buf.feed("ink>result"))
        seg2.extend(buf.flush())
        all_segments = seg1 + seg2
        all_segments = [(r, t) for r, t in all_segments if t]
        reasoning = "".join(t for r, t in all_segments if r)
        content = "".join(t for r, t in all_segments if not r)
        assert "reasoning" in reasoning
        assert "result" in content

    def test_flush_remaining_content(self):
        """flush() yields buffered partial tags at chunk boundary."""
        buf = VeniceThinkTagStreamBuffer()
        # Feed a partial closing tag at the end so partial gets buffered
        list(buf.feed("<think>still going</th"))
        flushed = list(buf.flush())
        flushed = [(r, t) for r, t in flushed if t]
        assert len(flushed) > 0

    def test_only_think_content(self):
        """Entire message is inside think tags."""
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("<think>all reasoning no content</think>"))
        segments = [(r, t) for r, t in segments if t]
        assert len(segments) == 1
        assert segments[0] == (True, "all reasoning no content")

    def test_multiple_think_blocks(self):
        """Multiple <think> blocks in a single chunk."""
        buf = VeniceThinkTagStreamBuffer()
        segments = list(buf.feed("<think>r1</think>text1<think>r2</think>text2"))
        assert (True, "r1") in segments
        assert (False, "text1") in segments
        assert (True, "r2") in segments
        assert (False, "text2") in segments


# ---------------------------------------------------------------------------
# Tool schema cleaning tests
# ---------------------------------------------------------------------------

class TestVeniceToolSchemaCleaning:
    """Tests for _venice_clean_tool_schemas."""

    def test_strips_strict_and_additional_properties(self):
        from letta.llm_api.openai_client import OpenAIClient

        client = OpenAIClient.__new__(OpenAIClient)
        tools = [{
            "type": "function",
            "function": {
                "name": "send_message",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {"message": {"type": "string"}},
                    "required": ["message"],
                    "additionalProperties": False,
                },
            },
        }]
        cleaned = client._venice_clean_tool_schemas(tools)
        func = cleaned[0]["function"]
        assert "strict" not in func
        assert "additionalProperties" not in func["parameters"]
        # Other fields preserved
        assert func["name"] == "send_message"
        assert func["parameters"]["properties"] == {"message": {"type": "string"}}

    def test_preserves_tools_without_strict_fields(self):
        from letta.llm_api.openai_client import OpenAIClient

        client = OpenAIClient.__new__(OpenAIClient)
        tools = [{
            "type": "function",
            "function": {
                "name": "my_tool",
                "parameters": {"type": "object", "properties": {}},
            },
        }]
        cleaned = client._venice_clean_tool_schemas(tools)
        assert cleaned[0]["function"]["name"] == "my_tool"

    def test_filter_request_data_cleans_tool_schemas(self):
        """When model supports tools, schemas should be cleaned."""
        from letta.llm_api.openai_client import OpenAIClient
        from letta.schemas.llm_config import LLMConfig

        client = OpenAIClient.__new__(OpenAIClient)
        client._venice_capabilities_cache = {
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        }
        data = {
            "model": "llama-3.3-70b",
            "messages": [{"role": "user", "content": "hello"}],
            "tools": [{
                "type": "function",
                "function": {
                    "name": "send_message",
                    "strict": True,
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "additionalProperties": False,
                    },
                },
            }],
            "tool_choice": "auto",
        }
        config = LLMConfig(
            model="llama-3.3-70b",
            model_endpoint_type="openai",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=131072,
        )
        result = client._venice_filter_request_data(data, config)
        func = result["tools"][0]["function"]
        assert "strict" not in func
        assert "additionalProperties" not in func["parameters"]


# ---------------------------------------------------------------------------
# supports_structured_output / requires_auto_tool_choice / content_none
# ---------------------------------------------------------------------------

from letta.llm_api.openai_client import supports_structured_output, requires_auto_tool_choice, supports_content_none


class TestVeniceCompatibilityFlags:
    """Ensure Venice endpoints get correct compatibility flags."""

    def _venice_config(self):
        from letta.schemas.llm_config import LLMConfig

        return LLMConfig(
            model="llama-3.3-70b",
            model_endpoint_type="openai",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=131072,
        )

    def _openai_config(self):
        from letta.schemas.llm_config import LLMConfig

        return LLMConfig(
            model="gpt-4o",
            model_endpoint_type="openai",
            model_endpoint="https://api.openai.com/v1",
            context_window=128000,
        )

    def test_venice_no_structured_output(self):
        assert supports_structured_output(self._venice_config()) is False

    def test_openai_has_structured_output(self):
        assert supports_structured_output(self._openai_config()) is True

    def test_venice_requires_auto_tool_choice(self):
        assert requires_auto_tool_choice(self._venice_config()) is True

    def test_openai_does_not_require_auto_tool_choice(self):
        assert requires_auto_tool_choice(self._openai_config()) is False

    def test_venice_no_content_none(self):
        assert supports_content_none(self._venice_config()) is False

    def test_openai_supports_content_none(self):
        assert supports_content_none(self._openai_config()) is True


# ---------------------------------------------------------------------------
# Multimodal / vision message handling tests
# ---------------------------------------------------------------------------

# Realistic OpenAI-format multimodal message fixtures
MULTIMODAL_USER_MESSAGE = {
    "role": "user",
    "content": [
        {"type": "text", "text": "What's in this image?"},
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "detail": "auto",
            },
        },
    ],
}

MULTIMODAL_USER_MESSAGE_MULTIPLE_IMAGES = {
    "role": "user",
    "content": [
        {"type": "text", "text": "Compare these two images."},
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
                "detail": "high",
            },
        },
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
                "detail": "low",
            },
        },
    ],
}

MULTIMODAL_USER_MESSAGE_IMAGE_ONLY = {
    "role": "user",
    "content": [
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
                "detail": "auto",
            },
        },
    ],
}

PLAIN_TEXT_MESSAGE = {
    "role": "user",
    "content": "Hello, how are you?",
}

ASSISTANT_MESSAGE = {
    "role": "assistant",
    "content": "I'm doing well, thanks!",
}

SYSTEM_MESSAGE = {
    "role": "system",
    "content": "You are a helpful assistant.",
}

TOOL_RESULT_MESSAGE = {
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "Result: 42",
}


class TestVeniceMultimodalFiltering:
    """Tests for Venice multimodal/vision message handling.

    Covers:
    - Image content stripping for non-vision models
    - Image content passthrough for vision-capable models
    - Mixed message histories (text + image + tool + assistant)
    - Edge cases: image-only messages, multiple images, URL images
    """

    def _make_client_with_caps(self, model_caps: dict):
        """Create an OpenAIClient with pre-populated capability cache."""
        from letta.llm_api.openai_client import OpenAIClient

        client = OpenAIClient.__new__(OpenAIClient)
        client._venice_capabilities_cache = model_caps
        return client

    def _venice_config(self, model="llama-3.3-70b"):
        from letta.schemas.llm_config import LLMConfig

        return LLMConfig(
            model=model,
            model_endpoint_type="openai",
            model_endpoint="https://api.venice.ai/api/v1",
            context_window=131072,
        )

    # --- Non-vision model: images should be stripped ---

    def test_non_vision_model_strips_images_from_mixed_message(self):
        """Text+image message → only text parts remain for non-vision model."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [MULTIMODAL_USER_MESSAGE], "llama-3.3-70b"
        )
        assert len(result) == 1
        content = result[0]["content"]
        assert isinstance(content, list)
        assert len(content) == 1
        assert content[0]["type"] == "text"
        assert content[0]["text"] == "What's in this image?"

    def test_non_vision_model_strips_multiple_images(self):
        """Message with text + 2 images → only text part remains."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [MULTIMODAL_USER_MESSAGE_MULTIPLE_IMAGES], "llama-3.3-70b"
        )
        content = result[0]["content"]
        assert isinstance(content, list)
        assert len(content) == 1
        assert content[0]["text"] == "Compare these two images."

    def test_non_vision_model_image_only_message_gets_placeholder(self):
        """Message with ONLY image (no text) → replaced with placeholder string."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [MULTIMODAL_USER_MESSAGE_IMAGE_ONLY], "llama-3.3-70b"
        )
        content = result[0]["content"]
        assert isinstance(content, str)
        assert "model does not support vision" in content.lower()

    def test_non_vision_model_plain_text_unchanged(self):
        """Plain text message (string content) passes through untouched."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [PLAIN_TEXT_MESSAGE], "llama-3.3-70b"
        )
        assert result[0] == PLAIN_TEXT_MESSAGE

    def test_non_vision_model_assistant_message_unchanged(self):
        """Assistant messages are never filtered (they don't contain images)."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [ASSISTANT_MESSAGE], "llama-3.3-70b"
        )
        assert result[0] == ASSISTANT_MESSAGE

    def test_non_vision_model_system_message_unchanged(self):
        """System messages pass through untouched."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            [SYSTEM_MESSAGE], "llama-3.3-70b"
        )
        assert result[0] == SYSTEM_MESSAGE

    # --- Vision-capable model: images should pass through ---

    def test_vision_model_preserves_images(self):
        """Vision model gets images passed through unmodified."""
        client = self._make_client_with_caps({
            "google-gemma-3-27b-it": {"supports_tools": True, "supports_vision": True},
        })
        data = {
            "model": "google-gemma-3-27b-it",
            "messages": [SYSTEM_MESSAGE, MULTIMODAL_USER_MESSAGE],
            "tools": [{"type": "function", "function": {"name": "test", "parameters": {}}}],
            "tool_choice": "auto",
        }
        config = self._venice_config(model="google-gemma-3-27b-it")
        result = client._venice_filter_request_data(data, config)
        # Images should still be present
        user_msg = result["messages"][1]
        content_types = [p["type"] for p in user_msg["content"]]
        assert "image_url" in content_types
        assert "text" in content_types

    def test_vision_model_preserves_multiple_images(self):
        """Vision model preserves all image parts in multi-image message."""
        client = self._make_client_with_caps({
            "google-gemma-3-27b-it": {"supports_tools": True, "supports_vision": True},
        })
        data = {
            "model": "google-gemma-3-27b-it",
            "messages": [MULTIMODAL_USER_MESSAGE_MULTIPLE_IMAGES],
        }
        config = self._venice_config(model="google-gemma-3-27b-it")
        result = client._venice_filter_request_data(data, config)
        content = result["messages"][0]["content"]
        image_parts = [p for p in content if p["type"] == "image_url"]
        assert len(image_parts) == 2

    def test_vision_model_preserves_image_only_message(self):
        """Vision model preserves image-only messages without placeholder."""
        client = self._make_client_with_caps({
            "google-gemma-3-27b-it": {"supports_tools": True, "supports_vision": True},
        })
        data = {
            "model": "google-gemma-3-27b-it",
            "messages": [MULTIMODAL_USER_MESSAGE_IMAGE_ONLY],
        }
        config = self._venice_config(model="google-gemma-3-27b-it")
        result = client._venice_filter_request_data(data, config)
        content = result["messages"][0]["content"]
        assert isinstance(content, list)
        assert content[0]["type"] == "image_url"

    # --- Full request pipeline with mixed history ---

    def test_full_pipeline_non_vision_mixed_history(self):
        """Full filter pipeline: non-vision model with realistic conversation history."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        messages = [
            SYSTEM_MESSAGE,
            MULTIMODAL_USER_MESSAGE,  # has image
            ASSISTANT_MESSAGE,
            {"role": "user", "content": "Now describe the second one."},
            MULTIMODAL_USER_MESSAGE_MULTIPLE_IMAGES,  # has 2 images
            ASSISTANT_MESSAGE,
            PLAIN_TEXT_MESSAGE,
        ]
        data = {
            "model": "llama-3.3-70b",
            "messages": messages,
            "tools": [{"type": "function", "function": {"name": "send_message", "parameters": {"type": "object", "properties": {}}}}],
            "tool_choice": "auto",
        }
        config = self._venice_config(model="llama-3.3-70b")
        result = client._venice_filter_request_data(data, config)

        # System message untouched
        assert result["messages"][0] == SYSTEM_MESSAGE
        # First multimodal: images stripped, text kept
        content_1 = result["messages"][1]["content"]
        assert isinstance(content_1, list)
        assert all(p["type"] == "text" for p in content_1)
        # Assistant message untouched
        assert result["messages"][2] == ASSISTANT_MESSAGE
        # Plain text untouched
        assert result["messages"][3]["content"] == "Now describe the second one."
        # Second multimodal: images stripped
        content_4 = result["messages"][4]["content"]
        assert isinstance(content_4, list)
        assert all(p["type"] == "text" for p in content_4)
        # Last plain text untouched
        assert result["messages"][6] == PLAIN_TEXT_MESSAGE

    def test_full_pipeline_vision_model_mixed_history(self):
        """Full filter pipeline: vision model preserves all images in history."""
        client = self._make_client_with_caps({
            "google-gemma-3-27b-it": {"supports_tools": True, "supports_vision": True},
        })
        messages = [
            SYSTEM_MESSAGE,
            MULTIMODAL_USER_MESSAGE,
            ASSISTANT_MESSAGE,
            MULTIMODAL_USER_MESSAGE_MULTIPLE_IMAGES,
        ]
        data = {
            "model": "google-gemma-3-27b-it",
            "messages": messages,
            "tools": [{"type": "function", "function": {"name": "send_message", "parameters": {}}}],
            "tool_choice": "auto",
        }
        config = self._venice_config(model="google-gemma-3-27b-it")
        result = client._venice_filter_request_data(data, config)

        # All messages preserved as-is
        assert len(result["messages"]) == 4
        # Image content intact in first multimodal
        types_1 = [p["type"] for p in result["messages"][1]["content"]]
        assert "image_url" in types_1
        # Both images intact in second multimodal
        image_parts = [p for p in result["messages"][3]["content"] if p["type"] == "image_url"]
        assert len(image_parts) == 2

    # --- Non-vision model with tool messages in history ---

    def test_non_vision_non_tool_model_full_conversion(self):
        """Non-vision, non-tool model: images stripped AND tool messages converted."""
        client = self._make_client_with_caps({
            "venice-uncensored": {"supports_tools": False, "supports_vision": False},
        })
        messages = [
            SYSTEM_MESSAGE,
            MULTIMODAL_USER_MESSAGE,  # has image
            {"role": "assistant", "content": None, "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "search", "arguments": "{}"}}]},
            TOOL_RESULT_MESSAGE,
            PLAIN_TEXT_MESSAGE,
        ]
        data = {
            "model": "venice-uncensored",
            "messages": messages,
            "tools": [{"type": "function", "function": {"name": "search", "parameters": {}}}],
            "tool_choice": "required",
        }
        config = self._venice_config(model="venice-uncensored")
        result = client._venice_filter_request_data(data, config)

        # Tools and tool_choice stripped
        assert "tools" not in result
        assert "tool_choice" not in result
        # Images stripped from multimodal message
        content_1 = result["messages"][1]["content"]
        assert isinstance(content_1, list)
        assert all(p["type"] == "text" for p in content_1)
        # Tool result message converted to user message
        tool_msg = result["messages"][3]
        assert tool_msg["role"] == "user"
        assert "Tool result" in tool_msg["content"]
        assert "Result: 42" in tool_msg["content"]

    # --- Unknown model defaults (permissive for vision) ---

    def test_unknown_model_defaults_no_vision(self):
        """Unknown model with no cached caps: supports_vision defaults to False → images stripped."""
        client = self._make_client_with_caps({})  # empty cache
        data = {
            "model": "some-new-model",
            "messages": [MULTIMODAL_USER_MESSAGE],
        }
        config = self._venice_config(model="some-new-model")
        result = client._venice_filter_request_data(data, config)
        content = result["messages"][0]["content"]
        # Should be filtered since default supports_vision is False
        assert isinstance(content, list)
        assert all(p["type"] == "text" for p in content)

    # --- Edge cases ---

    def test_empty_content_list_unchanged(self):
        """Message with empty content list passes through."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        msg = {"role": "user", "content": []}
        result = client._venice_filter_image_content([msg], "llama-3.3-70b")
        assert result[0]["content"] == []

    def test_non_dict_message_unchanged(self):
        """Non-dict messages (e.g. Pydantic objects that weren't serialized) pass through."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        result = client._venice_filter_image_content(
            ["not a dict message"], "llama-3.3-70b"
        )
        assert result[0] == "not a dict message"

    def test_url_image_stripped_for_non_vision(self):
        """URL-based image (not base64) is also stripped for non-vision models."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        msg = {
            "role": "user",
            "content": [
                {"type": "text", "text": "Look at this:"},
                {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}},
            ],
        }
        result = client._venice_filter_image_content([msg], "llama-3.3-70b")
        content = result[0]["content"]
        assert len(content) == 1
        assert content[0]["type"] == "text"

    def test_message_with_only_text_parts_in_list_unchanged(self):
        """Content list with only text parts (no images) is preserved as-is."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        msg = {
            "role": "user",
            "content": [
                {"type": "text", "text": "First part."},
                {"type": "text", "text": "Second part."},
            ],
        }
        result = client._venice_filter_image_content([msg], "llama-3.3-70b")
        content = result[0]["content"]
        assert len(content) == 2
        assert all(p["type"] == "text" for p in content)

    def test_filter_preserves_message_role_and_other_fields(self):
        """Filtering preserves role, name, and any other fields on the message dict."""
        client = self._make_client_with_caps({
            "llama-3.3-70b": {"supports_tools": True, "supports_vision": False},
        })
        msg = {
            "role": "user",
            "name": "test_user",
            "content": [
                {"type": "text", "text": "Describe this."},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}},
            ],
        }
        result = client._venice_filter_image_content([msg], "llama-3.3-70b")
        assert result[0]["role"] == "user"
        assert result[0]["name"] == "test_user"
        assert len(result[0]["content"]) == 1
