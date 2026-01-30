"""PostgreSQL provider trace backend."""

from letta.helpers.json_helpers import json_dumps, json_loads
from letta.orm.provider_trace import ProviderTrace as ProviderTraceModel
from letta.orm.provider_trace_metadata import ProviderTraceMetadata as ProviderTraceMetadataModel
from letta.schemas.provider_trace import ProviderTrace, ProviderTraceMetadata
from letta.schemas.user import User
from letta.server.db import db_registry
from letta.services.provider_trace_backends.base import ProviderTraceBackendClient
from letta.settings import telemetry_settings


class PostgresProviderTraceBackend(ProviderTraceBackendClient):
    """Store provider traces in PostgreSQL."""

    async def create_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | ProviderTraceMetadata:
        if telemetry_settings.provider_trace_pg_metadata_only:
            return await self._create_metadata_only_async(actor, provider_trace)
        return await self._create_full_async(actor, provider_trace)

    async def _create_full_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace:
        """Write full provider trace to provider_traces table."""
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

    async def _create_metadata_only_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTraceMetadata:
        """Write metadata-only trace to provider_trace_metadata table."""
        metadata = ProviderTraceMetadata(
            id=provider_trace.id,
            step_id=provider_trace.step_id,
            agent_id=provider_trace.agent_id,
            agent_tags=provider_trace.agent_tags,
            call_type=provider_trace.call_type,
            run_id=provider_trace.run_id,
            source=provider_trace.source,
            org_id=provider_trace.org_id,
            user_id=provider_trace.user_id,
        )
        metadata_model = ProviderTraceMetadataModel(**metadata.model_dump())
        metadata_model.organization_id = actor.organization_id

        async with db_registry.async_session() as session:
            await metadata_model.create_async(session, actor=actor, no_commit=True, no_refresh=True)
            return metadata_model.to_pydantic()

    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        """Read from provider_traces table. Always reads from full table regardless of write flag."""
        return await self._get_full_by_step_id_async(step_id, actor)

    async def _get_full_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        """Read from provider_traces table."""
        async with db_registry.async_session() as session:
            provider_trace_model = await ProviderTraceModel.read_async(
                db_session=session,
                step_id=step_id,
                actor=actor,
            )
            return provider_trace_model.to_pydantic() if provider_trace_model else None

    async def _get_metadata_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTraceMetadata | None:
        """Read from provider_trace_metadata table."""
        async with db_registry.async_session() as session:
            metadata_model = await ProviderTraceMetadataModel.read_async(
                db_session=session,
                step_id=step_id,
                actor=actor,
            )
            return metadata_model.to_pydantic() if metadata_model else None
