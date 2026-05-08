import threading

from letta.log import get_logger
from letta.otel.metric_registry import MetricRegistry

logger = get_logger(__name__)

_VALID_REASONS = {
    "ready",
    "warming",
    "draining",
    "degraded",
    "manual_disable",
}

_state_lock = threading.Lock()
_current_reason = "warming"

# Tracks which gate sources are currently active. Recovery to "ready" only happens
# when all sources have cleared — prevents one gate recovering while another is still firing.
_active_degradation_sources: set = set()


def initialize_readiness_state(reason: str = "warming", source: str = "startup") -> str:
    """Initialize readiness telemetry state without changing probe behavior."""
    if reason not in _VALID_REASONS:
        logger.warning(f"Invalid readiness state '{reason}', falling back to warming")
        reason = "warming"

    global _current_reason
    with _state_lock:
        _current_reason = reason

    MetricRegistry().readiness_state_gauge.set(1, attributes={"reason": reason})
    logger.info(f"Readiness telemetry initialized: state={reason}, source={source}")
    return reason


def set_readiness_state(reason: str, source: str = "unknown") -> str:
    """Transition readiness telemetry state and emit metric/log signals."""
    if reason not in _VALID_REASONS:
        logger.warning(f"Ignoring unknown readiness state transition '{reason}' from source={source}")
        return get_readiness_state()

    global _current_reason
    with _state_lock:
        previous_reason = _current_reason
        if previous_reason == reason:
            return reason
        _current_reason = reason

    MetricRegistry().readiness_state_gauge.set(0, attributes={"reason": previous_reason})
    MetricRegistry().readiness_state_gauge.set(1, attributes={"reason": reason})
    logger.info(f"Readiness telemetry transition: {previous_reason} -> {reason} (source={source})")
    return reason


def get_readiness_state() -> str:
    with _state_lock:
        return _current_reason


def mark_degraded(source: str) -> None:
    """Register a degradation source and transition to degraded state.

    Multiple gates can independently call mark_degraded. The pod stays degraded
    until all sources have called clear_degraded.
    """
    with _state_lock:
        _active_degradation_sources.add(source)

    set_readiness_state("degraded", source=source)


def clear_degraded(source: str) -> None:
    """Deregister a degradation source. Recovers to ready only when all sources clear."""
    with _state_lock:
        _active_degradation_sources.discard(source)
        remaining = set(_active_degradation_sources)

    if not remaining:
        set_readiness_state("ready", source=f"{source}_recovered")
    else:
        logger.debug(f"Readiness gate cleared source={source}, still degraded by: {remaining}")
