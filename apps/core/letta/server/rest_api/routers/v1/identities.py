from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.schemas.identity import Identity, IdentityCreate, IdentityType, IdentityUpdate
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/identities", tags=["identities"])


@router.get("/", tags=["identities"], response_model=List[Identity], operation_id="list_identities")
def list_identities(
    name: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    identity_type: Optional[IdentityType] = Query(None),
    before: Optional[str] = Query(None),
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all identities in the database
    """
    try:
        identities = server.identity_manager.list_identities(
            name=name, project_id=project_id, identity_type=identity_type, before=before, after=after, limit=limit
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return identities


@router.get("/{identifier_key}", tags=["identities"], response_model=Identity, operation_id="get_identity_from_identifier_key")
def retrieve_identity(
    identifier_key: str,
    server: "SyncServer" = Depends(get_letta_server),
):
    try:
        return server.identity_manager.get_identity_by_identifier_key(identifier_key=identifier_key)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", tags=["identities"], response_model=Identity, operation_id="create_identity")
def create_identity(
    identity: IdentityCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    project_slug: Optional[str] = Header(None, alias="project-slug"),  # Only handled by next js middleware
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.identity_manager.create_identity(identity=identity, actor=actor)


@router.put("/", tags=["identities"], response_model=Identity, operation_id="upsert_identity")
def upsert_identity(
    identity: IdentityCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    project_slug: Optional[str] = Header(None, alias="project-slug"),  # Only handled by next js middleware
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.identity_manager.upsert_identity(identity=identity, actor=actor)


@router.patch("/{identifier_key}", tags=["identities"], response_model=Identity, operation_id="update_identity")
def modify_identity(
    identifier_key: str,
    identity: IdentityUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.identity_manager.update_identity_by_key(identifier_key=identifier_key, identity=identity, actor=actor)


@router.delete("/{identifier_key}", tags=["identities"], operation_id="delete_identity")
def delete_identity(
    identifier_key: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete an identity by its identifier key
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    server.identity_manager.delete_identity_by_key(identifier_key=identifier_key, actor=actor)
