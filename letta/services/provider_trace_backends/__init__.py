"""
Provider trace backend abstraction.

Supports multiple storage backends for LLM telemetry:
- postgres: Store in PostgreSQL (default)
- clickhouse: Store in ClickHouse via OTEL instrumentation
- socket: Send via Unix socket to external sidecar/service

Multiple backends can be enabled simultaneously for dual-write scenarios.
"""

from letta.services.provider_trace_backends.base import ProviderTraceBackend, ProviderTraceBackendClient
from letta.services.provider_trace_backends.factory import get_provider_trace_backend, get_provider_trace_backends

__all__ = [
    "ProviderTraceBackend",
    "ProviderTraceBackendClient",
    "get_provider_trace_backend",
    "get_provider_trace_backends",
]
