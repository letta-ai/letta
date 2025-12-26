import anthropic
import httpx
import pytest

from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
from letta.errors import LLMServerError
from letta.llm_api.anthropic_client import AnthropicClient
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
    adapter = LettaLLMStreamAdapter(llm_client=llm_client, llm_config=llm_config)

    gen = adapter.invoke_llm(request_data={}, messages=[], tools=[], use_assistant_message=True)
    with pytest.raises(LLMServerError):
        async for _ in gen:
            pass
