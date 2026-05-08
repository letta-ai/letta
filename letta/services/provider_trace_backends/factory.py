"""Factory for creating provider trace backends."""

from functools import lru_cache

from letta.services.provider_trace_backends.base import ProviderTraceBackend, ProviderTraceBackendClient


def _create_backend(backend: ProviderTraceBackend | str) -> ProviderTraceBackendClient:
    """Create a single backend instance."""
    from letta.settings import telemetry_settings

    backend_str = backend.value if isinstance(backend, ProviderTraceBackend) else backend

    match backend_str:
        case "clickhouse":
            from letta.services.provider_trace_backends.clickhouse import ClickhouseProviderTraceBackend

            return ClickhouseProviderTraceBackend()

        case "socket":
            from letta.services.provider_trace_backends.socket import SocketProviderTraceBackend

            return SocketProviderTraceBackend(socket_path=telemetry_settings.socket_path)

        case "postgres" | _:
            from letta.services.provider_trace_backends.postgres import PostgresProviderTraceBackend

            return PostgresProviderTraceBackend()


@lru_cache(maxsize=1)
def get_provider_trace_backends() -> list[ProviderTraceBackendClient]:
    """
    Get all configured provider trace backends.

    Returns cached singleton instances for each configured backend.
    Supports multiple backends for dual-write scenarios (e.g., migration).
    """
    from letta.settings import telemetry_settings

    backends = telemetry_settings.provider_trace_backends
    return [_create_backend(b) for b in backends]


def get_provider_trace_backend() -> ProviderTraceBackendClient:
    """
    Get the primary (first) configured provider trace backend.

    For backwards compatibility and read operations.
    """
    backends = get_provider_trace_backends()
    return backends[0] if backends else _create_backend("postgres")
