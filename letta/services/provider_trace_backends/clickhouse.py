"""ClickHouse provider trace backend."""

from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.services.clickhouse_provider_traces import ClickhouseProviderTraceReader
from letta.services.provider_trace_backends.base import ProviderTraceBackendClient


class ClickhouseProviderTraceBackend(ProviderTraceBackendClient):
    """
    Store provider traces in ClickHouse.

    Writes flow through OTEL instrumentation, so create_async is a no-op.
    Only reads are performed directly against ClickHouse.
    """

    def __init__(self):
        self._reader = ClickhouseProviderTraceReader()

    async def create_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        # ClickHouse writes flow through OTEL instrumentation, not direct writes.
        # Return a ProviderTrace with the same ID for consistency across backends.
        return ProviderTrace(
            id=provider_trace.id,
            step_id=provider_trace.step_id,
            request_json=provider_trace.request_json or {},
            response_json=provider_trace.response_json or {},
        )

    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        return await self._reader.get_provider_trace_by_step_id_async(
            step_id=step_id,
            organization_id=actor.organization_id,
        )
