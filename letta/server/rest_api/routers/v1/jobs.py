from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.enums import JobStatus
from letta.schemas.job import Job
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[Job], operation_id="list_jobs")
async def list_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all jobs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # TODO: add filtering by status
    return await server.job_manager.list_jobs_async(
        actor=actor,
        source_id=source_id,
    )


@router.get("/active", response_model=List[Job], operation_id="list_active_jobs")
async def list_active_jobs(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    source_id: Optional[str] = Query(None, description="Only list jobs associated with the source."),
):
    """
    List all active jobs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.job_manager.list_jobs_async(actor=actor, statuses=[JobStatus.created, JobStatus.running], source_id=source_id)


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
