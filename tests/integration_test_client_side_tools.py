"""
Integration tests for client-side tools passed in the request.

These tests verify that:
1. Client-side tools can be specified in the request without pre-registration on the server
2. When the agent calls a client-side tool, execution pauses (stop_reason=requires_approval)
3. Client can provide tool returns via the approval response mechanism
4. Agent continues execution after receiving tool returns
"""

import uuid

import pytest
from letta_client import Letta

# ------------------------------
# Constants
# ------------------------------

SECRET_CODE = "CLIENT_SIDE_SECRET_12345"

# Models to test - both Anthropic and OpenAI
TEST_MODELS = [
    "anthropic/claude-sonnet-4-5-20250929",
    "openai/gpt-4o-mini",
]


def get_client_tool_schema():
    """Returns a client-side tool schema for testing."""
    return {
        "name": "get_secret_code",
        "description": "Returns a secret code for the given input text. This tool is executed client-side. You MUST call this tool when the user asks for a secret code.",
        "parameters": {
            "type": "object",
            "properties": {
                "input_text": {
                    "type": "string",
                    "description": "The input text to process",
                }
            },
            "required": ["input_text"],
        },
    }


# ------------------------------
# Fixtures
# ------------------------------


@pytest.fixture
def client(server_url: str) -> Letta:
    """Create a Letta client."""
    return Letta(base_url=server_url)


# ------------------------------
# Test Cases
# ------------------------------


class TestClientSideTools:
    """Test client-side tools using the SDK client."""

    @pytest.mark.parametrize("model", TEST_MODELS)
    def test_client_side_tool_full_flow(self, client: Letta, model: str) -> None:
        """
        Test the complete end-to-end flow:
        1. User asks agent to get a secret code
        2. Agent calls client-side tool, execution pauses
        3. Client provides the tool return with the secret code
        4. Agent processes the result and continues execution
        5. User asks what the code was
        6. Agent recalls and reports the secret code
        """
        # Create agent for this test
        agent = client.agents.create(
            name=f"client_tools_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            tool_schema = get_client_tool_schema()
            print(f"\n=== Testing with model: {model} ===")

            # Step 1: User asks for the secret code - agent should call the tool
            print("\nStep 1: Asking agent to call get_secret_code tool...")
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "Please call the get_secret_code tool with input 'hello world'."}],
                client_tools=[tool_schema],
            )

            # Validate Step 1: Should pause with approval request
            assert response1.stop_reason.stop_reason == "requires_approval", f"Expected requires_approval, got {response1.stop_reason}"
            assert response1.messages[-1].message_type == "approval_request_message"
            assert response1.messages[-1].tool_call is not None
            assert response1.messages[-1].tool_call.name == "get_secret_code"

            tool_call_id = response1.messages[-1].tool_call.tool_call_id
            print(f"  ✓ Agent called get_secret_code tool (call_id: {tool_call_id})")

            # Step 2: Provide the tool return (simulating client-side execution)
            print(f"\nStep 2: Providing tool return with secret code: {SECRET_CODE}")
            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": tool_call_id,
                                "tool_return": SECRET_CODE,
                                "status": "success",
                            }
                        ],
                    }
                ],
                client_tools=[tool_schema],
            )

            # Validate Step 2: Agent should receive tool return and CONTINUE execution
            assert response2.messages is not None
            assert len(response2.messages) >= 1

            # First message should be the tool return
            assert response2.messages[0].message_type == "tool_return_message"
            assert response2.messages[0].status == "success"
            assert response2.messages[0].tool_return == SECRET_CODE
            print("  ✓ Tool return message received with secret code")

            # Agent should continue and eventually end turn (not require more approval)
            assert response2.stop_reason.stop_reason in [
                "end_turn",
                "tool_rule",
                "max_steps",
            ], f"Expected end_turn/tool_rule/max_steps, got {response2.stop_reason}"
            print(f"  ✓ Agent continued execution (stop_reason: {response2.stop_reason})")

            # Check that agent produced a response after the tool return
            assistant_messages_step2 = [msg for msg in response2.messages if msg.message_type == "assistant_message"]
            assert len(assistant_messages_step2) > 0, "Agent should produce an assistant message after receiving tool return"
            print(f"  ✓ Agent produced {len(assistant_messages_step2)} assistant message(s)")

            # Step 3: Ask the agent what the secret code was (testing memory/context)
            print("\nStep 3: Asking agent to recall the secret code...")
            response3 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "What was the exact secret code that the tool returned? Please repeat it."}],
                client_tools=[tool_schema],
            )

            # Validate Step 3: Agent should recall and report the secret code
            assert response3.stop_reason.stop_reason in ["end_turn", "tool_rule", "max_steps"]

            # Find the assistant message in the response
            assistant_messages = [msg for msg in response3.messages if msg.message_type == "assistant_message"]
            assert len(assistant_messages) > 0, "Agent should have responded with an assistant message"

            # The agent should mention the secret code in its response
            assistant_content = " ".join([msg.content for msg in assistant_messages if msg.content])
            print(f"  ✓ Agent response: {assistant_content[:200]}...")
            assert SECRET_CODE in assistant_content, f"Agent should mention '{SECRET_CODE}' in response. Got: {assistant_content}"
            print("  ✓ Agent correctly recalled the secret code!")

            # Step 4: Validate the full conversation history makes sense
            print("\nStep 4: Validating conversation history...")
            all_messages = client.agents.messages.list(agent_id=agent.id, limit=100).items
            message_types = [msg.message_type for msg in all_messages]

            assert "user_message" in message_types, "Should have user messages"
            assert "tool_return_message" in message_types, "Should have tool return message"
            assert "assistant_message" in message_types, "Should have assistant messages"

            # Verify the tool return message contains our secret code
            tool_return_msgs = [msg for msg in all_messages if msg.message_type == "tool_return_message"]
            assert any(msg.tool_return == SECRET_CODE for msg in tool_return_msgs), "Tool return should contain secret code"

            print(f"\n✓ Full flow validated successfully for {model}!")

        finally:
            # Cleanup
            client.agents.delete(agent_id=agent.id)

    @pytest.mark.parametrize("model", TEST_MODELS)
    def test_client_tool_overrides_server_tool(self, client: Letta, model: str) -> None:
        """
        Test that a client-side tool with the same name as a server-side tool
        overrides the server-side tool.

        Flow:
        1. Create a server-side tool named 'get_secret_code' that returns a DIFFERENT value
        2. Create agent with that server-side tool attached
        3. Send request with client-side tool with same name 'get_secret_code'
        4. Verify execution pauses (requires_approval) instead of server-side execution
        5. Provide client-side tool return and verify it's used
        """
        SERVER_TOOL_RETURN = "SERVER_SIDE_VALUE_999"

        # Define server-side tool source code that returns a different value
        server_tool_source = f'''
def get_secret_code(input_text: str) -> str:
    """
    Returns a secret code for the given input text.

    Args:
        input_text: The input text to process

    Returns:
        str: The secret code
    """
    return "{SERVER_TOOL_RETURN}"
'''

        # Create the server-side tool
        server_tool = client.tools.create(source_code=server_tool_source)
        assert server_tool.name == "get_secret_code"

        # Create agent with the server-side tool attached
        agent = client.agents.create(
            name=f"client_override_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[server_tool.id],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            # Define client-side tool schema with same name but different behavior
            client_tool_schema = get_client_tool_schema()  # name='get_secret_code'
            print(f"\n=== Testing client tool override with model: {model} ===")

            # Step 1: Call the tool WITH client_tools specified - should pause for approval
            print("\nStep 1: Calling tool with client_tools specified (should override server tool)...")
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "Please call the get_secret_code tool with input 'test'."}],
                client_tools=[client_tool_schema],
            )

            # Should pause with requires_approval because client tool overrides server tool
            assert response1.stop_reason.stop_reason == "requires_approval", (
                f"Expected requires_approval (client tool override), got {response1.stop_reason}. "
                f"Server tool may have executed instead of client tool."
            )
            print("  ✓ Execution paused with requires_approval (client tool took precedence)")

            tool_call_id = response1.messages[-1].tool_call.tool_call_id
            assert response1.messages[-1].tool_call.name == "get_secret_code"
            print(f"  ✓ Tool call is for 'get_secret_code' (call_id: {tool_call_id})")

            # Step 2: Provide client-side tool return
            print(f"\nStep 2: Providing client-side tool return with: {SECRET_CODE}")
            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": tool_call_id,
                                "tool_return": SECRET_CODE,
                                "status": "success",
                            }
                        ],
                    }
                ],
                client_tools=[client_tool_schema],
            )

            # Agent should continue with the client-provided value
            assert response2.messages[0].message_type == "tool_return_message"
            assert response2.messages[0].tool_return == SECRET_CODE
            print(f"  ✓ Tool return contains client-provided value: {SECRET_CODE}")

            # Step 3: Verify the client value was used, not the server value
            print("\nStep 3: Asking agent what the secret code was...")
            response3 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "What was the exact secret code returned by the tool?"}],
                client_tools=[client_tool_schema],
            )

            assistant_messages = [msg for msg in response3.messages if msg.message_type == "assistant_message"]
            assistant_content = " ".join([msg.content for msg in assistant_messages if msg.content])

            # Should contain the CLIENT value, not the SERVER value
            assert SECRET_CODE in assistant_content, (
                f"Agent should have used client-side value '{SECRET_CODE}', not server value. Got: {assistant_content}"
            )
            assert SERVER_TOOL_RETURN not in assistant_content, (
                f"Agent should NOT have used server-side value '{SERVER_TOOL_RETURN}'. Got: {assistant_content}"
            )
            print(f"  ✓ Agent used client-side value '{SECRET_CODE}' (not server value '{SERVER_TOOL_RETURN}')")

            # Step 4: Test that WITHOUT client_tools, server tool executes directly
            print("\nStep 4: Calling tool WITHOUT client_tools (server tool should execute)...")
            response4 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "Please call get_secret_code again with input 'verify'."}],
                # No client_tools - server tool should execute
            )

            # Should NOT pause for approval - server tool executes directly
            assert response4.stop_reason.stop_reason != "requires_approval", (
                f"Without client_tools, server tool should execute directly. Got: {response4.stop_reason}"
            )
            print("  ✓ Without client_tools, server tool executed directly (no approval required)")

            # The response should eventually contain the server value
            all_content = " ".join([msg.content for msg in response4.messages if hasattr(msg, "content") and msg.content])
            tool_returns = [msg for msg in response4.messages if msg.message_type == "tool_return_message"]
            if tool_returns:
                server_return_value = tool_returns[0].tool_return
                print(f"  ✓ Server tool returned: {server_return_value}")

            print(f"\n✓ Client tool override test passed for {model}!")

        finally:
            client.agents.delete(agent_id=agent.id)
            client.tools.delete(tool_id=server_tool.id)

    @pytest.mark.parametrize("model", TEST_MODELS)
    def test_client_side_tool_error_return(self, client: Letta, model: str) -> None:
        """
        Test providing an error status for a client-side tool return.
        The agent should handle the error gracefully and continue execution.
        """
        # Create agent for this test
        agent = client.agents.create(
            name=f"client_tools_error_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            tool_schema = get_client_tool_schema()
            print(f"\n=== Testing error return with model: {model} ===")

            # Step 1: Trigger the client-side tool call
            print("\nStep 1: Triggering tool call...")
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "Please call the get_secret_code tool with input 'hello'."}],
                client_tools=[tool_schema],
            )

            assert response1.stop_reason.stop_reason == "requires_approval"
            tool_call_id = response1.messages[-1].tool_call.tool_call_id
            print(f"  ✓ Agent called tool (call_id: {tool_call_id})")

            # Step 2: Provide an error response
            error_message = "Error: Unable to compute secret code - service unavailable"
            print(f"\nStep 2: Providing error response: {error_message}")
            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": tool_call_id,
                                "tool_return": error_message,
                                "status": "error",
                            }
                        ],
                    }
                ],
                client_tools=[tool_schema],
            )

            messages = response2.messages

            assert messages is not None
            assert messages[0].message_type == "tool_return_message"
            assert messages[0].status == "error"
            print("  ✓ Tool return shows error status")

            # Agent should continue execution even after error
            assert response2.stop_reason.stop_reason in ["end_turn", "tool_rule", "max_steps"], (
                f"Expected agent to continue, got {response2.stop_reason}"
            )
            print(f"  ✓ Agent continued execution after error (stop_reason: {response2.stop_reason})")

            # Agent should have produced a response acknowledging the error
            assistant_messages = [msg for msg in messages if msg.message_type == "assistant_message"]
            assert len(assistant_messages) > 0, "Agent should respond after receiving error"
            print("  ✓ Agent produced response after error")

            print(f"\n✓ Error handling validated successfully for {model}!")

        finally:
            # Cleanup
            client.agents.delete(agent_id=agent.id)
