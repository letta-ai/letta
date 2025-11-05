from datetime import datetime
from pickletools import pyunicode
from typing import List, Literal, Optional

from httpx import AsyncClient

from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.orm.agent import Agent as AgentModel
from letta.orm.errors import NoResultFound
from letta.orm.message import Message as MessageModel
from letta.orm.run import Run as RunModel
from letta.orm.run_metrics import RunMetrics as RunMetricsModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step as StepModel
from letta.otel.tracing import log_event, trace_method
from letta.schemas.enums import AgentType, ComparisonOperator, MessageRole, PrimitiveType, RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import LettaMessage, LettaMessageUnion
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.schemas.run_metrics import RunMetrics as PydanticRunMetrics
from letta.schemas.step import Step as PydanticStep
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.agent_manager import AgentManager
from letta.services.helpers.agent_manager_helper import validate_agent_exists_async
from letta.services.message_manager import MessageManager
from letta.services.step_manager import StepManager
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id

logger = get_logger(__name__)


class RunManager:
    """Manager class to handle business logic related to Runs."""

    def __init__(self):
        """Initialize the RunManager."""
        self.step_manager = StepManager()
        self.message_manager = MessageManager()
        self.agent_manager = AgentManager()

    @enforce_types
    async def create_run(self, pydantic_run: PydanticRun, actor: PydanticUser) -> PydanticRun:
        """Create a new run."""
        async with db_registry.async_session() as session:
            # Get agent_id from the pydantic object
            agent_id = pydantic_run.agent_id

            # Verify agent exists before creating the run
            await validate_agent_exists_async(session, agent_id, actor)
            organization_id = actor.organization_id

            run_data = pydantic_run.model_dump(exclude_none=True)
            # Handle metadata field mapping (Pydantic uses 'metadata', ORM uses 'metadata_')
            if "metadata" in run_data:
                run_data["metadata_"] = run_data.pop("metadata")

            run = RunModel(**run_data)
            run.organization_id = organization_id

            # Get the project_id from the agent
            agent = await session.get(AgentModel, agent_id)
            project_id = agent.project_id if agent else None
            run.project_id = project_id

            run = await run.create_async(session, actor=actor, no_commit=True, no_refresh=True)

            # Create run metrics with start timestamp
            import time

            metrics = RunMetricsModel(
                id=run.id,
                organization_id=organization_id,
                agent_id=agent_id,
                project_id=project_id,
                run_start_ns=int(time.time() * 1e9),  # Current time in nanoseconds
                num_steps=0,  # Initialize to 0
            )
            await metrics.create_async(session)
            await session.commit()

        return run.to_pydantic()

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_by_id(self, run_id: str, actor: PydanticUser) -> PydanticRun:
        """Get a run by its ID."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")
            return run.to_pydantic()

    @enforce_types
    async def get_run_with_status(self, run_id: str, actor: PydanticUser) -> PydanticRun:
        """Get a run by its ID and update status from Lettuce if applicable."""
        run = await self.get_run_by_id(run_id=run_id, actor=actor)

        use_lettuce = run.metadata and run.metadata.get("lettuce")
        if use_lettuce and run.status not in [RunStatus.completed, RunStatus.failed, RunStatus.cancelled]:
            try:
                from letta.services.lettuce import LettuceClient

                lettuce_client = await LettuceClient.create()
                status = await lettuce_client.get_status(run_id=run_id)

                # Map the status to our enum
                if status == "RUNNING":
                    run.status = RunStatus.running
                elif status == "COMPLETED":
                    run.status = RunStatus.completed
                elif status == "FAILED":
                    run.status = RunStatus.failed
                elif status == "CANCELLED":
                    run.status = RunStatus.cancelled
            except Exception as e:
                logger.error(f"Failed to get status from Lettuce for run {run_id}: {str(e)}")
                # Return run with current status from DB if Lettuce fails

        return run

    @enforce_types
    async def list_runs(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        agent_ids: Optional[List[str]] = None,
        statuses: Optional[List[RunStatus]] = None,
        limit: Optional[int] = 50,
        before: Optional[str] = None,
        after: Optional[str] = None,
        ascending: bool = False,
        stop_reason: Optional[str] = None,
        background: Optional[bool] = None,
        template_family: Optional[str] = None,
        step_count: Optional[int] = None,
        step_count_operator: ComparisonOperator = ComparisonOperator.EQ,
        tools_used: Optional[List[str]] = None,
        project_id: Optional[str] = None,
        order_by: Literal["created_at", "duration"] = "created_at",
        duration_percentile: Optional[int] = None,
        duration_filter: Optional[dict] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[PydanticRun]:
        """List runs with filtering options."""
        async with db_registry.async_session() as session:
            from sqlalchemy import func, or_, select

            # Always join with run_metrics to get duration data
            query = (
                select(RunModel, RunMetricsModel.run_ns)
                .outerjoin(RunMetricsModel, RunModel.id == RunMetricsModel.id)
                .filter(RunModel.organization_id == actor.organization_id)
            )

            # Filter by project_id if provided
            if project_id:
                query = query.filter(RunModel.project_id == project_id)

            # Handle agent filtering
            if agent_id:
                agent_ids = [agent_id]
            if agent_ids:
                query = query.filter(RunModel.agent_id.in_(agent_ids))

            # Filter by status
            if statuses:
                query = query.filter(RunModel.status.in_(statuses))

            # Filter by stop reason
            if stop_reason:
                query = query.filter(RunModel.stop_reason == stop_reason)

            # Filter by background
            if background is not None:
                query = query.filter(RunModel.background == background)

            # Filter by template_family (base_template_id)
            if template_family:
                query = query.filter(RunModel.base_template_id == template_family)

            # Filter by date range
            if start_date:
                query = query.filter(RunModel.created_at >= start_date)
            if end_date:
                query = query.filter(RunModel.created_at <= end_date)

            # Filter by step_count with the specified operator
            if step_count is not None:
                if step_count_operator == ComparisonOperator.EQ:
                    query = query.filter(RunMetricsModel.num_steps == step_count)
                elif step_count_operator == ComparisonOperator.GTE:
                    query = query.filter(RunMetricsModel.num_steps >= step_count)
                elif step_count_operator == ComparisonOperator.LTE:
                    query = query.filter(RunMetricsModel.num_steps <= step_count)

            # Filter by tools used ids
            if tools_used:
                from sqlalchemy import String, cast as sa_cast, type_coerce
                from sqlalchemy.dialects.postgresql import ARRAY, JSONB

                # Use ?| operator to check if any tool_id exists in the array (OR logic)
                jsonb_tools = sa_cast(RunMetricsModel.tools_used, JSONB)
                tools_array = type_coerce(tools_used, ARRAY(String))
                query = query.filter(jsonb_tools.op("?|")(tools_array))

            # Ensure run_ns is not null when working with duration
            if order_by == "duration" or duration_percentile is not None or duration_filter is not None:
                query = query.filter(RunMetricsModel.run_ns.isnot(None))

            # Apply duration filter if requested
            if duration_filter is not None:
                duration_value = duration_filter.get("value") if isinstance(duration_filter, dict) else duration_filter.value
                duration_operator = duration_filter.get("operator") if isinstance(duration_filter, dict) else duration_filter.operator

                if duration_operator == "gt":
                    query = query.filter(RunMetricsModel.run_ns > duration_value)
                elif duration_operator == "lt":
                    query = query.filter(RunMetricsModel.run_ns < duration_value)
                elif duration_operator == "eq":
                    query = query.filter(RunMetricsModel.run_ns == duration_value)

            # Apply duration percentile filter if requested
            if duration_percentile is not None:
                # Calculate the percentile threshold
                percentile_query = (
                    select(func.percentile_cont(duration_percentile / 100.0).within_group(RunMetricsModel.run_ns))
                    .select_from(RunMetricsModel)
                    .join(RunModel, RunModel.id == RunMetricsModel.id)
                    .filter(RunModel.organization_id == actor.organization_id)
                    .filter(RunMetricsModel.run_ns.isnot(None))
                )

                # Apply same filters to percentile calculation
                if project_id:
                    percentile_query = percentile_query.filter(RunModel.project_id == project_id)
                if agent_ids:
                    percentile_query = percentile_query.filter(RunModel.agent_id.in_(agent_ids))
                if statuses:
                    percentile_query = percentile_query.filter(RunModel.status.in_(statuses))

                # Execute percentile query
                percentile_result = await session.execute(percentile_query)
                percentile_threshold = percentile_result.scalar()

                # Filter by percentile threshold (runs slower than the percentile)
                if percentile_threshold is not None:
                    query = query.filter(RunMetricsModel.run_ns >= percentile_threshold)

            # Apply sorting based on order_by
            if order_by == "duration":
                # Sort by duration
                if ascending:
                    query = query.order_by(RunMetricsModel.run_ns.asc())
                else:
                    query = query.order_by(RunMetricsModel.run_ns.desc())
            else:
                # Apply pagination for created_at ordering
                from letta.services.helpers.run_manager_helper import _apply_pagination_async

                query = await _apply_pagination_async(query, before, after, session, ascending=ascending)

            # Apply limit
            if limit:
                query = query.limit(limit)

            result = await session.execute(query)
            rows = result.all()

            # Populate total_duration_ns from run_metrics.run_ns
            pydantic_runs = []
            for row in rows:
                run_model = row[0]
                run_ns = row[1]

                pydantic_run = run_model.to_pydantic()
                if run_ns is not None:
                    pydantic_run.total_duration_ns = run_ns

                pydantic_runs.append(pydantic_run)

            return pydantic_runs

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def delete_run(self, run_id: str, actor: PydanticUser) -> None:
        """Delete a run by its ID."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")

            await run.hard_delete_async(db_session=session, actor=actor)

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def update_run_by_id_async(
        self, run_id: str, update: RunUpdate, actor: PydanticUser, refresh_result_messages: bool = True
    ) -> PydanticRun:
        """Update a run using a RunUpdate object."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor)

            # Check if this is a terminal update and whether we should dispatch a callback
            needs_callback = False
            callback_url = None
            not_completed_before = not bool(run.completed_at)
            is_terminal_update = update.status in {RunStatus.completed, RunStatus.failed}
            if is_terminal_update and not_completed_before and run.callback_url:
                needs_callback = True
                callback_url = run.callback_url

            # Housekeeping only when the run is actually completing
            if not_completed_before and is_terminal_update:
                if not update.stop_reason:
                    logger.warning(f"Run {run_id} completed without a stop reason")
                if not update.completed_at:
                    logger.warning(f"Run {run_id} completed without a completed_at timestamp")
                    update.completed_at = get_utc_time().replace(tzinfo=None)

            # Update job attributes with only the fields that were explicitly set
            update_data = update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            # Automatically update the completion timestamp if status is set to 'completed'
            for key, value in update_data.items():
                # Ensure completed_at is timezone-naive for database compatibility
                if key == "completed_at" and value is not None and hasattr(value, "replace"):
                    value = value.replace(tzinfo=None)
                setattr(run, key, value)

            await run.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
            final_metadata = run.metadata_
            pydantic_run = run.to_pydantic()

            await session.commit()

        # Update agent's last_stop_reason when run completes
        # Do this after run update is committed to database
        if is_terminal_update and update.stop_reason:
            try:
                from letta.schemas.agent import UpdateAgent

                await self.agent_manager.update_agent_async(
                    agent_id=pydantic_run.agent_id,
                    agent_update=UpdateAgent(last_stop_reason=update.stop_reason),
                    actor=actor,
                )
            except Exception as e:
                logger.error(f"Failed to update agent's last_stop_reason for run {run_id}: {e}")

        # update run metrics table
        num_steps = len(await self.step_manager.list_steps_async(run_id=run_id, actor=actor))

        # Collect tools used from run messages
        tools_used = set()
        messages = await self.message_manager.list_messages(actor=actor, run_id=run_id)
        for message in messages:
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    if hasattr(tool_call, "function") and hasattr(tool_call.function, "name"):
                        # Get tool ID from tool name
                        from letta.services.tool_manager import ToolManager

                        tool_manager = ToolManager()
                        tool_name = tool_call.function.name
                        tool_id = await tool_manager.get_tool_id_by_name_async(tool_name, actor)
                        if tool_id:
                            tools_used.add(tool_id)

        async with db_registry.async_session() as session:
            metrics = await RunMetricsModel.read_async(db_session=session, identifier=run_id, actor=actor)
            # Calculate runtime if run is completing
            if is_terminal_update:
                # Use total_duration_ns from RunUpdate if provided
                # Otherwise fall back to system time
                if update.total_duration_ns is not None:
                    metrics.run_ns = update.total_duration_ns
                elif metrics.run_start_ns:
                    import time

                    current_ns = int(time.time() * 1e9)
                    metrics.run_ns = current_ns - metrics.run_start_ns
            metrics.num_steps = num_steps
            metrics.tools_used = list(tools_used) if tools_used else None
            await metrics.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
            await session.commit()

        # Dispatch callback outside of database session if needed
        if needs_callback:
            if refresh_result_messages:
                result = LettaResponse(
                    messages=await self.get_run_messages(run_id=run_id, actor=actor),
                    stop_reason=LettaStopReason(stop_reason=pydantic_run.stop_reason),
                    usage=await self.get_run_usage(run_id=run_id, actor=actor),
                )
                final_metadata["result"] = result.model_dump()
            callback_info = {
                "run_id": run_id,
                "callback_url": callback_url,
                "status": update.status,
                "completed_at": get_utc_time().replace(tzinfo=None),
                "metadata": final_metadata,
            }
            callback_result = await self._dispatch_callback_async(callback_info)

            # Update callback status in a separate transaction
            async with db_registry.async_session() as session:
                run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor)
                run.callback_sent_at = callback_result["callback_sent_at"]
                run.callback_status_code = callback_result.get("callback_status_code")
                run.callback_error = callback_result.get("callback_error")
                pydantic_run = run.to_pydantic()
                await run.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
                await session.commit()

        return pydantic_run

    @trace_method
    async def _dispatch_callback_async(self, callback_info: dict) -> dict:
        """
        POST a standard JSON payload to callback_url and return callback status asynchronously.
        """
        payload = {
            "run_id": callback_info["run_id"],
            "status": callback_info["status"],
            "completed_at": callback_info["completed_at"].isoformat() if callback_info["completed_at"] else None,
            "metadata": callback_info["metadata"],
        }

        callback_sent_at = get_utc_time().replace(tzinfo=None)
        result = {"callback_sent_at": callback_sent_at}

        try:
            async with AsyncClient() as client:
                log_event("POST callback dispatched", payload)
                resp = await client.post(callback_info["callback_url"], json=payload, timeout=5.0)
                log_event("POST callback finished")
                result["callback_status_code"] = resp.status_code
        except Exception as e:
            error_message = f"Failed to dispatch callback for run {callback_info['run_id']} to {callback_info['callback_url']}: {e!r}"
            logger.error(error_message)
            result["callback_error"] = error_message
            # Continue silently - callback failures should not affect run completion

        return result

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_usage(self, run_id: str, actor: PydanticUser) -> LettaUsageStatistics:
        """Get usage statistics for a run."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")

        steps = await self.step_manager.list_steps_async(run_id=run_id, actor=actor)
        total_usage = LettaUsageStatistics()
        for step in steps:
            total_usage.prompt_tokens += step.prompt_tokens
            total_usage.completion_tokens += step.completion_tokens
            total_usage.total_tokens += step.total_tokens
            total_usage.step_count += 1
        return total_usage

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_messages(
        self,
        run_id: str,
        actor: PydanticUser,
        limit: Optional[int] = 100,
        before: Optional[str] = None,
        after: Optional[str] = None,
        order: Literal["asc", "desc"] = "asc",
    ) -> List[LettaMessage]:
        """Get the result of a run."""
        run = await self.get_run_by_id(run_id=run_id, actor=actor)
        request_config = run.request_config
        agent = await self.agent_manager.get_agent_by_id_async(agent_id=run.agent_id, actor=actor, include_relationships=[])
        text_is_assistant_message = agent.agent_type == AgentType.letta_v1_agent

        messages = await self.message_manager.list_messages(
            actor=actor,
            run_id=run_id,
            limit=limit,
            before=before,
            after=after,
            ascending=(order == "asc"),
        )
        letta_messages = PydanticMessage.to_letta_messages_from_list(
            messages, reverse=(order != "asc"), text_is_assistant_message=text_is_assistant_message
        )

        if request_config and request_config.include_return_message_types:
            include_return_message_types_set = set(request_config.include_return_message_types)
            letta_messages = [msg for msg in letta_messages if msg.message_type in include_return_message_types_set]

        return letta_messages

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_request_config(self, run_id: str, actor: PydanticUser) -> Optional[LettaRequestConfig]:
        """Get the letta request config from a run."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")
            pydantic_run = run.to_pydantic()
            return pydantic_run.request_config

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_metrics_async(self, run_id: str, actor: PydanticUser) -> PydanticRunMetrics:
        """Get metrics for a run."""
        async with db_registry.async_session() as session:
            metrics = await RunMetricsModel.read_async(db_session=session, identifier=run_id, actor=actor)
            return metrics.to_pydantic()

    @enforce_types
    @raise_on_invalid_id(param_name="run_id", expected_prefix=PrimitiveType.RUN)
    async def get_run_steps(
        self,
        run_id: str,
        actor: PydanticUser,
        limit: Optional[int] = 100,
        before: Optional[str] = None,
        after: Optional[str] = None,
        ascending: bool = False,
    ) -> List[PydanticStep]:
        """Get steps for a run."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")

        steps = await self.step_manager.list_steps_async(
            actor=actor, run_id=run_id, limit=limit, before=before, after=after, order="asc" if ascending else "desc"
        )
        return steps
