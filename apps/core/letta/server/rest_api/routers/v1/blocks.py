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
    limit: Optional[int] = Query(50, description="Number of blocks to return"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.block_manager.get_blocks_async(
        actor=actor,
        label=label,
        is_template=templates_only,
        template_name=name,
        identity_id=identity_id,
        identifier_keys=identifier_keys,
        limit=limit,
    )


@router.get("/count", response_model=int, operation_id="count_blocks")
def count_blocks(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Count all blocks created by a user.
    """
    return server.block_manager.size(actor=server.user_manager.get_user_or_default(user_id=actor_id))


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


@router.delete("/{block_id}", response_model=Block, operation_id="delete_block")
async def delete_block(
    block_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.block_manager.delete_block_async(block_id=block_id, actor=actor)


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
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Retrieves all agents associated with the specified block.
    Raises a 404 if the block does not exist.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    try:
        agents = await server.block_manager.get_agents_for_block_async(block_id=block_id, actor=actor)
        return agents
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Block with id={block_id} not found")
