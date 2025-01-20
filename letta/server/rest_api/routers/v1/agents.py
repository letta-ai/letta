from datetime import datetime
from typing import Annotated, List, Optional, Union

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import Field

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState, CreateAgent, UpdateAgent
from letta.schemas.block import Block, BlockUpdate, CreateBlock  # , BlockLabelUpdate, BlockLimitUpdate
from letta.schemas.job import JobStatus, JobUpdate
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.letta_request import LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.memory import ArchivalMemorySummary, ContextWindowOverview, CreateArchivalMemory, Memory, RecallMemorySummary
from letta.schemas.message import Message, MessageUpdate
from letta.schemas.passage import Passage
from letta.schemas.run import Run
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer

# These can be forward refs, but because Fastapi needs them at runtime the must be imported normally


router = APIRouter(prefix="/agents", tags=["agents"])

logger = get_logger(__name__)


# TODO: This should be paginated
@router.get("/", response_model=List[AgentState], operation_id="list_agents")
def list_agents(
    name: Optional[str] = Query(None, description="Name of the agent"),
    tags: Optional[List[str]] = Query(None, description="List of tags to filter agents by"),
    match_all_tags: bool = Query(
        False,
        description="If True, only returns agents that match ALL given tags. Otherwise, return agents that have ANY of the passed in tags.",
    ),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: Optional[int] = Query(None, description="Limit for pagination"),
    query_text: Optional[str] = Query(None, description="Search agents by name"),
):
    """
    List all agents associated with a given user.
    This endpoint retrieves a list of all agents and their configurations associated with the specified user ID.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # Use dictionary comprehension to build kwargs dynamically
    kwargs = {
        key: value
        for key, value in {
            "tags": tags,
            "match_all_tags": match_all_tags,
            "name": name,
            "query_text": query_text,
        }.items()
        if value is not None
    }

    # Call list_agents with the dynamic kwargs
    agents = server.agent_manager.list_agents(actor=actor, cursor=cursor, limit=limit, **kwargs)
    return agents


@router.get("/{agent_id}/context", response_model=ContextWindowOverview, operation_id="get_agent_context_window")
def get_agent_context_window(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the context window of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    return server.get_agent_context_window(agent_id=agent_id, actor=actor)


class CreateAgentRequest(CreateAgent):
    """
    CreateAgent model specifically for POST request body, excluding user_id which comes from headers
    """

    # Override the user_id field to exclude it from the request body validation
    user_id: Optional[str] = Field(None, exclude=True)


@router.post("/", response_model=AgentState, operation_id="create_agent")
def create_agent(
    agent: CreateAgentRequest = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new agent with the specified configuration.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.create_agent(agent, actor=actor)


@router.patch("/{agent_id}", response_model=AgentState, operation_id="update_agent")
def update_agent(
    agent_id: str,
    update_agent: UpdateAgent = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Update an exsiting agent"""
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.update_agent(agent_id=agent_id, agent_update=update_agent, actor=actor)


@router.get("/{agent_id}/tools", response_model=List[Tool], operation_id="get_tools_from_agent")
def get_tools_from_agent(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Get tools from an existing agent"""
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor).tools


@router.patch("/{agent_id}/add-tool/{tool_id}", response_model=AgentState, operation_id="add_tool_to_agent")
def add_tool_to_agent(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Add tools to an existing agent"""
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.attach_tool(agent_id=agent_id, tool_id=tool_id, actor=actor)


@router.patch("/{agent_id}/remove-tool/{tool_id}", response_model=AgentState, operation_id="remove_tool_from_agent")
def remove_tool_from_agent(
    agent_id: str,
    tool_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Add tools to an existing agent"""
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.detach_tool(agent_id=agent_id, tool_id=tool_id, actor=actor)


@router.patch("/{agent_id}/reset-messages", response_model=AgentState, operation_id="reset_messages")
def reset_messages(
    agent_id: str,
    add_default_initial_messages: bool = Query(default=False, description="If true, adds the default initial messages after resetting."),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """Resets the messages for an agent"""
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.reset_messages(agent_id=agent_id, actor=actor, add_default_initial_messages=add_default_initial_messages)


@router.get("/{agent_id}", response_model=AgentState, operation_id="get_agent")
def get_agent_state(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the state of the agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    try:
        return server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{agent_id}", response_model=None, operation_id="delete_agent")
def delete_agent(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    try:
        server.agent_manager.delete_agent(agent_id=agent_id, actor=actor)
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Agent id={agent_id} successfully deleted"})
    except NoResultFound:
        raise HTTPException(status_code=404, detail=f"Agent agent_id={agent_id} not found for user_id={actor.id}.")


@router.get("/{agent_id}/sources", response_model=List[Source], operation_id="get_agent_sources")
def get_agent_sources(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get the sources associated with an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.list_attached_sources(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/memory/messages", response_model=List[Message], operation_id="list_agent_in_context_messages")
def get_agent_in_context_messages(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the messages in the context of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.agent_manager.get_in_context_messages(agent_id=agent_id, actor=actor)


# TODO: remove? can also get with agent blocks
@router.get("/{agent_id}/memory", response_model=Memory, operation_id="get_agent_memory")
def get_agent_memory(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memory state of a specific agent.
    This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    return server.get_agent_memory(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/memory/block/{block_label}", response_model=Block, operation_id="get_agent_memory_block")
def get_agent_memory_block(
    agent_id: str,
    block_label: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve a memory block from an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    try:
        return server.agent_manager.get_block_with_label(agent_id=agent_id, block_label=block_label, actor=actor)
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{agent_id}/memory/block", response_model=List[Block], operation_id="get_agent_memory_blocks")
def get_agent_memory_blocks(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memory blocks of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    try:
        agent = server.agent_manager.get_agent_by_id(agent_id, actor=actor)
        return agent.memory.blocks
    except NoResultFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{agent_id}/memory/block", response_model=Memory, operation_id="add_agent_memory_block")
def add_agent_memory_block(
    agent_id: str,
    create_block: CreateBlock = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Creates a memory block and links it to the agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # Copied from POST /blocks
    # TODO: Should have block_manager accept only CreateBlock
    # TODO: This will be possible once we move ID creation to the ORM
    block_req = Block(**create_block.model_dump())
    block = server.block_manager.create_or_update_block(actor=actor, block=block_req)

    # Link the block to the agent
    agent = server.agent_manager.attach_block(agent_id=agent_id, block_id=block.id, actor=actor)
    return agent.memory


@router.delete("/{agent_id}/memory/block/{block_label}", response_model=Memory, operation_id="remove_agent_memory_block_by_label")
def remove_agent_memory_block(
    agent_id: str,
    # TODO should this be block_id, or the label?
    # I think label is OK since it's user-friendly + guaranteed to be unique within a Memory object
    block_label: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Removes a memory block from an agent by unlnking it. If the block is not linked to any other agent, it is deleted.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # Unlink the block from the agent
    agent = server.agent_manager.detach_block_with_label(agent_id=agent_id, block_label=block_label, actor=actor)

    return agent.memory


@router.patch("/{agent_id}/memory/block/{block_label}", response_model=Block, operation_id="update_agent_memory_block_by_label")
def update_agent_memory_block(
    agent_id: str,
    block_label: str,
    block_update: BlockUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Removes a memory block from an agent by unlnking it. If the block is not linked to any other agent, it is deleted.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    block = server.agent_manager.get_block_with_label(agent_id=agent_id, block_label=block_label, actor=actor)
    block = server.block_manager.update_block(block.id, block_update=block_update, actor=actor)

    # This should also trigger a system prompt change in the agent
    server.agent_manager.rebuild_system_prompt(agent_id=agent_id, actor=actor, force=True, update_timestamp=False)

    return block


@router.get("/{agent_id}/memory/recall", response_model=RecallMemorySummary, operation_id="get_agent_recall_memory_summary")
def get_agent_recall_memory_summary(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the summary of the recall memory of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    return server.get_recall_memory_summary(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/memory/archival", response_model=ArchivalMemorySummary, operation_id="get_agent_archival_memory_summary")
def get_agent_archival_memory_summary(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the summary of the archival memory of a specific agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.get_archival_memory_summary(agent_id=agent_id, actor=actor)


@router.get("/{agent_id}/archival", response_model=List[Passage], operation_id="list_agent_archival_memory")
def get_agent_archival_memory(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    after: Optional[int] = Query(None, description="Unique ID of the memory to start the query range at."),
    before: Optional[int] = Query(None, description="Unique ID of the memory to end the query range at."),
    limit: Optional[int] = Query(None, description="How many results to include in the response."),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve the memories in an agent's archival memory store (paginated query).
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # TODO need to add support for non-postgres here
    # chroma will throw:
    #     raise ValueError("Cannot run get_all_cursor with chroma")

    return server.get_agent_archival_cursor(
        user_id=actor.id,
        agent_id=agent_id,
        cursor=after,  # TODO: deleting before, after. is this expected?
        limit=limit,
    )


@router.post("/{agent_id}/archival", response_model=List[Passage], operation_id="create_agent_archival_memory")
def insert_agent_archival_memory(
    agent_id: str,
    request: CreateArchivalMemory = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Insert a memory into an agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    return server.insert_archival_memory(agent_id=agent_id, memory_contents=request.text, actor=actor)


# TODO(ethan): query or path parameter for memory_id?
# @router.delete("/{agent_id}/archival")
@router.delete("/{agent_id}/archival/{memory_id}", response_model=None, operation_id="delete_agent_archival_memory")
def delete_agent_archival_memory(
    agent_id: str,
    memory_id: str,
    # memory_id: str = Query(..., description="Unique ID of the memory to be deleted."),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a memory from an agent's archival memory store.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    server.delete_archival_memory(memory_id=memory_id, actor=actor)
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": f"Memory id={memory_id} successfully deleted"})


AgentMessagesResponse = Annotated[
    Union[List[Message], List[LettaMessageUnion]],
    Field(
        json_schema_extra={
            "anyOf": [
                {"type": "array", "items": {"$ref": "#/components/schemas/letta__schemas__message__Message"}},
                {"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}},
            ]
        }
    ),
]


@router.get("/{agent_id}/messages", response_model=AgentMessagesResponse, operation_id="list_agent_messages")
def get_agent_messages(
    agent_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    before: Optional[str] = Query(None, description="Message before which to retrieve the returned messages."),
    limit: int = Query(10, description="Maximum number of messages to retrieve."),
    msg_object: bool = Query(False, description="If true, returns Message objects. If false, return LettaMessage objects."),
    # Flags to support the use of AssistantMessage message types
    assistant_message_tool_name: str = Query(
        DEFAULT_MESSAGE_TOOL,
        description="The name of the designated message tool.",
    ),
    assistant_message_tool_kwarg: str = Query(
        DEFAULT_MESSAGE_TOOL_KWARG,
        description="The name of the message argument in the designated message tool.",
    ),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Retrieve message history for an agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    return server.get_agent_recall_cursor(
        user_id=actor.id,
        agent_id=agent_id,
        before=before,
        limit=limit,
        reverse=True,
        return_message_object=msg_object,
        assistant_message_tool_name=assistant_message_tool_name,
        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
    )


@router.patch("/{agent_id}/messages/{message_id}", response_model=Message, operation_id="update_agent_message")
def update_message(
    agent_id: str,
    message_id: str,
    request: MessageUpdate = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the details of a message associated with an agent.
    """
    # TODO: Get rid of agent_id here, it's not really relevant
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    return server.message_manager.update_message_by_id(message_id=message_id, message_update=request, actor=actor)


@router.post(
    "/{agent_id}/messages",
    response_model=LettaResponse,
    operation_id="create_agent_message",
)
async def send_message(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    request: LettaRequest = Body(...),
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)
    result = await server.send_message_to_agent(
        agent_id=agent_id,
        actor=actor,
        messages=request.messages,
        stream_steps=False,
        stream_tokens=False,
        # Support for AssistantMessage
        use_assistant_message=request.config.use_assistant_message,
        assistant_message_tool_name=request.config.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.config.assistant_message_tool_kwarg,
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
    user_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Process a user message and return the agent's response.
    This endpoint accepts a message from a user and processes it through the agent.
    It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
    """

    actor = server.user_manager.get_user_or_default(user_id=user_id)
    result = await server.send_message_to_agent(
        agent_id=agent_id,
        actor=actor,
        messages=request.messages,
        stream_steps=True,
        stream_tokens=request.stream_tokens,
        # Support for AssistantMessage
        use_assistant_message=request.config.use_assistant_message,
        assistant_message_tool_name=request.config.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.config.assistant_message_tool_kwarg,
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
            metadata_={"result": result.model_dump()},  # Store the result in metadata
        )
        server.job_manager.update_job_by_id(job_id=job_id, job_update=job_update, actor=actor)

        # Add job usage statistics
        server.job_manager.add_job_usage(job_id=job_id, usage=result.usage, actor=actor)

    except Exception as e:
        # Update job status to failed
        job_update = JobUpdate(
            status=JobStatus.failed,
            completed_at=datetime.utcnow(),
            metadata_={"error": str(e)},
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
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Asynchronously process a user message and return a run object.
    The actual processing happens in the background, and the status can be checked using the run ID.
    """
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    # Create a new job
    run = Run(
        user_id=actor.id,
        status=JobStatus.created,
        metadata_={
            "job_type": "send_message_async",
            "agent_id": agent_id,
        },
        request_config=request.config,
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
        use_assistant_message=request.config.use_assistant_message,
        assistant_message_tool_name=request.config.assistant_message_tool_name,
        assistant_message_tool_kwarg=request.config.assistant_message_tool_kwarg,
    )

    return run
