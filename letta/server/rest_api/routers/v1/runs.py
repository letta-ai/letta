from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import Field

from letta.orm.enums import JobType
from letta.orm.errors import NoResultFound
from letta.schemas.enums import JobStatus, MessageRole
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.run import Run
from letta.schemas.step import Step
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/", response_model=List[Run], operation_id="list_runs")
def list_runs(
    server: "SyncServer" = Depends(get_letta_server),
    agent_ids: Optional[List[str]] = Query(None, description="The unique identifier of the agent associated with the run."),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all runs.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    runs = [Run.from_job(job) for job in server.job_manager.list_jobs(actor=actor, job_type=JobType.RUN)]

    if not agent_ids:
        return runs

    return [run for run in runs if "agent_id" in run.metadata and run.metadata["agent_id"] in agent_ids]


@router.get("/active", response_model=List[Run], operation_id="list_active_runs")
def list_active_runs(
    server: "SyncServer" = Depends(get_letta_server),
    agent_ids: Optional[List[str]] = Query(None, description="The unique identifier of the agent associated with the run."),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all active runs.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    active_runs = server.job_manager.list_jobs(actor=actor, statuses=[JobStatus.created, JobStatus.running], job_type=JobType.RUN)

    active_runs = [Run.from_job(job) for job in active_runs]

    if not agent_ids:
        return active_runs

    return [run for run in active_runs if "agent_id" in run.metadata and run.metadata["agent_id"] in agent_ids]


@router.get("/{run_id}", response_model=Run, operation_id="retrieve_run")
def retrieve_run(
    run_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get the status of a run.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        job = server.job_manager.get_job_by_id(job_id=run_id, actor=actor)
        return Run.from_job(job)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Run not found")


RunMessagesResponse = Annotated[
    List[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get(
    "/{run_id}/messages",
    response_model=RunMessagesResponse,
    operation_id="list_run_messages",
)
async def list_run_messages(
    run_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: str = Query(
        "desc", description="Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order."
    ),
    role: Optional[MessageRole] = Query(None, description="Filter by role"),
):
    """
    Get messages associated with a run with filtering options.

    Args:
        run_id: ID of the run
        before: A cursor for use in pagination. `before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with obj_foo, your subsequent call can include before=obj_foo in order to fetch the previous page of the list.
        after: A cursor for use in pagination. `after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include after=obj_foo in order to fetch the next page of the list.
        limit: Maximum number of messages to return
        order: Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.
        role: Filter by role (user/assistant/system/tool)
        return_message_object: Whether to return Message objects or LettaMessage objects
        user_id: ID of the user making the request

    Returns:
        A list of messages associated with the run. Default is List[LettaMessage].
    """
    if order not in ["asc", "desc"]:
        raise HTTPException(status_code=400, detail="Order must be 'asc' or 'desc'")

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        messages = server.job_manager.get_run_messages(
            run_id=run_id,
            actor=actor,
            limit=limit,
            before=before,
            after=after,
            ascending=(order == "asc"),
            role=role,
        )
        return messages
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}/usage", response_model=UsageStatistics, operation_id="retrieve_run_usage")
def retrieve_run_usage(
    run_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get usage statistics for a run.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        usage = server.job_manager.get_job_usage(job_id=run_id, actor=actor)
        return usage
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")


@router.get(
    "/{run_id}/steps",
    response_model=List[Step],
    operation_id="list_run_steps",
)
async def list_run_steps(
    run_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: str = Query(
        "desc", description="Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order."
    ),
):
    """
    Get messages associated with a run with filtering options.

    Args:
        run_id: ID of the run
        before: A cursor for use in pagination. `before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with obj_foo, your subsequent call can include before=obj_foo in order to fetch the previous page of the list.
        after: A cursor for use in pagination. `after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include after=obj_foo in order to fetch the next page of the list.
        limit: Maximum number of steps to return
        order: Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.

    Returns:
        A list of steps associated with the run.
    """
    if order not in ["asc", "desc"]:
        raise HTTPException(status_code=400, detail="Order must be 'asc' or 'desc'")

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        steps = server.job_manager.get_job_steps(
            job_id=run_id,
            actor=actor,
            limit=limit,
            before=before,
            after=after,
            ascending=(order == "asc"),
        )
        return steps
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{run_id}", response_model=Run, operation_id="delete_run")
def delete_run(
    run_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete a run by its run_id.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        job = server.job_manager.delete_job_by_id(job_id=run_id, actor=actor)
        return Run.from_job(job)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Run not found")
