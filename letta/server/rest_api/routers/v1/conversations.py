import asyncio
from datetime import timedelta
from typing import Annotated, Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from letta.agents.agent_loop import AgentLoop
from letta.agents.letta_agent_v3 import LettaAgentV3
from letta.constants import REDIS_RUN_ID_PREFIX
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import ConversationBusyError, LettaExpiredError, LettaInvalidArgumentError, NoActiveRunsToCancelError
from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.schemas.conversation import Conversation, CreateConversation, UpdateConversation
from letta.schemas.enums import RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import LettaMessageUnion, MessageType
from letta.schemas.letta_request import ConversationMessageRequest, LettaStreamingRequest, RetrieveStreamRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.provider_trace import BillingContext
from letta.schemas.run import Run as PydanticRun
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.redis_stream_manager import redis_sse_stream_generator
from letta.server.rest_api.streaming_response import (
    StreamingResponseWithStatusCode,
    add_keepalive_to_stream,
)
from letta.server.server import SyncServer
from letta.services.conversation_manager import ConversationManager
from letta.services.lettuce import LettuceClient
from letta.services.run_manager import RunManager
from letta.services.streaming_service import StreamingService
from letta.services.summarizer.summarizer_config import CompactionSettings
from letta.settings import settings
from letta.validators import ConversationId, ConversationIdOrDefault

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
    return await conversation_manager.create_conversation(
        agent_id=agent_id,
        conversation_create=conversation_create,
        actor=actor,
    )


@router.get("/", response_model=List[Conversation], operation_id="list_conversations")
async def list_conversations(
    agent_id: Optional[str] = Query(
        None, description="The agent ID to list conversations for (optional - returns all conversations if not provided)"
    ),
    limit: int = Query(50, description="Maximum number of conversations to return"),
    after: Optional[str] = Query(None, description="Cursor for pagination (conversation ID)"),
    summary_search: Optional[str] = Query(None, description="Search for text within conversation summaries"),
    order: Literal["asc", "desc"] = Query(
        "desc", description="Sort order for conversations. 'asc' for oldest first, 'desc' for newest first"
    ),
    order_by: Literal["created_at", "last_run_completion", "last_message_at"] = Query("created_at", description="Field to sort by"),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """List all conversations for an agent (or all conversations if agent_id not provided)."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    ascending = order == "asc"
    return await conversation_manager.list_conversations(
        agent_id=agent_id,
        actor=actor,
        limit=limit,
        after=after,
        summary_search=summary_search,
        ascending=ascending,
        sort_by=order_by,
    )


@router.get("/{conversation_id}", response_model=Conversation, operation_id="retrieve_conversation")
async def retrieve_conversation(
    conversation_id: ConversationId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Retrieve a specific conversation."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.get_conversation_by_id(
        conversation_id=conversation_id,
        actor=actor,
    )


@router.patch("/{conversation_id}", response_model=Conversation, operation_id="update_conversation")
async def update_conversation(
    conversation_id: ConversationId,
    conversation_update: UpdateConversation = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Update a conversation."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    return await conversation_manager.update_conversation(
        conversation_id=conversation_id,
        conversation_update=conversation_update,
        actor=actor,
    )


@router.post("/{conversation_id}/fork", response_model=Conversation, operation_id="fork_conversation")
async def fork_conversation(
    conversation_id: ConversationIdOrDefault,
    agent_id: Optional[str] = Query(None, description="Agent ID for agent-direct mode with 'default' conversation"),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Fork an existing conversation.

    Creates a new conversation that shares the same in-context messages as the source
    conversation, but with a newly compiled system message reflecting the latest memory
    block values. The forked conversation belongs to the same agent as the source.

    **Agent-direct mode**: Pass conversation_id="default" with agent_id query parameter
    to fork the agent's default (agent-direct) message history into a new conversation.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Agent-direct mode: conversation_id="default" + agent_id param (preferred)
    # OR conversation_id="agent-*" (backwards compat, deprecated)
    resolved_agent_id = None
    if conversation_id == "default" and agent_id:
        resolved_agent_id = agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        return await conversation_manager.fork_default_conversation(
            agent_id=resolved_agent_id,
            actor=actor,
            server=server,
        )

    return await conversation_manager.fork_conversation(
        conversation_id=conversation_id,
        actor=actor,
    )


@router.delete("/{conversation_id}", response_model=None, operation_id="delete_conversation")
async def delete_conversation(
    conversation_id: ConversationId,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Delete a conversation (soft delete).

    This marks the conversation as deleted but does not permanently remove it from the database.
    The conversation will no longer appear in list operations.
    Any isolated blocks associated with the conversation will be permanently deleted.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    await conversation_manager.delete_conversation(
        conversation_id=conversation_id,
        actor=actor,
    )


ConversationMessagesResponse = Annotated[
    List[LettaMessageUnion], Field(json_schema_extra={"type": "array", "items": {"$ref": "#/components/schemas/LettaMessageUnion"}})
]


@router.get(
    "/{conversation_id}/messages",
    response_model=ConversationMessagesResponse,
    operation_id="list_conversation_messages",
)
async def list_conversation_messages(
    conversation_id: ConversationIdOrDefault,
    agent_id: Optional[str] = Query(None, description="Agent ID for agent-direct mode with 'default' conversation"),
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
    include_return_message_types: Optional[List[MessageType]] = Query(None, description="Message types to include in response. When null, all message types are returned."),
):
    """
    List all messages in a conversation.

    Returns LettaMessage objects (UserMessage, AssistantMessage, etc.) for all
    messages in the conversation, with support for cursor-based pagination.

    **Agent-direct mode**: Pass conversation_id="default" with agent_id parameter
    to list messages from the agent's default conversation.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Agent-direct mode: conversation_id="default" + agent_id param (preferred)
    # OR conversation_id="agent-*" (backwards compat, deprecated)
    resolved_agent_id = None
    if conversation_id == "default" and agent_id:
        resolved_agent_id = agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        return await server.get_agent_recall_async(
            agent_id=resolved_agent_id,
            after=after,
            before=before,
            limit=limit,
            group_id=group_id,
            conversation_id="default",  # Filter to default conversation messages only
            reverse=(order == "desc"),
            return_message_object=False,
            include_err=include_err,
            include_return_message_types=include_return_message_types,
            actor=actor,
        )

    return await conversation_manager.list_conversation_messages(
        conversation_id=conversation_id,
        actor=actor,
        limit=limit,
        before=before,
        after=after,
        reverse=(order == "desc"),
        group_id=group_id,
        include_err=include_err,
        include_return_message_types=include_return_message_types,
    )


async def _send_agent_direct_message(
    agent_id: str,
    request: ConversationMessageRequest,
    server: SyncServer,
    actor,
    billing_context: "BillingContext | None" = None,
    openai_responses_websocket: bool = False,
) -> StreamingResponse | LettaResponse:
    """
    Handle agent-direct messaging with locking but without conversation features.

    This is used when the conversation_id in the URL is actually an agent ID,
    providing a unified endpoint while maintaining agent-level locking.
    """
    redis_client = await get_redis_client()

    # Streaming mode (default)
    if request.streaming:
        streaming_request = LettaStreamingRequest(
            messages=request.messages,
            streaming=True,
            stream_tokens=request.stream_tokens,
            include_pings=request.include_pings,
            background=request.background,
            max_steps=request.max_steps,
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
            include_return_message_types=request.include_return_message_types,
            override_model=request.override_model,
            client_tools=request.client_tools,
            client_skills=request.client_skills,
            override_system=request.override_system,
        )
        streaming_service = StreamingService(server)
        run, result = await streaming_service.create_agent_stream(
            agent_id=agent_id,
            actor=actor,
            request=streaming_request,
            run_type="send_message",
            conversation_id=None,
            should_lock=True,
            billing_context=billing_context,
            openai_responses_websocket=openai_responses_websocket,
        )
        return result

    # Non-streaming mode with locking
    agent = await server.agent_manager.get_agent_by_id_async(
        agent_id,
        actor,
        include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
    )

    # Handle model override if specified in the request
    if request.override_model:
        override_llm_config = await server.get_llm_config_from_handle_async(
            actor=actor,
            handle=request.override_model,
        )
        agent = agent.model_copy(update={"llm_config": override_llm_config})

    # Collect all otids from messages for request deduplication
    message_otids = [msg.otid for msg in request.messages if msg.otid]

    # Derive a request token from ALL message otids for deduplication
    from letta.services.streaming_service import derive_request_token, enrich_conversation_busy_error

    request_token = derive_request_token(message_otids)

    # Acquire lock using agent_id as lock key
    if not isinstance(redis_client, NoopAsyncRedisClient):
        try:
            await redis_client.acquire_conversation_lock(
                conversation_id=agent_id,
                token=request_token,
            )

        except ConversationBusyError as e:
            raise await enrich_conversation_busy_error(redis_client, e)

    try:
        # Create a run for execution tracking
        run = None
        if settings.track_agent_run:
            runs_manager = RunManager()
            run = await runs_manager.create_run(
                pydantic_run=PydanticRun(
                    agent_id=agent_id,
                    background=False,
                    metadata={
                        "run_type": "send_message",
                    },
                    request_config=LettaRequestConfig.from_letta_request(request),
                ),
                actor=actor,
            )

        # Set run_id in Redis for cancellation support
        await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

        # Store request_token -> run_id mapping for duplicate request recovery
        if request_token and run:
            await redis_client.set_otid_run_mapping(request_token, run.id)

        # Store each individual otid -> run_id mapping for client convenience
        if run:
            for otid in message_otids:
                await redis_client.set_otid_run_mapping(otid, run.id)

        agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
        return await agent_loop.step(
            request.messages,
            max_steps=request.max_steps,
            run_id=run.id if run else None,
            use_assistant_message=request.use_assistant_message,
            include_return_message_types=request.include_return_message_types,
            client_tools=request.client_tools,
            client_skills=request.client_skills,
            override_system=request.override_system,
            conversation_id=None,
            include_compaction_messages=request.include_compaction_messages,
            billing_context=billing_context,
        )
    finally:
        # Release lock
        await redis_client.release_conversation_lock(agent_id)


@router.post(
    "/{conversation_id}/messages",
    response_model=LettaResponse,
    operation_id="send_conversation_message",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream (default, when streaming=true)"},
                "application/json": {"description": "JSON response (when streaming=false)"},
            },
        }
    },
)
async def send_conversation_message(
    conversation_id: ConversationIdOrDefault,
    request: ConversationMessageRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
) -> StreamingResponse | LettaResponse:
    """
    Send a message to a conversation and get a response.

    This endpoint sends a message to an existing conversation.
    By default (streaming=true), returns a streaming response (Server-Sent Events).
    Set streaming=false to get a complete JSON response.

    **Agent-direct mode**: Pass conversation_id="default" with agent_id in request body
    to send messages to the agent's default conversation with locking.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if not request.messages or len(request.messages) == 0:
        raise HTTPException(status_code=422, detail="Messages must not be empty")

    # Agent-direct mode: conversation_id="default" + agent_id in body (preferred)
    # OR conversation_id="agent-*" (backwards compat, deprecated)
    resolved_agent_id = None
    if conversation_id == "default" and request.agent_id:
        resolved_agent_id = request.agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        # Agent-direct mode: use agent ID, enable locking, skip conversation features
        return await _send_agent_direct_message(
            agent_id=resolved_agent_id,
            request=request,
            server=server,
            actor=actor,
            billing_context=headers.billing_context,
            openai_responses_websocket=bool(headers.experimental_params and headers.experimental_params.openai_responses_websocket),
        )

    # Normal conversation mode
    conversation = await conversation_manager.get_conversation_by_id(
        conversation_id=conversation_id,
        actor=actor,
    )

    # Mark conversation message activity at request time
    conversation = await conversation_manager.update_conversation(
        conversation_id=conversation_id,
        conversation_update=UpdateConversation(last_message_at=get_utc_time()),
        actor=actor,
    )

    # Streaming mode (default)
    if request.streaming:
        # Convert to LettaStreamingRequest for StreamingService compatibility
        streaming_request = LettaStreamingRequest(
            messages=request.messages,
            streaming=True,
            stream_tokens=request.stream_tokens,
            include_pings=request.include_pings,
            background=request.background,
            max_steps=request.max_steps,
            use_assistant_message=request.use_assistant_message,
            assistant_message_tool_name=request.assistant_message_tool_name,
            assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
            include_return_message_types=request.include_return_message_types,
            override_model=request.override_model,
            client_tools=request.client_tools,
            client_skills=request.client_skills,
            override_system=request.override_system,
        )
        streaming_service = StreamingService(server)
        run, result = await streaming_service.create_agent_stream(
            agent_id=conversation.agent_id,
            actor=actor,
            request=streaming_request,
            run_type="send_conversation_message",
            conversation_id=conversation_id,
            billing_context=headers.billing_context,
            openai_responses_websocket=bool(headers.experimental_params and headers.experimental_params.openai_responses_websocket),
        )
        return result

    # Non-streaming mode
    agent = await server.agent_manager.get_agent_by_id_async(
        conversation.agent_id,
        actor,
        include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
    )

    # Apply conversation-level model override if set (lower priority than request override)
    if conversation.model and not request.override_model:
        conversation_llm_config = await server.get_llm_config_from_handle_async(
            actor=actor,
            handle=conversation.model,
            # Preserve the agent's context window (capped at the new model's max).
            # Without this, the context window resets to the model/global default.
            context_window_limit=agent.llm_config.context_window,
        )
        if conversation.model_settings is not None:
            update_params = conversation.model_settings._to_legacy_config_params()
            # Don't clobber max_tokens with the Pydantic default when the caller
            # didn't explicitly provide max_output_tokens.
            if "max_output_tokens" not in conversation.model_settings.model_fields_set:
                update_params.pop("max_tokens", None)
            conversation_llm_config = conversation_llm_config.model_copy(update=update_params)
        agent = agent.model_copy(update={"llm_config": conversation_llm_config})

    if request.override_model:
        override_llm_config = await server.get_llm_config_from_handle_async(
            actor=actor,
            handle=request.override_model,
        )
        agent = agent.model_copy(update={"llm_config": override_llm_config})

    # Create a run for execution tracking
    run = None
    if settings.track_agent_run:
        runs_manager = RunManager()
        run = await runs_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=conversation.agent_id,
                background=False,
                metadata={
                    "run_type": "send_conversation_message",
                },
                request_config=LettaRequestConfig.from_letta_request(request),
            ),
            actor=actor,
        )

    # Set run_id in Redis for cancellation support
    redis_client = await get_redis_client()
    await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{conversation.agent_id}", run.id if run else None)

    agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    return await agent_loop.step(
        request.messages,
        max_steps=request.max_steps,
        run_id=run.id if run else None,
        use_assistant_message=request.use_assistant_message,
        include_return_message_types=request.include_return_message_types,
        client_tools=request.client_tools,
        client_skills=request.client_skills,
        override_system=request.override_system,
        conversation_id=conversation_id,
        include_compaction_messages=request.include_compaction_messages,
        billing_context=headers.billing_context,
    )


@router.post(
    "/{conversation_id}/messages/preview-raw-payload",
    response_model=Dict[str, Any],
    operation_id="preview_conversation_model_request",
)
async def preview_conversation_model_request(
    conversation_id: ConversationIdOrDefault,
    request: ConversationMessageRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Inspect the raw LLM request payload for a conversation message without sending it.

    This endpoint processes the message through the same path as send_conversation_message
    (including conversation-scoped messages, isolated blocks, model overrides, and
    client tools/skills) but stops before the LLM call and returns the raw request
    payload. Useful for debugging and verifying what the LLM will actually see.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    if not request.messages or len(request.messages) == 0:
        raise HTTPException(status_code=422, detail="Messages must not be empty")

    # Agent-direct mode (same logic as send_conversation_message)
    resolved_agent_id = None
    if conversation_id == "default" and request.agent_id:
        resolved_agent_id = request.agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        # Agent-direct mode: load agent directly, no conversation features
        agent = await server.agent_manager.get_agent_by_id_async(
            resolved_agent_id,
            actor,
            include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
        )

        if request.override_model:
            override_llm_config = await server.get_llm_config_from_handle_async(actor=actor, handle=request.override_model)
            agent = agent.model_copy(update={"llm_config": override_llm_config})

        agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
        return await agent_loop.build_request(
            input_messages=request.messages,
            client_skills=request.client_skills,
            client_tools=request.client_tools,
            override_system=request.override_system,
        )

    # Normal conversation mode
    conversation = await conversation_manager.get_conversation_by_id(
        conversation_id=conversation_id,
        actor=actor,
    )

    agent = await server.agent_manager.get_agent_by_id_async(
        conversation.agent_id,
        actor,
        include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
    )

    # Apply conversation-level model override (same as send_conversation_message)
    if conversation.model and not request.override_model:
        conversation_llm_config = await server.get_llm_config_from_handle_async(
            actor=actor,
            handle=conversation.model,
            # Preserve the agent's context window (capped at the new model's max).
            # Without this, the context window resets to the model/global default.
            context_window_limit=agent.llm_config.context_window,
        )
        if conversation.model_settings is not None:
            update_params = conversation.model_settings._to_legacy_config_params()
            if "max_output_tokens" not in conversation.model_settings.model_fields_set:
                update_params.pop("max_tokens", None)
            conversation_llm_config = conversation_llm_config.model_copy(update=update_params)
        agent = agent.model_copy(update={"llm_config": conversation_llm_config})

    if request.override_model:
        override_llm_config = await server.get_llm_config_from_handle_async(
            actor=actor,
            handle=request.override_model,
        )
        agent = agent.model_copy(update={"llm_config": override_llm_config})

    agent_loop = AgentLoop.load(agent_state=agent, actor=actor)
    return await agent_loop.build_request(
        input_messages=request.messages,
        client_skills=request.client_skills,
        client_tools=request.client_tools,
        override_system=request.override_system,
        conversation_id=conversation_id,
    )


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
    conversation_id: ConversationIdOrDefault,
    request: RetrieveStreamRequest = Body(None),
    headers: HeaderParams = Depends(get_headers),
    server: SyncServer = Depends(get_letta_server),
):
    """
    Resume the stream for the most recent active run in a conversation.

    This endpoint allows you to reconnect to an active background stream
    for a conversation, enabling recovery from network interruptions.

    **Agent-direct mode**: Pass conversation_id=\"default\" with agent_id in request body
    to retrieve the stream for the agent's most recent active run.

    **Direct run access**: Pass run_id directly to skip run lookup entirely.
    Useful for recovery from duplicate request 409 errors.

    **OTID lookup**: Pass otid to look up the run_id from Redis.
    Useful when you have the otid from a 409 error response.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    runs_manager = RunManager()
    redis_client = await get_redis_client()

    # Check Redis availability early
    if isinstance(redis_client, NoopAsyncRedisClient):
        raise HTTPException(
            status_code=503,
            detail=(
                "Background streaming requires Redis to be running. "
                "Please ensure Redis is properly configured. "
                f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}"
            ),
        )

    run_id = None
    run = None

    # Priority 1: Direct run_id provided (bypasses all lookups)
    if request and request.run_id:
        run_id = request.run_id
        # Fetch run to check expiration
        run = await runs_manager.get_run_by_id(run_id=run_id, actor=actor)
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run {run_id} not found.",
            )

    # Priority 2: OTID provided (look up run_id from Redis)
    # Retry with backoff: the mapping may not be stored yet if the request
    # that created the run is still inside _create_run() (DB insert).
    elif request and request.otid:
        for _attempt in range(3):
            run_id = await redis_client.get_run_id_by_otid(request.otid)
            if run_id:
                break
            await asyncio.sleep(0.25 * (2**_attempt))  # 250ms, 500ms, 1s
        if not run_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No run found for otid={request.otid}. The run may have expired or never existed.",
            )
        # Fetch run to check expiration
        run = await runs_manager.get_run_by_id(run_id=run_id, actor=actor)
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run {run_id} (from otid={request.otid}) not found.",
            )

    # Priority 3: Fall back to active run lookup
    else:
        # Agent-direct mode: conversation_id="default" + agent_id in body (preferred)
        # OR conversation_id="agent-*" (backwards compat, deprecated)
        resolved_agent_id = None
        if conversation_id == "default" and request and request.agent_id:
            resolved_agent_id = request.agent_id
        elif conversation_id.startswith("agent-"):
            resolved_agent_id = conversation_id

        # Find the most recent active run
        if resolved_agent_id:
            # Agent-direct mode: find runs by agent_id
            active_runs = await runs_manager.list_runs(
                actor=actor,
                agent_id=resolved_agent_id,
                statuses=[RunStatus.created, RunStatus.running],
                limit=1,
                ascending=False,
            )
        else:
            # Normal mode: find runs by conversation_id
            active_runs = await runs_manager.list_runs(
                actor=actor,
                conversation_id=conversation_id,
                statuses=[RunStatus.created, RunStatus.running],
                limit=1,
                ascending=False,
            )

        if not active_runs:
            raise LettaInvalidArgumentError("No active runs found for this conversation.")

        run = active_runs[0]
        run_id = run.id

        # For active run lookup, require background mode
        if not run.background:
            raise LettaInvalidArgumentError("Run was not created in background mode, so it cannot be retrieved.")

    # Check expiration for all paths
    if run and run.created_at < get_utc_time() - timedelta(hours=3):
        raise LettaExpiredError("Run was created more than 3 hours ago, and is now expired.")

    stream = redis_sse_stream_generator(
        redis_client=redis_client,
        run_id=run_id,
        starting_after=request.starting_after if request else None,
        poll_interval=request.poll_interval if request else None,
        batch_size=request.batch_size if request else None,
    )

    if settings.enable_cancellation_aware_streaming:
        from letta.server.rest_api.streaming_response import cancellation_aware_stream_wrapper, get_cancellation_event_for_run

        stream = cancellation_aware_stream_wrapper(
            stream_generator=stream,
            run_manager=server.run_manager,
            run_id=run_id,
            actor=actor,
            cancellation_event=get_cancellation_event_for_run(run_id),
        )

    if request and request.include_pings and settings.enable_keepalive:
        stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval, run_id=run_id)

    return StreamingResponseWithStatusCode(
        stream,
        media_type="text/event-stream",
    )


@router.post("/{conversation_id}/cancel", operation_id="cancel_conversation")
async def cancel_conversation(
    conversation_id: ConversationIdOrDefault,
    agent_id: Optional[str] = Query(None, description="Agent ID for agent-direct mode with 'default' conversation"),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
) -> dict:
    """
    Cancel runs associated with a conversation.

    Note: To cancel active runs, Redis is required.

    **Agent-direct mode**: Pass conversation_id="default" with agent_id query parameter
    to cancel runs for the agent's default conversation.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    logger.info(
        "[Interrupt] Cancel request received for conversation=%s by actor=%s (org=%s)",
        conversation_id,
        actor.id,
        actor.organization_id,
    )

    if not settings.track_agent_run:
        raise HTTPException(status_code=400, detail="Agent run tracking is disabled")

    # Agent-direct mode: conversation_id="default" + agent_id param (preferred)
    # OR conversation_id="agent-*" (backwards compat, deprecated)
    resolved_agent_id = None
    if conversation_id == "default" and agent_id:
        resolved_agent_id = agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        # Agent-direct mode: use agent_id directly, skip conversation lookup
        # Find active runs for this agent (default conversation has conversation_id=None)
        runs = await server.run_manager.list_runs(
            actor=actor,
            agent_id=resolved_agent_id,
            statuses=[RunStatus.created, RunStatus.running],
            ascending=False,
            limit=100,
        )
    else:
        # Verify conversation exists and get agent_id
        conversation = await conversation_manager.get_conversation_by_id(
            conversation_id=conversation_id,
            actor=actor,
        )
        agent_id = conversation.agent_id

        # Find active runs for this conversation
        runs = await server.run_manager.list_runs(
            actor=actor,
            statuses=[RunStatus.created, RunStatus.running],
            ascending=False,
            conversation_id=conversation_id,
            limit=100,
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

            await server.run_manager.cancel_run(actor=actor, agent_id=agent_id, run_id=run_id)
        except Exception as e:
            results[run_id] = "failed"
            logger.error(f"Failed to cancel run {run_id}: {str(e)}")
            continue
        results[run_id] = "cancelled"
        logger.info(f"Cancelled run {run_id}")

    return results


class CompactionRequest(BaseModel):
    agent_id: Optional[str] = Field(
        default=None,
        description="Agent ID for agent-direct mode with 'default' conversation. Use with conversation_id='default' in the URL path.",
    )
    compaction_settings: Optional[CompactionSettings] = Field(
        default=None,
        description="Optional compaction settings to use for this summarization request. If not provided, the agent's default settings will be used.",
    )


class CompactionResponse(BaseModel):
    summary: str
    num_messages_before: int
    num_messages_after: int


@router.post(
    "/{conversation_id}/recompile",
    response_model=str,
    operation_id="recompile_conversation",
)
async def recompile_conversation(
    conversation_id: ConversationIdOrDefault,
    request: Optional[CompactionRequest] = Body(default=None),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
    dry_run: bool = Query(
        False,
        description="If True, do not persist changes; still returns the compiled system prompt.",
    ),
):
    """Manually trigger system prompt recompilation for a conversation."""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    resolved_agent_id = None
    if conversation_id == "default" and request and request.agent_id:
        resolved_agent_id = request.agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        _, system_message, _, _ = await server.agent_manager.rebuild_system_prompt_async(
            agent_id=resolved_agent_id,
            actor=actor,
            force=True,
            update_timestamp=True,
            dry_run=dry_run,
        )

        if system_message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No system message found for agent '{resolved_agent_id}'")

        return system_message.to_openai_dict().get("content", "")

    conversation = await conversation_manager.get_conversation_by_id(
        conversation_id=conversation_id,
        actor=actor,
    )

    _, system_message, _, _ = await server.agent_manager.rebuild_system_prompt_async(
        agent_id=conversation.agent_id,
        actor=actor,
        force=True,
        update_timestamp=True,
        dry_run=True,
    )

    if system_message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No system message found for conversation '{conversation_id}'")

    compiled_content = system_message.to_openai_dict().get("content", "")

    if not dry_run:
        in_context_messages = await conversation_manager.get_messages_for_conversation(
            conversation_id=conversation_id,
            actor=actor,
        )
        if not in_context_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No in-context messages found for this conversation.",
            )

        existing_system_message = in_context_messages[0]
        if existing_system_message.role != "system":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation does not have a system message in the first position.",
            )

        from letta.schemas.message import MessageUpdate

        message_update = MessageUpdate(content=compiled_content)
        await server.message_manager.update_message_by_id_async(
            message_id=existing_system_message.id,
            message_update=message_update,
            actor=actor,
        )

    return compiled_content


@router.post("/{conversation_id}/compact", response_model=CompactionResponse, operation_id="compact_conversation")
async def compact_conversation(
    conversation_id: ConversationIdOrDefault,
    request: Optional[CompactionRequest] = Body(default=None),
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Compact (summarize) a conversation's message history.

    This endpoint summarizes the in-context messages for a specific conversation,
    reducing the message count while preserving important context.

    **Agent-direct mode**: Pass conversation_id="default" with agent_id in request body
    to compact the agent's default conversation messages.

    **Deprecated**: Passing an agent ID as conversation_id still works but will be removed.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    # Agent-direct mode: conversation_id="default" + agent_id in body (preferred)
    # OR conversation_id="agent-*" (backwards compat, deprecated)
    resolved_agent_id = None
    if conversation_id == "default" and request and request.agent_id:
        resolved_agent_id = request.agent_id
    elif conversation_id.startswith("agent-"):
        resolved_agent_id = conversation_id

    if resolved_agent_id:
        # Agent-direct mode: compact agent's default conversation
        agent = await server.agent_manager.get_agent_by_id_async(resolved_agent_id, actor, include_relationships=["multi_agent_group"])
        in_context_messages = await server.message_manager.get_messages_by_ids_async(message_ids=agent.message_ids, actor=actor)
        agent_loop = LettaAgentV3(agent_state=agent, actor=actor)
    else:
        # Get the conversation to find the agent_id
        conversation = await conversation_manager.get_conversation_by_id(
            conversation_id=conversation_id,
            actor=actor,
        )

        # Get the agent state
        agent = await server.agent_manager.get_agent_by_id_async(conversation.agent_id, actor, include_relationships=["multi_agent_group"])

        # Get in-context messages for this conversation
        in_context_messages = await conversation_manager.get_messages_for_conversation(
            conversation_id=conversation_id,
            actor=actor,
        )

        # Create agent loop with conversation context
        agent_loop = LettaAgentV3(agent_state=agent, actor=actor, conversation_id=conversation_id)

    if not in_context_messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No in-context messages found for this conversation.",
        )

    # Merge request compaction_settings with agent's settings (request overrides agent)
    if agent.compaction_settings and request and request.compaction_settings:
        # Start with agent's settings, override with new values from request
        # Use model_fields_set to get the fields that were changed in the request (want to ignore the defaults that get set automatically)
        compaction_settings = agent.compaction_settings.copy()  # do not mutate original agent compaction settings
        changed_fields = request.compaction_settings.model_fields_set
        for field in changed_fields:
            setattr(compaction_settings, field, getattr(request.compaction_settings, field))

        # If mode changed from agent's original settings and prompt not explicitly set in request, then use the default prompt for the new mode
        # Ex: previously was sliding_window, now is all, so we need to use the default prompt for all mode
        if (
            "mode" in changed_fields
            and "prompt" not in changed_fields
            and agent.compaction_settings.mode != request.compaction_settings.mode
        ):
            from letta.services.summarizer.summarizer_config import get_default_prompt_for_mode

            compaction_settings.prompt = get_default_prompt_for_mode(compaction_settings.mode)
    else:
        compaction_settings = (request and request.compaction_settings) or agent.compaction_settings
    num_messages_before = len(in_context_messages)

    # Run compaction
    summary_message, messages, summary = await agent_loop.compact(
        messages=in_context_messages,
        compaction_settings=compaction_settings,
        use_summary_role=True,
        billing_context=headers.billing_context,
    )
    num_messages_after = len(messages)

    # Validate compaction reduced messages
    if num_messages_before <= num_messages_after:
        logger.warning(f"Summarization failed to reduce the number of messages. {num_messages_before} messages -> {num_messages_after}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Summarization failed to reduce the number of messages. You may not have enough messages to compact or need to use a different CompactionSettings (e.g. using `all` mode).",
        )

    # Checkpoint the messages (this will update the conversation_messages table)
    await agent_loop._checkpoint_messages(run_id=None, step_id=None, new_messages=[summary_message], in_context_messages=messages)

    logger.info(f"Compacted conversation {conversation_id}: {num_messages_before} messages -> {num_messages_after}")

    return CompactionResponse(
        summary=summary,
        num_messages_before=num_messages_before,
        num_messages_after=num_messages_after,
    )
