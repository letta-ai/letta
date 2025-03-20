import asyncio
from typing import TYPE_CHECKING, List, Optional, Union

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat.completion_create_params import CompletionCreateParams

from letta.agent import Agent
from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.server.rest_api.chat_completions_interface import ChatCompletionsStreamingInterface

# TODO this belongs in a controller!
from letta.server.rest_api.utils import get_letta_server, get_messages_from_completion_request, sse_async_generator

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/v1", tags=["chat_completions"])

logger = get_logger(__name__)


@router.post(
    "/{agent_id}/chat/completions",
    response_model=None,
    operation_id="create_chat_completions",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def create_chat_completions(
    agent_id: str,
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    # Validate and process fields
    messages = get_messages_from_completion_request(completion_request)
    input_message = messages[-1]

    # Process remaining fields
    if not completion_request["stream"]:
        raise HTTPException(status_code=400, detail="Must be streaming request: `stream` was set to `False` in the request.")

    actor = server.user_manager.get_user_or_default(user_id=user_id)

    letta_agent = server.load_agent(agent_id=agent_id, actor=actor)
    llm_config = letta_agent.agent_state.llm_config
    if llm_config.model_endpoint_type != "openai" or "inference.memgpt.ai" in llm_config.model_endpoint:
        error_msg = f"You can only use models with type 'openai' for chat completions. This agent {agent_id} has llm_config: \n{llm_config.model_dump_json(indent=4)}"
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    model = completion_request.get("model")
    if model != llm_config.model:
        warning_msg = f"The requested model {model} is different from the model specified in this agent's ({agent_id}) llm_config: \n{llm_config.model_dump_json(indent=4)}"
        logger.warning(f"Defaulting to {llm_config.model}...")
        logger.warning(warning_msg)

    logger.info(f"Received input message: {input_message}")

    return await send_message_to_agent_chat_completions(
        server=server,
        letta_agent=letta_agent,
        actor=actor,
        messages=[MessageCreate(role=input_message["role"], content=input_message["content"])],
    )


async def send_message_to_agent_chat_completions(
    server: "SyncServer",
    letta_agent: Agent,
    actor: User,
    messages: Union[List[Message], List[MessageCreate]],
    assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
    assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
) -> StreamingResponse:
    """Split off into a separate function so that it can be imported in the /chat/completion proxy."""
    # For streaming response
    try:
        # TODO: cleanup this logic
        llm_config = letta_agent.agent_state.llm_config

        # Create a new interface per request
        letta_agent.interface = ChatCompletionsStreamingInterface()
        streaming_interface = letta_agent.interface
        if not isinstance(streaming_interface, ChatCompletionsStreamingInterface):
            raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

        # Allow AssistantMessage is desired by client
        streaming_interface.assistant_message_tool_name = assistant_message_tool_name
        streaming_interface.assistant_message_tool_kwarg = assistant_message_tool_kwarg

        # Related to JSON buffer reader
        streaming_interface.inner_thoughts_in_kwargs = (
            llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
        )

        # Offload the synchronous message_func to a separate thread
        streaming_interface.stream_start()
        asyncio.create_task(
            asyncio.to_thread(
                server.send_messages,
                actor=actor,
                agent_id=letta_agent.agent_state.id,
                messages=messages,
                interface=streaming_interface,
                put_inner_thoughts_first=False,
            )
        )

        # return a stream
        return StreamingResponse(
            sse_async_generator(
                streaming_interface.get_generator(),
                usage_task=None,
                finish_message=True,
            ),
            media_type="text/event-stream",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{e}")
