---
name: llm-provider-usage-statistics
description: Reference guide for token counting and prefix caching across LLM providers (OpenAI, Anthropic, Gemini). Use when debugging token counts or optimizing prefix caching.
---

# LLM Provider Usage Statistics

Reference documentation for how different LLM providers report token usage.

## Quick Reference: Token Counting Semantics

| Provider | `input_tokens` meaning | Cache tokens | Must add cache to get total? |
|----------|------------------------|--------------|------------------------------|
| OpenAI | TOTAL (includes cached) | `cached_tokens` is subset | No |
| Anthropic | NON-cached only | `cache_read_input_tokens` + `cache_creation_input_tokens` | **Yes** |
| Gemini | TOTAL (includes cached) | `cached_content_token_count` is subset | No |

**Critical difference:** Anthropic's `input_tokens` excludes cached tokens, so you must add them:
```
total_input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

## Quick Reference: Prefix Caching

| Provider | Min tokens | How to enable | TTL |
|----------|-----------|---------------|-----|
| OpenAI | 1,024 | Automatic | ~5-10 min |
| Anthropic | 1,024 | Requires `cache_control` breakpoints | 5 min |
| Gemini 2.0+ | 1,024 | Automatic (implicit) | Variable |

## Quick Reference: Reasoning/Thinking Tokens

| Provider | Field name | Models |
|----------|-----------|--------|
| OpenAI | `reasoning_tokens` | o1, o3 models |
| Anthropic | N/A | (thinking is in content blocks, not usage) |
| Gemini | `thoughts_token_count` | Gemini 2.0 with thinking enabled |

## Provider Reference Files

- **OpenAI:** [references/openai.md](references/openai.md) - Chat Completions vs Responses API, reasoning models, cached_tokens
- **Anthropic:** [references/anthropic.md](references/anthropic.md) - cache_control setup, beta headers, cache token fields
- **Gemini:** [references/gemini.md](references/gemini.md) - implicit caching, thinking tokens, usage_metadata fields
