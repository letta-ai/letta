from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from letta.schemas.identity import Identity, IdentityType
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
