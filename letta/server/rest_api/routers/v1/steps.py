from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from letta.orm.errors import NoResultFound
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.step import Step
from letta.schemas.step_metrics import StepMetrics
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.step_manager import FeedbackType
from letta.settings import settings

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
    actor_id: Optional[str] = Header(None, alias="user_id"),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="Filter by project slug to associate with the group (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    List steps with optional pagination and date filters.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

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
    step_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get a step by ID.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.step_manager.get_step_async(step_id=step_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step not found")


@router.get("/{step_id}/metrics", response_model=StepMetrics, operation_id="retrieve_step_metrics")
async def retrieve_step_metrics(
    step_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get step metrics by step ID.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.step_manager.get_step_metrics_async(step_id=step_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step metrics not found")


@router.get("/{step_id}/trace", response_model=Optional[ProviderTrace], operation_id="retrieve_step_trace")
async def retrieve_step_trace(
    step_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str | None = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    provider_trace = None
    if settings.track_provider_trace:
        try:
            provider_trace = await server.telemetry_manager.get_provider_trace_by_step_id_async(
                step_id=step_id, actor=await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
            )
        except:
            pass

    return provider_trace


class AddFeedbackRequest(BaseModel):
    feedback: FeedbackType | None = Field(None, description="Whether this feedback is positive or negative")
    tags: list[str] | None = Field(None, description="Feedback tags to add to the step")


@router.patch("/{step_id}/feedback", response_model=Step, operation_id="add_feedback")
async def add_feedback(
    step_id: str,
    request: AddFeedbackRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Add feedback to a step.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.step_manager.add_feedback_async(step_id=step_id, feedback=request.feedback, tags=request.tags, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step not found")


@router.patch("/{step_id}/transaction/{transaction_id}", response_model=Step, operation_id="update_step_transaction_id")
async def update_step_transaction_id(
    step_id: str,
    transaction_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Update the transaction ID for a step.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        return await server.step_manager.update_step_transaction_id(actor=actor, step_id=step_id, transaction_id=transaction_id)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step not found")
