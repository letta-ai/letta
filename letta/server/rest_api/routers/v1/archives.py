from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from letta.schemas.archive import Archive as PydanticArchive
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/archives", tags=["archives"])


class ArchiveCreateRequest(BaseModel):
    """Request model for creating an archive.

    Intentionally excludes organization_id and vector_db_provider. These are
    derived internally (organization from the actor; vector DB provider from env).
    """

    name: str
    description: Optional[str] = None


@router.post("/", response_model=PydanticArchive, operation_id="create_archive")
async def create_archive(
    archive: ArchiveCreateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new archive.

    The vector DB provider and organization are determined internally and cannot
    be set by the client.
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
