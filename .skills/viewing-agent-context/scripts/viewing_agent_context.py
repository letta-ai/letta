#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
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


def render_content_for_display(message: Dict[str, Any], msg_type: Optional[str]) -> str:
    content = message.get("content")

    # For user messages in OpenAI-style payloads, content is often a list of blocks:
    # [{"type": "input_text", "text": "..."}, ...].
    # Render all input_text blocks in order with blank lines between blocks.
    if message.get("role") == "user" and isinstance(content, list):
        text_blocks: List[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "input_text" and isinstance(item.get("text"), str):
                text_blocks.append(item["text"])
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
        "<div class='panel warn'><strong>Warnings</strong><ul>"
        + "".join(f"<li>{html.escape(e)}</li>" for e in errors)
        + "</ul></div>"
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
  <style>
    body {{ font-family: ui-sans-serif, system-ui; margin: 24px; background: #fafafa; color: #111; }}
    .panel {{ background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 12px; margin-bottom: 12px; }}
    .card {{ background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; }}
    .warn {{ background: #fff3f3; border-color: #ffcbcb; }}
    .tag {{ margin-left: 8px; font-size: 12px; color: #6b21a8; background: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 999px; padding: 1px 8px; font-weight: 600; }}
    .chip {{ display: inline-block; margin: 4px 6px 0 0; font-size: 12px; color: #1d4ed8; background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 999px; padding: 2px 8px; font-weight: 600; }}
    pre {{ white-space: pre-wrap; word-break: break-word; background: #f5f5f5; padding: 10px; border-radius: 8px; }}
    .muted {{ color: #666; }}
    summary {{ cursor: pointer; }}
    nav a {{ margin-right: 10px; }}
  </style>
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a human-readable context report from preview-raw-payload only.")
    parser.add_argument("--agent-id", required=True)
    parser.add_argument("--server-url", default=os.getenv("LETTA_SERVER_URL") or "http://127.0.0.1:8283")
    parser.add_argument("--api-key", default=os.getenv("LETTA_API_KEY"))
    parser.add_argument("--input", default="show me the exact context payload")
    parser.add_argument("--max-steps", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=45.0)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    server = args.server_url.rstrip("/")
    preview_url = f"{server}/v1/agents/{args.agent_id}/messages/preview-raw-payload"
    agent_url = f"{server}/v1/agents/{args.agent_id}"

    headers: Dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": "letta-code-cli/viewing-agent-context",
    }
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    errors: List[str] = []

    payload, err = post_json(preview_url, headers, {"input": args.input, "max_steps": args.max_steps}, args.timeout)
    if err:
        errors.append(f"preview: {err}")

    agent_payload_raw, agent_err = get_json(agent_url, headers, args.timeout)
    if agent_err:
        errors.append(f"agent: {agent_err}")

    payload_dict = payload if isinstance(payload, dict) else ({"raw": payload} if payload is not None else {})
    agent_payload = agent_payload_raw if isinstance(agent_payload_raw, dict) else ({"raw": agent_payload_raw} if agent_payload_raw is not None else {})

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
