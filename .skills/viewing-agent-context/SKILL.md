---
name: viewing-agent-context
description: Explains what is inside an agent context window by fetching preview-raw-payload (live) or ClickHouse llm_traces (historical). Renders a human-readable HTML report (system prompt, messages, tools, model settings). Use when users ask what the model actually receives, want to inspect context composition, or want to inspect a past step's payload.
---

# Viewing Agent Context

Two modes:

1. **Live mode** (`--agent-id`): Fetch the current preview payload via `POST /v1/agents/{agent_id}/messages/preview-raw-payload`
2. **Historical mode** (`--step-id`): Fetch a past LLM request/response from ClickHouse `otel.llm_traces`

## When to use

Use this skill when a human asks:

- "What is in this agent's context window?"
- "Show me the real prompt/messages sent to the model"
- "Can I see dry-run context?"
- "Show me what was sent to the model for step X"
- "Inspect a past LLM call"

## Live mode: self-hosted server

```bash
python3 scripts/viewing_agent_context.py \
  --agent-id <agent-id> \
  --server-url "http://127.0.0.1:8283" \
  --input "show me the exact context payload" \
  --max-steps 1 \
  --out ~/.letta/viewers/viewing-agent-context-<agent-id>.html
```

If your self-hosted server requires auth, add:

```bash
--api-key "$LETTA_API_KEY"
```

## Live mode: api.letta.com

```bash
python3 scripts/viewing_agent_context.py \
  --agent-id <agent-id> \
  --server-url "https://api.letta.com" \
  --api-key "$LETTA_API_KEY" \
  --input "show me the exact context payload" \
  --max-steps 1 \
  --out ~/.letta/viewers/viewing-agent-context-<agent-id>.html
```

## Historical mode: inspect a past step

Query ClickHouse for a step's full request/response payload. Requires ClickHouse credentials via `--env-file` or env vars (`CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`).

```bash
python3 scripts/viewing_agent_context.py \
  --step-id <step-id> \
  --env-file /path/to/.env \
  --out ~/.letta/viewers/viewing-step-context-<step-id>.html
```

The historical HTML report includes trace metadata (agent, model, provider, call type, timestamp), token usage stats, the full request payload (system prompt, messages, tools), and the full response payload.

## Args

| Arg | Description |
|-----|-------------|
| `--agent-id` | Live mode: agent to preview (mutually exclusive with `--step-id`) |
| `--step-id` | Historical mode: step to fetch from ClickHouse (mutually exclusive with `--agent-id`) |
| `--env-file` | Path to `.env` with ClickHouse credentials (historical mode) |
| `--server-url` | Letta server URL (live mode, default: `http://127.0.0.1:8283`) |
| `--api-key` | Bearer token (live mode, required for `api.letta.com`) |
| `--input` | Preview input text (live mode) |
| `--max-steps` | Preview max steps (live mode, default: 1) |
| `--timeout` | Request timeout in seconds (default: 45) |
| `--out` | Output HTML path |

## Output

The HTML includes:

1. Request settings (model, token params, reasoning/thinking flags)
2. Agent/trace metadata (tags, compaction settings, model settings — or trace metadata for historical)
3. System prompt section
4. Messages section (including system-reminder badge and newline-preserving user text rendering)
5. Tools/functions section (if present)
6. Response payload (historical mode only)
7. Full raw JSON payloads

Always return the absolute output file path so the user can open it directly in a browser.
