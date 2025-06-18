import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.orm import Provider, ProviderTrace, Step
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.group import (
    DynamicManager,
    DynamicManagerUpdate,
    GroupCreate,
    GroupUpdate,
    ManagerType,
    RoundRobinManagerUpdate,
    SupervisorManager,
)
from letta.schemas.message import MessageCreate
from letta.server.db import db_registry
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
            embedding="openai/text-embedding-3-small",
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
            embedding="openai/text-embedding-3-small",
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
            embedding="openai/text-embedding-3-small",
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
            embedding="openai/text-embedding-3-small",
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
            embedding="openai/text-embedding-3-small",
        ),
        actor=actor,
    )
    yield agent_scooby

    # cleanup
    server.agent_manager.delete_agent(agent_scooby.id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
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
            input_messages=[
                MessageCreate(
                    role="user",
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
    server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
async def test_modify_group_pattern(server, actor, participant_agents, manager_agent):
    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in participant_agents],
        ),
        actor=actor,
    )
    with pytest.raises(ValueError, match="Cannot change group pattern"):
        await server.group_manager.modify_group_async(
            group_id=group.id,
            group_update=GroupUpdate(
                manager_config=DynamicManagerUpdate(
                    manager_type=ManagerType.dynamic,
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=actor,
        )

    server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
async def test_list_agent_groups(server, actor, participant_agents):
    group_a = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in participant_agents],
        ),
        actor=actor,
    )
    group_b = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[participant_agents[0].id],
        ),
        actor=actor,
    )

    agent_a_groups = server.agent_manager.list_groups(agent_id=participant_agents[0].id, actor=actor)
    assert sorted([group.id for group in agent_a_groups]) == sorted([group_a.id, group_b.id])
    agent_b_groups = server.agent_manager.list_groups(agent_id=participant_agents[1].id, actor=actor)
    assert [group.id for group in agent_b_groups] == [group_a.id]

    server.group_manager.delete_group(group_id=group_a.id, actor=actor)
    server.group_manager.delete_group(group_id=group_b.id, actor=actor)


@pytest.mark.asyncio(loop_scope="module")
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
    assert group.max_turns is None
    assert group.manager_agent_id is None
    assert group.termination_token is None

    try:
        server.group_manager.reset_messages(group_id=group.id, actor=actor)
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=actor,
            input_messages=[
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
        group = await server.group_manager.modify_group_async(
            group_id=group.id,
            group_update=GroupUpdate(
                agent_ids=[agent.id for agent in participant_agents][::-1],
                manager_config=RoundRobinManagerUpdate(
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
            input_messages=[
                MessageCreate(
                    role="user",
                    content="when should we plan our next adventure?",
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


@pytest.mark.asyncio(loop_scope="module")
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
            embedding="openai/text-embedding-3-small",
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
            input_messages=[
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


@pytest.mark.asyncio(loop_scope="module")
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
            embedding="openai/text-embedding-3-small",
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
            input_messages=[
                MessageCreate(role="user", content="what is everyone up to for the holidays?"),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == len(participant_agents) * 2
        assert len(response.messages) == response.usage.step_count * 2

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)
