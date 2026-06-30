# OpenAI Responses API `user` Parameter Fix

## Issue Summary

When using models that route through OpenAI's Responses API (`/v1/responses`), such as `gpt-5.2-codex`, requests fail with:

```
Error code: 400 - {'detail': 'Unsupported parameter: user'}
```

The OpenAI Responses API does not support the `user` parameter, but Letta unconditionally adds it to all OpenAI requests.

## Root Cause

Commit `9280d85ba` ("feat: always add user id to openai requests (#1969)") introduced code that unconditionally sets the `user` parameter on both Chat Completions and Responses API requests.

The `build_request_data_responses` method in `openai_client.py` was setting the `user` field:

```python
# always set user id for openai requests
if self.actor:
    data.user = self.actor.id

if llm_config.model_endpoint == LETTA_MODEL_ENDPOINT:
    if not self.actor:
        # override user id for inference.letta.com
        import uuid

        data.user = str(uuid.UUID(int=0))
```

However, the Responses API (`/v1/responses`) does not support this parameter.

## The Fix

Removed the `user` parameter assignment from `build_request_data_responses` method. The Chat Completions API (`/v1/chat/completions`) does support the `user` parameter, so the equivalent code in `build_request_data` method remains unchanged.

```python
# Note: Don't set 'user' param for Responses API - it's not supported
# (see build_request_data for Chat Completions which does support it)
```

## Files Modified

- `letta/llm_api/openai_client.py` - Removed `user` parameter from `build_request_data_responses` method

## Testing

After applying the fix:

1. Rebuild the Docker image
2. Test with a model that uses the Responses API (e.g., `gpt-5.2-codex`)
3. Verify the request succeeds without the "Unsupported parameter: user" error

## PR Recommendation

This is a safe, minimal fix that:
1. Removes unsupported parameter from Responses API requests
2. Keeps `user` parameter for Chat Completions API (which supports it)
3. Doesn't change behavior for standard OpenAI chat models
4. Enables compatibility with newer GPT models that use the Responses API

Should be safe to submit as a PR to upstream letta-ai/letta.
