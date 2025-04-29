import pytest
from sqlalchemy import delete

from letta.config import LettaConfig
from letta.orm import Provider, Step
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentType, CreateAgent
from letta.schemas.block import CreateBlock
from letta.schemas.group import ManagerType
from letta.schemas.letta_message import AssistantMessage, ReasoningMessage
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


@pytest.mark.asyncio
async def test_init_voice_convo_agent(server, actor):
    # 0. Refresh base tools
    server.tool_manager.upsert_base_tools(actor=actor)

    # 1. Create sleeptime agent
    main_agent = server.create_agent(
        request=CreateAgent(
            agent_type=AgentType.voice_convo_agent,
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
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-ada-002",
            enable_sleeptime=True,
        ),
        actor=actor,
    )

    assert main_agent.enable_sleeptime == True
    main_agent_tools = [tool.name for tool in main_agent.tools]
    assert len(main_agent_tools) == 2
    assert "send_message" in main_agent_tools
    assert "search_memory" in main_agent_tools
    assert "core_memory_append" not in main_agent_tools
    assert "core_memory_replace" not in main_agent_tools
    assert "archival_memory_insert" not in main_agent_tools

    # 2. Check that a group was created
    group = server.group_manager.retrieve_group(
        group_id=main_agent.multi_agent_group.id,
        actor=actor,
    )
    assert group.manager_type == ManagerType.voice_sleeptime
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
    assert "store_memories" in sleeptime_agent_tools
    assert "rethink_user_memory" in sleeptime_agent_tools
    assert "finish_rethinking_memory" in sleeptime_agent_tools

    # 5. Send a message as a sanity check
    response = await server.send_message_to_agent(
        agent_id=main_agent.id,
        actor=actor,
        input_messages=[
            MessageCreate(
                role="user",
                content="Hey there.",
            ),
        ],
        stream_steps=False,
        stream_tokens=False,
    )
    assert len(response.messages) > 0
    message_types = [type(message) for message in response.messages]
    assert ReasoningMessage in message_types
    assert AssistantMessage in message_types

    # 6. Delete agent
    server.agent_manager.delete_agent(agent_id=main_agent.id, actor=actor)

    with pytest.raises(NoResultFound):
        server.group_manager.retrieve_group(group_id=group.id, actor=actor)
    with pytest.raises(NoResultFound):
        server.agent_manager.get_agent_by_id(agent_id=sleeptime_agent_id, actor=actor)
