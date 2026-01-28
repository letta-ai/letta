"""
Integration tests for the Conversations API using the SDK.
"""

import uuid
from time import sleep

import pytest
from letta_client import Letta


@pytest.fixture
def client(server_url: str) -> Letta:
    """Create a Letta client."""
    return Letta(base_url=server_url)


@pytest.fixture
def agent(client: Letta):
    """Create a test agent."""
    agent_state = client.agents.create(
        name=f"test_conversations_{uuid.uuid4().hex[:8]}",
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small",
        memory_blocks=[
            {"label": "human", "value": "Test user"},
            {"label": "persona", "value": "You are a helpful assistant."},
        ],
    )
    yield agent_state
    # Cleanup
    client.agents.delete(agent_id=agent_state.id)


class TestConversationsSDK:
    """Test conversations using the SDK client."""

    def test_create_conversation(self, client: Letta, agent):
        """Test creating a conversation for an agent."""
        conversation = client.conversations.create(agent_id=agent.id)

        assert conversation.id is not None
        assert conversation.id.startswith("conv-")
        assert conversation.agent_id == agent.id

    def test_list_conversations(self, client: Letta, agent):
        """Test listing conversations for an agent."""
        # Create multiple conversations
        conv1 = client.conversations.create(agent_id=agent.id)
        conv2 = client.conversations.create(agent_id=agent.id)

        # List conversations
        conversations = client.conversations.list(agent_id=agent.id)

        assert len(conversations) >= 2
        conv_ids = [c.id for c in conversations]
        assert conv1.id in conv_ids
        assert conv2.id in conv_ids

    def test_retrieve_conversation(self, client: Letta, agent):
        """Test retrieving a specific conversation."""
        # Create a conversation
        created = client.conversations.create(agent_id=agent.id)

        # Retrieve it (should have empty in_context_message_ids initially)
        retrieved = client.conversations.retrieve(conversation_id=created.id)

        assert retrieved.id == created.id
        assert retrieved.agent_id == created.agent_id
        assert retrieved.in_context_message_ids == []

        # Send a message to the conversation
        list(
            client.conversations.messages.create(
                conversation_id=created.id,
                messages=[{"role": "user", "content": "Hello!"}],
            )
        )

        # Retrieve again and check in_context_message_ids is populated
        retrieved_with_messages = client.conversations.retrieve(conversation_id=created.id)

        # System message + user + assistant messages should be in the conversation
        assert len(retrieved_with_messages.in_context_message_ids) >= 3  # system + user + assistant
        # All IDs should be strings starting with "message-"
        for msg_id in retrieved_with_messages.in_context_message_ids:
            assert isinstance(msg_id, str)
            assert msg_id.startswith("message-")

        # Verify message ordering by listing messages
        messages = client.conversations.messages.list(conversation_id=created.id)
        assert len(messages) >= 3  # system + user + assistant
        # First message should be system message (shared across conversations)
        assert messages[0].message_type == "system_message", f"First message should be system_message, got {messages[0].message_type}"
        # Second message should be user message
        assert messages[1].message_type == "user_message", f"Second message should be user_message, got {messages[1].message_type}"

    def test_send_message_to_conversation(self, client: Letta, agent):
        """Test sending a message to a conversation."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send a message (returns a stream)
        stream = client.conversations.messages.create(
            conversation_id=conversation.id,
            messages=[{"role": "user", "content": "Hello, how are you?"}],
        )

        # Consume the stream to get messages
        messages = list(stream)

        # Check response contains messages
        assert len(messages) > 0
        # Should have at least an assistant message
        message_types = [m.message_type for m in messages if hasattr(m, "message_type")]
        assert "assistant_message" in message_types

    def test_list_conversation_messages(self, client: Letta, agent):
        """Test listing messages from a conversation."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send a message to create some history (consume the stream)
        stream = client.conversations.messages.create(
            conversation_id=conversation.id,
            messages=[{"role": "user", "content": "Say 'test response' back to me."}],
        )
        list(stream)  # Consume stream

        # List messages
        messages = client.conversations.messages.list(conversation_id=conversation.id)

        assert len(messages) >= 2  # At least user + assistant
        message_types = [m.message_type for m in messages]
        assert "user_message" in message_types
        assert "assistant_message" in message_types

        # Send another message and check that old and new messages are both listed
        first_message_count = len(messages)
        stream = client.conversations.messages.create(
            conversation_id=conversation.id,
            messages=[{"role": "user", "content": "This is a follow-up message."}],
        )
        list(stream)  # Consume stream

        # List messages again
        updated_messages = client.conversations.messages.list(conversation_id=conversation.id)

        # Should have more messages now (at least 2 more: user + assistant)
        assert len(updated_messages) >= first_message_count + 2

    def test_conversation_isolation(self, client: Letta, agent):
        """Test that conversations are isolated from each other."""
        # Create two conversations
        conv1 = client.conversations.create(agent_id=agent.id)
        conv2 = client.conversations.create(agent_id=agent.id)

        # Send different messages to each (consume streams)
        list(
            client.conversations.messages.create(
                conversation_id=conv1.id,
                messages=[{"role": "user", "content": "Remember the word: APPLE"}],
            )
        )
        list(
            client.conversations.messages.create(
                conversation_id=conv2.id,
                messages=[{"role": "user", "content": "Remember the word: BANANA"}],
            )
        )

        # List messages from each conversation
        conv1_messages = client.conversations.messages.list(conversation_id=conv1.id)
        conv2_messages = client.conversations.messages.list(conversation_id=conv2.id)

        # Check messages are separate
        conv1_content = " ".join([m.content for m in conv1_messages if hasattr(m, "content") and m.content])
        conv2_content = " ".join([m.content for m in conv2_messages if hasattr(m, "content") and m.content])

        assert "APPLE" in conv1_content
        assert "BANANA" in conv2_content
        # Each conversation should only have its own word
        assert "BANANA" not in conv1_content or "APPLE" not in conv2_content

        # Ask what word was remembered and make sure it's different for each conversation
        conv1_recall = list(
            client.conversations.messages.create(
                conversation_id=conv1.id,
                messages=[{"role": "user", "content": "What word did I ask you to remember? Reply with just the word."}],
            )
        )
        conv2_recall = list(
            client.conversations.messages.create(
                conversation_id=conv2.id,
                messages=[{"role": "user", "content": "What word did I ask you to remember? Reply with just the word."}],
            )
        )

        # Get the assistant responses
        conv1_response = " ".join([m.content for m in conv1_recall if hasattr(m, "message_type") and m.message_type == "assistant_message"])
        conv2_response = " ".join([m.content for m in conv2_recall if hasattr(m, "message_type") and m.message_type == "assistant_message"])

        assert "APPLE" in conv1_response.upper(), f"Conv1 should remember APPLE, got: {conv1_response}"
        assert "BANANA" in conv2_response.upper(), f"Conv2 should remember BANANA, got: {conv2_response}"

        # Each conversation has its own system message (created on first message)
        conv1_system_id = conv1_messages[0].id
        conv2_system_id = conv2_messages[0].id
        assert conv1_system_id != conv2_system_id, "System messages should have different IDs for different conversations"

    def test_conversation_messages_pagination(self, client: Letta, agent):
        """Test pagination when listing conversation messages."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send multiple messages to create history (consume streams)
        for i in range(3):
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": f"Message number {i}"}],
                )
            )

        # List with limit
        messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            limit=2,
        )

        # Should respect the limit
        assert len(messages) <= 2

    def test_retrieve_conversation_stream_no_active_run(self, client: Letta, agent):
        """Test that retrieve_conversation_stream returns error when no active run exists."""
        from letta_client import BadRequestError

        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Try to retrieve stream when no run exists (should fail)
        with pytest.raises(BadRequestError) as exc_info:
            # Use the SDK's stream method
            stream = client.conversations.messages.stream(conversation_id=conversation.id)
            list(stream)  # Consume the stream to trigger the error

        # Should return 400 because no active run exists
        assert "No active runs found" in str(exc_info.value)

    def test_retrieve_conversation_stream_after_completed_run(self, client: Letta, agent):
        """Test that retrieve_conversation_stream returns error when run is completed."""
        from letta_client import BadRequestError

        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send a message (this creates a run that completes)
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Hello"}],
            )
        )

        # Try to retrieve stream after the run has completed (should fail)
        with pytest.raises(BadRequestError) as exc_info:
            # Use the SDK's stream method
            stream = client.conversations.messages.stream(conversation_id=conversation.id)
            list(stream)  # Consume the stream to trigger the error

        # Should return 400 because no active run exists (run is completed)
        assert "No active runs found" in str(exc_info.value)

    def test_conversation_lock_released_after_completion(self, client: Letta, agent):
        """Test that lock is released after request completes by sending sequential messages."""
        from letta.settings import settings

        # Skip if Redis is not configured
        if settings.redis_host is None or settings.redis_port is None:
            pytest.skip("Redis not configured - skipping conversation lock test")

        conversation = client.conversations.create(agent_id=agent.id)

        # Send first message (should acquire and release lock)
        messages1 = list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Hello"}],
            )
        )
        assert len(messages1) > 0

        # Send second message - should succeed if lock was released
        messages2 = list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Hello again"}],
            )
        )
        assert len(messages2) > 0

    def test_conversation_lock_released_on_error(self, client: Letta, agent):
        """Test that lock is released even when the run encounters an error.

        This test sends a message that triggers an error during streaming (by causing
        a context window exceeded error with a very long message), then verifies the
        lock is properly released by successfully sending another message.
        """
        from letta.settings import settings

        # Skip if Redis is not configured
        if settings.redis_host is None or settings.redis_port is None:
            pytest.skip("Redis not configured - skipping conversation lock test")

        conversation = client.conversations.create(agent_id=agent.id)

        # Try to send a message that will cause an error during processing
        # We use an extremely long message to trigger a context window error
        very_long_message = "Hello " * 100000  # Very long message to exceed context window

        try:
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": very_long_message}],
                )
            )
        except Exception:
            pass  # Expected to fail due to context window exceeded

        # Send another message - should succeed if lock was released after error
        messages = list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Hello after error"}],
            )
        )
        assert len(messages) > 0, "Lock should be released even after run error"

    def test_concurrent_messages_to_same_conversation(self, client: Letta, agent):
        """Test that concurrent messages to the same conversation are properly serialized.

        One request should succeed and one should get a 409 CONVERSATION_BUSY error.
        After both return, a subsequent message should succeed.
        """
        import concurrent.futures

        from letta_client import ConflictError

        from letta.settings import settings

        # Skip if Redis is not configured
        if settings.redis_host is None or settings.redis_port is None:
            pytest.skip("Redis not configured - skipping conversation lock test")

        conversation = client.conversations.create(agent_id=agent.id)

        results = {"success": 0, "conflict": 0, "other_error": 0}

        def send_message(msg: str):
            try:
                messages = list(
                    client.conversations.messages.create(
                        conversation_id=conversation.id,
                        messages=[{"role": "user", "content": msg}],
                    )
                )
                return ("success", messages)
            except ConflictError:
                return ("conflict", None)
            except Exception as e:
                return ("other_error", str(e))

        # Fire off two messages concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(send_message, "Message 1")
            future2 = executor.submit(send_message, "Message 2")

            result1 = future1.result()
            result2 = future2.result()

        # Count results
        for result_type, _ in [result1, result2]:
            results[result_type] += 1

        # One should succeed and one should get conflict
        assert results["success"] == 1, f"Expected 1 success, got {results['success']}"
        assert results["conflict"] == 1, f"Expected 1 conflict, got {results['conflict']}"
        assert results["other_error"] == 0, f"Unexpected errors: {results['other_error']}"

        # Now send another message - should succeed since lock is released
        messages = list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Message after concurrent requests"}],
            )
        )
        assert len(messages) > 0, "Should be able to send message after concurrent requests complete"

    def test_list_conversation_messages_order_asc(self, client: Letta, agent):
        """Test listing messages in ascending order (oldest first)."""
        conversation = client.conversations.create(agent_id=agent.id)

        # Send messages to create history
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "First message"}],
            )
        )
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Second message"}],
            )
        )

        # List messages in ascending order (oldest first)
        messages_asc = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )

        # First message should be system message (oldest)
        assert messages_asc[0].message_type == "system_message"

        # Get user messages and verify order
        user_messages = [m for m in messages_asc if m.message_type == "user_message"]
        assert len(user_messages) >= 2
        # First user message should contain "First message"
        assert "First" in user_messages[0].content

    def test_list_conversation_messages_order_desc(self, client: Letta, agent):
        """Test listing messages in descending order (newest first)."""
        conversation = client.conversations.create(agent_id=agent.id)

        # Send messages to create history
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "First message"}],
            )
        )
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Second message"}],
            )
        )

        # List messages in descending order (newest first) - this is the default
        messages_desc = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="desc",
        )

        # Get user messages and verify order
        user_messages = [m for m in messages_desc if m.message_type == "user_message"]
        assert len(user_messages) >= 2
        # First user message in desc order should contain "Second message" (newest)
        assert "Second" in user_messages[0].content

    def test_list_conversation_messages_order_affects_pagination(self, client: Letta, agent):
        """Test that order parameter affects pagination correctly."""
        conversation = client.conversations.create(agent_id=agent.id)

        # Send multiple messages
        for i in range(3):
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": f"Message {i}"}],
                )
            )

        # Get all messages in descending order with limit
        messages_desc = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="desc",
            limit=5,
        )

        # Get all messages in ascending order with limit
        messages_asc = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
            limit=5,
        )

        # The first messages should be different based on order
        assert messages_desc[0].id != messages_asc[0].id

    def test_list_conversation_messages_with_before_cursor(self, client: Letta, agent):
        """Test pagination with before cursor."""
        conversation = client.conversations.create(agent_id=agent.id)

        # Send messages to create history
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "First message"}],
            )
        )
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Second message"}],
            )
        )

        # Get all messages first
        all_messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )
        assert len(all_messages) >= 4  # system + user + assistant + user + assistant

        # Use the last message ID as cursor
        last_message_id = all_messages[-1].id
        messages_before = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
            before=last_message_id,
        )

        # Should have fewer messages (all except the last one)
        assert len(messages_before) < len(all_messages)
        # Should not contain the cursor message
        assert last_message_id not in [m.id for m in messages_before]

    def test_list_conversation_messages_with_after_cursor(self, client: Letta, agent):
        """Test pagination with after cursor."""
        conversation = client.conversations.create(agent_id=agent.id)

        # Send messages to create history
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "First message"}],
            )
        )
        list(
            client.conversations.messages.create(
                conversation_id=conversation.id,
                messages=[{"role": "user", "content": "Second message"}],
            )
        )

        # Get all messages first
        all_messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )
        assert len(all_messages) >= 4

        # Use the first message ID as cursor
        first_message_id = all_messages[0].id
        messages_after = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
            after=first_message_id,
        )

        # Should have fewer messages (all except the first one)
        assert len(messages_after) < len(all_messages)
        # Should not contain the cursor message
        assert first_message_id not in [m.id for m in messages_after]
