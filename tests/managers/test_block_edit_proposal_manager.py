import pytest
from sqlalchemy import select

from letta.orm.block_history import BlockHistory
from letta.schemas.agent import CreateAgent
from letta.schemas.block import Block as PydanticBlock, BlockUpdate, CreateBlock
from letta.schemas.block_edit_proposal import BlockProposalStatus
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.group import GroupCreate, SleeptimeManager
from letta.schemas.llm_config import LLMConfig
from letta.server.db import db_registry
from letta.services.block_edit_proposal_manager import BlockEditProposalManager
from letta.services.tool_executor.core_tool_executor import LettaCoreToolExecutor


@pytest.mark.asyncio
async def test_block_edit_proposal_create_and_approve(server, default_user):
    block = await server.block_manager.create_or_update_block_async(
        PydanticBlock(label="facts", value="v1"),
        actor=default_user,
    )
    agent = await server.agent_manager.create_agent_async(
        CreateAgent(
            name="proposal_agent",
            agent_type="memgpt_v2_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    proposal_manager = BlockEditProposalManager()
    proposal = await proposal_manager.create_proposal_async(
        block_id=block.id,
        proposed_update=BlockUpdate(value="v2"),
        actor=default_user,
        agent_id=agent.id,
    )

    assert proposal.status == BlockProposalStatus.pending
    unchanged = await server.block_manager.get_block_by_id_async(block_id=block.id, actor=default_user)
    assert unchanged.value == "v1"

    approved = await proposal_manager.approve_proposal_async(
        proposal_id=proposal.id,
        block_id=block.id,
        actor=default_user,
    )
    assert approved.status == BlockProposalStatus.approved

    updated = await server.block_manager.get_block_by_id_async(block_id=block.id, actor=default_user)
    assert updated.value == "v2"

    async with db_registry.async_session() as session:
        stmt = select(BlockHistory).filter(BlockHistory.block_id == block.id).order_by(BlockHistory.sequence_number.asc())
        result = await session.execute(stmt)
        history_entries = list(result.scalars().all())

    assert len(history_entries) == 2
    assert history_entries[0].value == "v1"
    assert history_entries[1].value == "v2"


@pytest.mark.asyncio
async def test_sleeptime_propose_only_creates_proposal(server, default_user):
    main_agent = await server.agent_manager.create_agent_async(
        CreateAgent(
            name="main_agent",
            agent_type="letta_v1_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )
    sleeptime_agent = await server.agent_manager.create_agent_async(
        CreateAgent(
            name="sleeptime_agent",
            agent_type="sleeptime_agent",
            memory_blocks=[CreateBlock(label="human", value="initial")],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    await server.group_manager.create_group_async(
        GroupCreate(
            agent_ids=[sleeptime_agent.id],
            description="sleeptime propose-only group",
            manager_config=SleeptimeManager(
                manager_agent_id=main_agent.id,
                sleeptime_agent_frequency=1,
                sleeptime_propose_only=True,
            ),
        ),
        actor=default_user,
    )

    executor = LettaCoreToolExecutor(
        message_manager=server.message_manager,
        agent_manager=server.agent_manager,
        block_manager=server.block_manager,
        run_manager=server.run_manager,
        passage_manager=server.passage_manager,
        actor=default_user,
    )
    await executor.core_memory_append(
        agent_state=sleeptime_agent,
        actor=default_user,
        label="human",
        content="new detail",
    )

    target_block = await server.block_manager.get_block_by_id_async(
        block_id=sleeptime_agent.memory.get_block("human").id,
        actor=default_user,
    )
    assert target_block.value == "initial"

    proposals = await server.block_edit_proposal_manager.list_proposals_async(block_id=target_block.id, actor=default_user)
    assert len(proposals) == 1
    assert proposals[0].status == BlockProposalStatus.pending
    assert proposals[0].proposed_update.value == "initial\nnew detail"
