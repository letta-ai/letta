from typing import TYPE_CHECKING, Any, Dict

from fastapi import APIRouter, Body, Depends

from letta.log import get_logger
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/voice-beta", tags=["voice"])

logger = get_logger(__name__)


@router.post(
    "/{agent_id}/chat/completions",
    response_model=None,
    operation_id="create_voice_chat_completions",
    deprecated=True,
    responses={
        200: {
            "description": "Successful response",
            "content": {"text/event-stream": {}},
        },
        410: {
            "description": "Endpoint deprecated",
            "content": {"application/json": {"example": {"detail": "This endpoint has been deprecated"}}},
        },
    },
)
async def create_voice_chat_completions(
    agent_id: str,
    completion_request: Dict[str, Any] = Body(...),  # The validation is soft in case providers like VAPI send extra params
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    DEPRECATED: This voice-beta endpoint has been deprecated.

    The voice functionality has been integrated into the main chat completions endpoint.
    Please use the standard /v1/agents/{agent_id}/messages endpoint instead.

    This endpoint will be removed in a future version.
    """
    from fastapi import HTTPException

    logger.warning(f"Deprecated voice-beta endpoint called for agent {agent_id}")

    raise HTTPException(
        status_code=410,
        detail="The /voice-beta endpoint has been deprecated and is no longer available.",
    )
