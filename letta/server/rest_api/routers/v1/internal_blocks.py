from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query

from letta.schemas.agent import AgentState
from letta.schemas.block import Block, CreateBlock
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.utils import is_1_0_sdk_version
from letta.validators import BlockId

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/_internal_blocks", tags=["_internal_blocks"])


@router.get("/", response_model=List[Block], operation_id="list_internal_blocks")
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


@router.post("/", response_model=Block, operation_id="create_internal_block")
async def create_block(
    create_block: CreateBlock = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    block = Block(**create_block.model_dump())
    return await server.block_manager.create_or_update_block_async(actor=actor, block=block)


@router.delete("/{block_id}", operation_id="delete_internal_block")
async def delete_block(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.block_manager.delete_block_async(block_id=block_id, actor=actor)


@router.get("/{block_id}/agents", response_model=List[AgentState], operation_id="list_agents_for_internal_block")
async def list_agents_for_block(
    block_id: BlockId,
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
            "This is a legacy parameter, and no longer supported after 1.0.0 SDK versions."
        ),
    ),
    include: List[str] = Query(
        [],
        description=("Specify which relational fields to include in the response. No relationships are included by default."),
    ),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Retrieves all agents associated with the specified block.
    Raises a 404 if the block does not exist.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    if include_relationships is None and is_1_0_sdk_version(headers):
        include_relationships = []  # don't default include all if using new SDK version
    agents = await server.block_manager.get_agents_for_block_async(
        block_id=block_id,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
        include_relationships=include_relationships,
        include=include,
        actor=actor,
    )
    return agents
