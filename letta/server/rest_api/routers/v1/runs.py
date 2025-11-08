from datetime import timedelta
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import Field

from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import LettaExpiredError, LettaInvalidArgumentError
from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.enums import RunStatus
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.letta_request import RetrieveStreamRequest
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.run import Run
from letta.schemas.run_metrics import RunMetrics
from letta.schemas.step import Step
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.redis_stream_manager import redis_sse_stream_generator
from letta.server.rest_api.streaming_response import (
    StreamingResponseWithStatusCode,
    add_keepalive_to_stream,
    cancellation_aware_stream_wrapper,
)
from letta.server.server import SyncServer
from letta.services.run_manager import RunManager
from letta.settings import settings

router = APIRouter(prefix="/runs", tags=["runs"])


def convert_statuses_to_enum(statuses: Optional[List[str]]) -> Optional[List[RunStatus]]:
    """Convert a list of status strings to RunStatus enum values.

    Args:
        statuses: List of status strings or None

    Returns:
        List of RunStatus enum values or None if input is None
    """
    if statuses is None:
        return None
    return [RunStatus(status) for status in statuses]


@router.get("/", response_model=List[Run], operation_id="list_runs")
async def list_runs(
    server: "SyncServer" = Depends(get_letta_server),
    agent_id: Optional[str] = Query(None, description="The unique identifier of the agent associated with the run."),
    agent_ids: Optional[List[str]] = Query(
        None,
        description="The unique identifiers of the agents associated with the run. Deprecated in favor of agent_id field.",
        deprecated=True,
    ),
    statuses: Optional[List[str]] = Query(None, description="Filter runs by status. Can specify multiple statuses."),
    background: Optional[bool] = Query(None, description="If True, filters for runs that were created in background mode."),
    stop_reason: Optional[StopReasonType] = Query(None, description="Filter runs by stop reason."),
    before: Optional[str] = Query(
        None, description="Run ID cursor for pagination. Returns runs that come before this run ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Run ID cursor for pagination. Returns runs that come after this run ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of runs to return", le=1000),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for runs by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    active: bool = Query(False, description="Filter for active runs."),
    ascending: bool = Query(
        False,
        description="Whether to sort agents oldest to newest (True) or newest to oldest (False, default). Deprecated in favor of order field.",
        deprecated=True,
    ),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List all runs.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()

    # Handle backwards compatibility: if statuses not provided but active=True, filter by active statuses
    if statuses is None and active:
        statuses = [RunStatus.created, RunStatus.running]

    if agent_id:
        # NOTE: we are deprecating agent_ids so this will the primary path soon
        agent_ids = [agent_id]

    # Handle backward compatibility: if ascending is explicitly set, use it; otherwise use order
    if ascending is not False:
        # ascending was explicitly set to True
        sort_ascending = ascending
    else:
        # Use the new order parameter
        sort_ascending = order == "asc"

    # Convert string statuses to RunStatus enum
    parsed_statuses = convert_statuses_to_enum(statuses)

    runs = await runs_manager.list_runs(
        actor=actor,
        agent_ids=agent_ids,
        statuses=parsed_statuses,
        limit=limit,
        before=before,
        after=after,
        ascending=sort_ascending,
        stop_reason=stop_reason,
        background=background,
    )
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
    runs_manager = RunManager()

    if agent_id:
        agent_ids = [agent_id]
    else:
        agent_ids = None

    active_runs = await runs_manager.list_runs(
        actor=actor, statuses=[RunStatus.created, RunStatus.running], agent_ids=agent_ids, background=background
    )

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
    runs_manager = RunManager()
    return await runs_manager.get_run_with_status(run_id=run_id, actor=actor)


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
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """Get response messages associated with a run."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.run_manager.get_run_messages(run_id=run_id, actor=actor, before=before, after=after, limit=limit, order=order)


@router.get("/{run_id}/usage", response_model=UsageStatistics, operation_id="retrieve_run_usage")
async def retrieve_run_usage(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get usage statistics for a run.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()

    return await runs_manager.get_run_usage(run_id=run_id, actor=actor)


@router.get("/{run_id}/metrics", response_model=RunMetrics, operation_id="retrieve_metrics_for_run")
async def retrieve_metrics_for_run(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Get run metrics by run ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()
    return await runs_manager.get_run_metrics_async(run_id=run_id, actor=actor)


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
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for steps by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
):
    """
    Get steps associated with a run with filtering options.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()

    return await runs_manager.get_run_steps(
        run_id=run_id,
        actor=actor,
        limit=limit,
        before=before,
        after=after,
        ascending=(order == "asc"),
    )


@router.delete("/{run_id}", response_model=None, operation_id="delete_run")
async def delete_run(
    run_id: str,
    headers: HeaderParams = Depends(get_headers),
    server: "SyncServer" = Depends(get_letta_server),
):
    """
    Delete a run by its run_id.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()
    return await runs_manager.delete_run_by_id(run_id=run_id, actor=actor)


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
    runs_manager = RunManager()

    run = await runs_manager.get_run_by_id(run_id=run_id, actor=actor)

    if not run.background:
        raise LettaInvalidArgumentError("Run was not created in background mode, so it cannot be retrieved.")

    if run.created_at < get_utc_time() - timedelta(hours=3):
        raise LettaExpiredError("Run was created more than 3 hours ago, and is now expired.")

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
            run_manager=server.run_manager,
            run_id=run_id,
            actor=actor,
        )

    if request.include_pings and settings.enable_keepalive:
        stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval, run_id=run_id)

    return StreamingResponseWithStatusCode(
        stream,
        media_type="text/event-stream",
    )
