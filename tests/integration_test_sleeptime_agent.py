import time

import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.constants import DEFAULT_HUMAN
from letta.orm import Provider, Step
from letta.orm.enums import JobType
from letta.orm.errors import NoResultFound
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.enums import JobStatus, ToolRuleType
from letta.schemas.group import GroupUpdate, ManagerType, SleeptimeManagerUpdate
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run
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
    with server.organization_manager.session_maker() as session:
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


@pytest.mark.asyncio
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
            embedding="openai/text-embedding-ada-002",
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
    group = server.group_manager.modify_group(
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
    agents = server.block_manager.get_agents_for_block(block_id=shared_block.id, actor=actor)
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
            messages=[
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
    for run_id in run_ids:
        job = server.job_manager.get_job_by_id(job_id=run_id, actor=actor)
        assert job.status == JobStatus.completed

    # 6. Delete agent
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)


@pytest.mark.skip
@pytest.mark.asyncio
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
            embedding="openai/text-embedding-ada-002",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    group = server.group_manager.modify_group(
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
            messages=[
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


@pytest.mark.asyncio
async def test_sleeptime_edit(server, actor):
    sleeptime_agent = server.create_agent(
        request=CreateAgent(
            name="sleeptime_agent",
            agent_type="sleeptime_agent",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value=get_human_text(DEFAULT_HUMAN),
                    limit=2000,
                ),
                CreateBlock(
                    label="human",
                    value=get_persona_text("offline_memory_persona"),
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
            embedding="openai/text-embedding-ada-002",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    _ = await server.send_message_to_agent(
        agent_id=sleeptime_agent.id,
        actor=actor,
        messages=[
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
