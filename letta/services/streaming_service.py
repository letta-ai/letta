import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import AsyncIterator, Optional, Union
from uuid import uuid4

from fastapi.responses import StreamingResponse
from openai.types.chat import ChatCompletionChunk
from openai.types.chat.chat_completion_chunk import Choice, ChoiceDelta

from letta.agents.agent_loop import AgentLoop
from letta.agents.base_agent_v2 import BaseAgentV2
from letta.constants import REDIS_RUN_ID_PREFIX
from letta.data_sources.redis_client import AsyncRedisClient, NoopAsyncRedisClient, get_redis_client
from letta.errors import (
    ConversationBusyError,
    LettaError,
    LettaInvalidArgumentError,
    LettaServiceUnavailableError,
    LLMAuthenticationError,
    LLMEmptyResponseError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    PendingApprovalError,
    SystemPromptTokenExceededError,
)
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentType, MessageStreamStatus, RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import AssistantMessage, LettaErrorMessage, LettaPing, MessageType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_request import ClientToolSchema, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import MessageCreate
from letta.schemas.provider_trace import BillingContext
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.redis_stream_manager import create_background_stream_processor, redis_sse_stream_generator
from letta.server.rest_api.streaming_response import (
    RunCancelledException,
    StreamingResponseWithStatusCode,
    add_keepalive_to_stream,
    cancellation_aware_stream_wrapper,
    get_cancellation_event_for_run,
)
from letta.server.rest_api.utils import capture_sentry_exception
from letta.services.conversation_manager import ConversationManager
from letta.services.run_manager import RunManager
from letta.settings import settings
from letta.utils import safe_create_task

logger = get_logger(__name__)


def derive_request_token(otids: list[str]) -> str:
    """
    Derive a request token from all message otids for deduplication.

    This ensures that two requests with different message combinations get
    different lock tokens, even if they share the same first message.

    Args:
        otids: List of otids from all messages in the request

    Returns:
        A hash of all otids, or a random UUID if no otids provided
    """
    if not otids:
        return str(uuid4())
    combined = "|".join(otids)
    return hashlib.sha256(combined.encode()).hexdigest()[:16]


async def try_recover_duplicate_request(
    redis_client: "AsyncRedisClient",
    request_token: str,
    lock_key: str,
    include_pings: bool = False,
) -> Optional[StreamingResponse]:
    """
    Check if an existing run already exists for this request token (same otid retry).
    If so, return a stream attached to the existing run as a read-only reader.
    Called BEFORE lock acquisition so duplicate requests never touch the lock.

    Args:
        redis_client: The Redis client
        request_token: Hash of all message otids
        lock_key: The conversation/agent ID used as lock key
        include_pings: Whether to add keepalive pings to the stream

    Returns:
        StreamingResponse if recovery succeeded, None otherwise
    """
    existing_run_id = await redis_client.get_run_id_by_otid(request_token)
    if not existing_run_id:
        return None

    logger.info(
        f"Recovering from duplicate request: returning stream for existing run_id={existing_run_id} "
        f"(request_token={request_token}, lock_key={lock_key})"
    )
    stream = redis_sse_stream_generator(
        redis_client=redis_client,
        run_id=existing_run_id,
    )
    if include_pings and settings.enable_keepalive:
        stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval, run_id=existing_run_id)
    return StreamingResponseWithStatusCode(stream, media_type="text/event-stream")


async def enrich_conversation_busy_error(
    redis_client: "AsyncRedisClient",
    error: ConversationBusyError,
) -> ConversationBusyError:
    """
    Enrich a ConversationBusyError with the run_id of the lock holder if available.

    Args:
        redis_client: The Redis client
        error: The original ConversationBusyError

    Returns:
        A new ConversationBusyError with run_id populated if found
    """
    existing_run_id = None
    if error.lock_holder_token:
        existing_run_id = await redis_client.get_run_id_by_otid(error.lock_holder_token)
    return ConversationBusyError(
        conversation_id=error.conversation_id,
        lock_holder_token=error.lock_holder_token,
        run_id=existing_run_id,
    )


async def prepend_initial_run_ping(
    stream_generator: AsyncIterator[str | bytes],
    run_id: str,
) -> AsyncIterator[str | bytes]:
    """
    Emit an immediate run_id-bearing ping before the first stream chunk.

    Device/listener mode currently waits for the first chunk that exposes run_id
    before it can attach the run. Prepending a ping lets clients bind earlier
    without changing the streaming schema surface.
    """
    yield (
        "data: "
        + LettaPing(
            id=f"ping-{uuid4()}",
            date=datetime.now(timezone.utc),
            run_id=run_id,
        ).model_dump_json()
        + "\n\n"
    )

    try:
        async for chunk in stream_generator:
            yield chunk
    except RunCancelledException as e:
        # Forward cancellation to the inner generator so its handler fires
        # (sets saw_done, run_status=None, emits [DONE]) before the finally block.
        # Without this, aclose() sends GeneratorExit which skips the handler and
        # causes the finally block to mark the run as "failed" instead of "cancelled".
        try:
            await stream_generator.athrow(e)
        except (StopAsyncIteration, RunCancelledException):
            pass
        raise


class StreamingService:
    """
    Service for managing agent streaming responses.
    Handles run creation, stream generation, error handling, and format conversion.
    """

    def __init__(self, server):
        """
        Initialize the streaming service.

        Args:
            server: The SyncServer instance for accessing managers and services
        """
        self.server = server
        self.runs_manager = RunManager() if settings.track_agent_run else None

    async def create_agent_stream(
        self,
        agent_id: str,
        actor: User,
        request: LettaStreamingRequest,
        run_type: str = "streaming",
        conversation_id: Optional[str] = None,
        should_lock: bool = False,
        billing_context: "BillingContext | None" = None,
        openai_responses_websocket: bool = False,
    ) -> tuple[Optional[PydanticRun], Union[StreamingResponse, LettaResponse]]:
        """
        Create a streaming response for an agent.

        Args:
            agent_id: The agent ID to stream from
            actor: The user making the request
            request: The LettaStreamingRequest containing all request parameters
            run_type: Type of run for tracking
            conversation_id: Optional conversation ID for conversation-scoped messaging
            should_lock: If True and conversation_id is None, use agent_id as lock key

        Returns:
            Tuple of (run object or None, streaming response)
        """
        request_start_timestamp_ns = get_utc_timestamp_ns()
        MetricRegistry().user_message_counter.add(1, get_ctx_attributes())

        # get redis client
        redis_client = await get_redis_client()

        # load agent and check eligibility
        agent = await self.server.agent_manager.get_agent_by_id_async(
            agent_id,
            actor,
            include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools", "tags"],
        )

        # Apply conversation-level model override if set (lower priority than request override)
        if conversation_id and not request.override_model:
            conversation = await ConversationManager().get_conversation_by_id(
                conversation_id=conversation_id,
                actor=actor,
            )
            if conversation.model:
                conversation_llm_config = await self.server.get_llm_config_from_handle_async(
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

        # Handle model override if specified in the request
        if request.override_model:
            override_llm_config = await self.server.get_llm_config_from_handle_async(
                actor=actor,
                handle=request.override_model,
            )
            # Create a copy of agent state with the overridden llm_config
            agent = agent.model_copy(update={"llm_config": override_llm_config})

        model_compatible_token_streaming = self._is_token_streaming_compatible(agent)
        route_class = "background" if request.background else "foreground"

        # Determine lock key: use conversation_id if provided, else agent_id if should_lock
        lock_key = conversation_id if conversation_id else (agent_id if should_lock else None)

        # Collect all otids from messages for request deduplication
        # Each message has an otid (auto-generated if not provided)
        message_otids = [msg.otid for msg in request.messages if msg.otid]

        # Derive a request token from ALL message otids for deduplication
        # This ensures requests with different message combinations get different tokens
        request_token = derive_request_token(message_otids)

        # Attempt to acquire lock if lock_key is set
        # This prevents concurrent message processing for the same conversation/agent
        # Skip locking if Redis is not available (graceful degradation)
        if lock_key and not isinstance(redis_client, NoopAsyncRedisClient):
            # Check for existing run BEFORE acquiring the lock.
            # Same-otid retries should never acquire the lock — just read from Redis.
            # Only possible when background=True (Redis-backed streaming).
            if request.background:
                recovery_response = await try_recover_duplicate_request(
                    redis_client=redis_client,
                    request_token=request_token,
                    lock_key=lock_key,
                    include_pings=request.include_pings,
                )
                if recovery_response:
                    return None, recovery_response

            admission_wait_start_ns = get_utc_timestamp_ns()
            try:
                await redis_client.acquire_conversation_lock(
                    conversation_id=lock_key,
                    token=request_token,
                )

            except ConversationBusyError as e:
                # Second-chance recovery for same-OTID retries that lost the race:
                # The pre-lock check ran before the mapping was stored. The lock holder
                # may still be creating the run (DB insert), so poll briefly for the mapping.
                if request.background and request_token and e.lock_holder_token and e.lock_holder_token == request_token:
                    for _attempt in range(3):
                        recovery_response = await try_recover_duplicate_request(
                            redis_client=redis_client,
                            request_token=request_token,
                            lock_key=lock_key,
                            include_pings=request.include_pings,
                        )
                        if recovery_response:
                            return None, recovery_response
                        await asyncio.sleep(0.25 * (2**_attempt))  # 250ms, 500ms, 1s
                raise await enrich_conversation_busy_error(redis_client, e)
            finally:
                admission_wait_ms = (get_utc_timestamp_ns() - admission_wait_start_ns) / 1_000_000
                MetricRegistry().request_admission_wait_ms_histogram.record(
                    admission_wait_ms,
                    attributes={"route_class": route_class},
                )
                from letta.monitoring.load_gate import get_load_gate

                get_load_gate().on_admission_wait(admission_wait_ms)

        # create run if tracking is enabled
        run = None
        run_update_metadata = None

        try:
            if settings.track_agent_run:
                run = await self._create_run(agent_id, request, run_type, actor, conversation_id=conversation_id)
                await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

                # Store request_token -> run_id mapping for duplicate request recovery
                # This allows detecting exact retry vs different request
                if request_token:
                    await redis_client.set_otid_run_mapping(request_token, run.id)

                # Store each individual otid -> run_id mapping for client convenience
                # Client can use ANY otid from their request to recover the stream
                for otid in message_otids:
                    await redis_client.set_otid_run_mapping(otid, run.id)

            # use agent loop for streaming
            agent_loop = AgentLoop.load(agent_state=agent, actor=actor)

            # create the base stream with error handling
            raw_stream = self._create_error_aware_stream(
                agent_loop=agent_loop,
                messages=request.messages,
                max_steps=request.max_steps,
                stream_tokens=request.stream_tokens and model_compatible_token_streaming,
                run_id=run.id if run else None,
                use_assistant_message=request.use_assistant_message,
                request_start_timestamp_ns=request_start_timestamp_ns,
                include_return_message_types=request.include_return_message_types,
                actor=actor,
                provider_name=agent.llm_config.model_endpoint_type,
                conversation_id=conversation_id,
                lock_key=lock_key,  # For lock release (may differ from conversation_id)
                client_tools=request.client_tools,
                client_skills=request.client_skills,
                override_system=request.override_system,
                include_compaction_messages=request.include_compaction_messages,
                billing_context=billing_context,
                route_class=route_class,
                is_background=request.background,
                openai_responses_websocket=openai_responses_websocket,
            )

            if request.include_pings and run:
                raw_stream = prepend_initial_run_ping(raw_stream, run.id)

            # handle background streaming if requested
            if request.background and settings.track_agent_run:
                if isinstance(redis_client, NoopAsyncRedisClient):
                    raise LettaServiceUnavailableError(
                        f"Background streaming requires Redis to be running. "
                        f"Please ensure Redis is properly configured. "
                        f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}",
                        service_name="redis",
                    )

                # Wrap the agent loop stream with cancellation awareness for background task
                background_stream = raw_stream
                if settings.enable_cancellation_aware_streaming and run:
                    background_stream = cancellation_aware_stream_wrapper(
                        stream_generator=raw_stream,
                        run_manager=self.runs_manager,
                        run_id=run.id,
                        actor=actor,
                        cancellation_event=get_cancellation_event_for_run(run.id),
                    )

                safe_create_task(
                    create_background_stream_processor(
                        stream_generator=background_stream,
                        redis_client=redis_client,
                        run_id=run.id,
                        run_manager=self.server.run_manager,
                        actor=actor,
                        conversation_id=lock_key,  # Use lock_key for lock release
                    ),
                    label=f"background_stream_processor_{run.id}",
                )

                raw_stream = redis_sse_stream_generator(
                    redis_client=redis_client,
                    run_id=run.id,
                )

            # wrap client stream with cancellation awareness if enabled and tracking runs
            stream = raw_stream
            if settings.enable_cancellation_aware_streaming and settings.track_agent_run and run and not request.background:
                stream = cancellation_aware_stream_wrapper(
                    stream_generator=raw_stream,
                    run_manager=self.runs_manager,
                    run_id=run.id,
                    actor=actor,
                    cancellation_event=get_cancellation_event_for_run(run.id),
                )

            # conditionally wrap with keepalive based on request parameter
            if request.include_pings and settings.enable_keepalive:
                stream = add_keepalive_to_stream(stream, keepalive_interval=settings.keepalive_interval, run_id=run.id)

            # Track SSE lifecycle metrics on the final stream returned to clients.
            stream = self._create_sse_lifecycle_stream(stream, route_class=route_class)

            result = StreamingResponseWithStatusCode(
                stream,
                media_type="text/event-stream",
            )

            # update run status to running before returning
            if settings.track_agent_run and run:
                # refetch run since it may have been updated by another service
                run = await self.server.run_manager.get_run_by_id(run_id=run.id, actor=actor)
                if run.status == RunStatus.created:
                    run_status = RunStatus.running
                else:
                    # don't override run status if it has already been updated
                    run_status = None

            return run, result

        except PendingApprovalError as e:
            if settings.track_agent_run:
                run_update_metadata = {"error": str(e)}
                run_status = RunStatus.failed
            raise
        except Exception as e:
            if settings.track_agent_run:
                run_update_metadata = {"error": str(e)}
                run_status = RunStatus.failed
            raise
        finally:
            if settings.track_agent_run and run and run_status:
                await self.server.run_manager.update_run_by_id_async(
                    run_id=run.id,
                    conversation_id=lock_key,  # Use lock_key for lock release
                    update=RunUpdate(status=run_status, metadata=run_update_metadata),
                    actor=actor,
                )

    async def create_agent_stream_openai_chat_completions(
        self,
        agent_id: str,
        actor: User,
        request: LettaStreamingRequest,
        billing_context: "BillingContext | None" = None,
    ) -> StreamingResponse:
        """
        Create OpenAI-compatible chat completions streaming response.

        Transforms Letta's internal streaming format to match OpenAI's
        ChatCompletionChunk schema, filtering out internal tool execution
        and only streaming assistant text responses.

        Args:
            agent_id: The agent ID to stream from
            actor: The user making the request
            request: The LettaStreamingRequest containing all request parameters

        Returns:
            StreamingResponse with OpenAI-formatted SSE chunks
        """
        # load agent to get model info for the completion chunks
        agent = await self.server.agent_manager.get_agent_by_id_async(agent_id, actor)

        # create standard Letta stream (returns SSE-formatted stream)
        run, letta_stream_response = await self.create_agent_stream(
            agent_id=agent_id,
            actor=actor,
            request=request,
            run_type="openai_chat_completions",
            billing_context=billing_context,
        )

        # extract the stream iterator from the response
        if isinstance(letta_stream_response, StreamingResponseWithStatusCode):
            letta_stream = letta_stream_response.body_iterator
        else:
            raise LettaInvalidArgumentError(
                "Agent is not compatible with streaming mode",
                argument_name="model",
            )

        # create transformer with agent's model info
        model_name = agent.llm_config.model if agent.llm_config else "unknown"
        completion_id = f"chatcmpl-{run.id if run else str(uuid4())}"

        transformer = OpenAIChatCompletionsStreamTransformer(
            model=model_name,
            completion_id=completion_id,
        )

        # transform Letta SSE stream to OpenAI format (parser handles SSE strings)
        openai_stream = transformer.transform_stream(letta_stream)

        return StreamingResponse(
            openai_stream,
            media_type="text/event-stream",
        )

    def _create_error_aware_stream(
        self,
        agent_loop: BaseAgentV2,
        messages: list[MessageCreate],
        max_steps: int,
        stream_tokens: bool,
        run_id: Optional[str],
        use_assistant_message: bool,
        request_start_timestamp_ns: int,
        include_return_message_types: Optional[list[MessageType]],
        actor: User,
        provider_name: str,
        conversation_id: Optional[str] = None,
        lock_key: Optional[str] = None,
        client_tools: Optional[list[ClientToolSchema]] = None,
        client_skills=None,
        override_system: str | None = None,
        include_compaction_messages: bool = False,
        billing_context: BillingContext | None = None,
        route_class: str = "foreground",
        is_background: bool = False,
        openai_responses_websocket: bool = False,
    ) -> AsyncIterator:
        """
        Create a stream with unified error handling.

        Returns:
            Async iterator that yields chunks with proper error handling
        """

        async def error_aware_stream():
            """Stream that handles early LLM errors gracefully in streaming format."""
            run_status = None
            stop_reason = None
            error_data = None
            saw_done = False
            saw_error = False
            in_flight_attrs = {"route_class": route_class}
            in_flight_counter = (
                MetricRegistry().in_flight_background_counter if is_background else MetricRegistry().in_flight_foreground_counter
            )

            in_flight_counter.add(1, attributes=in_flight_attrs)
            from letta.monitoring.load_gate import get_load_gate

            _load_gate = get_load_gate()
            if is_background:
                _load_gate.on_bg_start()
            else:
                _load_gate.on_fg_start()

            try:
                stream = agent_loop.stream(
                    input_messages=messages,
                    max_steps=max_steps,
                    stream_tokens=stream_tokens,
                    run_id=run_id,
                    use_assistant_message=use_assistant_message,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                    include_return_message_types=include_return_message_types,
                    conversation_id=conversation_id,
                    client_tools=client_tools,
                    client_skills=client_skills,
                    override_system=override_system,
                    include_compaction_messages=include_compaction_messages,
                    billing_context=billing_context,
                    openai_responses_websocket=openai_responses_websocket,
                )

                async for chunk in stream:
                    # Track terminal events (check at line start to avoid false positives in message content)
                    if isinstance(chunk, str):
                        if "\ndata: [DONE]" in chunk or chunk.startswith("data: [DONE]"):
                            saw_done = True
                        if "\nevent: error" in chunk or chunk.startswith("event: error"):
                            saw_error = True
                    yield chunk

                # Stream completed - check if we got a terminal event
                if not saw_done and not saw_error:
                    # Stream ended without terminal - treat as error to avoid hanging clients
                    logger.error(
                        f"Stream for run {run_id} ended without terminal event. "
                        f"Agent stop_reason: {agent_loop.stop_reason}. Emitting error + [DONE]."
                    )
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.error)
                    error_message = LettaErrorMessage(
                        run_id=run_id,
                        error_type="stream_incomplete",
                        message="Stream ended unexpectedly without a terminal event.",
                        detail=None,
                    )
                    error_data = {"error": error_message.model_dump()}
                    yield f"data: {stop_reason.model_dump_json()}\n\n"
                    yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                    yield "data: [DONE]\n\n"
                    saw_error = True
                    saw_done = True
                    run_status = RunStatus.failed

                else:
                    # set run status after successful completion
                    if agent_loop.stop_reason and agent_loop.stop_reason.stop_reason.value == "cancelled":
                        run_status = RunStatus.cancelled
                    else:
                        run_status = RunStatus.completed
                    stop_reason = agent_loop.stop_reason if agent_loop.stop_reason else LettaStopReason(stop_reason=StopReasonType.end_turn)

            except LLMTimeoutError as e:
                MetricRegistry().request_timeout_counter.add(1, attributes=in_flight_attrs)
                MetricRegistry().provider_timeout_counter.add(1, attributes={"provider": provider_name})
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="llm_timeout",
                    message="The LLM request timed out. Please try again.",
                    detail=str(e),
                )
                error_data = {"error": error_message.model_dump()}
                logger.error(f"Run {run_id} stopped with LLM timeout error: {e}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except LLMRateLimitError as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="llm_rate_limit",
                    message="Rate limit exceeded for LLM model provider. Please wait before making another request.",
                    detail=str(e),
                )
                error_data = {"error": error_message.model_dump()}
                logger.warning(f"Run {run_id} stopped with LLM rate limit error: {e}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except LLMAuthenticationError as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="llm_authentication",
                    message="Authentication failed with the LLM model provider.",
                    detail=str(e),
                )
                error_data = {"error": error_message.model_dump()}
                logger.warning(f"Run {run_id} stopped with LLM authentication error: {e}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except LLMEmptyResponseError as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.invalid_llm_response)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="llm_empty_response",
                    message="LLM returned an empty response.",
                    detail=str(e),
                )
                error_data = {"error": error_message.model_dump()}
                logger.warning(f"Run {run_id} stopped with LLM empty response: {e}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except LLMError as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="llm_error",
                    message="An error occurred with the LLM request.",
                    detail=str(e),
                )
                error_data = {"error": error_message.model_dump()}
                logger.error(f"Run {run_id} stopped with LLM error: {e}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except SystemPromptTokenExceededError as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.context_window_overflow_in_system_prompt)
                error_detail = str(e) or repr(e)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type=StopReasonType.context_window_overflow_in_system_prompt.value,
                    message=(
                        "Compaction failed because the system prompt is too large for this model's context window. "
                        "Reduce system instructions, memory blocks, or tools, or use a model with a larger context window."
                    ),
                    detail=error_detail,
                )
                error_data = {"error": error_message.model_dump()}
                logger.warning(
                    f"Run {run_id} stopped with system prompt overflow: {error_detail}, error_data: {error_message.model_dump()}"
                )
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
            except RunCancelledException:
                # Run was explicitly cancelled - this is not an error
                # The cancellation has already been handled by cancellation_aware_stream_wrapper
                logger.info(f"Run {run_id} was cancelled, exiting stream gracefully")
                # Mark as terminal BEFORE yielding [DONE]. Some consumers stop immediately
                # after receiving [DONE], so code after yield may never run.
                saw_done = True
                # Don't update run status in finally - cancellation is already recorded
                run_status = None  # Signal to finally block to skip update
                # Send [DONE] to properly close the stream
                yield "data: [DONE]\n\n"
            except asyncio.CancelledError:
                # CancelledError is a BaseException (Python 3.9+) that bypasses
                # `except Exception`. Caused by task cancellation or client disconnect.
                logger.warning(
                    f"Run {run_id} stream interrupted by asyncio.CancelledError "
                    f"(likely client disconnect or task cancellation). "
                    f"saw_done={saw_done}, saw_error={saw_error}, "
                    f"agent stop_reason={agent_loop.stop_reason}"
                )
                raise
            except Exception as e:
                run_status = RunStatus.failed
                stop_reason = LettaStopReason(stop_reason=StopReasonType.error)
                # Use repr() if str() is empty (happens with Exception() with no args)
                error_detail = str(e) or repr(e)
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="internal_error",
                    message=error_detail if isinstance(e, LettaError) else "An unknown error occurred with the LLM streaming request.",
                    detail=error_detail,
                )
                error_data = {"error": error_message.model_dump()}
                logger.error(f"Run {run_id} stopped with unknown error: {error_detail}, error_data: {error_message.model_dump()}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
                # Send [DONE] marker to properly close the stream
                yield "data: [DONE]\n\n"
                # Capture for Sentry but don't re-raise to allow stream to complete gracefully
                capture_sentry_exception(e)
            finally:
                # If run_status was never set and the stream ended without [DONE],
                # mark as failed so the run doesn't stay "running" forever.
                # For background runs, the background stream processor handles
                # terminal state updates (and has better error context), so we
                # only log here to avoid overwriting the correct stop_reason.
                if run_id and self.runs_manager and run_status is None and not saw_done:
                    if is_background:
                        logger.warning(
                            f"Run {run_id} stream ended without setting run_status or emitting [DONE]. "
                            f"Skipping run update — background stream processor will handle terminal state."
                        )
                    else:
                        logger.warning(f"Run {run_id} stream ended without setting run_status or emitting [DONE]. Marking as failed.")
                        run_status = RunStatus.failed
                        stop_reason = LettaStopReason(stop_reason=StopReasonType.error)
                        error_data = {
                            "error": {
                                "run_id": run_id,
                                "error_type": "stream_incomplete",
                                "message": "Stream ended unexpectedly without a terminal event.",
                            }
                        }

                # always update run status, whether success or failure
                if run_id and self.runs_manager and run_status:
                    # Extract stop_reason enum value from LettaStopReason object
                    stop_reason_value = stop_reason.stop_reason if stop_reason else StopReasonType.error.value
                    await self.runs_manager.update_run_by_id_async(
                        run_id=run_id,
                        conversation_id=lock_key,  # Use lock_key for lock release
                        update=RunUpdate(status=run_status, stop_reason=stop_reason_value, metadata=error_data),
                        actor=actor,
                    )

                in_flight_counter.add(-1, attributes=in_flight_attrs)
                if is_background:
                    _load_gate.on_bg_end()
                else:
                    _load_gate.on_fg_end()

        return error_aware_stream()

    def _is_token_streaming_compatible(self, agent: AgentState) -> bool:
        """Check if agent's model supports token-level streaming."""
        base_compatible = agent.llm_config.model_endpoint_type in [
            "anthropic",
            "openai",
            "bedrock",
            "deepseek",
            "zai",
            "zai_coding",
            "chatgpt_oauth",
            "minimax",
            "openrouter",
        ]
        google_letta_v1 = agent.agent_type == AgentType.letta_v1_agent and agent.llm_config.model_endpoint_type in [
            "google_ai",
            "google_vertex",
        ]
        return base_compatible or google_letta_v1

    @staticmethod
    def _map_sse_error_type_to_disconnect_reason(error_type: Optional[str]) -> str:
        """Map stream error types to SSE disconnect reason taxonomy."""
        if error_type == "llm_timeout":
            return "timeout"
        if error_type in {
            "llm_error",
            "llm_rate_limit",
            "llm_authentication",
            "llm_empty_response",
            "internal_error",
            "stream_incomplete",
            StopReasonType.context_window_overflow_in_system_prompt.value,
        }:
            return "upstream_error"
        return "unknown"

    @staticmethod
    def _extract_sse_error_type(chunk: str) -> Optional[str]:
        """Extract Letta stream error_type from an SSE error chunk."""
        if not ("\nevent: error" in chunk or chunk.startswith("event: error")):
            return None

        for line in chunk.splitlines():
            if not line.startswith("data: "):
                continue
            try:
                payload = json.loads(line[len("data: ") :])
            except json.JSONDecodeError:
                continue

            if isinstance(payload, dict):
                error_type = payload.get("error_type")
                if isinstance(error_type, str):
                    return error_type
        return None

    def _create_sse_lifecycle_stream(self, stream_generator: AsyncIterator, route_class: str) -> AsyncIterator:
        """Wrap a stream generator with SSE lifecycle metrics instrumentation."""

        async def instrumented_stream():
            start_ns = get_utc_timestamp_ns()
            attrs = {"route_class": route_class}
            saw_done = False
            saw_error = False
            error_type = None
            disconnect_reason = None

            MetricRegistry().sse_active_sessions_counter.add(1, attributes=attrs)

            try:
                async for chunk in stream_generator:
                    if isinstance(chunk, str):
                        if "\ndata: [DONE]" in chunk or chunk.startswith("data: [DONE]"):
                            saw_done = True
                        if "\nevent: error" in chunk or chunk.startswith("event: error"):
                            saw_error = True
                            parsed_error_type = self._extract_sse_error_type(chunk)
                            if parsed_error_type:
                                error_type = parsed_error_type

                    yield chunk
            except asyncio.CancelledError:
                disconnect_reason = "client_cancel"
                raise
            except (BrokenPipeError, ConnectionError, ConnectionResetError):
                disconnect_reason = "network_error"
                raise
            except TimeoutError:
                disconnect_reason = "timeout"
                raise
            finally:
                MetricRegistry().sse_active_sessions_counter.add(-1, attributes=attrs)

                duration_ms = (get_utc_timestamp_ns() - start_ns) / 1_000_000
                MetricRegistry().sse_duration_ms_histogram.record(duration_ms, attributes=attrs)

                if disconnect_reason is None and saw_error:
                    disconnect_reason = self._map_sse_error_type_to_disconnect_reason(error_type)
                if disconnect_reason is None and not saw_done:
                    disconnect_reason = "unknown"

                if disconnect_reason:
                    MetricRegistry().sse_disconnect_counter.add(
                        1,
                        attributes={"reason": disconnect_reason, "route_class": route_class},
                    )

        return instrumented_stream()

    async def _create_run(
        self, agent_id: str, request: LettaStreamingRequest, run_type: str, actor: User, conversation_id: Optional[str] = None
    ) -> PydanticRun:
        """Create a run for tracking execution."""
        run = await self.runs_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=agent_id,
                conversation_id=conversation_id,
                background=request.background or False,
                metadata={
                    "run_type": run_type,
                },
                request_config=LettaRequestConfig.from_letta_request(request),
            ),
            actor=actor,
        )
        return run

    async def _update_run_status(
        self,
        run_id: str,
        status: RunStatus,
        actor: User,
        error: Optional[str] = None,
        stop_reason: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ):
        """Update the status of a run."""
        if not self.runs_manager:
            return

        update = RunUpdate(status=status)
        if error:
            update.metadata = {"error": error}
        if stop_reason:
            update.stop_reason = stop_reason

        await self.runs_manager.update_run_by_id_async(
            run_id=run_id,
            update=update,
            actor=actor,
            conversation_id=conversation_id,
        )


class OpenAIChatCompletionsStreamTransformer:
    """
    Transforms Letta streaming messages into OpenAI ChatCompletionChunk format.
    Filters out internal tool execution and only streams assistant text responses.
    """

    def __init__(self, model: str, completion_id: str):
        """
        Initialize the transformer.

        Args:
            model: Model name to include in chunks
            completion_id: Unique ID for this completion (format: chatcmpl-{uuid})
        """
        self.model = model
        self.completion_id = completion_id
        self.first_chunk = True
        self.created = int(time.time())

    # TODO: This is lowkey really ugly and poor code design, but this works fine for now
    def _parse_sse_chunk(self, sse_string: str):
        """
        Parse SSE-formatted string back into a message object.

        Args:
            sse_string: SSE formatted string like "data: {...}\n\n"

        Returns:
            Parsed message object or None if can't parse
        """
        try:
            # strip SSE formatting
            if sse_string.startswith("data: "):
                json_str = sse_string[6:].strip()

                # handle [DONE] marker
                if json_str == "[DONE]":
                    return MessageStreamStatus.done

                # parse JSON
                data = json.loads(json_str)

                # reconstruct message object based on message_type
                message_type = data.get("message_type")

                if message_type == "assistant_message":
                    return AssistantMessage(**data)
                elif message_type == "usage_statistics":
                    return LettaUsageStatistics(**data)
                elif message_type == "stop_reason":
                    # skip stop_reason, we use [DONE] instead
                    return None
                else:
                    # other message types we skip
                    return None
            return None
        except Exception as e:
            logger.warning(f"Failed to parse SSE chunk: {e}")
            return None

    async def transform_stream(self, letta_stream: AsyncIterator) -> AsyncIterator[str]:
        """
        Transform Letta stream to OpenAI ChatCompletionChunk SSE format.

        Args:
            letta_stream: Async iterator of Letta messages (may be SSE strings or objects)

        Yields:
            SSE-formatted strings: "data: {json}\n\n"
        """
        try:
            async for raw_chunk in letta_stream:
                # parse SSE string if needed
                if isinstance(raw_chunk, str):
                    chunk = self._parse_sse_chunk(raw_chunk)
                    if chunk is None:
                        continue  # skip unparseable or filtered chunks
                else:
                    chunk = raw_chunk

                # only process assistant messages
                if isinstance(chunk, AssistantMessage):
                    async for sse_chunk in self._process_assistant_message(chunk):
                        print(f"CHUNK: {sse_chunk}")
                        yield sse_chunk

                # handle completion status
                elif chunk == MessageStreamStatus.done:
                    # emit final chunk with finish_reason
                    final_chunk = ChatCompletionChunk(
                        id=self.completion_id,
                        object="chat.completion.chunk",
                        created=self.created,
                        model=self.model,
                        choices=[
                            Choice(
                                index=0,
                                delta=ChoiceDelta(),
                                finish_reason="stop",
                            )
                        ],
                    )
                    yield f"data: {final_chunk.model_dump_json()}\n\n"
                    yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Error in OpenAI stream transformation: {e}", exc_info=True)
            error_chunk = {"error": {"message": str(e), "type": "server_error"}}
            yield f"data: {json.dumps(error_chunk)}\n\n"

    async def _process_assistant_message(self, message: AssistantMessage) -> AsyncIterator[str]:
        """
        Convert AssistantMessage to OpenAI ChatCompletionChunk(s).

        Args:
            message: Letta AssistantMessage with content

        Yields:
            SSE-formatted chunk strings
        """
        # extract text from content (can be string or list of TextContent)
        text_content = self._extract_text_content(message.content)
        if not text_content:
            return

        # emit role on first chunk only
        if self.first_chunk:
            self.first_chunk = False
            # first chunk includes role
            chunk = ChatCompletionChunk(
                id=self.completion_id,
                object="chat.completion.chunk",
                created=self.created,
                model=self.model,
                choices=[
                    Choice(
                        index=0,
                        delta=ChoiceDelta(role="assistant", content=text_content),
                        finish_reason=None,
                    )
                ],
            )
        else:
            # subsequent chunks just have content
            chunk = ChatCompletionChunk(
                id=self.completion_id,
                object="chat.completion.chunk",
                created=self.created,
                model=self.model,
                choices=[
                    Choice(
                        index=0,
                        delta=ChoiceDelta(content=text_content),
                        finish_reason=None,
                    )
                ],
            )

        yield f"data: {chunk.model_dump_json()}\n\n"

    def _extract_text_content(self, content: Union[str, list[TextContent]]) -> str:
        """
        Extract text string from content field.

        Args:
            content: Either a string or list of TextContent objects

        Returns:
            Extracted text string
        """
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            # concatenate all TextContent items
            text_parts = []
            for item in content:
                if isinstance(item, TextContent):
                    text_parts.append(item.text)
            return "".join(text_parts)
        return ""
