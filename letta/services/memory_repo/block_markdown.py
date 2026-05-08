"""Serialize and parse block data as Markdown with YAML frontmatter.

File format:
    ---
    description: "Who I am and how I approach work"
    ---
    My name is Memo. I'm a stateful coding assistant...

- Frontmatter fields are only rendered when they differ from defaults.
- ``limit`` is intentionally excluded from frontmatter (deprecated for git-base memory).
- Files without frontmatter are treated as value-only (backward compat).
"""

from typing import Any, Dict, Optional

import yaml

from letta.schemas.block import BaseBlock


def _get_field_default(field_name: str) -> Any:
    """Get the default value for a BaseBlock field."""
    field = BaseBlock.model_fields[field_name]
    return field.default


def serialize_block(
    value: str,
    *,
    description: Optional[str] = None,
    limit: Optional[int] = None,
    read_only: bool = False,
    metadata: Optional[dict] = None,
) -> str:
    """Serialize a block to Markdown with optional YAML frontmatter.

    This is used for initial file creation. For updates to existing files,
    prefer `merge_frontmatter_with_body` to preserve user formatting.
    """
    # description is always included in frontmatter.
    # read_only and metadata are only included when non-default.
    # limit is intentionally excluded (deprecated for git-base memory).
    front: Dict[str, Any] = {}

    front["description"] = description

    if read_only != _get_field_default("read_only"):
        front["read_only"] = read_only
    if metadata and metadata != _get_field_default("metadata"):
        front["metadata"] = metadata

    # Use block style for cleaner YAML, default_flow_style=False
    yaml_str = yaml.dump(front, default_flow_style=False, sort_keys=False, allow_unicode=True).rstrip("\n")
    return f"---\n{yaml_str}\n---\n{value}"


def _extract_frontmatter(content: str) -> tuple[Optional[str], str]:
    """Return (frontmatter_yaml, body).

    If no valid opening/closing frontmatter delimiters are found, returns
    (None, original_content).
    """
    if not content.startswith("---\n"):
        return None, content

    end_idx = content.find("\n---\n", 4)
    if end_idx == -1:
        return None, content

    yaml_str = content[4:end_idx]
    body = content[end_idx + 5 :]
    return yaml_str, body


def merge_frontmatter_with_body(
    existing_content: str,
    *,
    value: str,
    description: Optional[str],
    limit: Optional[int],
    read_only: bool,
    metadata: Optional[dict],
) -> str:
    """Update block content while preserving existing frontmatter formatting when possible.

    Behavior:
    - If existing content has YAML frontmatter, parse it and update keys in-memory,
      then splice back using the exact original YAML text when values are unchanged.
    - If keys changed or missing, emit normalized frontmatter only for changed keys,
      while preserving body exactly as provided.
    - If no frontmatter exists, create one.
    """
    yaml_str, _existing_body = _extract_frontmatter(existing_content)

    if yaml_str is None:
        return serialize_block(
            value=value,
            description=description,
            limit=limit,
            read_only=read_only,
            metadata=metadata,
        )

    try:
        parsed = yaml.safe_load(yaml_str) or {}
    except yaml.YAMLError:
        parsed = {}

    if not isinstance(parsed, dict):
        parsed = {}

    # Desired values
    desired_description = description
    desired_read_only = read_only
    desired_metadata = metadata if metadata is not None else _get_field_default("metadata")

    # Track whether anything semantically changes in frontmatter.
    changed = False

    if "description" not in parsed or parsed.get("description") != desired_description:
        parsed["description"] = desired_description
        changed = True

    # Remove limit from frontmatter if it exists (deprecated for git-base memory)
    if "limit" in parsed:
        del parsed["limit"]
        changed = True

    if desired_read_only != _get_field_default("read_only"):
        if parsed.get("read_only") != desired_read_only:
            parsed["read_only"] = desired_read_only
            changed = True
    elif "read_only" in parsed:
        del parsed["read_only"]
        changed = True

    if desired_metadata and desired_metadata != _get_field_default("metadata"):
        if parsed.get("metadata") != desired_metadata:
            parsed["metadata"] = desired_metadata
            changed = True
    elif "metadata" in parsed:
        del parsed["metadata"]
        changed = True

    # If frontmatter semantics unchanged, preserve original YAML formatting verbatim.
    if not changed:
        return f"---\n{yaml_str}\n---\n{value}"

    normalized_yaml = yaml.dump(parsed, default_flow_style=False, sort_keys=False, allow_unicode=True).rstrip("\n")
    return f"---\n{normalized_yaml}\n---\n{value}"


def parse_block_markdown(content: str) -> Dict[str, Any]:
    """Parse a Markdown file into block fields.

    Returns a dict with:
        - "value": the body content after frontmatter
        - "description", "limit", "read_only", "metadata": from frontmatter (if present)

    If no frontmatter is detected, the entire content is treated as the value
    (backward compat with old repos that stored raw values).
    """
    if not content.startswith("---\n"):
        return {"value": content}

    # Find the closing --- delimiter
    end_idx = content.find("\n---\n", 4)
    if end_idx == -1:
        # No closing delimiter — treat entire content as value
        return {"value": content}

    yaml_str = content[4:end_idx]
    body = content[end_idx + 5 :]  # skip past \n---\n

    try:
        front = yaml.safe_load(yaml_str)
    except yaml.YAMLError:
        # Malformed YAML — treat entire content as value
        return {"value": content}

    if not isinstance(front, dict):
        return {"value": content}

    result: Dict[str, Any] = {"value": body}

    if "description" in front:
        result["description"] = front["description"]
    if "limit" in front:
        result["limit"] = front["limit"]
    if "read_only" in front:
        result["read_only"] = front["read_only"]
    if "metadata" in front:
        result["metadata"] = front["metadata"]

    return result
