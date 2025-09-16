from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Depends, Query

from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/tags", tags=["tag", "admin"])


@router.get("/", tags=["admin"], response_model=List[str], operation_id="list_tags")
async def list_tags(
    before: Optional[str] = Query(
        None, description="Tag cursor for pagination. Returns tags that come before this tag in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Tag cursor for pagination. Returns tags that come after this tag in the specified sort order"
    ),
    limit: Optional[int] = Query(50, description="Maximum number of tags to return"),
    order: Literal["asc", "desc"] = Query(
        "asc", description="Sort order for tags. 'asc' for alphabetical order, 'desc' for reverse alphabetical order"
    ),
    order_by: Literal["name"] = Query("name", description="Field to sort by"),
    query_text: Optional[str] = Query(
        None, description="Filter tags by text search. Deprecated, please use name field instead", deprecated=True
    ),
    name: Optional[str] = Query(None, description="Filter tags by name"),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Get the list of all agent tags that have been created.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    text_filter = name or query_text
    tags = await server.agent_manager.list_tags_async(
        actor=actor, before=before, after=after, limit=limit, query_text=text_filter, ascending=(order == "asc")
    )
    return tags
