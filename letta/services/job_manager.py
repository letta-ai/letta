from functools import reduce
from operator import add
from typing import List, Literal, Optional, Union

from sqlalchemy import select
from sqlalchemy.orm import Session

from letta.helpers.datetime_helpers import get_utc_time
from letta.orm.enums import JobType
from letta.orm.errors import NoResultFound
from letta.orm.job import Job as JobModel
from letta.orm.job_messages import JobMessage
from letta.orm.message import Message as MessageModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step
from letta.orm.step import Step as StepModel
from letta.schemas.enums import JobStatus, MessageRole
from letta.schemas.job import Job as PydanticJob
from letta.schemas.job import JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import LettaMessage
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.run import Run as PydanticRun
from letta.schemas.step import Step as PydanticStep
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class JobManager:
    """Manager class to handle business logic related to Jobs."""

    def __init__(self):
        # Fetching the db_context similarly as in OrganizationManager
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def create_job(self, pydantic_job: Union[PydanticJob, PydanticRun], actor: PydanticUser) -> Union[PydanticJob, PydanticRun]:
        """Create a new job based on the JobCreate schema."""
        with self.session_maker() as session:
            # Associate the job with the user
            pydantic_job.user_id = actor.id
            job_data = pydantic_job.model_dump(to_orm=True)
            job = JobModel(**job_data)
            job.create(session, actor=actor)  # Save job in the database
        return job.to_pydantic()

    @enforce_types
    def update_job_by_id(self, job_id: str, job_update: JobUpdate, actor: PydanticUser) -> PydanticJob:
        """Update a job by its ID with the given JobUpdate object."""
        with self.session_maker() as session:
            # Fetch the job by ID
            job = self._verify_job_access(session=session, job_id=job_id, actor=actor, access=["write"])

            # Update job attributes with only the fields that were explicitly set
            update_data = job_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            # Automatically update the completion timestamp if status is set to 'completed'
            if update_data.get("status") == JobStatus.completed and not job.completed_at:
                job.completed_at = get_utc_time()

            for key, value in update_data.items():
                setattr(job, key, value)

            # Save the updated job to the database
            job.update(db_session=session)  # TODO: Add this later , actor=actor)

            return job.to_pydantic()

    @enforce_types
    def get_job_by_id(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Fetch a job by its ID."""
        with self.session_maker() as session:
            # Retrieve job by ID using the Job model's read method
            job = JobModel.read(db_session=session, identifier=job_id, actor=actor, access_type=AccessType.USER)
            return job.to_pydantic()

    @enforce_types
    def list_jobs(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        statuses: Optional[List[JobStatus]] = None,
        job_type: JobType = JobType.JOB,
        ascending: bool = True,
    ) -> List[PydanticJob]:
        """List all jobs with optional pagination and status filter."""
        with self.session_maker() as session:
            filter_kwargs = {"user_id": actor.id, "job_type": job_type}

            # Add status filter if provided
            if statuses:
                filter_kwargs["status"] = statuses

            jobs = JobModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                **filter_kwargs,
            )
            return [job.to_pydantic() for job in jobs]

    @enforce_types
    def delete_job_by_id(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Delete a job by its ID."""
        with self.session_maker() as session:
            job = self._verify_job_access(session=session, job_id=job_id, actor=actor)
            job.hard_delete(db_session=session, actor=actor)
            return job.to_pydantic()

    @enforce_types
    def get_job_messages(
        self,
        job_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        role: Optional[MessageRole] = None,
        ascending: bool = True,
    ) -> List[PydanticMessage]:
        """
        Get all messages associated with a job.

        Args:
            job_id: The ID of the job to get messages for
            actor: The user making the request
            before: Cursor for pagination
            after: Cursor for pagination
            limit: Maximum number of messages to return
            role: Optional filter for message role
            ascending: Optional flag to sort in ascending order

        Returns:
            List of messages associated with the job

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        with self.session_maker() as session:
            # Build filters
            filters = {}
            if role is not None:
                filters["role"] = role

            # Get messages
            messages = MessageModel.list(
                db_session=session,
                before=before,
                after=after,
                ascending=ascending,
                limit=limit,
                actor=actor,
                join_model=JobMessage,
                join_conditions=[MessageModel.id == JobMessage.message_id, JobMessage.job_id == job_id],
                **filters,
            )

        return [message.to_pydantic() for message in messages]

    @enforce_types
    def get_job_steps(
        self,
        job_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        ascending: bool = True,
    ) -> List[PydanticStep]:
        """
        Get all steps associated with a job.

        Args:
            job_id: The ID of the job to get steps for
            actor: The user making the request
            before: Cursor for pagination
            after: Cursor for pagination
            limit: Maximum number of steps to return
            ascending: Optional flag to sort in ascending order

        Returns:
            List of steps associated with the job

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        with self.session_maker() as session:
            # Build filters
            filters = {}
            filters["job_id"] = job_id

            # Get steps
            steps = StepModel.list(
                db_session=session,
                before=before,
                after=after,
                ascending=ascending,
                limit=limit,
                actor=actor,
                **filters,
            )

        return [step.to_pydantic() for step in steps]

    @enforce_types
    def add_message_to_job(self, job_id: str, message_id: str, actor: PydanticUser) -> None:
        """
        Associate a message with a job by creating a JobMessage record.
        Each message can only be associated with one job.

        Args:
            job_id: The ID of the job
            message_id: The ID of the message to associate
            actor: The user making the request

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        with self.session_maker() as session:
            # First verify job exists and user has access
            self._verify_job_access(session, job_id, actor, access=["write"])

            # Create new JobMessage association
            job_message = JobMessage(job_id=job_id, message_id=message_id)
            session.add(job_message)
            session.commit()

    @enforce_types
    def get_job_usage(self, job_id: str, actor: PydanticUser) -> LettaUsageStatistics:
        """
        Get usage statistics for a job.

        Args:
            job_id: The ID of the job
            actor: The user making the request

        Returns:
            Usage statistics for the job

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        with self.session_maker() as session:
            # First verify job exists and user has access
            self._verify_job_access(session, job_id, actor)

            # Get the latest usage statistics for the job
            latest_stats = session.query(Step).filter(Step.job_id == job_id).order_by(Step.created_at.desc()).all()

            if not latest_stats:
                return LettaUsageStatistics(
                    completion_tokens=0,
                    prompt_tokens=0,
                    total_tokens=0,
                    step_count=0,
                )

            return LettaUsageStatistics(
                completion_tokens=reduce(add, (step.completion_tokens or 0 for step in latest_stats), 0),
                prompt_tokens=reduce(add, (step.prompt_tokens or 0 for step in latest_stats), 0),
                total_tokens=reduce(add, (step.total_tokens or 0 for step in latest_stats), 0),
                step_count=len(latest_stats),
            )

    @enforce_types
    def add_job_usage(
        self,
        job_id: str,
        usage: LettaUsageStatistics,
        step_id: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> None:
        """
        Add usage statistics for a job.

        Args:
            job_id: The ID of the job
            usage: Usage statistics for the job
            step_id: Optional ID of the specific step within the job
            actor: The user making the request

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        with self.session_maker() as session:
            # First verify job exists and user has access
            self._verify_job_access(session, job_id, actor, access=["write"])

            # Manually log step with usage data
            # TODO(@caren): log step under the hood and remove this
            usage_stats = Step(
                job_id=job_id,
                completion_tokens=usage.completion_tokens,
                prompt_tokens=usage.prompt_tokens,
                total_tokens=usage.total_tokens,
                step_count=usage.step_count,
                step_id=step_id,
            )
            if actor:
                usage_stats._set_created_and_updated_by_fields(actor.id)

            session.add(usage_stats)
            session.commit()

    @enforce_types
    def get_run_messages(
        self,
        run_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        role: Optional[MessageRole] = None,
        ascending: bool = True,
    ) -> List[LettaMessage]:
        """
        Get messages associated with a job using cursor-based pagination.
        This is a wrapper around get_job_messages that provides cursor-based pagination.

        Args:
            job_id: The ID of the job to get messages for
            actor: The user making the request
            before: Message ID to get messages after
            after: Message ID to get messages before
            limit: Maximum number of messages to return
            ascending: Whether to return messages in ascending order
            role: Optional role filter

        Returns:
            List of LettaMessages associated with the job

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        messages = self.get_job_messages(
            job_id=run_id,
            actor=actor,
            before=before,
            after=after,
            limit=limit,
            role=role,
            ascending=ascending,
        )

        request_config = self._get_run_request_config(run_id)

        messages = PydanticMessage.to_letta_messages_from_list(
            messages=messages,
            use_assistant_message=request_config["use_assistant_message"],
            assistant_message_tool_name=request_config["assistant_message_tool_name"],
            assistant_message_tool_kwarg=request_config["assistant_message_tool_kwarg"],
        )

        return messages

    @enforce_types
    def get_step_messages(
        self,
        run_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        role: Optional[MessageRole] = None,
        ascending: bool = True,
    ) -> List[LettaMessage]:
        """
        Get steps associated with a job using cursor-based pagination.
        This is a wrapper around get_job_messages that provides cursor-based pagination.

        Args:
            run_id: The ID of the run to get steps for
            actor: The user making the request
            before: Message ID to get messages after
            after: Message ID to get messages before
            limit: Maximum number of messages to return
            ascending: Whether to return messages in ascending order
            role: Optional role filter

        Returns:
            List of Steps associated with the job

        Raises:
            NoResultFound: If the job does not exist or user does not have access
        """
        messages = self.get_job_messages(
            job_id=run_id,
            actor=actor,
            before=before,
            after=after,
            limit=limit,
            role=role,
            ascending=ascending,
        )

        request_config = self._get_run_request_config(run_id)

        messages = PydanticMessage.to_letta_messages_from_list(
            messages=messages,
            use_assistant_message=request_config["use_assistant_message"],
            assistant_message_tool_name=request_config["assistant_message_tool_name"],
            assistant_message_tool_kwarg=request_config["assistant_message_tool_kwarg"],
        )

        return messages

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

    def _get_run_request_config(self, run_id: str) -> LettaRequestConfig:
        """
        Get the request config for a job.

        Args:
            job_id: The ID of the job to get messages for

        Returns:
            The request config for the job
        """
        with self.session_maker() as session:
            job = session.query(JobModel).filter(JobModel.id == run_id).first()
            request_config = job.request_config or LettaRequestConfig()
        return request_config
