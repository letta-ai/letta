from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Depends, Header, Query

from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/tags", tags=["tag", "admin"])


@router.get("/", tags=["admin"], response_model=List[str], operation_id="list_tags")
async def list_tags(
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    server: "SyncServer" = Depends(get_letta_server),
    query_text: Optional[str] = Query(None),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get a list of all tags in the database
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    tags = await server.agent_manager.list_tags_async(actor=actor, after=after, limit=limit, query_text=query_text)
    return tags
