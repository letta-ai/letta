"""
Global exception handlers for non-request exceptions (background tasks, startup, etc.)
"""

import sys
import threading
import traceback

from letta.log import get_logger

logger = get_logger(__name__)


def setup_global_exception_handlers():
    """
    Set up global exception handlers to catch exceptions that occur outside of request handling.
    This includes:
    - Uncaught exceptions in the main thread
    - Exceptions in background threads
    - Asyncio task exceptions
    """

    # 1. Handle uncaught exceptions in the main thread
    def global_exception_hook(exc_type, exc_value, exc_traceback):
        """
        Global exception hook for uncaught exceptions in the main thread.
        This catches exceptions that would otherwise crash the application.
        """
        # Don't log KeyboardInterrupt (Ctrl+C)
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return

        logger.critical(
            f"Uncaught exception in main thread: {exc_type.__name__}: {exc_value}",
            extra={
                "exception_type": exc_type.__name__,
                "exception_message": str(exc_value),
                "exception_module": exc_type.__module__,
                "traceback": "".join(traceback.format_exception(exc_type, exc_value, exc_traceback)),
            },
            exc_info=(exc_type, exc_value, exc_traceback),
        )

    sys.excepthook = global_exception_hook

    # 2. Handle exceptions in threading
    def thread_exception_hook(args):
        """
        Hook for exceptions in threads.
        """
        logger.error(
            f"Uncaught exception in thread {args.thread.name}: {args.exc_type.__name__}: {args.exc_value}",
            extra={
                "exception_type": args.exc_type.__name__,
                "exception_message": str(args.exc_value),
                "exception_module": args.exc_type.__module__,
                "thread_name": args.thread.name,
                "thread_id": args.thread.ident,
                "traceback": "".join(traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback)),
            },
            exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
        )

    threading.excepthook = thread_exception_hook

    logger.info("Global exception handlers initialized")


def setup_asyncio_exception_handler(loop):
    """
    Set up exception handler for asyncio loop.
    Call this with your event loop.
    """

    def asyncio_exception_handler(loop, context):
        """
        Handler for exceptions in asyncio tasks.
        """
        exception = context.get("exception")
        message = context.get("message", "Unhandled exception in asyncio")

        extra = {
            "asyncio_context": str(context),
            "task": str(context.get("task")),
        }

        if exception:
            extra.update(
                {
                    "exception_type": exception.__class__.__name__,
                    "exception_message": str(exception),
                    "exception_module": exception.__class__.__module__,
                }
            )
            logger.error(
                f"Asyncio exception: {message}: {exception}",
                extra=extra,
                exc_info=exception,
            )
        else:
            logger.error(
                f"Asyncio exception: {message}",
                extra=extra,
            )

    loop.set_exception_handler(asyncio_exception_handler)
    logger.info("Asyncio exception handler initialized")
