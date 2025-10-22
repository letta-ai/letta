from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query

from letta.schemas.enums import ComparisonOperator, RunStatus
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.run import Run
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.server import SyncServer
from letta.services.run_manager import RunManager

router = APIRouter(prefix="/_internal_runs", tags=["_internal_runs"])


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


@router.get("/", response_model=List[Run], operation_id="list_internal_runs")
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
    template_family: Optional[str] = Query(None, description="Filter runs by template family (base_template_id)."),
    step_count: Optional[int] = Query(None, description="Filter runs by step count. Must be provided with step_count_operator."),
    step_count_operator: ComparisonOperator = Query(
        ComparisonOperator.EQ,
        description="Operator for step_count filter: 'eq' for equals, 'gte' for greater than or equal, 'lte' for less than or equal.",
    ),
    tools_used: Optional[List[str]] = Query(None, description="Filter runs that used any of the specified tools."),
    before: Optional[str] = Query(
        None, description="Run ID cursor for pagination. Returns runs that come before this run ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Run ID cursor for pagination. Returns runs that come after this run ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of runs to return"),
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
    runs_manager = server.run_manager

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
        template_family=template_family,
        step_count=step_count,
        step_count_operator=step_count_operator,
        tools_used=tools_used,
    )
    return runs
