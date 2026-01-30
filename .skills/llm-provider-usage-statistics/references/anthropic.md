# Anthropic Usage Statistics

## Response Format

```
response.usage.input_tokens                  # NON-cached input tokens only
response.usage.output_tokens                 # Output tokens
response.usage.cache_read_input_tokens       # Tokens read from cache
response.usage.cache_creation_input_tokens   # Tokens written to cache
```

## Critical: Token Calculation

**Anthropic's `input_tokens` is NOT the total.** To get total input tokens:

```python
total_input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

This is different from OpenAI/Gemini where `prompt_tokens` is already the total.

## Prefix Caching (Prompt Caching)

**Requirements:**
- Minimum 1,024 tokens for Claude 3.5 Haiku/Sonnet
- Minimum 2,048 tokens for Claude 3 Opus
- Requires explicit `cache_control` breakpoints in messages
- TTL: 5 minutes

**How to enable:**
Add `cache_control` to message content:
```python
{
    "role": "user",
    "content": [
        {
            "type": "text",
            "text": "...",
            "cache_control": {"type": "ephemeral"}
        }
    ]
}
```

**Beta header required:**
```python
betas = ["prompt-caching-2024-07-31"]
```

## Cache Behavior

- `cache_creation_input_tokens`: Tokens that were cached on this request (cache write)
- `cache_read_input_tokens`: Tokens that were read from existing cache (cache hit)
- On first request: expect `cache_creation_input_tokens > 0`
- On subsequent requests with same prefix: expect `cache_read_input_tokens > 0`

## Streaming

In streaming mode, usage is reported in two events:

1. **`message_start`**: Initial usage (may have cache info)
   ```python
   event.message.usage.input_tokens
   event.message.usage.output_tokens
   event.message.usage.cache_read_input_tokens
   event.message.usage.cache_creation_input_tokens
   ```

2. **`message_delta`**: Cumulative output tokens
   ```python
   event.usage.output_tokens  # This is CUMULATIVE, not incremental
   ```

**Important:** Per Anthropic docs, `message_delta` token counts are cumulative, so assign (don't accumulate).

## Letta Implementation

- **Client:** `letta/llm_api/anthropic_client.py`
- **Streaming interfaces:**
  - `letta/interfaces/anthropic_streaming_interface.py`
  - `letta/interfaces/anthropic_parallel_tool_call_streaming_interface.py` (tracks cache tokens)
- **Extract method:** `AnthropicClient.extract_usage_statistics()`
- **Cache control:** `_add_cache_control_to_system_message()`, `_add_cache_control_to_messages()`
