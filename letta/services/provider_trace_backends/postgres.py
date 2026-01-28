"""PostgreSQL provider trace backend."""

from letta.helpers.json_helpers import json_dumps, json_loads
from letta.orm.provider_trace import ProviderTrace as ProviderTraceModel
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.server.db import db_registry
from letta.services.provider_trace_backends.base import ProviderTraceBackendClient


class PostgresProviderTraceBackend(ProviderTraceBackendClient):
    """Store provider traces in PostgreSQL."""

    async def create_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        async with db_registry.async_session() as session:
            provider_trace_model = ProviderTraceModel(**provider_trace.model_dump())
            provider_trace_model.organization_id = actor.organization_id

            if provider_trace.request_json:
                request_json_str = json_dumps(provider_trace.request_json)
                provider_trace_model.request_json = json_loads(request_json_str)

            if provider_trace.response_json:
                response_json_str = json_dumps(provider_trace.response_json)
                provider_trace_model.response_json = json_loads(response_json_str)

            await provider_trace_model.create_async(session, actor=actor, no_commit=True, no_refresh=True)
            return provider_trace_model.to_pydantic()

    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        async with db_registry.async_session() as session:
            provider_trace_model = await ProviderTraceModel.read_async(
                db_session=session,
                step_id=step_id,
                actor=actor,
            )
            return provider_trace_model.to_pydantic() if provider_trace_model else None
