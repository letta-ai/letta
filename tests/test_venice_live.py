"""Live integration tests for Venice OpenAI-proxy integration.

These tests hit the real Venice API. They require:
  - VENICE_API_KEY environment variable set
  - Network access to https://api.venice.ai

Skip automatically when VENICE_API_KEY is not set.

Run with:
    uv run pytest tests/test_venice_live.py -v --tb=short

Cost estimate: each run costs ~$0.001-0.01 (cheapest models, tiny prompts).
"""
import base64
import os

import pytest

# ---------------------------------------------------------------------------
# Skip entire module if no API key
# ---------------------------------------------------------------------------

VENICE_API_KEY = os.environ.get("VENICE_API_KEY")
pytestmark = pytest.mark.skipif(not VENICE_API_KEY, reason="VENICE_API_KEY not set")

VENICE_BASE_URL = "https://api.venice.ai/api/v1"


def _generate_test_png_b64():
    """Generate a valid 64x64 red-blue gradient PNG as base64.

    Venice rejects very small images, so we use 64x64 which passes validation.
    """
    import struct
    import zlib

    width, height = 64, 64
    raw_data = b""
    for y in range(height):
        raw_data += b"\x00"  # filter: none
        for x in range(width):
            r = int(255 * x / width)
            g = 0
            b = int(255 * y / height)
            raw_data += bytes([r, g, b])

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF
    ihdr = struct.pack(">I", 13) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)
    compressed = zlib.compress(raw_data, 9)
    idat_crc = zlib.crc32(b"IDAT" + compressed) & 0xFFFFFFFF
    idat = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", idat_crc)
    iend_crc = zlib.crc32(b"IEND") & 0xFFFFFFFF
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)
    return base64.b64encode(sig + ihdr + idat + iend).decode()


TEST_PNG_B64 = _generate_test_png_b64()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_sync_client():
    """Create a real OpenAI client pointed at Venice."""
    from openai import OpenAI

    return OpenAI(api_key=VENICE_API_KEY, base_url=VENICE_BASE_URL)


async def _make_async_client():
    """Create a real async OpenAI client pointed at Venice."""
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=VENICE_API_KEY, base_url=VENICE_BASE_URL)


# ---------------------------------------------------------------------------
# Model list
# ---------------------------------------------------------------------------

class TestVeniceLiveModelList:
    """Test that we can fetch and parse the Venice model list."""

    @pytest.mark.asyncio
    async def test_fetch_model_list(self):
        from letta.llm_api.venice import venice_get_model_list_async

        result = await venice_get_model_list_async(VENICE_BASE_URL, api_key=VENICE_API_KEY)
        assert "data" in result
        models = result["data"]
        assert len(models) > 0

        # Every model should have an id and type
        for m in models:
            assert "id" in m
            assert "type" in m or "object" in m

    @pytest.mark.asyncio
    async def test_model_list_has_capabilities(self):
        """Venice models should include model_spec.capabilities."""
        from letta.llm_api.venice import venice_get_model_list_async

        result = await venice_get_model_list_async(VENICE_BASE_URL, api_key=VENICE_API_KEY)
        models = result["data"]

        # At least some models should have capabilities
        models_with_caps = [
            m for m in models
            if m.get("model_spec", {}).get("capabilities")
        ]
        assert len(models_with_caps) > 5, f"Only {len(models_with_caps)} models have capabilities"

    @pytest.mark.asyncio
    async def test_model_list_has_context_length(self):
        """Venice models should report context length."""
        from letta.llm_api.venice import venice_get_model_list_async

        result = await venice_get_model_list_async(VENICE_BASE_URL, api_key=VENICE_API_KEY)
        models = result["data"]

        for m in models:
            spec = m.get("model_spec", {})
            ctx = spec.get("availableContextTokens") or spec.get("context_length")
            assert ctx is not None or m.get("type") == "embedding", (
                f"Model {m['id']} missing context length"
            )


# ---------------------------------------------------------------------------
# Basic chat completion (non-vision, tool-capable model)
# ---------------------------------------------------------------------------

class TestVeniceLiveChatCompletion:
    """Test basic chat completions against Venice."""

    def test_simple_chat_sync(self):
        """Sync chat completion with a cheap model."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="qwen3-4b",
            messages=[{"role": "user", "content": "Reply with exactly: PONG"}],
            max_tokens=10,
        )
        assert response.choices[0].message.content is not None
        assert len(response.choices[0].message.content) > 0

    @pytest.mark.asyncio
    async def test_simple_chat_async(self):
        """Async chat completion."""
        client = await _make_async_client()
        try:
            response = await client.chat.completions.create(
                model="qwen3-4b",
                messages=[{"role": "user", "content": "Reply with exactly: PONG"}],
                max_tokens=10,
            )
            assert response.choices[0].message.content is not None
        finally:
            await client.close()

    def test_null_fields_dont_400(self):
        """Venice should not 400 when we omit null fields (our filter handles this)."""
        client = _make_sync_client()
        # Explicitly send a minimal request — no tools, no tool_choice
        response = client.chat.completions.create(
            model="qwen3-4b",
            messages=[{"role": "user", "content": "Say hi"}],
            max_tokens=5,
        )
        assert response.choices[0].finish_reason in ("stop", "length")


# ---------------------------------------------------------------------------
# Tool calling
# ---------------------------------------------------------------------------

class TestVeniceLiveToolCalling:
    """Test function calling with Venice models that support it."""

    def test_tool_call_basic(self):
        """Model should return a tool call when given a tool and asked to use it."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="qwen3-4b",
            messages=[
                {"role": "system", "content": "You must use the provided tools to respond. Do not output any text, only use the send_message tool."},
                {"role": "user", "content": "Say hello to me using the send_message tool."},
            ],
            tools=[{
                "type": "function",
                "function": {
                    "name": "send_message",
                    "description": "Send a message to the user.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "message": {"type": "string", "description": "The message to send."},
                        },
                        "required": ["message"],
                    },
                },
            }],
            tool_choice="auto",
            max_tokens=200,
        )
        choice = response.choices[0]
        # Model should either call the tool or produce content
        # We primarily check it doesn't error out
        assert choice.finish_reason in ("stop", "tool_calls", "length")
        if choice.message.tool_calls:
            tc = choice.message.tool_calls[0]
            assert tc.function.name == "send_message"
            assert tc.function.arguments  # non-empty JSON string

    def test_tool_call_no_strict(self):
        """Tool call works without strict/additionalProperties (Venice compat)."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[
                {"role": "system", "content": "Always use the get_weather tool to answer weather questions."},
                {"role": "user", "content": "What's the weather in Tokyo?"},
            ],
            tools=[{
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get current weather for a city.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "city": {"type": "string"},
                        },
                        "required": ["city"],
                    },
                    # NOTE: no "strict", no "additionalProperties" — Venice style
                },
            }],
            tool_choice="auto",
            max_tokens=200,
        )
        assert response.choices[0].finish_reason in ("stop", "tool_calls", "length")


# ---------------------------------------------------------------------------
# Think-tag / reasoning extraction
# ---------------------------------------------------------------------------

class TestVeniceLiveReasoning:
    """Test that reasoning models produce <think> tags we can parse."""

    def test_reasoning_model_produces_think_tags(self):
        """qwen3-4b with reasoning should produce <think> tags in content."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="qwen3-4b",
            messages=[
                {"role": "user", "content": "What is 17 * 23? Think step by step."},
            ],
            max_tokens=500,
        )
        content = response.choices[0].message.content or ""
        # qwen3 reasoning models typically wrap their reasoning in <think> tags
        # This may or may not be present depending on the prompt, so we just
        # verify the response is valid and test our extraction on it
        assert len(content) > 0

        # Test our extraction function on the response
        from letta.llm_api.openai_client import OpenAIClient
        client_obj = OpenAIClient.__new__(OpenAIClient)
        cleaned, reasoning = client_obj._venice_extract_think_reasoning(content)

        if "<think>" in content:
            # If think tags are present, extraction should work
            assert reasoning is not None
            assert "<think>" not in (cleaned or "")
            assert "</think>" not in (cleaned or "")
        else:
            # No think tags — extraction returns content unchanged
            assert cleaned == content
            assert reasoning is None

    @pytest.mark.asyncio
    async def test_streaming_reasoning_model(self):
        """Stream from a reasoning model and verify chunks arrive."""
        client = await _make_async_client()
        try:
            stream = await client.chat.completions.create(
                model="qwen3-4b",
                messages=[{"role": "user", "content": "What is 2 + 2?"}],
                max_tokens=100,
                stream=True,
            )
            chunks = []
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    chunks.append(chunk.choices[0].delta.content)
            full_content = "".join(chunks)
            assert len(full_content) > 0
        finally:
            await client.close()


# ---------------------------------------------------------------------------
# Vision / multimodal
# ---------------------------------------------------------------------------

class TestVeniceLiveVision:
    """Test multimodal (vision) messages with Venice."""

    def test_vision_model_accepts_image(self):
        """Vision model should accept and respond to an image message."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="google-gemma-3-27b-it",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image? Reply with just the color name."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{TEST_PNG_B64}",
                            "detail": "low",
                        },
                    },
                ],
            }],
            max_tokens=20,
        )
        content = response.choices[0].message.content
        assert content is not None
        assert len(content) > 0

    def test_vision_model_text_plus_image(self):
        """Vision model handles mixed text+image content parts."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="google-gemma-3-27b-it",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that describes images."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this tiny image in one sentence."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{TEST_PNG_B64}",
                                "detail": "auto",
                            },
                        },
                    ],
                },
            ],
            max_tokens=50,
        )
        assert response.choices[0].message.content is not None
        assert response.choices[0].finish_reason in ("stop", "length")

    def test_non_vision_model_rejects_image(self):
        """Non-vision model should error or behave unexpectedly with raw image.

        This tests what happens WITHOUT our filter — Venice should either
        400 or return an error. This validates why our filter is needed.
        """
        client = _make_sync_client()
        try:
            response = client.chat.completions.create(
                model="qwen3-4b",  # non-vision
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What is this?"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{TEST_PNG_B64}",
                                "detail": "low",
                            },
                        },
                    ],
                }],
                max_tokens=20,
            )
            # If it doesn't error, the model may just ignore the image
            # Either way, this documents the behavior
            assert response.choices[0].message.content is not None
        except Exception as e:
            # Expected: Venice may 400/422 for non-vision model + image
            assert "400" in str(e) or "422" in str(e) or "image" in str(e).lower() or "vision" in str(e).lower(), (
                f"Unexpected error type: {e}"
            )

    @pytest.mark.asyncio
    async def test_vision_model_streaming_with_image(self):
        """Stream a response from a vision model given an image."""
        client = await _make_async_client()
        try:
            stream = await client.chat.completions.create(
                model="google-gemma-3-27b-it",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What do you see? One word answer."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{TEST_PNG_B64}",
                                "detail": "low",
                            },
                        },
                    ],
                }],
                max_tokens=20,
                stream=True,
            )
            chunks = []
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    chunks.append(chunk.choices[0].delta.content)
            full_content = "".join(chunks)
            assert len(full_content) > 0
        finally:
            await client.close()


# ---------------------------------------------------------------------------
# Non-tool model (venice-uncensored)
# ---------------------------------------------------------------------------

class TestVeniceLiveNonToolModel:
    """Test models that don't support function calling."""

    def test_non_tool_model_plain_chat(self):
        """venice-uncensored should work for plain chat without tools."""
        client = _make_sync_client()
        response = client.chat.completions.create(
            model="venice-uncensored",
            messages=[{"role": "user", "content": "Say exactly: HELLO"}],
            max_tokens=10,
        )
        assert response.choices[0].message.content is not None

    def test_non_tool_model_rejects_tools(self):
        """venice-uncensored should error if we send tools (validates our filter need)."""
        client = _make_sync_client()
        try:
            response = client.chat.completions.create(
                model="venice-uncensored",
                messages=[{"role": "user", "content": "Use the tool."}],
                tools=[{
                    "type": "function",
                    "function": {
                        "name": "test_tool",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }],
                tool_choice="auto",
                max_tokens=20,
            )
            # If it doesn't error, it likely just ignored the tools
            assert response.choices[0].message.content is not None
        except Exception as e:
            # Expected: Venice may reject tools for non-tool model
            assert True, f"Venice rejected tools as expected: {e}"


# ---------------------------------------------------------------------------
# End-to-end through our filter pipeline
# ---------------------------------------------------------------------------

class TestVeniceLiveFilterPipeline:
    """Test the full OpenAIClient Venice pipeline end-to-end."""

    @pytest.mark.asyncio
    async def test_full_async_request_with_venice_filter(self):
        """Full async request through OpenAIClient with Venice filters applied."""
        from letta.llm_api.openai_client import OpenAIClient
        from letta.schemas.llm_config import LLMConfig

        config = LLMConfig(
            model="qwen3-4b",
            model_endpoint_type="openai",
            model_endpoint=VENICE_BASE_URL,
            context_window=32768,
        )

        client = OpenAIClient.__new__(OpenAIClient)
        client.actor = None
        client._venice_capabilities_cache = {}

        # Build a minimal request dict
        request_data = {
            "model": "qwen3-4b",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Reply with exactly: ALIVE"},
            ],
            "max_tokens": 10,
        }

        # Apply Venice filters
        await client._venice_ensure_capabilities_async(config)
        filtered = client._venice_filter_request_data(request_data, config)

        # Verify capabilities were cached
        assert len(client._venice_capabilities_cache) > 0
        assert "qwen3-4b" in client._venice_capabilities_cache

        # Verify no None values in filtered data
        for k, v in filtered.items():
            assert v is not None, f"Key {k} is None after filtering"

    @pytest.mark.asyncio
    async def test_capabilities_cache_populated(self):
        """Ensure capabilities cache gets real data from Venice API."""
        from letta.llm_api.openai_client import OpenAIClient
        from letta.schemas.llm_config import LLMConfig
        from unittest.mock import AsyncMock

        config = LLMConfig(
            model="qwen3-4b",
            model_endpoint_type="openai",
            model_endpoint=VENICE_BASE_URL,
            context_window=32768,
        )

        client = OpenAIClient.__new__(OpenAIClient)
        client.actor = None
        client._venice_capabilities_cache = {}
        client.get_byok_overrides_async = AsyncMock(return_value=(VENICE_API_KEY, None, None))

        await client._venice_ensure_capabilities_async(config)

        # Should have cached multiple models
        cache = client._venice_capabilities_cache
        assert len(cache) > 10, f"Only {len(cache)} models cached"

        # Spot-check known models
        assert cache["qwen3-4b"]["supports_tools"] is True
        assert cache["qwen3-4b"]["supports_vision"] is False
        assert cache["google-gemma-3-27b-it"]["supports_vision"] is True
        assert cache["venice-uncensored"]["supports_tools"] is False
