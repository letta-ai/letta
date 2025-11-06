from contextvars import ContextVar
from typing import Any, Optional

_log_context: ContextVar[dict[str, Any]] = ContextVar("log_context", default={})


def set_log_context(key: str, value: Any) -> None:
    ctx = _log_context.get().copy()
    ctx[key] = value
    _log_context.set(ctx)


def get_log_context(key: Optional[str] = None) -> Any:
    ctx = _log_context.get()
    if key is None:
        return ctx
    return ctx.get(key)


def clear_log_context() -> None:
    _log_context.set({})


def update_log_context(**kwargs: Any) -> None:
    ctx = _log_context.get().copy()
    ctx.update(kwargs)
    _log_context.set(ctx)


def remove_log_context(key: str) -> None:
    ctx = _log_context.get().copy()
    ctx.pop(key, None)
    _log_context.set(ctx)
