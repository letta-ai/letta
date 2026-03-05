---
name: viewing-agent-context
description: Explains what is inside an agent context window by fetching preview-raw-payload and rendering a human-readable HTML report (system prompt, messages, tools, model settings). Use when users ask what the model actually receives or want to inspect context composition.
---

# Viewing Agent Context

Inspect what a given agent will send to the model by using preview-only mode:

- `POST /v1/agents/{agent_id}/messages/preview-raw-payload`

The script also fetches:

- `GET /v1/agents/{agent_id}`

This keeps the report focused on the actual model request while also showing agent metadata (tags, compaction settings, model settings).

## When to use

Use this skill when a human asks:

- "What is in this agent's context window?"
- "Show me the real prompt/messages sent to the model"
- "Can I see dry-run context?"

## Usage: self-hosted server

Use this for local/dev/prod self-hosted Letta deployments.

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

## Usage: api.letta.com

Use this for Letta Cloud.

```bash
python3 scripts/viewing_agent_context.py \
  --agent-id <agent-id> \
  --server-url "https://api.letta.com" \
  --api-key "$LETTA_API_KEY" \
  --input "show me the exact context payload" \
  --max-steps 1 \
  --out ~/.letta/viewers/viewing-agent-context-<agent-id>.html
```

## Optional args

- `--api-key <key>`: bearer token (required for `api.letta.com`, optional for self-hosted unless auth is enabled)
- `--timeout 60`: request timeout in seconds
- `--out <path>`: absolute/relative path for generated HTML

## Output

The HTML includes:

1. Request settings (model, token params, reasoning/thinking flags)
2. Agent metadata (tags, `compaction_settings`, `model_settings`)
3. System prompt section
4. Messages section (including system-reminder badge and newline-preserving user text rendering)
5. Tools/functions section (if present)
6. Full raw JSON payloads (preview + agent)

Always return the absolute output file path so the user can open it directly in a browser.
