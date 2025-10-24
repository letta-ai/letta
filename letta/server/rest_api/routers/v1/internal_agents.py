from fastapi import APIRouter, Body, Depends

from letta.schemas.block import Block, BlockUpdate
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.validators import AgentId

router = APIRouter(prefix="/_internal_agents", tags=["_internal_agents"])


@router.patch("/{agent_id}/core-memory/blocks/{block_label}", response_model=Block, operation_id="modify_internal_core_memory_block")
async def modify_block_for_agent(
    block_label: str,
    agent_id: AgentId,
    block_update: BlockUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Updates a core memory block of an agent.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    block = await server.agent_manager.modify_block_by_label_async(
        agent_id=agent_id, block_label=block_label, block_update=block_update, actor=actor
    )

    # This should also trigger a system prompt change in the agent
    await server.agent_manager.rebuild_system_prompt_async(agent_id=agent_id, actor=actor, force=True, update_timestamp=False)

    return block
