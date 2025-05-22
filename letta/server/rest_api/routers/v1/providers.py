from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse

from letta.errors import LLMAuthenticationError
from letta.orm.errors import NoResultFound
from letta.schemas.enums import ProviderType
from letta.schemas.providers import Provider, ProviderCheck, ProviderCreate, ProviderUpdate
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", response_model=List[Provider], operation_id="list_providers")
def list_providers(
    name: Optional[str] = Query(None),
    provider_type: Optional[ProviderType] = Query(None),
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
        providers = server.provider_manager.list_providers(after=after, limit=limit, actor=actor, name=name, provider_type=provider_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return providers


@router.post("/", response_model=Provider, operation_id="create_provider")
def create_provider(
    request: ProviderCreate = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new custom provider
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    provider = ProviderCreate(**request.model_dump())

    provider = server.provider_manager.create_provider(provider, actor=actor)
    return provider


@router.patch("/{provider_id}", response_model=Provider, operation_id="modify_provider")
def modify_provider(
    provider_id: str,
    request: ProviderUpdate = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Update an existing custom provider
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.provider_manager.update_provider(provider_id=provider_id, provider_update=request, actor=actor)


@router.get("/check", response_model=None, operation_id="check_provider")
def check_provider(
    provider_type: ProviderType = Query(...),
    api_key: str = Header(..., alias="x-api-key"),
    server: "SyncServer" = Depends(get_letta_server),
):
    try:
        provider_check = ProviderCheck(provider_type=provider_type, api_key=api_key)
        server.provider_manager.check_provider_api_key(provider_check=provider_check)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Valid api key for provider_type={provider_type.value}"})
    except LLMAuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"{e.message}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"{e}")


@router.delete("/{provider_id}", response_model=None, operation_id="delete_provider")
def delete_provider(
    provider_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete an existing custom provider
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        server.provider_manager.delete_provider_by_id(provider_id=provider_id, actor=actor)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Provider id={provider_id} successfully deleted"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Provider provider_id={provider_id} not found for user_id={actor.id}.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
