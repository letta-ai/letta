"""Helpers for mapping memory-repo markdown paths to block labels.

Special handling for skills:
- sync `skills/{skill_name}/SKILL.md` as block label `skills/{skill_name}`
- ignore all other markdown files under `skills/`
"""

from __future__ import annotations


def memory_block_label_from_markdown_path(path: str) -> str | None:
    """Return block label for a syncable markdown path, else None.

    Rules:
    - Non-`.md` files are ignored.
    - `skills/{skill_name}/SKILL.md` -> `skills/{skill_name}`
    - Other `skills/**` markdown files are ignored.
    - All other markdown files map to `path[:-3]`.
    """
    if not path.endswith(".md"):
        return None

    if path.startswith("skills/"):
        parts = path.split("/")
        if len(parts) == 3 and parts[0] == "skills" and parts[1] and parts[2] == "SKILL.md":
            return f"skills/{parts[1]}"
        return None

    return path[:-3]
