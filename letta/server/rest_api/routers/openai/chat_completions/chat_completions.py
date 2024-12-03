import asyncio
import json
import warnings
from typing import TYPE_CHECKING, List, Optional, Union

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import FunctionCall, LettaMessage
from letta.schemas.message import MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    Choice,
    Message,
    UsageStatistics,
)

# TODO this belongs in a controller!
from letta.server.rest_api.routers.v1.agents import send_message_to_agent
from letta.server.rest_api.utils import get_letta_server, sse_async_generator
from letta.server.rest_api.voice_interface import VoiceStreamingServerInterface

if TYPE_CHECKING:
    pass

    from letta.server.server import SyncServer
    from letta.utils import get_utc_time

router = APIRouter(prefix="/v1/chat/completions", tags=["chat_completions"])


@router.post("/", response_model=ChatCompletionResponse)
async def create_chat_completion(
    completion_request: ChatCompletionRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Send a message to a Letta agent via a /chat/completions completion_request
    The bearer token will be used to identify the user.
    The 'user' field in the completion_request should be set to the agent ID.
    """
    actor = server.get_user_or_default(user_id=user_id)

    agent_id = completion_request.user
    if agent_id is None:
        raise HTTPException(status_code=400, detail="Must pass agent_id in the 'user' field")

    messages = completion_request.messages
    if messages is None:
        raise HTTPException(status_code=400, detail="'messages' field must not be empty")
    if len(messages) > 1:
        raise HTTPException(status_code=400, detail="'messages' field must be a list of length 1")
    if messages[0].role != "user":
        raise HTTPException(status_code=400, detail="'messages[0].role' must be a 'user'")

    input_message = completion_request.messages[0]
    if completion_request.stream:
        print("Starting streaming OpenAI proxy response")

        # TODO(charles) support multimodal parts
        assert isinstance(input_message.content, str)

        return await send_message_to_agent(
            server=server,
            agent_id=agent_id,
            user_id=actor.id,
            messages=[MessageCreate(role=input_message.role, text=input_message.content)],
            # Turn streaming ON
            stream_steps=True,
            stream_tokens=True,
            # Turn on ChatCompletion mode (eg remaps send_message to content)
            chat_completion_mode=True,
        )

    else:
        print("Starting non-streaming OpenAI proxy response")

        # TODO(charles) support multimodal parts
        assert isinstance(input_message.content, str)

        response_messages = await send_message_to_agent(
            server=server,
            agent_id=agent_id,
            user_id=actor.id,
            role=MessageRole(input_message.role),
            message=input_message.content,
            # Turn streaming OFF
            stream_steps=False,
            stream_tokens=False,
        )
        # print(response_messages)

        # Concatenate all send_message outputs together
        id = ""
        visible_message_str = ""
        created_at = None
        for letta_msg in response_messages.messages:
            assert isinstance(letta_msg, LettaMessage)
            if isinstance(letta_msg, FunctionCall):
                if letta_msg.name and letta_msg.name == "send_message":
                    try:
                        letta_function_call_args = json.loads(letta_msg.arguments)
                        visible_message_str += letta_function_call_args["message"]
                        id = letta_msg.id
                        created_at = letta_msg.date
                    except:
                        print(f"Failed to parse Letta message: {str(letta_msg)}")
                else:
                    print(f"Skipping function_call: {str(letta_msg)}")
            else:
                print(f"Skipping message: {str(letta_msg)}")

        response = ChatCompletionResponse(
            id=id,
            created=created_at if created_at else get_utc_time(),
            choices=[
                Choice(
                    finish_reason="stop",
                    index=0,
                    message=Message(
                        role="assistant",
                        content=visible_message_str,
                    ),
                )
            ],
            # TODO add real usage
            usage=UsageStatistics(
                completion_tokens=0,
                prompt_tokens=0,
                total_tokens=0,
            ),
        )
        return response


@router.post("/voice", response_model=ChatCompletionResponse)
async def create_chat_completion(
    completion_request: ChatCompletionRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Send a message to a Letta agent via a /chat/completions completion_request
    The bearer token will be used to identify the user.
    The 'user' field in the completion_request should be set to the agent ID.
    """
    if not completion_request.stream:
        raise HTTPException(status_code=400, detail="Must be streaming request: `stream` was set to `False` in the request.")

    actor = server.get_user_or_default(user_id=user_id)

    agent_id = completion_request.user
    if agent_id is None:
        raise HTTPException(status_code=400, detail="Must pass agent_id in the 'user' field")

    messages = completion_request.messages
    if messages is None:
        raise HTTPException(status_code=400, detail="'messages' field must not be empty")
    if len(messages) > 1:
        raise HTTPException(status_code=400, detail="'messages' field must be a list of length 1")
    if messages[0].role != "user":
        raise HTTPException(status_code=400, detail="'messages[0].role' must be a 'user'")

    input_message = completion_request.messages[0]

    assert isinstance(input_message.content, str)
    return await send_voice_message_to_agent(
        server=server,
        agent_id=agent_id,
        user_id=actor.id,
        messages=[MessageCreate(role=input_message.role, text=input_message.content)],
        # Turn streaming ON
        stream_steps=True,
        stream_tokens=True,
        # Turn on ChatCompletion mode (eg remaps send_message to content)
        chat_completion_mode=False,
    )


async def send_voice_message_to_agent(
    server: "SyncServer",
    agent_id: str,
    user_id: str,
    messages: Union[List[Message], List[MessageCreate]],
    stream_steps: bool,
    stream_tokens: bool,
    chat_completion_mode: bool = False,
    assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
    assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
) -> StreamingResponse:
    """Split off into a separate function so that it can be imported in the /chat/completion proxy."""

    # TODO: @charles is this the correct way to handle?
    include_final_message = True

    if not stream_steps and stream_tokens:
        raise HTTPException(status_code=400, detail="stream_steps must be 'true' if stream_tokens is 'true'")

    # For streaming response
    try:

        # TODO: move this logic into server.py

        # Get the generator object off of the agent's streaming interface
        # This will be attached to the POST SSE request used under-the-hood
        letta_agent = server.load_agent(agent_id=agent_id)

        # Disable token streaming if not OpenAI
        # TODO: cleanup this logic
        llm_config = letta_agent.agent_state.llm_config
        if stream_tokens and (llm_config.model_endpoint_type != "openai" or "inference.memgpt.ai" in llm_config.model_endpoint):
            warnings.warn(
                "Token streaming is only supported for models with type 'openai' or `inference.memgpt.ai` in the model_endpoint: agent has endpoint type {llm_config.model_endpoint_type} and {llm_config.model_endpoint}. Setting stream_tokens to False."
            )
            stream_tokens = False

        # Create a new interface per request
        letta_agent.interface = VoiceStreamingServerInterface()
        streaming_interface = letta_agent.interface
        if not isinstance(streaming_interface, VoiceStreamingServerInterface):
            raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

        # Enable token-streaming within the request if desired
        streaming_interface.streaming_mode = stream_tokens
        # "chatcompletion mode" does some remapping and ignores inner thoughts
        streaming_interface.streaming_chat_completion_mode = chat_completion_mode

        # streaming_interface.allow_assistant_message = stream
        # streaming_interface.function_call_legacy_mode = stream

        # Allow AssistantMessage is desired by client
        streaming_interface.assistant_message_tool_name = assistant_message_tool_name
        streaming_interface.assistant_message_tool_kwarg = assistant_message_tool_kwarg

        # Related to JSON buffer reader
        streaming_interface.inner_thoughts_in_kwargs = (
            llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
        )

        # Offload the synchronous message_func to a separate thread
        streaming_interface.stream_start()
        task = asyncio.create_task(
            asyncio.to_thread(
                server.send_messages,
                user_id=user_id,
                agent_id=agent_id,
                messages=messages,
                interface=streaming_interface,
            )
        )

        # return a stream
        return StreamingResponse(
            sse_async_generator(
                streaming_interface.get_generator(),
                usage_task=task,
                finish_message=include_final_message,
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
