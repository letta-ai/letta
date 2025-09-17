import re
import time
from typing import List

from fastapi import FastAPI, Request
from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.metrics import Meter, NoOpMeter
from opentelemetry.sdk.metrics import Counter, Histogram, MeterProvider
from opentelemetry.sdk.metrics.export import AggregationTemporality, PeriodicExportingMetricReader

from letta.helpers.datetime_helpers import ns_to_ms
from letta.log import get_logger
from letta.otel.context import add_ctx_attribute, get_ctx_attributes
from letta.otel.resource import get_resource, is_pytest_environment
from letta.settings import settings

logger = get_logger(__name__)

_meter: Meter = NoOpMeter("noop")
_is_metrics_initialized: bool = False

# Endpoints to include in endpoint metrics tracking (opt-in) vs tracing.py opt-out
_included_v1_endpoints_regex: List[str] = [
    "^POST /v1/agents/(?P<agent_id>[^/]+)/messages$",
    "^POST /v1/agents/(?P<agent_id>[^/]+)/messages/stream$",
    "^POST /v1/agents/(?P<agent_id>[^/]+)/messages/async$",
]

# Header attributes to set context with
header_attributes = {
    "x-organization-id": "organization.id",
    "x-project-id": "project.id",
    "x-base-template-id": "base_template.id",
    "x-template-id": "template.id",
    "x-agent-id": "agent.id",
}


async def _otel_metric_middleware(request: Request, call_next):
    if not _is_metrics_initialized:
        return await call_next(request)

    for header_key, otel_key in header_attributes.items():
        header_value = request.headers.get(header_key)
        if header_value:
            add_ctx_attribute(otel_key, header_value)

    # Opt-in check for latency / error tracking
    endpoint_path = f"{request.method} {request.url.path}"
    should_track_endpoint_metrics = any(re.match(regex, endpoint_path) for regex in _included_v1_endpoints_regex)

    if not should_track_endpoint_metrics:
        return await call_next(request)

    # --- Opt-in endpoint metrics ---
    start_perf_counter_ns = time.perf_counter_ns()
    response = None
    status_code = 500  # reasonable default

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    except Exception as e:
        # Determine status code from exception
        status_code = getattr(e, "status_code", 500)
        raise
    finally:
        end_to_end_ms = ns_to_ms(time.perf_counter_ns() - start_perf_counter_ns)
        _record_endpoint_metrics(
            request=request,
            latency_ms=end_to_end_ms,
            status_code=status_code,
        )


def _record_endpoint_metrics(
    request: Request,
    latency_ms: float,
    status_code: int,
):
    """Record endpoint latency and request count metrics."""
    try:
        # Get the route pattern for better endpoint naming
        route = request.scope.get("route")
        endpoint_name = route.path if route and hasattr(route, "path") else "unknown"

        attrs = {
            "endpoint_path": endpoint_name,
            "method": request.method,
            "status_code": status_code,
            **get_ctx_attributes(),
        }
        from letta.otel.metric_registry import MetricRegistry

        MetricRegistry().endpoint_e2e_ms_histogram.record(latency_ms, attributes=attrs)
        MetricRegistry().endpoint_request_counter.add(1, attributes=attrs)

    except Exception as e:
        logger.warning(f"Failed to record endpoint metrics: {e}")


def setup_metrics(
    endpoint: str,
    app: FastAPI | None = None,
    service_name: str = "memgpt-server",
) -> None:
    if is_pytest_environment():
        return
    assert endpoint

    global _is_metrics_initialized, _meter
    preferred_temporality = AggregationTemporality(settings.otel_preferred_temporality)
    otlp_metric_exporter = OTLPMetricExporter(
        endpoint=endpoint,
        preferred_temporality={
            # Add more as needed here.
            Counter: preferred_temporality,
            Histogram: preferred_temporality,
        },
    )
    metric_reader = PeriodicExportingMetricReader(exporter=otlp_metric_exporter)

    meter_provider = MeterProvider(resource=get_resource(service_name), metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
    _meter = metrics.get_meter(__name__)

    if app:
        app.middleware("http")(_otel_metric_middleware)

    _is_metrics_initialized = True


def get_letta_meter() -> Meter:
    """Returns the global letta meter if metrics are initialized."""
    if not _is_metrics_initialized or isinstance(_meter, NoOpMeter):
        logger.warning("Metrics are not initialized or meter is not available.")
    return _meter
