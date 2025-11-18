import asyncio
import inspect
import itertools
import re
import time
import traceback
from functools import wraps
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode

from letta.log import get_logger
from letta.otel.resource import get_resource, is_pytest_environment
from letta.settings import settings

logger = get_logger(__name__)  # TODO: set up logger config for this
tracer = trace.get_tracer(__name__)
_is_tracing_initialized = False

_excluded_v1_endpoints_regex: List[str] = [
    # "^GET /v1/agents/(?P<agent_id>[^/]+)/messages$",
    # "^GET /v1/agents/(?P<agent_id>[^/]+)/context$",
    # "^GET /v1/agents/(?P<agent_id>[^/]+)/archival-memory$",
    # "^GET /v1/agents/(?P<agent_id>[^/]+)/sources$",
    # r"^POST /v1/voice-beta/.*/chat/completions$",
    "^GET /v1/health$",
]


async def _trace_request_middleware(request: Request, call_next):
    if not _is_tracing_initialized:
        return await call_next(request)
    initial_span_name = f"{request.method} {request.url.path}"
    if any(re.match(regex, initial_span_name) for regex in _excluded_v1_endpoints_regex):
        return await call_next(request)

    with tracer.start_as_current_span(
        initial_span_name,
        kind=trace.SpanKind.SERVER,
    ) as span:
        try:
            response = await call_next(request)
            span.set_attribute("http.status_code", response.status_code)
            span.set_status(Status(StatusCode.OK if response.status_code < 400 else StatusCode.ERROR))
            return response
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(e)
            raise


async def _update_trace_attributes(request: Request):
    """Dependency to update trace attributes after FastAPI has processed the request"""
    if not _is_tracing_initialized:
        return

    span = trace.get_current_span()
    if not span:
        return

    # Update span name with route pattern
    route = request.scope.get("route")
    if route and hasattr(route, "path"):
        span.update_name(f"{request.method} {route.path}")

    # Add request info
    span.set_attribute("http.method", request.method)
    span.set_attribute("http.url", str(request.url))

    # Add path params
    for key, value in request.path_params.items():
        span.set_attribute(f"http.{key}", value)

    # Add the following headers to span if available
    header_attributes = {
        "user_id": "user.id",
        "x-organization-id": "organization.id",
        "x-project-id": "project.id",
        "x-agent-id": "agent.id",
        "x-template-id": "template.id",
        "x-base-template-id": "base_template.id",
        "user-agent": "client",
        "x-stainless-package-version": "sdk.version",
        "x-stainless-lang": "sdk.language",
    }
    for header_key, span_key in header_attributes.items():
        header_value = request.headers.get(header_key)
        if header_value:
            span.set_attribute(span_key, header_value)

    # Add request body if available
    try:
        body = await request.json()
        for key, value in body.items():
            span.set_attribute(f"http.request.body.{key}", str(value))
    except Exception:
        pass


async def _trace_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    status_code = getattr(exc, "status_code", 500)
    error_msg = str(exc)

    # Add error details to current span
    span = trace.get_current_span()
    if span:
        span.record_exception(
            exc,
            attributes={
                "exception.message": error_msg,
                "exception.type": type(exc).__name__,
            },
        )

    return JSONResponse(status_code=status_code, content={"detail": error_msg, "trace_id": get_trace_id() or ""})


def setup_tracing(
    endpoint: str,
    app: Optional[FastAPI] = None,
    service_name: str = "memgpt-server",
) -> None:
    if is_pytest_environment():
        return
    assert endpoint

    global _is_tracing_initialized

    tracer_provider = TracerProvider(resource=get_resource(service_name))
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    _is_tracing_initialized = True
    trace.set_tracer_provider(tracer_provider)

    # Instrumentors (e.g., RequestsInstrumentor)
    def requests_callback(span: trace.Span, _: Any, response: Any) -> None:
        if hasattr(response, "status_code"):
            span.set_status(Status(StatusCode.OK if response.status_code < 400 else StatusCode.ERROR))

    RequestsInstrumentor().instrument(response_hook=requests_callback)

    if settings.sqlalchemy_tracing:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        from letta.server.db import db_registry

        # For OpenTelemetry SQLAlchemy instrumentation, we need to use the sync_engine
        async_engine = db_registry.get_async_engine()
        if async_engine:
            # Access the sync_engine attribute safely
            try:
                SQLAlchemyInstrumentor().instrument(
                    engine=async_engine.sync_engine,
                    enable_commenter=True,
                    commenter_options={},
                    enable_attribute_commenter=True,
                )
            except Exception:
                # Fall back to instrumenting without specifying an engine
                # This will still capture some SQL operations
                SQLAlchemyInstrumentor().instrument(
                    enable_commenter=True,
                    commenter_options={},
                    enable_attribute_commenter=True,
                )
        else:
            # If no async engine is available, instrument without an engine
            SQLAlchemyInstrumentor().instrument(
                enable_commenter=True,
                commenter_options={},
                enable_attribute_commenter=True,
            )

        # Additionally set up our custom instrumentation
        try:
            from letta.otel.sqlalchemy_instrumentation_integration import setup_letta_db_instrumentation

            setup_letta_db_instrumentation(enable_joined_monitoring=True)
        except Exception as e:
            # Log but continue if our custom instrumentation fails
            logger.warning(f"Failed to setup Letta DB instrumentation: {e}")

    if app:
        # Add middleware first
        app.middleware("http")(_trace_request_middleware)

        # Add dependency to v1 routes
        from letta.server.rest_api.routers.v1 import ROUTERS as V1_ROUTES

        for router in V1_ROUTES:
            for route in router.routes:
                full_path = ((next(iter(route.methods)) + " ") if route.methods else "") + "/v1" + route.path
                if not any(re.match(regex, full_path) for regex in _excluded_v1_endpoints_regex):
                    route.dependencies.append(Depends(_update_trace_attributes))

        # Register exception handlers for tracing
        app.exception_handler(HTTPException)(_trace_error_handler)
        app.exception_handler(RequestValidationError)(_trace_error_handler)
        app.exception_handler(Exception)(_trace_error_handler)


def trace_method(func):
    """Decorator that traces function execution with OpenTelemetry"""

    def _get_span_name(func, args):
        if args and hasattr(args[0], "__class__"):
            class_name = args[0].__class__.__name__
        else:
            class_name = func.__module__
        return f"{class_name}.{func.__name__}"

    def _add_parameters_to_span(span, func, args, kwargs):
        try:
            # Add method parameters as span attributes
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()

            # Skip 'self' when adding parameters if it exists
            param_items = list(bound_args.arguments.items())
            if args and hasattr(args[0], "__class__"):
                param_items = param_items[1:]

            # Parameters to skip entirely (known to be large)
            SKIP_PARAMS = {
                "agent_state",
                "messages",
                "in_context_messages",
                "message_sequence",
                "content",
                "tool_returns",
                "memory",
                "sources",
                "context",
                "resource_id",
                "source_code",
                "request_data",
                "system",
            }

            # Max size for parameter value strings (1KB)
            MAX_PARAM_SIZE = 1024
            # Max total size for all parameters (100KB)
            MAX_TOTAL_SIZE = 1024 * 100
            total_size = 0

            for name, value in param_items:
                try:
                    # Check if we've exceeded total size limit
                    if total_size > MAX_TOTAL_SIZE:
                        span.set_attribute("parameters.truncated", True)
                        span.set_attribute("parameters.truncated_reason", f"Total size exceeded {MAX_TOTAL_SIZE} bytes")
                        break

                    # Skip parameters known to be large
                    if name in SKIP_PARAMS:
                        # Try to extract ID for observability
                        type_name = type(value).__name__
                        id_info = ""

                        try:
                            # Handle lists/iterables (e.g., messages)
                            if hasattr(value, "__iter__") and not isinstance(value, (str, bytes, dict)):
                                ids = []
                                count = 0
                                # Use itertools.islice to avoid converting entire iterable
                                for item in itertools.islice(value, 5):
                                    count += 1
                                    if hasattr(item, "id"):
                                        ids.append(str(item.id))

                                # Try to get total count if it's a sized iterable
                                total_count = None
                                if hasattr(value, "__len__"):
                                    try:
                                        total_count = len(value)
                                    except (TypeError, AttributeError):
                                        pass

                                if ids:
                                    suffix = ""
                                    if total_count is not None and total_count > 5:
                                        suffix = f"... ({total_count} total)"
                                    elif count == 5:
                                        suffix = "..."
                                    id_info = f", ids=[{','.join(ids)}{suffix}]"
                            # Handle single objects with id attribute
                            elif hasattr(value, "id"):
                                id_info = f", id={value.id}"
                        except (TypeError, AttributeError, ValueError):
                            pass

                        param_value = f"<{type_name} (excluded{id_info})>"
                        span.set_attribute(f"parameter.{name}", param_value)
                        total_size += len(param_value)
                        continue

                    # Try repr first with length limit, fallback to str if needed
                    str_value = None

                    # For simple types, use str directly
                    if isinstance(value, (str, int, float, bool, type(None))):
                        str_value = str(value)
                    else:
                        # For complex objects, try to get a truncated representation
                        try:
                            # Test if str() works (some objects have broken __str__)
                            try:
                                test_str = str(value)
                                # If str() works and is reasonable, use repr
                                str_value = repr(value)
                            except Exception:
                                # If str() fails, mark as serialization failed
                                raise ValueError("str() failed")

                            # If repr is already too long, try to be smarter
                            if len(str_value) > MAX_PARAM_SIZE * 2:
                                # For collections, show just the type and size
                                if hasattr(value, "__len__"):
                                    try:
                                        str_value = f"<{type(value).__name__} with {len(value)} items>"
                                    except (TypeError, AttributeError):
                                        str_value = f"<{type(value).__name__}>"
                                else:
                                    str_value = f"<{type(value).__name__}>"
                        except (RecursionError, MemoryError, ValueError):
                            # Handle cases where repr or str causes issues
                            str_value = f"<serialization failed: {type(value).__name__}>"
                        except Exception as e:
                            # Fallback for any other issues
                            str_value = f"<serialization failed: {type(e).__name__}>"

                    # Apply size limit
                    original_size = len(str_value)
                    if original_size > MAX_PARAM_SIZE:
                        str_value = str_value[:MAX_PARAM_SIZE] + f"... (truncated, original size: {original_size} chars)"

                    span.set_attribute(f"parameter.{name}", str_value)
                    total_size += len(str_value)

                except (TypeError, ValueError, AttributeError, RecursionError, MemoryError) as e:
                    try:
                        error_msg = f"<serialization failed: {type(e).__name__}>"
                        span.set_attribute(f"parameter.{name}", error_msg)
                        total_size += len(error_msg)
                    except Exception:
                        # If even the fallback fails, skip this parameter
                        pass

        except (TypeError, ValueError, AttributeError) as e:
            logger.debug(f"Failed to add parameters to span: {type(e).__name__}: {e}")
        except Exception as e:
            # Catch-all for any other unexpected exceptions
            logger.debug(f"Unexpected error adding parameters to span: {type(e).__name__}: {e}")

    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        if not _is_tracing_initialized:
            return await func(*args, **kwargs)

        with tracer.start_as_current_span(_get_span_name(func, args)) as span:
            _add_parameters_to_span(span, func, args, kwargs)

            try:
                result = await func(*args, **kwargs)
                span.set_status(Status(StatusCode.OK))
                return result
            except asyncio.CancelledError as e:
                # Get current task info
                current_task = asyncio.current_task()
                task_name = current_task.get_name() if current_task else "unknown"

                # Log detailed information
                logger.error(f"Task {task_name} cancelled in {func.__module__}.{func.__name__}")

                # Add to span
                span.set_status(Status(StatusCode.ERROR))
                span.record_exception(
                    e,
                    attributes={
                        "exception.type": "asyncio.CancelledError",
                        "task.name": task_name,
                        "function.name": func.__name__,
                        "function.module": func.__module__,
                        "cancellation.timestamp": time.time_ns(),
                    },
                )
                raise

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        if not _is_tracing_initialized:
            return func(*args, **kwargs)

        with tracer.start_as_current_span(_get_span_name(func, args)) as span:
            _add_parameters_to_span(span, func, args, kwargs)

            result = func(*args, **kwargs)
            span.set_status(Status(StatusCode.OK))
            return result

    return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper


def log_attributes(attributes: Dict[str, Any]) -> None:
    current_span = trace.get_current_span()
    if current_span:
        current_span.set_attributes(attributes)


def log_event(name: str, attributes: Optional[Dict[str, Any]] = None, timestamp: Optional[int] = None) -> None:
    current_span = trace.get_current_span()
    if current_span:
        if timestamp is None:
            timestamp = time.time_ns()

        def _safe_convert(v):
            if isinstance(v, (str, bool, int, float)):
                return v
            return str(v)

        attributes = {k: _safe_convert(v) for k, v in attributes.items()} if attributes else None
        current_span.add_event(name=name, attributes=attributes, timestamp=timestamp)


def get_trace_id() -> Optional[str]:
    span = trace.get_current_span()
    if span and span.get_span_context().trace_id:
        return format(span.get_span_context().trace_id, "032x")
    return None
