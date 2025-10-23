from typing import TYPE_CHECKING, Optional

from fastapi import Header
from pydantic import BaseModel

if TYPE_CHECKING:
    from letta.server.server import SyncServer


class ExperimentalParams(BaseModel):
    """Experimental parameters used across REST API endpoints."""

    message_async: Optional[bool] = None
    letta_v1_agent: Optional[bool] = None


class HeaderParams(BaseModel):
    """Common header parameters used across REST API endpoints."""

    actor_id: Optional[str] = None
    user_agent: Optional[str] = None
    project_id: Optional[str] = None
    sdk_version: Optional[str] = None
    experimental_params: Optional[ExperimentalParams] = None


def get_headers(
    actor_id: Optional[str] = Header(None, alias="user_id"),
    user_agent: Optional[str] = Header(None, alias="User-Agent"),
    project_id: Optional[str] = Header(None, alias="X-Project-Id"),
    sdk_version: Optional[str] = Header(None, alias="X-Stainless-Package-Version"),
    message_async: Optional[str] = Header(None, alias="X-Experimental-Message-Async"),
    letta_v1_agent: Optional[str] = Header(None, alias="X-Experimental-Letta-V1-Agent"),
) -> HeaderParams:
    """Dependency injection function to extract common headers from requests."""
    return HeaderParams(
        actor_id=actor_id,
        user_agent=user_agent,
        project_id=project_id,
        sdk_version=sdk_version,
        experimental_params=ExperimentalParams(
            message_async=(message_async == "true") if message_async else None,
            letta_v1_agent=(letta_v1_agent == "true") if letta_v1_agent else None,
        ),
    )


# TODO: why does this double up the interface?
async def get_letta_server() -> "SyncServer":
    # Check if a global server is already instantiated
    from letta.server.rest_api.app import server

    # assert isinstance(server, SyncServer)
    return server
