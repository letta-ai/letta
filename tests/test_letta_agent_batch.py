"""
Tests for LettaAgentBatch.step_until_request functionality.

This module tests the batch processing capabilities of LettaAgentBatch,
specifically the step_until_request method which prepares agent requests
for batch processing.
"""

import os
import threading
import time
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchRequestCounts
from dotenv import load_dotenv
from letta_client import Letta

from letta.agents.letta_agent_batch import LettaAgentBatch
from letta.config import LettaConfig
from letta.helpers import ToolRulesSolver
from letta.orm import Base
from letta.schemas.agent import AgentStepState
from letta.schemas.enums import JobStatus, ProviderType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_request import LettaBatchRequest
from letta.schemas.message import MessageCreate
from letta.schemas.tool_rule import InitToolRule
from letta.server.db import db_context
from letta.server.server import SyncServer

# --------------------------------------------------------------------------- #
# Test Constants
# --------------------------------------------------------------------------- #

# Model identifiers used in tests
MODELS = {
    "sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "haiku": "anthropic/claude-3-5-haiku-20241022",
    "opus": "anthropic/claude-3-opus-20240229",
}

# Expected message roles in batch requests
EXPECTED_ROLES = ["system", "assistant", "tool", "user", "user"]


# --------------------------------------------------------------------------- #
# Test Fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture
def agents(client):
    """
    Create three test agents with different models.

    Returns:
        Tuple[Agent, Agent, Agent]: Three agents with sonnet, haiku, and opus models
    """

    def create_agent(suffix, model_name):
        return client.agents.create(
            name=f"test_agent_{suffix}",
            include_base_tools=True,
            model=model_name,
            tags=["test_agents"],
            embedding="letta/letta-free",
        )

    return (
        create_agent("sonnet", MODELS["sonnet"]),
        create_agent("haiku", MODELS["haiku"]),
        create_agent("opus", MODELS["opus"]),
    )


@pytest.fixture
def batch_requests(agents):
    """
    Create batch requests for each test agent.

    Args:
        agents: The test agents fixture

    Returns:
        List[LettaBatchRequest]: Batch requests for each agent
    """
    return [
        LettaBatchRequest(agent_id=agent.id, messages=[MessageCreate(role="user", content=[TextContent(text=f"Hi {agent.name}")])])
        for agent in agents
    ]


@pytest.fixture
def step_state_map(agents):
    """
    Create a mapping of agent IDs to their step states.

    Args:
        agents: The test agents fixture

    Returns:
        Dict[str, AgentStepState]: Mapping of agent IDs to step states
    """
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="send_message")])
    return {agent.id: AgentStepState(step_number=0, tool_rules_solver=solver) for agent in agents}


@pytest.fixture
def dummy_batch_response():
    """
    Create a minimal dummy batch response similar to what Anthropic would return.

    Returns:
        BetaMessageBatch: A dummy batch response
    """
    now = datetime.now(timezone.utc)
    return BetaMessageBatch(
        id="msgbatch_test_12345",
        created_at=now,
        expires_at=now,
        processing_status="in_progress",
        request_counts=BetaMessageBatchRequestCounts(canceled=0, errored=0, expired=0, processing=3, succeeded=0),
        type="message_batch",
    )


# --------------------------------------------------------------------------- #
# Server and Database Management
# --------------------------------------------------------------------------- #


@pytest.fixture(autouse=True)
def clear_batch_tables():
    """Clear batch-related tables before each test."""
    with db_context() as session:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in {"llm_batch_job", "llm_batch_items"}:
                session.execute(table.delete())  # Truncate table
        session.commit()


def run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture(scope="session")
def server_url():
    """
    Ensures a server is running and returns its base URL.

    Uses environment variable if available, otherwise starts a server
    in a background thread.
    """
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        time.sleep(1)  # Give server time to start

    return url


@pytest.fixture(scope="module")
def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()
    config.save()
    return SyncServer()


@pytest.fixture(scope="session")
def client(server_url):
    """Creates a REST client connected to the test server."""
    return Letta(base_url=server_url)


# --------------------------------------------------------------------------- #
# Test
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_step_until_request_prepares_and_submits_batch_correctly(
    server, default_user, agents, batch_requests, step_state_map, dummy_batch_response
):
    """
    Test that step_until_request correctly:
    1. Prepares the proper payload format for each agent
    2. Creates the appropriate database records
    3. Returns correct batch information

    This test mocks the actual API call to Anthropic while validating
    that the correct data would be sent.
    """
    agent_sonnet, agent_haiku, agent_opus = agents

    # Map of agent IDs to their expected models
    expected_models = {
        agent_sonnet.id: "claude-3-5-sonnet-20241022",
        agent_haiku.id: "claude-3-5-haiku-20241022",
        agent_opus.id: "claude-3-opus-20240229",
    }

    # Set up spy function for the Anthropic client
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async") as mock_send:
        # Configure mock to validate input and return dummy response
        async def validate_batch_request(*, agent_messages_mapping, agent_tools_mapping, agent_llm_config_mapping):
            # Verify all agent IDs are present in all mappings
            expected_ids = sorted(expected_models.keys())
            actual_ids = sorted(agent_messages_mapping.keys())

            assert actual_ids == expected_ids, f"Expected agent IDs {expected_ids}, got {actual_ids}"
            assert sorted(agent_tools_mapping.keys()) == expected_ids
            assert sorted(agent_llm_config_mapping.keys()) == expected_ids

            # Verify message structure for each agent
            for agent_id, messages in agent_messages_mapping.items():
                # Verify we have the expected number of messages (4 ICL + 1 user input)
                assert len(messages) == 5, f"Expected 5 messages, got {len(messages)}"

                # Verify message roles follow expected pattern
                actual_roles = [msg.role for msg in messages]
                assert actual_roles == EXPECTED_ROLES, f"Expected roles {EXPECTED_ROLES}, got {actual_roles}"

                # Verify the last message is the user greeting
                last_message = messages[-1]
                assert last_message.role == "user"
                assert "Hi " in last_message.content[0].text

                # Verify agent_id is consistently set
                for msg in messages:
                    assert msg.agent_id == agent_id

            # Verify tool configuration
            for agent_id, tools in agent_tools_mapping.items():
                available_tools = {tool["name"] for tool in tools}
                assert available_tools == {"send_message"}, f"Expected only send_message tool, got {available_tools}"

            # Verify model assignments
            for agent_id, expected_model in expected_models.items():
                actual_model = agent_llm_config_mapping[agent_id].model
                assert actual_model == expected_model, f"Expected model {expected_model}, got {actual_model}"

            return dummy_batch_response

        mock_send.side_effect = validate_batch_request

        # Create batch runner
        batch_runner = LettaAgentBatch(
            batch_id="test_batch",
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            actor=default_user,
        )

        # Run the method under test
        response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
        )

        # Verify the mock was called exactly once
        mock_send.assert_called_once()

        # Verify database records were created correctly
        job = server.batch_manager.get_batch_job_by_id(response.batch_id, actor=default_user)

        # Verify job properties
        assert job.llm_provider == ProviderType.anthropic, "Job provider should be Anthropic"
        assert job.status == JobStatus.running, "Job status should be 'running'"

        # Verify batch items
        items = server.batch_manager.list_batch_items(batch_id=job.id, actor=default_user)
        assert len(items) == 3, f"Expected 3 batch items, got {len(items)}"

        # Verify all agents are represented in batch items
        agent_ids_in_items = {item.agent_id for item in items}
        expected_agent_ids = {agent.id for agent in agents}
        assert agent_ids_in_items == expected_agent_ids, f"Expected agent IDs {expected_agent_ids}, got {agent_ids_in_items}"
