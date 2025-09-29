from datetime import datetime
from pickletools import pyunicode
from typing import List, Literal, Optional

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.message import Message as MessageModel
from letta.orm.run import Run as RunModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step as StepModel
from letta.otel.tracing import log_event, trace_method
from letta.schemas.enums import MessageRole, RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import LettaMessage, LettaMessageUnion
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.schemas.step import Step as PydanticStep
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.helpers.agent_manager_helper import validate_agent_exists_async
from letta.services.message_manager import MessageManager
from letta.services.step_manager import StepManager
from letta.utils import enforce_types

logger = get_logger(__name__)


class RunManager:
    """Manager class to handle business logic related to Runs."""

    def __init__(self):
        """Initialize the RunManager."""
        self.step_manager = StepManager()
        self.message_manager = MessageManager()

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
            run = await run.create_async(session, actor=actor, no_commit=True, no_refresh=True)
            await session.commit()

        return run.to_pydantic()

    @enforce_types
    async def get_run_by_id(self, run_id: str, actor: PydanticUser) -> PydanticRun:
        """Get a run by its ID."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")
            return run.to_pydantic()

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
    ) -> List[PydanticRun]:
        """List runs with filtering options."""
        async with db_registry.async_session() as session:
            from sqlalchemy import select

            query = select(RunModel).filter(RunModel.organization_id == actor.organization_id)

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

            # Apply pagination
            from letta.services.helpers.run_manager_helper import _apply_pagination_async

            query = await _apply_pagination_async(query, before, after, session, ascending=ascending)

            # Apply limit
            if limit:
                query = query.limit(limit)

            result = await session.execute(query)
            runs = result.scalars().all()
            return [run.to_pydantic() for run in runs]

    @enforce_types
    async def delete_run(self, run_id: str, actor: PydanticUser) -> PydanticRun:
        """Delete a run by its ID."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")

            pydantic_run = run.to_pydantic()
            await run.hard_delete_async(db_session=session, actor=actor)

        return pydantic_run

    @enforce_types
    async def update_run_by_id_async(
        self,
        run_id: str,
        update: RunUpdate,
        actor: PydanticUser,
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

        # Dispatch callback outside of database session if needed
        if needs_callback:
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
            error_message = f"Failed to dispatch callback for run {callback_info['run_id']} to {callback_info['callback_url']}: {e!s}"
            logger.error(error_message)
            result["callback_error"] = error_message
            # Continue silently - callback failures should not affect run completion
        finally:
            return result

    @enforce_types
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
        request_config = await self.get_run_request_config(run_id=run_id, actor=actor)

        messages = await self.message_manager.list_messages(
            actor=actor,
            run_id=run_id,
            limit=limit,
            before=before,
            after=after,
            ascending=(order == "asc"),
        )
        letta_messages = PydanticMessage.to_letta_messages_from_list(messages, reverse=(order != "asc"))

        if request_config and request_config.include_return_message_types:
            include_return_message_types_set = set(request_config.include_return_message_types)
            letta_messages = [msg for msg in letta_messages if msg.message_type in include_return_message_types_set]

        return letta_messages

    @enforce_types
    async def get_run_request_config(self, run_id: str, actor: PydanticUser) -> Optional[LettaRequestConfig]:
        """Get the letta request config from a run."""
        async with db_registry.async_session() as session:
            run = await RunModel.read_async(db_session=session, identifier=run_id, actor=actor, access_type=AccessType.ORGANIZATION)
            if not run:
                raise NoResultFound(f"Run with id {run_id} not found")
            pydantic_run = run.to_pydantic()
            return pydantic_run.request_config
