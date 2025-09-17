import asyncio
import datetime
from typing import List

from letta.agents.letta_agent_batch import LettaAgentBatch
from letta.jobs.helpers import map_anthropic_batch_job_status_to_job_status, map_anthropic_individual_batch_item_status_to_job_status
from letta.jobs.types import BatchPollingResult, ItemUpdateInfo
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import JobStatus, ProviderType
from letta.schemas.letta_response import LettaBatchResponse
from letta.schemas.llm_batch_job import LLMBatchJob
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.settings import settings

logger = get_logger(__name__)


class BatchPollingMetrics:
    """Class to track metrics for batch polling operations."""

    def __init__(self):
        self.start_time = datetime.datetime.now()
        self.total_batches = 0
        self.anthropic_batches = 0
        self.running_count = 0
        self.completed_count = 0
        self.updated_items_count = 0

    def log_summary(self):
        """Log a summary of the metrics collected during polling."""
        elapsed = (datetime.datetime.now() - self.start_time).total_seconds()
        logger.info(f"[Poll BatchJob] Finished poll_running_llm_batches job in {elapsed:.2f}s")
        logger.info(f"[Poll BatchJob] Found {self.total_batches} running batches total.")
        logger.info(f"[Poll BatchJob] Found {self.anthropic_batches} Anthropic batch(es) to poll.")
        logger.info(f"[Poll BatchJob] Final results: {self.completed_count} completed, {self.running_count} still running.")
        logger.info(f"[Poll BatchJob] Updated {self.updated_items_count} items for newly completed batch(es).")


@trace_method
async def fetch_batch_status(server: SyncServer, batch_job: LLMBatchJob) -> BatchPollingResult:
    """
    Fetch the current status of a single batch job from the provider.

    Args:
        server: The SyncServer instance
        batch_job: The batch job to check status for

    Returns:
        A tuple containing (batch_id, new_status, polling_response)
    """
    batch_id_str = batch_job.create_batch_response.id
    try:
        response = await server.anthropic_async_client.beta.messages.batches.retrieve(batch_id_str)
        new_status = map_anthropic_batch_job_status_to_job_status(response.processing_status)
        logger.debug(f"[Poll BatchJob] Batch {batch_job.id}: provider={response.processing_status} → internal={new_status}")
        return BatchPollingResult(batch_job.id, new_status, response)
    except Exception as e:
        logger.error(f"[Poll BatchJob] Batch {batch_job.id}: failed to retrieve {batch_id_str}: {e}")
        # We treat a retrieval error as still running to try again next cycle
        return BatchPollingResult(batch_job.id, JobStatus.running, None)


@trace_method
async def fetch_batch_items(server: SyncServer, batch_id: str, batch_resp_id: str) -> List[ItemUpdateInfo]:
    """
    Fetch individual item results for a completed batch.

    Args:
        server: The SyncServer instance
        batch_id: The internal batch ID
        batch_resp_id: The provider's batch response ID

    Returns:
        A list of item update information tuples
    """
    updates = []
    try:
        results = await server.anthropic_async_client.beta.messages.batches.results(batch_resp_id)
        async for item_result in results:
            # Here, custom_id should be the agent_id
            item_status = map_anthropic_individual_batch_item_status_to_job_status(item_result)
            updates.append(ItemUpdateInfo(batch_id, item_result.custom_id, item_status, item_result))
        logger.info(f"[Poll BatchJob] Fetched {len(updates)} item updates for batch {batch_id}.")
    except Exception as e:
        logger.error(f"[Poll BatchJob] Error fetching item updates for batch {batch_id}: {e}")

    return updates


@trace_method
async def poll_batch_updates(server: SyncServer, batch_jobs: List[LLMBatchJob], metrics: BatchPollingMetrics) -> List[BatchPollingResult]:
    """
    Poll for updates to multiple batch jobs concurrently.

    Args:
        server: The SyncServer instance
        batch_jobs: List of batch jobs to poll
        metrics: Metrics collection object

    Returns:
        List of batch polling results
    """
    if not batch_jobs:
        logger.info("[Poll BatchJob] No Anthropic batches to update; job complete.")
        return []

    # Create polling tasks for all batch jobs
    coros = [fetch_batch_status(server, b) for b in batch_jobs]
    results: List[BatchPollingResult] = await asyncio.gather(*coros)

    # Update the server with batch status changes
    await server.batch_manager.bulk_update_llm_batch_statuses_async(updates=results)
    logger.info(f"[Poll BatchJob] Bulk-updated {len(results)} LLM batch(es) in the DB at job level.")

    return results


@trace_method
async def process_completed_batches(
    server: SyncServer, batch_results: List[BatchPollingResult], metrics: BatchPollingMetrics
) -> List[ItemUpdateInfo]:
    """
    Process batches that have completed and fetch their item results.

    Args:
        server: The SyncServer instance
        batch_results: Results from polling batch statuses
        metrics: Metrics collection object

    Returns:
        List of item updates to apply
    """
    item_update_tasks = []

    # Process each top-level polling result
    for batch_id, new_status, maybe_batch_resp in batch_results:
        if not maybe_batch_resp:
            if new_status == JobStatus.running:
                metrics.running_count += 1
            logger.warning(f"[Poll BatchJob] Batch {batch_id}: JobStatus was {new_status} and no batch response was found.")
            continue

        if new_status == JobStatus.completed:
            metrics.completed_count += 1
            batch_resp_id = maybe_batch_resp.id  # The Anthropic-assigned batch ID
            # Queue an async call to fetch item results for this batch
            item_update_tasks.append(fetch_batch_items(server, batch_id, batch_resp_id))
        elif new_status == JobStatus.running:
            metrics.running_count += 1

    # Launch all item update tasks concurrently
    concurrent_results = await asyncio.gather(*item_update_tasks, return_exceptions=True)

    # Flatten and filter the results
    item_updates = []
    for result in concurrent_results:
        if isinstance(result, Exception):
            logger.error(f"[Poll BatchJob] A fetch_batch_items task failed with: {result}")
        elif isinstance(result, list):
            item_updates.extend(result)

    logger.info(f"[Poll BatchJob] Collected a total of {len(item_updates)} item update(s) from completed batches.")

    return item_updates


@trace_method
async def poll_running_llm_batches(server: "SyncServer") -> List[LettaBatchResponse]:
    """
    Cron job to poll all running LLM batch jobs and update their polling responses in bulk.

    Steps:
      1. Fetch currently running batch jobs
      2. Filter Anthropic only
      3. Retrieve updated top-level polling info concurrently
      4. Bulk update LLMBatchJob statuses
      5. For each completed batch, call .results(...) to get item-level results
      6. Bulk update all matching LLMBatchItem records by (batch_id, agent_id)
      7. Log telemetry about success/fail
    """
    # Initialize metrics tracking
    metrics = BatchPollingMetrics()

    logger.info("[Poll BatchJob] Starting poll_running_llm_batches job")

    try:
        # 1. Retrieve running batch jobs
        batches = await server.batch_manager.list_running_llm_batches_async(
            weeks=max(settings.batch_job_polling_lookback_weeks, 1), batch_size=settings.batch_job_polling_batch_size
        )
        metrics.total_batches = len(batches)

        # TODO: Expand to more providers
        # 2. Filter for Anthropic jobs only
        anthropic_batch_jobs = [b for b in batches if b.llm_provider == ProviderType.anthropic]
        metrics.anthropic_batches = len(anthropic_batch_jobs)

        # 3-4. Poll for batch updates and bulk update statuses
        batch_results = await poll_batch_updates(server, anthropic_batch_jobs, metrics)

        # 5. Process completed batches and fetch item results
        item_updates = await process_completed_batches(server, batch_results, metrics)

        # 6. Bulk update all items for newly completed batch(es)
        if item_updates:
            metrics.updated_items_count = len(item_updates)
            await server.batch_manager.bulk_update_batch_llm_items_results_by_agent_async(item_updates)

            # ─── Kick off post‑processing for each batch that just completed ───
            completed = [r for r in batch_results if r.request_status == JobStatus.completed]

            async def _resume(batch_row: LLMBatchJob) -> LettaBatchResponse:
                actor: User = await server.user_manager.get_actor_by_id_async(batch_row.created_by_id)
                runner = LettaAgentBatch(
                    message_manager=server.message_manager,
                    agent_manager=server.agent_manager,
                    block_manager=server.block_manager,
                    passage_manager=server.passage_manager,
                    batch_manager=server.batch_manager,
                    sandbox_config_manager=server.sandbox_config_manager,
                    job_manager=server.job_manager,
                    actor=actor,
                )
                return await runner.resume_step_after_request(
                    letta_batch_id=batch_row.letta_batch_job_id,
                    llm_batch_id=batch_row.id,
                )

            # launch them all at once
            async def get_and_resume(batch_id):
                batch = await server.batch_manager.get_llm_batch_job_by_id_async(batch_id)
                return await _resume(batch)

            tasks = [get_and_resume(bid) for bid, *_ in completed]
            new_batch_responses = await asyncio.gather(*tasks, return_exceptions=True)

            return new_batch_responses
        else:
            logger.info("[Poll BatchJob] No item-level updates needed.")

    except Exception as e:
        logger.exception("[Poll BatchJob] Unhandled error in poll_running_llm_batches", exc_info=e)
    finally:
        # 7. Log metrics summary
        metrics.log_summary()
