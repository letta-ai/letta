import json
import traceback
from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from marshmallow import ValidationError
from pydantic import Field
from sqlalchemy.exc import IntegrityError, OperationalError

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState, CreateAgent, UpdateAgent
from letta.schemas.block import Block, BlockUpdate
from letta.schemas.job import JobStatus, JobUpdate, LettaRequestConfig
from letta.schemas.letta_message import LettaMessageUnion, LettaMessageUpdateUnion
from letta.schemas.letta_request import LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.memory import ContextWindowOverview, CreateArchivalMemory, Memory
from letta.schemas.passage import Passage, PassageUpdate
from letta.schemas.run import Run
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.serialize_schemas.pydantic_agent_schema import AgentSchema
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

# These can be forward refs, but because Fastapi needs them at runtime the must be imported normally


router = APIRouter(prefix="/agents", tags=["agents"])

logger = get_logger(__name__)


@router.get("/", response_model=List[AgentState], operation_id="list_agents")
def list_agents(
    name: Optional[str] = Query(None, description="Name of the agent"),
    tags: Optional[List[str]] = Query(None, description="List of tags to filter agents by"),
    match_all_tags: bool = Query(
        False,
        description="If True, only returns agents that match ALL given tags. Otherwise, return agents that have ANY of the passed-in tags.",
    ),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    after: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(50, description="Limit for pagination"),
    query_text: Optional[str] = Query(None, description="Search agents by name"),
    project_id: Optional[str] = Query(None, description="Search agents by project ID"),
    template_id: Optional[str] = Query(None, description="Search agents by template ID"),
    base_template_id: Optional[str] = Query(None, description="Search agents by base template ID"),
    identity_id: Optional[str] = Query(None, description="Search agents by identity ID"),
    identifier_keys: Optional[List[str]] = Query(None, description="Search agents by identifier keys"),
    include_relationships: Optional[List[str]] = Query(
        None,
        description=(
            "Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. "
            "If not provided, all relationships are loaded by default. "
            "Using this can optimize performance by reducing unnecessary joins."
        ),
    ),
):
    """
    List all agents associated with a given user.

    This endpoint retrieves a list of all agents and their configurations
    associated with the specified user ID.
    """

    # Retrieve the actor (user) details
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    # Call list_agents directly without unnecessary dict handling
    return server.agent_manager.list_agents(
        actor=actor,
        name=name,
        before=before,
        after=after,
        limit=limit,
        query_text=query_text,
        tags=tags,
        match_all_tags=match_all_tags,
        project_id=project_id,
        template_id=template_id,
        base_template_id=base_template_id,
        identity_id=identity_id,
        identifier_keys=identifier_keys,
        include_relationships=include_relationships,
    )


@router.get("/{agent_id}/export", operation_id="export_agent_serialized", response_model=AgentSchema)
def export_agent_serialized(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
) -> AgentSchema:
    """
    Export the serialized JSON representation of an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        return server.agent_manager.serialize(agent_id=agent_id, actor=actor)
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Agent with id={agent_id} not found for user_id={actor.id}.")


@router.post("/import", response_model=AgentState, operation_id="import_agent_serialized")
async def import_agent_serialized(
    file: UploadFile = File(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    append_copy_suffix: bool = Query(True, description='If set to True, appends "_copy" to the end of the agent name.'),
    override_existing_tools: bool = Query(
        True,
        description="If set to True, existing tools can get their source code overwritten by the uploaded tool definitions. Note that Letta core tools can never be updated externally.",
    ),
    project_id: Optional[str] = Query(None, description="The project ID to associate the uploaded agent with."),
):
    """
    Import a serialized agent file and recreate the agent in the system.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        serialized_data = await file.read()
        agent_json = json.loads(serialized_data)

        # Validate the JSON against AgentSchema before passing it to deserialize
        agent_schema = AgentSchema.model_validate(agent_json)

        new_agent = server.agent_manager.deserialize(
            serialized_agent=agent_schema,  # Ensure we're passing a validated AgentSchema
            actor=actor,
            append_copy_suffix=append_copy_suffix,
            override_existing_tools=override_existing_tools,
            project_id=project_id,
        )
        return new_agent

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Corrupted agent file format.")

    except ValidationError as e:
        raise HTTPException(status_code=422, detail=f"Invalid agent schema: {e.errors()}")

    except IntegrityError as e:
        raise HTTPException(status_code=409, detail=f"Database integrity error: {str(e)}")

    except OperationalError as e:
        raise HTTPException(status_code=503, detail=f"Database connection error. Please try again later: {str(e)}")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while uploading the agent: {str(e)}")


@router.get("/{agent_id}/context", response_model=ContextWindowOverview, operation_id="retrieve_agent_context_window")
def retrieve_agent_context_window(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the context window of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.get_agent_context_window(agent_id=agent_id, actor=actor)


class CreateAgentRequest(CreateAgent):
    """
    CreateAgent model specifically for POST request body, excluding user_id which comes from headers
    """

    # Override the user_id field to exclude it from the request body validation
    actor_id: Optional[str] = Field(None, exclude=True)


@router.post("/", response_model=AgentState, operation_id="create_agent")
def create_agent(
    agent: CreateAgentRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
    x_project: Optional[str] = Header(None, alias="X-Project"),  # Only handled by next js middleware
):
    """
    Create a new agent with the specified configuration.
    """
    try:
        actor = server.user_manager.get_user_or_default(user_id=actor_id)
        return server.create_agent(agent, actor=actor)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{agent_id}", response_model=AgentState, operation_id="modify_agent")
def modify_agent(
    agent_id: str,
    update_agent: UpdateAgent = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Update an existing agent"""
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.update_agent(agent_id=agent_id, agent_update=update_agent, actor=actor)


@router.get("/{agent_id}/tools", response_model=List[Tool], operation_id="list_agent_tools")
def list_agent_tools(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Get tools from an existing agent"""
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.list_attached_tools(agent_id=agent_id, actor=actor)


@router.patch("/{agent_id}/tools/attach/{tool_id}", response_model=AgentState, operation_id="attach_tool")
def attach_tool(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Attach a tool to an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.attach_tool(agent_id=agent_id, tool_id=tool_id, actor=actor)


@router.patch("/{agent_id}/tools/detach/{tool_id}", response_model=AgentState, operation_id="detach_tool")
def detach_tool(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Detach a tool from an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.detach_tool(agent_id=agent_id, tool_id=tool_id, actor=actor)


@router.patch("/{agent_id}/sources/attach/{source_id}", response_model=AgentState, operation_id="attach_source_to_agent")
def attach_source(
    agent_id: str,
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Attach a source to an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.attach_source(agent_id=agent_id, source_id=source_id, actor=actor)


@router.patch("/{agent_id}/sources/detach/{source_id}", response_model=AgentState, operation_id="detach_source_from_agent")
def detach_source(
    agent_id: str,
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Detach a source from an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.detach_source(agent_id=agent_id, source_id=source_id, actor=actor)


@router.get("/{agent_id}", response_model=AgentState, operation_id="retrieve_agent")
def retrieve_agent(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the state of the agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        return server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{agent_id}", response_model=None, operation_id="delete_agent")
def delete_agent(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    try:
        server.agent_manager.delete_agent(agent_id=agent_id, actor=actor)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Agent id={agent_id} successfully deleted"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Agent agent_id={agent_id} not found for user_id={actor.id}.")


@router.get("/{agent_id}/sources", response_model=List[Source], operation_id="list_agent_sources")
def list_agent_sources(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the sources associated with an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.list_attached_sources(agent_id=agent_id, actor=actor)


# TODO: remove? can also get with agent blocks
@router.get("/{agent_id}/core-memory", response_model=Memory, operation_id="retrieve_agent_memory")
def retrieve_agent_memory(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memory state of a specific agent.
    This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.get_agent_memory(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/core-memory/blocks/{block_label}", response_model=Block, operation_id="retrieve_core_memory_block")
def retrieve_block(
    agent_id: str,
    block_label: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve a core memory block from an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    try:
        return server.agent_manager.get_block_with_label(agent_id=agent_id, block_label=block_label, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{agent_id}/core-memory/blocks", response_model=List[Block], operation_id="list_core_memory_blocks")
def list_blocks(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the core memory blocks of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    try:
        agent = server.agent_manager.get_agent_by_id(agent_id, actor=actor)
        return agent.memory.blocks
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{agent_id}/core-memory/blocks/{block_label}", response_model=Block, operation_id="modify_core_memory_block")
def modify_block(
    agent_id: str,
    block_label: str,
    block_update: BlockUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Updates a core memory block of an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    block = server.agent_manager.get_block_with_label(agent_id=agent_id, block_label=block_label, actor=actor)
    block = server.block_manager.update_block(block.id, block_update=block_update, actor=actor)

    # This should also trigger a system prompt change in the agent
    server.agent_manager.rebuild_system_prompt(agent_id=agent_id, actor=actor, force=True, update_timestamp=False)

    return block


@router.patch("/{agent_id}/core-memory/blocks/attach/{block_id}", response_model=AgentState, operation_id="attach_core_memory_block")
def attach_block(
    agent_id: str,
    block_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Attach a core memoryblock to an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.attach_block(agent_id=agent_id, block_id=block_id, actor=actor)


@router.patch("/{agent_id}/core-memory/blocks/detach/{block_id}", response_model=AgentState, operation_id="detach_core_memory_block")
def detach_block(
    agent_id: str,
    block_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Detach a core memory block from an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.detach_block(agent_id=agent_id, block_id=block_id, actor=actor)


@router.get("/{agent_id}/archival-memory", response_model=List[Passage], operation_id="list_passages")
def list_passages(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    after: Optional[int] = Query(None, description="Unique ID of the memory to start the query range at."),
    before: Optional[int] = Query(None, description="Unique ID of the memory to end the query range at."),
    limit: Optional[int] = Query(None, description="How many results to include in the response."),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memories in an agent's archival memory store (paginated query).
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.get_agent_archival(
        user_id=actor.id,
        agent_id=agent_id,
        after=after,
        before=before,
        limit=limit,
    )


@router.post("/{agent_id}/archival-memory", response_model=List[Passage], operation_id="create_passage")
def create_passage(
    agent_id: str,
    request: CreateArchivalMemory = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Insert a memory into an agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.insert_archival_memory(agent_id=agent_id, memory_contents=request.text, actor=actor)


@router.patch("/{agent_id}/archival-memory/{memory_id}", response_model=List[Passage], operation_id="modify_passage")
def modify_passage(
    agent_id: str,
    memory_id: str,
    passage: PassageUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Modify a memory in the agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.modify_archival_memory(agent_id=agent_id, memory_id=memory_id, passage=passage, actor=actor)


# TODO(ethan): query or path parameter for memory_id?
# @router.delete("/{agent_id}/archival")
@router.delete("/{agent_id}/archival-memory/{memory_id}", response_model=None, operation_id="delete_passage")
def delete_passage(
    agent_id: str,
    memory_id: str,
    # memory_id: str = Query(..., description="Unique ID of the memory to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a memory from an agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    server.delete_archival_memory(memory_id=memory_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Memory id={memory_id} successfully deleted"})


AgentMessagesResponse = Annotated[
    List[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get("/{agent_id}/messages", response_model=AgentMessagesResponse, operation_id="list_messages")
def list_messages(
    agent_id: str,
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

    return server.get_agent_recall(
        user_id=actor.id,
        agent_id=agent_id,
        after=after,
        before=before,
        limit=limit,
        reverse=True,
        return_message_object=False,
        use_assistant_message=use_assistant_message,
        assistant_message_tool_name=assistant_message_tool_name,
        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
    )


@router.patch("/{agent_id}/messages/{message_id}", response_model=LettaMessageUnion, operation_id="modify_message")
def modify_message(
    agent_id: str,
    message_id: str,
    request: LettaMessageUpdateUnion = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the details of a message associated with an agent.
    """
    # TODO: support modifying tool calls/returns
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.message_manager.update_message_by_letta_message(message_id=message_id, letta_message_update=request, actor=actor)


@router.post(
    "/{agent_id}/messages",
    response_model=LettaResponse,
    operation_id="send_message",
)
async def send_message(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    result = await server.send_message_to_agent(
        agent_id=agent_id,
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
    "/{agent_id}/messages/stream",
    response_model=None,
    operation_id="create_agent_message_stream",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def send_message_streaming(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaStreamingRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    result = await server.send_message_to_agent(
        agent_id=agent_id,
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


async def process_message_background(
    job_id: str,
    server: SyncServer,
    actor: User,
    agent_id: str,
    messages: list,
    use_assistant_message: bool,
    assistant_message_tool_name: str,
    assistant_message_tool_kwarg: str,
) -> None:
    """Background task to process the message and update job status."""
    try:
        # TODO(matt) we should probably make this stream_steps and log each step as it progresses, so the job update GET can see the total steps so far + partial usage?
        result = await server.send_message_to_agent(
            agent_id=agent_id,
            actor=actor,
            messages=messages,
            stream_steps=False,  # NOTE(matt)
            stream_tokens=False,
            use_assistant_message=use_assistant_message,
            assistant_message_tool_name=assistant_message_tool_name,
            assistant_message_tool_kwarg=assistant_message_tool_kwarg,
            metadata={"job_id": job_id},  # Pass job_id through metadata
        )

        # Update job status to completed
        job_update = JobUpdate(
            status=JobStatus.completed,
            completed_at=datetime.utcnow(),
            metadata={"result": result.model_dump()},  # Store the result in metadata
        )
        server.job_manager.update_job_by_id(job_id=job_id, job_update=job_update, actor=actor)

    except Exception as e:
        # Update job status to failed
        job_update = JobUpdate(
            status=JobStatus.failed,
            completed_at=datetime.utcnow(),
            metadata={"error": str(e)},
        )
        server.job_manager.update_job_by_id(job_id=job_id, job_update=job_update, actor=actor)
        raise


@router.post(
    "/{agent_id}/messages/async",
    response_model=Run,
    operation_id="create_agent_message_async",
)
async def send_message_async(
    agent_id: str,
    background_tasks: BackgroundTasks,
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Asynchronously process a user message and return a run object.
    The actual processing happens in the background, and the status can be checked using the run ID.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    # Create a new job
    run = Run(
        user_id=actor.id,
        status=JobStatus.created,
        metadata={
            "job_type": "send_message_async",
            "agent_id": agent_id,
        },
        request_config=LettaRequestConfig(
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
        ),
    )
    run = server.job_manager.create_job(pydantic_job=run, actor=actor)

    # Add the background task
    background_tasks.add_task(
        process_message_background,
        job_id=run.id,
        server=server,
        actor=actor,
        agent_id=agent_id,
        messages=request.messages,
        use_assistant_message=request.use_assistant_message,
        assistant_message_tool_name=request.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
    )

    return run


@router.patch("/{agent_id}/reset-messages", response_model=AgentState, operation_id="reset_messages")
def reset_messages(
    agent_id: str,
    add_default_initial_messages: bool = Query(default=False, description="If true, adds the default initial messages after resetting."),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Resets the messages for an agent"""
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.agent_manager.reset_messages(agent_id=agent_id, actor=actor, add_default_initial_messages=add_default_initial_messages)
