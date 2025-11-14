"""
Request size monitoring middleware for Letta application.
Tracks incoming request sizes to identify large uploads causing SSL memory spikes.
"""

import time
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from letta.log import get_logger
from letta.monitoring import get_memory_tracker

logger = get_logger(__name__)

# Size thresholds (in bytes)
SIZE_WARNING_THRESHOLD = 10 * 1024 * 1024  # 10MB
SIZE_ERROR_THRESHOLD = 50 * 1024 * 1024  # 50MB
SIZE_CRITICAL_THRESHOLD = 100 * 1024 * 1024  # 100MB


class RequestSizeMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor incoming request sizes and detect large uploads.
    This helps identify if SSL memory spikes are from large incoming data.
    """

    def __init__(self, app):
        super().__init__(app)
        self.tracker = get_memory_tracker()

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_size = 0
        content_type = request.headers.get("content-type", "")

        # Track the endpoint
        endpoint = f"{request.method} {request.url.path}"

        # Special monitoring for known large data endpoints
        critical_endpoints = [
            ("/upload", "file upload"),
            ("/messages", "message creation"),
            ("/agents", "agent creation/update"),
            ("/memory", "memory update"),
            ("/sources", "source upload"),
            ("/folders", "folder upload"),
        ]

        is_critical = any(pattern in request.url.path.lower() for pattern, _ in critical_endpoints)
        endpoint_type = next((desc for pattern, desc in critical_endpoints if pattern in request.url.path.lower()), "general")

        # Try to get content length from headers
        content_length = request.headers.get("content-length")
        if content_length:
            request_size = int(content_length)

        # Get memory before processing
        memory_before = self.tracker.get_memory_info()

        # Enhanced monitoring for critical endpoints
        if is_critical and request_size > 1024 * 1024:  # Log all critical endpoints > 1MB
            logger.info(
                f"Critical endpoint access: {endpoint_type} - {endpoint} - "
                f"Size: {request_size / 1024 / 1024:.2f} MB - "
                f"Memory before: {memory_before.get('rss_mb', 0):.2f} MB"
            )

        # Log large incoming requests BEFORE processing
        if request_size > SIZE_CRITICAL_THRESHOLD:
            logger.critical(
                f"CRITICAL: Large request incoming - {endpoint} ({endpoint_type}) - "
                f"Size: {request_size / 1024 / 1024:.2f} MB - "
                f"Content-Type: {content_type} - "
                f"Memory before: {memory_before.get('rss_mb', 0):.2f} MB"
            )
        elif request_size > SIZE_ERROR_THRESHOLD:
            logger.error(
                f"Large request detected - {endpoint} ({endpoint_type}) - "
                f"Size: {request_size / 1024 / 1024:.2f} MB - "
                f"Content-Type: {content_type}"
            )
        elif request_size > SIZE_WARNING_THRESHOLD:
            logger.warning(
                f"Sizeable request - {endpoint} ({endpoint_type}) - "
                f"Size: {request_size / 1024 / 1024:.2f} MB - "
                f"Content-Type: {content_type}"
            )

        # For multipart/form-data (file uploads), try to get more details
        if "multipart/form-data" in content_type:
            logger.info(f"File upload detected at {endpoint} - Expected size: {request_size / 1024 / 1024:.2f} MB")
            # Note: The actual file reading happens when the endpoint accesses request.form()
            # That's when SSL read would spike

        # Track the operation with memory monitoring
        operation_name = f"request_{request.method}_{request.url.path.replace('/', '_')}"

        # For large JSON payloads, log structure details
        if request_size > SIZE_WARNING_THRESHOLD and "application/json" in content_type:
            # Create a copy of the request for body logging
            body_logger = RequestBodyLogger()
            try:
                # Clone the body for inspection (this won't consume the original)
                body = await request.body()

                # Put it back for the actual handler
                async def receive():
                    return {"type": "http.request", "body": body}

                request._receive = receive

                # Log the structure
                if body:
                    await self._log_json_structure(body, endpoint)
            except Exception as e:
                logger.warning(f"Could not inspect request body: {e}")

        try:
            # Process the request with memory tracking
            # Use the decorator by creating a wrapped function
            @self.tracker.track_operation(operation_name)
            async def process_request():
                return await call_next(request)

            response = await process_request()

            # Get memory after processing
            memory_after = self.tracker.get_memory_info()
            memory_delta = memory_after.get("rss_mb", 0) - memory_before.get("rss_mb", 0)

            # Log if memory increased significantly during request processing
            if memory_delta > 100:  # More than 100MB increase
                process_time = time.time() - start_time
                logger.error(
                    f"MEMORY SPIKE during request: {endpoint} - "
                    f"Memory increased by {memory_delta:.2f} MB - "
                    f"Request size: {request_size / 1024 / 1024:.2f} MB - "
                    f"Process time: {process_time:.2f}s - "
                    f"Content-Type: {content_type}"
                )

            return response

        except Exception as e:
            # Log any errors with context
            logger.error(f"Error processing request {endpoint} - Size: {request_size / 1024 / 1024:.2f} MB - Error: {str(e)}")
            raise

    async def _log_json_structure(self, body: bytes, endpoint: str):
        """Helper method to log JSON body structure for large payloads."""
        import json

        try:
            data = json.loads(body)
            body_size = len(body)

            # Calculate field sizes
            field_sizes = {}
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, (str, bytes)):
                        field_sizes[key] = len(value)
                    elif isinstance(value, (list, dict)):
                        field_sizes[key] = len(json.dumps(value))
                    else:
                        field_sizes[key] = 0
            elif isinstance(data, list):
                field_sizes["list_items"] = len(data)
                if data:
                    # Sample first item size
                    field_sizes["first_item_size"] = len(json.dumps(data[0]))

            # Find largest fields
            if field_sizes:
                largest_fields = sorted(field_sizes.items(), key=lambda x: x[1], reverse=True)[:5]

                logger.warning(
                    f"Large JSON payload structure at {endpoint}:\n"
                    f"  Total size: {body_size / 1024 / 1024:.2f} MB\n"
                    f"  Top fields by size:\n"
                    + "\n".join([f"    - {k}: {v / 1024 / 1024:.2f} MB" for k, v in largest_fields if v > 1024])  # Only show fields > 1KB
                )

                # Special monitoring for known problematic fields
                problematic_fields = ["messages", "memory", "system", "tools", "files", "context"]
                for field in problematic_fields:
                    if field in field_sizes and field_sizes[field] > 5 * 1024 * 1024:  # > 5MB
                        logger.error(f"LARGE FIELD DETECTED: '{field}' is {field_sizes[field] / 1024 / 1024:.2f} MB at {endpoint}")

        except json.JSONDecodeError:
            logger.error(f"Could not parse JSON body at {endpoint} (size: {len(body) / 1024 / 1024:.2f} MB)")
        except Exception as e:
            logger.error(f"Error analyzing JSON structure: {e}")


class RequestBodyLogger:
    """
    Utility to log request body details for specific endpoints.
    Useful for debugging which fields contain large data.
    """

    @staticmethod
    async def log_json_body_structure(request: Request, endpoint: str):
        """Log the structure and size of JSON request bodies."""
        try:
            # Only for JSON requests
            if "application/json" not in request.headers.get("content-type", ""):
                return

            # Get the body
            body = await request.body()
            body_size = len(body)

            if body_size > SIZE_WARNING_THRESHOLD:
                # Try to parse JSON to understand structure
                import json

                try:
                    data = json.loads(body)

                    # Log field sizes
                    field_sizes = {}
                    for key, value in data.items() if isinstance(data, dict) else enumerate(data):
                        if isinstance(value, (str, bytes)):
                            field_sizes[key] = len(value)
                        elif isinstance(value, (list, dict)):
                            field_sizes[key] = len(json.dumps(value))
                        else:
                            field_sizes[key] = 0

                    # Find largest fields
                    largest_fields = sorted(field_sizes.items(), key=lambda x: x[1], reverse=True)[:5]

                    logger.warning(
                        f"Large JSON body structure at {endpoint}:\n"
                        f"  Total size: {body_size / 1024 / 1024:.2f} MB\n"
                        f"  Top fields by size:\n" + "\n".join([f"    - {k}: {v / 1024 / 1024:.2f} MB" for k, v in largest_fields])
                    )

                except json.JSONDecodeError:
                    logger.error(f"Could not parse JSON body at {endpoint} (size: {body_size / 1024 / 1024:.2f} MB)")

        except Exception as e:
            logger.error(f"Error logging request body structure: {e}")


def identify_upload_endpoints(app):
    """
    Scan the app routes to identify potential upload endpoints.
    """
    upload_endpoints = []

    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            path = route.path
            methods = route.methods

            # Look for common upload patterns
            upload_keywords = ["upload", "file", "attachment", "media", "document", "image", "import"]
            if any(keyword in path.lower() for keyword in upload_keywords):
                upload_endpoints.append((path, methods))

            # Also check for POST/PUT to any endpoint (potential large JSON)
            if "POST" in methods or "PUT" in methods or "PATCH" in methods:
                upload_endpoints.append((path, methods))

    logger.info("Potential upload/large data endpoints identified:")
    for path, methods in upload_endpoints[:20]:  # Log first 20
        logger.info(f"  {', '.join(methods)}: {path}")

    return upload_endpoints
