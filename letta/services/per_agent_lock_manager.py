import threading
from collections import defaultdict

from letta.otel.tracing import trace_method


class PerAgentLockManager:
    """Manages per-agent locks."""

    def __init__(self):
        self.locks = defaultdict(threading.Lock)

    @trace_method
    def get_lock(self, agent_id: str) -> threading.Lock:
        """Retrieve the lock for a specific agent_id."""
        return self.locks[agent_id]

    @trace_method
    def clear_lock(self, agent_id: str):
        """Optionally remove a lock if no longer needed (to prevent unbounded growth)."""
        if agent_id in self.locks:
            del self.locks[agent_id]
