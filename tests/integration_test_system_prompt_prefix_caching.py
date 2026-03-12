"""
Integration tests for system prompt prefix caching optimization.

These tests verify that the system prompt is NOT rebuilt on every step,
only after compaction or message reset. This helps preserve prefix caching
for LLM providers.
"""

import pytest
from letta_client import Letta


@pytest.fixture(scope="module")
def client(server_url: str) -> Letta:
    """Creates and returns a synchronous Letta REST client for testing."""
    return Letta(base_url=server_url)


@pytest.fixture(scope="function")
def agent(client: Letta):
    """Create a test agent and clean up after test."""
    agent_state = client.agents.create(
        name="test-prefix-cache-agent",
        include_base_tools=True,
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-ada-002",
    )
    yield agent_state
    # Cleanup
    try:
        client.agents.delete(agent_state.id)
    except Exception:
        pass


class TestSystemPromptPrefixCaching:
    """Test that system prompt stays stable during normal agent execution."""

    def test_system_prompt_stable_after_memory_tool_and_messages(self, client: Letta, agent):
        """
        Test workflow:
        1. Get initial system prompt and human block value
        2. Tell agent to update its memory block using the memory tool
        3. Verify block was modified but system prompt hasn't changed
        4. Send another message to the agent
        5. Verify system prompt still hasn't changed
        6. Manually update a block via API
        7. Send another message and verify system prompt still hasn't changed
           (memory block changes are deferred to compaction)
        """
        # Step 1: Get initial context window, system prompt, and human block value
        initial_context = client.agents.context.retrieve(agent.id)
        initial_system_prompt = initial_context.system_prompt
        assert initial_system_prompt, "Initial system prompt should not be empty"

        # Get initial human block value
        human_block = None
        for block in agent.memory.blocks:
            if block.label == "human":
                human_block = block
                break
        assert human_block, "Agent should have a 'human' memory block"
        initial_block_value = human_block.value

        # Step 2: Tell the agent to update its memory using the memory tool
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                {
                    "role": "user",
                    "content": "Please use the core_memory_append tool to add the following to your 'human' block: 'User likes pizza.'",
                }
            ],
        )
        assert response.messages, "Agent should respond with messages"

        # Step 3: Verify block was modified but system prompt hasn't changed
        # Check that the block was actually modified
        updated_block = client.blocks.retrieve(human_block.id)
        assert updated_block.value != initial_block_value, "Memory block should have been modified by the agent"
        assert "pizza" in updated_block.value.lower(), "Memory block should contain the new content about pizza"

        # Verify system prompt hasn't changed
        context_after_memory_update = client.agents.context.retrieve(agent.id)
        system_prompt_after_memory = context_after_memory_update.system_prompt
        assert system_prompt_after_memory == initial_system_prompt, (
            "System prompt should NOT change after agent uses memory tool (deferred to compaction)"
        )

        # Step 4: Send another message to the agent
        response2 = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                {
                    "role": "user",
                    "content": "What is my favorite food?",
                }
            ],
        )
        assert response2.messages, "Agent should respond with messages"

        # Step 5: Verify system prompt still hasn't changed
        context_after_second_message = client.agents.context.retrieve(agent.id)
        system_prompt_after_second = context_after_second_message.system_prompt
        assert system_prompt_after_second == initial_system_prompt, "System prompt should remain stable after multiple messages"

        # Step 6: Manually update a block via the API
        # Find the human block
        human_block = None
        for block in agent.memory.blocks:
            if block.label == "human":
                human_block = block
                break
        assert human_block, "Agent should have a 'human' memory block"

        # Update the block directly via API
        client.blocks.modify(
            block_id=human_block.id,
            value=human_block.value + "\nUser also likes sushi.",
        )

        # Step 7: Send another message and verify system prompt still hasn't changed
        response3 = client.agents.messages.create(
            agent_id=agent.id,
            messages=[
                {
                    "role": "user",
                    "content": "What foods do I like?",
                }
            ],
        )
        assert response3.messages, "Agent should respond with messages"

        # Verify system prompt STILL hasn't changed (deferred to compaction/reset)
        context_after_manual_update = client.agents.context.retrieve(agent.id)
        system_prompt_after_manual = context_after_manual_update.system_prompt
        assert system_prompt_after_manual == initial_system_prompt, (
            "System prompt should NOT change after manual block update (deferred to compaction)"
        )

    def test_system_prompt_updates_after_reset(self, client: Letta, agent):
        """
        Test that system prompt IS updated after message reset.
        1. Get initial system prompt
        2. Manually update a memory block
        3. Reset messages
        4. Verify system prompt HAS changed to include the new memory
        """
        # Step 1: Get initial system prompt
        initial_context = client.agents.context.retrieve(agent.id)
        initial_system_prompt = initial_context.system_prompt

        # Step 2: Manually update a block via the API
        human_block = None
        for block in agent.memory.blocks:
            if block.label == "human":
                human_block = block
                break
        assert human_block, "Agent should have a 'human' memory block"

        # Add distinctive text that we can verify in the system prompt
        new_memory_content = "UNIQUE_TEST_MARKER_12345: User loves ice cream."
        client.blocks.modify(
            block_id=human_block.id,
            value=human_block.value + f"\n{new_memory_content}",
        )

        # Step 3: Reset messages (this should trigger system prompt rebuild)
        client.agents.messages.reset(agent.id)

        # Step 4: Verify system prompt HAS changed and includes the new memory
        context_after_reset = client.agents.context.retrieve(agent.id)
        system_prompt_after_reset = context_after_reset.system_prompt

        assert system_prompt_after_reset != initial_system_prompt, "System prompt SHOULD change after message reset"
        assert "UNIQUE_TEST_MARKER_12345" in system_prompt_after_reset, (
            "System prompt should include the updated memory block content after reset"
        )
