from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query

from letta.errors import LettaInvalidArgumentError
from letta.schemas.enums import JobStatus
from letta.schemas.job import Job, JobBase
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.settings import settings
from letta.validators import JobId

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[Job], operation_id="list_jobs")
async def list_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
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
    active: bool = Query(False, description="Filter for active jobs."),
    ascending: bool = Query(
        True,
        description="Whether to sort jobs oldest to newest (True, default) or newest to oldest (False). Deprecated in favor of order field.",
        deprecated=True,
    ),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List all jobs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    statuses = None
    if active:
        statuses = [JobStatus.created, JobStatus.running]

    if ascending is not True:
        sort_ascending = ascending
    else:
        sort_ascending = order == "asc"

    # TODO: add filtering by status
    return await server.job_manager.list_jobs_async(
        actor=actor,
        statuses=statuses,
        source_id=source_id,
        before=before,
        after=after,
        limit=limit,
        ascending=sort_ascending,
    )


@router.get("/active", response_model=List[Job], operation_id="list_active_jobs", deprecated=True)
async def list_active_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(50, description="Limit for pagination"),
    ascending: bool = Query(True, description="Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)"),
):
    """
    List all active jobs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.job_manager.list_jobs_async(
        actor=actor,
        statuses=[JobStatus.created, JobStatus.running],
        source_id=source_id,
        before=before,
        after=after,
        limit=limit,
        ascending=ascending,
    )


@router.get("/{job_id}", response_model=Job, operation_id="retrieve_job")
async def retrieve_job(
    job_id: JobId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get the status of a job.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.job_manager.get_job_by_id_async(job_id=job_id, actor=actor)


@router.patch("/{job_id}/cancel", response_model=Job, operation_id="cancel_job")
async def cancel_job(
    job_id: JobId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Cancel a job by its job_id.

    This endpoint marks a job as cancelled, which will cause any associated
    agent execution to terminate as soon as possible.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    if not settings.track_agent_run:
        raise LettaInvalidArgumentError("Agent run tracking is disabled")

    # First check if the job exists and is in a cancellable state
    existing_job = await server.job_manager.get_job_by_id_async(job_id=job_id, actor=actor)

    if existing_job.status.is_terminal:
        return False

    return await server.job_manager.safe_update_job_status_async(job_id=job_id, new_status=JobStatus.cancelled, actor=actor)


@router.delete("/{job_id}", response_model=Job, operation_id="delete_job")
async def delete_job(
    job_id: JobId,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete a job by its job_id.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.job_manager.delete_job_by_id_async(job_id=job_id, actor=actor)
