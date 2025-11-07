"""
Unified logging middleware that enriches log context and ensures exceptions are logged.
"""

import re
import traceback
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from letta.log import get_logger
from letta.log_context import clear_log_context, update_log_context
from letta.schemas.enums import PrimitiveType
from letta.validators import PRIMITIVE_ID_PATTERNS

logger = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enriches log context with request-specific attributes and logs exceptions.

    Automatically extracts and sets:
    - actor_id: From the 'user_id' header
    - org_id: From organization-related endpoints
    - Letta primitive IDs: agent_id, tool_id, block_id, etc. from URL paths

    Also catches all exceptions and logs them with structured context before re-raising.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        clear_log_context()

        try:
            # Extract and set log context
            context = {}

            actor_id = request.headers.get("user_id")
            if actor_id:
                context["actor_id"] = actor_id

            path = request.url.path
            path_parts = [p for p in path.split("/") if p]

            matched_parts = set()
            for part in path_parts:
                if part in matched_parts:
                    continue

                for primitive_type in PrimitiveType:
                    prefix = primitive_type.value
                    pattern = PRIMITIVE_ID_PATTERNS.get(prefix)

                    if pattern and pattern.match(part):
                        context_key = f"{primitive_type.name.lower()}_id"

                        if primitive_type == PrimitiveType.ORGANIZATION:
                            context_key = "org_id"
                        elif primitive_type == PrimitiveType.USER:
                            context_key = "user_id"

                        context[context_key] = part
                        matched_parts.add(part)
                        break

            if context:
                update_log_context(**context)

            logger.info(
                f"Incoming request: {request.method} {request.url.path}",
                extra={
                    "method": request.method,
                    "url": str(request.url),
                    "path": request.url.path,
                    "query_params": dict(request.query_params),
                    "client_host": request.client.host if request.client else None,
                },
            )

            response = await call_next(request)
            return response

        except Exception as exc:
            # Extract request context
            request_context = {
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_host": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            }

            # Extract user context if available
            user_context = {}
            if hasattr(request.state, "user_id"):
                user_context["user_id"] = request.state.user_id
            if hasattr(request.state, "org_id"):
                user_context["org_id"] = request.state.org_id

            # Check for custom context attached to the exception
            custom_context = {}
            if hasattr(exc, "__letta_context__"):
                custom_context = exc.__letta_context__

            # Log with structured data
            logger.error(
                f"Unhandled exception in request: {exc.__class__.__name__}: {str(exc)}",
                extra={
                    "exception_type": exc.__class__.__name__,
                    "exception_message": str(exc),
                    "exception_module": exc.__class__.__module__,
                    "request": request_context,
                    "user": user_context,
                    "custom_context": custom_context,
                    "traceback": traceback.format_exc(),
                },
                exc_info=True,
            )

            # Re-raise to let FastAPI's exception handlers deal with it
            raise

        finally:
            clear_log_context()
