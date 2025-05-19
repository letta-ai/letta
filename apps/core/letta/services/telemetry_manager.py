from sqlalchemy import select

from letta.orm.provider_trace import ProviderTrace as ProviderTraceModel
from letta.schemas.provider_trace import ProviderTrace as PydanticProviderTrace
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.schemas.step import Step as PydanticStep
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.helpers.noop_helper import singleton
from letta.utils import enforce_types


class TelemetryManager:
    @enforce_types
    async def get_provider_trace_by_step_id_async(
        self,
        step_id: str,
        actor: PydanticUser,
    ) -> PydanticProviderTrace:
        async with db_registry.async_session() as session:
            provider_trace = await ProviderTraceModel.read_async(db_session=session, step_id=step_id, actor=actor)
            return provider_trace.to_pydantic()

    @enforce_types
    async def create_provider_trace_async(self, actor: PydanticUser, provider_trace_create: ProviderTraceCreate) -> PydanticProviderTrace:
        async with db_registry.async_session() as session:
            provider_trace = ProviderTraceModel(**provider_trace_create.model_dump())
            await provider_trace.create_async(session, actor=actor)
            return provider_trace.to_pydantic()

    @enforce_types
    def create_provider_trace(self, actor: PydanticUser, provider_trace_create: ProviderTraceCreate) -> PydanticProviderTrace:
        with db_registry.session() as session:
            provider_trace = ProviderTraceModel(**provider_trace_create.model_dump())
            provider_trace.create(session, actor=actor)
            return provider_trace.to_pydantic()


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
