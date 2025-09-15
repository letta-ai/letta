from typing import Optional

from fastapi import Header
from pydantic import BaseModel


class HeaderParams(BaseModel):
    """Common header parameters used across REST API endpoints."""

    actor_id: Optional[str] = None
    user_agent: Optional[str] = None
    project_id: Optional[str] = None


def get_headers(
    actor_id: Optional[str] = Header(None, alias="user_id"),
    user_agent: Optional[str] = Header(None, alias="User-Agent"),
    project_id: Optional[str] = Header(None, alias="X-Project-Id"),
) -> HeaderParams:
    """Dependency injection function to extract common headers from requests."""
    return HeaderParams(
        actor_id=actor_id,
        user_agent=user_agent,
        project_id=project_id,
    )
