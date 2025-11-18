import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock

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
from dotenv import load_dotenv

from letta.config import LettaConfig
from letta.helpers import ToolRulesSolver
from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.orm import Base
from letta.schemas.agent import CreateAgent
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import JobStatus, ProviderType
from letta.schemas.job import BatchJob
from letta.schemas.llm_batch_job import AgentStepState
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool_rule import InitToolRule
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.services.agent_manager import AgentManager

# --- Server and Database Management --- #


@pytest.fixture(autouse=True)
async def _clear_tables():
    async with db_registry.async_session() as session:
        for table in reversed(Base.metadata.sorted_tables):  # Reverse to avoid FK issues
            # If this is the block_history table, skip it
            if table.name == "block_history":
                continue
            await session.execute(table.delete())  # Truncate table
        await session.commit()


def _run_server():
    """Starts the Letta server in a background thread."""
    load_dotenv()
    from letta.server.rest_api.app import start_server

    start_server(debug=True)


@pytest.fixture(scope="module")
def server_url():
    """Ensures a server is running and returns its base URL."""
    url = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

    if not os.getenv("LETTA_SERVER_URL"):
        thread = threading.Thread(target=_run_server, daemon=True)
        thread.start()
        time.sleep(5)  # Allow server startup time

    return url


@pytest.fixture(scope="module")
def server():
    config = LettaConfig.load()
    print("CONFIG PATH", config.config_path)
    config.save()
    return SyncServer()


# --- Dummy Response Factories --- #


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


def create_successful_response(custom_id: str) -> BetaMessageBatchIndividualResponse:
    """Create a dummy successful batch response."""
    return BetaMessageBatchIndividualResponse(
        custom_id=custom_id,
        result=BetaMessageBatchSucceededResult(
            type="succeeded",
            message=BetaMessage(
                id="msg_abc123",
                role="assistant",
                type="message",
                model="claude-3-5-sonnet-20240620",
                content=[{"type": "text", "text": "hi!"}],
                usage={"input_tokens": 5, "output_tokens": 7},
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


# --- Test Setup Helpers --- #


async def create_test_agent(name, actor, test_id: Optional[str] = None, model="anthropic/claude-sonnet-4-20250514"):
    """Create a test agent with standardized configuration."""
    dummy_llm_config = LLMConfig(
        model="claude-3-7-sonnet-latest",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=32000,
        handle="anthropic/claude-3-7-sonnet-latest",
        put_inner_thoughts_in_kwargs=True,
        max_tokens=4096,
    )

    dummy_embedding_config = EmbeddingConfig(
        embedding_model="letta-free",
        embedding_endpoint_type="openai",
        embedding_endpoint="https://embeddings.letta.com/",
        embedding_dim=1536,
        embedding_chunk_size=300,
        handle="letta/letta-free",
    )

    agent_manager = AgentManager()
    agent_create = CreateAgent(
        name=name,
        include_base_tools=False,
        model=model,
        tags=["test_agents"],
        llm_config=dummy_llm_config,
        embedding_config=dummy_embedding_config,
    )

    return await agent_manager.create_agent_async(agent_create=agent_create, actor=actor, _test_only_force_id=test_id)


async def create_test_letta_batch_job_async(server, default_user):
    """Create a test batch job with the given batch response."""
    return await server.job_manager.create_job_async(BatchJob(user_id=default_user.id), actor=default_user)


async def create_test_llm_batch_job_async(server, batch_response, default_user):
    """Create a test batch job with the given batch response."""
    letta_batch_job = await create_test_letta_batch_job_async(server, default_user)

    return await server.batch_manager.create_llm_batch_job_async(
        llm_provider=ProviderType.anthropic,
        create_batch_response=batch_response,
        actor=default_user,
        status=JobStatus.running,
        letta_batch_job_id=letta_batch_job.id,
    )


async def create_test_batch_item(server, batch_id, agent_id, default_user):
    """Create a test batch item for the given batch and agent."""
    dummy_llm_config = LLMConfig(
        model="claude-3-7-sonnet-latest",
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        context_window=32000,
        handle="anthropic/claude-3-7-sonnet-latest",
        put_inner_thoughts_in_kwargs=True,
        max_tokens=4096,
    )

    common_step_state = AgentStepState(
        step_number=1, tool_rules_solver=ToolRulesSolver(tool_rules=[InitToolRule(tool_name="send_message")])
    )

    return await server.batch_manager.create_llm_batch_item_async(
        llm_batch_id=batch_id,
        agent_id=agent_id,
        llm_config=dummy_llm_config,
        step_state=common_step_state,
        actor=default_user,
    )


def mock_anthropic_client(server, batch_a_resp, batch_b_resp, agent_b_id, agent_c_id):
    """Set up mocks for the Anthropic client's retrieve and results methods."""

    # Mock the retrieve method
    async def dummy_retrieve(batch_resp_id: str) -> BetaMessageBatch:
        if batch_resp_id == batch_a_resp.id:
            return batch_a_resp
        elif batch_resp_id == batch_b_resp.id:
            return batch_b_resp
        else:
            raise ValueError(f"Unknown batch response id: {batch_resp_id}")

    server.anthropic_async_client.beta.messages.batches.retrieve = AsyncMock(side_effect=dummy_retrieve)

    class DummyAsyncIterable:
        def __init__(self, items):
            # copy so we can .pop()
            self._items = list(items)

        def __aiter__(self):
            return self

        async def __anext__(self):
            if not self._items:
                raise StopAsyncIteration
            return self._items.pop(0)

    # Mock the results method
    async def dummy_results(batch_resp_id: str):
        if batch_resp_id != batch_b_resp.id:
            raise RuntimeError("Unexpected batch ID")

        return DummyAsyncIterable(
            [
                create_successful_response(agent_b_id),
                create_failed_response(agent_c_id),
            ]
        )

    server.anthropic_async_client.beta.messages.batches.results = dummy_results


# -----------------------------
# End-to-End Test
# -----------------------------
@pytest.mark.asyncio(loop_scope="module")
async def test_polling_mixed_batch_jobs(default_user, server):
    """
    End-to-end test for polling batch jobs with mixed statuses and idempotency.

    Test scenario:
      - Create two batch jobs:
          - Job A: Single agent that remains "in_progress"
          - Job B: Two agents that complete (one succeeds, one fails)
      - Poll jobs and verify:
          - Job A remains in "running" state
          - Job B moves to "completed" state
          - Job B's items reflect appropriate individual success/failure statuses
      - Test idempotency:
          - Run additional polls and verify:
              - Completed job B remains unchanged (no status changes or re-polling)
              - In-progress job A continues to be polled
              - All batch items maintain their final states
    """
    # --- Step 1: Prepare test data ---
    # Create batch responses with different statuses
    batch_a_resp = create_batch_response("msgbatch_A", processing_status="in_progress")
    batch_b_resp = create_batch_response("msgbatch_B", processing_status="ended")

    # Create test agents
    agent_a = await create_test_agent("agent_a", default_user)
    agent_b = await create_test_agent("agent_b", default_user)
    agent_c = await create_test_agent("agent_c", default_user)

    # --- Step 2: Create batch jobs ---
    job_a = await create_test_llm_batch_job_async(server, batch_a_resp, default_user)
    job_b = await create_test_llm_batch_job_async(server, batch_b_resp, default_user)

    # --- Step 3: Create batch items ---
    item_a = await create_test_batch_item(server, job_a.id, agent_a.id, default_user)
    item_b = await create_test_batch_item(server, job_b.id, agent_b.id, default_user)
    item_c = await create_test_batch_item(server, job_b.id, agent_c.id, default_user)

    # --- Step 4: Mock the Anthropic client ---
    mock_anthropic_client(server, batch_a_resp, batch_b_resp, agent_b.id, agent_c.id)

    # --- Step 5: Run the polling job twice (simulating periodic polling) ---
    await poll_running_llm_batches(server)
    await poll_running_llm_batches(server)

    # --- Step 6: Verify batch job status updates ---
    updated_job_a = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_id=job_a.id, actor=default_user)
    updated_job_b = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_id=job_b.id, actor=default_user)

    # Job A should remain running since its processing_status is "in_progress"
    assert updated_job_a.status == JobStatus.running
    # Job B should be updated to completed
    assert updated_job_b.status == JobStatus.completed

    # Both jobs should have been polled
    assert updated_job_a.last_polled_at is not None
    assert updated_job_b.last_polled_at is not None
    assert updated_job_b.latest_polling_response is not None

    # --- Step 7: Verify batch item status updates ---
    # Item A should remain unchanged
    updated_item_a = await server.batch_manager.get_llm_batch_item_by_id_async(item_a.id, actor=default_user)
    assert updated_item_a.request_status == JobStatus.created
    assert updated_item_a.batch_request_result is None

    # Item B should be marked as completed with a successful result
    updated_item_b = await server.batch_manager.get_llm_batch_item_by_id_async(item_b.id, actor=default_user)
    assert updated_item_b.request_status == JobStatus.completed
    assert updated_item_b.batch_request_result is not None

    # Item C should be marked as failed with an error result
    updated_item_c = await server.batch_manager.get_llm_batch_item_by_id_async(item_c.id, actor=default_user)
    assert updated_item_c.request_status == JobStatus.failed
    assert updated_item_c.batch_request_result is not None

    # --- Step 8: Test idempotency by running polls again ---
    # Save timestamps and response objects to compare later
    job_a_polled_at = updated_job_a.last_polled_at
    job_b_polled_at = updated_job_b.last_polled_at
    job_b_response = updated_job_b.latest_polling_response

    # Save detailed item states
    item_a_status = updated_item_a.request_status
    item_b_status = updated_item_b.request_status
    item_c_status = updated_item_c.request_status
    item_b_result = updated_item_b.batch_request_result
    item_c_result = updated_item_c.batch_request_result

    # Run the polling job again multiple times
    await poll_running_llm_batches(server)
    await poll_running_llm_batches(server)
    await poll_running_llm_batches(server)

    # --- Step 9: Verify that nothing changed for completed jobs ---
    # Refresh all objects
    final_job_a = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_id=job_a.id, actor=default_user)
    final_job_b = await server.batch_manager.get_llm_batch_job_by_id_async(llm_batch_id=job_b.id, actor=default_user)
    final_item_a = await server.batch_manager.get_llm_batch_item_by_id_async(item_a.id, actor=default_user)
    final_item_b = await server.batch_manager.get_llm_batch_item_by_id_async(item_b.id, actor=default_user)
    final_item_c = await server.batch_manager.get_llm_batch_item_by_id_async(item_c.id, actor=default_user)

    # Job A should still be polling (last_polled_at should update)
    assert final_job_a.status == JobStatus.running
    assert final_job_a.last_polled_at > job_a_polled_at

    # Job B should remain completed with no status changes
    assert final_job_b.status == JobStatus.completed
    # The completed job should not be polled again
    assert final_job_b.last_polled_at == job_b_polled_at
    assert final_job_b.latest_polling_response == job_b_response

    # All items should maintain their final states
    assert final_item_a.request_status == item_a_status
    assert final_item_b.request_status == item_b_status
    assert final_item_c.request_status == item_c_status
    assert final_item_b.batch_request_result == item_b_result
    assert final_item_c.batch_request_result == item_c_result
