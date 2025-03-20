import inspect
import re
import sys
import time
from functools import wraps
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer(__name__)
_is_tracing_initialized = False
_excluded_v1_endpoints_regex: List[str] = [
    "^GET /v1/agents/(?P<agent_id>[^/]+)/messages$",
    "^GET /v1/agents/(?P<agent_id>[^/]+)/context$",
    "^GET /v1/agents/(?P<agent_id>[^/]+)/archival-memory$",
    "^GET /v1/agents/(?P<agent_id>[^/]+)/sources$",
]


def is_pytest_environment():
    return "pytest" in sys.modules


async def trace_request_middleware(request: Request, call_next):
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


async def update_trace_attributes(request: Request):
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

    # Add request body if available
    try:
        body = await request.json()
        for key, value in body.items():
            span.set_attribute(f"http.request.body.{key}", str(value))
    except Exception:
        pass


async def trace_error_handler(_request: Request, exc: Exception) -> JSONResponse:
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

    global _is_tracing_initialized

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    import uuid

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": service_name,
                "device.id": uuid.getnode(),  # MAC address as unique device identifier
            }
        )
    )
    if endpoint:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
        _is_tracing_initialized = True
        trace.set_tracer_provider(provider)

        def requests_callback(span: trace.Span, _: Any, response: Any) -> None:
            if hasattr(response, "status_code"):
                span.set_status(Status(StatusCode.OK if response.status_code < 400 else StatusCode.ERROR))

        RequestsInstrumentor().instrument(response_hook=requests_callback)

        if app:
            # Add middleware first
            app.middleware("http")(trace_request_middleware)

            # Add dependency to v1 routes
            from letta.server.rest_api.routers.v1 import ROUTERS as v1_routes

            for router in v1_routes:
                for route in router.routes:
                    full_path = ((next(iter(route.methods)) + " ") if route.methods else "") + "/v1" + route.path
                    if not any(re.match(regex, full_path) for regex in _excluded_v1_endpoints_regex):
                        route.dependencies.append(Depends(update_trace_attributes))

            # Register exception handlers
            app.exception_handler(HTTPException)(trace_error_handler)
            app.exception_handler(RequestValidationError)(trace_error_handler)
            app.exception_handler(Exception)(trace_error_handler)


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

            for name, value in param_items:
                # Convert value to string to avoid serialization issues
                span.set_attribute(f"parameter.{name}", str(value))
        except:
            pass

    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        if not _is_tracing_initialized:
            return await func(*args, **kwargs)

        with tracer.start_as_current_span(_get_span_name(func, args)) as span:
            _add_parameters_to_span(span, func, args, kwargs)

            result = await func(*args, **kwargs)
            span.set_status(Status(StatusCode.OK))
            return result

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
