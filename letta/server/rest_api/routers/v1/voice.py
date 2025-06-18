from typing import TYPE_CHECKING, Any, Dict, Optional

import openai
from fastapi import APIRouter, Body, Depends, Header
from fastapi.responses import StreamingResponse

from letta.agents.voice_agent import VoiceAgent
from letta.log import get_logger
from letta.server.rest_api.utils import get_letta_server, get_user_message_from_chat_completions_request
from letta.settings import model_settings

if TYPE_CHECKING:
    from letta.server.server import SyncServer


router = APIRouter(prefix="/voice-beta", tags=["voice"])

logger = get_logger(__name__)


@router.post(
    "/{agent_id}/chat/completions",
    response_model=None,
    operation_id="create_voice_chat_completions",
    responses={
        200: {
            "description": "Successful response",
            "content": {"text/event-stream": {}},
        }
    },
)
async def create_voice_chat_completions(
    agent_id: str,
    completion_request: Dict[str, Any] = Body(...),  # The validation is soft in case providers like VAPI send extra params
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=user_id)

    # Create OpenAI async client
    client = openai.AsyncClient(
        api_key=model_settings.openai_api_key,
        max_retries=0,
        http_client=server.httpx_client,
    )

    # Instantiate our LowLatencyAgent
    agent = VoiceAgent(
        agent_id=agent_id,
        openai_client=client,
        message_manager=server.message_manager,
        agent_manager=server.agent_manager,
        block_manager=server.block_manager,
        passage_manager=server.passage_manager,
        actor=actor,
    )

    # Return the streaming generator
    return StreamingResponse(
        agent.step_stream(input_messages=get_user_message_from_chat_completions_request(completion_request)), media_type="text/event-stream"
    )
