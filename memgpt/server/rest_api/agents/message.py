import asyncio
import uuid
from datetime import datetime
from enum import Enum
from functools import partial
from typing import List, Optional, Union

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from memgpt.models.chat_completion_response import UsageStatistics
from memgpt.server.rest_api.auth_token import get_current_user
from memgpt.server.rest_api.interface import QueuingInterface, StreamingServerInterface
from memgpt.server.rest_api.utils import sse_async_generator
from memgpt.server.server import SyncServer

router = APIRouter()


class MessageRoleType(str, Enum):
    user = "user"
    system = "system"


class UserMessageRequest(BaseModel):
    message: str = Field(..., description="The message content to be processed by the agent.")
    name: Optional[str] = Field(default=None, description="Name of the message request sender")
    role: MessageRoleType = Field(default=MessageRoleType.user, description="Role of the message sender (either 'user' or 'system')")
    stream_steps: bool = Field(
        default=False, description="Flag to determine if the response should be streamed. Set to True for streaming agent steps."
    )
    stream_tokens: bool = Field(
        default=False,
        description="Flag to determine if individual tokens should be streamed. Set to True for token streaming (requires stream = True).",
    )
    timestamp: Optional[datetime] = Field(
        None,
        description="Timestamp to tag the message with (in ISO format). If null, timestamp will be created server-side on receipt of message.",
    )
    stream: bool = Field(
        default=False,
        description="Legacy flag for old streaming API, will be deprecrated in the future.",
        deprecated=True,
    )

    # @validator("timestamp", pre=True, always=True)
    # def validate_timestamp(cls, value: Optional[datetime]) -> Optional[datetime]:
    #    if value is None:
    #        return value  # If the timestamp is None, just return None, implying default handling to set server-side

    #    if not isinstance(value, datetime):
    #        raise TypeError("Timestamp must be a datetime object with timezone information.")

    #    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
    #        raise ValueError("Timestamp must be timezone-aware.")

    #    # Convert timestamp to UTC if it's not already in UTC
    #    if value.tzinfo.utcoffset(value) != timezone.utc.utcoffset(value):
    #        value = value.astimezone(timezone.utc)

    #    return value


class UserMessageResponse(BaseModel):
    messages: List[dict] = Field(..., description="List of messages generated by the agent in response to the received message.")
    usage: UsageStatistics = Field(..., description="Usage statistics for the completion.")


class GetAgentMessagesRequest(BaseModel):
    start: int = Field(..., description="Message index to start on (reverse chronological).")
    count: int = Field(..., description="How many messages to retrieve.")


class GetAgentMessagesCursorRequest(BaseModel):
    before: Optional[uuid.UUID] = Field(..., description="Message before which to retrieve the returned messages.")
    limit: int = Field(..., description="Maximum number of messages to retrieve.")


class GetAgentMessagesResponse(BaseModel):
    messages: list = Field(..., description="List of message objects.")


async def send_message_to_agent(
    server: SyncServer,
    agent_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    message: str,
    stream_legacy: bool,  # legacy
    stream_steps: bool,
    stream_tokens: bool,
    chat_completion_mode: Optional[bool] = False,
) -> Union[StreamingResponse, UserMessageResponse]:
    """Split off into a separate function so that it can be imported in the /chat/completion proxy."""

    # handle the legacy mode streaming
    if stream_legacy:
        # NOTE: override
        stream_steps = True
        stream_tokens = False
        include_final_message = False

    if role == "user" or role is None:
        message_func = server.user_message
    elif role == "system":
        message_func = server.system_message
    else:
        raise HTTPException(status_code=500, detail=f"Bad role {role}")

    if not stream_steps and stream_tokens:
        raise HTTPException(status_code=400, detail="stream_steps must be 'true' if stream_tokens is 'true'")

    # For streaming response
    try:

        # Get the generator object off of the agent's streaming interface
        # This will be attached to the POST SSE request used under-the-hood
        memgpt_agent = server._get_or_load_agent(user_id=user_id, agent_id=agent_id)
        streaming_interface = memgpt_agent.interface
        if not isinstance(streaming_interface, StreamingServerInterface):
            raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

        # Enable token-streaming within the request if desired
        streaming_interface.streaming_mode = stream_tokens
        # "chatcompletion mode" does some remapping and ignores inner thoughts
        streaming_interface.streaming_chat_completion_mode = chat_completion_mode

        # NOTE: for legacy 'stream' flag
        streaming_interface.nonstreaming_legacy_mode = stream_legacy
        # streaming_interface.allow_assistant_message = stream
        # streaming_interface.function_call_legacy_mode = stream

        # Offload the synchronous message_func to a separate thread
        streaming_interface.stream_start()
        task = asyncio.create_task(asyncio.to_thread(message_func, user_id=user_id, agent_id=agent_id, message=message))

        if stream_steps:
            # return a stream
            return StreamingResponse(
                sse_async_generator(streaming_interface.get_generator(), finish_message=include_final_message),
                media_type="text/event-stream",
            )
        else:
            # buffer the stream, then return the list
            usage = await task
            generated_stream = []
            async for message in streaming_interface.get_generator():
                generated_stream.append(message)
                if "data" in message and message["data"] == "[DONE]":
                    break
            filtered_stream = [d for d in generated_stream if d not in ["[DONE_GEN]", "[DONE_STEP]", "[DONE]"]]
            return UserMessageResponse(messages=filtered_stream, usage=usage)

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{e}")


def setup_agents_message_router(server: SyncServer, interface: QueuingInterface, password: str):
    get_current_user_with_server = partial(partial(get_current_user, server), password)

    @router.get("/agents/{agent_id}/messages", tags=["agents"], response_model=GetAgentMessagesResponse)
    def get_agent_messages(
        agent_id: uuid.UUID,
        start: int = Query(..., description="Message index to start on (reverse chronological)."),
        count: int = Query(..., description="How many messages to retrieve."),
        user_id: uuid.UUID = Depends(get_current_user_with_server),
    ):
        """
        Retrieve the in-context messages of a specific agent. Paginated, provide start and count to iterate.
        """
        # Validate with the Pydantic model (optional)
        request = GetAgentMessagesRequest(agent_id=agent_id, start=start, count=count)
        # agent_id = uuid.UUID(request.agent_id) if request.agent_id else None

        interface.clear()
        messages = server.get_agent_messages(user_id=user_id, agent_id=agent_id, start=request.start, count=request.count)
        return GetAgentMessagesResponse(messages=messages)

    @router.get("/agents/{agent_id}/messages-cursor", tags=["agents"], response_model=GetAgentMessagesResponse)
    def get_agent_messages_cursor(
        agent_id: uuid.UUID,
        before: Optional[uuid.UUID] = Query(None, description="Message before which to retrieve the returned messages."),
        limit: int = Query(10, description="Maximum number of messages to retrieve."),
        user_id: uuid.UUID = Depends(get_current_user_with_server),
    ):
        """
        Retrieve the in-context messages of a specific agent. Paginated, provide start and count to iterate.
        """
        # Validate with the Pydantic model (optional)
        request = GetAgentMessagesCursorRequest(agent_id=agent_id, before=before, limit=limit)

        interface.clear()
        [_, messages] = server.get_agent_recall_cursor(
            user_id=user_id, agent_id=agent_id, before=request.before, limit=request.limit, reverse=True
        )
        # print("====> messages-cursor DEBUG")
        # for i, msg in enumerate(messages):
        # print(f"message {i+1}/{len(messages)}")
        # print(f"UTC created-at: {msg.created_at.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'}")
        # print(f"ISO format string: {msg['created_at']}")
        # print(msg)
        return GetAgentMessagesResponse(messages=messages)

    @router.post("/agents/{agent_id}/messages", tags=["agents"], response_model=UserMessageResponse)
    async def send_message(
        # background_tasks: BackgroundTasks,
        agent_id: uuid.UUID,
        request: UserMessageRequest = Body(...),
        user_id: uuid.UUID = Depends(get_current_user_with_server),
    ):
        """
        Process a user message and return the agent's response.

        This endpoint accepts a message from a user and processes it through the agent.
        It can optionally stream the response if 'stream' is set to True.
        """
        return await send_message_to_agent(
            server=server,
            agent_id=agent_id,
            user_id=user_id,
            role=request.role,
            message=request.message,
            stream_steps=request.stream_steps,
            stream_tokens=request.stream_tokens,
            # legacy
            stream_legacy=request.stream,
        )

    return router
