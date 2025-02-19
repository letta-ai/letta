import asyncio
import inspect
import sys
import time
from functools import wraps
from typing import Any, Dict, Optional

from fastapi import Request
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Span, Status, StatusCode

# Get a tracer instance - will be no-op until setup_tracing is called
tracer = trace.get_tracer(__name__)

# Track if tracing has been initialized
_is_tracing_initialized = False


def is_pytest_environment():
    """Check if we're running in pytest"""
    return "pytest" in sys.modules


def trace_method(name=None):
    """Decorator to add tracing to a method"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Skip tracing if not initialized
            if not _is_tracing_initialized:
                return await func(*args, **kwargs)

            span_name = name or func.__name__
            with tracer.start_as_current_span(span_name) as span:
                span.set_attribute("code.namespace", inspect.getmodule(func).__name__)
                span.set_attribute("code.function", func.__name__)

                if len(args) > 0 and hasattr(args[0], "__class__"):
                    span.set_attribute("code.class", args[0].__class__.__name__)

                request = _extract_request_info(args, span)
                if request and len(request) > 0:
                    span.set_attribute("agent.id", kwargs.get("agent_id"))
                    span.set_attribute("actor.id", request.get("http.user_id"))

                try:
                    result = await func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR))
                    span.record_exception(e)
                    raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Skip tracing if not initialized
            if not _is_tracing_initialized:
                return func(*args, **kwargs)

            span_name = name or func.__name__
            with tracer.start_as_current_span(span_name) as span:
                span.set_attribute("code.namespace", inspect.getmodule(func).__name__)
                span.set_attribute("code.function", func.__name__)

                if len(args) > 0 and hasattr(args[0], "__class__"):
                    span.set_attribute("code.class", args[0].__class__.__name__)

                request = _extract_request_info(args, span)
                if request and len(request) > 0:
                    span.set_attribute("agent.id", kwargs.get("agent_id"))
                    span.set_attribute("actor.id", request.get("http.user_id"))

                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR))
                    span.record_exception(e)
                    raise

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


def log_attributes(attributes: Dict[str, Any]) -> None:
    """
    Log multiple attributes to the current active span.

    Args:
        attributes: Dictionary of attribute key-value pairs
    """
    current_span = trace.get_current_span()
    if current_span:
        current_span.set_attributes(attributes)


def log_event(name: str, attributes: Optional[Dict[str, Any]] = None, timestamp: Optional[int] = None) -> None:
    """
    Log an event to the current active span.

    Args:
        name: Name of the event
        attributes: Optional dictionary of event attributes
        timestamp: Optional timestamp in nanoseconds
    """
    current_span = trace.get_current_span()
    if current_span:
        if timestamp is None:
            timestamp = int(time.perf_counter_ns())

        current_span.add_event(name=name, attributes=attributes, timestamp=timestamp)


def get_trace_id() -> str:
    current_span = trace.get_current_span()
    if current_span:
        return format(current_span.get_span_context().trace_id, "032x")
    else:
        return ""


def request_hook(span: Span, _request_context: Optional[Dict] = None, response: Optional[Any] = None):
    """Hook to update span based on response status code"""
    if response is not None:
        if hasattr(response, "status_code"):
            span.set_attribute("http.status_code", response.status_code)
            if response.status_code >= 400:
                span.set_status(Status(StatusCode.ERROR))
            elif 200 <= response.status_code < 300:
                span.set_status(Status(StatusCode.OK))


def setup_tracing(endpoint: str, service_name: str = "memgpt-server") -> None:
    """
    Sets up OpenTelemetry tracing with OTLP exporter for specific endpoints

    Args:
        endpoint: OTLP endpoint URL
        service_name: Name of the service for tracing
    """
    global _is_tracing_initialized

    # Skip tracing in pytest environment
    if is_pytest_environment():
        print("ℹ️ Skipping tracing setup in pytest environment")
        return

    # Create a Resource to identify our service
    resource = Resource.create({"service.name": service_name, "service.namespace": "default", "deployment.environment": "production"})

    # Initialize the TracerProvider with the resource
    provider = TracerProvider(resource=resource)

    # Only set up OTLP export if endpoint is provided
    if endpoint:
        otlp_exporter = OTLPSpanExporter(endpoint=endpoint)
        processor = BatchSpanProcessor(otlp_exporter)
        provider.add_span_processor(processor)
        _is_tracing_initialized = True
    else:
        print("⚠️ Warning: Tracing endpoint not provided, tracing will be disabled")

    # Set the global TracerProvider
    trace.set_tracer_provider(provider)

    # Initialize automatic instrumentation for the requests library with response hook
    if _is_tracing_initialized:
        RequestsInstrumentor().instrument(response_hook=request_hook)


def _extract_request_info(args: tuple, span: Span) -> Dict[str, Any]:
    """
    Safely extracts request information from function arguments.
    Works with both FastAPI route handlers and inner functions.
    """
    attributes = {}

    # Look for FastAPI Request object in args
    request = next((arg for arg in args if isinstance(arg, Request)), None)

    if request:
        attributes.update(
            {
                "http.route": request.url.path,
                "http.method": request.method,
                "http.scheme": request.url.scheme,
                "http.target": str(request.url.path),
                "http.url": str(request.url),
                "http.flavor": request.scope.get("http_version", ""),
                "http.client_ip": request.client.host if request.client else None,
                "http.user_id": request.headers.get("user_id"),
            }
        )

    span.set_attributes(attributes)
    return attributes
