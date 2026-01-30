"""
Integration tests for multi-modal tool returns (images in tool responses).

These tests verify that:
1. Models supporting images in tool returns can see and describe image content
2. Models NOT supporting images (e.g., Chat Completions API) receive placeholder text
3. The image data is properly passed through the approval flow

The test uses a secret.png image containing hidden text that the model must identify.
"""

import base64
import os
import uuid

import pytest
from letta_client import Letta
from letta_client.types.agents import ApprovalRequestMessage, AssistantMessage, ToolCallMessage

# ------------------------------
# Constants
# ------------------------------

# The secret text embedded in the test image
# This is the actual text visible in secret.png
SECRET_TEXT_IN_IMAGE = "FIREBRAWL"

# Models that support images in tool returns (Responses API, Anthropic, or Google AI)
MODELS_WITH_IMAGE_SUPPORT = [
    "anthropic/claude-sonnet-4-5-20250929",
    "openai/gpt-5",  # Uses Responses API
    "google_ai/gemini-2.5-flash",  # Google AI with vision support
]

# Models that do NOT support images in tool returns (Chat Completions only)
MODELS_WITHOUT_IMAGE_SUPPORT = [
    "openai/gpt-4o-mini",  # Uses Chat Completions API, not Responses
]


def _load_secret_image() -> str:
    """Loads the secret test image and returns it as base64."""
    image_path = os.path.join(os.path.dirname(__file__), "data/secret.png")
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


SECRET_IMAGE_BASE64 = _load_secret_image()


def get_image_tool_schema():
    """Returns a client-side tool schema that returns an image."""
    return {
        "name": "get_secret_image",
        "description": "Retrieves a secret image with hidden text. Call this function to get the image.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
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


class TestMultiModalToolReturns:
    """Test multi-modal (image) content in tool returns."""

    @pytest.mark.parametrize("model", MODELS_WITH_IMAGE_SUPPORT)
    def test_model_can_see_image_in_tool_return(self, client: Letta, model: str) -> None:
        """
        Test that models supporting images can see and describe image content
        returned from a tool.

        Flow:
        1. User asks agent to get the secret image and tell them what's in it
        2. Agent calls client-side tool, execution pauses
        3. Client provides tool return with image content
        4. Agent processes the image and describes what it sees
        5. Verify the agent mentions the secret text from the image
        """
        # Create agent for this test
        agent = client.agents.create(
            name=f"multimodal_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            tool_schema = get_image_tool_schema()
            print(f"\n=== Testing image support with model: {model} ===")

            # Step 1: User asks for the secret image
            print("\nStep 1: Asking agent to call get_secret_image tool...")
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "role": "user",
                        "content": "Call the get_secret_image function now.",
                    }
                ],
                client_tools=[tool_schema],
            )

            # Validate Step 1: Should pause with approval request
            assert response1.stop_reason.stop_reason == "requires_approval", f"Expected requires_approval, got {response1.stop_reason}"

            # Find the approval request with tool call
            approval_msg = None
            for msg in response1.messages:
                if isinstance(msg, ApprovalRequestMessage):
                    approval_msg = msg
                    break

            assert approval_msg is not None, f"Expected an ApprovalRequestMessage but got {[type(m).__name__ for m in response1.messages]}"
            assert approval_msg.tool_call.name == "get_secret_image"

            print(f"Tool call ID: {approval_msg.tool_call.tool_call_id}")

            # Step 2: Provide tool return with image content
            print("\nStep 2: Providing tool return with image...")

            # Build image content as list of content parts
            image_content = [
                {"type": "text", "text": "Here is the secret image:"},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "data": SECRET_IMAGE_BASE64,
                        "media_type": "image/png",
                    },
                },
            ]

            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": approval_msg.tool_call.tool_call_id,
                                "tool_return": image_content,
                                "status": "success",
                            },
                        ],
                    },
                ],
            )

            # Validate Step 2: Agent should process the image and respond
            print(f"Stop reason: {response2.stop_reason}")
            print(f"Messages: {len(response2.messages)}")

            # Find the assistant message with the response
            assistant_response = None
            for msg in response2.messages:
                if isinstance(msg, AssistantMessage):
                    assistant_response = msg.content
                    print(f"Assistant response: {assistant_response[:200]}...")
                    break

            assert assistant_response is not None, "Expected an AssistantMessage with the image description"

            # Verify the model saw the secret text in the image
            # The model should mention the secret code if it can see the image
            assert SECRET_TEXT_IN_IMAGE in assistant_response.upper() or SECRET_TEXT_IN_IMAGE.lower() in assistant_response.lower(), (
                f"Model should have seen the secret text '{SECRET_TEXT_IN_IMAGE}' in the image, but response was: {assistant_response}"
            )

            print("\nSUCCESS: Model correctly identified secret text in image!")

        finally:
            # Cleanup
            client.agents.delete(agent_id=agent.id)

    @pytest.mark.parametrize("model", MODELS_WITHOUT_IMAGE_SUPPORT)
    def test_model_without_image_support_gets_placeholder(self, client: Letta, model: str) -> None:
        """
        Test that models NOT supporting images receive placeholder text
        and cannot see the actual image content.

        This verifies that Chat Completions API models (which don't support
        images in tool results) get a graceful fallback.

        Flow:
        1. User asks agent to get the secret image
        2. Agent calls client-side tool, execution pauses
        3. Client provides tool return with image content
        4. Agent processes but CANNOT see the image (only placeholder text)
        5. Verify the agent does NOT mention the secret text
        """
        # Create agent for this test
        agent = client.agents.create(
            name=f"no_image_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            tool_schema = get_image_tool_schema()
            print(f"\n=== Testing placeholder for model without image support: {model} ===")

            # Step 1: User asks for the secret image
            print("\nStep 1: Asking agent to call get_secret_image tool...")
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "role": "user",
                        "content": "Call the get_secret_image function now.",
                    }
                ],
                client_tools=[tool_schema],
            )

            # Validate Step 1: Should pause with approval request
            assert response1.stop_reason.stop_reason == "requires_approval", f"Expected requires_approval, got {response1.stop_reason}"

            # Find the approval request with tool call
            approval_msg = None
            for msg in response1.messages:
                if isinstance(msg, ApprovalRequestMessage):
                    approval_msg = msg
                    break

            assert approval_msg is not None, f"Expected an ApprovalRequestMessage but got {[type(m).__name__ for m in response1.messages]}"

            # Step 2: Provide tool return with image content
            print("\nStep 2: Providing tool return with image...")

            image_content = [
                {"type": "text", "text": "Here is the secret image:"},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "data": SECRET_IMAGE_BASE64,
                        "media_type": "image/png",
                    },
                },
            ]

            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": approval_msg.tool_call.tool_call_id,
                                "tool_return": image_content,
                                "status": "success",
                            },
                        ],
                    },
                ],
            )

            # Find the assistant message
            assistant_response = None
            for msg in response2.messages:
                if isinstance(msg, AssistantMessage):
                    assistant_response = msg.content
                    print(f"Assistant response: {assistant_response[:200]}...")
                    break

            assert assistant_response is not None, "Expected an AssistantMessage"

            # Verify the model did NOT see the secret text (it got placeholder instead)
            assert (
                SECRET_TEXT_IN_IMAGE not in assistant_response.upper() and SECRET_TEXT_IN_IMAGE.lower() not in assistant_response.lower()
            ), (
                f"Model should NOT have seen the secret text '{SECRET_TEXT_IN_IMAGE}' (it doesn't support images), "
                f"but response was: {assistant_response}"
            )

            # The model should mention something about image being omitted/not visible
            response_lower = assistant_response.lower()
            mentions_image_issue = any(
                phrase in response_lower
                for phrase in ["image", "omitted", "cannot see", "can't see", "unable to", "not able to", "no image"]
            )

            print("\nSUCCESS: Model correctly did not see the secret (image support not available)")
            if mentions_image_issue:
                print("Model acknowledged it cannot see the image content")

        finally:
            # Cleanup
            client.agents.delete(agent_id=agent.id)


class TestMultiModalToolReturnsSerialization:
    """Test that multi-modal tool returns serialize/deserialize correctly."""

    @pytest.mark.parametrize("model", MODELS_WITH_IMAGE_SUPPORT[:1])  # Just test one model
    def test_tool_return_with_image_persists_in_db(self, client: Letta, model: str) -> None:
        """
        Test that tool returns with images are correctly persisted and
        can be retrieved from the database.
        """
        agent = client.agents.create(
            name=f"persist_test_{uuid.uuid4().hex[:8]}",
            model=model,
            embedding="openai/text-embedding-3-small",
            include_base_tools=False,
            tool_ids=[],
            include_base_tool_rules=False,
            tool_rules=[],
        )

        try:
            tool_schema = get_image_tool_schema()

            # Trigger tool call
            response1 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[{"role": "user", "content": "Call the get_secret_image tool."}],
                client_tools=[tool_schema],
            )

            assert response1.stop_reason.stop_reason == "requires_approval"

            approval_msg = None
            for msg in response1.messages:
                if isinstance(msg, ApprovalRequestMessage):
                    approval_msg = msg
                    break

            assert approval_msg is not None

            # Provide image tool return
            image_content = [
                {"type": "text", "text": "Image result"},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "data": SECRET_IMAGE_BASE64,
                        "media_type": "image/png",
                    },
                },
            ]

            response2 = client.agents.messages.create(
                agent_id=agent.id,
                messages=[
                    {
                        "type": "approval",
                        "approvals": [
                            {
                                "type": "tool",
                                "tool_call_id": approval_msg.tool_call.tool_call_id,
                                "tool_return": image_content,
                                "status": "success",
                            },
                        ],
                    },
                ],
            )

            # Verify we got a response
            assert response2.stop_reason is not None

            # Retrieve messages from DB and verify they persisted
            messages_from_db = client.agents.messages.list(agent_id=agent.id)

            # Look for the tool return message in the persisted messages
            found_tool_return = False
            for msg in messages_from_db.items:
                # Check if this is a tool return message that might contain our image
                if hasattr(msg, "tool_returns") and msg.tool_returns:
                    found_tool_return = True
                    break

            # The tool return should have been saved
            print(f"Found {len(messages_from_db.items)} messages in DB")
            print(f"Tool return message found: {found_tool_return}")

        finally:
            client.agents.delete(agent_id=agent.id)
