from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState
from letta.schemas.block import Block, BlockUpdate, CreateBlock
from letta.server.rest_api.utils import get_letta_server
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
        description="Cursor for pagination. If provided, returns blocks before this cursor.",
    ),
    after: Optional[str] = Query(
        None,
        description="Cursor for pagination. If provided, returns blocks after this cursor.",
    ),
    label_search: Optional[str] = Query(
        None,
        description=("Search blocks by label. If provided, returns blocks that match this label. " "This is a full-text search on labels."),
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
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
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
    )


@router.get("/count", response_model=int, operation_id="count_blocks")
async def count_blocks(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Count all blocks created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.block_manager.size_async(actor=actor)


@router.post("/", response_model=Block, operation_id="create_block")
async def create_block(
    create_block: CreateBlock = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    block = Block(**create_block.model_dump())
    return await server.block_manager.create_or_update_block_async(actor=actor, block=block)


@router.patch("/{block_id}", response_model=Block, operation_id="modify_block")
async def modify_block(
    block_id: str,
    block_update: BlockUpdate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.block_manager.update_block_async(block_id=block_id, block_update=block_update, actor=actor)


@router.delete("/{block_id}", operation_id="delete_block")
async def delete_block(
    block_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.block_manager.delete_block_async(block_id=block_id, actor=actor)


@router.get("/{block_id}", response_model=Block, operation_id="retrieve_block")
async def retrieve_block(
    block_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
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
    include_relationships: list[str] | None = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
        ),
    ),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Retrieves all agents associated with the specified block.
    Raises a 404 if the block does not exist.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    try:
        agents = await server.block_manager.get_agents_for_block_async(
            block_id=block_id, include_relationships=include_relationships, actor=actor
        )
        return agents
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Block with id={block_id} not found")
