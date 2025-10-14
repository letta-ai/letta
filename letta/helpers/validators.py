import uuid


def is_valid_agent_id(agent_id: str) -> bool:
    """Check if string matches the pattern 'agent-{uuid}'"""

    if not agent_id or not agent_id.startswith("agent-"):
        return False

    uuid_section = agent_id[6:]

    try:
        uuid.UUID(uuid_section)
        return True
    except ValueError:
        return False
