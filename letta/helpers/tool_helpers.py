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
        tool.source_code if tool.source_code else "",
        tool.source_type if tool.source_type else "",
        _serialize_dependencies(tool),
    ]

    combined = "|".join(components)
    return hashlib.sha256(combined.encode()).hexdigest()[:MODAL_VERSION_HASH_LENGTH]


def generate_modal_function_name(tool_name: str, organization_id: str, project_id: str = "default") -> str:
    """
    Generate a Modal function name from tool name and project ID.
    Shortens the project ID to just the prefix and first UUID segment.

    Args:
        tool_name: Name of the tool
        organization_id: Full organization ID (not used in function name, but kept for future use)
        project_id: Project ID (e.g., project-12345678-90ab-cdef-1234-567890abcdef or "default")

    Returns:
        Modal function name (e.g., tool_name_project-12345678 or tool_name_default)
    """
    from letta.constants import MAX_TOOL_NAME_LENGTH

    max_tool_name_length = 64

    # Shorten the organization_id to just the first segment (e.g., project-12345678)
    short_organization_id = organization_id[: (max_tool_name_length - MAX_TOOL_NAME_LENGTH - 1)]

    # make extra sure the tool name is not too long
    name = f"{tool_name[:MAX_TOOL_NAME_LENGTH]}_{short_organization_id}"

    # safe fallback
    return name
