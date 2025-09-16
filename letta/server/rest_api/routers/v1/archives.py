from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from letta.orm.errors import NoResultFound
from letta.schemas.archive import Archive as PydanticArchive
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/archives", tags=["archives"])


class ArchiveCreateRequest(BaseModel):
    """Request model for creating an archive.

    Intentionally excludes vector_db_provider. These are derived internally (vector DB provider from env).
    """

    name: str
    description: Optional[str] = None


class ArchiveUpdateRequest(BaseModel):
    """Request model for updating an archive (partial).

    Supports updating only name and description.
    """

    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/", response_model=PydanticArchive, operation_id="create_archive")
async def create_archive(
    archive: ArchiveCreateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new archive.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.archive_manager.create_archive_async(
            name=archive.name,
            description=archive.description,
            actor=actor,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[PydanticArchive], operation_id="list_archives")
async def list_archives(
    before: Optional[str] = Query(
        None,
        description="Archive ID cursor for pagination. Returns archives that come before this archive ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Archive ID cursor for pagination. Returns archives that come after this archive ID in the specified sort order",
    ),
    limit: Optional[int] = Query(50, description="Maximum number of archives to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for archives by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    name: Optional[str] = Query(None, description="Filter by archive name (exact match)"),
    agent_id: Optional[str] = Query(None, description="Only archives attached to this agent ID"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of all archives for the current organization with optional filters and pagination.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        archives = await server.archive_manager.list_archives_async(
            actor=actor,
            before=before,
            after=after,
            limit=limit,
            ascending=(order == "asc"),
            name=name,
            agent_id=agent_id,
        )
        return archives
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{archive_id}", response_model=PydanticArchive, operation_id="modify_archive")
async def modify_archive(
    archive_id: str,
    archive: ArchiveUpdateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Update an existing archive's name and/or description.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        return await server.archive_manager.update_archive_async(
            archive_id=archive_id,
            name=archive.name,
            description=archive.description,
            actor=actor,
        )
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
