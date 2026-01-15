from datetime import timedelta
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import Field
from starlette.responses import StreamingResponse

from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import LettaExpiredError, LettaInvalidArgumentError, NoActiveRunsToCancelError
from letta.log import get_logger
from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.conversation import Conversation, CreateConversation
from letta.schemas.enums import RunStatus
from letta.schemas.letta_message import LettaMessageUnion
from letta.schemas.letta_request import LettaStreamingRequest, RetrieveStreamRequest
from letta.schemas.letta_response import LettaResponse, LettaStreamingResponse
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.redis_stream_manager import redis_sse_stream_generator
from letta.server.rest_api.streaming_response import (
    StreamingResponseWithStatusCode,
    add_keepalive_to_stream,
    cancellation_aware_stream_wrapper,
)
from letta.server.server import SyncServer
from letta.services.conversation_manager import ConversationManager
from letta.services.lettuce import LettuceClient
from letta.services.run_manager import RunManager
from letta.services.streaming_service import StreamingService
from letta.settings import settings
from letta.validators import ConversationId

router = APIRouter(prefix="/conversations", tags=["conversations"])

logger = get_logger(__name__)

# Instantiate manager
conversation_manager = ConversationManager()


@router.post("/", response_model=Conversation, operation_id="create_conversation")
async def create_conversation(
    agent_id: str = Query(..., description="The agent ID to create a conversation for"),
    conversation_create: CreateConversation = Body(default_factory=CreateConversation),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Create a new conversation for an agent."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.create_conversation(agent_id=agent_id, conversation_create=conversation_create, actor=actor,)


@router.get("/", response_model=List[Conversation], operation_id="list_conversations")
async def list_conversations(
    agent_id: str = Query(..., description="The agent ID to list conversations for"),
    limit: int = Query(50, description="Maximum number of conversations to return"),
    after: Optional[str] = Query(None, description="Cursor for pagination (conversation ID)"),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """List all conversations for an agent."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.list_conversations(agent_id=agent_id, actor=actor, limit=limit, after=after,)


@router.get("/{conversation_id}", response_model=Conversation, operation_id="retrieve_conversation")
async def retrieve_conversation(
    conversation_id: ConversationId, server: SyncServer = Depends(get_letta_server), headers: HeaderParams = Depends(get_headers),
):
    """Retrieve a specific conversation."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.get_conversation_by_id(conversation_id=conversation_id, actor=actor,)


ConversationMessagesResponse = Annotated[
    List[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get(
    "/{conversation_id}/messages", response_model=ConversationMessagesResponse, operation_id="list_conversation_messages",
)
async def list_conversation_messages(
    conversation_id: ConversationId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    before: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order"
    ),
    after: Optional[str] = Query(
        None, description="Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order"
    ),
    limit: Optional[int] = Query(100, description="Maximum number of messages to return"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at"] = Query("created_at", description="Field to sort by"),
    group_id: Optional[str] = Query(None, description="Group ID to filter messages by."),
    include_err: Optional[bool] = Query(
        None, description="Whether to include error messages and error statuses. For debugging purposes only."
    ),
):
    """
    List all messages in a conversation.

    Returns LettaMessage objects (UserMessage, AssistantMessage, etc.) for all
    messages in the conversation, with support for cursor-based pagination.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.list_conversation_messages(
        conversation_id=conversation_id,
        actor=actor,
        limit=limit,
        before=before,
        after=after,
        reverse=(order == "desc"),
        group_id=group_id,
        include_err=include_err,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=LettaStreamingResponse,
    operation_id="send_conversation_message",
    responses={
        200: {"description": "Successful response", "content": {"text/event-stream": {"description": "Server-Sent Events stream"},},}
    },
)
async def send_conversation_message(
    conversation_id: ConversationId,
    request: LettaStreamingRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
) -> StreamingResponse | LettaResponse:
    """
    Send a message to a conversation and get a streaming response.

    This endpoint sends a message to an existing conversation and streams
    the agent's response back.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Get the conversation to find the agent_id
    conversation = await conversation_manager.get_conversation_by_id(conversation_id=conversation_id, actor=actor,)

    # Force streaming mode for this endpoint
    request.streaming = True

    # Use streaming service
    streaming_service = StreamingService(server)
    run, result = await streaming_service.create_agent_stream(
        agent_id=conversation.agent_id, actor=actor, request=request, run_type="send_conversation_message", conversation_id=conversation_id,
    )

    return result


@router.post(
    "/{conversation_id}/stream",
    response_model=None,
    operation_id="retrieve_conversation_stream",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {
                    "description": "Server-Sent Events stream",
                    "schema": {
                        "oneOf": [
                            {"$ref": "#/components/schemas/SystemMessage"},
                            {"$ref": "#/components/schemas/UserMessage"},
                            {"$ref": "#/components/schemas/ReasoningMessage"},
                            {"$ref": "#/components/schemas/HiddenReasoningMessage"},
                            {"$ref": "#/components/schemas/ToolCallMessage"},
                            {"$ref": "#/components/schemas/ToolReturnMessage"},
                            {"$ref": "#/components/schemas/AssistantMessage"},
                            {"$ref": "#/components/schemas/ApprovalRequestMessage"},
                            {"$ref": "#/components/schemas/ApprovalResponseMessage"},
                            {"$ref": "#/components/schemas/LettaPing"},
                            {"$ref": "#/components/schemas/LettaErrorMessage"},
                            {"$ref": "#/components/schemas/LettaStopReason"},
                            {"$ref": "#/components/schemas/LettaUsageStatistics"},
                        ]
                    },
                },
            },
        }
    },
)
async def retrieve_conversation_stream(
    conversation_id: ConversationId,
    request: RetrieveStreamRequest = Body(None),
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Resume the stream for the most recent active run in a conversation.

    This endpoint allows you to reconnect to an active background stream
    for a conversation, enabling recovery from network interruptions.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()

    # Find the most recent active run for this conversation
    active_runs = await runs_manager.list_runs(
        actor=actor, conversation_id=conversation_id, statuses=[RunStatus.created, RunStatus.running], limit=1, ascending=False,
    )

    if not active_runs:
        raise LettaInvalidArgumentError("No active runs found for this conversation.")

    run = active_runs[0]

    if not run.background:
        raise LettaInvalidArgumentError("Run was not created in background mode, so it cannot be retrieved.")

    if run.created_at < get_utc_time() - timedelta(hours=3):
        raise LettaExpiredError("Run was created more than 3 hours ago, and is now expired.")

    redis_client = await get_redis_client()

    if isinstance(redis_client, NoopAsyncRedisClient):
        raise HTTPException(
            status_code=503,
            detail=(
                "Background streaming requires Redis to be running. "
                "Please ensure Redis is properly configured. "
                f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}"
            ),
        )

    stream = redis_sse_stream_generator(
        redis_client=redis_client,
        run_id=run.id,
        starting_after=request.starting_after if request else None,
        poll_interval=request.poll_interval if request else None,
        batch_size=request.batch_size if request else None,
    )

    if settings.enable_cancellation_aware_streaming:
        stream = cancellation_aware_stream_wrapper(stream_generator=stream, run_manager=server.run_manager, run_id=run.id, actor=actor,)

    if request and request.include_pings and settings.enable_keepalive:
        stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval, run_id=run.id)

    return StreamingResponseWithStatusCode(stream, media_type="text/event-stream",)


@router.post("/{conversation_id}/messages/cancel", operation_id="cancel_conversation_message")
async def cancel_conversation_message(
    conversation_id: ConversationId, server: SyncServer = Depends(get_letta_server), headers: HeaderParams = Depends(get_headers),
) -> dict:
    """
    Cancel runs associated with a conversation.

    Note: To cancel active runs, Redis is required.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if not settings.track_agent_run:
        raise HTTPException(status_code=400, detail="Agent run tracking is disabled")

    # Verify conversation exists and get agent_id
    conversation = await conversation_manager.get_conversation_by_id(conversation_id=conversation_id, actor=actor,)

    # Find active runs for this conversation
    runs = await server.run_manager.list_runs(
        actor=actor, statuses=[RunStatus.created, RunStatus.running], ascending=False, conversation_id=conversation_id, limit=100,
    )
    run_ids = [run.id for run in runs]

    if not run_ids:
        raise NoActiveRunsToCancelError(conversation_id=conversation_id)

    results = {}
    for run_id in run_ids:
        try:
            run = await server.run_manager.get_run_by_id(run_id=run_id, actor=actor)
            if run.metadata and run.metadata.get("lettuce"):
                try:
                    lettuce_client = await LettuceClient.create()
                    await lettuce_client.cancel(run_id)
                except Exception as e:
                    logger.error(f"Failed to cancel Lettuce run {run_id}: {e}")

            await server.run_manager.cancel_run(actor=actor, agent_id=conversation.agent_id, run_id=run_id)
        except Exception as e:
            results[run_id] = "failed"
            logger.error(f"Failed to cancel run {run_id}: {str(e)}")
            continue
        results[run_id] = "cancelled"
        logger.info(f"Cancelled run {run_id}")

    return results
