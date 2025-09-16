from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState
from letta.schemas.block import Block, BlockUpdate, CreateBlock
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("/", response_model=List[Block], operation_id="list_blocks")
async def list_blocks(
    # query parameters
    label: Optional[str] = Query(None, description="Labels to include (e.g. human, persona)"),
    templates_only: bool = Query(False, description="Whether to include only templates"),
    name: Optional[str] = Query(None, description="Name of the block"),
    identity_id: Optional[str] = Query(None, description="Search agents by identifier id"),
    identifier_keys: Optional[List[str]] = Query(None, description="Search agents by identifier keys"),
    project_id: Optional[str] = Query(None, description="Search blocks by project id"),
    limit: Optional[int] = Query(50, description="Number of blocks to return"),
    before: Optional[str] = Query(
        None,
        description="Block ID cursor for pagination. Returns blocks that come before this block ID in the specified sort order",
    ),
    after: Optional[str] = Query(
        None,
        description="Block ID cursor for pagination. Returns blocks that come after this block ID in the specified sort order",
    ),
    order: Literal["asc", "desc"] = Query(
        "asc", description="Sort order for blocks by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    label_search: Optional[str] = Query(
        None,
        description=("Search blocks by label. If provided, returns blocks that match this label. This is a full-text search on labels."),
    ),
    description_search: Optional[str] = Query(
        None,
        description=(
            "Search blocks by description. If provided, returns blocks that match this description. "
            "This is a full-text search on block descriptions."
        ),
    ),
    value_search: Optional[str] = Query(
        None,
        description=("Search blocks by value. If provided, returns blocks that match this value."),
    ),
    connected_to_agents_count_gt: Optional[int] = Query(
        None,
        description=(
            "Filter blocks by the number of connected agents. "
            "If provided, returns blocks that have more than this number of connected agents."
        ),
    ),
    connected_to_agents_count_lt: Optional[int] = Query(
        None,
        description=(
            "Filter blocks by the number of connected agents. "
            "If provided, returns blocks that have less than this number of connected agents."
        ),
    ),
    connected_to_agents_count_eq: Optional[List[int]] = Query(
        None,
        description=(
            "Filter blocks by the exact number of connected agents. "
            "If provided, returns blocks that have exactly this number of connected agents."
        ),
    ),
    show_hidden_blocks: bool | None = Query(
        False,
        include_in_schema=False,
        description="If set to True, include blocks marked as hidden in the results.",
    ),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.get_blocks_async(
        actor=actor,
        label=label,
        is_template=templates_only,
        value_search=value_search,
        label_search=label_search,
        description_search=description_search,
        template_name=name,
        identity_id=identity_id,
        identifier_keys=identifier_keys,
        project_id=project_id,
        before=before,
        connected_to_agents_count_gt=connected_to_agents_count_gt,
        connected_to_agents_count_lt=connected_to_agents_count_lt,
        connected_to_agents_count_eq=connected_to_agents_count_eq,
        limit=limit,
        after=after,
        ascending=(order == "asc"),
        show_hidden_blocks=show_hidden_blocks,
    )


@router.get("/count", response_model=int, operation_id="count_blocks")
async def count_blocks(
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Count all blocks created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.size_async(actor=actor)


@router.post("/", response_model=Block, operation_id="create_block")
async def create_block(
    create_block: CreateBlock = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    block = Block(**create_block.model_dump())
    return await server.block_manager.create_or_update_block_async(actor=actor, block=block)


@router.patch("/{block_id}", response_model=Block, operation_id="modify_block")
async def modify_block(
    block_id: str,
    block_update: BlockUpdate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.update_block_async(block_id=block_id, block_update=block_update, actor=actor)


@router.delete("/{block_id}", operation_id="delete_block")
async def delete_block(
    block_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.block_manager.delete_block_async(block_id=block_id, actor=actor)


@router.get("/{block_id}", response_model=Block, operation_id="retrieve_block")
async def retrieve_block(
    block_id: str,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    try:
        block = await server.block_manager.get_block_by_id_async(block_id=block_id, actor=actor)
        if block is None:
            raise HTTPException(status_code=404, detail="Block not found")
        return block
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Block not found")


@router.get("/{block_id}/agents", response_model=List[AgentState], operation_id="list_agents_for_block")
async def list_agents_for_block(
    block_id: str,
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
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    include_relationships: list[str] | None = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
        ),
    ),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieves all agents associated with the specified block.
    Raises a 404 if the block does not exist.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    try:
        agents = await server.block_manager.get_agents_for_block_async(
            block_id=block_id,
            before=before,
            after=after,
            limit=limit,
            ascending=(order == "asc"),
            include_relationships=include_relationships,
            actor=actor,
        )
        return agents
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Block with id={block_id} not found")
