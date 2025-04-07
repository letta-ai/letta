import datetime
from typing import Optional

from anthropic.types.beta.messages import BetaMessageBatch, BetaMessageBatchIndividualResponse

from letta.log import get_logger
from letta.orm.llm_batch_items import LLMBatchItem
from letta.orm.llm_batch_job import LLMBatchJob
from letta.schemas.agent import AgentStepState
from letta.schemas.enums import AgentStepStatus, JobStatus
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
    def create_batch_request(
        self,
        llm_provider: str,
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
    def get_batch_request_by_id(self, batch_id: str, actor: PydanticUser) -> PydanticLLMBatchJob:
        """Retrieve a single batch job by ID."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            return batch.to_pydantic()

    @enforce_types
    def update_batch_status(
        self,
        batch_id: str,
        status: JobStatus,
        actor: PydanticUser,
        latest_polling_response: Optional[BetaMessageBatch] = None,
    ) -> PydanticLLMBatchJob:
        """Update a batch job’s status and optionally its polling response."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            batch.status = status
            batch.latest_polling_response = latest_polling_response
            batch.last_polled_at = datetime.datetime.now(datetime.timezone.utc)
            return batch.update(db_session=session, actor=actor).to_pydantic()

    @enforce_types
    def delete_batch_request(self, batch_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch job by ID."""
        with self.session_maker() as session:
            batch = LLMBatchJob.read(db_session=session, identifier=batch_id, actor=actor)
            batch.hard_delete(db_session=session, actor=actor)

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
    def delete_batch_item(self, item_id: str, actor: PydanticUser) -> None:
        """Hard delete a batch item by ID."""
        with self.session_maker() as session:
            item = LLMBatchItem.read(db_session=session, identifier=item_id, actor=actor)
            item.hard_delete(db_session=session, actor=actor)
