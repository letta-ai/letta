from typing import AsyncGenerator

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
from letta.llm_api.llm_client_base import LLMClientBase
from letta.otel.tracing import log_attributes, safe_json_dumps, trace_method
from letta.schemas.enums import ProviderType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.llm_config import LLMConfig
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.settings import settings
from letta.utils import safe_create_task


class LettaLLMStreamAdapter(LettaLLMAdapter):
    """
    Adapter for handling streaming LLM requests with immediate token yielding.

    This adapter supports real-time streaming of tokens from the LLM, providing
    minimal time-to-first-token (TTFT) latency. It uses specialized streaming
    interfaces for different providers (OpenAI, Anthropic) to handle their
    specific streaming formats.
    """

    def __init__(
        self,
        llm_client: LLMClientBase,
        llm_config: LLMConfig,
        agent_id: str | None = None,
        agent_tags: list[str] | None = None,
        run_id: str | None = None,
        org_id: str | None = None,
        user_id: str | None = None,
    ) -> None:
        super().__init__(llm_client, llm_config, agent_id=agent_id, agent_tags=agent_tags, run_id=run_id, org_id=org_id, user_id=user_id)
        self.interface: OpenAIStreamingInterface | AnthropicStreamingInterface | None = None

    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,
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

        # Instantiate streaming interface
        if self.llm_config.model_endpoint_type in [ProviderType.anthropic, ProviderType.bedrock, ProviderType.minimax]:
            self.interface = AnthropicStreamingInterface(
                use_assistant_message=use_assistant_message,
                put_inner_thoughts_in_kwarg=self.llm_config.put_inner_thoughts_in_kwargs,
                requires_approval_tools=requires_approval_tools,
                run_id=self.run_id,
                step_id=step_id,
            )
        elif self.llm_config.model_endpoint_type in [ProviderType.openai, ProviderType.openrouter]:
            # For non-v1 agents, always use Chat Completions streaming interface
            self.interface = OpenAIStreamingInterface(
                use_assistant_message=use_assistant_message,
                is_openai_proxy=self.llm_config.provider_name == "lmstudio_openai",
                put_inner_thoughts_in_kwarg=self.llm_config.put_inner_thoughts_in_kwargs,
                messages=messages,
                tools=tools,
                requires_approval_tools=requires_approval_tools,
                run_id=self.run_id,
                step_id=step_id,
            )
        else:
            raise ValueError(f"Streaming not supported for provider {self.llm_config.model_endpoint_type}")

        # Extract optional parameters
        # ttft_span = kwargs.get('ttft_span', None)

        # Start the streaming request (map provider errors to common LLMError types)
        try:
            stream = await self.llm_client.stream_async(request_data, self.llm_config)
        except Exception as e:
            raise self.llm_client.handle_llm_error(e)

        # Process the stream and yield chunks immediately for TTFT
        # Wrap in error handling to convert provider errors to common LLMError types
        try:
            async for chunk in self.interface.process(stream):  # TODO: add ttft span
                # Yield each chunk immediately as it arrives
                yield chunk
        except Exception as e:
            raise self.llm_client.handle_llm_error(e)

        # After streaming completes, extract the accumulated data
        self.llm_request_finish_timestamp_ns = get_utc_timestamp_ns()

        # Extract tool call from the interface
        try:
            self.tool_call = self.interface.get_tool_call_object()
        except ValueError as e:
            # No tool call, handle upstream
            self.tool_call = None

        # Extract reasoning content from the interface
        self.reasoning_content = self.interface.get_reasoning_content()

        # Extract usage statistics from the streaming interface
        self.usage = self.interface.get_usage_statistics()
        self.usage.step_count = 1

        # Store any additional data from the interface
        self.message_id = self.interface.letta_message_id

        # Log request and response data
        self.log_provider_trace(step_id=step_id, actor=actor)

    def supports_token_streaming(self) -> bool:
        return True

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
                "reasoning": [content.model_dump_json() for content in self.reasoning_content],
            },
            "id": self.interface.message_id,
            "model": self.interface.model,
            "role": "assistant",
            # "stop_reason": "",
            # "stop_sequence": None,
            "type": "message",
            "usage": {
                "input_tokens": self.usage.prompt_tokens,
                "output_tokens": self.usage.completion_tokens,
            },
        }

        # Store response data for future reference
        self.response_data = response_json

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
