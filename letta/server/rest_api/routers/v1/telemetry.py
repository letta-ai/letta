from typing import Optional

from fastapi import APIRouter, Depends, Header

from letta.schemas.provider_trace import ProviderTrace
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.settings import settings

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/{step_id}", response_model=Optional[ProviderTrace], operation_id="retrieve_provider_trace")
async def retrieve_provider_trace_by_step_id(
    step_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    provider_trace = None
    if settings.track_provider_trace:
        try:
            provider_trace = await server.telemetry_manager.get_provider_trace_by_step_id_async(
                step_id=step_id, actor=await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
            )
        except:
            pass

    return provider_trace
