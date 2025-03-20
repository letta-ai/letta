from typing import TYPE_CHECKING, Optional

import httpx
import openai
from fastapi import APIRouter, Body, Depends, Header
from fastapi.responses import StreamingResponse
from openai.types.chat.completion_create_params import CompletionCreateParams

from letta.agents.low_latency_agent import LowLatencyAgent
from letta.log import get_logger
from letta.schemas.openai.chat_completions import UserMessage
from letta.server.rest_api.utils import get_letta_server, get_messages_from_completion_request
from letta.settings import model_settings

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/voice", tags=["voice"])

logger = get_logger(__name__)


@router.post(
    "/{agent_id}/chat/completions",
    response_model=None,
    operation_id="create_voice_chat_completions",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def create_voice_chat_completions(
    agent_id: str,
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # Also parse the user's new input
    input_message = UserMessage(**get_messages_from_completion_request(completion_request)[-1])

    # Create OpenAI async client
    client = openai.AsyncClient(
        api_key=model_settings.openai_api_key,
        max_retries=0,
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(connect=15.0, read=30.0, write=15.0, pool=15.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=50,
                keepalive_expiry=120,
            ),
        ),
    )

    # Instantiate our LowLatencyAgent
    agent = LowLatencyAgent(
        agent_id=agent_id,
        openai_client=client,
        message_manager=server.message_manager,
        agent_manager=server.agent_manager,
        block_manager=server.block_manager,
        actor=actor,
        message_buffer_limit=10,
        message_buffer_min=4,
    )

    # Return the streaming generator
    return StreamingResponse(agent.step_stream(input_message=input_message), media_type="text/event-stream")
