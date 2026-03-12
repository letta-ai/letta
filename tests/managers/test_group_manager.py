import pytest

# Import shared fixtures and constants from conftest
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.server.server import SyncServer


@pytest.mark.asyncio
async def test_create_internal_template_objects(server: SyncServer, default_user):
    """Test creating agents, groups, and blocks with template-related fields."""
    from letta.schemas.agent import InternalTemplateAgentCreate
    from letta.schemas.block import Block, InternalTemplateBlockCreate
    from letta.schemas.group import InternalTemplateGroupCreate, RoundRobinManager

    base_template_id = "base_123"
    template_id = "template_456"
    deployment_id = "deploy_789"
    entity_id = "entity_012"

    # Create agent with template fields (use sarah_agent as base, then create new one)
    agent = await server.agent_manager.create_agent_async(
        InternalTemplateAgentCreate(
            name="template-agent",
            agent_type="memgpt_v2_agent",
            base_template_id=base_template_id,
            template_id=template_id,
            deployment_id=deployment_id,
            entity_id=entity_id,
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    # Verify agent template fields
    assert agent.base_template_id == base_template_id
    assert agent.template_id == template_id
    assert agent.deployment_id == deployment_id
    assert agent.entity_id == entity_id

    # Create block with template fields
    block_create = InternalTemplateBlockCreate(
        label="template_block",
        value="Test block",
        base_template_id=base_template_id,
        template_id=template_id,
        deployment_id=deployment_id,
        entity_id=entity_id,
    )
    block = await server.block_manager.create_or_update_block_async(Block(**block_create.model_dump()), actor=default_user)
    # Verify block template fields
    assert block.base_template_id == base_template_id
    assert block.template_id == template_id
    assert block.deployment_id == deployment_id
    assert block.entity_id == entity_id

    # Create group with template fields (no entity_id for groups)
    group = await server.group_manager.create_group_async(
        InternalTemplateGroupCreate(
            agent_ids=[agent.id],
            description="Template group",
            base_template_id=base_template_id,
            template_id=template_id,
            deployment_id=deployment_id,
            manager_config=RoundRobinManager(),
        ),
        actor=default_user,
    )
    # Verify group template fields and basic functionality
    assert group.description == "Template group"
    assert agent.id in group.agent_ids
    assert group.base_template_id == base_template_id
    assert group.template_id == template_id
    assert group.deployment_id == deployment_id

    # Clean up
    await server.group_manager.delete_group_async(group.id, actor=default_user)
    await server.block_manager.delete_block_async(block.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent.id, actor=default_user)
