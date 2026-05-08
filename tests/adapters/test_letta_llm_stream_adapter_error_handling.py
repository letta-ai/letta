import anthropic
import httpx
import openai
import pytest
from anthropic.types.beta import (
    BetaMessage,
    BetaRawMessageStartEvent,
    BetaRawMessageStopEvent,
    BetaUsage,
)
from google.genai import errors as google_errors

from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
from letta.errors import (
    ContextWindowExceededError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMEmptyResponseError,
    LLMInsufficientCreditsError,
    LLMServerError,
)
from letta.llm_api.anthropic_client import AnthropicClient
from letta.llm_api.google_vertex_client import GoogleVertexClient
from letta.schemas.enums import LLMCallType
from letta.schemas.llm_config import LLMConfig


@pytest.mark.asyncio
async def test_letta_llm_stream_adapter_converts_anthropic_streaming_api_status_error(monkeypatch):
    """Regression: provider APIStatusError raised *during* streaming iteration should be converted via handle_llm_error."""

    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status_code=500, request=request)
    body = {
        "type": "error",
        "error": {"details": None, "type": "api_error", "message": "Internal server error"},
        "request_id": "req_011CWSBmrUwW5xdcqjfkUFS4",
    }

    class FakeAsyncStream:
        """Mimics anthropic.AsyncStream enough for AnthropicStreamingInterface (async cm + async iterator)."""

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise anthropic.APIStatusError("INTERNAL_SERVER_ERROR", response=response, body=body)

    async def fake_stream_async(self, request_data: dict, llm_config: LLMConfig):
        return FakeAsyncStream()

    monkeypatch.setattr(AnthropicClient, "stream_async", fake_stream_async, raising=True)

    llm_client = AnthropicClient()
    llm_config = LLMConfig(model="claude-sonnet-4-5-20250929", model_endpoint_type="anthropic", context_window=200000)
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config, call_type=LLMCallType.agent_step)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(LLMServerError):
        async for _ in gen:
            pass


@pytest.mark.asyncio
async def test_letta_llm_stream_adapter_converts_anthropic_413_request_too_large(monkeypatch):
    """Regression: 413 request_too_large errors should be converted to ContextWindowExceededError."""

    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status_code=413, request=request)
    body = {
        "type": "error",
        "error": {"type": "request_too_large", "message": "Request exceeds the maximum size"},
    }

    class FakeAsyncStream:
        """Mimics anthropic.AsyncStream enough for AnthropicStreamingInterface (async cm + async iterator)."""

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise anthropic.APIStatusError("REQUEST_TOO_LARGE", response=response, body=body)

    async def fake_stream_async(self, request_data: dict, llm_config: LLMConfig):
        return FakeAsyncStream()

    monkeypatch.setattr(AnthropicClient, "stream_async", fake_stream_async, raising=True)

    llm_client = AnthropicClient()
    llm_config = LLMConfig(model="claude-sonnet-4-5-20250929", model_endpoint_type="anthropic", context_window=200000)
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config, call_type=LLMCallType.agent_step)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(ContextWindowExceededError):
        async for _ in gen:
            pass


@pytest.mark.asyncio
async def test_letta_llm_stream_adapter_converts_httpx_read_error(monkeypatch):
    """Regression: httpx.ReadError raised during streaming should be converted to LLMConnectionError."""

    class FakeAsyncStream:
        """Mimics anthropic.AsyncStream enough for AnthropicStreamingInterface (async cm + async iterator)."""

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise httpx.ReadError("Connection closed unexpectedly")

    async def fake_stream_async(self, request_data: dict, llm_config: LLMConfig):
        return FakeAsyncStream()

    monkeypatch.setattr(AnthropicClient, "stream_async", fake_stream_async, raising=True)

    llm_client = AnthropicClient()
    llm_config = LLMConfig(model="claude-sonnet-4-5-20250929", model_endpoint_type="anthropic", context_window=200000)
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config, call_type=LLMCallType.agent_step)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(LLMConnectionError):
        async for _ in gen:
            pass


@pytest.mark.asyncio
async def test_letta_llm_stream_adapter_converts_httpx_write_error(monkeypatch):
    """Regression: httpx.WriteError raised during streaming should be converted to LLMConnectionError."""

    class FakeAsyncStream:
        """Mimics anthropic.AsyncStream enough for AnthropicStreamingInterface (async cm + async iterator)."""

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise httpx.WriteError("Failed to write to connection")

    async def fake_stream_async(self, request_data: dict, llm_config: LLMConfig):
        return FakeAsyncStream()

    monkeypatch.setattr(AnthropicClient, "stream_async", fake_stream_async, raising=True)

    llm_client = AnthropicClient()
    llm_config = LLMConfig(model="claude-sonnet-4-5-20250929", model_endpoint_type="anthropic", context_window=200000)
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config, call_type=LLMCallType.agent_step)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(LLMConnectionError):
        async for _ in gen:
            pass


def test_anthropic_client_handle_llm_error_413_status_code():
    """Test that handle_llm_error correctly converts 413 status code to ContextWindowExceededError."""
    client = AnthropicClient()

    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status_code=413, request=request)
    body = {
        "type": "error",
        "error": {"type": "request_too_large", "message": "Request exceeds the maximum size"},
    }

    error = anthropic.APIStatusError("REQUEST_TOO_LARGE", response=response, body=body)
    result = client.handle_llm_error(error)

    assert isinstance(result, ContextWindowExceededError)
    assert "413" in result.message or "request_too_large" in result.message.lower()


def test_anthropic_client_handle_llm_error_request_too_large_string():
    """Test that handle_llm_error correctly converts request_too_large string match to ContextWindowExceededError."""
    client = AnthropicClient()

    # Test with a generic exception that has the request_too_large string
    error = Exception("Error code: 413 - {'error': {'type': 'request_too_large', 'message': 'Request exceeds the maximum size'}}")
    result = client.handle_llm_error(error)

    assert isinstance(result, ContextWindowExceededError)
    assert "request_too_large" in result.message.lower() or "context window exceeded" in result.message.lower()


@pytest.mark.parametrize(
    "error_message",
    [
        "The input token count exceeds the maximum number of tokens allowed 1048576.",
        "Token count of 1500000 exceeds the model limit of 1048576 tokens allowed.",
    ],
    ids=["gemini-token-count-exceeds", "gemini-tokens-allowed-limit"],
)
def test_google_client_handle_llm_error_token_limit_returns_context_window_exceeded(error_message):
    """Google 400 errors about token limits should map to ContextWindowExceededError."""
    client = GoogleVertexClient.__new__(GoogleVertexClient)
    response_json = {
        "message": f'{{"error": {{"code": 400, "message": "{error_message}", "status": "INVALID_ARGUMENT"}}}}',
        "status": "Bad Request",
    }
    error = google_errors.ClientError(400, response_json)
    result = client.handle_llm_error(error)
    assert isinstance(result, ContextWindowExceededError)


def test_google_client_handle_llm_error_context_exceeded_returns_context_window_exceeded():
    """Google 400 errors with 'context' + 'exceeded' should map to ContextWindowExceededError."""
    client = GoogleVertexClient.__new__(GoogleVertexClient)
    response_json = {
        "message": '{"error": {"code": 400, "message": "Request context window exceeded the limit.", "status": "INVALID_ARGUMENT"}}',
        "status": "Bad Request",
    }
    error = google_errors.ClientError(400, response_json)
    result = client.handle_llm_error(error)
    assert isinstance(result, ContextWindowExceededError)


def test_google_client_handle_llm_error_generic_400_returns_bad_request():
    """Google 400 errors without token/context keywords should map to LLMBadRequestError."""
    client = GoogleVertexClient.__new__(GoogleVertexClient)
    response_json = {
        "message": '{"error": {"code": 400, "message": "Invalid argument: unsupported parameter.", "status": "INVALID_ARGUMENT"}}',
        "status": "Bad Request",
    }
    error = google_errors.ClientError(400, response_json)
    result = client.handle_llm_error(error)
    assert isinstance(result, LLMBadRequestError)
    assert not isinstance(result, ContextWindowExceededError)


@pytest.mark.parametrize(
    "error_message",
    [
        "Insufficient credits. Add more using https://openrouter.ai/settings/credits",
        "This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 2679.",
        "You exceeded your current quota, please check your plan and billing details.",
    ],
    ids=["openrouter-402", "openrouter-streaming-afford", "openai-quota-exceeded"],
)
def test_openai_client_handle_llm_error_insufficient_credits(error_message):
    """Credit/quota errors should map to LLMInsufficientCreditsError."""
    from letta.llm_api.openai_client import OpenAIClient

    client = OpenAIClient()
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    error = openai.APIError(message=error_message, request=request, body=None)
    result = client.handle_llm_error(error)
    assert isinstance(result, LLMInsufficientCreditsError)


def test_openai_client_handle_llm_error_402_status_code():
    """402 APIStatusError should map to LLMInsufficientCreditsError."""
    from letta.llm_api.openai_client import OpenAIClient

    client = OpenAIClient()
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    response = httpx.Response(status_code=402, request=request)
    body = {"error": {"message": "Insufficient credits", "code": 402}}
    error = openai.APIStatusError("Insufficient credits", response=response, body=body)
    result = client.handle_llm_error(error)
    assert isinstance(result, LLMInsufficientCreditsError)


def test_openai_client_handle_llm_error_non_credit_api_error():
    """Non-credit bare APIError should map to LLMBadRequestError, not LLMInsufficientCreditsError."""
    from letta.llm_api.openai_client import OpenAIClient

    client = OpenAIClient()
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    error = openai.APIError(message="Some other API error occurred", request=request, body=None)
    result = client.handle_llm_error(error)
    assert isinstance(result, LLMBadRequestError)
    assert not isinstance(result, LLMInsufficientCreditsError)


@pytest.mark.asyncio
async def test_letta_llm_stream_adapter_raises_empty_response_error_for_anthropic(monkeypatch):
    """LET-7679: Empty streaming responses (no content blocks) should raise LLMEmptyResponseError.

    This tests the case where Opus 4.6 returns a response with:
    - BetaRawMessageStartEvent (with usage tokens)
    - BetaRawMessageStopEvent (end_turn)
    - NO content blocks in between

    This should raise LLMEmptyResponseError, not complete successfully with stop_reason=end_turn.
    """

    class FakeAsyncStream:
        """Mimics anthropic.AsyncStream that returns empty content (no content blocks)."""

        def __init__(self):
            self.events = [
                # Message start with some usage info
                BetaRawMessageStartEvent(
                    type="message_start",
                    message=BetaMessage(
                        id="msg_test_empty",
                        type="message",
                        role="assistant",
                        content=[],  # Empty content
                        model="claude-opus-4-6",
                        stop_reason="end_turn",
                        stop_sequence=None,
                        usage=BetaUsage(input_tokens=1000, output_tokens=26, cache_creation_input_tokens=0, cache_read_input_tokens=0),
                    ),
                ),
                # Message stop immediately after start - no content blocks
                BetaRawMessageStopEvent(type="message_stop"),
            ]
            self.index = 0

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self.index >= len(self.events):
                raise StopAsyncIteration
            event = self.events[self.index]
            self.index += 1
            return event

    async def fake_stream_async(self, request_data: dict, llm_config):
        return FakeAsyncStream()

    monkeypatch.setattr(AnthropicClient, "stream_async", fake_stream_async, raising=True)

    llm_client = AnthropicClient()
    llm_config = LLMConfig(model="claude-opus-4-6", model_endpoint_type="anthropic", context_window=200000)
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config, call_type=LLMCallType.agent_step)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(LLMEmptyResponseError):
        async for _ in gen:
            pass
