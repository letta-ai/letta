from typing import TYPE_CHECKING, Optional

from fastapi import Header
from pydantic import BaseModel

if TYPE_CHECKING:
    from letta.server.server import SyncServer


class ExperimentalParams(BaseModel):
    """Experimental parameters used across REST API endpoints."""

    message_async: Optional[str] = None


class HeaderParams(BaseModel):
    """Common header parameters used across REST API endpoints."""

    actor_id: Optional[str] = None
    user_agent: Optional[str] = None
    project_id: Optional[str] = None
    experimental_params: Optional[ExperimentalParams] = None


def get_headers(
    actor_id: Optional[str] = Header(None, alias="user_id"),
    user_agent: Optional[str] = Header(None, alias="User-Agent"),
    project_id: Optional[str] = Header(None, alias="X-Project-Id"),
    message_async: Optional[str] = Header(None, alias="X-Experimental-Message-Async"),
) -> HeaderParams:
    """Dependency injection function to extract common headers from requests."""
    return HeaderParams(
        actor_id=actor_id,
        user_agent=user_agent,
        project_id=project_id,
        experimental_params=ExperimentalParams(
            message_async=message_async,
        ),
    )


# TODO: why does this double up the interface?
async def get_letta_server() -> "SyncServer":
    # Check if a global server is already instantiated
    from letta.server.rest_api.app import server

    # assert isinstance(server, SyncServer)
    return server
