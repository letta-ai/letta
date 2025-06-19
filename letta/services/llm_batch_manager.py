import datetime
from typing import Any, Dict, List, Optional, Tuple

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse
from sqlalchemy import desc, func, select, tuple_

from letta.jobs.types import BatchPollingResult, ItemUpdateInfo, RequestStatusUpdateInfo, StepStatusUpdateInfo
from letta.log import get_logger
from letta.orm import Message as MessageModel
from letta.orm.llm_batch_items import LLMBatchItem
from letta.orm.llm_batch_job import LLMBatchJob
from letta.otel.tracing import trace_method
from letta.schemas.enums import AgentStepStatus, JobStatus, ProviderType
from letta.schemas.llm_batch_job import AgentStepState
from letta.schemas.llm_batch_job import LLMBatchItem as PydanticLLMBatchItem
from letta.schemas.llm_batch_job import LLMBatchJob as PydanticLLMBatchJob
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types

logger = get_logger(__name__)


class LLMBatchManager:
    """Manager for handling both LLMBatchJob and LLMBatchItem operations."""

    @enforce_types
    @trace_method
    async def create_llm_batch_job_async(
        self,
        llm_provider: ProviderType,
        create_batch_response: BetaMessageBatch,
        actor: PydanticUser,
        letta_batch_job_id: str,
        status: JobStatus = JobStatus.created,
    ) -> PydanticLLMBatchJob:
        """Create a new LLM batch job."""
        async with db_registry.async_session() as session:
            batch = LLMBatchJob(
                status=status,
                llm_provider=llm_provider,
                create_batch_response=create_batch_response,
                organization_id=actor.organization_id,
                letta_batch_job_id=letta_batch_job_id,
            )
            await batch.create_async(session, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    @trace_method
    async def get_llm_batch_job_by_id_async(self, llm_batch_id: str, actor: Optional[PydanticUser] = None) -> PydanticLLMBatchJob:
        """Retrieve a single batch job by ID."""
        async with db_registry.async_session() as session:
            batch = await LLMBatchJob.read_async(db_session=session, identifier=llm_batch_id, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    @trace_method
    async def update_llm_batch_status_async(
        self,
        llm_batch_id: str,
        status: JobStatus,
        actor: Optional[PydanticUser] = None,
        latest_polling_response: Optional[BetaMessageBatch] = None,
    ) -> PydanticLLMBatchJob:
        """Update a batch job’s status and optionally its polling response."""
        async with db_registry.async_session() as session:
            batch = await LLMBatchJob.read_async(db_session=session, identifier=llm_batch_id, actor=actor)
            batch.status = status
            batch.latest_polling_response = latest_polling_response
            batch.last_polled_at = datetime.datetime.now(datetime.timezone.utc)
            batch = await batch.update_async(db_session=session, actor=actor)
            return batch.to_pydantic()

    async def bulk_update_llm_batch_statuses_async(
        self,
        updates: List[BatchPollingResult],
    ) -> None:
        """
        Efficiently update many LLMBatchJob rows. This is used by the cron jobs.

        `updates` = [(llm_batch_id, new_status, polling_response_or_None), …]
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        async with db_registry.async_session() as session:
            mappings = []
            for llm_batch_id, status, response in updates:
                mappings.append(
                    {
                        "id": llm_batch_id,
                        "status": status,
                        "latest_polling_response": response,
                        "last_polled_at": now,
                    }
                )

            await session.run_sync(lambda ses: ses.bulk_update_mappings(LLMBatchJob, mappings))
            await session.commit()

    @enforce_types
    @trace_method
    async def list_llm_batch_jobs_async(
        self,
        letta_batch_id: str,
        limit: Optional[int] = None,
        actor: Optional[PydanticUser] = None,
        after: Optional[str] = None,
    ) -> List[PydanticLLMBatchJob]:
        """
        List all batch items for a given llm_batch_id, optionally filtered by additional criteria and limited in count.

        Optional filters:
            - after: A cursor string. Only items with an `id` greater than this value are returned.
            - agent_id: Restrict the result set to a specific agent.
            - request_status: Filter items based on their request status (e.g., created, completed, expired).
            - step_status: Filter items based on their step execution status.

        The results are ordered by their id in ascending order.
        """
        async with db_registry.async_session() as session:
            query = select(LLMBatchJob).where(LLMBatchJob.letta_batch_job_id == letta_batch_id)

            if actor is not None:
                query = query.where(LLMBatchJob.organization_id == actor.organization_id)

            # Additional optional filters
            if after is not None:
                query = query.where(LLMBatchJob.id > after)

            query = query.order_by(LLMBatchJob.id.asc())

            if limit is not None:
                query = query.limit(limit)

            results = await session.execute(query)
            return [item.to_pydantic() for item in results.scalars().all()]

    @enforce_types
    @trace_method
    async def delete_llm_batch_request_async(self, llm_batch_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch job by ID."""
        async with db_registry.async_session() as session:
            batch = await LLMBatchJob.read_async(db_session=session, identifier=llm_batch_id, actor=actor)
            await batch.hard_delete_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    async def get_messages_for_letta_batch_async(
        self,
        letta_batch_job_id: str,
        limit: int = 100,
        actor: Optional[PydanticUser] = None,
        agent_id: Optional[str] = None,
        sort_descending: bool = True,
        cursor: Optional[str] = None,  # Message ID as cursor
    ) -> List[PydanticMessage]:
        """
        Retrieve messages across all LLM batch jobs associated with a Letta batch job.
        Optimized for PostgreSQL performance using ID-based keyset pagination.
        """
        async with db_registry.async_session() as session:
            # If cursor is provided, get sequence_id for that message
            cursor_sequence_id = None
            if cursor:
                cursor_query = select(MessageModel.sequence_id).where(MessageModel.id == cursor).limit(1)
                cursor_result = await session.execute(cursor_query)
                if cursor_result:
                    cursor_sequence_id = cursor_result[0]
                else:
                    # If cursor message doesn't exist, ignore it
                    pass

            query = (
                select(MessageModel)
                .join(LLMBatchItem, MessageModel.batch_item_id == LLMBatchItem.id)
                .join(LLMBatchJob, LLMBatchItem.llm_batch_id == LLMBatchJob.id)
                .where(LLMBatchJob.letta_batch_job_id == letta_batch_job_id)
            )

            if actor is not None:
                query = query.where(MessageModel.organization_id == actor.organization_id)

            if agent_id is not None:
                query = query.where(MessageModel.agent_id == agent_id)

            # Apply cursor-based pagination if cursor exists
            if cursor_sequence_id is not None:
                if sort_descending:
                    query = query.where(MessageModel.sequence_id < cursor_sequence_id)
                else:
                    query = query.where(MessageModel.sequence_id > cursor_sequence_id)

            if sort_descending:
                query = query.order_by(desc(MessageModel.sequence_id))
            else:
                query = query.order_by(MessageModel.sequence_id)

            query = query.limit(limit)

            results = await session.execute(query)
            return [message.to_pydantic() for message in results.scalars().all()]

    @enforce_types
    @trace_method
    async def list_running_llm_batches_async(
        self, actor: Optional[PydanticUser] = None, weeks: Optional[int] = None, batch_size: Optional[int] = None
    ) -> List[PydanticLLMBatchJob]:
        """Return all running LLM batch jobs, optionally filtered by actor's organization and recent weeks."""
        async with db_registry.async_session() as session:
            query = select(LLMBatchJob).where(LLMBatchJob.status == JobStatus.running)

            if actor is not None:
                query = query.where(LLMBatchJob.organization_id == actor.organization_id)

            if weeks is not None:
                cutoff_datetime = datetime.datetime.utcnow() - datetime.timedelta(weeks=weeks)
                query = query.where(LLMBatchJob.created_at >= cutoff_datetime)

            if batch_size is not None:
                query = query.limit(batch_size)

            results = await session.execute(query)
            return [batch.to_pydantic() for batch in results.scalars().all()]

    @enforce_types
    @trace_method
    async def create_llm_batch_item_async(
        self,
        llm_batch_id: str,
        agent_id: str,
        llm_config: LLMConfig,
        actor: PydanticUser,
        request_status: JobStatus = JobStatus.created,
        step_status: AgentStepStatus = AgentStepStatus.paused,
        step_state: Optional[AgentStepState] = None,
    ) -> PydanticLLMBatchItem:
        """Create a new batch item."""
        async with db_registry.async_session() as session:
            item = LLMBatchItem(
                llm_batch_id=llm_batch_id,
                agent_id=agent_id,
                llm_config=llm_config,
                request_status=request_status,
                step_status=step_status,
                step_state=step_state,
                organization_id=actor.organization_id,
            )
            await item.create_async(session, actor=actor)
            return item.to_pydantic()

    @enforce_types
    @trace_method
    async def create_llm_batch_items_bulk_async(
        self, llm_batch_items: List[PydanticLLMBatchItem], actor: PydanticUser
    ) -> List[PydanticLLMBatchItem]:
        """
        Create multiple batch items in bulk for better performance.

        Args:
            llm_batch_items: List of batch items to create
            actor: User performing the action

        Returns:
            List of created batch items as Pydantic models
        """
        async with db_registry.async_session() as session:
            # Convert Pydantic models to ORM objects
            orm_items = []
            for item in llm_batch_items:
                orm_item = LLMBatchItem(
                    id=item.id,
                    llm_batch_id=item.llm_batch_id,
                    agent_id=item.agent_id,
                    llm_config=item.llm_config,
                    request_status=item.request_status,
                    step_status=item.step_status,
                    step_state=item.step_state,
                    organization_id=actor.organization_id,
                )
                orm_items.append(orm_item)

            created_items = await LLMBatchItem.batch_create_async(orm_items, session, actor=actor)

            # Convert back to Pydantic models
            return [item.to_pydantic() for item in created_items]

    @enforce_types
    @trace_method
    async def get_llm_batch_item_by_id_async(self, item_id: str, actor: PydanticUser) -> PydanticLLMBatchItem:
        """Retrieve a single batch item by ID."""
        async with db_registry.async_session() as session:
            item = await LLMBatchItem.read_async(db_session=session, identifier=item_id, actor=actor)
            return item.to_pydantic()

    @enforce_types
    @trace_method
    async def update_llm_batch_item_async(
        self,
        item_id: str,
        actor: PydanticUser,
        request_status: Optional[JobStatus] = None,
        step_status: Optional[AgentStepStatus] = None,
        llm_request_response: Optional[BetaMessageBatchIndividualResponse] = None,
        step_state: Optional[AgentStepState] = None,
    ) -> PydanticLLMBatchItem:
        """Update fields on a batch item."""
        async with db_registry.async_session() as session:
            item = await LLMBatchItem.read_async(db_session=session, identifier=item_id, actor=actor)

            if request_status:
                item.request_status = request_status
            if step_status:
                item.step_status = step_status
            if llm_request_response:
                item.batch_request_result = llm_request_response
            if step_state:
                item.step_state = step_state

            result = await item.update_async(db_session=session, actor=actor)
            return result.to_pydantic()

    @enforce_types
    @trace_method
    async def list_llm_batch_items_async(
        self,
        llm_batch_id: str,
        limit: Optional[int] = None,
        actor: Optional[PydanticUser] = None,
        after: Optional[str] = None,
        agent_id: Optional[str] = None,
        request_status: Optional[JobStatus] = None,
        step_status: Optional[AgentStepStatus] = None,
    ) -> List[PydanticLLMBatchItem]:
        """
        List all batch items for a given llm_batch_id, optionally filtered by additional criteria and limited in count.

        Optional filters:
            - after: A cursor string. Only items with an `id` greater than this value are returned.
            - agent_id: Restrict the result set to a specific agent.
            - request_status: Filter items based on their request status (e.g., created, completed, expired).
            - step_status: Filter items based on their step execution status.

        The results are ordered by their id in ascending order.
        """
        async with db_registry.async_session() as session:
            query = select(LLMBatchItem).where(LLMBatchItem.llm_batch_id == llm_batch_id)

            if actor is not None:
                query = query.where(LLMBatchItem.organization_id == actor.organization_id)

            # Additional optional filters
            if agent_id is not None:
                query = query.where(LLMBatchItem.agent_id == agent_id)
            if request_status is not None:
                query = query.where(LLMBatchItem.request_status == request_status)
            if step_status is not None:
                query = query.where(LLMBatchItem.step_status == step_status)
            if after is not None:
                query = query.where(LLMBatchItem.id > after)

            query = query.order_by(LLMBatchItem.id.asc())

            if limit is not None:
                query = query.limit(limit)

            results = await session.execute(query)
            return [item.to_pydantic() for item in results.scalars()]

    @trace_method
    async def bulk_update_llm_batch_items_async(
        self, llm_batch_id_agent_id_pairs: List[Tuple[str, str]], field_updates: List[Dict[str, Any]], strict: bool = True
    ) -> None:
        """
        Efficiently update multiple LLMBatchItem rows by (llm_batch_id, agent_id) pairs.

        Args:
            llm_batch_id_agent_id_pairs: List of (llm_batch_id, agent_id) tuples identifying items to update
            field_updates: List of dictionaries containing the fields to update for each item
            strict: Whether to error if any of the requested keys don't exist (default True).
                    If False, missing pairs are skipped.
        """
        if not llm_batch_id_agent_id_pairs or not field_updates:
            return

        if len(llm_batch_id_agent_id_pairs) != len(field_updates):
            raise ValueError("llm_batch_id_agent_id_pairs and field_updates must have the same length")

        async with db_registry.async_session() as session:
            # Lookup primary keys for all requested (batch_id, agent_id) pairs
            query = select(LLMBatchItem.id, LLMBatchItem.llm_batch_id, LLMBatchItem.agent_id).filter(
                tuple_(LLMBatchItem.llm_batch_id, LLMBatchItem.agent_id).in_(llm_batch_id_agent_id_pairs)
            )
            result = await session.execute(query)
            items = result.all()
            pair_to_pk = {(batch_id, agent_id): pk for pk, batch_id, agent_id in items}

            if strict:
                requested = set(llm_batch_id_agent_id_pairs)
                found = set(pair_to_pk.keys())
                missing = requested - found
                if missing:
                    raise ValueError(
                        f"Cannot bulk-update batch items: no records for the following " f"(llm_batch_id, agent_id) pairs: {missing}"
                    )

            # Build mappings, skipping any missing when strict=False
            mappings = []
            for (batch_id, agent_id), fields in zip(llm_batch_id_agent_id_pairs, field_updates):
                pk = pair_to_pk.get((batch_id, agent_id))
                if pk is None:
                    # skip missing in non-strict mode
                    continue

                update_fields = fields.copy()
                update_fields["id"] = pk
                mappings.append(update_fields)

            if mappings:
                await session.run_sync(lambda ses: ses.bulk_update_mappings(LLMBatchItem, mappings))
                await session.commit()

    @enforce_types
    @trace_method
    async def bulk_update_batch_llm_items_results_by_agent_async(self, updates: List[ItemUpdateInfo], strict: bool = True) -> None:
        """Update request status and batch results for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [
            {
                "request_status": update.request_status,
                "batch_request_result": update.batch_request_result,
            }
            for update in updates
        ]

        await self.bulk_update_llm_batch_items_async(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    @trace_method
    async def bulk_update_llm_batch_items_step_status_by_agent_async(
        self, updates: List[StepStatusUpdateInfo], strict: bool = True
    ) -> None:
        """Update step status for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [{"step_status": update.step_status} for update in updates]

        await self.bulk_update_llm_batch_items_async(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    @trace_method
    async def bulk_update_llm_batch_items_request_status_by_agent_async(
        self, updates: List[RequestStatusUpdateInfo], strict: bool = True
    ) -> None:
        """Update request status for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [{"request_status": update.request_status} for update in updates]

        await self.bulk_update_llm_batch_items_async(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    @trace_method
    async def delete_llm_batch_item_async(self, item_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch item by ID."""
        async with db_registry.async_session() as session:
            item = await LLMBatchItem.read_async(db_session=session, identifier=item_id, actor=actor)
            await item.hard_delete_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    async def count_llm_batch_items_async(self, llm_batch_id: str) -> int:
        """
        Efficiently count the number of batch items for a given llm_batch_id.

        Args:
            llm_batch_id (str): The batch identifier to count items for.

        Returns:
            int: The total number of batch items associated with the given llm_batch_id.
        """
        async with db_registry.async_session() as session:
            count = await session.execute(select(func.count(LLMBatchItem.id)).where(LLMBatchItem.llm_batch_id == llm_batch_id))
            return count.scalar() or 0
