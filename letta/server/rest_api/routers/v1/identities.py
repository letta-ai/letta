from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound, UniqueConstraintViolationError
from letta.schemas.identity import Identity, IdentityCreate, IdentityProperty, IdentityType, IdentityUpdate, IdentityUpsert
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/identities", tags=["identities"])


@router.get("/", tags=["identities"], response_model=List[Identity], operation_id="list_identities")
def list_identities(
    name: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    identifier_key: Optional[str] = Query(None),
    identity_type: Optional[IdentityType] = Query(None),
    before: Optional[str] = Query(None),
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a list of all identities in the database
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)

        identities = server.identity_manager.list_identities(
            name=name,
            project_id=project_id,
            identifier_key=identifier_key,
            identity_type=identity_type,
            before=before,
            after=after,
            limit=limit,
            actor=actor,
        )
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return identities


@router.get("/{identity_id}", tags=["identities"], response_model=Identity, operation_id="retrieve_identity")
def retrieve_identity(
    identity_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.identity_manager.get_identity(identity_id=identity_id, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", tags=["identities"], response_model=Identity, operation_id="create_identity")
def create_identity(
    identity: IdentityCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: Optional[str] = Header(None, alias="X-Project"),  # Only handled by next js middleware
):
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.identity_manager.create_identity(identity=identity, actor=actor)
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
def upsert_identity(
    identity: IdentityUpsert = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: Optional[str] = Header(None, alias="X-Project"),  # Only handled by next js middleware
):
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.identity_manager.upsert_identity(identity=identity, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.patch("/{identity_id}", tags=["identities"], response_model=Identity, operation_id="update_identity")
def modify_identity(
    identity_id: str,
    identity: IdentityUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.identity_manager.update_identity(identity_id=identity_id, identity=identity, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback

        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{e}")


@router.put("/{identity_id}/properties", tags=["identities"], operation_id="upsert_identity_properties")
def upsert_identity_properties(
    identity_id: str,
    properties: List[IdentityProperty] = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.identity_manager.upsert_identity_properties(identity_id=identity_id, properties=properties, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")


@router.delete("/{identity_id}", tags=["identities"], operation_id="delete_identity")
def delete_identity(
    identity_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete an identity by its identifier key
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        server.identity_manager.delete_identity(identity_id=identity_id, actor=actor)
    except HTTPException:
        raise
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
