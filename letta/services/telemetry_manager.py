from letta.helpers.json_helpers import json_dumps, json_loads
from letta.helpers.singleton import singleton
from letta.orm.provider_trace import ProviderTrace as ProviderTraceModel
from letta.otel.tracing import trace_method
from letta.schemas.provider_trace import ProviderTrace as PydanticProviderTrace, ProviderTraceCreate
from letta.schemas.step import Step as PydanticStep
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.clickhouse_provider_traces import ClickhouseProviderTraceReader
from letta.settings import settings
from letta.utils import enforce_types


class TelemetryManager:
    @enforce_types
    @trace_method
    async def get_provider_trace_by_step_id_async(
        self,
        step_id: str,
        actor: PydanticUser,
    ) -> PydanticProviderTrace | None:
        # When ClickHouse is enabled, read only from ClickHouse (no Postgres fallback)
        if settings.use_clickhouse_for_provider_traces:
            return await ClickhouseProviderTraceReader().get_provider_trace_by_step_id_async(
                step_id=step_id,
                organization_id=actor.organization_id,
            )

        # Postgres storage backend
        async with db_registry.async_session() as session:
            provider_trace = await ProviderTraceModel.read_async(db_session=session, step_id=step_id, actor=actor)
            return provider_trace.to_pydantic()

    @enforce_types
    @trace_method
    async def create_provider_trace_async(self, actor: PydanticUser, provider_trace_create: ProviderTraceCreate) -> PydanticProviderTrace:
        # When ClickHouse is enabled, skip Postgres writes - data flows via OTEL instrumentation
        if settings.use_clickhouse_for_provider_traces:
            return PydanticProviderTrace(
                id=f"provider_trace-{provider_trace_create.step_id}",
                step_id=provider_trace_create.step_id,
                request_json=provider_trace_create.request_json or {},
                response_json=provider_trace_create.response_json or {},
            )

        async with db_registry.async_session() as session:
            provider_trace = ProviderTraceModel(**provider_trace_create.model_dump())
            provider_trace.organization_id = actor.organization_id
            if provider_trace_create.request_json:
                request_json_str = json_dumps(provider_trace_create.request_json)
                provider_trace.request_json = json_loads(request_json_str)

            if provider_trace_create.response_json:
                response_json_str = json_dumps(provider_trace_create.response_json)
                provider_trace.response_json = json_loads(response_json_str)
            await provider_trace.create_async(session, actor=actor, no_commit=True, no_refresh=True)
            pydantic_provider_trace = provider_trace.to_pydantic()
            return pydantic_provider_trace


@singleton
class NoopTelemetryManager(TelemetryManager):
    """
    Noop implementation of TelemetryManager.
    """

    async def create_provider_trace_async(self, actor: PydanticUser, provider_trace_create: ProviderTraceCreate) -> PydanticProviderTrace:
        return

    async def get_provider_trace_by_step_id_async(self, step_id: str, actor: PydanticUser) -> PydanticStep:
        return

    def create_provider_trace(self, actor: PydanticUser, provider_trace_create: ProviderTraceCreate) -> PydanticProviderTrace:
        return
