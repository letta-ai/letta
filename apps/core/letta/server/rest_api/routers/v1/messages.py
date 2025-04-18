from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Header
from fastapi.exceptions import HTTPException
from starlette.requests import Request

from letta.agents.letta_agent_batch import LettaAgentBatch
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.schemas.job import BatchJob, JobStatus, JobType
from letta.schemas.letta_request import CreateBatch
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/messages", tags=["messages"])

logger = get_logger(__name__)


# Batch APIs


@router.post(
    "/batches",
    response_model=BatchJob,
    operation_id="create_messages_batch",
)
async def create_messages_batch(
    request: Request,
    payload: CreateBatch = Body(..., description="Messages and config for all agents"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Submit a batch of agent messages for asynchronous processing.
    Creates a job that will fan out messages to all listed agents and process them in parallel.
    """
    # Reject requests greater than 256Mbs
    max_bytes = 256 * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length:
        length = int(content_length)
        if length > max_bytes:
            raise HTTPException(status_code=413, detail=f"Request too large ({length} bytes). Max is {max_bytes} bytes.")

    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)

        # Create a new job
        batch_job = BatchJob(
            user_id=actor.id,
            status=JobStatus.created,
            metadata={
                "job_type": "batch_messages",
            },
            callback_url=str(payload.callback_url),
        )

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
        llm_batch_job = await batch_runner.step_until_request(batch_requests=payload.requests, letta_batch_job_id=batch_job.id)

        # TODO: update run metadata
        batch_job = server.job_manager.create_job(pydantic_job=batch_job, actor=actor)
    except Exception:
        import traceback

        traceback.print_exc()
        raise
    return batch_job


@router.get("/batches/{batch_id}", response_model=BatchJob, operation_id="retrieve_batch_run")
async def retrieve_batch_run(
    batch_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get the status of a batch run.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        job = server.job_manager.get_job_by_id(job_id=batch_id, actor=actor)
        return BatchJob.from_job(job)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.get("/batches", response_model=List[BatchJob], operation_id="list_batch_runs")
async def list_batch_runs(
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    List all batch runs.
    """
    # TODO: filter
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    jobs = server.job_manager.list_jobs(actor=actor, statuses=[JobStatus.created, JobStatus.running], job_type=JobType.BATCH)
    return [BatchJob.from_job(job) for job in jobs]


@router.patch("/batches/{batch_id}/cancel", operation_id="cancel_batch_run")
async def cancel_batch_run(
    batch_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Cancel a batch run.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        job = server.job_manager.get_job_by_id(job_id=batch_id, actor=actor)
        job.status = JobStatus.cancelled
        server.job_manager.update_job_by_id(job_id=job, job=job)
        # TODO: actually cancel it
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Run not found")
