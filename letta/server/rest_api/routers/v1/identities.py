from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound, UniqueConstraintViolationError
from letta.schemas.agent import AgentState
from letta.schemas.block import Block
from letta.schemas.identity import Identity, IdentityCreate, IdentityProperty, IdentityType, IdentityUpdate, IdentityUpsert
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/identities", tags=["identities"])


@router.get("/", tags=["identities"], response_model=List[Identity], operation_id="list_identities")
async def list_identities(
    name: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    identifier_key: Optional[str] = Query(None),
    identity_type: Optional[IdentityType] = Query(None),
    before: Optional[str] = Query(
        None,
        description="Identity ID cursor for pagination. Returns identities that come before this identity ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Identity ID cursor for pagination. Returns identities that come after this identity ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of identities to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for identities by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of all identities in the database
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

        identities = await server.identity_manager.list_identities_async(
            name=name,
            project_id=project_id,
            identifier_key=identifier_key,
            identity_type=identity_type,
            before=before,
            after=after,
            limit=limit,
            ascending=(order == "asc"),
            actor=actor,
        )
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return identities


@router.get("/count", tags=["identities"], response_model=int, operation_id="count_identities")
async def count_identities(
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get count of all identities for a user
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.size_async(actor=actor)
    except NoResultFound:
        return 0
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.get("/{identity_id}", tags=["identities"], response_model=Identity, operation_id="retrieve_identity")
async def retrieve_identity(
    identity_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.get_identity_async(identity_id=identity_id, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", tags=["identities"], response_model=Identity, operation_id="create_identity")
async def create_identity(
    identity: IdentityCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="The project slug to associate with the identity (cloud only)."
    ),  # Only handled by next js middleware
):
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.create_identity_async(identity=identity, actor=actor)
    except HTTPException:
        raise
    except UniqueConstraintViolationError:
        if identity.project_id:
            raise HTTPException(
                status_code=409,
                detail=f"An identity with identifier key {identity.identifier_key} already exists for project {identity.project_id}",
            )
        else:
            raise HTTPException(status_code=409, detail=f"An identity with identifier key {identity.identifier_key} already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.put("/", tags=["identities"], response_model=Identity, operation_id="upsert_identity")
async def upsert_identity(
    identity: IdentityUpsert = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="The project slug to associate with the identity (cloud only)."
    ),  # Only handled by next js middleware
):
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.upsert_identity_async(identity=identity, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.patch("/{identity_id}", tags=["identities"], response_model=Identity, operation_id="update_identity")
async def modify_identity(
    identity_id: str,
    identity: IdentityUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.update_identity_async(identity_id=identity_id, identity=identity, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.put("/{identity_id}/properties", tags=["identities"], operation_id="upsert_identity_properties")
async def upsert_identity_properties(
    identity_id: str,
    properties: List[IdentityProperty] = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.upsert_identity_properties_async(identity_id=identity_id, properties=properties, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.delete("/{identity_id}", tags=["identities"], operation_id="delete_identity")
async def delete_identity(
    identity_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete an identity by its identifier key
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        await server.identity_manager.delete_identity_async(identity_id=identity_id, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.get("/{identity_id}/agents", response_model=List[AgentState], operation_id="list_agents_for_identity")
async def list_agents_for_identity(
    identity_id: str,
    before: Optional[str] = Query(
        None,
        description="Agent ID cursor for pagination. Returns agents that come before this agent ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Agent ID cursor for pagination. Returns agents that come after this agent ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of agents to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get all agents associated with the specified identity.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.list_agents_for_identity_async(
            identity_id=identity_id,
            before=before,
            after=after,
            limit=limit,
            ascending=(order == "asc"),
            actor=actor,
        )
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=f"Identity with id={identity_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.get("/{identity_id}/blocks", response_model=List[Block], operation_id="list_blocks_for_identity")
async def list_blocks_for_identity(
    identity_id: str,
    before: Optional[str] = Query(
        None,
        description="Block ID cursor for pagination. Returns blocks that come before this block ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Block ID cursor for pagination. Returns blocks that come after this block ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of blocks to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for blocks by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get all blocks associated with the specified identity.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.identity_manager.list_blocks_for_identity_async(
            identity_id=identity_id,
            before=before,
            after=after,
            limit=limit,
            ascending=(order == "asc"),
            actor=actor,
        )
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=f"Identity with id={identity_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
