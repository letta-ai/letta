from typing import List, Literal, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from letta.orm.errors import NoResultFound
from letta.orm.job import Job as JobModel
from letta.orm.sqlalchemy_base import AccessType
from letta.orm.step import Step as StepModel
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.step import Step as PydanticStep
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class StepManager:

    def __init__(self):
        from letta.server.server import db_context

        self.session_maker = db_context

    @enforce_types
    def log_step(
        self,
        actor: PydanticUser,
        provider_name: str,
        model: str,
        context_window_limit: int,
        usage: UsageStatistics,
        provider_id: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> PydanticStep:
        step_data = {
            "origin": None,
            "organization_id": actor.organization_id,
            "provider_id": provider_id,
            "provider_name": provider_name,
            "model": model,
            "context_window_limit": context_window_limit,
            "completion_tokens": usage.completion_tokens,
            "prompt_tokens": usage.prompt_tokens,
            "total_tokens": usage.total_tokens,
            "job_id": job_id,
            "tags": [],
            "tid": None,
        }
        with self.session_maker() as session:
            if job_id:
                self._verify_job_access(session, job_id, actor, access=["write"])
            new_step = StepModel(**step_data)
            new_step.create(session)
            return new_step.to_pydantic()

    @enforce_types
    def get_step(self, step_id: str) -> PydanticStep:
        with self.session_maker() as session:
            step = StepModel.read(db_session=session, identifier=step_id)
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
