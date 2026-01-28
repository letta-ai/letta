import asyncio
import os

from letta.helpers.singleton import singleton
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User as PydanticUser
from letta.services.provider_trace_backends import get_provider_trace_backend, get_provider_trace_backends
from letta.settings import telemetry_settings
from letta.utils import enforce_types

logger = get_logger(__name__)


class TelemetryManager:
    """
    Manages provider trace telemetry using configurable backends.

    Supports multiple backends for dual-write scenarios (e.g., migration).
    Configure via LETTA_TELEMETRY_PROVIDER_TRACE_BACKEND (comma-separated):
    - postgres: Store in PostgreSQL (default)
    - clickhouse: Store in ClickHouse via OTEL instrumentation
    - socket: Store via Unix socket to Crouton sidecar (which writes to GCS)

    Example: LETTA_TELEMETRY_PROVIDER_TRACE_BACKEND=postgres,socket

    Multi-backend behavior:
    - Writes: Sent to ALL configured backends concurrently via asyncio.gather.
              Errors in one backend don't affect others (logged but not raised).
    - Reads: Only from PRIMARY backend (first in the comma-separated list).
              Secondary backends are write-only for this manager.
    """

    def __init__(self):
        self._backends = get_provider_trace_backends()
        self._primary_backend = self._backends[0] if self._backends else get_provider_trace_backend()

    @enforce_types
    @trace_method
    async def get_provider_trace_by_step_id_async(
        self,
        step_id: str,
        actor: PydanticUser,
    ) -> ProviderTrace | None:
        # Read from primary backend only
        return await self._primary_backend.get_by_step_id_async(step_id=step_id, actor=actor)

    @enforce_types
    @trace_method
    async def create_provider_trace_async(
        self,
        actor: PydanticUser,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        # Set source if not already set (use LETTA_TELEMETRY_SOURCE, fallback to DD_SERVICE)
        if provider_trace.source is None:
            source = telemetry_settings.source or os.environ.get("DD_SERVICE")
            if source:
                provider_trace = provider_trace.model_copy(update={"source": source})

        # Write to all backends concurrently
        tasks = [self._safe_create_async(backend, actor, provider_trace) for backend in self._backends]
        results = await asyncio.gather(*tasks)

        # Return first non-None result (from primary backend)
        return next((r for r in results if r is not None), None)

    async def _safe_create_async(
        self,
        backend,
        actor: PydanticUser,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | None:
        """Create trace in a backend, catching and logging errors."""
        try:
            return await backend.create_async(actor=actor, provider_trace=provider_trace)
        except Exception as e:
            logger.warning(f"Failed to write to {backend.__class__.__name__}: {e}")
            return None

    def create_provider_trace(
        self,
        actor: PydanticUser,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | None:
        """Synchronous version - writes to all backends."""
        # Set source if not already set (use LETTA_TELEMETRY_SOURCE, fallback to DD_SERVICE)
        if provider_trace.source is None:
            source = telemetry_settings.source or os.environ.get("DD_SERVICE")
            if source:
                provider_trace = provider_trace.model_copy(update={"source": source})

        result = None
        for backend in self._backends:
            try:
                r = backend.create_sync(actor=actor, provider_trace=provider_trace)
                if result is None:
                    result = r
            except Exception as e:
                logger.warning(f"Failed to write to {backend.__class__.__name__}: {e}")
        return result


@singleton
class NoopTelemetryManager(TelemetryManager):
    """Noop implementation of TelemetryManager."""

    def __init__(self):
        pass  # Don't initialize backend

    async def create_provider_trace_async(
        self,
        actor: PydanticUser,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        return None

    async def get_provider_trace_by_step_id_async(
        self,
        step_id: str,
        actor: PydanticUser,
    ) -> ProviderTrace | None:
        return None

    def create_provider_trace(
        self,
        actor: PydanticUser,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        return None
