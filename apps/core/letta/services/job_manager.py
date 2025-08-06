from datetime import datetime
from functools import partial, reduce
from operator import add
from typing import List, Literal, Optional, Union

from httpx import AsyncClient, post
from sqlalchemy import select
from sqlalchemy.orm import Session

from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.job import Job as JobModel
from letta.orm.job_messages import JobMessage
from letta.orm.message import Message as MessageModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step
from letta.orm.step import Step as StepModel
from letta.otel.tracing import log_event, trace_method
from letta.schemas.enums import JobStatus, JobType, MessageRole
from letta.schemas.job import BatchJob as PydanticBatchJob
from letta.schemas.job import Job as PydanticJob
from letta.schemas.job import JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import LettaMessage
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.run import Run as PydanticRun
from letta.schemas.step import Step as PydanticStep
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.settings import DatabaseChoice, settings
from letta.utils import enforce_types

logger = get_logger(__name__)


class JobManager:
    """Manager class to handle business logic related to Jobs."""

    @enforce_types
    @trace_method
    def create_job(
        self, pydantic_job: Union[PydanticJob, PydanticRun, PydanticBatchJob], actor: PydanticUser
    ) -> Union[PydanticJob, PydanticRun, PydanticBatchJob]:
        """Create a new job based on the JobCreate schema."""
        with db_registry.session() as session:
            # Associate the job with the user
            pydantic_job.user_id = actor.id
            job_data = pydantic_job.model_dump(to_orm=True)
            job = JobModel(**job_data)
            job.create(session, actor=actor)  # Save job in the database
        return job.to_pydantic()

    @enforce_types
    @trace_method
    async def create_job_async(
        self, pydantic_job: Union[PydanticJob, PydanticRun, PydanticBatchJob], actor: PydanticUser
    ) -> Union[PydanticJob, PydanticRun, PydanticBatchJob]:
        """Create a new job based on the JobCreate schema."""
        async with db_registry.async_session() as session:
            # Associate the job with the user
            pydantic_job.user_id = actor.id
            job_data = pydantic_job.model_dump(to_orm=True)
            job = JobModel(**job_data)
            job = await job.create_async(session, actor=actor, no_commit=True, no_refresh=True)  # Save job in the database
            result = job.to_pydantic()
            await session.commit()
            return result

    @enforce_types
    @trace_method
    def update_job_by_id(self, job_id: str, job_update: JobUpdate, actor: PydanticUser) -> PydanticJob:
        """Update a job by its ID with the given JobUpdate object."""
        # First check if we need to dispatch a callback
        needs_callback = False
        callback_url = None
        with db_registry.session() as session:
            job = self._verify_job_access(session=session, job_id=job_id, actor=actor, access=["write"])
            not_completed_before = not bool(job.completed_at)

            # Check if we'll need to dispatch callback
            if job_update.status in {JobStatus.completed, JobStatus.failed} and not_completed_before and job.callback_url:
                needs_callback = True
                callback_url = job.callback_url

        # Update the job first to get the final metadata
        with db_registry.session() as session:
            job = self._verify_job_access(session=session, job_id=job_id, actor=actor, access=["write"])
            not_completed_before = not bool(job.completed_at)

            # Update job attributes with only the fields that were explicitly set
            update_data = job_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            # Automatically update the completion timestamp if status is set to 'completed'
            for key, value in update_data.items():
                # Ensure completed_at is timezone-naive for database compatibility
                if key == "completed_at" and value is not None and hasattr(value, "replace"):
                    value = value.replace(tzinfo=None)
                setattr(job, key, value)

            if job_update.status in {JobStatus.completed, JobStatus.failed} and not_completed_before:
                job.completed_at = get_utc_time().replace(tzinfo=None)

            # Save the updated job to the database first
            job = job.update(db_session=session, actor=actor)

            # Get the updated metadata for callback
            final_metadata = job.metadata_
            result = job.to_pydantic()

        # Dispatch callback outside of database session if needed
        if needs_callback:
            callback_info = {
                "job_id": job_id,
                "callback_url": callback_url,
                "status": job_update.status,
                "completed_at": get_utc_time().replace(tzinfo=None),
                "metadata": final_metadata,
            }
            callback_result = self._dispatch_callback_sync(callback_info)

            # Update callback status in a separate transaction
            with db_registry.session() as session:
                job = self._verify_job_access(session=session, job_id=job_id, actor=actor, access=["write"])
                job.callback_sent_at = callback_result["callback_sent_at"]
                job.callback_status_code = callback_result.get("callback_status_code")
                job.callback_error = callback_result.get("callback_error")
                job.update(db_session=session, actor=actor)
                result = job.to_pydantic()

        return result

    @enforce_types
    @trace_method
    async def update_job_by_id_async(
        self, job_id: str, job_update: JobUpdate, actor: PydanticUser, safe_update: bool = False
    ) -> PydanticJob:
        """Update a job by its ID with the given JobUpdate object asynchronously."""
        # First check if we need to dispatch a callback
        needs_callback = False
        callback_url = None
        async with db_registry.async_session() as session:
            job = await self._verify_job_access_async(session=session, job_id=job_id, actor=actor, access=["write"])

            # Safely update job status with state transition guards: Created -> Pending -> Running --> <Terminal>
            if safe_update:
                current_status = JobStatus(job.status)
                if not any(
                    (
                        job_update.status.is_terminal and not current_status.is_terminal,
                        current_status == JobStatus.created and job_update.status != JobStatus.created,
                        current_status == JobStatus.pending and job_update.status == JobStatus.running,
                    )
                ):
                    logger.error(f"Invalid job status transition from {current_status} to {job_update.status} for job {job_id}")
                    raise ValueError(f"Invalid job status transition from {current_status} to {job_update.status}")

            # Check if we'll need to dispatch callback
            if job_update.status in {JobStatus.completed, JobStatus.failed} and job.callback_url:
                needs_callback = True
                callback_url = job.callback_url

            # Update job attributes with only the fields that were explicitly set
            update_data = job_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            # Automatically update the completion timestamp if status is set to 'completed'
            for key, value in update_data.items():
                # Ensure completed_at is timezone-naive for database compatibility
                if key == "completed_at" and value is not None and hasattr(value, "replace"):
                    value = value.replace(tzinfo=None)
                setattr(job, key, value)

            # If we are updating the job to a terminal state
            if job_update.status in {JobStatus.completed, JobStatus.failed}:
                logger.info(f"Current job completed at: {job.completed_at}")
                job.completed_at = get_utc_time().replace(tzinfo=None)

            # Save the updated job to the database first
            job = await job.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)

            # Get the updated metadata for callback
            final_metadata = job.metadata_
            result = job.to_pydantic()
            await session.commit()

        # Dispatch callback outside of database session if needed
        if needs_callback:
            callback_info = {
                "job_id": job_id,
                "callback_url": callback_url,
                "status": job_update.status,
                "completed_at": get_utc_time().replace(tzinfo=None),
                "metadata": final_metadata,
            }
            callback_result = await self._dispatch_callback_async(callback_info)

            # Update callback status in a separate transaction
            async with db_registry.async_session() as session:
                job = await self._verify_job_access_async(session=session, job_id=job_id, actor=actor, access=["write"])
                job.callback_sent_at = callback_result["callback_sent_at"]
                job.callback_status_code = callback_result.get("callback_status_code")
                job.callback_error = callback_result.get("callback_error")
                await job.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
                result = job.to_pydantic()
                await session.commit()

        return result

    @enforce_types
    @trace_method
    async def safe_update_job_status_async(
        self, job_id: str, new_status: JobStatus, actor: PydanticUser, metadata: Optional[dict] = None
    ) -> bool:
        """
        Safely update job status with state transition guards.
        Created -> Pending -> Running --> <Terminal>

        Returns:
            True if update was successful, False if update was skipped due to invalid transition
        """
        try:
            job_update_builder = partial(JobUpdate, status=new_status)
            if metadata:
                job_update_builder = partial(job_update_builder, metadata=metadata)
            if new_status.is_terminal:
                job_update_builder = partial(job_update_builder, completed_at=get_utc_time())

            await self.update_job_by_id_async(job_id=job_id, job_update=job_update_builder(), actor=actor)
            return True

        except Exception as e:
            logger.error(f"Failed to safely update job status for job {job_id}: {e}")
            return False

    @enforce_types
    @trace_method
    def get_job_by_id(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Fetch a job by its ID."""
        with db_registry.session() as session:
            # Retrieve job by ID using the Job model's read method
            job = JobModel.read(db_session=session, identifier=job_id, actor=actor, access_type=AccessType.USER)
            return job.to_pydantic()

    @enforce_types
    @trace_method
    async def get_job_by_id_async(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Fetch a job by its ID asynchronously."""
        async with db_registry.async_session() as session:
            # Retrieve job by ID using the Job model's read method
            job = await JobModel.read_async(db_session=session, identifier=job_id, actor=actor, access_type=AccessType.USER)
            return job.to_pydantic()

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
    async def list_jobs_async(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        statuses: Optional[List[JobStatus]] = None,
        job_type: JobType = JobType.JOB,
        ascending: bool = True,
        source_id: Optional[str] = None,
    ) -> List[PydanticJob]:
        """List all jobs with optional pagination and status filter."""
        from sqlalchemy import and_, or_, select

        async with db_registry.async_session() as session:
            # build base query
            query = select(JobModel).where(JobModel.user_id == actor.id).where(JobModel.job_type == job_type)

            # add status filter if provided
            if statuses:
                query = query.where(JobModel.status.in_(statuses))

            # add source_id filter if provided
            if source_id:
                column = getattr(JobModel, "metadata_")
                column = column.op("->>")("source_id")
                query = query.where(column == source_id)

            # handle cursor-based pagination
            if before or after:
                # get cursor objects
                before_obj = None
                after_obj = None

                if before:
                    before_obj = await session.get(JobModel, before)
                    if not before_obj:
                        raise ValueError(f"Job with id {before} not found")

                if after:
                    after_obj = await session.get(JobModel, after)
                    if not after_obj:
                        raise ValueError(f"Job with id {after} not found")

                # validate cursors
                if before_obj and after_obj:
                    if before_obj.created_at < after_obj.created_at:
                        raise ValueError("'before' reference must be later than 'after' reference")
                    elif before_obj.created_at == after_obj.created_at and before_obj.id < after_obj.id:
                        raise ValueError("'before' reference must be later than 'after' reference")

                # build cursor conditions
                conditions = []
                if before_obj:
                    # records before this cursor (older)

                    before_timestamp = before_obj.created_at
                    # SQLite does not support as granular timestamping, so we need to round the timestamp
                    if settings.database_engine is DatabaseChoice.SQLITE and isinstance(before_timestamp, datetime):
                        before_timestamp = before_timestamp.strftime("%Y-%m-%d %H:%M:%S")

                    conditions.append(
                        or_(
                            JobModel.created_at < before_timestamp,
                            and_(JobModel.created_at == before_timestamp, JobModel.id < before_obj.id),
                        )
                    )

                if after_obj:
                    # records after this cursor (newer)
                    after_timestamp = after_obj.created_at
                    # SQLite does not support as granular timestamping, so we need to round the timestamp
                    if settings.database_engine is DatabaseChoice.SQLITE and isinstance(after_timestamp, datetime):
                        after_timestamp = after_timestamp.strftime("%Y-%m-%d %H:%M:%S")

                    conditions.append(
                        or_(JobModel.created_at > after_timestamp, and_(JobModel.created_at == after_timestamp, JobModel.id > after_obj.id))
                    )

                if conditions:
                    query = query.where(and_(*conditions))

            # apply ordering
            if ascending:
                query = query.order_by(JobModel.created_at.asc(), JobModel.id.asc())
            else:
                query = query.order_by(JobModel.created_at.desc(), JobModel.id.desc())

            # apply limit
            if limit:
                query = query.limit(limit)

            # execute query
            result = await session.execute(query)
            jobs = result.scalars().all()

            return [job.to_pydantic() for job in jobs]

    @enforce_types
    @trace_method
    def delete_job_by_id(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Delete a job by its ID."""
        with db_registry.session() as session:
            job = self._verify_job_access(session=session, job_id=job_id, actor=actor)
            job.hard_delete(db_session=session, actor=actor)
            return job.to_pydantic()

    @enforce_types
    @trace_method
    async def delete_job_by_id_async(self, job_id: str, actor: PydanticUser) -> PydanticJob:
        """Delete a job by its ID."""
        async with db_registry.async_session() as session:
            job = await self._verify_job_access_async(session=session, job_id=job_id, actor=actor)
            await job.hard_delete_async(db_session=session, actor=actor)
            return job.to_pydantic()

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
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
        with db_registry.session() as session:
            # First verify job exists and user has access
            self._verify_job_access(session, job_id, actor, access=["write"])

            # Create new JobMessage association
            job_message = JobMessage(job_id=job_id, message_id=message_id)
            session.add(job_message)
            session.commit()

    @enforce_types
    @trace_method
    async def add_messages_to_job_async(self, job_id: str, message_ids: List[str], actor: PydanticUser) -> None:
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
        if not message_ids:
            return

        async with db_registry.async_session() as session:
            # First verify job exists and user has access
            await self._verify_job_access_async(session, job_id, actor, access=["write"])

            # Create new JobMessage associations
            job_messages = [JobMessage(job_id=job_id, message_id=message_id) for message_id in message_ids]
            session.add_all(job_messages)
            await session.commit()

    @enforce_types
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
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
        with db_registry.session() as session:
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
    @trace_method
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
        print("request_config", request_config)

        messages = PydanticMessage.to_letta_messages_from_list(
            messages=messages,
            use_assistant_message=request_config["use_assistant_message"],
            assistant_message_tool_name=request_config["assistant_message_tool_name"],
            assistant_message_tool_kwarg=request_config["assistant_message_tool_kwarg"],
            reverse=not ascending,
        )

        if request_config["include_return_message_types"]:
            messages = [msg for msg in messages if msg.message_type in request_config["include_return_message_types"]]

        return messages

    @enforce_types
    @trace_method
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
        access: List[Literal["read", "write", "admin"]] = ["read"],
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

    async def _verify_job_access_async(
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
        result = await session.execute(job_query)
        job = result.scalar_one_or_none()
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
        with db_registry.session() as session:
            job = session.query(JobModel).filter(JobModel.id == run_id).first()
            request_config = job.request_config or LettaRequestConfig()
        return request_config

    @enforce_types
    async def record_ttft(self, job_id: str, ttft_ns: int, actor: PydanticUser) -> None:
        """Record time to first token for a run"""
        try:
            async with db_registry.async_session() as session:
                job = await self._verify_job_access_async(session=session, job_id=job_id, actor=actor, access=["write"])
                job.ttft_ns = ttft_ns
                await job.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
                await session.commit()
        except Exception as e:
            logger.warning(f"Failed to record TTFT for job {job_id}: {e}")

    @enforce_types
    async def record_response_duration(self, job_id: str, total_duration_ns: int, actor: PydanticUser) -> None:
        """Record total response duration for a run"""
        try:
            async with db_registry.async_session() as session:
                job = await self._verify_job_access_async(session=session, job_id=job_id, actor=actor, access=["write"])
                job.total_duration_ns = total_duration_ns
                await job.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
                await session.commit()
        except Exception as e:
            logger.warning(f"Failed to record response duration for job {job_id}: {e}")

    @trace_method
    def _dispatch_callback_sync(self, callback_info: dict) -> dict:
        """
        POST a standard JSON payload to callback_url and return callback status.
        """
        payload = {
            "job_id": callback_info["job_id"],
            "status": callback_info["status"],
            "completed_at": callback_info["completed_at"].isoformat() if callback_info["completed_at"] else None,
            "metadata": callback_info["metadata"],
        }

        callback_sent_at = get_utc_time().replace(tzinfo=None)
        result = {"callback_sent_at": callback_sent_at}

        try:
            log_event("POST callback dispatched", payload)
            resp = post(callback_info["callback_url"], json=payload, timeout=5.0)
            log_event("POST callback finished")
            result["callback_status_code"] = resp.status_code
        except Exception as e:
            error_message = f"Failed to dispatch callback for job {callback_info['job_id']} to {callback_info['callback_url']}: {e!s}"
            logger.error(error_message)
            result["callback_error"] = error_message
            # Continue silently - callback failures should not affect job completion
        finally:
            return result

    @trace_method
    async def _dispatch_callback_async(self, callback_info: dict) -> dict:
        """
        POST a standard JSON payload to callback_url and return callback status asynchronously.
        """
        payload = {
            "job_id": callback_info["job_id"],
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
            error_message = f"Failed to dispatch callback for job {callback_info['job_id']} to {callback_info['callback_url']}: {e!s}"
            logger.error(error_message)
            result["callback_error"] = error_message
            # Continue silently - callback failures should not affect job completion
        finally:
            return result
