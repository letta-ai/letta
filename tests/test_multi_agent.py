import time

import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.orm import Provider, Step
from letta.orm.enums import JobType
from letta.orm.errors import NoResultFound
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.enums import JobStatus
from letta.schemas.group import (
    DynamicManager,
    GroupCreate,
    GroupUpdate,
    ManagerType,
    RoundRobinManager,
    SleeptimeManager,
    SupervisorManager,
)
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run
from letta.server.server import SyncServer


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


@pytest.fixture(scope="module")
def participant_agents(server, actor):
    agent_fred = server.create_agent(
        request=CreateAgent(
            name="fred",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="Your name is fred and you like to ski and have been wanting to go on a ski trip soon. You are speaking in a group chat with other agent pals where you participate in friendly banter.",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    agent_velma = server.create_agent(
        request=CreateAgent(
            name="velma",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="Your name is velma and you like tropical locations. You are speaking in a group chat with other agent friends and you love to include everyone.",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    agent_daphne = server.create_agent(
        request=CreateAgent(
            name="daphne",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="Your name is daphne and you love traveling abroad. You are speaking in a group chat with other agent friends and you love to keep in touch with them.",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    agent_shaggy = server.create_agent(
        request=CreateAgent(
            name="shaggy",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="Your name is shaggy and your best friend is your dog, scooby. You are speaking in a group chat with other agent friends and you like to solve mysteries with them.",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    yield [agent_fred, agent_velma, agent_daphne, agent_shaggy]

    # cleanup
    server.agent_manager.delete_agent(agent_fred.id, actor=actor)
    server.agent_manager.delete_agent(agent_velma.id, actor=actor)
    server.agent_manager.delete_agent(agent_daphne.id, actor=actor)
    server.agent_manager.delete_agent(agent_shaggy.id, actor=actor)


@pytest.fixture(scope="module")
def manager_agent(server, actor):
    agent_scooby = server.create_agent(
        request=CreateAgent(
            name="scooby",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a puppy operations agent for Letta and you help run multi-agent group chats. Your job is to get to know the agents in your group and pick who is best suited to speak next in the conversation.",
                ),
                CreateBlock(
                    label="human",
                    value="",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    yield agent_scooby

    # cleanup
    server.agent_manager.delete_agent(agent_scooby.id, actor=actor)


@pytest.mark.asyncio
async def test_empty_group(server, actor):
    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[],
        ),
        actor=actor,
    )
    with pytest.raises(ValueError, match="Empty group"):
        await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            messages=[
                MessageCreate(
                    role="user",
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
    server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio
async def test_modify_group_pattern(server, actor, participant_agents, manager_agent):
    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in participant_agents],
        ),
        actor=actor,
    )
    with pytest.raises(ValueError, match="Cannot change group pattern"):
        server.group_manager.modify_group(
            group_id=group.id,
            group_update=GroupUpdate(
                manager_config=DynamicManager(
                    manager_type=ManagerType.dynamic,
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=actor,
        )

    server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio
async def test_round_robin(server, actor, participant_agents):
    description = (
        "This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries."
    )
    group = server.group_manager.create_group(
        group=GroupCreate(
            description=description,
            agent_ids=[agent.id for agent in participant_agents],
        ),
        actor=actor,
    )

    # verify group creation
    assert group.manager_type == ManagerType.round_robin
    assert group.description == description
    assert group.agent_ids == [agent.id for agent in participant_agents]
    assert group.max_turns == None
    assert group.manager_agent_id is None
    assert group.termination_token is None

    try:
        server.group_manager.reset_messages(group_id=group.id, actor=actor)
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            messages=[
                MessageCreate(
                    role="user",
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == len(group.agent_ids)
        assert len(response.messages) == response.usage.step_count * 2
        for i, message in enumerate(response.messages):
            assert message.message_type == "reasoning_message" if i % 2 == 0 else "assistant_message"
            assert message.name == participant_agents[i // 2].name

        for agent_id in group.agent_ids:
            agent_messages = server.get_agent_recall(
                user_id=actor.id,
                agent_id=agent_id,
                group_id=group.id,
                reverse=True,
                return_message_object=False,
            )
            assert len(agent_messages) == len(group.agent_ids) + 2  # add one for user message, one for reasoning message

        # TODO: filter this to return a clean conversation history
        messages = server.group_manager.list_group_messages(
            group_id=group.id,
            actor=actor,
        )
        assert len(messages) == (len(group.agent_ids) + 2) * len(group.agent_ids)

        max_turns = 3
        group = server.group_manager.modify_group(
            group_id=group.id,
            group_update=GroupUpdate(
                agent_ids=[agent.id for agent in participant_agents][::-1],
                manager_config=RoundRobinManager(
                    max_turns=max_turns,
                ),
            ),
            actor=actor,
        )
        assert group.manager_type == ManagerType.round_robin
        assert group.description == description
        assert group.agent_ids == [agent.id for agent in participant_agents][::-1]
        assert group.max_turns == max_turns
        assert group.manager_agent_id is None
        assert group.termination_token is None

        server.group_manager.reset_messages(group_id=group.id, actor=actor)

        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            messages=[
                MessageCreate(
                    role="user",
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == max_turns
        assert len(response.messages) == max_turns * 2

        for i, message in enumerate(response.messages):
            assert message.message_type == "reasoning_message" if i % 2 == 0 else "assistant_message"
            assert message.name == participant_agents[::-1][i // 2].name

        for i in range(len(group.agent_ids)):
            agent_messages = server.get_agent_recall(
                user_id=actor.id,
                agent_id=group.agent_ids[i],
                group_id=group.id,
                reverse=True,
                return_message_object=False,
            )
            expected_message_count = max_turns + 1 if i >= max_turns else max_turns + 2
            assert len(agent_messages) == expected_message_count

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio
async def test_supervisor(server, actor, participant_agents):
    agent_scrappy = server.create_agent(
        request=CreateAgent(
            name="shaggy",
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value="You are a puppy operations agent for Letta and you help run multi-agent group chats. Your role is to supervise the group, sending messages and aggregating the responses.",
                ),
                CreateBlock(
                    label="human",
                    value="",
                ),
            ],
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )

    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in participant_agents],
            manager_config=SupervisorManager(
                manager_agent_id=agent_scrappy.id,
            ),
        ),
        actor=actor,
    )
    try:
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            messages=[
                MessageCreate(
                    role="user",
                    content="ask everyone what they like to do for fun and then come up with an activity for everyone to do together.",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == 2
        assert len(response.messages) == 5

        # verify tool call
        assert response.messages[0].message_type == "reasoning_message"
        assert (
            response.messages[1].message_type == "tool_call_message"
            and response.messages[1].tool_call.name == "send_message_to_all_agents_in_group"
        )
        assert response.messages[2].message_type == "tool_return_message" and len(eval(response.messages[2].tool_return)) == len(
            participant_agents
        )
        assert response.messages[3].message_type == "reasoning_message"
        assert response.messages[4].message_type == "assistant_message"

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)
        server.agent_manager.delete_agent(agent_id=agent_scrappy.id, actor=actor)


@pytest.mark.asyncio
async def test_dynamic_group_chat(server, actor, manager_agent, participant_agents):
    description = (
        "This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries."
    )
    # error on duplicate agent in participant list
    with pytest.raises(ValueError, match="Duplicate agent ids"):
        server.group_manager.create_group(
            group=GroupCreate(
                description=description,
                agent_ids=[agent.id for agent in participant_agents] + [participant_agents[0].id],
                manager_config=DynamicManager(
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=actor,
        )
    # error on duplicate agent names
    duplicate_agent_shaggy = server.create_agent(
        request=CreateAgent(
            name="shaggy",
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
        ),
        actor=actor,
    )
    with pytest.raises(ValueError, match="Duplicate agent names"):
        server.group_manager.create_group(
            group=GroupCreate(
                description=description,
                agent_ids=[agent.id for agent in participant_agents] + [duplicate_agent_shaggy.id],
                manager_config=DynamicManager(
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=actor,
        )
    server.agent_manager.delete_agent(duplicate_agent_shaggy.id, actor=actor)

    group = server.group_manager.create_group(
        group=GroupCreate(
            description=description,
            agent_ids=[agent.id for agent in participant_agents],
            manager_config=DynamicManager(
                manager_agent_id=manager_agent.id,
            ),
        ),
        actor=actor,
    )
    try:
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            messages=[
                MessageCreate(role="user", content="what is everyone up to for the holidays?"),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == len(participant_agents) * 2
        assert len(response.messages) == response.usage.step_count * 2

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)


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
            manager_config=SleeptimeManager(
                manager_agent_id=main_agent.id,
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
    assert "rethink_memory" in sleeptime_agent_tools
    assert "finish_rethinking_memory" in sleeptime_agent_tools
    assert "view_core_memory_with_line_numbers" in sleeptime_agent_tools
    assert "core_memory_insert" in sleeptime_agent_tools

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
        assert len(response.usage.run_ids or []) == i % 2
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
            manager_config=SleeptimeManager(
                manager_agent_id=main_agent.id,
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
