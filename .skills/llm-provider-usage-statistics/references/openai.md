# OpenAI Usage Statistics

## APIs and Response Formats

OpenAI has two APIs with different response structures:

### Chat Completions API
```
response.usage.prompt_tokens           # Total input tokens (includes cached)
response.usage.completion_tokens       # Output tokens
response.usage.total_tokens            # Sum
response.usage.prompt_tokens_details.cached_tokens        # Subset that was cached
response.usage.completion_tokens_details.reasoning_tokens # For o1/o3 models
```

### Responses API (newer)
```
response.usage.input_tokens            # Total input tokens
response.usage.output_tokens           # Output tokens
response.usage.total_tokens            # Sum
response.usage.input_tokens_details.cached_tokens         # Subset that was cached
response.usage.output_tokens_details.reasoning_tokens     # For reasoning models
```

## Prefix Caching

**Requirements:**
- Minimum 1,024 tokens in the prefix
- Automatic (no opt-in required)
- Cached in 128-token increments
- TTL: approximately 5-10 minutes of inactivity

**Supported models:** GPT-4o, GPT-4o-mini, o1, o1-mini, o3-mini

**Cache behavior:**
- `cached_tokens` will be a multiple of 128
- Cache hit means those tokens were not re-processed
- Cost: cached tokens are cheaper than non-cached

## Reasoning Models (o1, o3)

For reasoning models, additional tokens are used for "thinking":
- `reasoning_tokens` in `completion_tokens_details`
- These are output tokens used for internal reasoning
- Not visible in the response content

## Streaming

In streaming mode, usage is reported in the **final chunk** when `stream_options.include_usage=True`:
```python
request_data["stream_options"] = {"include_usage": True}
```

The final chunk will have `chunk.usage` with the same structure as non-streaming.

## Letta Implementation

- **Client:** `letta/llm_api/openai_client.py`
- **Streaming interface:** `letta/interfaces/openai_streaming_interface.py`
- **Extract method:** `OpenAIClient.extract_usage_statistics()`
- Uses OpenAI SDK's pydantic models (`ChatCompletion`) for type-safe parsing
