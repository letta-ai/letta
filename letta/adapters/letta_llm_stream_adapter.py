from typing import AsyncGenerator

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.enums import ProviderType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.llm_config import LLMConfig
from letta.schemas.provider_trace import ProviderTraceCreate
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

    def __init__(self, llm_client: LLMClientBase, llm_config: LLMConfig, run_id: str | None = None) -> None:
        super().__init__(llm_client, llm_config)
        self.run_id = run_id
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
        if self.llm_config.model_endpoint_type in [ProviderType.anthropic, ProviderType.bedrock]:
            self.interface = AnthropicStreamingInterface(
                use_assistant_message=use_assistant_message,
                put_inner_thoughts_in_kwarg=self.llm_config.put_inner_thoughts_in_kwargs,
                requires_approval_tools=requires_approval_tools,
                run_id=self.run_id,
                step_id=step_id,
            )
        elif self.llm_config.model_endpoint_type == ProviderType.openai:
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
        async for chunk in self.interface.process(stream):  # TODO: add ttft span
            # Yield each chunk immediately as it arrives
            yield chunk

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

        # Extract usage statistics
        # Some providers don't provide usage in streaming, use fallback if needed
        if hasattr(self.interface, "input_tokens") and hasattr(self.interface, "output_tokens"):
            # Handle cases where tokens might not be set (e.g., LMStudio)
            input_tokens = self.interface.input_tokens
            output_tokens = self.interface.output_tokens

            # Fallback to estimated values if not provided
            if not input_tokens and hasattr(self.interface, "fallback_input_tokens"):
                input_tokens = self.interface.fallback_input_tokens
            if not output_tokens and hasattr(self.interface, "fallback_output_tokens"):
                output_tokens = self.interface.fallback_output_tokens

            self.usage = LettaUsageStatistics(
                step_count=1,
                completion_tokens=output_tokens or 0,
                prompt_tokens=input_tokens or 0,
                total_tokens=(input_tokens or 0) + (output_tokens or 0),
            )
        else:
            # Default usage statistics if not available
            self.usage = LettaUsageStatistics(step_count=1, completion_tokens=0, prompt_tokens=0, total_tokens=0)

        # Store any additional data from the interface
        self.message_id = self.interface.letta_message_id

        # Log request and response data
        self.log_provider_trace(step_id=step_id, actor=actor)

    def supports_token_streaming(self) -> bool:
        return True

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
        if step_id is None or actor is None or not settings.track_provider_trace:
            return

        safe_create_task(
            self.telemetry_manager.create_provider_trace_async(
                actor=actor,
                provider_trace_create=ProviderTraceCreate(
                    request_json=self.request_data,
                    response_json={
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
                    },
                    step_id=step_id,  # Use original step_id for telemetry
                ),
            ),
            label="create_provider_trace",
        )
