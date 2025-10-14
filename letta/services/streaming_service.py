"""
Streaming service for handling agent message streaming with various formats.
Provides a unified interface for streaming agent responses with support for
different output formats (Letta native, OpenAI-compatible, etc.)
"""

import asyncio
import json
from typing import AsyncIterator, Optional, Union

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from letta.agents.agent_loop import AgentLoop
from letta.constants import REDIS_RUN_ID_PREFIX
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.errors import LLMAuthenticationError, LLMError, LLMRateLimitError, LLMTimeoutError, PendingApprovalError
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentType, RunStatus
from letta.schemas.job import LettaRequestConfig
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_request import LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run as PydanticRun, RunUpdate
from letta.schemas.user import User
from letta.server.rest_api.redis_stream_manager import create_background_stream_processor, redis_sse_stream_generator
from letta.server.rest_api.streaming_response import StreamingResponseWithStatusCode, add_keepalive_to_stream
from letta.services.lettuce import LettuceClient
from letta.services.run_manager import RunManager
from letta.settings import settings
from letta.utils import safe_create_task

logger = get_logger(__name__)


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
    ) -> tuple[Optional[PydanticRun], Union[StreamingResponse, LettaResponse]]:
        """
        Create a streaming response for an agent.

        Args:
            agent_id: The agent ID to stream from
            actor: The user making the request
            request: The LettaStreamingRequest containing all request parameters
            run_type: Type of run for tracking

        Returns:
            Tuple of (run object or None, streaming response)
        """
        request_start_timestamp_ns = get_utc_timestamp_ns()
        MetricRegistry().user_message_counter.add(1, get_ctx_attributes())

        # get redis client
        redis_client = await get_redis_client()

        # load agent and check eligibility
        agent = await self.server.agent_manager.get_agent_by_id_async(
            agent_id, actor, include_relationships=["memory", "multi_agent_group", "sources", "tool_exec_environment_variables", "tools"]
        )

        agent_eligible = self._is_agent_eligible(agent)
        model_compatible = self._is_model_compatible(agent)
        model_compatible_token_streaming = self._is_token_streaming_compatible(agent)

        # create run if tracking is enabled
        run = None
        run_update_metadata = None
        if settings.track_agent_run:
            run = await self._create_run(agent_id, request, run_type, actor)
            await redis_client.set(f"{REDIS_RUN_ID_PREFIX}:{agent_id}", run.id if run else None)

        try:
            if agent_eligible and model_compatible:
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
                )

                # handle background streaming if requested
                if request.background and settings.track_agent_run:
                    if isinstance(redis_client, NoopAsyncRedisClient):
                        raise HTTPException(
                            status_code=503,
                            detail=(
                                "Background streaming requires Redis to be running. "
                                "Please ensure Redis is properly configured. "
                                f"LETTA_REDIS_HOST: {settings.redis_host}, LETTA_REDIS_PORT: {settings.redis_port}"
                            ),
                        )

                    safe_create_task(
                        create_background_stream_processor(
                            stream_generator=raw_stream,
                            redis_client=redis_client,
                            run_id=run.id,
                            run_manager=self.server.run_manager,
                            actor=actor,
                        ),
                        label=f"background_stream_processor_{run.id}",
                    )

                    raw_stream = redis_sse_stream_generator(
                        redis_client=redis_client,
                        run_id=run.id,
                    )

                # conditionally wrap with keepalive based on request parameter
                if request.include_pings and settings.enable_keepalive:
                    stream = add_keepalive_to_stream(raw_stream, keepalive_interval=settings.keepalive_interval)
                else:
                    stream = raw_stream

                result = StreamingResponseWithStatusCode(
                    stream,
                    media_type="text/event-stream",
                )
            else:
                # fallback to non-agent-loop streaming
                result = await self.server.send_message_to_agent(
                    agent_id=agent_id,
                    actor=actor,
                    input_messages=request.messages,
                    stream_steps=True,
                    stream_tokens=request.stream_tokens,
                    use_assistant_message=request.use_assistant_message,
                    assistant_message_tool_name=request.assistant_message_tool_name,
                    assistant_message_tool_kwarg=request.assistant_message_tool_kwarg,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                    include_return_message_types=request.include_return_message_types,
                )

            # update run status to running before returning
            if settings.track_agent_run and run:
                run_status = RunStatus.running

            return run, result

        except PendingApprovalError as e:
            if settings.track_agent_run:
                run_update_metadata = {"error": str(e)}
                run_status = RunStatus.failed
            raise HTTPException(
                status_code=409, detail={"code": "PENDING_APPROVAL", "message": str(e), "pending_request_id": e.pending_request_id}
            )
        except Exception as e:
            if settings.track_agent_run:
                run_update_metadata = {"error": str(e)}
                run_status = RunStatus.failed
            raise
        finally:
            if settings.track_agent_run and run:
                await self.server.run_manager.update_run_by_id_async(
                    run_id=run.id,
                    update=RunUpdate(status=run_status, metadata=run_update_metadata),
                    actor=actor,
                )

    def _create_error_aware_stream(
        self,
        agent_loop: AgentLoop,
        messages: list[MessageCreate],
        max_steps: int,
        stream_tokens: bool,
        run_id: Optional[str],
        use_assistant_message: bool,
        request_start_timestamp_ns: int,
        include_return_message_types: Optional[list[MessageType]],
        actor: User,
    ) -> AsyncIterator:
        """
        Create a stream with unified error handling.

        Returns:
            Async iterator that yields chunks with proper error handling
        """

        async def error_aware_stream():
            """Stream that handles early LLM errors gracefully in streaming format."""
            try:
                stream = agent_loop.stream(
                    input_messages=messages,
                    max_steps=max_steps,
                    stream_tokens=stream_tokens,
                    run_id=run_id,
                    use_assistant_message=use_assistant_message,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                    include_return_message_types=include_return_message_types,
                )
                async for chunk in stream:
                    yield chunk

                # update run status after completion
                if run_id and self.runs_manager:
                    if agent_loop.stop_reason.stop_reason.value == "cancelled":
                        run_status = RunStatus.cancelled
                    else:
                        run_status = RunStatus.completed

                    await self.runs_manager.update_run_by_id_async(
                        run_id=run_id,
                        update=RunUpdate(status=run_status, stop_reason=agent_loop.stop_reason.stop_reason.value),
                        actor=actor,
                    )

            except LLMTimeoutError as e:
                error_data = {"error": {"type": "llm_timeout", "message": "The LLM request timed out. Please try again.", "detail": str(e)}}
                yield (f"data: {json.dumps(error_data)}\n\n", 504)
            except LLMRateLimitError as e:
                error_data = {
                    "error": {
                        "type": "llm_rate_limit",
                        "message": "Rate limit exceeded for LLM model provider. Please wait before making another request.",
                        "detail": str(e),
                    }
                }
                yield (f"data: {json.dumps(error_data)}\n\n", 429)
            except LLMAuthenticationError as e:
                error_data = {
                    "error": {
                        "type": "llm_authentication",
                        "message": "Authentication failed with the LLM model provider.",
                        "detail": str(e),
                    }
                }
                yield (f"data: {json.dumps(error_data)}\n\n", 401)
            except LLMError as e:
                error_data = {"error": {"type": "llm_error", "message": "An error occurred with the LLM request.", "detail": str(e)}}
                yield (f"data: {json.dumps(error_data)}\n\n", 502)
            except Exception as e:
                error_data = {"error": {"type": "internal_error", "message": "An internal server error occurred.", "detail": str(e)}}
                yield (f"data: {json.dumps(error_data)}\n\n", 500)

        return error_aware_stream()

    def _is_agent_eligible(self, agent: AgentState) -> bool:
        """Check if agent is eligible for streaming."""
        return agent.multi_agent_group is None or agent.multi_agent_group.manager_type in ["sleeptime", "voice_sleeptime"]

    def _is_model_compatible(self, agent: AgentState) -> bool:
        """Check if agent's model is compatible with streaming."""
        return agent.llm_config.model_endpoint_type in [
            "anthropic",
            "openai",
            "together",
            "google_ai",
            "google_vertex",
            "bedrock",
            "ollama",
            "azure",
            "xai",
            "groq",
            "deepseek",
        ]

    def _is_token_streaming_compatible(self, agent: AgentState) -> bool:
        """Check if agent's model supports token-level streaming."""
        base_compatible = agent.llm_config.model_endpoint_type in ["anthropic", "openai", "bedrock", "deepseek"]
        google_letta_v1 = agent.agent_type == AgentType.letta_v1_agent and agent.llm_config.model_endpoint_type in [
            "google_ai",
            "google_vertex",
        ]
        return base_compatible or google_letta_v1

    async def _create_run(self, agent_id: str, request: LettaStreamingRequest, run_type: str, actor: User) -> PydanticRun:
        """Create a run for tracking execution."""
        run = await self.runs_manager.create_run(
            pydantic_run=PydanticRun(
                agent_id=agent_id,
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
        )
