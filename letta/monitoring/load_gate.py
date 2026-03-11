"""
Per-pod readiness gating based on in-flight load and request admission wait.

Three independent gates, each with its own stabilization window:
  - fg_in_flight:     foreground (interactive) runs in progress on this pod
  - bg_in_flight:     background runs in progress on this pod
  - admission_wait:   time spent waiting to acquire the conversation lock (per-request)

All gates share the degraded_stabilization_seconds / recovery_stabilization_seconds
settings from ReadinessSettings. A pod only recovers to "ready" once ALL active
degradation sources have cleared (see readiness_state.mark_degraded / clear_degraded).
"""

import threading
import time
from typing import Optional

from letta.log import get_logger

logger = get_logger(__name__)


def _get_readiness_settings():
    from letta.settings import readiness_settings

    return readiness_settings


class LoadGate:
    """Thread-safe per-pod readiness gate for in-flight counts and admission wait."""

    def __init__(self):
        self._lock = threading.Lock()

        # In-flight counters tracked independently of OTel (OTel gives no read-back).
        self._fg_count: int = 0
        self._bg_count: int = 0

        # Per-gate stabilization timers.
        self._fg_degraded_since: Optional[float] = None
        self._fg_recovery_since: Optional[float] = None

        self._bg_degraded_since: Optional[float] = None
        self._bg_recovery_since: Optional[float] = None

        self._admission_degraded_since: Optional[float] = None
        self._admission_recovery_since: Optional[float] = None

    # ------------------------------------------------------------------
    # In-flight tracking — called from streaming_service on start/end
    # ------------------------------------------------------------------

    def on_fg_start(self) -> None:
        with self._lock:
            self._fg_count += 1
            count = self._fg_count
        self._check_fg(count)

    def on_fg_end(self) -> None:
        with self._lock:
            self._fg_count = max(0, self._fg_count - 1)
            count = self._fg_count
        self._check_fg(count)

    def on_bg_start(self) -> None:
        with self._lock:
            self._bg_count += 1
            count = self._bg_count
        self._check_bg(count)

    def on_bg_end(self) -> None:
        with self._lock:
            self._bg_count = max(0, self._bg_count - 1)
            count = self._bg_count
        self._check_bg(count)

    def on_admission_wait(self, wait_ms: float) -> None:
        """Evaluate admission wait after each lock acquisition."""
        try:
            rs = _get_readiness_settings()
            if not rs.enforcement_enabled or not rs.admission_wait_gating_enabled:
                return

            from letta.monitoring.readiness_state import get_readiness_state

            if get_readiness_state() not in ("ready", "degraded"):
                return

            now = time.monotonic()
            if wait_ms >= rs.admission_wait_threshold_ms:
                self._maybe_degrade_admission(now, wait_ms)
            else:
                self._maybe_recover_admission(now)
        except Exception:
            pass  # Never let gating crash the request path

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _check_fg(self, count: int) -> None:
        try:
            rs = _get_readiness_settings()
            if not rs.enforcement_enabled or not rs.fg_in_flight_gating_enabled:
                return

            from letta.monitoring.readiness_state import get_readiness_state

            if get_readiness_state() not in ("ready", "degraded"):
                return

            now = time.monotonic()
            if count > rs.fg_in_flight_threshold:
                self._maybe_degrade_fg(now, count)
            else:
                self._maybe_recover_fg(now)
        except Exception:
            pass

    def _check_bg(self, count: int) -> None:
        try:
            rs = _get_readiness_settings()
            if not rs.enforcement_enabled or not rs.bg_in_flight_gating_enabled:
                return

            from letta.monitoring.readiness_state import get_readiness_state

            if get_readiness_state() not in ("ready", "degraded"):
                return

            now = time.monotonic()
            if count > rs.bg_in_flight_threshold:
                self._maybe_degrade_bg(now, count)
            else:
                self._maybe_recover_bg(now)
        except Exception:
            pass

    def _maybe_degrade_fg(self, now: float, count: int) -> None:
        from letta.monitoring.readiness_state import get_readiness_state, mark_degraded

        rs = _get_readiness_settings()
        if self._fg_degraded_since is None:
            self._fg_degraded_since = now
            self._fg_recovery_since = None
            return

        elapsed = now - self._fg_degraded_since
        if elapsed >= rs.degraded_stabilization_seconds and get_readiness_state() == "ready":
            mark_degraded(f"fg_in_flight:{count}")

    def _maybe_recover_fg(self, now: float) -> None:
        from letta.monitoring.readiness_state import clear_degraded, get_readiness_state

        rs = _get_readiness_settings()
        self._fg_degraded_since = None

        if get_readiness_state() != "degraded":
            self._fg_recovery_since = None
            return

        if self._fg_recovery_since is None:
            self._fg_recovery_since = now
            return

        if now - self._fg_recovery_since >= rs.recovery_stabilization_seconds:
            clear_degraded("fg_in_flight")
            self._fg_recovery_since = None

    def _maybe_degrade_bg(self, now: float, count: int) -> None:
        from letta.monitoring.readiness_state import get_readiness_state, mark_degraded

        rs = _get_readiness_settings()
        if self._bg_degraded_since is None:
            self._bg_degraded_since = now
            self._bg_recovery_since = None
            return

        elapsed = now - self._bg_degraded_since
        if elapsed >= rs.degraded_stabilization_seconds and get_readiness_state() == "ready":
            mark_degraded(f"bg_in_flight:{count}")

    def _maybe_recover_bg(self, now: float) -> None:
        from letta.monitoring.readiness_state import clear_degraded, get_readiness_state

        rs = _get_readiness_settings()
        self._bg_degraded_since = None

        if get_readiness_state() != "degraded":
            self._bg_recovery_since = None
            return

        if self._bg_recovery_since is None:
            self._bg_recovery_since = now
            return

        if now - self._bg_recovery_since >= rs.recovery_stabilization_seconds:
            clear_degraded("bg_in_flight")
            self._bg_recovery_since = None

    def _maybe_degrade_admission(self, now: float, wait_ms: float) -> None:
        from letta.monitoring.readiness_state import get_readiness_state, mark_degraded

        rs = _get_readiness_settings()
        if self._admission_degraded_since is None:
            self._admission_degraded_since = now
            self._admission_recovery_since = None
            return

        elapsed = now - self._admission_degraded_since
        if elapsed >= rs.degraded_stabilization_seconds and get_readiness_state() == "ready":
            mark_degraded(f"admission_wait:{wait_ms:.0f}ms")

    def _maybe_recover_admission(self, now: float) -> None:
        from letta.monitoring.readiness_state import clear_degraded, get_readiness_state

        rs = _get_readiness_settings()
        self._admission_degraded_since = None

        if get_readiness_state() != "degraded":
            self._admission_recovery_since = None
            return

        if self._admission_recovery_since is None:
            self._admission_recovery_since = now
            return

        if now - self._admission_recovery_since >= rs.recovery_stabilization_seconds:
            clear_degraded("admission_wait")
            self._admission_recovery_since = None


# Singleton — one gate per process.
_load_gate: Optional[LoadGate] = None
_gate_init_lock = threading.Lock()


def get_load_gate() -> LoadGate:
    global _load_gate
    if _load_gate is None:
        with _gate_init_lock:
            if _load_gate is None:
                _load_gate = LoadGate()
    return _load_gate
