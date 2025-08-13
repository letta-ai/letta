from datetime import datetime
from enum import Enum
from typing import Dict, List, Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from letta.helpers.singleton import singleton
from letta.orm.errors import NoResultFound
from letta.orm.job import Job as JobModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step as StepModel
from letta.orm.step_metrics import StepMetrics as StepMetricsModel
from letta.otel.tracing import get_trace_id, trace_method
from letta.schemas.enums import StepStatus
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.step import Step as PydanticStep
from letta.schemas.step_metrics import StepMetrics as PydanticStepMetrics
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
        stop_reason: Optional[LettaStopReason] = None,
        status: Optional[StepStatus] = None,
        error_type: Optional[str] = None,
        error_data: Optional[Dict] = None,
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
            "status": status if status else StepStatus.PENDING,
            "error_type": error_type,
            "error_data": error_data,
        }
        if step_id:
            step_data["id"] = step_id
        if stop_reason:
            step_data["stop_reason"] = stop_reason.stop_reason
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
        stop_reason: Optional[LettaStopReason] = None,
        status: Optional[StepStatus] = None,
        error_type: Optional[str] = None,
        error_data: Optional[Dict] = None,
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
            "status": status if status else StepStatus.PENDING,
            "error_type": error_type,
            "error_data": error_data,
        }
        if step_id:
            step_data["id"] = step_id
        if stop_reason:
            step_data["stop_reason"] = stop_reason.stop_reason
        async with db_registry.async_session() as session:
            new_step = StepModel(**step_data)
            await new_step.create_async(session, no_commit=True, no_refresh=True)
            pydantic_step = new_step.to_pydantic()
            await session.commit()
            return pydantic_step

    @enforce_types
    @trace_method
    async def get_step_async(self, step_id: str, actor: PydanticUser) -> PydanticStep:
        async with db_registry.async_session() as session:
            step = await StepModel.read_async(db_session=session, identifier=step_id, actor=actor)
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def get_step_metrics_async(self, step_id: str, actor: PydanticUser) -> PydanticStepMetrics:
        async with db_registry.async_session() as session:
            metrics = await StepMetricsModel.read_async(db_session=session, identifier=step_id, actor=actor)
            return metrics.to_pydantic()

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

    @enforce_types
    @trace_method
    async def update_step_stop_reason(self, actor: PydanticUser, step_id: str, stop_reason: StopReasonType) -> PydanticStep:
        """Update the stop reason for a step.

        Args:
            actor: The user making the request
            step_id: The ID of the step to update
            stop_reason: The stop reason to set

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

            step.stop_reason = stop_reason
            await session.commit()
            return step

    @enforce_types
    @trace_method
    async def update_step_error_async(
        self,
        actor: PydanticUser,
        step_id: str,
        error_type: str,
        error_message: str,
        error_traceback: str,
        error_details: Optional[Dict] = None,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        """Update a step with error information.

        Args:
            actor: The user making the request
            step_id: The ID of the step to update
            error_type: The type/class of the error
            error_message: The error message
            error_traceback: Full error traceback
            error_details: Additional error context
            stop_reason: The stop reason to set

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

            step.status = StepStatus.FAILED
            step.error_type = error_type
            step.error_data = {"message": error_message, "traceback": error_traceback, "details": error_details}
            if stop_reason:
                step.stop_reason = stop_reason.stop_reason

            await session.commit()
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def update_step_success_async(
        self,
        actor: PydanticUser,
        step_id: str,
        usage: UsageStatistics,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        """Update a step with success status and final usage statistics.

        Args:
            actor: The user making the request
            step_id: The ID of the step to update
            usage: Final usage statistics
            stop_reason: The stop reason to set

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

            step.status = StepStatus.SUCCESS
            step.completion_tokens = usage.completion_tokens
            step.prompt_tokens = usage.prompt_tokens
            step.total_tokens = usage.total_tokens
            if stop_reason:
                step.stop_reason = stop_reason.stop_reason

            await session.commit()
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def update_step_cancelled_async(
        self,
        actor: PydanticUser,
        step_id: str,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        """Update a step with cancelled status.

        Args:
            actor: The user making the request
            step_id: The ID of the step to update
            stop_reason: The stop reason to set

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

            step.status = StepStatus.CANCELLED
            if stop_reason:
                step.stop_reason = stop_reason.stop_reason

            await session.commit()
            return step.to_pydantic()

    @enforce_types
    @trace_method
    async def record_step_metrics_async(
        self,
        actor: PydanticUser,
        step_id: str,
        llm_request_ns: Optional[int] = None,
        tool_execution_ns: Optional[int] = None,
        step_ns: Optional[int] = None,
        agent_id: Optional[str] = None,
        job_id: Optional[str] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        base_template_id: Optional[str] = None,
    ) -> PydanticStepMetrics:
        """Record performance metrics for a step.

        Args:
            actor: The user making the request
            step_id: The ID of the step to record metrics for
            llm_request_ns: Time spent on LLM request in nanoseconds
            tool_execution_ns: Time spent on tool execution in nanoseconds
            step_ns: Total time for the step in nanoseconds
            agent_id: The ID of the agent
            job_id: The ID of the job
            project_id: The ID of the project
            template_id: The ID of the template
            base_template_id: The ID of the base template

        Returns:
            The created step metrics

        Raises:
            NoResultFound: If the step does not exist
        """
        async with db_registry.async_session() as session:
            step = await session.get(StepModel, step_id)
            if not step:
                raise NoResultFound(f"Step with id {step_id} does not exist")
            if step.organization_id != actor.organization_id:
                raise Exception("Unauthorized")

            metrics_data = {
                "id": step_id,
                "organization_id": actor.organization_id,
                "agent_id": agent_id or step.agent_id,
                "job_id": job_id or step.job_id,
                "project_id": project_id or step.project_id,
                "llm_request_ns": llm_request_ns,
                "tool_execution_ns": tool_execution_ns,
                "step_ns": step_ns,
                "template_id": template_id,
                "base_template_id": base_template_id,
            }

            metrics = StepMetricsModel(**metrics_data)
            await metrics.create_async(session)
            return metrics.to_pydantic()

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
        stop_reason: Optional[LettaStopReason] = None,
        status: Optional[StepStatus] = None,
        error_type: Optional[str] = None,
        error_data: Optional[Dict] = None,
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
        stop_reason: Optional[LettaStopReason] = None,
        status: Optional[StepStatus] = None,
        error_type: Optional[str] = None,
        error_data: Optional[Dict] = None,
    ) -> PydanticStep:
        return

    @enforce_types
    @trace_method
    async def update_step_error_async(
        self,
        actor: PydanticUser,
        step_id: str,
        error_type: str,
        error_message: str,
        error_traceback: str,
        error_details: Optional[Dict] = None,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        return

    @enforce_types
    @trace_method
    async def update_step_success_async(
        self,
        actor: PydanticUser,
        step_id: str,
        usage: UsageStatistics,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        return

    @enforce_types
    @trace_method
    async def update_step_cancelled_async(
        self,
        actor: PydanticUser,
        step_id: str,
        stop_reason: Optional[LettaStopReason] = None,
    ) -> PydanticStep:
        return
