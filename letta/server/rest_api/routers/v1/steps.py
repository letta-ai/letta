from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Header, Query
from pydantic import BaseModel, Field

from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.message import Message
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.step import Step, StepBase
from letta.schemas.step_metrics import StepMetrics
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.services.step_manager import FeedbackType
from letta.settings import settings
from letta.validators import StepId

router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("/", response_model=List[Step], operation_id="list_steps")
async def list_steps(
    before: Optional[str] = Query(None, description="Return steps before this step ID"),
    after: Optional[str] = Query(None, description="Return steps after this step ID"),
    limit: Optional[int] = Query(50, description="Maximum number of steps to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for steps by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    start_date: Optional[str] = Query(None, description='Return steps after this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")'),
    end_date: Optional[str] = Query(None, description='Return steps before this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")'),
    model: Optional[str] = Query(None, description="Filter by the name of the model used for the step"),
    agent_id: Optional[str] = Query(None, description="Filter by the ID of the agent that performed the step"),
    trace_ids: Optional[list[str]] = Query(None, description="Filter by trace ids returned by the server"),
    feedback: Optional[Literal["positive", "negative"]] = Query(None, description="Filter by feedback"),
    has_feedback: Optional[bool] = Query(None, description="Filter by whether steps have feedback (true) or not (false)"),
    tags: Optional[list[str]] = Query(None, description="Filter by tags"),
    project_id: Optional[str] = Query(None, description="Filter by the project ID that is associated with the step (cloud only)."),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="Filter by project slug to associate with the group (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    List steps with optional pagination and date filters.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Convert ISO strings to datetime objects if provided
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    return await server.step_manager.list_steps_async(
        actor=actor,
        before=before,
        after=after,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
        order=(order == "asc"),
        model=model,
        agent_id=agent_id,
        trace_ids=trace_ids,
        feedback=feedback,
        has_feedback=has_feedback,
        project_id=project_id,
    )


@router.get("/{step_id}", response_model=Step, operation_id="retrieve_step")
async def retrieve_step(
    step_id: StepId,
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get a step by ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.step_manager.get_step_async(step_id=step_id, actor=actor)


@router.get("/{step_id}/metrics", response_model=StepMetrics, operation_id="retrieve_metrics_for_step")
async def retrieve_metrics_for_step(
    step_id: StepId,
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get step metrics by step ID.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.step_manager.get_step_metrics_async(step_id=step_id, actor=actor)


@router.get("/{step_id}/trace", response_model=Optional[ProviderTrace], operation_id="retrieve_trace_for_step")
async def retrieve_trace_for_step(
    step_id: StepId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    provider_trace = None
    if settings.track_provider_trace:
        try:
            provider_trace = await server.telemetry_manager.get_provider_trace_by_step_id_async(
                step_id=step_id, actor=await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
            )
        except:
            pass

    return provider_trace


class ModifyFeedbackRequest(BaseModel):
    feedback: FeedbackType | None = Field(None, description="Whether this feedback is positive or negative")
    tags: list[str] | None = Field(None, description="Feedback tags to add to the step")


@router.patch("/{step_id}/feedback", response_model=Step, operation_id="modify_feedback_for_step")
async def modify_feedback_for_step(
    step_id: StepId,
    request: ModifyFeedbackRequest = Body(...),
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Modify feedback for a given step.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await server.step_manager.add_feedback_async(step_id=step_id, feedback=request.feedback, tags=request.tags, actor=actor)


@router.get("/{step_id}/messages", response_model=List[LettaMessageUnion], operation_id="list_messages_for_step")
async def list_messages_for_step(
    step_id: StepId,
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
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
    order_by: Literal["created_at"] = Query("created_at", description="Sort by field"),
):
    """
    List messages for a given step.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    messages = await server.step_manager.list_step_messages_async(
        step_id=step_id, actor=actor, before=before, after=after, limit=limit, ascending=(order == "asc")
    )
    return Message.to_letta_messages_from_list(messages)


@router.patch("/{step_id}/transaction/{transaction_id}", response_model=Step, operation_id="update_step_transaction_id")
async def update_step_transaction_id(
    transaction_id: str,
    step_id: StepId,
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Update the transaction ID for a step.
    """
    actor = server.user_manager.get_user_or_default(user_id=headers.actor_id)
    return await server.step_manager.update_step_transaction_id(actor=actor, step_id=step_id, transaction_id=transaction_id)
