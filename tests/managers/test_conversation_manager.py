"""
Tests for ConversationManager.
"""

import pytest

from letta.orm.errors import NoResultFound
from letta.schemas.conversation import CreateConversation, UpdateConversation
from letta.server.server import SyncServer
from letta.services.conversation_manager import ConversationManager

# ======================================================================================================================
# ConversationManager Tests
# ======================================================================================================================


@pytest.fixture
def conversation_manager():
    """Create a ConversationManager instance."""
    return ConversationManager()


@pytest.mark.asyncio
async def test_create_conversation(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test creating a conversation."""
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test conversation"),
        actor=default_user,
    )

    assert conversation.id is not None
    assert conversation.agent_id == sarah_agent.id
    assert conversation.summary == "Test conversation"
    assert conversation.id.startswith("conv-")


@pytest.mark.asyncio
async def test_create_conversation_no_summary(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test creating a conversation without summary."""
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(),
        actor=default_user,
    )

    assert conversation.id is not None
    assert conversation.agent_id == sarah_agent.id
    assert conversation.summary is None


@pytest.mark.asyncio
async def test_get_conversation_by_id(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test retrieving a conversation by ID."""
    # Create a conversation
    created = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Retrieve it
    retrieved = await conversation_manager.get_conversation_by_id(
        conversation_id=created.id,
        actor=default_user,
    )

    assert retrieved.id == created.id
    assert retrieved.agent_id == created.agent_id
    assert retrieved.summary == created.summary


@pytest.mark.asyncio
async def test_get_conversation_not_found(conversation_manager, server: SyncServer, default_user):
    """Test retrieving a non-existent conversation raises error."""
    with pytest.raises(NoResultFound):
        await conversation_manager.get_conversation_by_id(
            conversation_id="conv-nonexistent",
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_list_conversations(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test listing conversations for an agent."""
    # Create multiple conversations
    for i in range(3):
        await conversation_manager.create_conversation(
            agent_id=sarah_agent.id,
            conversation_create=CreateConversation(summary=f"Conversation {i}"),
            actor=default_user,
        )

    # List them
    conversations = await conversation_manager.list_conversations(
        agent_id=sarah_agent.id,
        actor=default_user,
    )

    assert len(conversations) == 3


@pytest.mark.asyncio
async def test_list_conversations_with_limit(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test listing conversations with a limit."""
    # Create multiple conversations
    for i in range(5):
        await conversation_manager.create_conversation(
            agent_id=sarah_agent.id,
            conversation_create=CreateConversation(summary=f"Conversation {i}"),
            actor=default_user,
        )

    # List with limit
    conversations = await conversation_manager.list_conversations(
        agent_id=sarah_agent.id,
        actor=default_user,
        limit=2,
    )

    assert len(conversations) == 2


@pytest.mark.asyncio
async def test_update_conversation(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test updating a conversation."""
    # Create a conversation
    created = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Original"),
        actor=default_user,
    )

    # Update it
    updated = await conversation_manager.update_conversation(
        conversation_id=created.id,
        conversation_update=UpdateConversation(summary="Updated summary"),
        actor=default_user,
    )

    assert updated.id == created.id
    assert updated.summary == "Updated summary"


@pytest.mark.asyncio
async def test_delete_conversation(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test soft deleting a conversation."""
    # Create a conversation
    created = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="To delete"),
        actor=default_user,
    )

    # Delete it
    await conversation_manager.delete_conversation(
        conversation_id=created.id,
        actor=default_user,
    )

    # Verify it's no longer accessible
    with pytest.raises(NoResultFound):
        await conversation_manager.get_conversation_by_id(
            conversation_id=created.id,
            actor=default_user,
        )


@pytest.mark.asyncio
async def test_conversation_isolation_by_agent(conversation_manager, server: SyncServer, sarah_agent, charles_agent, default_user):
    """Test that conversations are isolated by agent."""
    # Create conversation for sarah_agent
    await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Sarah's conversation"),
        actor=default_user,
    )

    # Create conversation for charles_agent
    await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(summary="Charles's conversation"),
        actor=default_user,
    )

    # List for sarah_agent
    sarah_convos = await conversation_manager.list_conversations(
        agent_id=sarah_agent.id,
        actor=default_user,
    )
    assert len(sarah_convos) == 1
    assert sarah_convos[0].summary == "Sarah's conversation"

    # List for charles_agent
    charles_convos = await conversation_manager.list_conversations(
        agent_id=charles_agent.id,
        actor=default_user,
    )
    assert len(charles_convos) == 1
    assert charles_convos[0].summary == "Charles's conversation"


@pytest.mark.asyncio
async def test_conversation_isolation_by_organization(
    conversation_manager, server: SyncServer, sarah_agent, default_user, other_user_different_org
):
    """Test that conversations are isolated by organization."""
    # Create conversation
    created = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Other org user should not be able to access it
    with pytest.raises(NoResultFound):
        await conversation_manager.get_conversation_by_id(
            conversation_id=created.id,
            actor=other_user_different_org,
        )


# ======================================================================================================================
# Conversation Message Management Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_add_messages_to_conversation(
    conversation_manager, server: SyncServer, sarah_agent, default_user, hello_world_message_fixture
):
    """Test adding messages to a conversation."""
    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Add the message to the conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[hello_world_message_fixture.id],
        actor=default_user,
    )

    # Verify message is in conversation
    message_ids = await conversation_manager.get_message_ids_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert len(message_ids) == 1
    assert message_ids[0] == hello_world_message_fixture.id


@pytest.mark.asyncio
async def test_get_messages_for_conversation(
    conversation_manager, server: SyncServer, sarah_agent, default_user, hello_world_message_fixture
):
    """Test getting full message objects from a conversation."""
    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Add the message
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[hello_world_message_fixture.id],
        actor=default_user,
    )

    # Get full messages
    messages = await conversation_manager.get_messages_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert len(messages) == 1
    assert messages[0].id == hello_world_message_fixture.id


@pytest.mark.asyncio
async def test_message_ordering_in_conversation(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test that messages maintain their order in a conversation."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create multiple messages
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(3)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages in order
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # Verify order is maintained
    retrieved_ids = await conversation_manager.get_message_ids_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert retrieved_ids == [m.id for m in messages]


@pytest.mark.asyncio
async def test_update_in_context_messages(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test updating which messages are in context."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(3)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add all messages
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # Update to only keep first and last in context
    await conversation_manager.update_in_context_messages(
        conversation_id=conversation.id,
        in_context_message_ids=[messages[0].id, messages[2].id],
        actor=default_user,
    )

    # Verify only the selected messages are in context
    in_context_ids = await conversation_manager.get_message_ids_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert len(in_context_ids) == 2
    assert messages[0].id in in_context_ids
    assert messages[2].id in in_context_ids
    assert messages[1].id not in in_context_ids


@pytest.mark.asyncio
async def test_empty_conversation_message_ids(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test getting message IDs from an empty conversation."""
    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Empty"),
        actor=default_user,
    )

    # Get message IDs (should be empty)
    message_ids = await conversation_manager.get_message_ids_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert message_ids == []


@pytest.mark.asyncio
async def test_list_conversation_messages(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test listing messages from a conversation as LettaMessages."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages with different roles
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Hello!")],
        ),
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="assistant",
            content=[TextContent(text="Hi there!")],
        ),
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # List conversation messages (returns LettaMessages)
    letta_messages = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert len(letta_messages) == 2
    # Check message types
    message_types = [m.message_type for m in letta_messages]
    assert "user_message" in message_types
    assert "assistant_message" in message_types


@pytest.mark.asyncio
async def test_list_conversation_messages_pagination(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test pagination when listing conversation messages."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create multiple messages
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(5)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # List with limit
    letta_messages = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        limit=2,
    )
    assert len(letta_messages) == 2

    # List with after cursor (get messages after the first one)
    letta_messages_after = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        after=messages[0].id,
    )
    assert len(letta_messages_after) == 4  # Should get messages 1-4


# ======================================================================================================================
# Isolated Blocks Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_create_conversation_with_isolated_blocks(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test creating a conversation with isolated block labels."""
    # Get the agent's blocks to know what labels exist
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])
    block_labels = [block.label for block in agent_state.memory.blocks]
    assert len(block_labels) > 0, "Agent should have at least one block"

    # Create conversation with isolated blocks
    first_label = block_labels[0]
    conversation = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Test with isolated blocks",
            isolated_block_labels=[first_label],
        ),
        actor=default_user,
    )

    assert conversation.id is not None
    assert conversation.agent_id == charles_agent.id
    assert len(conversation.isolated_block_ids) == 1

    # Verify the isolated block was created
    isolated_blocks = await conversation_manager.get_isolated_blocks_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )
    assert first_label in isolated_blocks
    assert isolated_blocks[first_label].label == first_label


@pytest.mark.asyncio
async def test_isolated_blocks_have_different_ids(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that isolated blocks have different IDs from agent's original blocks."""
    # Get the agent's blocks
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])
    original_block = agent_state.memory.blocks[0]

    # Create conversation with isolated block
    conversation = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Test isolated block IDs",
            isolated_block_labels=[original_block.label],
        ),
        actor=default_user,
    )

    # Get the isolated blocks
    isolated_blocks = await conversation_manager.get_isolated_blocks_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    # Verify the isolated block has a different ID
    isolated_block = isolated_blocks[original_block.label]
    assert isolated_block.id != original_block.id
    assert isolated_block.label == original_block.label
    assert isolated_block.value == original_block.value  # Same initial value


@pytest.mark.asyncio
async def test_isolated_blocks_are_conversation_specific(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that isolated blocks are specific to each conversation."""
    # Get the agent's first block label
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])
    block_label = agent_state.memory.blocks[0].label

    # Create two conversations with the same isolated block label
    conv1 = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Conversation 1",
            isolated_block_labels=[block_label],
        ),
        actor=default_user,
    )

    conv2 = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Conversation 2",
            isolated_block_labels=[block_label],
        ),
        actor=default_user,
    )

    # Get isolated blocks for both conversations
    isolated_blocks_1 = await conversation_manager.get_isolated_blocks_for_conversation(
        conversation_id=conv1.id,
        actor=default_user,
    )
    isolated_blocks_2 = await conversation_manager.get_isolated_blocks_for_conversation(
        conversation_id=conv2.id,
        actor=default_user,
    )

    # Verify they have different block IDs
    block_1 = isolated_blocks_1[block_label]
    block_2 = isolated_blocks_2[block_label]
    assert block_1.id != block_2.id


@pytest.mark.asyncio
async def test_create_conversation_invalid_block_label(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that creating a conversation with non-existent block label raises error."""
    from letta.errors import LettaInvalidArgumentError

    with pytest.raises(LettaInvalidArgumentError) as exc_info:
        await conversation_manager.create_conversation(
            agent_id=charles_agent.id,
            conversation_create=CreateConversation(
                summary="Test invalid label",
                isolated_block_labels=["nonexistent_block_label"],
            ),
            actor=default_user,
        )

    assert "nonexistent_block_label" in str(exc_info.value)


@pytest.mark.asyncio
async def test_apply_isolated_blocks_to_agent_state(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that isolated blocks are correctly applied to agent state."""
    # Get the original agent state
    original_agent_state = await server.agent_manager.get_agent_by_id_async(
        charles_agent.id, default_user, include_relationships=["memory"]
    )
    original_block = original_agent_state.memory.blocks[0]

    # Create conversation with isolated block
    conversation = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Test apply isolated blocks",
            isolated_block_labels=[original_block.label],
        ),
        actor=default_user,
    )

    # Get fresh agent state
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])

    # Apply isolated blocks
    modified_state = await conversation_manager.apply_isolated_blocks_to_agent_state(
        agent_state=agent_state,
        conversation_id=conversation.id,
        actor=default_user,
    )

    # Verify the block was replaced
    modified_block = modified_state.memory.get_block(original_block.label)
    assert modified_block.id != original_block.id
    assert modified_block.label == original_block.label
    assert modified_block.id in conversation.isolated_block_ids


@pytest.mark.asyncio
async def test_conversation_without_isolated_blocks(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test that creating a conversation without isolated blocks works normally."""
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="No isolated blocks"),
        actor=default_user,
    )

    assert conversation.id is not None
    assert conversation.isolated_block_ids == []

    isolated_blocks = await conversation_manager.get_isolated_blocks_for_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )
    assert isolated_blocks == {}


@pytest.mark.asyncio
async def test_apply_no_isolated_blocks_preserves_state(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that applying isolated blocks to a conversation without them preserves original state."""
    # Create conversation without isolated blocks
    conversation = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(summary="No isolated blocks"),
        actor=default_user,
    )

    # Get agent state
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])
    original_block_ids = [block.id for block in agent_state.memory.blocks]

    # Apply isolated blocks (should be a no-op)
    modified_state = await conversation_manager.apply_isolated_blocks_to_agent_state(
        agent_state=agent_state,
        conversation_id=conversation.id,
        actor=default_user,
    )

    # Verify blocks are unchanged
    modified_block_ids = [block.id for block in modified_state.memory.blocks]
    assert original_block_ids == modified_block_ids


@pytest.mark.asyncio
async def test_delete_conversation_cleans_up_isolated_blocks(conversation_manager, server: SyncServer, charles_agent, default_user):
    """Test that deleting a conversation also hard-deletes its isolated blocks."""
    # Get the agent's first block label
    agent_state = await server.agent_manager.get_agent_by_id_async(charles_agent.id, default_user, include_relationships=["memory"])
    block_label = agent_state.memory.blocks[0].label

    # Create conversation with isolated block
    conversation = await conversation_manager.create_conversation(
        agent_id=charles_agent.id,
        conversation_create=CreateConversation(
            summary="Test delete cleanup",
            isolated_block_labels=[block_label],
        ),
        actor=default_user,
    )

    # Get the isolated block ID
    isolated_block_ids = conversation.isolated_block_ids
    assert len(isolated_block_ids) == 1
    isolated_block_id = isolated_block_ids[0]

    # Verify the isolated block exists
    isolated_block = await server.block_manager.get_block_by_id_async(isolated_block_id, default_user)
    assert isolated_block is not None

    # Delete the conversation
    await conversation_manager.delete_conversation(
        conversation_id=conversation.id,
        actor=default_user,
    )

    # Verify the isolated block was hard-deleted
    deleted_block = await server.block_manager.get_block_by_id_async(isolated_block_id, default_user)
    assert deleted_block is None


# ======================================================================================================================
# list_conversation_messages with order/reverse Tests
# ======================================================================================================================


@pytest.mark.asyncio
async def test_list_conversation_messages_ascending_order(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test listing messages in ascending order (oldest first)."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages in a known order
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(3)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # List messages in ascending order (reverse=False)
    letta_messages = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        reverse=False,
    )

    # First message should be "Message 0" (oldest)
    assert len(letta_messages) == 3
    assert "Message 0" in letta_messages[0].content


@pytest.mark.asyncio
async def test_list_conversation_messages_descending_order(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test listing messages in descending order (newest first)."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages in a known order
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(3)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # List messages in descending order (reverse=True)
    letta_messages = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        reverse=True,
    )

    # First message should be "Message 2" (newest)
    assert len(letta_messages) == 3
    assert "Message 2" in letta_messages[0].content


@pytest.mark.asyncio
async def test_list_conversation_messages_with_group_id_filter(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test filtering messages by group_id."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages with different group_ids
    group_a_id = "group-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    group_b_id = "group-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    messages_group_a = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Group A message 1")],
            group_id=group_a_id,
        ),
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Group A message 2")],
            group_id=group_a_id,
        ),
    ]
    messages_group_b = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Group B message 1")],
            group_id=group_b_id,
        ),
    ]

    created_a = await server.message_manager.create_many_messages_async(messages_group_a, actor=default_user)
    created_b = await server.message_manager.create_many_messages_async(messages_group_b, actor=default_user)

    # Add all messages to conversation
    all_message_ids = [m.id for m in created_a] + [m.id for m in created_b]
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=all_message_ids,
        actor=default_user,
    )

    # List messages filtered by group A
    messages_a = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        group_id=group_a_id,
    )

    assert len(messages_a) == 2
    for msg in messages_a:
        assert "Group A" in msg.content

    # List messages filtered by group B
    messages_b = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        group_id=group_b_id,
    )

    assert len(messages_b) == 1
    assert "Group B" in messages_b[0].content


@pytest.mark.asyncio
async def test_list_conversation_messages_no_group_id_returns_all(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test that not providing group_id returns all messages."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages with different group_ids
    group_a_id = "group-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    group_b_id = "group-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Group A message")],
            group_id=group_a_id,
        ),
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="Group B message")],
            group_id=group_b_id,
        ),
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text="No group message")],
            group_id=None,
        ),
    ]
    messages = await server.message_manager.create_many_messages_async(pydantic_messages, actor=default_user)

    # Add all messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # List all messages without group_id filter
    all_messages = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
    )

    assert len(all_messages) == 3


@pytest.mark.asyncio
async def test_list_conversation_messages_order_with_pagination(conversation_manager, server: SyncServer, sarah_agent, default_user):
    """Test that order affects pagination correctly."""
    from letta.schemas.letta_message_content import TextContent
    from letta.schemas.message import Message as PydanticMessage

    # Create a conversation
    conversation = await conversation_manager.create_conversation(
        agent_id=sarah_agent.id,
        conversation_create=CreateConversation(summary="Test"),
        actor=default_user,
    )

    # Create messages
    pydantic_messages = [
        PydanticMessage(
            agent_id=sarah_agent.id,
            role="user",
            content=[TextContent(text=f"Message {i}")],
        )
        for i in range(5)
    ]
    messages = await server.message_manager.create_many_messages_async(
        pydantic_messages,
        actor=default_user,
    )

    # Add messages to conversation
    await conversation_manager.add_messages_to_conversation(
        conversation_id=conversation.id,
        agent_id=sarah_agent.id,
        message_ids=[m.id for m in messages],
        actor=default_user,
    )

    # Get first page in ascending order with limit
    page_asc = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        reverse=False,
        limit=2,
    )

    # Get first page in descending order with limit
    page_desc = await conversation_manager.list_conversation_messages(
        conversation_id=conversation.id,
        actor=default_user,
        reverse=True,
        limit=2,
    )

    # The first messages should be different
    assert page_asc[0].content != page_desc[0].content
    # In ascending, first should be "Message 0"
    assert "Message 0" in page_asc[0].content
    # In descending, first should be "Message 4"
    assert "Message 4" in page_desc[0].content
