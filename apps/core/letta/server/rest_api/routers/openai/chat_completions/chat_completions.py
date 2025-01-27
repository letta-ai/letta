import asyncio
from typing import TYPE_CHECKING, Iterable, List, Optional, Union, cast

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat import ChatCompletionMessageParam
from openai.types.chat.completion_create_params import CompletionCreateParams

from letta.agent import Agent
from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.schemas.message import MessageCreate
from letta.schemas.openai.chat_completion_response import Message
from letta.schemas.user import User
from letta.server.rest_api.chat_completions_interface import ChatCompletionsStreamingInterface

# TODO this belongs in a controller!
from letta.server.rest_api.utils import get_letta_server, sse_async_generator

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/v1", tags=["chat_completions"])

logger = get_logger(__name__)


@router.post(
    "/chat/completions",
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
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    # Validate and process fields
    try:
        messages = list(cast(Iterable[ChatCompletionMessageParam], completion_request["messages"]))
    except KeyError:
        # Handle the case where "messages" is not present in the request
        raise HTTPException(status_code=400, detail="The 'messages' field is missing in the request.")
    except TypeError:
        # Handle the case where "messages" is not iterable
        raise HTTPException(status_code=400, detail="The 'messages' field must be an iterable.")
    except Exception as e:
        # Catch any other unexpected errors and include the exception message
        raise HTTPException(status_code=400, detail=f"An error occurred while processing 'messages': {str(e)}")

    if messages[-1]["role"] != "user":
        logger.error(f"The last message does not have a `user` role: {messages}")
        raise HTTPException(status_code=400, detail="'messages[-1].role' must be a 'user'")

    input_message = messages[-1]
    if not isinstance(input_message["content"], str):
        logger.error(f"The input message does not have valid content: {input_message}")
        raise HTTPException(status_code=400, detail="'messages[-1].content' must be a 'string'")

    # Process remaining fields
    if not completion_request["stream"]:
        raise HTTPException(status_code=400, detail="Must be streaming request: `stream` was set to `False` in the request.")

    actor = server.user_manager.get_user_or_default(user_id=user_id)

    agent_id = str(completion_request.get("user", None))
    if agent_id is None:
        error_msg = "Must pass agent_id in the 'user' field"
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

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
