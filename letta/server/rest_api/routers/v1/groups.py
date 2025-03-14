from typing import Annotated, List, Optional

from fastapi import APIRouter, Body, Depends, Header, Query
from pydantic import Field

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.group import Group, GroupCreate, ManagerType
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.letta_request import LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=Group, operation_id="create_group")
async def create_group(
    server: SyncServer = Depends(get_letta_server),
    request: GroupCreate = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a multi-agent group with a specified management pattern. When no
    management config is specified, this endpoint will use round robin for
    speaker selection.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.group_manager.create_group(request, actor=actor)


@router.get("/", response_model=List[Group], operation_id="list_groups")
def list_groups(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    manager_type: Optional[ManagerType] = Query(None, description="Search groups by manager type"),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(None, description="Limit for pagination"),
    project_id: Optional[str] = Query(None, description="Search groups by project id"),
):
    """
    Fetch all multi-agent groups matching query.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.group_manager.list_groups(
        project_id=project_id,
        manager_type=manager_type,
        before=before,
        after=after,
        limit=limit,
        actor=actor,
    )


@router.post("/", response_model=Group, operation_id="create_group")
def create_group(
    group: GroupCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: Optional[str] = Header(None, alias="X-Project"),  # Only handled by next js middleware
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.group_manager.create_group(group, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/", response_model=Group, operation_id="upsert_group")
def upsert_group(
    group: GroupCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: Optional[str] = Header(None, alias="X-Project"),  # Only handled by next js middleware
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.group_manager.create_group(group, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{group_id}", response_model=None, operation_id="delete_group")
def delete_group(
    group_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a multi-agent group.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    try:
        server.group_manager.delete_group(group_id=group_id, actor=actor)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Group id={group_id} successfully deleted"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Group id={group_id} not found for user_id={actor.id}.")


@router.post(
    "/{group_id}/messages",
    response_model=LettaResponse,
    operation_id="send_group_message",
)
async def send_group_message(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the group's response.
    This endpoint accepts a message from a user and processes it through through agents in the group based on the specified pattern
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    result = await server.send_group_message_to_agent(
        group_id=group_id,
        actor=actor,
        messages=request.messages,
        stream_steps=False,
        stream_tokens=False,
        # Support for AssistantMessage
        use_assistant_message=request.use_assistant_message,
        assistant_message_tool_name=request.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
    )
    return result


@router.post(
    "/{group_id}/messages/stream",
    response_model=None,
    operation_id="send_group_message_streaming",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def send_group_message_streaming(
    group_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaStreamingRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the group's responses.
    This endpoint accepts a message from a user and processes it through agents in the group based on the specified pattern.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    result = await server.send_group_message_to_agent(
        group_id=group_id,
        actor=actor,
        messages=request.messages,
        stream_steps=True,
        stream_tokens=request.stream_tokens,
        # Support for AssistantMessage
        use_assistant_message=request.use_assistant_message,
        assistant_message_tool_name=request.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
    )
    return result


GroupMessagesResponse = Annotated[
    List[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get("/{group_id}/messages", response_model=GroupMessagesResponse, operation_id="list_group_messages")
def list_group_messages(
    group_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    after: Optional[str] = Query(None, description="Message after which to retrieve the returned messages."),
    before: Optional[str] = Query(None, description="Message before which to retrieve the returned messages."),
    limit: int = Query(10, description="Maximum number of messages to retrieve."),
    use_assistant_message: bool = Query(True, description="Whether to use assistant messages"),
    assistant_message_tool_name: str = Query(DEFAULT_MESSAGE_TOOL, description="The name of the designated message tool."),
    assistant_message_tool_kwarg: str = Query(DEFAULT_MESSAGE_TOOL_KWARG, description="The name of the message argument."),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve message history for an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.group_manager.list_group_messages(
        group_id=group_id,
        before=before,
        after=after,
        limit=limit,
        actor=actor,
        use_assistant_message=use_assistant_message,
        assistant_message_tool_name=assistant_message_tool_name,
        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
    )


'''
@router.patch("/{group_id}/reset-messages", response_model=None, operation_id="reset_group_messages")
def reset_group_messages(
    group_id: str,
    add_default_initial_messages: bool = Query(default=False, description="If true, adds the default initial messages after resetting."),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Resets the messages for all agents that are part of the multi-agent group.
    TODO: only delete group messages not all messages!
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    group = server.group_manager.retrieve_group(group_id=group_id, actor=actor)
    agent_ids = group.agent_ids
    if group.manager_agent_id:
        agent_ids.append(group.manager_agent_id)
    for agent_id in agent_ids:
        server.agent_manager.reset_messages(
            agent_id=agent_id,
            actor=actor,
            add_default_initial_messages=add_default_initial_messages,
        )
'''
