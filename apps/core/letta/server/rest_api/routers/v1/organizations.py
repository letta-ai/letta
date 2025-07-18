from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from letta.schemas.organization import Organization, OrganizationCreate, OrganizationUpdate
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/orgs", tags=["organization", "admin"])


@router.get("/", tags=["admin"], response_model=List[Organization], operation_id="list_orgs")
async def get_all_orgs(
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get a list of all orgs in the database
    """
    try:
        orgs = await server.organization_manager.list_organizations_async(after=after, limit=limit)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return orgs


@router.post("/", tags=["admin"], response_model=Organization, operation_id="create_organization")
async def create_org(
    request: OrganizationCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Create a new org in the database
    """
    org = Organization(**request.model_dump())
    org = await server.organization_manager.create_organization_async(pydantic_org=org)
    return org


@router.delete("/", tags=["admin"], response_model=Organization, operation_id="delete_organization_by_id")
async def delete_org(
    org_id: str = Query(..., description="The org_id key to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
):
    # TODO make a soft deletion, instead of a hard deletion
    try:
        org = await server.organization_manager.get_organization_by_id_async(org_id=org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization does not exist")
        await server.organization_manager.delete_organization_by_id_async(org_id=org_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return org


@router.patch("/", tags=["admin"], response_model=Organization, operation_id="update_organization")
async def update_org(
    org_id: str = Query(..., description="The org_id key to be updated."),
    request: OrganizationUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
):
    try:
        org = await server.organization_manager.get_organization_by_id_async(org_id=org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization does not exist")
        org = await server.organization_manager.update_organization_async(org_id=org_id, name=request.name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}")
    return org
