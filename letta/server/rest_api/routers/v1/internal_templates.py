from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel

from letta.schemas.agent import AgentState, InternalTemplateAgentCreate
from letta.schemas.block import Block, InternalTemplateBlockCreate
from letta.schemas.group import Group, InternalTemplateGroupCreate
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/_internal_templates", tags=["_internal_templates"])


@router.post("/groups", response_model=Group, operation_id="create_internal_template_group")
async def create_group(
    group: InternalTemplateGroupCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.group_manager.create_group_async(group, actor=actor)


@router.post("/agents", response_model=AgentState, operation_id="create_internal_template_agent")
async def create_agent(
    agent: InternalTemplateAgentCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new agent with template-related fields.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    # Default to ignore_invalid_tools=True for template-based agent creation
    return await server.agent_manager.create_agent_async(agent, actor=actor, ignore_invalid_tools=True)


@router.post("/blocks", response_model=Block, operation_id="create_internal_template_block")
async def create_block(
    block: InternalTemplateBlockCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create a new block with template-related fields.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    block_obj = Block(**block.model_dump())
    return await server.block_manager.create_or_update_block_async(block_obj, actor=actor)


@router.post("/blocks/batch", response_model=List[Block], operation_id="create_internal_template_blocks_batch")
async def create_blocks_batch(
    blocks: List[InternalTemplateBlockCreate] = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Create multiple blocks with template-related fields.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    created_blocks = []
    for block in blocks:
        block_obj = Block(**block.model_dump())
        created_block = await server.block_manager.create_or_update_block_async(block_obj, actor=actor)
        created_blocks.append(created_block)
    return created_blocks


class DeploymentEntity(BaseModel):
    """A deployment entity."""

    id: str
    type: str
    name: Optional[str] = None
    description: Optional[str] = None
    entity_id: Optional[str] = None
    project_id: Optional[str] = None


class ListDeploymentEntitiesResponse(BaseModel):
    """Response model for listing deployment entities."""

    entities: List[DeploymentEntity] = []
    total_count: int
    deployment_id: str
    message: str


class DeleteDeploymentResponse(BaseModel):
    """Response model for delete deployment operation."""

    deleted_blocks: List[str] = []
    deleted_agents: List[str] = []
    deleted_groups: List[str] = []
    message: str


@router.get("/deployment/{deployment_id}", response_model=ListDeploymentEntitiesResponse, operation_id="list_deployment_entities")
async def list_deployment_entities(
    deployment_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    entity_types: Optional[List[str]] = Query(None, description="Filter by entity types (block, agent, group)"),
):
    """
    List all entities (blocks, agents, groups) with the specified deployment_id.
    Optionally filter by entity types.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    entities = []

    # Parse entity_types filter - support both array and comma-separated string
    allowed_types = {"block", "agent", "group"}
    if entity_types is None:
        # If no filter specified, include all types
        types_to_include = allowed_types
    else:
        # Handle comma-separated strings in a single item
        if len(entity_types) == 1 and "," in entity_types[0]:
            entity_types = [t.strip() for t in entity_types[0].split(",")]

        # Validate and filter types
        types_to_include = {t.lower() for t in entity_types if t.lower() in allowed_types}
        if not types_to_include:
            types_to_include = allowed_types  # Default to all if invalid types provided

    # Query blocks if requested
    if "block" in types_to_include:
        from sqlalchemy import select

        from letta.orm.block import Block as BlockModel
        from letta.server.db import db_registry

        async with db_registry.async_session() as session:
            block_query = select(BlockModel).where(
                BlockModel.deployment_id == deployment_id, BlockModel.organization_id == actor.organization_id
            )
            result = await session.execute(block_query)
            blocks = result.scalars().all()

            for block in blocks:
                entities.append(
                    DeploymentEntity(
                        id=block.id,
                        type="block",
                        name=getattr(block, "template_name", None) or getattr(block, "label", None),
                        description=block.description,
                        entity_id=getattr(block, "entity_id", None),
                        project_id=getattr(block, "project_id", None),
                    )
                )

    # Query agents if requested
    if "agent" in types_to_include:
        from letta.orm.agent import Agent as AgentModel

        async with db_registry.async_session() as session:
            agent_query = select(AgentModel).where(
                AgentModel.deployment_id == deployment_id, AgentModel.organization_id == actor.organization_id
            )
            result = await session.execute(agent_query)
            agents = result.scalars().all()

            for agent in agents:
                entities.append(
                    DeploymentEntity(
                        id=agent.id,
                        type="agent",
                        name=agent.name,
                        description=agent.description,
                        entity_id=getattr(agent, "entity_id", None),
                        project_id=getattr(agent, "project_id", None),
                    )
                )

    # Query groups if requested
    if "group" in types_to_include:
        from letta.orm.group import Group as GroupModel

        async with db_registry.async_session() as session:
            group_query = select(GroupModel).where(
                GroupModel.deployment_id == deployment_id, GroupModel.organization_id == actor.organization_id
            )
            result = await session.execute(group_query)
            groups = result.scalars().all()

            for group in groups:
                entities.append(
                    DeploymentEntity(
                        id=group.id,
                        type="group",
                        name=None,  # Groups don't have a name field
                        description=group.description,
                        entity_id=getattr(group, "entity_id", None),
                        project_id=getattr(group, "project_id", None),
                    )
                )

    message = f"Found {len(entities)} entities for deployment {deployment_id}"
    if entity_types:
        message += f" (filtered by types: {', '.join(types_to_include)})"

    return ListDeploymentEntitiesResponse(entities=entities, total_count=len(entities), deployment_id=deployment_id, message=message)


@router.delete("/deployment/{deployment_id}", response_model=DeleteDeploymentResponse, operation_id="delete_deployment")
async def delete_deployment(
    deployment_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete all entities (blocks, agents, groups) with the specified deployment_id.
    Deletion order: blocks -> agents -> groups to maintain referential integrity.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    deleted_blocks = []
    deleted_agents = []
    deleted_groups = []

    # First delete blocks
    from sqlalchemy import select

    from letta.orm.block import Block as BlockModel
    from letta.server.db import db_registry

    async with db_registry.async_session() as session:
        # Get all blocks with the deployment_id
        block_query = select(BlockModel).where(
            BlockModel.deployment_id == deployment_id, BlockModel.organization_id == actor.organization_id
        )
        result = await session.execute(block_query)
        blocks = result.scalars().all()

        for block in blocks:
            try:
                await server.block_manager.delete_block_async(block.id, actor)
                deleted_blocks.append(block.id)
            except Exception as e:
                # Continue deleting other blocks even if one fails
                print(f"Failed to delete block {block.id}: {e}")

    # Then delete agents
    from letta.orm.agent import Agent as AgentModel

    async with db_registry.async_session() as session:
        # Get all agents with the deployment_id
        agent_query = select(AgentModel).where(
            AgentModel.deployment_id == deployment_id, AgentModel.organization_id == actor.organization_id
        )
        result = await session.execute(agent_query)
        agents = result.scalars().all()

        for agent in agents:
            try:
                await server.agent_manager.delete_agent_async(agent.id, actor)
                deleted_agents.append(agent.id)
            except Exception as e:
                # Continue deleting other agents even if one fails
                print(f"Failed to delete agent {agent.id}: {e}")

    # Finally delete groups
    from letta.orm.group import Group as GroupModel

    async with db_registry.async_session() as session:
        # Get all groups with the deployment_id
        group_query = select(GroupModel).where(
            GroupModel.deployment_id == deployment_id, GroupModel.organization_id == actor.organization_id
        )
        result = await session.execute(group_query)
        groups = result.scalars().all()

        for group in groups:
            try:
                await server.group_manager.delete_group_async(group.id, actor)
                deleted_groups.append(group.id)
            except Exception as e:
                # Continue deleting other groups even if one fails
                print(f"Failed to delete group {group.id}: {e}")

    total_deleted = len(deleted_blocks) + len(deleted_agents) + len(deleted_groups)
    message = f"Successfully deleted {total_deleted} entities from deployment {deployment_id}"

    return DeleteDeploymentResponse(
        deleted_blocks=deleted_blocks, deleted_agents=deleted_agents, deleted_groups=deleted_groups, message=message
    )
