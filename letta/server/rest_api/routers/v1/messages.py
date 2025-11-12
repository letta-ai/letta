from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Query
from starlette.requests import Request

from letta.agents.letta_agent_batch import LettaAgentBatch
from letta.errors import LettaInvalidArgumentError
from letta.log import get_logger
from letta.schemas.job import BatchJob, JobStatus, JobType, JobUpdate
from letta.schemas.letta_request import CreateBatch
from letta.schemas.letta_response import LettaBatchMessages
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.settings import settings

router = APIRouter(prefix="/messages", tags=["messages"])

logger = get_logger(__name__)


@router.post(
    "/batches",
    response_model=BatchJob,
    operation_id="create_batch",
)
async def create_batch(
    request: Request,
    payload: CreateBatch = Body(..., description="Messages and config for all agents"),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Submit a batch of agent runs for asynchronous processing.

    Creates a job that will fan out messages to all listed agents and process them in parallel.
    The request will be rejected if it exceeds 256MB.
    """
    # Reject requests greater than 256Mbs
    max_bytes = 256 * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length:
        length = int(content_length)
        if length > max_bytes:
            raise LettaInvalidArgumentError(
                message=f"Request too large ({length} bytes). Max is {max_bytes} bytes.", argument_name="content-length"
            )

    if not settings.enable_batch_job_polling:
        logger.warning("Batch job polling is disabled. Enable batch processing by setting LETTA_ENABLE_BATCH_JOB_POLLING to True.")

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    batch_job = BatchJob(
        user_id=actor.id,
        status=JobStatus.running,
        metadata={
            "job_type": "batch_messages",
        },
        callback_url=str(payload.callback_url),
    )

    try:
        batch_job = await server.job_manager.create_job_async(pydantic_job=batch_job, actor=actor)

        # create the batch runner
        batch_runner = LettaAgentBatch(
            message_manager=server.message_manager,
            agent_manager=server.agent_manager,
            block_manager=server.block_manager,
            passage_manager=server.passage_manager,
            batch_manager=server.batch_manager,
            sandbox_config_manager=server.sandbox_config_manager,
            job_manager=server.job_manager,
            actor=actor,
        )
        await batch_runner.step_until_request(batch_requests=payload.requests, letta_batch_job_id=batch_job.id)

        # TODO: update run metadata
    except Exception as e:
        logger.error(f"Error creating batch job: {e}")

        # mark job as failed
        await server.job_manager.update_job_by_id_async(job_id=batch_job.id, job_update=JobUpdate(status=JobStatus.failed), actor=actor)
        raise
    return batch_job


@router.get("/batches/{batch_id}", response_model=BatchJob, operation_id="retrieve_batch")
async def retrieve_batch(
    batch_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Retrieve the status and details of a batch run.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    job = await server.job_manager.get_job_by_id_async(job_id=batch_id, actor=actor)
    return BatchJob.from_job(job)


@router.get("/batches", response_model=List[BatchJob], operation_id="list_batches")
async def list_batches(
    before: Optional[str] = Query(
        None, description="Job ID cursor for pagination. Returns jobs that come before this job ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Job ID cursor for pagination. Returns jobs that come after this job ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of jobs to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for jobs by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    List all batch runs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    jobs = await server.job_manager.list_jobs_async(
        actor=actor,
        statuses=[JobStatus.created, JobStatus.running],
        job_type=JobType.BATCH,
        before=before,
        after=after,
        limit=limit,
        ascending=(order == "asc"),
    )
    return [BatchJob.from_job(job) for job in jobs]


@router.get(
    "/batches/{batch_id}/messages",
    response_model=LettaBatchMessages,
    operation_id="list_messages_for_batch",
)
async def list_messages_for_batch(
    batch_id: str,
    before: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    agent_id: Optional[str] = Query(None, description="Filter messages by agent ID"),
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get response messages for a specific batch job.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Verify the batch job exists and the user has access to it
    job = await server.job_manager.get_job_by_id_async(job_id=batch_id, actor=actor)
    BatchJob.from_job(job)

    # Get messages directly using our efficient method
    messages = await server.batch_manager.get_messages_for_letta_batch_async(
        letta_batch_job_id=batch_id, limit=limit, actor=actor, agent_id=agent_id, ascending=(order == "asc"), before=before, after=after
    )

    return LettaBatchMessages(messages=messages)


@router.patch("/batches/{batch_id}/cancel", operation_id="cancel_batch")
async def cancel_batch(
    batch_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Cancel a batch run.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    job = await server.job_manager.get_job_by_id_async(job_id=batch_id, actor=actor)
    job = await server.job_manager.update_job_by_id_async(job_id=job.id, job_update=JobUpdate(status=JobStatus.cancelled), actor=actor)

    # Get related llm batch jobs
    llm_batch_jobs = await server.batch_manager.list_llm_batch_jobs_async(letta_batch_id=job.id, actor=actor)
    for llm_batch_job in llm_batch_jobs:
        if llm_batch_job.status in {JobStatus.running, JobStatus.created}:
            # TODO: Extend to providers beyond anthropic
            # TODO: For now, we only support anthropic
            # Cancel the job
            if server.anthropic_async_client is None:
                raise HTTPException(status_code=501, detail="Batch job cancellation is not enabled")
            anthropic_batch_id = llm_batch_job.create_batch_response.id
            await server.anthropic_async_client.messages.batches.cancel(anthropic_batch_id)

            # Update all the batch_job statuses
            await server.batch_manager.update_llm_batch_status_async(llm_batch_id=llm_batch_job.id, status=JobStatus.cancelled, actor=actor)
