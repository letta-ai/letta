"""
Helper utilities for structured exception logging.
Use these when you need to add context to exceptions before raising them.
"""

from typing import Any, Dict, Optional

from letta.log import get_logger

logger = get_logger(__name__)


def log_and_raise(
    exception: Exception,
    message: str,
    context: Optional[Dict[str, Any]] = None,
    level: str = "error",
) -> None:
    """
    Log an exception with structured context and then raise it.

    This is useful when you want to ensure an exception is logged with
    full context before raising it.

    Args:
        exception: The exception to log and raise
        message: Human-readable message to log
        context: Additional context to include in logs (dict)
        level: Log level (default: "error")

    Example:
        try:
            result = some_operation()
        except ValueError as e:
            log_and_raise(
                e,
                "Failed to process operation",
                context={
                    "user_id": user.id,
                    "operation": "some_operation",
                    "input": input_data,
                }
            )
    """
    extra = {
        "exception_type": exception.__class__.__name__,
        "exception_message": str(exception),
        "exception_module": exception.__class__.__module__,
    }

    if context:
        extra.update(context)

    log_method = getattr(logger, level.lower())
    log_method(
        f"{message}: {exception.__class__.__name__}: {str(exception)}",
        extra=extra,
        exc_info=exception,
    )

    raise exception


def log_exception(
    exception: Exception,
    message: str,
    context: Optional[Dict[str, Any]] = None,
    level: str = "error",
) -> None:
    """
    Log an exception with structured context without raising it.

    Use this when you want to log an exception but handle it gracefully.

    Args:
        exception: The exception to log
        message: Human-readable message to log
        context: Additional context to include in logs (dict)
        level: Log level (default: "error")

    Example:
        try:
            result = some_operation()
        except ValueError as e:
            log_exception(
                e,
                "Operation failed, using fallback",
                context={"user_id": user.id}
            )
            result = fallback_operation()
    """
    extra = {
        "exception_type": exception.__class__.__name__,
        "exception_message": str(exception),
        "exception_module": exception.__class__.__module__,
    }

    if context:
        extra.update(context)

    log_method = getattr(logger, level.lower())
    log_method(
        f"{message}: {exception.__class__.__name__}: {str(exception)}",
        extra=extra,
        exc_info=exception,
    )


def add_exception_context(exception: Exception, **context) -> Exception:
    """
    Add context to an exception that will be picked up by the global exception handler.

    This attaches a __letta_context__ attribute to the exception with structured data.
    The global exception handler will automatically include this context in logs.

    Args:
        exception: The exception to add context to
        **context: Key-value pairs to add as context

    Returns:
        The same exception with context attached

    Example:
        try:
            result = operation()
        except ValueError as e:
            raise add_exception_context(
                e,
                user_id=user.id,
                operation="do_thing",
                input_data=data,
            )
    """
    if not hasattr(exception, "__letta_context__"):
        exception.__letta_context__ = {}
    exception.__letta_context__.update(context)
    return exception
