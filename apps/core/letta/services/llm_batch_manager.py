import datetime
from typing import List, Optional

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse
from sqlalchemy import tuple_

from letta.jobs.types import BatchPollingResult, ItemUpdateInfo
from letta.log import get_logger
from letta.orm.llm_batch_items import LLMBatchItem
from letta.orm.llm_batch_job import LLMBatchJob
from letta.schemas.agent import AgentStepState
from letta.schemas.enums import AgentStepStatus, JobStatus, ProviderType
from letta.schemas.llm_batch_job import LLMBatchItem as PydanticLLMBatchItem
from letta.schemas.llm_batch_job import LLMBatchJob as PydanticLLMBatchJob
from letta.schemas.llm_config import LLMConfig
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types

logger = get_logger(__name__)


class LLMBatchManager:
    """Manager for handling both LLMBatchJob and LLMBatchItem operations."""

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def create_batch_job(
        self,
        llm_provider: ProviderType,
        create_batch_response: BetaMessageBatch,
        actor: PydanticUser,
        status: JobStatus = JobStatus.created,
    ) -> PydanticLLMBatchJob:
        """Create a new LLM batch job."""
        with self.session_maker() as session:
            batch = LLMBatchJob(
                status=status,
                llm_provider=llm_provider,
                create_batch_response=create_batch_response,
                organization_id=actor.organization_id,
            )
            batch.create(session, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    def get_batch_job_by_id(self, batch_id: str, actor: Optional[PydanticUser] = None) -> PydanticLLMBatchJob:
        """Retrieve a single batch job by ID."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    def update_batch_status(
        self,
        batch_id: str,
        status: JobStatus,
        actor: Optional[PydanticUser] = None,
        latest_polling_response: Optional[BetaMessageBatch] = None,
    ) -> PydanticLLMBatchJob:
        """Update a batch job’s status and optionally its polling response."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            batch.status = status
            batch.latest_polling_response = latest_polling_response
            batch.last_polled_at = datetime.datetime.now(datetime.timezone.utc)
            batch = batch.update(db_session=session, actor=actor)
            return batch.to_pydantic()

    def bulk_update_batch_statuses(
        self,
        updates: List[BatchPollingResult],
    ) -> None:
        """
        Efficiently update many LLMBatchJob rows. This is used by the cron jobs.

        `updates` = [(batch_id, new_status, polling_response_or_None), …]
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        with self.session_maker() as session:
            mappings = []
            for batch_id, status, response in updates:
                mappings.append(
                    {
                        "id": batch_id,
                        "status": status,
                        "latest_polling_response": response,
                        "last_polled_at": now,
                    }
                )

            session.bulk_update_mappings(LLMBatchJob, mappings)
            session.commit()

    @enforce_types
    def delete_batch_request(self, batch_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch job by ID."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            batch.hard_delete(db_session=session, actor=actor)

    @enforce_types
    def list_running_batches(self, actor: Optional[PydanticUser] = None) -> List[PydanticLLMBatchJob]:
        """Return all running LLM batch jobs, optionally filtered by actor's organization."""
        with self.session_maker() as session:
            query = session.query(LLMBatchJob).filter(LLMBatchJob.status == JobStatus.running)

            if actor is not None:
                query = query.filter(LLMBatchJob.organization_id == actor.organization_id)

            results = query.all()
            return [batch.to_pydantic() for batch in results]

    @enforce_types
    def create_batch_item(
        self,
        batch_id: str,
        agent_id: str,
        llm_config: LLMConfig,
        actor: PydanticUser,
        request_status: JobStatus = JobStatus.created,
        step_status: AgentStepStatus = AgentStepStatus.paused,
        step_state: Optional[AgentStepState] = None,
    ) -> PydanticLLMBatchItem:
        """Create a new batch item."""
        with self.session_maker() as session:
            item = LLMBatchItem(
                batch_id=batch_id,
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
    def get_batch_item_by_id(self, item_id: str, actor: PydanticUser) -> PydanticLLMBatchItem:
        """Retrieve a single batch item by ID."""
        with self.session_maker() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)
            return item.to_pydantic()

    @enforce_types
    def update_batch_item(
        self,
        item_id: str,
        actor: PydanticUser,
        request_status: Optional[JobStatus] = None,
        step_status: Optional[AgentStepStatus] = None,
        llm_request_response: Optional[BetaMessageBatchIndividualResponse] = None,
        step_state: Optional[AgentStepState] = None,
    ) -> PydanticLLMBatchItem:
        """Update fields on a batch item."""
        with self.session_maker() as session:
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
    def list_batch_items(
        self,
        batch_id: str,
        limit: Optional[int] = None,
        actor: Optional[PydanticUser] = None,
    ) -> List[PydanticLLMBatchItem]:
        """List all batch items for a given batch_id, optionally filtered by organization and limited in count."""
        with self.session_maker() as session:
            query = session.query(LLMBatchItem).filter(LLMBatchItem.batch_id == batch_id)

            if actor is not None:
                query = query.filter(LLMBatchItem.organization_id == actor.organization_id)

            if limit:
                query = query.limit(limit)

            results = query.all()
            return [item.to_pydantic() for item in results]

    def bulk_update_batch_items_by_agent(
        self,
        updates: List[ItemUpdateInfo],
    ) -> None:
        """
        Efficiently update LLMBatchItem rows by (batch_id, agent_id).

        Args:
            updates: List of tuples:
              (batch_id, agent_id, new_request_status, batch_request_result)
        """
        with self.session_maker() as session:
            # For bulk_update_mappings, we need the primary key of each row
            # So we must map (batch_id, agent_id) → actual PK (id)
            # We'll do it in one DB query using the (batch_id, agent_id) sets

            # 1. Gather the pairs
            key_pairs = [(b_id, a_id) for (b_id, a_id, *_rest) in updates]

            # 2. Query items in a single step
            items = (
                session.query(LLMBatchItem.id, LLMBatchItem.batch_id, LLMBatchItem.agent_id)
                .filter(tuple_(LLMBatchItem.batch_id, LLMBatchItem.agent_id).in_(key_pairs))
                .all()
            )

            # Build a map from (batch_id, agent_id) → PK id
            pair_to_pk = {}
            for row_id, row_batch_id, row_agent_id in items:
                pair_to_pk[(row_batch_id, row_agent_id)] = row_id

            # 3. Construct mappings for the PK-based bulk update
            mappings = []
            for batch_id, agent_id, new_status, new_result in updates:
                pk_id = pair_to_pk.get((batch_id, agent_id))
                if not pk_id:
                    # Nonexistent or mismatch → skip
                    continue
                mappings.append(
                    {
                        "id": pk_id,
                        "request_status": new_status,
                        "batch_request_result": new_result,
                    }
                )

            if mappings:
                session.bulk_update_mappings(LLMBatchItem, mappings)
                session.commit()

    @enforce_types
    def delete_batch_item(self, item_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch item by ID."""
        with self.session_maker() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)
            item.hard_delete(db_session=session, actor=actor)
