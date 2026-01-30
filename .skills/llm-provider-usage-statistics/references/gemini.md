# Gemini Usage Statistics

## Response Format

Gemini returns usage in `usage_metadata`:

```
response.usage_metadata.prompt_token_count           # Total input tokens
response.usage_metadata.candidates_token_count       # Output tokens
response.usage_metadata.total_token_count            # Sum
response.usage_metadata.cached_content_token_count   # Tokens from cache (optional)
response.usage_metadata.thoughts_token_count         # Reasoning tokens (optional)
```

## Token Counting

- `prompt_token_count` is the TOTAL (includes cached)
- `cached_content_token_count` is a subset (when present)
- Similar to OpenAI's semantics

## Implicit Caching (Gemini 2.0+)

**Requirements:**
- Minimum 1,024 tokens
- Automatic (no opt-in required)
- Available on Gemini 2.0 Flash and later models

**Behavior:**
- Caching is probabilistic and server-side
- `cached_content_token_count` may or may not be present
- When present, indicates tokens that were served from cache

**Note:** Unlike Anthropic, Gemini doesn't have explicit cache_control. Caching is implicit and managed by Google's infrastructure.

## Reasoning/Thinking Tokens

For models with extended thinking (like Gemini 2.0 with thinking enabled):
- `thoughts_token_count` reports tokens used for reasoning
- These are similar to OpenAI's `reasoning_tokens`

**Enabling thinking:**
```python
generation_config = {
    "thinking_config": {
        "thinking_budget": 1024  # Max thinking tokens
    }
}
```

## Streaming

In streaming mode:
- `usage_metadata` is typically in the **final chunk**
- Same fields as non-streaming
- May not be present in intermediate chunks

**Important:** `stream_async()` returns an async generator (not awaitable):
```python
# Correct:
stream = client.stream_async(request_data, llm_config)
async for chunk in stream:
    ...

# Incorrect (will error):
stream = await client.stream_async(...)  # TypeError!
```

## APIs

Gemini has two APIs:
- **Google AI (google_ai):** Uses `google.genai` SDK
- **Vertex AI (google_vertex):** Uses same SDK with different auth

Both share the same response format.

## Letta Implementation

- **Client:** `letta/llm_api/google_vertex_client.py` (handles both google_ai and google_vertex)
- **Streaming interface:** `letta/interfaces/gemini_streaming_interface.py`
- **Extract method:** `GoogleVertexClient.extract_usage_statistics()`
- Response is a `GenerateContentResponse` object with `.usage_metadata` attribute
