import json
from typing import AsyncGenerator, List

from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
from letta.log import get_logger

logger = get_logger(__name__)
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.interfaces.anthropic_parallel_tool_call_streaming_interface import SimpleAnthropicStreamingInterface
from letta.interfaces.gemini_streaming_interface import SimpleGeminiStreamingInterface
from letta.interfaces.openai_streaming_interface import SimpleOpenAIResponsesStreamingInterface, SimpleOpenAIStreamingInterface
from letta.otel.tracing import log_attributes, safe_json_dumps, trace_method
from letta.schemas.enums import ProviderType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import LettaMessageContentUnion
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.server.rest_api.streaming_response import get_cancellation_event_for_run
from letta.settings import settings
from letta.utils import safe_create_task


class SimpleLLMStreamAdapter(LettaLLMStreamAdapter):
    """
    Adapter for handling streaming LLM requests with immediate token yielding.

    This adapter supports real-time streaming of tokens from the LLM, providing
    minimal time-to-first-token (TTFT) latency. It uses specialized streaming
    interfaces for different providers (OpenAI, Anthropic) to handle their
    specific streaming formats.
    """

    def _extract_tool_calls(self) -> list:
        """extract tool calls from interface, trying parallel API first then single API"""
        # try multi-call api if available
        if hasattr(self.interface, "get_tool_call_objects"):
            try:
                calls = self.interface.get_tool_call_objects()
                if calls:
                    return calls
            except Exception:
                pass

        # fallback to single-call api
        try:
            single = self.interface.get_tool_call_object()
            return [single] if single else []
        except Exception:
            return []

    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,  # NOTE: not used
        requires_approval_tools: list[str] = [],
        step_id: str | None = None,
        actor: User | None = None,
    ) -> AsyncGenerator[LettaMessage, None]:
        """
        Execute a streaming LLM request and yield tokens/chunks as they arrive.

        This adapter:
        1. Makes a streaming request to the LLM
        2. Yields chunks immediately for minimal TTFT
        3. Accumulates response data through the streaming interface
        4. Updates all instance variables after streaming completes
        """
        # Store request data
        self.request_data = request_data

        # Get cancellation event for this run to enable graceful cancellation (before branching)
        cancellation_event = get_cancellation_event_for_run(self.run_id) if self.run_id else None

        # Instantiate streaming interface
        if self.llm_config.model_endpoint_type in [ProviderType.anthropic, ProviderType.bedrock, ProviderType.minimax]:
            # NOTE: different
            self.interface = SimpleAnthropicStreamingInterface(
                requires_approval_tools=requires_approval_tools,
                run_id=self.run_id,
                step_id=step_id,
            )
        elif self.llm_config.model_endpoint_type in [
            ProviderType.openai,
            ProviderType.deepseek,
            ProviderType.openrouter,
            ProviderType.zai,
            ProviderType.chatgpt_oauth,
        ]:
            # Decide interface based on payload shape
            use_responses = "input" in request_data and "messages" not in request_data
            # No support for Responses API proxy
            is_proxy = self.llm_config.provider_name == "lmstudio_openai"

            # ChatGPT OAuth always uses Responses API format
            if self.llm_config.model_endpoint_type == ProviderType.chatgpt_oauth:
                use_responses = True
                is_proxy = False

            if use_responses and not is_proxy:
                self.interface = SimpleOpenAIResponsesStreamingInterface(
                    is_openai_proxy=False,
                    messages=messages,
                    tools=tools,
                    requires_approval_tools=requires_approval_tools,
                    run_id=self.run_id,
                    step_id=step_id,
                    cancellation_event=cancellation_event,
                )
            else:
                self.interface = SimpleOpenAIStreamingInterface(
                    is_openai_proxy=self.llm_config.provider_name == "lmstudio_openai",
                    messages=messages,
                    tools=tools,
                    requires_approval_tools=requires_approval_tools,
                    model=self.llm_config.model,
                    run_id=self.run_id,
                    step_id=step_id,
                    cancellation_event=cancellation_event,
                )
        elif self.llm_config.model_endpoint_type in [ProviderType.google_ai, ProviderType.google_vertex]:
            self.interface = SimpleGeminiStreamingInterface(
                requires_approval_tools=requires_approval_tools,
                run_id=self.run_id,
                step_id=step_id,
                cancellation_event=cancellation_event,
            )
        else:
            raise ValueError(f"Streaming not supported for provider {self.llm_config.model_endpoint_type}")

        # Start the streaming request (map provider errors to common LLMError types)
        try:
            # Gemini uses async generator pattern (no await) to maintain connection lifecycle
            # Other providers return awaitables that resolve to iterators
            if self.llm_config.model_endpoint_type in [ProviderType.google_ai, ProviderType.google_vertex]:
                stream = self.llm_client.stream_async(request_data, self.llm_config)
            else:
                stream = await self.llm_client.stream_async(request_data, self.llm_config)
        except Exception as e:
            raise self.llm_client.handle_llm_error(e)

        # Process the stream and yield chunks immediately for TTFT
        try:
            async for chunk in self.interface.process(stream):  # TODO: add ttft span
                # Yield each chunk immediately as it arrives
                yield chunk
        except Exception as e:
            # Map provider-specific errors during streaming to common LLMError types
            raise self.llm_client.handle_llm_error(e)

        # After streaming completes, extract the accumulated data
        self.llm_request_finish_timestamp_ns = get_utc_timestamp_ns()

        # extract tool calls from interface (supports both single and parallel calls)
        self.tool_calls = self._extract_tool_calls()
        # preserve legacy single-call field for existing consumers
        self.tool_call = self.tool_calls[-1] if self.tool_calls else None

        # Extract reasoning content from the interface
        # TODO this should probably just be called "content"?
        # self.reasoning_content = self.interface.get_reasoning_content()

        # Extract all content parts
        self.content: List[LettaMessageContentUnion] = self.interface.get_content()

        # Extract usage statistics from the interface
        # Each interface implements get_usage_statistics() with provider-specific logic
        self.usage = self.interface.get_usage_statistics()
        self.usage.step_count = 1

        # Store any additional data from the interface
        self.message_id = self.interface.letta_message_id

        # Log request and response data
        self.log_provider_trace(step_id=step_id, actor=actor)

    @trace_method
    def log_provider_trace(self, step_id: str | None, actor: User | None) -> None:
        """
        Log provider trace data for telemetry purposes in a fire-and-forget manner.

        Creates an async task to log the request/response data without blocking
        the main execution flow. For streaming adapters, this includes the final
        tool call and reasoning content collected during streaming.

        Args:
            step_id: The step ID associated with this request for logging purposes
            actor: The user associated with this request for logging purposes
        """
        if step_id is None or actor is None:
            return

        response_json = {
            "content": {
                "tool_call": self.tool_call.model_dump_json() if self.tool_call else None,
                # "reasoning": [content.model_dump_json() for content in self.reasoning_content],
                # NOTE: different
                # TODO potentially split this into both content and reasoning?
                "content": [content.model_dump_json() for content in self.content],
            },
            "id": self.interface.message_id,
            "model": self.interface.model,
            "role": "assistant",
            # "stop_reason": "",
            # "stop_sequence": None,
            "type": "message",
            # Use raw_usage if available for transparent provider trace logging, else fallback
            "usage": self.interface.raw_usage
            if hasattr(self.interface, "raw_usage") and self.interface.raw_usage
            else {
                "input_tokens": self.usage.prompt_tokens,
                "output_tokens": self.usage.completion_tokens,
            },
        }

        log_attributes(
            {
                "request_data": safe_json_dumps(self.request_data),
                "response_data": safe_json_dumps(response_json),
            }
        )

        if settings.track_provider_trace:
            safe_create_task(
                self.telemetry_manager.create_provider_trace_async(
                    actor=actor,
                    provider_trace=ProviderTrace(
                        request_json=self.request_data,
                        response_json=response_json,
                        step_id=step_id,
                        agent_id=self.agent_id,
                        agent_tags=self.agent_tags,
                        run_id=self.run_id,
                        org_id=self.org_id,
                        user_id=self.user_id,
                        llm_config=self.llm_config.model_dump() if self.llm_config else None,
                    ),
                ),
                label="create_provider_trace",
            )
