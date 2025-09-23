from datetime import timedelta
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import Field
from temporalio.client import Client

from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.helpers.datetime_helpers import get_utc_time
from letta.orm.errors import NoResultFound
from letta.schemas.enums import JobStatus, JobType
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.letta_request import RetrieveStreamRequest
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.run import Run
from letta.schemas.step import Step
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.redis_stream_manager import redis_sse_stream_generator
from letta.server.rest_api.streaming_response import (
    StreamingResponseWithStatusCode,
    add_keepalive_to_stream,
    cancellation_aware_stream_wrapper,
)
from letta.server.server import SyncServer
from letta.settings import settings

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/", response_model=List[Run], operation_id="list_runs")
async def list_runs(
    server: "SyncServer" = Depends(get_letta_server),
    agent_id: Optional[str] = Query(None, description="The unique identifier of the agent associated with the run."),
    agent_ids: Optional[List[str]] = Query(None, description="(DEPRECATED) The unique identifiers of the agents associated with the run."),
    background: Optional[bool] = Query(None, description="If True, filters for runs that were created in background mode."),
    stop_reason: Optional[StopReasonType] = Query(None, description="Filter runs by stop reason."),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(50, description="Maximum number of runs to return"),
    active: bool = Query(False, description="Filter for active runs."),
    ascending: bool = Query(
        False,
        description="Whether to sort agents oldest to newest (True) or newest to oldest (False, default)",
    ),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List all runs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    statuses = None
    if active:
        statuses = [JobStatus.created, JobStatus.running]
    if agent_id:
        # NOTE: we are deprecating agent_ids so this will the primary path soon
        agent_ids = [agent_id]

    jobs = await server.job_manager.list_jobs_async(
        actor=actor,
        statuses=statuses,
        job_type=JobType.RUN,
        limit=limit,
        before=before,
        after=after,
        ascending=False,
        stop_reason=stop_reason,
        # agent_id=agent_id,
        agent_ids=agent_ids,
        background=background,
    )
    runs = [Run.from_job(job) for job in jobs]
    return runs


@router.get("/active", response_model=List[Run], operation_id="list_active_runs", deprecated=True)
async def list_active_runs(
    server: "SyncServer" = Depends(get_letta_server),
    agent_id: Optional[str] = Query(None, description="The unique identifier of the agent associated with the run."),
    background: Optional[bool] = Query(None, description="If True, filters for runs that were created in background mode."),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List all active runs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if agent_id:
        agent_ids = [agent_id]
    else:
        agent_ids = None

    active_runs = await server.job_manager.list_jobs_async(
        actor=actor, statuses=[JobStatus.created, JobStatus.running], job_type=JobType.RUN, agent_ids=agent_ids, background=background
    )
    active_runs = [Run.from_job(job) for job in active_runs]

    return active_runs


@router.get("/{run_id}", response_model=Run, operation_id="retrieve_run")
async def retrieve_run(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get the status of a run.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        job = await server.job_manager.get_job_by_id_async(job_id=run_id, actor=actor)

        use_lettuce = job.metadata.get("lettuce") and settings.temporal_endpoint
        if use_lettuce and job.status not in [JobStatus.completed, JobStatus.failed, JobStatus.cancelled]:
            client = await Client.connect(
                settings.temporal_endpoint,
                namespace=settings.temporal_namespace,
                api_key=settings.temporal_api_key,
                tls=settings.temporal_tls,  # This should be false for local runs
            )
            handle = client.get_workflow_handle(run_id)

            # Fetch the workflow description
            desc = await handle.describe()

            # Map the status to our enum
            job_status = JobStatus.created
            if desc.status.name == "RUNNING":
                job_status = JobStatus.running
            elif desc.status.name == "COMPLETED":
                job_status = JobStatus.completed
            elif desc.status.name == "FAILED":
                job_status = JobStatus.failed
            elif desc.status.name == "CANCELED":
                job_status = JobStatus.canceled
            # elif desc.status.name == "TERMINATED":
            #     job_status = JobStatus.terminated
            # elif desc.status.name == "TIMED_OUT":
            #     job_status = JobStatus.timed_out
            # elif desc.status.name == "CONTINUED_AS_NEW":
            #     return WorkflowStatus.CONTINUED_AS_NEW
            # else:
            #     return WorkflowStatus.UNKNOWN
            job.status = job_status
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
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: Literal["asc", "desc"] = Query(
        "asc", description="Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
):
    """Get response messages associated with a run."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        messages = await server.job_manager.get_run_messages(
            run_id=run_id,
            actor=actor,
            limit=limit,
            before=before,
            after=after,
            ascending=(order == "asc"),
        )
        return messages
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{run_id}/usage", response_model=UsageStatistics, operation_id="retrieve_run_usage")
def retrieve_run_usage(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get usage statistics for a run.
    """
    actor = server.user_manager.get_user_or_default(user_id=headers.actor_id)

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
    headers: HeaderParams = Depends(get_headers),
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

    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        steps = await server.job_manager.get_job_steps(
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
async def delete_run(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete a run by its run_id.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    try:
        job = await server.job_manager.delete_job_by_id_async(job_id=run_id, actor=actor)
        return Run.from_job(job)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Run not found")


@router.post(
    "/{run_id}/stream",
    response_model=None,
    operation_id="retrieve_stream",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                # Align streaming schema with agents.create_stream so SDKs accept approval messages
                "text/event-stream": {
                    "description": "Server-Sent Events stream",
                    "schema": {
                        "oneOf": [
                            {"$ref": "#/components/schemas/SystemMessage"},
                            {"$ref": "#/components/schemas/UserMessage"},
                            {"$ref": "#/components/schemas/ReasoningMessage"},
                            {"$ref": "#/components/schemas/HiddenReasoningMessage"},
                            {"$ref": "#/components/schemas/ToolCallMessage"},
                            {"$ref": "#/components/schemas/ToolReturnMessage"},
                            {"$ref": "#/components/schemas/AssistantMessage"},
                            {"$ref": "#/components/schemas/ApprovalRequestMessage"},
                            {"$ref": "#/components/schemas/ApprovalResponseMessage"},
                            {"$ref": "#/components/schemas/LettaPing"},
                            {"$ref": "#/components/schemas/LettaStopReason"},
                            {"$ref": "#/components/schemas/LettaUsageStatistics"},
                        ]
                    },
                },
            },
        }
    },
)
async def retrieve_stream(
    run_id: str,
    request: RetrieveStreamRequest = Body(None),
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    try:
        job = await server.job_manager.get_job_by_id_async(job_id=run_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Run not found")

    run = Run.from_job(job)

    if not run.background:
        raise HTTPException(status_code=400, detail="Run was not created in background mode, so it cannot be retrieved.")

    if run.created_at < get_utc_time() - timedelta(hours=3):
        raise HTTPException(status_code=410, detail="Run was created more than 3 hours ago, and is now expired.")

    redis_client = await get_redis_client()

    if isinstance(redis_client, NoopAsyncRedisClient):
        raise HTTPException(
            status_code=503,
            detail=(
                "Background streaming requires Redis to be running. "
                "Please ensure Redis is properly configured. "
                f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}"
            ),
        )

    stream = redis_sse_stream_generator(
        redis_client=redis_client,
        run_id=run_id,
        starting_after=request.starting_after,
        poll_interval=request.poll_interval,
        batch_size=request.batch_size,
    )

    if settings.enable_cancellation_aware_streaming:
        stream = cancellation_aware_stream_wrapper(
            stream_generator=stream,
            job_manager=server.job_manager,
            job_id=run_id,
            actor=actor,
        )

    if request.include_pings and settings.enable_keepalive:
        stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval)

    return StreamingResponseWithStatusCode(
        stream,
        media_type="text/event-stream",
    )
