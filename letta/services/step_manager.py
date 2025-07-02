from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from letta.helpers.singleton import singleton
from letta.orm.errors import NoResultFound
from letta.orm.job import Job as JobModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step as StepModel
from letta.otel.tracing import get_trace_id, trace_method
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.step import Step as PydanticStep
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types


class FeedbackType(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"


class StepManager:

    @enforce_types
    @trace_method
    async def list_steps_async(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = 50,
        order: Optional[str] = None,
        model: Optional[str] = None,
        agent_id: Optional[str] = None,
        trace_ids: Optional[list[str]] = None,
        feedback: Optional[Literal["positive", "negative"]] = None,
        has_feedback: Optional[bool] = None,
        project_id: Optional[str] = None,
    ) -> List[PydanticStep]:
        """List all jobs with optional pagination and status filter."""
        async with db_registry.async_session() as session:
            filter_kwargs = {"organization_id": actor.organization_id}
            if model:
                filter_kwargs["model"] = model
            if agent_id:
                filter_kwargs["agent_id"] = agent_id
            if trace_ids:
                filter_kwargs["trace_id"] = trace_ids
            if feedback:
                filter_kwargs["feedback"] = feedback
            if project_id:
                filter_kwargs["project_id"] = project_id
            steps = await StepModel.list_async(
                db_session=session,
                before=before,
                after=after,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                ascending=True if order == "asc" else False,
                has_feedback=has_feedback,
                **filter_kwargs,
            )
            return [step.to_pydantic() for step in steps]

    @enforce_types
    @trace_method
    def log_step(
        self,
        actor: PydanticUser,
        agent_id: str,
        provider_name: str,
        provider_category: str,
        model: str,
        model_endpoint: Optional[str],
        context_window_limit: int,
        usage: UsageStatistics,
        provider_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> PydanticStep:
        step_data = {
            "origin": None,
            "organization_id": actor.organization_id,
            "agent_id": agent_id,
            "provider_id": provider_id,
            "provider_name": provider_name,
            "provider_category": provider_category,
            "model": model,
            "model_endpoint": model_endpoint,
            "context_window_limit": context_window_limit,
            "completion_tokens": usage.completion_tokens,
            "prompt_tokens": usage.prompt_tokens,
            "total_tokens": usage.total_tokens,
            "job_id": job_id,
            "tags": [],
            "tid": None,
            "trace_id": get_trace_id(),  # Get the current trace ID
            "project_id": project_id,
        }
        if step_id:
            step_data["id"] = step_id
        with db_registry.session() as session:
            if job_id:
                self._verify_job_access(session, job_id, actor, access=["write"])
            new_step = StepModel(**step_data)
            new_step.create(session)
            return new_step.to_pydantic()

    @enforce_types
    @trace_method
    async def log_step_async(
        self,
        actor: PydanticUser,
        agent_id: str,
        provider_name: str,
        provider_category: str,
        model: str,
        model_endpoint: Optional[str],
        context_window_limit: int,
        usage: UsageStatistics,
        provider_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> PydanticStep:
        step_data = {
            "origin": None,
            "organization_id": actor.organization_id,
            "agent_id": agent_id,
            "provider_id": provider_id,
            "provider_name": provider_name,
            "provider_category": provider_category,
            "model": model,
            "model_endpoint": model_endpoint,
            "context_window_limit": context_window_limit,
            "completion_tokens": usage.completion_tokens,
            "prompt_tokens": usage.prompt_tokens,
            "total_tokens": usage.total_tokens,
            "job_id": job_id,
            "tags": [],
            "tid": None,
            "trace_id": get_trace_id(),  # Get the current trace ID
            "project_id": project_id,
        }
        if step_id:
            step_data["id"] = step_id
        async with db_registry.async_session() as session:
            if job_id:
                await self._verify_job_access_async(session, job_id, actor, access=["write"])
            new_step = StepModel(**step_data)
            await new_step.create_async(session)
            return new_step.to_pydantic()

    @enforce_types
    @trace_method
    async def get_step_async(self, step_id: str, actor: PydanticUser) -> PydanticStep:
        async with db_registry.async_session() as session:
            step = await StepModel.read_async(db_session=session, identifier=step_id, actor=actor)
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def add_feedback_async(self, step_id: str, feedback: Optional[FeedbackType], actor: PydanticUser) -> PydanticStep:
        async with db_registry.async_session() as session:
            step = await StepModel.read_async(db_session=session, identifier=step_id, actor=actor)
            if not step:
                raise NoResultFound(f"Step with id {step_id} does not exist")
            step.feedback = feedback
            step = await step.update_async(session)
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def update_step_transaction_id(self, actor: PydanticUser, step_id: str, transaction_id: str) -> PydanticStep:
        """Update the transaction ID for a step.

        Args:
            actor: The user making the request
            step_id: The ID of the step to update
            transaction_id: The new transaction ID to set

        Returns:
            The updated step

        Raises:
            NoResultFound: If the step does not exist
        """
        async with db_registry.async_session() as session:
            step = await session.get(StepModel, step_id)
            if not step:
                raise NoResultFound(f"Step with id {step_id} does not exist")
            if step.organization_id != actor.organization_id:
                raise Exception("Unauthorized")

            step.tid = transaction_id
            await session.commit()
            return step.to_pydantic()

    def _verify_job_access(
        self,
        session: Session,
        job_id: str,
        actor: PydanticUser,
        access: List[Literal["read", "write", "delete"]] = ["read"],
    ) -> JobModel:
        """
        Verify that a job exists and the user has the required access.

        Args:
            session: The database session
            job_id: The ID of the job to verify
            actor: The user making the request

        Returns:
            The job if it exists and the user has access

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        job_query = select(JobModel).where(JobModel.id == job_id)
        job_query = JobModel.apply_access_predicate(job_query, actor, access, AccessType.USER)
        job = session.execute(job_query).scalar_one_or_none()
        if not job:
            raise NoResultFound(f"Job with id {job_id} does not exist or user does not have access")
        return job

    @staticmethod
    async def _verify_job_access_async(
        session: AsyncSession,
        job_id: str,
        actor: PydanticUser,
        access: List[Literal["read", "write", "delete"]] = ["read"],
    ) -> JobModel:
        """
        Verify that a job exists and the user has the required access asynchronously.

        Args:
            session: The async database session
            job_id: The ID of the job to verify
            actor: The user making the request

        Returns:
            The job if it exists and the user has access

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        job_query = select(JobModel).where(JobModel.id == job_id)
        job_query = JobModel.apply_access_predicate(job_query, actor, access, AccessType.USER)
        result = await session.execute(job_query)
        job = result.scalar_one_or_none()
        if not job:
            raise NoResultFound(f"Job with id {job_id} does not exist or user does not have access")
        return job


# noinspection PyTypeChecker
@singleton
class NoopStepManager(StepManager):
    """
    Noop implementation of StepManager.
    Temporarily used for migrations, but allows for different implementations in the future.
    Will not allow for writes, but will still allow for reads.
    """

    @enforce_types
    @trace_method
    def log_step(
        self,
        actor: PydanticUser,
        agent_id: str,
        provider_name: str,
        provider_category: str,
        model: str,
        model_endpoint: Optional[str],
        context_window_limit: int,
        usage: UsageStatistics,
        provider_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> PydanticStep:
        return

    @enforce_types
    @trace_method
    async def log_step_async(
        self,
        actor: PydanticUser,
        agent_id: str,
        provider_name: str,
        provider_category: str,
        model: str,
        model_endpoint: Optional[str],
        context_window_limit: int,
        usage: UsageStatistics,
        provider_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> PydanticStep:
        return
