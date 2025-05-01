from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from letta.orm.errors import NoResultFound
from letta.schemas.step import Step
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("/", response_model=List[Step], operation_id="list_steps")
def list_steps(
    before: Optional[str] = Query(None, description="Return steps before this step ID"),
    after: Optional[str] = Query(None, description="Return steps after this step ID"),
    limit: Optional[int] = Query(50, description="Maximum number of steps to return"),
    order: Optional[str] = Query("desc", description="Sort order (asc or desc)"),
    start_date: Optional[str] = Query(None, description='Return steps after this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")'),
    end_date: Optional[str] = Query(None, description='Return steps before this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")'),
    model: Optional[str] = Query(None, description="Filter by the name of the model used for the step"),
    agent_id: Optional[str] = Query(None, description="Filter by the ID of the agent that performed the step"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    List steps with optional pagination and date filters.
    Dates should be provided in ISO 8601 format (e.g. 2025-01-29T15:01:19-08:00)
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    # Convert ISO strings to datetime objects if provided
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None

    return server.step_manager.list_steps(
        actor=actor,
        before=before,
        after=after,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
        order=order,
        model=model,
        agent_id=agent_id,
    )


@router.get("/{step_id}", response_model=Step, operation_id="retrieve_step")
def retrieve_step(
    step_id: str,
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Get a step by ID.
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.step_manager.get_step(step_id=step_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step not found")


@router.patch("/{step_id}/transaction/{transaction_id}", response_model=Step, operation_id="update_step_transaction_id")
def update_step_transaction_id(
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
        return server.step_manager.update_step_transaction_id(actor=actor, step_id=step_id, transaction_id=transaction_id)
    except NoResultFound:
        raise HTTPException(status_code=404, detail="Step not found")
