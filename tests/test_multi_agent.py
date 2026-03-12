import pytest

from letta.config import LettaConfig
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.group import (
    DynamicManagerUpdate,
    GroupCreate,
    GroupUpdate,
    ManagerType,
)
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
