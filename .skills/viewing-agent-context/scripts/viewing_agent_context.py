#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def get_json(url: str, headers: Dict[str, str], timeout: float) -> Tuple[Optional[Any], Optional[str]]:
    req = Request(url, method="GET", headers=headers)
    try:
        with urlopen(req, timeout=timeout) as resp:
            txt = resp.read().decode("utf-8", errors="replace")
            return (json.loads(txt) if txt else None), None
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        return None, f"HTTP {e.code}: {detail[:2000]}"
    except URLError as e:
        return None, f"URL error: {e}"
    except Exception as e:
        return None, f"Unexpected error: {e}"


def post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout: float) -> Tuple[Optional[Any], Optional[str]]:
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, method="POST", headers={**headers, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            txt = resp.read().decode("utf-8", errors="replace")
            return (json.loads(txt) if txt else None), None
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        return None, f"HTTP {e.code}: {detail[:2000]}"
    except URLError as e:
        return None, f"URL error: {e}"
    except Exception as e:
        return None, f"Unexpected error: {e}"


# ---------------------------------------------------------------------------
# ClickHouse helpers
# ---------------------------------------------------------------------------


def _parse_ch_url(raw_url: str) -> Tuple[str, int, bool]:
    """Return (host, port, secure) from a ClickHouse URL."""
    if "://" not in raw_url:
        raw_url = f"http://{raw_url}"
    parsed = urlparse(raw_url)
    host = parsed.hostname
    if not host:
        raise ValueError(f"Invalid CLICKHOUSE_URL: {raw_url}")
    secure = parsed.scheme == "https"
    port = parsed.port if parsed.port is not None else (8443 if secure else 8123)
    return host, port, secure


def _load_ch_credentials(env_file: Optional[str]) -> Tuple[str, str, str]:
    """Load ClickHouse credentials from env file (preferred) then env vars.

    Uses dotenv_values() to avoid shell expansion of $ characters in passwords.
    """
    from dotenv import dotenv_values

    file_vals: Dict[str, Optional[str]] = {}
    if env_file:
        file_vals = dotenv_values(env_file)

    url = (file_vals.get("CLICKHOUSE_URL") or os.getenv("CLICKHOUSE_URL") or "").strip()
    user = (file_vals.get("CLICKHOUSE_USER") or os.getenv("CLICKHOUSE_USER") or "").strip()
    # Password: prefer dotenv_values first (avoids shell $ expansion), then env
    password = (file_vals.get("CLICKHOUSE_PASSWORD") or os.getenv("CLICKHOUSE_PASSWORD") or "").strip()

    if not url:
        raise ValueError("CLICKHOUSE_URL not found (check --env-file or env vars)")
    if not user:
        raise ValueError("CLICKHOUSE_USER not found (check --env-file or env vars)")
    if not password:
        raise ValueError("CLICKHOUSE_PASSWORD not found (check --env-file or env vars)")

    return url, user, password


def query_step_from_clickhouse(step_id: str, env_file: Optional[str]) -> Dict[str, Any]:
    """Query otel.llm_traces for a step_id and return trace data."""
    import clickhouse_connect

    url, user, password = _load_ch_credentials(env_file)
    host, port, secure = _parse_ch_url(url)

    client = clickhouse_connect.get_client(
        host=host,
        port=port,
        username=user,
        password=password,
        secure=secure,
    )

    sql = """
    SELECT
        step_id,
        agent_id,
        organization_id,
        run_id,
        model,
        provider,
        call_type,
        is_byok,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cached_input_tokens,
        cache_write_tokens,
        reasoning_tokens,
        latency_ms,
        request_size_bytes,
        response_size_bytes,
        is_error,
        error_type,
        error_message,
        request_json,
        response_json,
        llm_config_json,
        created_at
    FROM otel.llm_traces
    WHERE step_id = %(step_id)s
    ORDER BY created_at DESC
    LIMIT 1
    """

    result = client.query(sql, parameters={"step_id": step_id})
    if not result or not result.result_rows:
        raise ValueError(f"No trace found for step_id={step_id}")

    row = result.result_rows[0]
    columns = list(result.column_names)
    return dict(zip(columns, row))


def _parse_json_str(value: Any) -> Dict[str, Any]:
    """Parse a JSON string into a dict, handling edge cases."""
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {"_value": parsed}
    except Exception:
        return {"_raw": str(value)[:5000]}


# ---------------------------------------------------------------------------
# HTML rendering helpers
# ---------------------------------------------------------------------------


def esc_json(obj: Any) -> str:
    return html.escape(json.dumps(obj, indent=2, ensure_ascii=False, default=str))


def extract_system_text(payload: Dict[str, Any]) -> str:
    if isinstance(payload.get("instructions"), str):
        return payload["instructions"]

    system = payload.get("system")
    if isinstance(system, list):
        parts: List[str] = []
        for item in system:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        if parts:
            return "\n\n".join(parts)

    return "<missing>"


def extract_messages(payload: Dict[str, Any]) -> List[Any]:
    if isinstance(payload.get("input"), list):
        return payload["input"]
    if isinstance(payload.get("messages"), list):
        return payload["messages"]
    return []


def extract_tools(payload: Dict[str, Any]) -> List[Any]:
    if isinstance(payload.get("tools"), list):
        return payload["tools"]
    if isinstance(payload.get("functions"), list):
        return payload["functions"]
    return []


def _iter_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item)
    elif isinstance(value, dict):
        for v in value.values():
            yield from _iter_strings(v)


def has_system_reminder_in_content(message: Dict[str, Any]) -> bool:
    content = message.get("content")
    if content is None:
        return False
    needle = "<system-reminder>"
    return any(needle in s.lower() for s in _iter_strings(content))


def _extract_text_blocks(content: Any) -> List[str]:
    """Extract ordered human-readable text blocks from structured content arrays.

    Preview payloads often encode message content as a list of typed blocks, e.g.:
      [{"type": "text", "text": "..."}, ...]
      [{"type": "input_text", "text": "..."}, ...]

    This helper preserves that order and returns plain text blocks so we can render
    them cleanly instead of dumping JSON.
    """
    blocks: List[str] = []
    if not isinstance(content, list):
        return blocks

    for item in content:
        if isinstance(item, str):
            blocks.append(item)
            continue

        if not isinstance(item, dict):
            continue

        # Primary shape: {"type": "text"|"input_text"|..., "text": "..."}
        text_value = item.get("text")
        if isinstance(text_value, str):
            blocks.append(text_value)
            continue

        # Secondary shape: nested content arrays/strings under "content"
        nested = item.get("content")
        if isinstance(nested, str):
            blocks.append(nested)
        elif isinstance(nested, list):
            blocks.extend(_extract_text_blocks(nested))

    return blocks


def render_content_for_display(message: Dict[str, Any], msg_type: Optional[str]) -> str:
    content = message.get("content")

    # Structured multi-part content (e.g. [{"type":"text","text":"..."}])
    # should render as readable text blocks instead of JSON.
    text_blocks = _extract_text_blocks(content)
    if text_blocks:
        return "\n\n".join(text_blocks)[:8000]

    if isinstance(content, str):
        return content[:8000]

    if content is not None:
        return json.dumps(content, ensure_ascii=False, default=str)[:8000]

    if msg_type == "function_call":
        return json.dumps(
            {
                "call_id": message.get("call_id"),
                "name": message.get("name"),
                "arguments": message.get("arguments"),
                "status": message.get("status"),
            },
            ensure_ascii=False,
            default=str,
        )[:8000]

    if msg_type == "function_call_output":
        return json.dumps(
            {
                "call_id": message.get("call_id"),
                "output": message.get("output"),
            },
            ensure_ascii=False,
            default=str,
        )[:8000]

    # Unknown shape: show full message object for inspection.
    return json.dumps(message, ensure_ascii=False, default=str)[:8000]


def render_messages(messages: List[Any]) -> str:
    if not messages:
        return "<p class='muted'>No messages found.</p>"

    chunks = []
    for i, m in enumerate(messages, 1):
        if not isinstance(m, dict):
            continue

        role = m.get("role")
        msg_type = m.get("type")
        has_system_reminder = has_system_reminder_in_content(m)

        # Preview payloads often include provider-specific tool call rows without `role`.
        # Fall back to message `type` so we don't render these as "unknown".
        label = str(role or msg_type or "unknown")

        parsed_preview = render_content_for_display(m, msg_type)

        chunks.append(
            """
            <details class='card'>
              <summary>#{idx} <strong>{label}</strong>{system_reminder_tag}</summary>
              <pre>{parsed}</pre>
              <details>
                <summary class='muted'>raw message object</summary>
                <pre>{raw}</pre>
              </details>
            </details>
            """.format(
                idx=i,
                label=html.escape(label),
                system_reminder_tag=(" <span class='tag'>system reminder</span>" if has_system_reminder else ""),
                parsed=html.escape(parsed_preview),
                raw=esc_json(m),
            )
        )
    return "\n".join(chunks) if chunks else "<p class='muted'>No message entries.</p>"


def render_tools(tools: List[Any]) -> str:
    if not tools:
        return "<p class='muted'>No tools/functions found in preview payload.</p>"
    chunks = []
    for i, t in enumerate(tools, 1):
        if not isinstance(t, dict):
            continue
        name = t.get("name")
        if not name and isinstance(t.get("function"), dict):
            name = t["function"].get("name")
        desc = t.get("description")
        if not desc and isinstance(t.get("function"), dict):
            desc = t["function"].get("description")
        chunks.append(
            f"<details class='card'><summary>#{i} <code>{html.escape(str(name or '<unknown>'))}</code> — {html.escape(str(desc or ''))}</summary><pre>{esc_json(t)}</pre></details>"
        )
    return "\n".join(chunks) if chunks else "<p class='muted'>No renderable tools found.</p>"


# ---------------------------------------------------------------------------
# HTML builders
# ---------------------------------------------------------------------------

_COMMON_STYLE = """
    body { font-family: ui-sans-serif, system-ui; margin: 24px; background: #fafafa; color: #111; }
    .panel { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; }
    .warn { background: #fff3f3; border-color: #ffcbcb; }
    .tag { margin-left: 8px; font-size: 12px; color: #6b21a8; background: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 999px; padding: 1px 8px; font-weight: 600; }
    .chip { display: inline-block; margin: 4px 6px 0 0; font-size: 12px; color: #1d4ed8; background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 999px; padding: 2px 8px; font-weight: 600; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f5f5f5; padding: 10px; border-radius: 8px; }
    .muted { color: #666; }
    summary { cursor: pointer; }
    nav a { margin-right: 10px; }
    .kv-table { border-collapse: collapse; margin: 8px 0; }
    .kv-table td { padding: 4px 12px 4px 0; vertical-align: top; }
    .kv-table td:first-child { font-weight: 600; white-space: nowrap; color: #333; }
"""


def build_html(
    agent_id: str,
    preview_url: str,
    agent_url: str,
    payload: Dict[str, Any],
    agent_payload: Dict[str, Any],
    errors: List[str],
) -> str:
    generated = datetime.now(timezone.utc).isoformat()
    model = payload.get("model") if isinstance(payload, dict) else None
    messages = extract_messages(payload) if isinstance(payload, dict) else []
    system_text = extract_system_text(payload) if isinstance(payload, dict) else "<missing>"
    tools = extract_tools(payload) if isinstance(payload, dict) else []

    tags = agent_payload.get("tags") if isinstance(agent_payload.get("tags"), list) else []
    has_compaction_settings_key = "compaction_settings" in agent_payload
    compaction_settings = agent_payload.get("compaction_settings")
    has_model_settings_key = "model_settings" in agent_payload
    model_settings = agent_payload.get("model_settings")

    settings = {
        "model": model,
        "max_tokens": payload.get("max_tokens") if isinstance(payload, dict) else None,
        "temperature": payload.get("temperature") if isinstance(payload, dict) else None,
        "thinking": payload.get("thinking") if isinstance(payload, dict) else None,
        "reasoning": payload.get("reasoning") if isinstance(payload, dict) else None,
        "output_config": payload.get("output_config") if isinstance(payload, dict) else None,
        "message_count": len(messages) if isinstance(messages, list) else None,
        "tool_count": len(tools) if isinstance(tools, list) else None,
        "top_keys": list(payload.keys()) if isinstance(payload, dict) else None,
    }

    warn_html = (
        "<div class='panel warn'><strong>Warnings</strong><ul>" + "".join(f"<li>{html.escape(e)}</li>" for e in errors) + "</ul></div>"
        if errors
        else ""
    )

    tags_html = "".join(f"<span class='chip'>{html.escape(str(t))}</span>" for t in tags)
    if not tags_html:
        tags_html = "<span class='muted'>No tags found.</span>"

    if has_compaction_settings_key:
        compaction_html = esc_json(compaction_settings)
    else:
        compaction_html = "<span class='muted'>compaction_settings not present on agent payload.</span>"

    if has_model_settings_key:
        model_settings_html = esc_json(model_settings)
    else:
        model_settings_html = "<span class='muted'>model_settings not present on agent payload.</span>"

    return f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>Viewing Agent Context — {html.escape(agent_id)}</title>
  <style>{_COMMON_STYLE}</style>
</head>
<body>
  <h1>Viewing Agent Context (Preview-Only)</h1>
  <p class='muted'>Generated: {html.escape(generated)} | Agent: <code>{html.escape(agent_id)}</code></p>

  <div class='panel'>
    <div><strong>Preview endpoint:</strong> <code>{html.escape(preview_url)}</code></div>
    <div><strong>Agent endpoint:</strong> <code>{html.escape(agent_url)}</code></div>
  </div>

  {warn_html}

  <nav class='panel'>
    <a href='#settings'>Settings</a>
    <a href='#agent'>Agent metadata</a>
    <a href='#system'>System</a>
    <a href='#messages'>Messages</a>
    <a href='#tools'>Tools</a>
    <a href='#raw'>Raw JSON</a>
  </nav>

  <section id='settings' class='panel'>
    <h2>Request Settings</h2>
    <pre>{esc_json(settings)}</pre>
  </section>

  <section id='agent' class='panel'>
    <h2>Agent Metadata</h2>
    <h3>Tags</h3>
    <div>{tags_html}</div>
    <h3 style='margin-top: 12px;'>Compaction Settings (<code>agent.compaction_settings</code>)</h3>
    <pre>{compaction_html}</pre>
    <h3 style='margin-top: 12px;'>Model Settings (<code>agent.model_settings</code>)</h3>
    <pre>{model_settings_html}</pre>
  </section>

  <section id='system' class='panel'>
    <h2>System Prompt</h2>
    <pre>{html.escape(system_text)}</pre>
  </section>

  <section id='messages' class='panel'>
    <h2>Messages</h2>
    {render_messages(messages)}
  </section>

  <section id='tools' class='panel'>
    <h2>Tools / Functions</h2>
    {render_tools(tools)}
  </section>

  <section id='raw' class='panel'>
    <h2>Full Preview Payload JSON</h2>
    <pre>{esc_json(payload)}</pre>
    <h2 style='margin-top: 16px;'>Full Agent JSON</h2>
    <pre>{esc_json(agent_payload)}</pre>
  </section>
</body>
</html>
"""


def build_step_html(
    step_id: str,
    trace_row: Dict[str, Any],
    request_payload: Dict[str, Any],
    response_payload: Dict[str, Any],
    errors: List[str],
) -> str:
    """Build HTML report for a historical step fetched from ClickHouse."""
    generated = datetime.now(timezone.utc).isoformat()
    model = request_payload.get("model") if isinstance(request_payload, dict) else None
    messages = extract_messages(request_payload) if isinstance(request_payload, dict) else []
    system_text = extract_system_text(request_payload) if isinstance(request_payload, dict) else "<missing>"
    tools = extract_tools(request_payload) if isinstance(request_payload, dict) else []

    settings = {
        "model": model or trace_row.get("model"),
        "max_tokens": request_payload.get("max_tokens") if isinstance(request_payload, dict) else None,
        "temperature": request_payload.get("temperature") if isinstance(request_payload, dict) else None,
        "thinking": request_payload.get("thinking") if isinstance(request_payload, dict) else None,
        "reasoning": request_payload.get("reasoning") if isinstance(request_payload, dict) else None,
        "output_config": request_payload.get("output_config") if isinstance(request_payload, dict) else None,
        "message_count": len(messages) if isinstance(messages, list) else None,
        "tool_count": len(tools) if isinstance(tools, list) else None,
        "top_keys": list(request_payload.keys()) if isinstance(request_payload, dict) else None,
    }

    warn_html = (
        "<div class='panel warn'><strong>Warnings</strong><ul>" + "".join(f"<li>{html.escape(e)}</li>" for e in errors) + "</ul></div>"
        if errors
        else ""
    )

    # Trace metadata table
    trace_meta = {
        "step_id": trace_row.get("step_id", ""),
        "agent_id": trace_row.get("agent_id", ""),
        "organization_id": trace_row.get("organization_id", ""),
        "run_id": trace_row.get("run_id", ""),
        "model": trace_row.get("model", ""),
        "provider": trace_row.get("provider", ""),
        "call_type": trace_row.get("call_type", ""),
        "is_byok": bool(trace_row.get("is_byok", False)),
        "created_at": str(trace_row.get("created_at", "")),
    }

    token_stats = {
        "prompt_tokens": trace_row.get("prompt_tokens", 0),
        "completion_tokens": trace_row.get("completion_tokens", 0),
        "total_tokens": trace_row.get("total_tokens", 0),
        "cached_input_tokens": trace_row.get("cached_input_tokens"),
        "cache_write_tokens": trace_row.get("cache_write_tokens"),
        "reasoning_tokens": trace_row.get("reasoning_tokens"),
        "latency_ms": trace_row.get("latency_ms", 0),
        "request_size_bytes": trace_row.get("request_size_bytes", 0),
        "response_size_bytes": trace_row.get("response_size_bytes", 0),
    }

    error_info = {}
    if trace_row.get("is_error"):
        error_info = {
            "is_error": True,
            "error_type": trace_row.get("error_type", ""),
            "error_message": trace_row.get("error_message", ""),
        }

    def _kv_table(d: Dict[str, Any]) -> str:
        rows = []
        for k, v in d.items():
            val_str = html.escape(str(v)) if v is not None else "<span class='muted'>null</span>"
            rows.append(f"<tr><td>{html.escape(str(k))}</td><td><code>{val_str}</code></td></tr>")
        return "<table class='kv-table'>" + "".join(rows) + "</table>"

    error_section = ""
    if error_info:
        error_section = f"""
  <section class='panel warn'>
    <h2>Error</h2>
    {_kv_table(error_info)}
  </section>"""

    # LLM config from trace
    llm_config_raw = trace_row.get("llm_config_json", "")
    llm_config = _parse_json_str(llm_config_raw) if llm_config_raw else {}
    llm_config_html = esc_json(llm_config) if llm_config else "<span class='muted'>No LLM config recorded.</span>"

    title_id = html.escape(step_id[:40])

    return f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>Viewing Step Context — {title_id}</title>
  <style>{_COMMON_STYLE}</style>
</head>
<body>
  <h1>Viewing Step Context (Historical — ClickHouse)</h1>
  <p class='muted'>Generated: {html.escape(generated)} | Step: <code>{html.escape(step_id)}</code></p>

  {warn_html}

  <nav class='panel'>
    <a href='#trace'>Trace metadata</a>
    <a href='#tokens'>Token usage</a>
    <a href='#settings'>Request settings</a>
    <a href='#system'>System</a>
    <a href='#messages'>Messages</a>
    <a href='#tools'>Tools</a>
    <a href='#response'>Response</a>
    <a href='#raw'>Raw JSON</a>
  </nav>

  <section id='trace' class='panel'>
    <h2>Trace Metadata</h2>
    {_kv_table(trace_meta)}
  </section>

  <section id='tokens' class='panel'>
    <h2>Token Usage</h2>
    {_kv_table(token_stats)}
  </section>
  {error_section}

  <section id='settings' class='panel'>
    <h2>Request Settings</h2>
    <pre>{esc_json(settings)}</pre>
    <h3 style='margin-top: 12px;'>LLM Config</h3>
    <pre>{llm_config_html}</pre>
  </section>

  <section id='system' class='panel'>
    <h2>System Prompt</h2>
    <pre>{html.escape(system_text)}</pre>
  </section>

  <section id='messages' class='panel'>
    <h2>Messages</h2>
    {render_messages(messages)}
  </section>

  <section id='tools' class='panel'>
    <h2>Tools / Functions</h2>
    {render_tools(tools)}
  </section>

  <section id='response' class='panel'>
    <h2>Response Payload</h2>
    <pre>{esc_json(response_payload)}</pre>
  </section>

  <section id='raw' class='panel'>
    <h2>Full Request Payload JSON</h2>
    <pre>{esc_json(request_payload)}</pre>
  </section>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate a human-readable context report from preview-raw-payload (live) or ClickHouse llm_traces (historical)."
    )

    # Mode selection: exactly one of --agent-id or --step-id
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--agent-id", help="Live mode: fetch preview-raw-payload for this agent")
    mode.add_argument("--step-id", help="Historical mode: fetch request/response from ClickHouse for this step_id")

    # Live-mode options
    parser.add_argument("--server-url", default=os.getenv("LETTA_SERVER_URL") or "http://127.0.0.1:8283")
    parser.add_argument("--api-key", default=os.getenv("LETTA_API_KEY"))
    parser.add_argument("--input", default="show me the exact context payload")
    parser.add_argument("--max-steps", type=int, default=1)

    # ClickHouse options
    parser.add_argument("--env-file", help="Path to .env file with CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD")

    # Common
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("--out", default=None)

    args = parser.parse_args()

    # -----------------------------------------------------------------------
    # Historical mode (--step-id)
    # -----------------------------------------------------------------------
    if args.step_id:
        errors: List[str] = []
        try:
            trace_row = query_step_from_clickhouse(args.step_id, args.env_file)
        except Exception as e:
            print(f"ClickHouse query failed: {e}", file=sys.stderr)
            return 1

        request_payload = _parse_json_str(trace_row.get("request_json"))
        response_payload = _parse_json_str(trace_row.get("response_json"))

        if not request_payload:
            errors.append("request_json was empty or unparseable")
        if not response_payload:
            errors.append("response_json was empty or unparseable")

        out = Path(args.out).expanduser() if args.out else Path.home() / ".letta" / "viewers" / f"viewing-step-context-{args.step_id}.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            build_step_html(args.step_id, trace_row, request_payload, response_payload, errors),
            encoding="utf-8",
        )

        print(f"Generated: {out}")
        if errors:
            print("Warnings:")
            for e in errors:
                print(f" - {e}")
        else:
            print(f"Trace fetched successfully (model={trace_row.get('model')}, created_at={trace_row.get('created_at')}).")
        return 0

    # -----------------------------------------------------------------------
    # Live mode (--agent-id)
    # -----------------------------------------------------------------------
    server = args.server_url.rstrip("/")
    preview_url = f"{server}/v1/agents/{args.agent_id}/messages/preview-raw-payload"
    agent_url = f"{server}/v1/agents/{args.agent_id}"

    headers: Dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": "letta-code-cli/viewing-agent-context",
    }
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    errors = []

    payload, err = post_json(preview_url, headers, {"input": args.input, "max_steps": args.max_steps}, args.timeout)
    if err:
        errors.append(f"preview: {err}")

    agent_payload_raw, agent_err = get_json(agent_url, headers, args.timeout)
    if agent_err:
        errors.append(f"agent: {agent_err}")

    payload_dict = payload if isinstance(payload, dict) else ({"raw": payload} if payload is not None else {})
    agent_payload = (
        agent_payload_raw if isinstance(agent_payload_raw, dict) else ({"raw": agent_payload_raw} if agent_payload_raw is not None else {})
    )

    out = Path(args.out).expanduser() if args.out else Path.home() / ".letta" / "viewers" / f"viewing-agent-context-{args.agent_id}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_html(args.agent_id, preview_url, agent_url, payload_dict, agent_payload, errors), encoding="utf-8")

    print(f"Generated: {out}")
    if errors:
        print("Warnings:")
        for e in errors:
            print(f" - {e}")
    else:
        print("Preview fetched successfully.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
