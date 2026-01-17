import pytest

# Import shared fixtures and constants from conftest
from conftest import DEFAULT_EMBEDDING_CONFIG

from letta.orm.errors import NoResultFound
from letta.schemas.agent import CreateAgent
from letta.schemas.block import Block as PydanticBlock, BlockUpdate
from letta.schemas.llm_config import LLMConfig
from letta.server.server import SyncServer
from letta.services.block_manager import BlockManager


@pytest.mark.asyncio
async def test_modify_nonexistent_block_raises_error(server: SyncServer, default_user):
    """
    Test that modifying a non-existent block raises NoResultFound instead of
    silently updating the wrong block.

    Regression test for bug where `block = block` was a no-op, causing the loop
    variable to end as the last block in core_memory, which then got incorrectly updated.
    """
    # Upsert base tools
    await server.tool_manager.upsert_base_tools_async(actor=default_user)

    # Create human and persona blocks
    block_manager = BlockManager()
    human_block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="human", value="Test user context", limit=2000), actor=default_user
    )
    persona_block = await block_manager.create_or_update_block_async(
        PydanticBlock(label="persona", value="Test persona context", limit=2000), actor=default_user
    )

    # Create agent with human and persona blocks (but no "skills" block)
    create_agent_request = CreateAgent(
        name="test_block_update_agent",
        agent_type="memgpt_v2_agent",
        system="test system",
        llm_config=LLMConfig.default_config("gpt-4o-mini"),
        embedding_config=DEFAULT_EMBEDDING_CONFIG,
        block_ids=[human_block.id, persona_block.id],
    )
    agent = await server.agent_manager.create_agent_async(create_agent_request, actor=default_user)

    # Try to update a non-existent block (e.g., "skills")
    # This should raise NoResultFound, not silently update human block
    with pytest.raises(NoResultFound, match="No block with label 'skills' found"):
        await server.agent_manager.modify_block_by_label_async(
            agent_id=agent.id,
            block_label="skills",
            block_update=BlockUpdate(value="Skills directory content that should not overwrite human block"),
            actor=default_user,
        )

    # Verify human block wasn't modified
    retrieved_human_block = await server.agent_manager.get_block_with_label_async(
        agent_id=agent.id,
        block_label="human",
        actor=default_user,
    )
    assert retrieved_human_block.value == "Test user context", "Human block should not be modified"

    # Verify persona block wasn't modified
    retrieved_persona_block = await server.agent_manager.get_block_with_label_async(
        agent_id=agent.id,
        block_label="persona",
        actor=default_user,
    )
    assert retrieved_persona_block.value == "Test persona context", "Persona block should not be modified"

    # Clean up
    await server.agent_manager.delete_agent_async(agent.id, default_user)
