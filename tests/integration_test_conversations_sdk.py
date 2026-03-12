"""
Integration tests for the Conversations API using the SDK.
"""

import uuid

import pytest
import requests
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

        # Retrieve it (should have system message from creation)
        retrieved = client.conversations.retrieve(conversation_id=created.id)

        assert retrieved.id == created.id
        assert retrieved.agent_id == created.agent_id
        # Conversation should have 1 system message immediately after creation
        assert len(retrieved.in_context_message_ids) == 1
        assert retrieved.in_context_message_ids[0].startswith("message-")

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

    def test_agent_direct_messaging_via_conversations_endpoint(self, client: Letta, agent):
        """Test sending messages using agent ID as conversation_id (agent-direct mode).

        This allows clients to use a unified endpoint pattern without managing conversation IDs.
        """
        # Send a message using the agent ID directly as conversation_id
        # This should route to agent-direct mode with locking
        messages = list(
            client.conversations.messages.create(
                conversation_id=agent.id,  # Using agent ID instead of conversation ID
                messages=[{"role": "user", "content": "Hello via agent-direct mode!"}],
            )
        )

        # Verify we got a response
        assert len(messages) > 0, "Should receive response messages"

        # Verify we got an assistant message in the response
        assistant_messages = [m for m in messages if hasattr(m, "message_type") and m.message_type == "assistant_message"]
        assert len(assistant_messages) > 0, "Should receive at least one assistant message"

    def test_agent_direct_messaging_with_locking(self, client: Letta, agent):
        """Test that agent-direct mode properly acquires and releases locks.

        Sequential requests should both succeed if locks are properly released.
        """
        from letta.settings import settings

        # Skip if Redis is not configured
        if settings.redis_host is None or settings.redis_port is None:
            pytest.skip("Redis not configured - skipping agent-direct lock test")

        # Send first message via agent-direct mode
        messages1 = list(
            client.conversations.messages.create(
                conversation_id=agent.id,
                messages=[{"role": "user", "content": "First message"}],
            )
        )
        assert len(messages1) > 0, "First message should succeed"

        # Send second message - should succeed if lock was released
        messages2 = list(
            client.conversations.messages.create(
                conversation_id=agent.id,
                messages=[{"role": "user", "content": "Second message"}],
            )
        )
        assert len(messages2) > 0, "Second message should succeed after lock released"

    def test_agent_direct_concurrent_requests_blocked(self, client: Letta, agent):
        """Test that concurrent requests to agent-direct mode are properly serialized.

        One request should succeed and one should get a 409 CONVERSATION_BUSY error.
        """
        import concurrent.futures

        from letta_client import ConflictError

        from letta.settings import settings

        # Skip if Redis is not configured
        if settings.redis_host is None or settings.redis_port is None:
            pytest.skip("Redis not configured - skipping agent-direct lock test")

        results = {"success": 0, "conflict": 0, "other_error": 0}

        def send_message(msg: str):
            try:
                messages = list(
                    client.conversations.messages.create(
                        conversation_id=agent.id,  # Agent-direct mode
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
            future1 = executor.submit(send_message, "Concurrent message 1")
            future2 = executor.submit(send_message, "Concurrent message 2")

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
                conversation_id=agent.id,
                messages=[{"role": "user", "content": "Message after concurrent requests"}],
            )
        )
        assert len(messages) > 0, "Should be able to send message after concurrent requests complete"

    def test_agent_direct_list_messages(self, client: Letta, agent):
        """Test listing messages using agent ID as conversation_id."""
        # First send a message via agent-direct mode
        list(
            client.conversations.messages.create(
                conversation_id=agent.id,
                messages=[{"role": "user", "content": "Test message for listing"}],
            )
        )

        # List messages using agent ID
        messages_page = client.conversations.messages.list(conversation_id=agent.id)
        messages = list(messages_page)

        # Should have messages (at least system + user + assistant)
        assert len(messages) >= 3, f"Expected at least 3 messages, got {len(messages)}"

        # Verify we can find our test message
        user_messages = [m for m in messages if hasattr(m, "message_type") and m.message_type == "user_message"]
        assert any("Test message for listing" in str(m.content) for m in user_messages), "Should find our test message"

    def test_agent_direct_cancel(self, client: Letta, agent):
        """Test canceling runs using agent ID as conversation_id."""
        from letta.settings import settings

        # Skip if run tracking is disabled
        if not settings.track_agent_run:
            pytest.skip("Run tracking disabled - skipping cancel test")

        # Start a background request that we can cancel
        try:
            # Send a message in background mode
            stream = client.conversations.messages.create(
                conversation_id=agent.id,
                messages=[{"role": "user", "content": "Background message to cancel"}],
                background=True,
            )
            # Consume a bit of the stream to ensure it started
            next(iter(stream), None)

            # Cancel using agent ID
            result = client.conversations.cancel(conversation_id=agent.id)

            # Should return results (may be empty if run already completed)
            assert isinstance(result, dict), "Cancel should return a dict of results"
        except Exception as e:
            # If no active runs, that's okay - the run may have completed quickly
            if "No active runs" not in str(e):
                raise

    def test_backwards_compatibility_old_pattern(self, client: Letta, agent, server_url: str):
        """Test that the old pattern (agent_id as conversation_id) still works for backwards compatibility."""
        # OLD PATTERN: conversation_id=agent.id (should still work)
        # Use raw HTTP requests since SDK might not be up to date

        # Test 1: Send message using old pattern
        response = requests.post(
            f"{server_url}/v1/conversations/{agent.id}/messages",
            json={
                "messages": [{"role": "user", "content": "Testing old pattern still works"}],
                "streaming": False,
            },
        )
        assert response.status_code == 200, f"Old pattern should work for sending messages: {response.text}"
        data = response.json()
        assert "messages" in data, "Response should contain messages"
        assert len(data["messages"]) > 0, "Should receive response messages"

        # Test 2: List messages using old pattern
        response = requests.get(f"{server_url}/v1/conversations/{agent.id}/messages")
        assert response.status_code == 200, f"Old pattern should work for listing messages: {response.text}"
        data = response.json()
        # Response is a list of messages directly
        assert isinstance(data, list), "Response should be a list of messages"
        assert len(data) >= 3, "Should have at least system + user + assistant messages"

        # Verify our message is there
        user_messages = [m for m in data if m.get("message_type") == "user_message"]
        assert any("Testing old pattern still works" in str(m.get("content", "")) for m in user_messages), "Should find our test message"

    def test_new_pattern_send_message(self, client: Letta, agent, server_url: str):
        """Test sending messages using the new pattern: conversation_id='default' + agent_id in body."""
        # NEW PATTERN: conversation_id='default' + agent_id in request body
        response = requests.post(
            f"{server_url}/v1/conversations/default/messages",
            json={
                "agent_id": agent.id,
                "messages": [{"role": "user", "content": "Testing new pattern send message"}],
                "streaming": False,
            },
        )
        assert response.status_code == 200, f"New pattern should work for sending messages: {response.text}"
        data = response.json()
        assert "messages" in data, "Response should contain messages"
        assert len(data["messages"]) > 0, "Should receive response messages"

        # Verify we got an assistant message
        assistant_messages = [m for m in data["messages"] if m.get("message_type") == "assistant_message"]
        assert len(assistant_messages) > 0, "Should receive at least one assistant message"

    def test_new_pattern_list_messages(self, client: Letta, agent, server_url: str):
        """Test listing messages using the new pattern: conversation_id='default' + agent_id query param."""
        # First send a message to populate the conversation
        requests.post(
            f"{server_url}/v1/conversations/{agent.id}/messages",
            json={
                "messages": [{"role": "user", "content": "Setup message for list test"}],
                "streaming": False,
            },
        )

        # NEW PATTERN: conversation_id='default' + agent_id as query param
        response = requests.get(
            f"{server_url}/v1/conversations/default/messages",
            params={"agent_id": agent.id},
        )
        assert response.status_code == 200, f"New pattern should work for listing messages: {response.text}"
        data = response.json()
        # Response is a list of messages directly
        assert isinstance(data, list), "Response should be a list of messages"
        assert len(data) >= 3, "Should have at least system + user + assistant messages"

    def test_new_pattern_cancel(self, client: Letta, agent, server_url: str):
        """Test canceling runs using the new pattern: conversation_id='default' + agent_id query param."""
        from letta.settings import settings

        if not settings.track_agent_run:
            pytest.skip("Run tracking disabled - skipping cancel test")

        # NEW PATTERN: conversation_id='default' + agent_id as query param
        response = requests.post(
            f"{server_url}/v1/conversations/default/cancel",
            params={"agent_id": agent.id},
        )
        # Returns 200 with results if runs exist, or 409 if no active runs
        assert response.status_code in [200, 409], f"New pattern should work for cancel: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict), "Cancel should return a dict"

    def test_new_pattern_compact(self, client: Letta, agent, server_url: str):
        """Test compacting conversation using the new pattern: conversation_id='default' + agent_id in body."""
        # Send many messages to have enough for compaction
        for i in range(10):
            requests.post(
                f"{server_url}/v1/conversations/{agent.id}/messages",
                json={
                    "messages": [{"role": "user", "content": f"Message {i} for compaction test"}],
                    "streaming": False,
                },
            )

        # NEW PATTERN: conversation_id='default' + agent_id in request body
        response = requests.post(
            f"{server_url}/v1/conversations/default/compact",
            json={"agent_id": agent.id},
        )
        # May return 200 (success) or 400 (not enough messages to compact)
        assert response.status_code in [200, 400], f"New pattern should accept agent_id parameter: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "summary" in data, "Response should contain summary"
            assert "num_messages_before" in data, "Response should contain num_messages_before"
            assert "num_messages_after" in data, "Response should contain num_messages_after"

    def test_new_pattern_stream_retrieve(self, client: Letta, agent, server_url: str):
        """Test retrieving stream using the new pattern: conversation_id='default' + agent_id in body."""
        # NEW PATTERN: conversation_id='default' + agent_id in request body
        # Note: This will likely return 400 if no active run exists, which is expected
        response = requests.post(
            f"{server_url}/v1/conversations/default/stream",
            json={"agent_id": agent.id},
        )
        # Either 200 (if run exists) or 400 (no active run) are both acceptable
        assert response.status_code in [200, 400], f"Stream retrieve should accept new pattern: {response.text}"


class TestConversationDelete:
    """Tests for the conversation delete endpoint."""

    def test_delete_conversation(self, client: Letta, agent, server_url: str):
        """Test soft deleting a conversation."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)
        assert conversation.id is not None

        # Delete it via REST endpoint
        response = requests.delete(
            f"{server_url}/v1/conversations/{conversation.id}",
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Verify it's no longer accessible
        response = requests.get(
            f"{server_url}/v1/conversations/{conversation.id}",
        )
        assert response.status_code == 404, f"Expected 404 for deleted conversation, got {response.status_code}"

    def test_delete_conversation_removes_from_list(self, client: Letta, agent, server_url: str):
        """Test that deleted conversations don't appear in list."""
        # Create two conversations
        conv1 = client.conversations.create(agent_id=agent.id)
        conv2 = client.conversations.create(agent_id=agent.id)

        # Verify both appear in list
        conversations = client.conversations.list(agent_id=agent.id)
        conv_ids = [c.id for c in conversations]
        assert conv1.id in conv_ids
        assert conv2.id in conv_ids

        # Delete one
        response = requests.delete(
            f"{server_url}/v1/conversations/{conv1.id}",
        )
        assert response.status_code == 200

        # Verify only the non-deleted one appears in list
        conversations = client.conversations.list(agent_id=agent.id)
        conv_ids = [c.id for c in conversations]
        assert conv1.id not in conv_ids, "Deleted conversation should not appear in list"
        assert conv2.id in conv_ids, "Non-deleted conversation should still appear"

    def test_delete_conversation_not_found(self, client: Letta, agent, server_url: str):
        """Test that deleting a non-existent conversation returns 404."""
        fake_id = "conv-00000000-0000-0000-0000-000000000000"
        response = requests.delete(
            f"{server_url}/v1/conversations/{fake_id}",
        )
        assert response.status_code == 404

    def test_delete_conversation_double_delete(self, client: Letta, agent, server_url: str):
        """Test that deleting an already-deleted conversation returns 404."""
        # Create and delete a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # First delete should succeed
        response = requests.delete(
            f"{server_url}/v1/conversations/{conversation.id}",
        )
        assert response.status_code == 200

        # Second delete should return 404
        response = requests.delete(
            f"{server_url}/v1/conversations/{conversation.id}",
        )
        assert response.status_code == 404, "Double delete should return 404"

    def test_update_deleted_conversation_fails(self, client: Letta, agent, server_url: str):
        """Test that updating a deleted conversation returns 404."""
        # Create and delete a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        response = requests.delete(
            f"{server_url}/v1/conversations/{conversation.id}",
        )
        assert response.status_code == 200

        # Try to update the deleted conversation
        response = requests.patch(
            f"{server_url}/v1/conversations/{conversation.id}",
            json={"summary": "Updated summary"},
        )
        assert response.status_code == 404, "Updating deleted conversation should return 404"


class TestConversationCompact:
    """Tests for the conversation compact (summarization) endpoint."""

    def test_compact_conversation_basic(self, client: Letta, agent, server_url: str):
        """Test basic conversation compaction via the REST endpoint."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send multiple messages to create a history worth summarizing
        for i in range(5):
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": f"Message {i}: Tell me about topic {i}."}],
                )
            )

        # Get initial message count
        initial_messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )
        initial_count = len(initial_messages)
        assert initial_count >= 10  # At least 5 user + 5 assistant messages

        # Call compact endpoint via REST
        response = requests.post(
            f"{server_url}/v1/conversations/{conversation.id}/compact",
            json={},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        result = response.json()

        # Verify the response structure
        assert "summary" in result
        assert "num_messages_before" in result
        assert "num_messages_after" in result
        assert isinstance(result["summary"], str)
        assert len(result["summary"]) > 0
        assert result["num_messages_before"] > result["num_messages_after"]

        # Verify messages were actually compacted
        compacted_messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )
        assert len(compacted_messages) < initial_count

    def test_compact_conversation_creates_summary_role_message(self, client: Letta, agent, server_url: str):
        """Test that compaction creates a summary message with role='summary'."""
        # Create a conversation
        conversation = client.conversations.create(agent_id=agent.id)

        # Send multiple messages to create a history worth summarizing
        for i in range(5):
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": f"Message {i}: Tell me about topic {i}."}],
                )
            )

        # Call compact endpoint with 'all' mode to ensure a single summary
        response = requests.post(
            f"{server_url}/v1/conversations/{conversation.id}/compact",
            json={
                "compaction_settings": {
                    "mode": "all",
                }
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Get compacted messages
        compacted_messages = client.conversations.messages.list(
            conversation_id=conversation.id,
            order="asc",
        )

        # After 'all' mode compaction, we expect: system message + summary message
        # The summary message should have role='summary'
        summary_messages = [msg for msg in compacted_messages if msg.role == "summary"]
        assert len(summary_messages) == 1, (
            f"Expected exactly 1 summary message after compaction, found {len(summary_messages)}. "
            f"Message roles: {[msg.role for msg in compacted_messages]}"
        )

    def test_compact_conversation_with_settings(self, client: Letta, agent, server_url: str):
        """Test conversation compaction with custom compaction settings."""
        # Create a conversation with multiple messages
        conversation = client.conversations.create(agent_id=agent.id)

        for i in range(5):
            list(
                client.conversations.messages.create(
                    conversation_id=conversation.id,
                    messages=[{"role": "user", "content": f"Remember fact {i}: The number {i} is important."}],
                )
            )

        # Call compact with 'all' mode
        response = requests.post(
            f"{server_url}/v1/conversations/{conversation.id}/compact",
            json={
                "compaction_settings": {
                    "mode": "all",
                }
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        result = response.json()
        assert result["num_messages_before"] > result["num_messages_after"]

    def test_compact_conversation_preserves_conversation_isolation(self, client: Letta, agent, server_url: str):
        """Test that compacting one conversation doesn't affect another."""
        # Create two conversations
        conv1 = client.conversations.create(agent_id=agent.id)
        conv2 = client.conversations.create(agent_id=agent.id)

        # Add messages to both
        for i in range(5):
            list(
                client.conversations.messages.create(
                    conversation_id=conv1.id,
                    messages=[{"role": "user", "content": f"Conv1 message {i}"}],
                )
            )
            list(
                client.conversations.messages.create(
                    conversation_id=conv2.id,
                    messages=[{"role": "user", "content": f"Conv2 message {i}"}],
                )
            )

        # Get initial counts
        conv1_initial = len(client.conversations.messages.list(conversation_id=conv1.id))
        conv2_initial = len(client.conversations.messages.list(conversation_id=conv2.id))

        # Compact only conv1
        response = requests.post(
            f"{server_url}/v1/conversations/{conv1.id}/compact",
            json={},
        )
        assert response.status_code == 200

        # Conv1 should be compacted
        conv1_after = len(client.conversations.messages.list(conversation_id=conv1.id))
        assert conv1_after < conv1_initial

        # Conv2 should be unchanged
        conv2_after = len(client.conversations.messages.list(conversation_id=conv2.id))
        assert conv2_after == conv2_initial

    def test_compact_conversation_empty_fails(self, client: Letta, agent, server_url: str):
        """Test that compacting an empty conversation fails gracefully."""
        # Create a new conversation without messages
        conversation = client.conversations.create(agent_id=agent.id)

        # Try to compact - should fail since no messages exist
        response = requests.post(
            f"{server_url}/v1/conversations/{conversation.id}/compact",
            json={},
        )

        # Should return 400 because there are no in-context messages
        assert response.status_code == 400

    def test_compact_conversation_invalid_id(self, client: Letta, agent, server_url: str):
        """Test that compacting with invalid conversation ID returns 404."""
        fake_id = "conv-00000000-0000-0000-0000-000000000000"

        response = requests.post(
            f"{server_url}/v1/conversations/{fake_id}/compact",
            json={},
        )

        assert response.status_code == 404


class TestConversationSystemMessageRecompilation:
    """Tests that verify the system message is recompiled with latest memory state on new conversation creation."""

    def test_new_conversation_recompiles_system_message_with_updated_memory(self, client: Letta, server_url: str):
        """Test the full workflow:
        1. Agent is created
        2. Send message to agent (through a conversation)
        3. Modify the memory block -> check system message is NOT updated with the modified value
        4. Create a new conversation
        5. Check new conversation system message DOES have the modified value
        """
        unique_marker = f"UNIQUE_MARKER_{uuid.uuid4().hex[:8]}"

        # Step 1: Create an agent with known memory blocks
        agent = client.agents.create(
            name=f"test_sys_msg_recompile_{uuid.uuid4().hex[:8]}",
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
            memory_blocks=[
                {"label": "human", "value": "The user is a test user."},
                {"label": "persona", "value": "You are a helpful assistant."},
            ],
        )

        try:
            # Step 2: Create a conversation and send a message to it
            conv1 = client.conversations.create(agent_id=agent.id)

            list(
                client.conversations.messages.create(
                    conversation_id=conv1.id,
                    messages=[{"role": "user", "content": "Hello, just a quick test."}],
                )
            )

            # Verify the conversation has messages including a system message
            conv1_messages = client.conversations.messages.list(
                conversation_id=conv1.id,
                order="asc",
            )
            assert len(conv1_messages) >= 3  # system + user + assistant
            assert conv1_messages[0].message_type == "system_message"

            # Get the original system message content
            original_system_content = conv1_messages[0].content
            assert unique_marker not in original_system_content, "Marker should not be in original system message"

            # Step 3: Modify the memory block with a unique marker
            client.agents.blocks.update(
                agent_id=agent.id,
                block_label="human",
                value=f"The user is a test user. {unique_marker}",
            )

            # Verify the block was actually updated
            updated_block = client.agents.blocks.retrieve(agent_id=agent.id, block_label="human")
            assert unique_marker in updated_block.value

            # Check that the OLD conversation's system message is NOT updated
            conv1_messages_after_update = client.conversations.messages.list(
                conversation_id=conv1.id,
                order="asc",
            )
            old_system_content = conv1_messages_after_update[0].content
            assert unique_marker not in old_system_content, "Old conversation system message should NOT contain the updated memory value"

            # Step 4: Create a new conversation
            conv2 = client.conversations.create(agent_id=agent.id)

            # Step 5: Check the new conversation's system message has the updated value
            # The system message should be compiled at creation time with the latest memory
            conv2_retrieved = client.conversations.retrieve(conversation_id=conv2.id)
            assert len(conv2_retrieved.in_context_message_ids) == 1, (
                f"New conversation should have exactly 1 system message, got {len(conv2_retrieved.in_context_message_ids)}"
            )

            conv2_messages = client.conversations.messages.list(
                conversation_id=conv2.id,
                order="asc",
            )
            assert len(conv2_messages) >= 1
            assert conv2_messages[0].message_type == "system_message"

            new_system_content = conv2_messages[0].content
            assert unique_marker in new_system_content, (
                f"New conversation system message should contain the updated memory value '{unique_marker}', "
                f"but system message content did not include it"
            )

        finally:
            client.agents.delete(agent_id=agent.id)

    def test_conversation_creation_initializes_system_message(self, client: Letta, server_url: str):
        """Test that creating a conversation immediately initializes it with a system message."""
        agent = client.agents.create(
            name=f"test_conv_init_{uuid.uuid4().hex[:8]}",
            model="openai/gpt-4o-mini",
            embedding="openai/text-embedding-3-small",
            memory_blocks=[
                {"label": "human", "value": "Test user for system message init."},
                {"label": "persona", "value": "You are a helpful assistant."},
            ],
        )

        try:
            # Create a conversation (without sending any messages)
            conversation = client.conversations.create(agent_id=agent.id)

            # Verify the conversation has a system message immediately
            retrieved = client.conversations.retrieve(conversation_id=conversation.id)
            assert len(retrieved.in_context_message_ids) == 1, (
                f"Expected 1 system message after conversation creation, got {len(retrieved.in_context_message_ids)}"
            )

            # Verify the system message content contains memory block values
            messages = client.conversations.messages.list(
                conversation_id=conversation.id,
                order="asc",
            )
            assert len(messages) == 1
            assert messages[0].message_type == "system_message"
            assert "Test user for system message init." in messages[0].content

        finally:
            client.agents.delete(agent_id=agent.id)
