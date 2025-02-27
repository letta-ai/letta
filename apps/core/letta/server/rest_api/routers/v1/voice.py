from typing import TYPE_CHECKING, Optional

import httpx
import openai
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat.completion_create_params import CompletionCreateParams

from letta.log import get_logger
from letta.low_latency_agent import LowLatencyAgent
from letta.server.rest_api.utils import get_letta_server, get_messages_from_completion_request
from letta.settings import model_settings

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/voice", tags=["voice"])

logger = get_logger(__name__)


@router.post(
    "/chat/completions",
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
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    agent_id = str(completion_request.get("user", None))
    if agent_id is None:
        raise HTTPException(status_code=400, detail="Must pass agent_id in the 'user' field")

    # agent_state = server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
    # if agent_state.llm_config.model_endpoint_type != "openai":
    #     raise HTTPException(status_code=400, detail="Only OpenAI models are supported by this endpoint.")

    # Also parse the user's new input
    input_message = get_messages_from_completion_request(completion_request)[-1]

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
        actor=actor,
    )

    # Return the streaming generator
    return StreamingResponse(agent.step(input_message=input_message), media_type="text/event-stream")
