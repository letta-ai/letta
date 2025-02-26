from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.schemas.providers import Provider, ProviderCreate, ProviderUpdate
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", tags=["providers"], response_model=List[Provider], operation_id="list_providers")
def list_providers(
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all custom providers in the database
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        providers = server.provider_manager.list_providers(after=after, limit=limit, actor=actor)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return providers


@router.post("/", tags=["providers"], response_model=Provider, operation_id="create_provider")
def create_provider(
    request: ProviderCreate = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new custom provider
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    provider = Provider(**request.model_dump())
    provider = server.provider_manager.create_provider(provider, actor=actor)
    return provider


@router.patch("/", tags=["providers"], response_model=Provider, operation_id="modify_provider")
def modify_provider(
    request: ProviderUpdate = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Update an existing custom provider
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    provider = server.provider_manager.update_provider(request, actor=actor)
    return provider


@router.delete("/", tags=["providers"], response_model=None, operation_id="delete_provider")
def delete_provider(
    provider_id: str = Query(..., description="The provider_id key to be deleted."),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete an existing custom provider
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        server.provider_manager.delete_provider_by_id(provider_id=provider_id, actor=actor)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
