from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.responses import JSONResponse

from letta.schemas.enums import ProviderType
from letta.schemas.providers import Provider, ProviderBase, ProviderCheck, ProviderCreate, ProviderUpdate
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.validators import ProviderId

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/", response_model=List[Provider], operation_id="list_providers")
async def list_providers(
    before: Optional[str] = Query(
        None,
        description="Provider ID cursor for pagination. Returns providers that come before this provider ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Provider ID cursor for pagination. Returns providers that come after this provider ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of providers to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for providers by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    name: Optional[str] = Query(None, description="Filter providers by name"),
    provider_type: Optional[ProviderType] = Query(None, description="Filter providers by type"),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all custom providers.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    providers = await server.provider_manager.list_providers_async(
        before=before, after=after, limit=limit, actor=actor, name=name, provider_type=provider_type, ascending=(order == "asc")
    )
    return providers


@router.get("/{provider_id}", response_model=Provider, operation_id="retrieve_provider")
async def retrieve_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a provider by ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.provider_manager.get_provider_async(provider_id=provider_id, actor=actor)


@router.post("/", response_model=Provider, operation_id="create_provider")
async def create_provider(
    request: ProviderCreate = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    for field_name in request.model_fields:
        value = getattr(request, field_name, None)
        if isinstance(value, str) and value == "":
            setattr(request, field_name, None)

    # ProviderCreate no longer has provider_category field
    # API-created providers are always BYOK (bring your own key)
    provider = await server.provider_manager.create_provider_async(request, actor=actor, is_byok=True)
    return provider


@router.patch("/{provider_id}", response_model=Provider, operation_id="modify_provider")
async def modify_provider(
    provider_id: ProviderId,
    request: ProviderUpdate = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Update an existing custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.provider_manager.update_provider_async(provider_id=provider_id, provider_update=request, actor=actor)


@router.post("/check", response_model=None, operation_id="check_provider")
async def check_provider(
    request: ProviderCheck = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Verify the API key and additional parameters for a provider.
    """
    if request.base_url and len(request.base_url) == 0:
        # set to null if empty string
        request.base_url = None
    await server.provider_manager.check_provider_api_key(provider_check=request)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": f"Valid api key for provider_type={request.provider_type.value}"}
    )


@router.post("/{provider_id}/check", response_model=None, operation_id="check_existing_provider")
async def check_existing_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Verify the API key and additional parameters for an existing provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    provider = await server.provider_manager.get_provider_async(provider_id=provider_id, actor=actor)

    # Create a ProviderCheck from the existing provider
    provider_check = ProviderCheck(
        provider_type=provider.provider_type,
        api_key=provider.api_key,
        base_url=provider.base_url,
    )

    await server.provider_manager.check_provider_api_key(provider_check=provider_check)
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": f"Valid api key for provider_type={provider.provider_type.value}"}
    )


@router.delete("/{provider_id}", response_model=None, operation_id="delete_provider")
async def delete_provider(
    provider_id: ProviderId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete an existing custom provider.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.provider_manager.delete_provider_by_id_async(provider_id=provider_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Provider id={provider_id} successfully deleted"})
