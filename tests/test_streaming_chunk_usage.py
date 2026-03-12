"""
Integration tests verifying that OpenAI streaming interfaces correctly handle
provider usage reporting — both single-chunk (OpenAI) and multi-chunk cumulative
(baseten/vLLM) patterns.

These tests collect REAL chunks from providers and feed them through the actual
`_process_chunk` → `get_usage_statistics` code path.

References:
- OpenAI spec: https://developers.openai.com/api/reference/resources/chat/
  "All other chunks will also include a usage field, but with a null value."
- Anthropic docs: https://docs.anthropic.com/en/api/messages-streaming
  "The token counts shown in the usage field of the message_delta event are cumulative."
- vLLM continuous_usage_stats: https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/openai/chat_completion/serving.py
  Each chunk sends `prompt_tokens=len(res.prompt_token_ids)` (always the full prompt length)
"""

import asyncio
import os

import pytest
import tiktoken
from dotenv import load_dotenv
from openai import OpenAI
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.interfaces.openai_streaming_interface import (
    OpenAIStreamingInterface,
    SimpleOpenAIStreamingInterface,
)

load_dotenv()

PROMPT_MESSAGE = "Count from 1 to 20, one number per line"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _estimate_prompt_tokens(model: str = "gpt-4o-mini") -> int:
    """Estimate prompt tokens for our test message using tiktoken."""
    enc = tiktoken.encoding_for_model(model)
    raw_tokens = len(enc.encode(PROMPT_MESSAGE))
    CHAT_FORMAT_OVERHEAD = 10
    return raw_tokens + CHAT_FORMAT_OVERHEAD


def _count_output_tokens_from_chunks(chunks: list[ChatCompletionChunk], model: str = "gpt-4o-mini") -> int:
    """Count actual output tokens by extracting delta content from chunks and tokenizing."""
    enc = tiktoken.encoding_for_model(model)
    text_parts = []
    for chunk in chunks:
        if chunk.choices:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                text_parts.append(delta.content)
    full_text = "".join(text_parts)
    return len(enc.encode(full_text)) if full_text else 0


def _collect_openai_chunks() -> list[ChatCompletionChunk]:
    """Collect real streaming chunks from OpenAI."""
    # stream_options must match the Letta client setup:
    #   - apps/core/letta/llm_api/openai_client.py (OpenAIClient.stream_async)
    client = OpenAI()
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": PROMPT_MESSAGE}],
        max_tokens=100,
        stream=True,
        stream_options={"include_usage": True},
    )
    return list(stream)


def _collect_baseten_chunks() -> list[ChatCompletionChunk]:
    """Collect real streaming chunks from baseten/vLLM."""
    # stream_options must match the Letta client setup:
    #   - apps/core/letta/llm_api/baseten_client.py (BasetenClient.stream_async)
    model_id = os.environ["BASETEN_MODEL_ID"]
    client = OpenAI(
        api_key=os.environ["BASETEN_API_KEY"],
        base_url=f"https://model-{model_id}.api.baseten.co/environments/production/sync/v1",
    )
    stream = client.chat.completions.create(
        model="zai-org/GLM-5",
        messages=[{"role": "user", "content": PROMPT_MESSAGE}],
        max_tokens=100,
        stream=True,
        stream_options={"include_usage": True},
    )
    return list(stream)


async def _feed_chunks(interface, chunks: list[ChatCompletionChunk]):
    """Feed real chunks through _process_chunk, consuming the async generator."""
    for chunk in chunks:
        async for _ in interface._process_chunk(chunk):
            pass


def _assert_usage_correct(stats, chunks: list[ChatCompletionChunk]):
    """Shared assertions: reported usage should be close to tiktoken estimates."""
    expected_prompt = _estimate_prompt_tokens()
    expected_output = _count_output_tokens_from_chunks(chunks)

    assert stats.prompt_tokens > 0, f"prompt_tokens should be > 0, got {stats.prompt_tokens}"
    assert stats.prompt_tokens < expected_prompt * 1.5, (
        f"prompt_tokens={stats.prompt_tokens} is >1.5x the tiktoken estimate of {expected_prompt}"
    )

    assert stats.completion_tokens > 0, f"completion_tokens should be > 0, got {stats.completion_tokens}"
    assert stats.completion_tokens <= expected_output + 5, (
        f"completion_tokens={stats.completion_tokens} is much larger than tokenized output ({expected_output} tokens)"
    )


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="OPENAI_API_KEY not set")
class TestOpenAIChunksThroughOpenAIStreamingInterface:
    def test_usage_correct_after_processing(self):
        chunks = _collect_openai_chunks()
        interface = OpenAIStreamingInterface()
        asyncio.get_event_loop().run_until_complete(_feed_chunks(interface, chunks))
        _assert_usage_correct(interface.get_usage_statistics(), chunks)


@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="OPENAI_API_KEY not set")
class TestOpenAIChunksThroughSimpleOpenAIStreamingInterface:
    def test_usage_correct_after_processing(self):
        chunks = _collect_openai_chunks()
        interface = SimpleOpenAIStreamingInterface()
        asyncio.get_event_loop().run_until_complete(_feed_chunks(interface, chunks))
        _assert_usage_correct(interface.get_usage_statistics(), chunks)


# ---------------------------------------------------------------------------
# Baseten / vLLM
# Note: Cold start for baseten is slow, so can comment out if needed (or don't set API key)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not (os.environ.get("BASETEN_API_KEY") and os.environ.get("BASETEN_MODEL_ID")),
    reason="BASETEN_API_KEY and BASETEN_MODEL_ID not set",
)
class TestBasetenChunksThroughOpenAIStreamingInterface:
    def test_usage_correct_after_processing(self):
        chunks = _collect_baseten_chunks()
        interface = OpenAIStreamingInterface()
        asyncio.get_event_loop().run_until_complete(_feed_chunks(interface, chunks))
        _assert_usage_correct(interface.get_usage_statistics(), chunks)


@pytest.mark.skipif(
    not (os.environ.get("BASETEN_API_KEY") and os.environ.get("BASETEN_MODEL_ID")),
    reason="BASETEN_API_KEY and BASETEN_MODEL_ID not set",
)
class TestBasetenChunksThroughSimpleOpenAIStreamingInterface:
    def test_usage_correct_after_processing(self):
        chunks = _collect_baseten_chunks()
        interface = SimpleOpenAIStreamingInterface()
        asyncio.get_event_loop().run_until_complete(_feed_chunks(interface, chunks))
        _assert_usage_correct(interface.get_usage_statistics(), chunks)
