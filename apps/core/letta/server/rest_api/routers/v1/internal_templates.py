from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException

from letta.schemas.agent import AgentState, InternalTemplateAgentCreate
from letta.schemas.block import Block, InternalTemplateBlockCreate
from letta.schemas.group import Group, InternalTemplateGroupCreate
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/_internal_templates", tags=["_internal_templates"])


@router.post("/groups", response_model=Group, operation_id="create_internal_template_group")
async def create_group(
    group: InternalTemplateGroupCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.group_manager.create_group_async(group, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents", response_model=AgentState, operation_id="create_internal_template_agent")
async def create_agent(
    agent: InternalTemplateAgentCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create a new agent with template-related fields.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.agent_manager.create_agent_async(agent, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blocks", response_model=Block, operation_id="create_internal_template_block")
async def create_block(
    block: InternalTemplateBlockCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create a new block with template-related fields.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.block_manager.create_or_update_block_async(block, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
