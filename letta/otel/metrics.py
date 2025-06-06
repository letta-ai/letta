from fastapi import FastAPI, Request
from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.metrics import NoOpMeter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

from letta.log import get_logger
from letta.otel.context import add_ctx_attribute
from letta.otel.resource import get_resource, is_pytest_environment

logger = get_logger(__name__)

_meter: metrics.Meter = NoOpMeter("noop")
_is_metrics_initialized: bool = False


async def _otel_metric_middleware(request: Request, call_next):
    if not _is_metrics_initialized:
        return await call_next(request)

    header_attributes = {
        "x-organization-id": "organization.id",
        "x-project-id": "project.id",
        "x-base-template-id": "base_template.id",
        "x-template-id": "template.id",
        "x-agent-id": "agent.id",
    }
    try:
        for header_key, otel_key in header_attributes.items():
            header_value = request.headers.get(header_key)
            if header_value:
                add_ctx_attribute(otel_key, header_value)
        return await call_next(request)
    except Exception:
        raise


def setup_metrics(
    endpoint: str,
    app: FastAPI | None = None,
    service_name: str = "memgpt-server",
) -> None:
    if is_pytest_environment():
        return
    assert endpoint

    global _is_metrics_initialized, _meter

    otlp_metric_exporter = OTLPMetricExporter(endpoint=endpoint)
    metric_reader = PeriodicExportingMetricReader(exporter=otlp_metric_exporter)
    meter_provider = MeterProvider(resource=get_resource(service_name), metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
    _meter = metrics.get_meter(__name__)

    if app:
        app.middleware("http")(_otel_metric_middleware)

    _is_metrics_initialized = True


def get_letta_meter() -> metrics.Meter | None:
    """Returns the global letta meter if metrics are initialized."""
    if not _is_metrics_initialized or isinstance(_meter, NoOpMeter):
        logger.warning("Metrics are not initialized or meter is not available.")
    return _meter
