import datetime
from typing import Any, Dict, List, Optional, Tuple

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse
from sqlalchemy import desc, func, tuple_

from letta.jobs.types import BatchPollingResult, ItemUpdateInfo, RequestStatusUpdateInfo, StepStatusUpdateInfo
from letta.log import get_logger
from letta.orm import Message as MessageModel
from letta.orm.llm_batch_items import LLMBatchItem
from letta.orm.llm_batch_job import LLMBatchJob
from letta.schemas.agent import AgentStepState
from letta.schemas.enums import AgentStepStatus, JobStatus, ProviderType
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
    def create_llm_batch_job(
        self,
        llm_provider: ProviderType,
        create_batch_response: BetaMessageBatch,
        actor: PydanticUser,
        letta_batch_job_id: str,
        status: JobStatus = JobStatus.created,
    ) -> PydanticLLMBatchJob:
        """Create a new LLM batch job."""
        with db_registry.session() as session:
            batch = LLMBatchJob(
                status=status,
                llm_provider=llm_provider,
                create_batch_response=create_batch_response,
                organization_id=actor.organization_id,
                letta_batch_job_id=letta_batch_job_id,
            )
            batch.create(session, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    def get_llm_batch_job_by_id(self, llm_batch_id: str, actor: Optional[PydanticUser] = None) -> PydanticLLMBatchJob:
        """Retrieve a single batch job by ID."""
        with db_registry.session() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=llm_batch_id, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    def update_llm_batch_status(
        self,
        llm_batch_id: str,
        status: JobStatus,
        actor: Optional[PydanticUser] = None,
        latest_polling_response: Optional[BetaMessageBatch] = None,
    ) -> PydanticLLMBatchJob:
        """Update a batch job’s status and optionally its polling response."""
        with db_registry.session() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=llm_batch_id, actor=actor)
            batch.status = status
            batch.latest_polling_response = latest_polling_response
            batch.last_polled_at = datetime.datetime.now(datetime.timezone.utc)
            batch = batch.update(db_session=session, actor=actor)
            return batch.to_pydantic()

    def bulk_update_llm_batch_statuses(
        self,
        updates: List[BatchPollingResult],
    ) -> None:
        """
        Efficiently update many LLMBatchJob rows. This is used by the cron jobs.

        `updates` = [(llm_batch_id, new_status, polling_response_or_None), …]
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        with db_registry.session() as session:
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

            session.bulk_update_mappings(LLMBatchJob, mappings)
            session.commit()

    @enforce_types
    def list_llm_batch_jobs(
        self,
        letta_batch_id: str,
        limit: Optional[int] = None,
        actor: Optional[PydanticUser] = None,
        after: Optional[str] = None,
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
        with db_registry.session() as session:
            query = session.query(LLMBatchJob).filter(LLMBatchJob.letta_batch_job_id == letta_batch_id)

            if actor is not None:
                query = query.filter(LLMBatchJob.organization_id == actor.organization_id)

            # Additional optional filters
            if after is not None:
                query = query.filter(LLMBatchJob.id > after)

            query = query.order_by(LLMBatchJob.id.asc())

            if limit is not None:
                query = query.limit(limit)

            results = query.all()
            return [item.to_pydantic() for item in results]

    @enforce_types
    def delete_llm_batch_request(self, llm_batch_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch job by ID."""
        with db_registry.session() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=llm_batch_id, actor=actor)
            batch.hard_delete(db_session=session, actor=actor)

    @enforce_types
    def get_messages_for_letta_batch(
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
        with db_registry.session() as session:
            # If cursor is provided, get sequence_id for that message
            cursor_sequence_id = None
            if cursor:
                cursor_query = session.query(MessageModel.sequence_id).filter(MessageModel.id == cursor).limit(1)
                cursor_result = cursor_query.first()
                if cursor_result:
                    cursor_sequence_id = cursor_result[0]
                else:
                    # If cursor message doesn't exist, ignore it
                    pass

            query = (
                session.query(MessageModel)
                .join(LLMBatchItem, MessageModel.batch_item_id == LLMBatchItem.id)
                .join(LLMBatchJob, LLMBatchItem.llm_batch_id == LLMBatchJob.id)
                .filter(LLMBatchJob.letta_batch_job_id == letta_batch_job_id)
            )

            if actor is not None:
                query = query.filter(MessageModel.organization_id == actor.organization_id)

            if agent_id is not None:
                query = query.filter(MessageModel.agent_id == agent_id)

            # Apply cursor-based pagination if cursor exists
            if cursor_sequence_id is not None:
                if sort_descending:
                    query = query.filter(MessageModel.sequence_id < cursor_sequence_id)
                else:
                    query = query.filter(MessageModel.sequence_id > cursor_sequence_id)

            if sort_descending:
                query = query.order_by(desc(MessageModel.sequence_id))
            else:
                query = query.order_by(MessageModel.sequence_id)

            query = query.limit(limit)

            results = query.all()
            return [message.to_pydantic() for message in results]

    @enforce_types
    def list_running_llm_batches(self, actor: Optional[PydanticUser] = None) -> List[PydanticLLMBatchJob]:
        """Return all running LLM batch jobs, optionally filtered by actor's organization."""
        with db_registry.session() as session:
            query = session.query(LLMBatchJob).filter(LLMBatchJob.status == JobStatus.running)

            if actor is not None:
                query = query.filter(LLMBatchJob.organization_id == actor.organization_id)

            results = query.all()
            return [batch.to_pydantic() for batch in results]

    @enforce_types
    def create_llm_batch_item(
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
        with db_registry.session() as session:
            item = LLMBatchItem(
                llm_batch_id=llm_batch_id,
                agent_id=agent_id,
                llm_config=llm_config,
                request_status=request_status,
                step_status=step_status,
                step_state=step_state,
                organization_id=actor.organization_id,
            )
            item.create(session, actor=actor)
            return item.to_pydantic()

    @enforce_types
    def create_llm_batch_items_bulk(self, llm_batch_items: List[PydanticLLMBatchItem], actor: PydanticUser) -> List[PydanticLLMBatchItem]:
        """
        Create multiple batch items in bulk for better performance.

        Args:
            llm_batch_items: List of batch items to create
            actor: User performing the action

        Returns:
            List of created batch items as Pydantic models
        """
        with db_registry.session() as session:
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

            # Use the batch_create method to create all items at once
            created_items = LLMBatchItem.batch_create(orm_items, session, actor=actor)

            # Convert back to Pydantic models
            return [item.to_pydantic() for item in created_items]

    @enforce_types
    def get_llm_batch_item_by_id(self, item_id: str, actor: PydanticUser) -> PydanticLLMBatchItem:
        """Retrieve a single batch item by ID."""
        with db_registry.session() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)
            return item.to_pydantic()

    @enforce_types
    def update_llm_batch_item(
        self,
        item_id: str,
        actor: PydanticUser,
        request_status: Optional[JobStatus] = None,
        step_status: Optional[AgentStepStatus] = None,
        llm_request_response: Optional[BetaMessageBatchIndividualResponse] = None,
        step_state: Optional[AgentStepState] = None,
    ) -> PydanticLLMBatchItem:
        """Update fields on a batch item."""
        with db_registry.session() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)

            if request_status:
                item.request_status = request_status
            if step_status:
                item.step_status = step_status
            if llm_request_response:
                item.batch_request_result = llm_request_response
            if step_state:
                item.step_state = step_state

            return item.update(db_session=session, actor=actor).to_pydantic()

    @enforce_types
    def list_llm_batch_items(
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
        with db_registry.session() as session:
            query = session.query(LLMBatchItem).filter(LLMBatchItem.llm_batch_id == llm_batch_id)

            if actor is not None:
                query = query.filter(LLMBatchItem.organization_id == actor.organization_id)

            # Additional optional filters
            if agent_id is not None:
                query = query.filter(LLMBatchItem.agent_id == agent_id)
            if request_status is not None:
                query = query.filter(LLMBatchItem.request_status == request_status)
            if step_status is not None:
                query = query.filter(LLMBatchItem.step_status == step_status)
            if after is not None:
                query = query.filter(LLMBatchItem.id > after)

            query = query.order_by(LLMBatchItem.id.asc())

            if limit is not None:
                query = query.limit(limit)

            results = query.all()
            return [item.to_pydantic() for item in results]

    def bulk_update_llm_batch_items(
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

        with db_registry.session() as session:
            # Lookup primary keys for all requested (batch_id, agent_id) pairs
            items = (
                session.query(LLMBatchItem.id, LLMBatchItem.llm_batch_id, LLMBatchItem.agent_id)
                .filter(tuple_(LLMBatchItem.llm_batch_id, LLMBatchItem.agent_id).in_(llm_batch_id_agent_id_pairs))
                .all()
            )
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
                session.bulk_update_mappings(LLMBatchItem, mappings)
                session.commit()

    @enforce_types
    def bulk_update_batch_llm_items_results_by_agent(self, updates: List[ItemUpdateInfo], strict: bool = True) -> None:
        """Update request status and batch results for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [
            {
                "request_status": update.request_status,
                "batch_request_result": update.batch_request_result,
            }
            for update in updates
        ]

        self.bulk_update_llm_batch_items(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    def bulk_update_llm_batch_items_step_status_by_agent(self, updates: List[StepStatusUpdateInfo], strict: bool = True) -> None:
        """Update step status for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [{"step_status": update.step_status} for update in updates]

        self.bulk_update_llm_batch_items(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    def bulk_update_llm_batch_items_request_status_by_agent(self, updates: List[RequestStatusUpdateInfo], strict: bool = True) -> None:
        """Update request status for multiple batch items."""
        batch_id_agent_id_pairs = [(update.llm_batch_id, update.agent_id) for update in updates]
        field_updates = [{"request_status": update.request_status} for update in updates]

        self.bulk_update_llm_batch_items(batch_id_agent_id_pairs, field_updates, strict=strict)

    @enforce_types
    def delete_llm_batch_item(self, item_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch item by ID."""
        with db_registry.session() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)
            item.hard_delete(db_session=session, actor=actor)

    @enforce_types
    def count_llm_batch_items(self, llm_batch_id: str) -> int:
        """
        Efficiently count the number of batch items for a given llm_batch_id.

        Args:
            llm_batch_id (str): The batch identifier to count items for.

        Returns:
            int: The total number of batch items associated with the given llm_batch_id.
        """
        with db_registry.session() as session:
            count = session.query(func.count(LLMBatchItem.id)).filter(LLMBatchItem.llm_batch_id == llm_batch_id).scalar()
            return count or 0
