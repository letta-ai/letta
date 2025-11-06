import re

from starlette.middleware.base import BaseHTTPMiddleware

from letta.log_context import clear_log_context, update_log_context
from letta.schemas.enums import PrimitiveType
from letta.validators import PRIMITIVE_ID_PATTERNS


class LogContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enriches log context with request-specific attributes.

    Automatically extracts and sets:
    - actor_id: From the 'user_id' header
    - org_id: From organization-related endpoints
    - Letta primitive IDs: agent_id, tool_id, block_id, etc. from URL paths

    This enables all logs within a request to be automatically tagged with
    relevant context for better filtering and correlation in monitoring systems.
    """

    async def dispatch(self, request, call_next):
        clear_log_context()

        try:
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

            response = await call_next(request)
            return response
        finally:
            clear_log_context()
