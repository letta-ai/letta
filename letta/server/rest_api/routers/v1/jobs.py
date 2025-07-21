from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.enums import JobStatus
from letta.schemas.job import Job
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.settings import settings

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[Job], operation_id="list_jobs")
async def list_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(50, description="Limit for pagination"),
    ascending: bool = Query(True, description="Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)"),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all jobs.
    TODO (cliandy): implementation for pagination
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # TODO: add filtering by status
    return await server.job_manager.list_jobs_async(
        actor=actor,
        source_id=source_id,
        before=before,
        after=after,
        limit=limit,
        ascending=ascending,
    )


@router.get("/active", response_model=List[Job], operation_id="list_active_jobs")
async def list_active_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(50, description="Limit for pagination"),
    ascending: bool = Query(True, description="Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)"),
):
    """
    List all active jobs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
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
    job_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get the status of a job.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        return await server.job_manager.get_job_by_id_async(job_id=job_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Job not found")


@router.patch("/{job_id}/cancel", response_model=Job, operation_id="cancel_job")
async def cancel_job(
    job_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Cancel a job by its job_id.

    This endpoint marks a job as cancelled, which will cause any associated
    agent execution to terminate as soon as possible.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    if not settings.track_agent_run:
        raise HTTPException(status_code=400, detail="Agent run tracking is disabled")

    try:
        # First check if the job exists and is in a cancellable state
        existing_job = await server.job_manager.get_job_by_id_async(job_id=job_id, actor=actor)

        if existing_job.status.is_terminal:
            return False

        return await server.job_manager.safe_update_job_status_async(job_id=job_id, new_status=JobStatus.cancelled, actor=actor)

    except NoResultFound:
        raise HTTPException(status_code=404, detail="Job not found")


@router.delete("/{job_id}", response_model=Job, operation_id="delete_job")
async def delete_job(
    job_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete a job by its job_id.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        job = await server.job_manager.delete_job_by_id_async(job_id=job_id, actor=actor)
        return job
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Job not found")
