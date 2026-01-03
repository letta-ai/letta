"""
E2B Persistent Sandbox Manager

This module manages persistent E2B sandboxes for Letta agents.
Each agent gets its own sandbox, stored in agent.metadata["sandbox_id"].
Sandboxes are paused when idle and resumed when needed.
"""

import os
from typing import Optional, TYPE_CHECKING

from e2b_code_interpreter import Sandbox

if TYPE_CHECKING:
    from letta_client import Letta


# Default sandbox timeout (10 minutes)
DEFAULT_TIMEOUT_MS = 10 * 60 * 1000


def get_or_create_sandbox(
    client: "Letta",
    agent_id: Optional[str] = None,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
) -> Sandbox:
    """
    Get or create a persistent E2B sandbox for an agent.

    This function:
    1. Checks if the agent has a sandbox_id in metadata
    2. If yes, tries to resume the sandbox
    3. If no (or resume fails), creates a new sandbox and stores the ID

    Args:
        client: The Letta client (auto-injected in tool sandbox)
        agent_id: The agent ID (defaults to LETTA_AGENT_ID env var)
        timeout_ms: Sandbox timeout in milliseconds

    Returns:
        An active E2B Sandbox instance
    """
    if agent_id is None:
        agent_id = os.environ.get("LETTA_AGENT_ID")
        if not agent_id:
            raise ValueError("No agent_id provided and LETTA_AGENT_ID not set")

    # Get the agent to check for existing sandbox
    agent = client.agents.retrieve(agent_id=agent_id)

    # Check if agent has a sandbox_id in metadata
    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if sandbox_id:
        try:
            # Try to resume the existing sandbox
            sandbox = Sandbox.connect(sandbox_id, timeout=timeout_ms)
            return sandbox
        except Exception:
            # Sandbox may have been killed or expired, create a new one
            pass

    # Create a new sandbox with auto-pause enabled
    sandbox = Sandbox.create(timeout=timeout_ms)

    # Store the sandbox ID in agent metadata
    current_metadata = agent.metadata or {}
    if not isinstance(current_metadata, dict):
        current_metadata = {}
    current_metadata["sandbox_id"] = sandbox.sandbox_id

    # Update agent metadata with the new sandbox ID
    client.agents.modify(
        agent_id=agent_id,
        metadata=current_metadata,
    )

    return sandbox


def pause_sandbox(sandbox: Sandbox) -> None:
    """
    Pause a sandbox to preserve its state.

    The sandbox can be resumed later using Sandbox.connect(sandbox_id).

    Args:
        sandbox: The sandbox to pause
    """
    try:
        sandbox.pause()
    except Exception:
        # Sandbox may already be paused or killed
        pass


def kill_sandbox(
    client: "Letta",
    agent_id: Optional[str] = None,
) -> str:
    """
    Kill and remove the sandbox for an agent.

    Args:
        client: The Letta client
        agent_id: The agent ID (defaults to LETTA_AGENT_ID env var)

    Returns:
        A message indicating the result
    """
    if agent_id is None:
        agent_id = os.environ.get("LETTA_AGENT_ID")
        if not agent_id:
            raise ValueError("No agent_id provided and LETTA_AGENT_ID not set")

    agent = client.agents.retrieve(agent_id=agent_id)

    sandbox_id = None
    if agent.metadata and isinstance(agent.metadata, dict):
        sandbox_id = agent.metadata.get("sandbox_id")

    if not sandbox_id:
        return "No sandbox found for this agent"

    try:
        Sandbox.kill(sandbox_id)
    except Exception:
        pass  # Sandbox may already be killed

    # Remove sandbox_id from metadata
    current_metadata = agent.metadata or {}
    if isinstance(current_metadata, dict) and "sandbox_id" in current_metadata:
        del current_metadata["sandbox_id"]
        client.agents.modify(
            agent_id=agent_id,
            metadata=current_metadata,
        )

    return f"Sandbox {sandbox_id} has been killed"
