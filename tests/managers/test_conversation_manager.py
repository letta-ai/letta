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
