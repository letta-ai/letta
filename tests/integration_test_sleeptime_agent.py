import time

import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.constants import DEFAULT_HUMAN
from letta.groups.sleeptime_multi_agent_v2 import SleeptimeMultiAgentV2
from letta.orm import Provider, ProviderTrace, Step
from letta.orm.errors import NoResultFound
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.enums import JobStatus, JobType, ToolRuleType
from letta.schemas.group import GroupUpdate, ManagerType, SleeptimeManagerUpdate
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.utils import get_human_text, get_persona_text


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    server = SyncServer()
    return server


@pytest.fixture(scope="module")
def org_id(server):
    org = server.organization_manager.create_default_organization()

    yield org.id

    # cleanup
    with db_registry.session() as session:
        session.execute(delete(ProviderTrace))
        session.execute(delete(Step))
        session.execute(delete(Provider))
        session.commit()
    server.organization_manager.delete_organization_by_id(org.id)


@pytest.fixture(scope="module")
def actor(server, org_id):
    user = server.user_manager.create_default_user()
    yield user

    # cleanup
    server.user_manager.delete_user_by_id(user.id)


@pytest.mark.flaky(max_runs=3)
@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_group_chat(server, actor):
    # 0. Refresh base tools
    server.tool_manager.upsert_base_tools(actor=actor)

    # 1. Create sleeptime agent
    main_agent = server.create_agent(
        request=CreateAgent(
            name="main_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a personal assistant that helps users with requests.",
                ),
                CreateBlock(
                    label="human",
                    value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
                ),
            ],
            # model="openai/gpt-4o-mini",
            model="anthropic/claude-3-5-sonnet-20240620",
            embedding="openai/text-embedding-3-small",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    assert main_agent.enable_sleeptime == True
    main_agent_tools = [tool.name for tool in main_agent.tools]
    assert "core_memory_append" not in main_agent_tools
    assert "core_memory_replace" not in main_agent_tools
    assert "archival_memory_insert" not in main_agent_tools

    # 2. Override frequency for test
    group = await server.group_manager.modify_group_async(
        group_id=main_agent.multi_agent_group.id,
        group_update=GroupUpdate(
            manager_config=SleeptimeManagerUpdate(
                sleeptime_agent_frequency=2,
            ),
        ),
        actor=actor,
    )

    assert group.manager_type == ManagerType.sleeptime
    assert group.sleeptime_agent_frequency == 2
    assert len(group.agent_ids) == 1

    # 3. Verify shared blocks
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = server.agent_manager.get_block_with_label(agent_id=main_agent.id, block_label="human", actor=actor)
    agents = await server.block_manager.get_agents_for_block_async(block_id=shared_block.id, actor=actor)
    assert len(agents) == 2
    assert sleeptime_agent_id in [agent.id for agent in agents]
    assert main_agent.id in [agent.id for agent in agents]

    # 4 Verify sleeptime agent tools
    sleeptime_agent = server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
    sleeptime_agent_tools = [tool.name for tool in sleeptime_agent.tools]
    assert "memory_rethink" in sleeptime_agent_tools
    assert "memory_finish_edits" in sleeptime_agent_tools
    assert "memory_replace" in sleeptime_agent_tools
    assert "memory_insert" in sleeptime_agent_tools

    assert len([rule for rule in sleeptime_agent.tool_rules if rule.type == ToolRuleType.exit_loop]) > 0

    # 5. Send messages and verify run ids
    message_text = [
        "my favorite color is orange",
        "not particularly. today is a good day",
        "actually my favorite color is coral",
        "let's change the subject",
        "actually my fav plant is the the african spear",
        "indeed",
    ]
    run_ids = []
    for i, text in enumerate(message_text):
        response = await server.send_message_to_agent(
            agent_id=main_agent.id,
            actor=actor,
            input_messages=[
                MessageCreate(
                    role="user",
                    content=text,
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )

        assert len(response.messages) > 0
        assert len(response.usage.run_ids or []) == (i + 1) % 2
        run_ids.extend(response.usage.run_ids or [])

        jobs = server.job_manager.list_jobs(actor=actor, job_type=JobType.RUN)
        runs = [Run.from_job(job) for job in jobs]
        agent_runs = [run for run in runs if "agent_id" in run.metadata and run.metadata["agent_id"] == sleeptime_agent_id]
        assert len(agent_runs) == len(run_ids)

    # 6. Verify run status after sleep
    time.sleep(2)

    for run_id in run_ids:
        job = server.job_manager.get_job_by_id(job_id=run_id, actor=actor)
        assert job.status == JobStatus.running or job.status == JobStatus.completed

    # 7. Delete agent
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_group_chat_v2(server, actor):
    # 0. Refresh base tools
    server.tool_manager.upsert_base_tools(actor=actor)

    # 1. Create sleeptime agent
    main_agent = server.create_agent(
        request=CreateAgent(
            name="main_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a personal assistant that helps users with requests.",
                ),
                CreateBlock(
                    label="human",
                    value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
                ),
            ],
            # model="openai/gpt-4o-mini",
            model="anthropic/claude-3-5-sonnet-20240620",
            embedding="openai/text-embedding-3-small",
            enable_sleeptime=True,
            include_base_tool_rules=True,
        ),
        actor=actor,
    )

    assert main_agent.enable_sleeptime == True
    main_agent_tools = [tool.name for tool in main_agent.tools]
    assert "core_memory_append" not in main_agent_tools
    assert "core_memory_replace" not in main_agent_tools
    assert "archival_memory_insert" not in main_agent_tools

    # 2. Override frequency for test
    group = await server.group_manager.modify_group_async(
        group_id=main_agent.multi_agent_group.id,
        group_update=GroupUpdate(
            manager_config=SleeptimeManagerUpdate(
                sleeptime_agent_frequency=2,
            ),
        ),
        actor=actor,
    )

    assert group.manager_type == ManagerType.sleeptime
    assert group.sleeptime_agent_frequency == 2
    assert len(group.agent_ids) == 1

    # 3. Verify shared blocks
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = server.agent_manager.get_block_with_label(agent_id=main_agent.id, block_label="human", actor=actor)
    agents = await server.block_manager.get_agents_for_block_async(block_id=shared_block.id, actor=actor)
    assert len(agents) == 2
    assert sleeptime_agent_id in [agent.id for agent in agents]
    assert main_agent.id in [agent.id for agent in agents]

    # 4 Verify sleeptime agent tools
    sleeptime_agent = server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
    sleeptime_agent_tools = [tool.name for tool in sleeptime_agent.tools]
    assert "memory_rethink" in sleeptime_agent_tools
    assert "memory_finish_edits" in sleeptime_agent_tools
    assert "memory_replace" in sleeptime_agent_tools
    assert "memory_insert" in sleeptime_agent_tools

    assert len([rule for rule in sleeptime_agent.tool_rules if rule.type == ToolRuleType.exit_loop]) > 0

    # 5. Send messages and verify run ids
    message_text = [
        "my favorite color is orange",
        "not particularly. today is a good day",
        "actually my favorite color is coral",
        "let's change the subject",
        "actually my fav plant is the the african spear",
        "indeed",
    ]
    run_ids = []
    for i, text in enumerate(message_text):
        agent = SleeptimeMultiAgentV2(
            agent_id=main_agent.id,
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            group_manager=server.group_manager,
            job_manager=server.job_manager,
            actor=actor,
            group=main_agent.multi_agent_group,
            step_manager=server.step_manager,
        )

        response = await agent.step(
            input_messages=[
                MessageCreate(
                    role="user",
                    content=text,
                ),
            ],
        )

        assert len(response.messages) > 0
        assert len(response.usage.run_ids or []) == (i + 1) % 2
        run_ids.extend(response.usage.run_ids or [])

        jobs = server.job_manager.list_jobs(actor=actor, job_type=JobType.RUN)
        runs = [Run.from_job(job) for job in jobs]
        agent_runs = [run for run in runs if "agent_id" in run.metadata and run.metadata["agent_id"] == sleeptime_agent_id]
        assert len(agent_runs) == len(run_ids)

    # 6. Verify run status after sleep
    time.sleep(2)
    for run_id in run_ids:
        job = server.job_manager.get_job_by_id(job_id=run_id, actor=actor)
        assert job.status == JobStatus.running or job.status == JobStatus.completed

    # 7. Delete agent
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)


@pytest.mark.skip
@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_removes_redundant_information(server, actor):
    # 1. set up sleep-time agent as in test_sleeptime_group_chat
    server.tool_manager.upsert_base_tools(actor=actor)
    main_agent = server.create_agent(
        request=CreateAgent(
            name="main_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a personal assistant that helps users with requests.",
                ),
                CreateBlock(
                    label="human",
                    value="My favorite plant is the fiddle leaf\nMy favorite dog is the husky\nMy favorite plant is the fiddle leaf\nMy favorite plant is the fiddle leaf",
                ),
            ],
            model="anthropic/claude-3-5-sonnet-20240620",
            embedding="openai/text-embedding-3-small",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    group = await server.group_manager.modify_group_async(
        group_id=main_agent.multi_agent_group.id,
        group_update=GroupUpdate(
            manager_config=SleeptimeManagerUpdate(
                sleeptime_agent_frequency=1,
            ),
        ),
        actor=actor,
    )
    sleeptime_agent_id = group.agent_ids[0]
    shared_block = server.agent_manager.get_block_with_label(agent_id=main_agent.id, block_label="human", actor=actor)
    count_before_memory_edits = shared_block.value.count("fiddle leaf")
    test_messages = ["hello there", "my favorite bird is the sparrow"]

    for test_message in test_messages:
        _ = await server.send_message_to_agent(
            agent_id=main_agent.id,
            actor=actor,
            input_messages=[
                MessageCreate(
                    role="user",
                    content=test_message,
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
    # 2. Allow memory blocks time to update
    time.sleep(5)

    # 3. Check that the memory blocks have been collapsed
    shared_block = server.agent_manager.get_block_with_label(agent_id=main_agent.id, block_label="human", actor=actor)
    count_after_memory_edits = shared_block.value.count("fiddle leaf")
    assert count_after_memory_edits < count_before_memory_edits

    # 4. Delete agent
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_edit(server, actor):
    sleeptime_agent = server.create_agent(
        request=CreateAgent(
            name="sleeptime_agent",
            agent_type="sleeptime_agent",
            memory_blocks=[
                CreateBlock(
                    label="human",
                    value=get_human_text(DEFAULT_HUMAN),
                    limit=2000,
                ),
                CreateBlock(
                    label="memory_persona",
                    value=get_persona_text("sleeptime_memory_persona"),
                    limit=2000,
                ),
                CreateBlock(
                    label="fact_block",
                    value="""Messi resides in the Paris.
                        Messi plays in the league Ligue 1.
                        Messi plays for the team Paris Saint-Germain.
                        The national team Messi plays for is the Argentina team.
                        Messi is also known as Leo Messi
                        Victor Ulloa plays for Inter Miami""",
                    limit=2000,
                ),
            ],
            model="anthropic/claude-3-5-sonnet-20240620",
            embedding="openai/text-embedding-3-small",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    _ = await server.send_message_to_agent(
        agent_id=sleeptime_agent.id,
        actor=actor,
        input_messages=[
            MessageCreate(
                role="user",
                content="Messi has now moved to playing for Inter Miami",
            ),
        ],
        stream_steps=False,
        stream_tokens=False,
    )
    fact_block = server.agent_manager.get_block_with_label(agent_id=sleeptime_agent.id, block_label="fact_block", actor=actor)
    print(fact_block.value)
    assert fact_block.value.count("Inter Miami") > 1


@pytest.mark.asyncio(loop_scope="module")
async def test_sleeptime_agent_new_block_attachment(server, actor):
    """Test that a new block created after agent creation is properly attached to both main and sleeptime agents."""
    # 0. Refresh base tools
    server.tool_manager.upsert_base_tools(actor=actor)

    # 1. Create sleeptime agent
    main_agent = server.create_agent(
        request=CreateAgent(
            name="main_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a personal assistant that helps users with requests.",
                ),
                CreateBlock(
                    label="human",
                    value="My favorite plant is the fiddle leaf\nMy favorite color is lavender",
                ),
            ],
            model="anthropic/claude-3-5-sonnet-20240620",
            embedding="openai/text-embedding-3-small",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    assert main_agent.enable_sleeptime == True

    # 2. Get the sleeptime agent ID
    group = main_agent.multi_agent_group
    sleeptime_agent_id = group.agent_ids[0]

    # 3. Verify initial shared blocks
    main_agent_refreshed = server.agent_manager.get_agent_by_id(agent_id=main_agent.id, actor=actor)
    initial_blocks = main_agent_refreshed.memory.blocks
    initial_block_count = len(initial_blocks)

    # Verify both agents share the initial blocks
    for block in initial_blocks:
        agents = await server.block_manager.get_agents_for_block_async(block_id=block.id, actor=actor)
        assert len(agents) == 2
        assert sleeptime_agent_id in [agent.id for agent in agents]
        assert main_agent.id in [agent.id for agent in agents]

    # 4. Create a new block after agent creation
    from letta.schemas.block import Block as PydanticBlock

    new_block = server.block_manager.create_or_update_block(
        PydanticBlock(
            label="preferences",
            value="My favorite season is autumn\nI prefer tea over coffee",
        ),
        actor=actor,
    )

    # 5. Attach the new block to the main agent
    server.agent_manager.attach_block(agent_id=main_agent.id, block_id=new_block.id, actor=actor)

    # 6. Verify the new block is attached to the main agent
    main_agent_refreshed = server.agent_manager.get_agent_by_id(agent_id=main_agent.id, actor=actor)
    main_agent_blocks = main_agent_refreshed.memory.blocks
    assert len(main_agent_blocks) == initial_block_count + 1
    main_agent_block_ids = [block.id for block in main_agent_blocks]
    assert new_block.id in main_agent_block_ids

    # 7. Check if the new block is also attached to the sleeptime agent (this is where the bug might be)
    sleeptime_agent = server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
    sleeptime_agent_blocks = sleeptime_agent.memory.blocks
    sleeptime_agent_block_ids = [block.id for block in sleeptime_agent_blocks]

    # This assertion should pass if the bug is fixed
    assert new_block.id in sleeptime_agent_block_ids, f"New block {new_block.id} not attached to sleeptime agent {sleeptime_agent_id}"

    # 8. Verify that agents sharing the new block include both main and sleeptime agents
    agents_with_new_block = await server.block_manager.get_agents_for_block_async(block_id=new_block.id, actor=actor)
    agent_ids_with_new_block = [agent.id for agent in agents_with_new_block]

    assert main_agent.id in agent_ids_with_new_block, "Main agent should have access to the new block"
    assert sleeptime_agent_id in agent_ids_with_new_block, "Sleeptime agent should have access to the new block"
    assert len(agents_with_new_block) == 2, "Both main and sleeptime agents should share the new block"

    # 9. Clean up
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)
