import pytest

from letta.config import LettaConfig
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
from letta.server.server import SyncServer


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)

    config.save()

    server = SyncServer()
    return server


@pytest.fixture
async def default_organization(server: SyncServer):
    """Fixture to create and return the default organization."""
    yield await server.organization_manager.create_default_organization_async()


@pytest.fixture
async def default_user(server: SyncServer, default_organization):
    """Fixture to create and return the default user within the default organization."""
    yield await server.user_manager.create_default_actor_async(org_id=default_organization.id)


@pytest.fixture
async def four_participant_agents(server, default_user):
    agent_fred = await server.create_agent_async(
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
        actor=default_user,
    )
    agent_velma = await server.create_agent_async(
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
        actor=default_user,
    )
    agent_daphne = await server.create_agent_async(
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
        actor=default_user,
    )
    agent_shaggy = await server.create_agent_async(
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
        actor=default_user,
    )
    yield [agent_fred, agent_velma, agent_daphne, agent_shaggy]


@pytest.fixture
async def manager_agent(server, default_user):
    agent_scooby = await server.create_agent_async(
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
        actor=default_user,
    )
    yield agent_scooby


async def test_empty_group(server, default_user):
    group = await server.group_manager.create_group_async(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[],
        ),
        actor=default_user,
    )
    with pytest.raises(ValueError, match="Empty group"):
        await server.send_group_message_to_agent(
            group_id=group.id,
            actor=default_user,
            input_messages=[
                MessageCreate(
                    role="user",
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
    await server.group_manager.delete_group_async(group_id=group.id, actor=default_user)


async def test_modify_group_pattern(server, default_user, four_participant_agents, manager_agent):
    group = await server.group_manager.create_group_async(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in four_participant_agents],
        ),
        actor=default_user,
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
            actor=default_user,
        )

    await server.group_manager.delete_group_async(group_id=group.id, actor=default_user)


async def test_list_agent_groups(server, default_user, four_participant_agents):
    group_a = await server.group_manager.create_group_async(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in four_participant_agents],
        ),
        actor=default_user,
    )
    group_b = await server.group_manager.create_group_async(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[four_participant_agents[0].id],
        ),
        actor=default_user,
    )

    agent_a_groups = server.agent_manager.list_groups(agent_id=four_participant_agents[0].id, actor=default_user)
    assert sorted([group.id for group in agent_a_groups]) == sorted([group_a.id, group_b.id])
    agent_b_groups = server.agent_manager.list_groups(agent_id=four_participant_agents[1].id, actor=default_user)
    assert [group.id for group in agent_b_groups] == [group_a.id]

    await server.group_manager.delete_group_async(group_id=group_a.id, actor=default_user)
    await server.group_manager.delete_group_async(group_id=group_b.id, actor=default_user)


async def test_round_robin(server, default_user, four_participant_agents):
    description = (
        "This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries."
    )
    group = await server.group_manager.create_group_async(
        group=GroupCreate(
            description=description,
            agent_ids=[agent.id for agent in four_participant_agents],
        ),
        actor=default_user,
    )

    # verify group creation
    assert group.manager_type == ManagerType.round_robin
    assert group.description == description
    assert group.agent_ids == [agent.id for agent in four_participant_agents]
    assert group.max_turns is None
    assert group.manager_agent_id is None
    assert group.termination_token is None

    try:
        server.group_manager.reset_messages(group_id=group.id, actor=default_user)
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=default_user,
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
            assert message.name == four_participant_agents[i // 2].name

        for agent_id in group.agent_ids:
            agent_messages = server.get_agent_recall(
                user_id=default_user.id,
                agent_id=agent_id,
                group_id=group.id,
                reverse=True,
                return_message_object=False,
            )
            assert len(agent_messages) == len(group.agent_ids) + 2  # add one for user message, one for reasoning message

        # TODO: filter this to return a clean conversation history
        messages = server.group_manager.list_group_messages(
            group_id=group.id,
            actor=default_user,
        )
        assert len(messages) == (len(group.agent_ids) + 2) * len(group.agent_ids)

        max_turns = 3
        group = await server.group_manager.modify_group_async(
            group_id=group.id,
            group_update=GroupUpdate(
                agent_ids=[agent.id for agent in four_participant_agents][::-1],
                manager_config=RoundRobinManagerUpdate(
                    max_turns=max_turns,
                ),
            ),
            actor=default_user,
        )
        assert group.manager_type == ManagerType.round_robin
        assert group.description == description
        assert group.agent_ids == [agent.id for agent in four_participant_agents][::-1]
        assert group.max_turns == max_turns
        assert group.manager_agent_id is None
        assert group.termination_token is None

        server.group_manager.reset_messages(group_id=group.id, actor=default_user)

        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=default_user,
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
            assert message.name == four_participant_agents[::-1][i // 2].name

        for i in range(len(group.agent_ids)):
            agent_messages = server.get_agent_recall(
                user_id=default_user.id,
                agent_id=group.agent_ids[i],
                group_id=group.id,
                reverse=True,
                return_message_object=False,
            )
            expected_message_count = max_turns + 1 if i >= max_turns else max_turns + 2
            assert len(agent_messages) == expected_message_count

    finally:
        await server.group_manager.delete_group_async(group_id=group.id, actor=default_user)


async def test_supervisor(server, default_user, four_participant_agents):
    agent_scrappy = await server.create_agent_async(
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
        actor=default_user,
    )

    group = await server.group_manager.create_group_async(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=[agent.id for agent in four_participant_agents],
            manager_config=SupervisorManager(
                manager_agent_id=agent_scrappy.id,
            ),
        ),
        actor=default_user,
    )
    try:
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=default_user,
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
            four_participant_agents
        )
        assert response.messages[3].message_type == "reasoning_message"
        assert response.messages[4].message_type == "assistant_message"

    finally:
        await server.group_manager.delete_group_async(group_id=group.id, actor=default_user)
        server.agent_manager.delete_agent(agent_id=agent_scrappy.id, actor=default_user)


@pytest.mark.flaky(max_runs=2)
async def test_dynamic_group_chat(server, default_user, manager_agent, four_participant_agents):
    description = (
        "This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries."
    )
    # error on duplicate agent in participant list
    with pytest.raises(ValueError, match="Duplicate agent ids"):
        await server.group_manager.create_group_async(
            group=GroupCreate(
                description=description,
                agent_ids=[agent.id for agent in four_participant_agents] + [four_participant_agents[0].id],
                manager_config=DynamicManager(
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=default_user,
        )
    # error on duplicate agent names
    duplicate_agent_shaggy = server.create_agent(
        request=CreateAgent(
            name="shaggy",
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
        ),
        actor=default_user,
    )
    with pytest.raises(ValueError, match="Duplicate agent names"):
        await server.group_manager.create_group_async(
            group=GroupCreate(
                description=description,
                agent_ids=[agent.id for agent in four_participant_agents] + [duplicate_agent_shaggy.id],
                manager_config=DynamicManager(
                    manager_agent_id=manager_agent.id,
                ),
            ),
            actor=default_user,
        )
    server.agent_manager.delete_agent(duplicate_agent_shaggy.id, actor=default_user)

    group = await server.group_manager.create_group_async(
        group=GroupCreate(
            description=description,
            agent_ids=[agent.id for agent in four_participant_agents],
            manager_config=DynamicManager(
                manager_agent_id=manager_agent.id,
            ),
        ),
        actor=default_user,
    )
    try:
        response = await server.send_group_message_to_agent(
            group_id=group.id,
            actor=default_user,
            input_messages=[
                MessageCreate(role="user", content="what is everyone up to for the holidays?"),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == len(four_participant_agents) * 2
        assert len(response.messages) == response.usage.step_count * 2

    finally:
        await server.group_manager.delete_group_async(group_id=group.id, actor=default_user)
