from typing import Annotated, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import Field

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.orm.errors import NoResultFound
from letta.schemas.group import Group, GroupCreate, GroupUpdate, ManagerType
from letta.schemas.letta_message import LettaMessageUnion, LettaMessageUpdateUnion
from letta.schemas.letta_request import LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

router = APIRouter(prefix="/groups", tags=["groups"])


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
        actor=actor,
        project_id=project_id,
        manager_type=manager_type,
        before=before,
        after=after,
        limit=limit,
    )


@router.get("/count", response_model=int, operation_id="count_groups")
def count_groups(
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get the count of all groups associated with a given user.
    """
    return server.group_manager.size(actor=server.user_manager.get_user_or_default(user_id=actor_id))


@router.get("/{group_id}", response_model=Group, operation_id="retrieve_group")
async def retrieve_group(
    group_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Retrieve the group by id.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    try:
        return await server.group_manager.retrieve_group_async(group_id=group_id, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/", response_model=Group, operation_id="create_group")
def create_group(
    group: GroupCreate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="The project slug to associate with the group (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.group_manager.create_group(group, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{group_id}", response_model=Group, operation_id="modify_group")
async def modify_group(
    group_id: str,
    group: GroupUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    x_project: Optional[str] = Header(
        None, alias="X-Project", description="The project slug to associate with the group (cloud only)."
    ),  # Only handled by next js middleware
):
    """
    Create a new multi-agent group with the specified configuration.
    """
    try:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
        return await server.group_manager.modify_group_async(group_id=group_id, group_update=group, actor=actor)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{group_id}", response_model=None, operation_id="delete_group")
def delete_group(
    group_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
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
    group_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Process a user message and return the group's response.
    This endpoint accepts a message from a user and processes it through through agents in the group based on the specified pattern
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    result = await server.send_group_message_to_agent(
        group_id=group_id,
        actor=actor,
        input_messages=request.messages,
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
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Process a user message and return the group's responses.
    This endpoint accepts a message from a user and processes it through agents in the group based on the specified pattern.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    result = await server.send_group_message_to_agent(
        group_id=group_id,
        actor=actor,
        input_messages=request.messages,
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


@router.patch("/{group_id}/messages/{message_id}", response_model=LettaMessageUnion, operation_id="modify_group_message")
def modify_group_message(
    group_id: str,
    message_id: str,
    request: LettaMessageUpdateUnion = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Update the details of a message associated with an agent.
    """
    # TODO: support modifying tool calls/returns
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.message_manager.update_message_by_letta_message(message_id=message_id, letta_message_update=request, actor=actor)


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
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Retrieve message history for an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    group = server.group_manager.retrieve_group(group_id=group_id, actor=actor)
    if group.manager_agent_id:
        return server.get_agent_recall(
            user_id=actor.id,
            agent_id=group.manager_agent_id,
            after=after,
            before=before,
            limit=limit,
            group_id=group_id,
            reverse=True,
            return_message_object=False,
            use_assistant_message=use_assistant_message,
            assistant_message_tool_name=assistant_message_tool_name,
            assistant_message_tool_kwarg=assistant_message_tool_kwarg,
        )
    else:
        return server.group_manager.list_group_messages(
            group_id=group_id,
            after=after,
            before=before,
            limit=limit,
            actor=actor,
            use_assistant_message=use_assistant_message,
            assistant_message_tool_name=assistant_message_tool_name,
            assistant_message_tool_kwarg=assistant_message_tool_kwarg,
        )


@router.patch("/{group_id}/reset-messages", response_model=None, operation_id="reset_group_messages")
def reset_group_messages(
    group_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Delete the group messages for all agents that are part of the multi-agent group.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    server.group_manager.reset_messages(group_id=group_id, actor=actor)
