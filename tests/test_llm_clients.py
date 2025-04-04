import pytest

from letta.llm_api.anthropic_client import AnthropicClient
from letta.schemas.llm_config import LLMConfig


@pytest.fixture
def anthropic_client():
    llm_config = LLMConfig(
        model="claude-3-7-sonnet-20250219",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=32000,
        handle=f"anthropic/claude-3-5-sonnet-20241022",
        put_inner_thoughts_in_kwargs=False,
        max_tokens=4096,
        enable_reasoner=True,
        max_reasoning_tokens=1024,
    )

    yield AnthropicClient(llm_config=llm_config)


# ======================================================================================================================
# AnthropicClient
# ======================================================================================================================


@pytest.mark.asyncio
async def test_batch_async_live(anthropic_client):
    input_requests = {
        "my-first-request": {
            "model": "claude-3-7-sonnet-20250219",
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, world",
                }
            ],
        },
        "my-second-request": {
            "model": "claude-3-7-sonnet-20250219",
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": "Hi again, friend",
                }
            ],
        },
    }

    response = await anthropic_client.batch_async(input_requests)
    assert response.id.startswith("msgbatch_")
    assert response.processing_status in {"in_progress", "succeeded"}
    assert response.request_counts.processing + response.request_counts.succeeded == len(input_requests.keys())
    assert response.created_at < response.expires_at
