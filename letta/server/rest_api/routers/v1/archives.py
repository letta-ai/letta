from datetime import datetime
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, Field

from letta import AgentState
from letta.errors import LettaInvalidArgumentError
from letta.schemas.agent import AgentRelationships
from letta.schemas.archive import Archive as PydanticArchive, ArchiveBase
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.passage import Passage
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.validators import AgentId, ArchiveId, PassageId

router = APIRouter(prefix="/archives", tags=["archives"])


class ArchiveCreateRequest(BaseModel):
    """Request model for creating an archive.

    Intentionally excludes vector_db_provider. These are derived internally (vector DB provider from env).
    """

    name: str
    embedding_config: Optional[EmbeddingConfig] = Field(
        None, description="Deprecated: Use `embedding` field instead. Embedding configuration for the archive", deprecated=True
    )
    embedding: Optional[str] = Field(None, description="Embedding model handle for the archive")
    description: Optional[str] = None


class ArchiveUpdateRequest(BaseModel):
    """Request model for updating an archive (partial).

    Supports updating only name and description.
    """

    name: Optional[str] = None
    description: Optional[str] = None


class PassageCreateRequest(BaseModel):
    """Request model for creating a passage in an archive."""

    text: str = Field(..., description="The text content of the passage")
    metadata: Optional[Dict] = Field(default=None, description="Optional metadata for the passage")
    tags: Optional[List[str]] = Field(default=None, description="Optional tags for categorizing the passage")


@router.post("/", response_model=PydanticArchive, operation_id="create_archive")
async def create_archive(
    archive: ArchiveCreateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new archive.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if archive.embedding_config is None and archive.embedding is None:
        raise LettaInvalidArgumentError("Either embedding_config or embedding must be provided")

    embedding_config = archive.embedding_config
    if embedding_config is None and archive.embedding is not None:
        handle = f"{archive.embedding.provider}/{archive.embedding.model}"
        embedding_config = await server.get_embedding_config_from_handle_async(
            handle=handle,
            actor=actor,
        )

    return await server.archive_manager.create_archive_async(
        name=archive.name,
        embedding_config=embedding_config,
        description=archive.description,
        actor=actor,
    )


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
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    name: Optional[str] = Query(None, description="Filter by archive name (exact match)"),
    agent_id: Optional[str] = Query(None, description="Only archives attached to this agent ID"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of all archives for the current organization with optional filters and pagination.
    """
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


@router.get("/{archive_id}", response_model=PydanticArchive, operation_id="get_archive_by_id")
async def get_archive_by_id(
    archive_id: ArchiveId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a single archive by its ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.archive_manager.get_archive_by_id_async(
        archive_id=archive_id,
        actor=actor,
    )


@router.patch("/{archive_id}", response_model=PydanticArchive, operation_id="modify_archive")
async def modify_archive(
    archive_id: ArchiveId,
    archive: ArchiveUpdateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Update an existing archive's name and/or description.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.archive_manager.update_archive_async(
        archive_id=archive_id,
        name=archive.name,
        description=archive.description,
        actor=actor,
    )


@router.delete("/{archive_id}", response_model=PydanticArchive, operation_id="delete_archive")
async def delete_archive(
    archive_id: ArchiveId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete an archive by its ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.archive_manager.delete_archive_async(
        archive_id=archive_id,
        actor=actor,
    )


@router.get("/{archive_id}/agents", response_model=List[AgentState], operation_id="list_agents_for_archive")
async def list_agents_for_archive(
    archive_id: ArchiveId,
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
    include: List[AgentRelationships] = Query(
        [],
        description=("Specify which relational fields to include in the response. No relationships are included by default."),
    ),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get a list of agents that have access to an archive with pagination support.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.archive_manager.get_agents_for_archive_async(
        archive_id=archive_id,
        actor=actor,
        before=before,
        after=after,
        limit=limit,
        include=include,
        ascending=(order == "asc"),
    )


@router.post("/{archive_id}/passages", response_model=Passage, operation_id="create_passage_in_archive")
async def create_passage_in_archive(
    archive_id: ArchiveId,
    passage: PassageCreateRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new passage in an archive.

    This adds a passage to the archive and creates embeddings for vector storage.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.archive_manager.create_passage_in_archive_async(
        archive_id=archive_id,
        text=passage.text,
        metadata=passage.metadata,
        tags=passage.tags,
        actor=actor,
    )


@router.delete("/{archive_id}/passages/{passage_id}", status_code=204, operation_id="delete_passage_from_archive")
async def delete_passage_from_archive(
    archive_id: ArchiveId,
    passage_id: PassageId,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete a passage from an archive.

    This permanently removes the passage from both the database and vector storage (if applicable).
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.archive_manager.delete_passage_from_archive_async(
        archive_id=archive_id,
        passage_id=passage_id,
        actor=actor,
    )
    return None
