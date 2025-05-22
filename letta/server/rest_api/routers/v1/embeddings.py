from typing import Optional

from fastapi import APIRouter, Depends, Header

from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("/total_storage_size", response_model=float, operation_id="get_total_storage_size")
def get_embeddings_total_storage_size(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    storage_unit: Optional[str] = Header("GB", alias="storage_unit"),  # Extract storage unit from header, default to GB
):
    """
    Get the total size of all embeddings in the database for a user in the storage unit given.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.passage_manager.estimate_embeddings_size(actor=actor, storage_unit=storage_unit)
