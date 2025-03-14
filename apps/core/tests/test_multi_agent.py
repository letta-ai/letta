import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.orm import Provider, Step
from letta.schemas.agent import CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.group import DynamicManager, GroupCreate, SupervisorManager
from letta.schemas.message import MessageCreate
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
def participant_agent_ids(server, actor):
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
    yield [agent_fred.id, agent_velma.id, agent_daphne.id, agent_shaggy.id]

    # cleanup
    server.agent_manager.delete_agent(agent_fred.id, actor=actor)
    server.agent_manager.delete_agent(agent_velma.id, actor=actor)
    server.agent_manager.delete_agent(agent_daphne.id, actor=actor)
    server.agent_manager.delete_agent(agent_shaggy.id, actor=actor)


@pytest.fixture(scope="module")
def manager_agent_id(server, actor):
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
    yield agent_scooby.id

    # cleanup
    server.agent_manager.delete_agent(agent_scooby.id, actor=actor)


@pytest.mark.asyncio
async def test_round_robin(server, actor, participant_agent_ids):
    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=participant_agent_ids,
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
                    content="what is everyone up to for the holidays?",
                ),
            ],
            stream_steps=False,
            stream_tokens=False,
        )
        assert response.usage.step_count == len(participant_agent_ids)
        assert len(response.messages) == response.usage.step_count * 2

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)


@pytest.mark.asyncio
async def test_supervisor(server, actor, participant_agent_ids):
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
            agent_ids=participant_agent_ids,
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
            participant_agent_ids
        )
        assert response.messages[3].message_type == "reasoning_message"
        assert response.messages[4].message_type == "assistant_message"

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)
        server.agent_manager.delete_agent(agent_id=agent_scrappy.id, actor=actor)


@pytest.mark.asyncio
async def test_dynamic_group_chat(server, actor, manager_agent_id, participant_agent_ids):
    group = server.group_manager.create_group(
        group=GroupCreate(
            description="This is a group chat between best friends all like to hang out together. In their free time they like to solve mysteries.",
            agent_ids=participant_agent_ids,
            manager_config=DynamicManager(
                manager_agent_id=manager_agent_id,
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
        assert response.usage.step_count == len(participant_agent_ids) * 2
        assert len(response.messages) == response.usage.step_count * 2

    finally:
        server.group_manager.delete_group(group_id=group.id, actor=actor)
