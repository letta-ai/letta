from typing import TYPE_CHECKING, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentRelationships, AgentState
from letta.schemas.block import BaseBlock, Block, BlockResponse, BlockUpdate, CreateBlock
from letta.schemas.block_edit_proposal import BlockEditProposal, BlockProposalStatus
from letta.schemas.block_history import BlockHistoryEntry
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.utils import is_1_0_sdk_version
from letta.validators import (
    BlockDescriptionSearchQuery,
    BlockId,
    BlockLabelQuery,
    BlockLabelSearchQuery,
    BlockNameQuery,
    BlockValueSearchQuery,
    IdentityIdQuery,
    BlockProposalId,
)

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("/", response_model=List[BlockResponse], operation_id="list_blocks")
async def list_blocks(
    # query parameters
    label: BlockLabelQuery = None,
    templates_only: bool = Query(False, description="Whether to include only templates"),
    name: BlockNameQuery = None,
    identity_id: IdentityIdQuery = None,
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
    label_search: BlockLabelSearchQuery = None,
    description_search: BlockDescriptionSearchQuery = None,
    value_search: BlockValueSearchQuery = None,
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


@router.post("/", response_model=BlockResponse, operation_id="create_block")
async def create_block(
    create_block: CreateBlock = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    block = Block(**create_block.model_dump())
    return await server.block_manager.create_or_update_block_async(actor=actor, block=block)


@router.patch("/{block_id}", response_model=BlockResponse, operation_id="modify_block")
async def modify_block(
    block_id: BlockId,
    block_update: BlockUpdate = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.update_block_async(block_id=block_id, block_update=block_update, actor=actor)


@router.delete("/{block_id}", operation_id="delete_block")
async def delete_block(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.block_manager.delete_block_async(block_id=block_id, actor=actor)


@router.get("/{block_id}", response_model=BlockResponse, operation_id="retrieve_block")
async def retrieve_block(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    block = await server.block_manager.get_block_by_id_async(block_id=block_id, actor=actor)
    if block is None:
        raise NoResultFound(f"Block with id '{block_id}' not found")
    return block


@router.get("/{block_id}/agents", response_model=List[AgentState], operation_id="list_agents_for_block")
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
        deprecated=True,
    ),
    include: List[AgentRelationships] = Query(
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


@router.patch("/{block_id}/identities/attach/{identity_id}", response_model=BlockResponse, operation_id="attach_identity_to_block")
async def attach_identity_to_block(
    identity_id: str,
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Attach an identity to a block.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.identity_manager.attach_block_async(
        identity_id=identity_id,
        block_id=block_id,
        actor=actor,
    )
    return await server.block_manager.get_block_by_id_async(block_id=block_id, actor=actor)


@router.patch("/{block_id}/identities/detach/{identity_id}", response_model=BlockResponse, operation_id="detach_identity_from_block")
async def detach_identity_from_block(
    identity_id: str,
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Detach an identity from a block.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await server.identity_manager.detach_block_async(
        identity_id=identity_id,
        block_id=block_id,
        actor=actor,
    )
    return await server.block_manager.get_block_by_id_async(block_id=block_id, actor=actor)


@router.get("/{block_id}/history", response_model=List[BlockHistoryEntry], operation_id="list_block_history")
async def list_block_history(
    block_id: BlockId,
    limit: Optional[int] = Query(50, description="Maximum number of history entries to return"),
    order: Literal["asc", "desc"] = Query(
        "asc", description="Sort order for history by sequence number. 'asc' for oldest first, 'desc' for newest first"
    ),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.list_block_history_async(
        block_id=block_id,
        actor=actor,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.post("/{block_id}/history/checkpoint", response_model=BlockResponse, operation_id="checkpoint_block")
async def checkpoint_block(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.checkpoint_block_async(block_id=block_id, actor=actor)


@router.post("/{block_id}/history/undo", response_model=BlockResponse, operation_id="undo_block_checkpoint")
async def undo_block_checkpoint(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.undo_checkpoint_block(block_id=block_id, actor=actor)


@router.post("/{block_id}/history/redo", response_model=BlockResponse, operation_id="redo_block_checkpoint")
async def redo_block_checkpoint(
    block_id: BlockId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_manager.redo_checkpoint_block(block_id=block_id, actor=actor)


@router.get("/{block_id}/proposals", response_model=List[BlockEditProposal], operation_id="list_block_edit_proposals")
async def list_block_edit_proposals(
    block_id: BlockId,
    status: Optional[BlockProposalStatus] = Query(None, description="Filter proposals by status"),
    limit: Optional[int] = Query(50, description="Maximum number of proposals to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for proposals by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_edit_proposal_manager.list_proposals_async(
        block_id=block_id,
        actor=actor,
        status=status,
        limit=limit,
        ascending=(order == "asc"),
    )


@router.get("/{block_id}/proposals/{proposal_id}", response_model=BlockEditProposal, operation_id="retrieve_block_edit_proposal")
async def retrieve_block_edit_proposal(
    block_id: BlockId,
    proposal_id: BlockProposalId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    proposal = await server.block_edit_proposal_manager.retrieve_proposal_async(proposal_id=proposal_id, actor=actor)
    if proposal.block_id != block_id:
        raise HTTPException(status_code=404, detail=f"Proposal '{proposal_id}' not found for block '{block_id}'")
    return proposal


@router.post("/{block_id}/proposals/{proposal_id}/approve", response_model=BlockEditProposal, operation_id="approve_block_edit_proposal")
async def approve_block_edit_proposal(
    block_id: BlockId,
    proposal_id: BlockProposalId,
    force: bool = Query(False, description="Apply the proposal even if the block changed since it was created."),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.block_edit_proposal_manager.approve_proposal_async(
        proposal_id=proposal_id,
        block_id=block_id,
        actor=actor,
        force=force,
    )


@router.post("/{block_id}/proposals/{proposal_id}/reject", response_model=BlockEditProposal, operation_id="reject_block_edit_proposal")
async def reject_block_edit_proposal(
    block_id: BlockId,
    proposal_id: BlockProposalId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    proposal = await server.block_edit_proposal_manager.retrieve_proposal_async(proposal_id=proposal_id, actor=actor)
    if proposal.block_id != block_id:
        raise HTTPException(status_code=404, detail=f"Proposal '{proposal_id}' not found for block '{block_id}'")
    return await server.block_edit_proposal_manager.reject_proposal_async(proposal_id=proposal_id, actor=actor)
