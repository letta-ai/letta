import pytest

# Import shared fixtures and constants from conftest
from letta.orm.errors import UniqueConstraintViolationError
from letta.schemas.agent import CreateAgent, UpdateAgent
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityPropertyType, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.llm_config import LLMConfig
from letta.server.server import SyncServer
from letta.services.block_manager import BlockManager

# ======================================================================================================================
# Identity Manager Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_and_upsert_identity(server: SyncServer, default_user):
    identity_create = IdentityCreate(
        identifier_key="1234",
        name="caren",
        identity_type=IdentityType.user,
        properties=[
            IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string),
            IdentityProperty(key="age", value=28, type=IdentityPropertyType.number),
        ],
    )

    identity = await server.identity_manager.create_identity_async(identity_create, actor=default_user)

    # Assertions to ensure the created identity matches the expected values
    assert identity.identifier_key == identity_create.identifier_key
    assert identity.name == identity_create.name
    assert identity.identity_type == identity_create.identity_type
    assert identity.properties == identity_create.properties
    assert identity.agent_ids == []
    assert identity.project_id is None

    with pytest.raises(UniqueConstraintViolationError):
        await server.identity_manager.create_identity_async(
            IdentityCreate(identifier_key="1234", name="sarah", identity_type=IdentityType.user),
            actor=default_user,
        )

    identity_create.properties = [IdentityProperty(key="age", value=29, type=IdentityPropertyType.number)]

    identity = await server.identity_manager.upsert_identity_async(
        identity=IdentityUpsert(**identity_create.model_dump()), actor=default_user
    )

    identity = await server.identity_manager.get_identity_async(identity_id=identity.id, actor=default_user)
    assert len(identity.properties) == 1
    assert identity.properties[0].key == "age"
    assert identity.properties[0].value == 29

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


async def test_get_identities(server, default_user):
    # Create identities to retrieve later
    user = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )
    org = await server.identity_manager.create_identity_async(
        IdentityCreate(name="letta", identifier_key="0001", identity_type=IdentityType.org), actor=default_user
    )

    # Retrieve identities by different filters
    all_identities, _, _ = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(all_identities) == 2

    user_identities, _, _ = await server.identity_manager.list_identities_async(actor=default_user, identity_type=IdentityType.user)
    assert len(user_identities) == 1
    assert user_identities[0].name == user.name

    org_identities, _, _ = await server.identity_manager.list_identities_async(actor=default_user, identity_type=IdentityType.org)
    assert len(org_identities) == 1
    assert org_identities[0].name == org.name

    await server.identity_manager.delete_identity_async(identity_id=user.id, actor=default_user)
    await server.identity_manager.delete_identity_async(identity_id=org.id, actor=default_user)


@pytest.mark.asyncio
async def test_update_identity(server: SyncServer, sarah_agent, charles_agent, default_user):
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )

    # Update identity fields
    update_data = IdentityUpdate(
        agent_ids=[sarah_agent.id, charles_agent.id],
        properties=[IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string)],
    )
    await server.identity_manager.update_identity_async(identity_id=identity.id, identity=update_data, actor=default_user)

    # Retrieve the updated identity
    updated_identity = await server.identity_manager.get_identity_async(identity_id=identity.id, actor=default_user)

    # Assertions to verify the update
    assert updated_identity.agent_ids.sort() == update_data.agent_ids.sort()
    assert updated_identity.properties == update_data.properties

    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert identity.id in agent_state.identity_ids
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=charles_agent.id, actor=default_user)
    assert identity.id in agent_state.identity_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_detach_identity_from_agent(server: SyncServer, sarah_agent, default_user):
    # Create an identity
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user), actor=default_user
    )
    agent_state = await server.agent_manager.update_agent_async(
        agent_id=sarah_agent.id, agent_update=UpdateAgent(identity_ids=[identity.id]), actor=default_user
    )

    # Check that identity has been attached
    assert identity.id in agent_state.identity_ids

    # Now attempt to delete the identity
    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)

    # Verify that the identity was deleted
    identities, _, _ = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(identities) == 0

    # Check that block has been detached too
    agent_state = await server.agent_manager.get_agent_by_id_async(agent_id=sarah_agent.id, actor=default_user)
    assert identity.id not in agent_state.identity_ids


@pytest.mark.asyncio
async def test_get_set_agents_for_identities(server: SyncServer, sarah_agent, charles_agent, default_user):
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user, agent_ids=[sarah_agent.id, charles_agent.id]),
        actor=default_user,
    )

    agent_with_identity = await server.create_agent_async(
        CreateAgent(
            agent_type="memgpt_v2_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            identity_ids=[identity.id],
            include_base_tools=False,
        ),
        actor=default_user,
    )
    agent_without_identity = await server.create_agent_async(
        CreateAgent(
            agent_type="memgpt_v2_agent",
            memory_blocks=[],
            llm_config=LLMConfig.default_config("gpt-4o-mini"),
            embedding_config=EmbeddingConfig.default_config(provider="openai"),
            include_base_tools=False,
        ),
        actor=default_user,
    )

    # Get the agents for identity id
    agent_states = await server.agent_manager.list_agents_async(identity_id=identity.id, actor=default_user)
    assert len(agent_states) == 3

    # Check all agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids
    assert agent_with_identity.id in agent_state_ids
    assert agent_without_identity.id not in agent_state_ids

    # Get the agents for identifier key
    agent_states = await server.agent_manager.list_agents_async(identifier_keys=[identity.identifier_key], actor=default_user)
    assert len(agent_states) == 3

    # Check all agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids
    assert agent_with_identity.id in agent_state_ids
    assert agent_without_identity.id not in agent_state_ids

    # Delete new agents
    await server.agent_manager.delete_agent_async(agent_id=agent_with_identity.id, actor=default_user)
    await server.agent_manager.delete_agent_async(agent_id=agent_without_identity.id, actor=default_user)

    # Get the agents for identity id
    agent_states = await server.agent_manager.list_agents_async(identity_id=identity.id, actor=default_user)
    assert len(agent_states) == 2

    # Check only initial agents are in the list
    agent_state_ids = [a.id for a in agent_states]
    assert sarah_agent.id in agent_state_ids
    assert charles_agent.id in agent_state_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_upsert_properties(server: SyncServer, default_user):
    identity_create = IdentityCreate(
        identifier_key="1234",
        name="caren",
        identity_type=IdentityType.user,
        properties=[
            IdentityProperty(key="email", value="caren@letta.com", type=IdentityPropertyType.string),
            IdentityProperty(key="age", value=28, type=IdentityPropertyType.number),
        ],
    )

    identity = await server.identity_manager.create_identity_async(identity_create, actor=default_user)
    properties = [
        IdentityProperty(key="email", value="caren@gmail.com", type=IdentityPropertyType.string),
        IdentityProperty(key="age", value="28", type=IdentityPropertyType.string),
        IdentityProperty(key="test", value=123, type=IdentityPropertyType.number),
    ]

    updated_identity = await server.identity_manager.upsert_identity_properties_async(
        identity_id=identity.id,
        properties=properties,
        actor=default_user,
    )
    assert updated_identity.properties == properties

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)


@pytest.mark.asyncio
async def test_attach_detach_identity_from_block(server: SyncServer, default_block, default_user):
    # Create an identity
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(name="caren", identifier_key="1234", identity_type=IdentityType.user, block_ids=[default_block.id]),
        actor=default_user,
    )

    # Check that identity has been attached
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 1 and blocks[0].id == default_block.id

    # Now attempt to delete the identity
    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)

    # Verify that the identity was deleted
    identities, _, _ = await server.identity_manager.list_identities_async(actor=default_user)
    assert len(identities) == 0

    # Check that block has been detached too
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 0


@pytest.mark.asyncio
async def test_get_set_blocks_for_identities(server: SyncServer, default_block, default_user):
    block_manager = BlockManager()
    block_with_identity = await block_manager.create_or_update_block_async(
        PydanticBlock(label="persona", value="Original Content"), actor=default_user
    )
    block_without_identity = await block_manager.create_or_update_block_async(
        PydanticBlock(label="user", value="Original Content"), actor=default_user
    )
    identity = await server.identity_manager.create_identity_async(
        IdentityCreate(
            name="caren", identifier_key="1234", identity_type=IdentityType.user, block_ids=[default_block.id, block_with_identity.id]
        ),
        actor=default_user,
    )

    # Get the blocks for identity id
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 2

    # Check blocks are in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert block_with_identity.id in block_ids
    assert block_without_identity.id not in block_ids

    # Get the blocks for identifier key
    blocks = await server.block_manager.get_blocks_async(identifier_keys=[identity.identifier_key], actor=default_user)
    assert len(blocks) == 2

    # Check blocks are in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert block_with_identity.id in block_ids
    assert block_without_identity.id not in block_ids

    # Delete new agents
    await server.block_manager.delete_block_async(block_id=block_with_identity.id, actor=default_user)
    await server.block_manager.delete_block_async(block_id=block_without_identity.id, actor=default_user)

    # Get the blocks for identity id
    blocks = await server.block_manager.get_blocks_async(identity_id=identity.id, actor=default_user)
    assert len(blocks) == 1

    # Check only initial block in the list
    block_ids = [b.id for b in blocks]
    assert default_block.id in block_ids
    assert block_with_identity.id not in block_ids
    assert block_without_identity.id not in block_ids

    await server.identity_manager.delete_identity_async(identity_id=identity.id, actor=default_user)
