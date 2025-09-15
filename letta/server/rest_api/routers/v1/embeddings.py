from typing import Optional

from fastapi import APIRouter, Depends, Header

from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("/total_storage_size", response_model=float, operation_id="get_total_storage_size")
async def get_embeddings_total_storage_size(
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    storage_unit: Optional[str] = Header("GB", alias="storage_unit"),  # Extract storage unit from header, default to GB
):
    """
    Get the total size of all embeddings in the database for a user in the storage unit given.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.passage_manager.estimate_embeddings_size_async(actor=actor, storage_unit=storage_unit)
