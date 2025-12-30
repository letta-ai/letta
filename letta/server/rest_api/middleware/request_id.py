"""
Middleware for extracting and propagating API request IDs from cloud-api.

Uses a pure ASGI middleware pattern to properly propagate the request_id
to streaming responses. BaseHTTPMiddleware has a known limitation where
contextvars are not propagated to streaming response generators.
See: https://github.com/encode/starlette/discussions/1729

This middleware:
1. Extracts the x-api-request-log-id header from cloud-api
2. Sets it in the contextvar (for non-streaming code)
3. Stores it in request.state (for streaming responses where contextvars don't propagate)
"""

from contextvars import ContextVar
from typing import Optional

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from letta.otel.tracing import tracer

# Contextvar for storing the request ID across async boundaries
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Get the request ID from the current context."""
    return request_id_var.get()


class RequestIdMiddleware:
    """
    Pure ASGI middleware that extracts and propagates the API request ID.

    The request ID comes from cloud-api via the x-api-request-log-id header
    and is used to correlate steps with API request logs.

    This middleware stores the request_id in:
    - The request_id_var contextvar (works for non-streaming responses)
    - request.state.request_id (works for streaming responses where contextvars may not propagate)
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        with tracer.start_as_current_span("middleware.request_id"):
            # Create a Request object for easier header access
            request = Request(scope)

            # Extract request_id from header
            request_id = request.headers.get("x-api-request-log-id")

            # Set in contextvar (for non-streaming code paths)
            request_id_var.set(request_id)

            # Also store in request.state for streaming responses where contextvars don't propagate
            # This is accessible via request.state.request_id throughout the request lifecycle
            request.state.request_id = request_id

        await self.app(scope, receive, send)
