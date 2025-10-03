import hashlib

from letta.constants import MODAL_VERSION_HASH_LENGTH
from letta.schemas.tool import Tool


def _serialize_dependencies(tool: Tool) -> str:
    """
    Serialize dependencies in a consistent way for hashing.
    TODO: This should be improved per LET-3770 to ensure consistent ordering.
    For now, we convert to string representation.
    """
    parts = []

    if tool.pip_requirements:
        # TODO: Sort these consistently
        parts.append(f"pip:{str(tool.pip_requirements)}")

    if tool.npm_requirements:
        # TODO: Sort these consistently
        parts.append(f"npm:{str(tool.npm_requirements)}")

    return ";".join(parts)


def compute_tool_hash(tool: Tool):
    """
    Calculate a hash representing the current version of the tool and configuration.
    This hash changes when:
    - Tool source code changes
    - Tool dependencies change
    - Sandbox configuration changes
    - Language/runtime changes
    """
    components = [
        tool.source_code,
        tool.source_type,
        _serialize_dependencies(tool),
    ]

    combined = "|".join(components)
    return hashlib.sha256(combined.encode()).hexdigest()[:MODAL_VERSION_HASH_LENGTH]
