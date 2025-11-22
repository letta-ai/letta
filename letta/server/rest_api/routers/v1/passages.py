from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from letta.schemas.enums import TagMatchMode
from letta.schemas.passage import Passage
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/passages", tags=["passages"])


class PassageSearchRequest(BaseModel):
    """Request model for searching passages across archives."""

    query: str = Field(..., description="Text query for semantic search")
    agent_id: Optional[str] = Field(None, description="Filter passages by agent ID")
    archive_id: Optional[str] = Field(None, description="Filter passages by archive ID")
    tags: Optional[List[str]] = Field(None, description="Optional list of tags to filter search results")
    tag_match_mode: Literal["any", "all"] = Field(
        "any", description="How to match tags - 'any' to match passages with any of the tags, 'all' to match only passages with all tags"
    )
    limit: int = Field(50, description="Maximum number of results to return", ge=1, le=100)
    start_date: Optional[datetime] = Field(None, description="Filter results to passages created after this datetime")
    end_date: Optional[datetime] = Field(None, description="Filter results to passages created before this datetime")


class PassageSearchResult(BaseModel):
    """Result from a passage search operation with scoring details."""

    passage: Passage = Field(..., description="The passage object")
    score: float = Field(..., description="Relevance score")
    metadata: dict = Field(default_factory=dict, description="Additional metadata about the search result")


@router.post("/search", response_model=List[PassageSearchResult], operation_id="search_passages")
async def search_passages(
    request: PassageSearchRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Search passages across the organization with optional agent and archive filtering.
    Returns passages with relevance scores.

    This endpoint supports semantic search through passages:
    - If neither agent_id nor archive_id is provided, searches ALL passages in the organization
    - If agent_id is provided, searches passages across all archives attached to that agent
    - If archive_id is provided, searches passages within that specific archive
    - If both are provided, agent_id takes precedence
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Convert tag_match_mode to enum
    tag_mode = TagMatchMode.ANY if request.tag_match_mode == "any" else TagMatchMode.ALL

    # Determine which embedding config to use
    embedding_config = None
    if request.agent_id:
        # Search by agent
        agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=request.agent_id, actor=actor)
        embedding_config = agent_state.embedding_config
    elif request.archive_id:
        # Search by archive_id
        archive = await server.archive_manager.get_archive_by_id_async(archive_id=request.archive_id, actor=actor)
        embedding_config = archive.embedding_config
    else:
        # Search across all passages in the organization
        # Get default embedding config from any agent or use server default
        agent_count = await server.agent_manager.size_async(actor=actor)
        if agent_count > 0:
            # Get first agent to derive embedding config
            agents = await server.agent_manager.list_agents_async(actor=actor, limit=1)
            if agents:
                embedding_config = agents[0].embedding_config

        if not embedding_config:
            # Fall back to server default
            embedding_config = server.default_embedding_config

    # Search passages
    passages_with_metadata = await server.agent_manager.query_agent_passages_async(
        actor=actor,
        agent_id=request.agent_id,  # Can be None for organization-wide search
        archive_id=request.archive_id,  # Can be None if searching by agent or org-wide
        query_text=request.query,
        limit=request.limit,
        embedding_config=embedding_config,
        embed_query=True,
        tags=request.tags,
        tag_match_mode=tag_mode,
        start_date=request.start_date,
        end_date=request.end_date,
    )

    # Convert to PassageSearchResult objects
    results = [
        PassageSearchResult(
            passage=passage,
            score=score,
            metadata=metadata,
        )
        for passage, score, metadata in passages_with_metadata
    ]

    return results
