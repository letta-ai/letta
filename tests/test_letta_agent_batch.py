import asyncio
from datetime import datetime, timezone
from typing import Tuple
from unittest.mock import AsyncMock, patch

import pytest
from anthropic.types import BetaErrorResponse, BetaRateLimitError
from anthropic.types.beta import BetaMessage
from anthropic.types.beta.messages import (
    BetaMessageBatch,
    BetaMessageBatchErroredResult,
    BetaMessageBatchIndividualResponse,
    BetaMessageBatchRequestCounts,
    BetaMessageBatchSucceededResult,
)

from letta.agents.letta_agent_batch import LettaAgentBatch
from letta.config import LettaConfig
from letta.helpers import ToolRulesSolver
from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.enums import AgentStepStatus, JobStatus, MessageRole, ProviderType
from letta.schemas.job import BatchJob
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_request import LettaBatchRequest
from letta.schemas.llm_batch_job import AgentStepState
from letta.schemas.message import MessageCreate
from letta.schemas.tool_rule import InitToolRule
from letta.server.server import SyncServer
from tests.utils import create_tool_from_func

# --------------------------------------------------------------------------- #
# Test Constants / Helpers
# --------------------------------------------------------------------------- #

# Model identifiers used in tests
MODELS = {
    "sonnet": "anthropic/claude-sonnet-4-20250514",
    "haiku": "anthropic/claude-haiku-4-5-20251001",
    "opus": "anthropic/claude-opus-4-1-20250805",
}

# Expected message roles in batch requests
EXPECTED_ROLES = ["system", "assistant", "tool", "user", "user"]


# --------------------------------------------------------------------------- #
# Test Fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture
async def weather_tool(server):
    def get_weather(location: str) -> str:
        """
        Fetches the current weather for a given location.

        Args:
            location: The location to get the weather for.

        Returns:
            A formatted string describing the weather in the given location.

        Raises:
            RuntimeError: If the request to fetch weather data fails.
        """
        import requests

        url = f"https://wttr.in/{location}?format=%C+%t"

        response = requests.get(url)
        if response.status_code == 200:
            weather_data = response.text
            return f"The weather in {location} is {weather_data}."
        else:
            raise RuntimeError(f"Failed to get weather data, status code: {response.status_code}")

    actor = await server.user_manager.get_actor_or_default_async()
    tool = await server.tool_manager.create_or_update_tool_async(create_tool_from_func(func=get_weather), actor=actor)
    # Yield the created tool
    yield tool


@pytest.fixture
async def rethink_tool(server):
    def rethink_memory(agent_state: "AgentState", new_memory: str, target_block_label: str) -> str:  # type: ignore
        """
        Re-evaluate the memory in block_name, integrating new and updated facts.
        Replace outdated information with the most likely truths, avoiding redundancy with original memories.
        Ensure consistency with other memory blocks.

        Args:
            new_memory (str): The new memory with information integrated from the memory block. If there is no new information, then this should be the same as the content in the source block.
            target_block_label (str): The name of the block to write to.
        Returns:
            str: None is always returned as this function does not produce a response.
        """
        agent_state.memory.update_block_value(label=target_block_label, value=new_memory)
        return None

    actor = await server.user_manager.get_actor_or_default_async()
    tool = await server.tool_manager.create_or_update_tool_async(create_tool_from_func(func=rethink_memory), actor=actor)
    # Yield the created tool
    yield tool


@pytest.fixture
async def agents(server, weather_tool):
    """
    Create three test agents with different models.

    Returns:
        Tuple[Agent, Agent, Agent]: Three agents with sonnet, haiku, and opus models
    """
    actor = await server.user_manager.get_actor_or_default_async()

    async def create_agent(suffix, model_name):
        return await server.create_agent_async(
            CreateAgent(
                name=f"test_agent_{suffix}",
                include_base_tools=True,
                model=model_name,
                tags=["test_agents"],
                embedding="letta/letta-free",
                tool_ids=[weather_tool.id],
            ),
            actor=actor,
        )

    return (
        await create_agent("sonnet", MODELS["sonnet"]),
        await create_agent("haiku", MODELS["haiku"]),
        await create_agent("opus", MODELS["opus"]),
    )


@pytest.fixture(scope="function")
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


@pytest.fixture(scope="function")
def step_state_map(agents):
    """
    Create a mapping of agent IDs to their step states.

    Args:
        agents: The test agents fixture

    Returns:
        Dict[str, AgentStepState]: Mapping of agent IDs to step states
    """
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="get_weather")])
    return {agent.id: AgentStepState(step_number=0, tool_rules_solver=solver) for agent in agents}


def create_batch_response(batch_id: str, processing_status: str = "in_progress") -> BetaMessageBatch:
    """Create a dummy BetaMessageBatch with the specified ID and status."""
    now = datetime(2024, 8, 20, 18, 37, 24, 100435, tzinfo=timezone.utc)
    return BetaMessageBatch(
        id=batch_id,
        archived_at=now,
        cancel_initiated_at=now,
        created_at=now,
        ended_at=now,
        expires_at=now,
        processing_status=processing_status,
        request_counts=BetaMessageBatchRequestCounts(
            canceled=10,
            errored=30,
            expired=10,
            processing=100,
            succeeded=50,
        ),
        results_url=None,
        type="message_batch",
    )


def create_get_weather_tool_response(custom_id: str, model: str, request_heartbeat: bool) -> BetaMessageBatchIndividualResponse:
    """Create a dummy successful batch response with a tool call after user asks about weather."""
    return BetaMessageBatchIndividualResponse(
        custom_id=custom_id,
        result=BetaMessageBatchSucceededResult(
            type="succeeded",
            message=BetaMessage(
                id="msg_abc123",
                role="assistant",
                type="message",
                model=model,
                content=[
                    {"type": "text", "text": "Let me check the current weather in San Francisco for you."},
                    {
                        "type": "tool_use",
                        "id": "tu_01234567890123456789012345",
                        "name": "get_weather",
                        "input": {
                            "location": "Las Vegas",
                            "inner_thoughts": "I should get the weather",
                            "request_heartbeat": request_heartbeat,
                        },
                    },
                ],
                usage={"input_tokens": 7, "output_tokens": 17},
                stop_reason="end_turn",
            ),
        ),
    )


def create_rethink_tool_response(
    custom_id: str, model: str, request_heartbeat: bool, new_memory: str, target_block_label: str
) -> BetaMessageBatchIndividualResponse:
    """Create a dummy successful batch response with a tool call after user asks about weather."""
    return BetaMessageBatchIndividualResponse(
        custom_id=custom_id,
        result=BetaMessageBatchSucceededResult(
            type="succeeded",
            message=BetaMessage(
                id="msg_abc123",
                role="assistant",
                type="message",
                model=model,
                content=[
                    {"type": "text", "text": "Let me rethink my memory."},
                    {
                        "type": "tool_use",
                        "id": "tu_01234567890123456789012345",
                        "name": "rethink_memory",
                        "input": {
                            "new_memory": new_memory,
                            "target_block_label": target_block_label,
                            "request_heartbeat": request_heartbeat,
                        },
                    },
                ],
                usage={"input_tokens": 7, "output_tokens": 17},
                stop_reason="end_turn",
            ),
        ),
    )


def create_failed_response(custom_id: str) -> BetaMessageBatchIndividualResponse:
    """Create a dummy failed batch response with a rate limit error."""
    return BetaMessageBatchIndividualResponse(
        custom_id=custom_id,
        result=BetaMessageBatchErroredResult(
            type="errored",
            error=BetaErrorResponse(type="error", error=BetaRateLimitError(type="rate_limit_error", message="Rate limit hit.")),
        ),
    )


@pytest.fixture(scope="function")
def dummy_batch_response():
    """
    Create a minimal dummy batch response similar to what Anthropic would return.

    Returns:
        BetaMessageBatch: A dummy batch response
    """
    return create_batch_response(
        batch_id="msgbatch_test_12345",
    )


# --------------------------------------------------------------------------- #
# Server and Database Management
# --------------------------------------------------------------------------- #

#
# @pytest.fixture(autouse=True)
# def clear_batch_tables():
#     """Clear batch-related tables before each test."""
#     with db_context() as session:
#         for table in reversed(Base.metadata.sorted_tables):
#             if table.name in {"jobs", "llm_batch_job", "llm_batch_items"}:
#                 session.execute(table.delete())  # Truncate table
#         session.commit()


@pytest.fixture
async def server():
    """
    Creates a SyncServer instance for testing.

    Loads and saves config to ensure proper initialization.
    """
    config = LettaConfig.load()

    config.save()

    server = SyncServer(init_with_default_org_and_user=True)
    await server.init_async(init_with_default_org_and_user=True)
    yield server


@pytest.fixture
async def default_organization(server):
    """Fixture to create and return the default organization."""
    org = await server.organization_manager.get_default_organization_async()
    yield org


@pytest.fixture
async def default_user(server, default_organization):
    """Fixture to create and return the default user within the default organization."""
    user = await server.user_manager.get_default_actor_async()
    yield user


@pytest.fixture
async def batch_job(default_user, server):
    job = BatchJob(
        user_id=default_user.id,
        status=JobStatus.created,
        metadata={
            "job_type": "batch_messages",
        },
    )
    job = await server.job_manager.create_job_async(pydantic_job=job, actor=default_user)
    yield job

    # cleanup
    await server.job_manager.delete_job_by_id_async(job.id, actor=default_user)


class MockAsyncIterable:
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.items:
            raise StopAsyncIteration
        return self.items.pop(0)


# --------------------------------------------------------------------------- #
# Test
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_rethink_tool_modify_agent_state(disable_e2b_api_key, server, default_user, batch_job, rethink_tool):
    target_block_label = "human"
    new_memory = "banana"
    actor = await server.user_manager.get_actor_or_default_async()
    agent = await server.create_agent_async(
        request=CreateAgent(
            name="test_agent_rethink",
            include_base_tools=True,
            model=MODELS["sonnet"],
            tags=["test_agents"],
            embedding="letta/letta-free",
            tool_ids=[rethink_tool.id],
            memory_blocks=[
                {
                    "label": target_block_label,
                    "value": "Name: Matt",
                },
            ],
        ),
        actor=actor,
    )
    agents = [agent]
    batch_requests = [
        LettaBatchRequest(agent_id=agent.id, messages=[MessageCreate(role="user", content=[TextContent(text="Rethink memory.")])])
        for agent in agents
    ]

    anthropic_batch_id = "msgbatch_test_12345"
    dummy_batch_response = create_batch_response(
        batch_id=anthropic_batch_id,
    )

    # 1. Invoke `step_until_request`
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
        # Create batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=default_user,
        )

        # Run the method under test
        solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="rethink_memory")])
        step_state_map = {agent.id: AgentStepState(step_number=0, tool_rules_solver=solver) for agent in agents}
        pre_resume_response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
            letta_batch_job_id=batch_job.id,
        )

    # 2. Invoke the polling job and mock responses from Anthropic
    mock_retrieve = AsyncMock(return_value=create_batch_response(batch_id=pre_resume_response.letta_batch_id, processing_status="ended"))

    with patch.object(server.anthropic_async_client.beta.messages.batches, "retrieve", mock_retrieve):
        mock_items = [
            create_rethink_tool_response(
                custom_id=agent.id,
                model=agent.llm_config.model,
                request_heartbeat=False,
                new_memory=new_memory,
                target_block_label=target_block_label,
            )
            for agent in agents
        ]

        # Create the mock for results
        mock_results = AsyncMock()
        mock_results.return_value = MockAsyncIterable(mock_items.copy())

        with patch.object(server.anthropic_async_client.beta.messages.batches, "results", mock_results):
            with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
                await poll_running_llm_batches(server)

                # Check that the tool has been executed correctly
                agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=actor)
                for block in agent.memory.blocks:
                    if block.label == target_block_label:
                        assert block.value == new_memory


@pytest.mark.asyncio
async def test_partial_error_from_anthropic_batch(
    disable_e2b_api_key, server, default_user, agents: Tuple[AgentState], batch_requests, step_state_map, batch_job
):
    anthropic_batch_id = "msgbatch_test_12345"
    dummy_batch_response = create_batch_response(
        batch_id=anthropic_batch_id,
    )

    # 1. Invoke `step_until_request`
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
        # Create batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=default_user,
        )

        # Run the method under test
        pre_resume_response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
            letta_batch_job_id=batch_job.id,
        )

        llm_batch_jobs = await server.batch_manager.list_llm_batch_jobs_async(
            letta_batch_id=pre_resume_response.letta_batch_id, actor=default_user
        )
        llm_batch_job = llm_batch_jobs[0]

    # 2. Invoke the polling job and mock responses from Anthropic
    mock_retrieve = AsyncMock(return_value=create_batch_response(batch_id=pre_resume_response.letta_batch_id, processing_status="ended"))

    with patch.object(server.anthropic_async_client.beta.messages.batches, "retrieve", mock_retrieve):
        agents_failed = agents[:1]
        agents_continue = agents[1:]
        # Create failed response for one agent
        mock_items = [create_failed_response(custom_id=agent.id) for agent in agents_failed]
        mock_items.extend(
            [
                create_get_weather_tool_response(custom_id=agent.id, model=agent.llm_config.model, request_heartbeat=True)
                for agent in agents_continue
            ]
        )

        # Create the mock for results
        mock_results = AsyncMock()
        mock_results.return_value = MockAsyncIterable(mock_items.copy())  # Using copy to preserve the original list

        with patch.object(server.anthropic_async_client.beta.messages.batches, "results", mock_results):
            with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
                sizes = await asyncio.gather(
                    *[server.message_manager.size_async(actor=default_user, agent_id=agent.id) for agent in agents]
                )
                msg_counts_before = {agent.id: size for agent, size in zip(agents, sizes)}

                new_batch_responses = await poll_running_llm_batches(server)

                # Verify database records were updated correctly
                llm_batch_job = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_job.id, actor=default_user)

                # Verify job properties
                assert llm_batch_job.status == JobStatus.completed, "Job status should be 'completed'"

                # Verify batch items
                items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
                assert len(items) == 3, f"Expected 3 batch items, got {len(items)}"

                # Verify only one new batch response
                assert len(new_batch_responses) == 1
                post_resume_response = new_batch_responses[0]

                print("POST", post_resume_response)
                print("PRE", pre_resume_response)
                assert post_resume_response.letta_batch_id == pre_resume_response.letta_batch_id, (
                    "resume_step_after_request is expected to have the same letta_batch_id"
                )
                assert post_resume_response.last_llm_batch_id != pre_resume_response.last_llm_batch_id, (
                    "resume_step_after_request is expected to have different llm_batch_id."
                )
                assert post_resume_response.status == JobStatus.running
                # NOTE: We only expect 2 agents to continue (succeeded ones)
                assert post_resume_response.agent_count == 2

                # New batch‑items should exist, initialised in (created, paused) state
                new_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=post_resume_response.last_llm_batch_id, actor=default_user
                )
                assert len(new_items) == 2, f"Expected 2 new batch item, got {len(new_items)}"
                # Assert that the continuing agent is in the only item
                assert {i.agent_id for i in new_items} == {a.id for a in agents_continue}
                assert {i.request_status for i in new_items} == {JobStatus.created}
                assert {i.step_status for i in new_items} == {AgentStepStatus.paused}

                # Confirm that tool_rules_solver state was preserved correctly
                # Assert every new item's step_state's tool_rules_solver has "get_weather" in the tool_call_history
                assert all("get_weather" in item.step_state.tool_rules_solver.tool_call_history for item in new_items), (
                    "Expected 'get_weather' in tool_call_history for all new_items"
                )
                # Assert that each new item's step_number was incremented to 1
                assert all(item.step_state.step_number == 1 for item in new_items), (
                    "Expected step_number to be incremented to 1 for all new_items"
                )

                # Old items must have been flipped to completed / finished earlier
                #     (sanity – we already asserted this above, but we keep it close for clarity)
                old_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=pre_resume_response.last_llm_batch_id, actor=default_user
                )
                for item in old_items:
                    if item.agent_id == agents_failed[0].id:
                        assert item.request_status == JobStatus.failed
                        assert item.step_status == AgentStepStatus.paused
                    else:
                        assert item.request_status == JobStatus.completed
                        assert item.step_status == AgentStepStatus.completed

                # Tool‑call side‑effects – each agent gets at least 2 extra messages
                for agent in agents:
                    before = msg_counts_before[agent.id]  # captured just before resume
                    after = await server.message_manager.size_async(actor=default_user, agent_id=agent.id)

                    if agent.id == agents_failed[0].id:
                        assert after == before, f"Agent {agent.id} should not have extra messages persisted due to Anthropic failure"
                    else:
                        assert after - before >= 2, (
                            f"Agent {agent.id} should have an assistant tool‑call and tool‑response message persisted."
                        )

                # Check that agent states have been properly modified to have extended in-context messages
                for agent in agents:
                    refreshed_agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
                    if refreshed_agent.id == agents_failed[0].id:
                        assert len(refreshed_agent.message_ids) == 4, (
                            f"Agent's in-context messages have not been extended, are length: {len(refreshed_agent.message_ids)}"
                        )
                    else:
                        assert len(refreshed_agent.message_ids) == 6, (
                            f"Agent's in-context messages have been extended, are length: {len(refreshed_agent.message_ids)}"
                        )

                # Check the total list of messages
                messages = await server.batch_manager.get_messages_for_letta_batch_async(
                    letta_batch_job_id=pre_resume_response.letta_batch_id, limit=200, actor=default_user
                )
                assert len(messages) == (len(agents) - 1) * 4 + 1
                _assert_descending_order(messages)
                # Check that each agent is represented
                for agent in agents_continue:
                    agent_messages = [m for m in messages if m.agent_id == agent.id]
                    assert len(agent_messages) == 4
                    assert agent_messages[-1].role == MessageRole.user, "Expected initial user message"
                    assert agent_messages[-2].role == MessageRole.assistant, "Expected assistant tool call after user message"
                    assert agent_messages[-3].role == MessageRole.tool, "Expected tool response after assistant tool call"
                    assert agent_messages[-4].role == MessageRole.user, "Expected final system-level heartbeat user message"

                for agent in agents_failed:
                    agent_messages = [m for m in messages if m.agent_id == agent.id]
                    assert len(agent_messages) == 1
                    assert agent_messages[0].role == MessageRole.user, "Expected initial user message"


@pytest.mark.asyncio
async def test_resume_step_some_stop(
    disable_e2b_api_key, server, default_user, agents: Tuple[AgentState], batch_requests, step_state_map, batch_job
):
    anthropic_batch_id = "msgbatch_test_12345"
    dummy_batch_response = create_batch_response(
        batch_id=anthropic_batch_id,
    )

    # 1. Invoke `step_until_request`
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
        # Create batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=default_user,
        )

        # Run the method under test
        pre_resume_response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
            letta_batch_job_id=batch_job.id,
        )

        llm_batch_jobs = await server.batch_manager.list_llm_batch_jobs_async(
            letta_batch_id=pre_resume_response.letta_batch_id, actor=default_user
        )
        llm_batch_job = llm_batch_jobs[0]

    # 2. Invoke the polling job and mock responses from Anthropic
    mock_retrieve = AsyncMock(return_value=create_batch_response(batch_id=pre_resume_response.letta_batch_id, processing_status="ended"))

    with patch.object(server.anthropic_async_client.beta.messages.batches, "retrieve", mock_retrieve):
        agents_continue = agents[:1]
        agents_finish = agents[1:]
        mock_items = [
            create_get_weather_tool_response(custom_id=agent.id, model=agent.llm_config.model, request_heartbeat=True)
            for agent in agents_continue
        ]
        mock_items.extend(
            [
                create_get_weather_tool_response(custom_id=agent.id, model=agent.llm_config.model, request_heartbeat=False)
                for agent in agents_finish
            ]
        )

        # Create the mock for results
        mock_results = AsyncMock()
        mock_results.return_value = MockAsyncIterable(mock_items.copy())  # Using copy to preserve the original list

        with patch.object(server.anthropic_async_client.beta.messages.batches, "results", mock_results):
            with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
                sizes = await asyncio.gather(
                    *[server.message_manager.size_async(actor=default_user, agent_id=agent.id) for agent in agents]
                )
                msg_counts_before = {agent.id: size for agent, size in zip(agents, sizes)}

                new_batch_responses = await poll_running_llm_batches(server)

                # Verify database records were updated correctly
                llm_batch_job = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_job.id, actor=default_user)

                # Verify job properties
                assert llm_batch_job.status == JobStatus.completed, "Job status should be 'completed'"

                # Verify batch items
                items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
                assert len(items) == 3, f"Expected 3 batch items, got {len(items)}"
                assert all([item.request_status == JobStatus.completed for item in items])

                # Verify only one new batch response
                assert len(new_batch_responses) == 1
                post_resume_response = new_batch_responses[0]

                assert post_resume_response.letta_batch_id == pre_resume_response.letta_batch_id, (
                    "resume_step_after_request is expected to have the same letta_batch_id"
                )
                assert post_resume_response.last_llm_batch_id != pre_resume_response.last_llm_batch_id, (
                    "resume_step_after_request is expected to have different llm_batch_id."
                )
                assert post_resume_response.status == JobStatus.running
                # NOTE: We only expect 1 agent to continue
                assert post_resume_response.agent_count == 1

                # New batch‑items should exist, initialised in (created, paused) state
                new_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=post_resume_response.last_llm_batch_id, actor=default_user
                )
                assert len(new_items) == 1, f"Expected 1 new batch item, got {len(new_items)}"
                # Assert that the continuing agent is in the only item
                assert new_items[0].agent_id == agents_continue[0].id
                assert {i.request_status for i in new_items} == {JobStatus.created}
                assert {i.step_status for i in new_items} == {AgentStepStatus.paused}

                # Confirm that tool_rules_solver state was preserved correctly
                # Assert every new item's step_state's tool_rules_solver has "get_weather" in the tool_call_history
                assert all("get_weather" in item.step_state.tool_rules_solver.tool_call_history for item in new_items), (
                    "Expected 'get_weather' in tool_call_history for all new_items"
                )
                # Assert that each new item's step_number was incremented to 1
                assert all(item.step_state.step_number == 1 for item in new_items), (
                    "Expected step_number to be incremented to 1 for all new_items"
                )

                # Old items must have been flipped to completed / finished earlier
                #     (sanity – we already asserted this above, but we keep it close for clarity)
                old_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=pre_resume_response.last_llm_batch_id, actor=default_user
                )
                assert {i.request_status for i in old_items} == {JobStatus.completed}
                assert {i.step_status for i in old_items} == {AgentStepStatus.completed}

                # Tool‑call side‑effects – each agent gets at least 2 extra messages
                for agent in agents:
                    before = msg_counts_before[agent.id]  # captured just before resume
                    after = await server.message_manager.size_async(actor=default_user, agent_id=agent.id)
                    assert after - before >= 2, f"Agent {agent.id} should have an assistant tool‑call and tool‑response message persisted."

                # Check that agent states have been properly modified to have extended in-context messages
                for agent in agents:
                    refreshed_agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
                    assert len(refreshed_agent.message_ids) == 6, (
                        f"Agent's in-context messages have been extended, are length: {len(refreshed_agent.message_ids)}"
                    )

                # Check the total list of messages
                messages = await server.batch_manager.get_messages_for_letta_batch_async(
                    letta_batch_job_id=pre_resume_response.letta_batch_id, limit=200, actor=default_user
                )
                assert len(messages) == len(agents) * 3 + 1
                _assert_descending_order(messages)
                # Check that each agent is represented
                for agent in agents_continue:
                    agent_messages = [m for m in messages if m.agent_id == agent.id]
                    assert len(agent_messages) == 4
                    assert agent_messages[-1].role == MessageRole.user, "Expected initial user message"
                    assert agent_messages[-2].role == MessageRole.assistant, "Expected assistant tool call after user message"
                    assert agent_messages[-3].role == MessageRole.tool, "Expected tool response after assistant tool call"
                    assert agent_messages[-4].role == MessageRole.user, "Expected final system-level heartbeat user message"

                for agent in agents_finish:
                    agent_messages = [m for m in messages if m.agent_id == agent.id]
                    assert len(agent_messages) == 3
                    assert agent_messages[-1].role == MessageRole.user, "Expected initial user message"
                    assert agent_messages[-2].role == MessageRole.assistant, "Expected assistant tool call after user message"
                    assert agent_messages[-3].role == MessageRole.tool, "Expected tool response after assistant tool call"


def _assert_descending_order(messages):
    """Assert messages are in monotonically decreasing by created_at timestamps."""
    if len(messages) <= 1:
        return True

    for prev, next in zip(messages[:-1], messages[1:]):
        assert prev.created_at >= next.created_at, (
            f"Order violation: {prev.id} ({prev.created_at}) followed by {next.id} ({next.created_at})"
        )
    return True


@pytest.mark.asyncio
async def test_resume_step_after_request_all_continue(
    disable_e2b_api_key, server, default_user, agents: Tuple[AgentState], batch_requests, step_state_map, batch_job
):
    anthropic_batch_id = "msgbatch_test_12345"
    dummy_batch_response = create_batch_response(
        batch_id=anthropic_batch_id,
    )

    # 1. Invoke `step_until_request`
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
        # Create batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=default_user,
        )

        # Run the method under test
        pre_resume_response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
            letta_batch_job_id=batch_job.id,
        )

        # Basic sanity checks (This is tested more thoroughly in `test_step_until_request_prepares_and_submits_batch_correctly`
        # Verify batch items
        llm_batch_jobs = await server.batch_manager.list_llm_batch_jobs_async(
            letta_batch_id=pre_resume_response.letta_batch_id, actor=default_user
        )
        assert len(llm_batch_jobs) == 1, f"Expected 1 llm_batch_jobs, got {len(llm_batch_jobs)}"

        llm_batch_job = llm_batch_jobs[0]
        llm_batch_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
        assert len(llm_batch_items) == 3, f"Expected 3 llm_batch_items, got {len(llm_batch_items)}"

    # 2. Invoke the polling job and mock responses from Anthropic
    mock_retrieve = AsyncMock(return_value=create_batch_response(batch_id=pre_resume_response.letta_batch_id, processing_status="ended"))

    with patch.object(server.anthropic_async_client.beta.messages.batches, "retrieve", mock_retrieve):
        mock_items = [
            create_get_weather_tool_response(custom_id=agent.id, model=agent.llm_config.model, request_heartbeat=True) for agent in agents
        ]

        # Create the mock for results
        mock_results = AsyncMock()
        mock_results.return_value = MockAsyncIterable(mock_items.copy())  # Using copy to preserve the original list

        with patch.object(server.anthropic_async_client.beta.messages.batches, "results", mock_results):
            with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async", return_value=dummy_batch_response):
                sizes = await asyncio.gather(
                    *[server.message_manager.size_async(actor=default_user, agent_id=agent.id) for agent in agents]
                )
                msg_counts_before = {agent.id: size for agent, size in zip(agents, sizes)}

                new_batch_responses = await poll_running_llm_batches(server)

                # Verify database records were updated correctly
                llm_batch_job = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_job.id, actor=default_user)

                # Verify job properties
                assert llm_batch_job.status == JobStatus.completed, "Job status should be 'completed'"

                # Verify batch items
                items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
                assert len(items) == 3, f"Expected 3 batch items, got {len(items)}"
                assert all([item.request_status == JobStatus.completed for item in items])

                # Verify only one new batch response
                assert len(new_batch_responses) == 1
                post_resume_response = new_batch_responses[0]

                assert post_resume_response.letta_batch_id == pre_resume_response.letta_batch_id, (
                    "resume_step_after_request is expected to have the same letta_batch_id"
                )
                assert post_resume_response.last_llm_batch_id != pre_resume_response.last_llm_batch_id, (
                    "resume_step_after_request is expected to have different llm_batch_id."
                )
                assert post_resume_response.status == JobStatus.running
                assert post_resume_response.agent_count == 3

                # New batch‑items should exist, initialised in (created, paused) state
                new_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=post_resume_response.last_llm_batch_id, actor=default_user
                )
                assert len(new_items) == 3, f"Expected 3 new batch items, got {len(new_items)}"
                assert {i.request_status for i in new_items} == {JobStatus.created}
                assert {i.step_status for i in new_items} == {AgentStepStatus.paused}

                # Confirm that tool_rules_solver state was preserved correctly
                # Assert every new item's step_state's tool_rules_solver has "get_weather" in the tool_call_history
                assert all("get_weather" in item.step_state.tool_rules_solver.tool_call_history for item in new_items), (
                    "Expected 'get_weather' in tool_call_history for all new_items"
                )
                # Assert that each new item's step_number was incremented to 1
                assert all(item.step_state.step_number == 1 for item in new_items), (
                    "Expected step_number to be incremented to 1 for all new_items"
                )

                # Old items must have been flipped to completed / finished earlier
                #     (sanity – we already asserted this above, but we keep it close for clarity)
                old_items = await server.batch_manager.list_llm_batch_items_async(
                    llm_batch_id=pre_resume_response.last_llm_batch_id, actor=default_user
                )
                assert {i.request_status for i in old_items} == {JobStatus.completed}
                assert {i.step_status for i in old_items} == {AgentStepStatus.completed}

                # Tool‑call side‑effects – each agent gets at least 2 extra messages
                for agent in agents:
                    before = msg_counts_before[agent.id]  # captured just before resume
                    after = await server.message_manager.size_async(actor=default_user, agent_id=agent.id)
                    assert after - before >= 2, f"Agent {agent.id} should have an assistant tool‑call and tool‑response message persisted."

                # Check that agent states have been properly modified to have extended in-context messages
                for agent in agents:
                    refreshed_agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent.id, actor=default_user)
                    assert len(refreshed_agent.message_ids) == 6, (
                        f"Agent's in-context messages have been extended, are length: {len(refreshed_agent.message_ids)}"
                    )

                # Check the total list of messages
                messages = await server.batch_manager.get_messages_for_letta_batch_async(
                    letta_batch_job_id=pre_resume_response.letta_batch_id, limit=200, actor=default_user
                )
                assert len(messages) == len(agents) * 4
                _assert_descending_order(messages)
                # Check that each agent is represented
                for agent in agents:
                    agent_messages = [m for m in messages if m.agent_id == agent.id]
                    assert len(agent_messages) == 4
                    assert agent_messages[-1].role == MessageRole.user, "Expected initial user message"
                    assert agent_messages[-2].role == MessageRole.assistant, "Expected assistant tool call after user message"
                    assert agent_messages[-3].role == MessageRole.tool, "Expected tool response after assistant tool call"
                    assert agent_messages[-4].role == MessageRole.user, "Expected final system-level heartbeat user message"


@pytest.mark.asyncio
async def test_step_until_request_prepares_and_submits_batch_correctly(
    disable_e2b_api_key, server, default_user, agents, batch_requests, step_state_map, dummy_batch_response, batch_job
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
        agent_sonnet.id: "claude-sonnet-4-20250514",
        agent_haiku.id: "claude-haiku-4-5-20251001",
        agent_opus.id: "claude-opus-4-1-20250805",
    }

    # Set up spy function for the Anthropic client
    with patch("letta.llm_api.anthropic_client.AnthropicClient.send_llm_batch_request_async") as mock_send:
        # Configure mock to validate input and return dummy response
        async def validate_batch_request(*, agent_type, agent_messages_mapping, agent_tools_mapping, agent_llm_config_mapping):
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
                assert available_tools == {"get_weather"}, f"Expected only send_message tool, got {available_tools}"

            # Verify model assignments
            for agent_id, expected_model in expected_models.items():
                actual_model = agent_llm_config_mapping[agent_id].model
                assert actual_model == expected_model, f"Expected model {expected_model}, got {actual_model}"

            return dummy_batch_response

        mock_send.side_effect = validate_batch_request

        # Create batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=default_user,
        )

        # Run the method under test
        response = await batch_runner.step_until_request(
            batch_requests=batch_requests,
            agent_step_state_mapping=step_state_map,
            letta_batch_job_id=batch_job.id,
        )

        # Verify the mock was called exactly once
        mock_send.assert_called_once()

        # Verify database records were created correctly
        llm_batch_jobs = await server.batch_manager.list_llm_batch_jobs_async(letta_batch_id=response.letta_batch_id, actor=default_user)
        assert len(llm_batch_jobs) == 1, f"Expected 1 llm_batch_jobs, got {len(llm_batch_jobs)}"

        llm_batch_job = llm_batch_jobs[0]
        llm_batch_items = await server.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_job.id, actor=default_user)
        assert len(llm_batch_items) == 3, f"Expected 3 llm_batch_items, got {len(llm_batch_items)}"

        # Verify job properties
        assert llm_batch_job.llm_provider == ProviderType.anthropic, "Job provider should be Anthropic"
        assert llm_batch_job.status == JobStatus.running, "Job status should be 'running'"

        # Verify all agents are represented in batch items
        agent_ids_in_items = {item.agent_id for item in llm_batch_items}
        expected_agent_ids = {agent.id for agent in agents}
        assert agent_ids_in_items == expected_agent_ids, f"Expected agent IDs {expected_agent_ids}, got {agent_ids_in_items}"
