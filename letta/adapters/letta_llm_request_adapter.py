from typing import AsyncGenerator

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, TextContent
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.schemas.user import User
from letta.settings import settings
from letta.utils import safe_create_task


class LettaLLMRequestAdapter(LettaLLMAdapter):
    """
    Adapter for handling blocking (non-streaming) LLM requests.

    This adapter makes synchronous requests to the LLM and returns complete
    responses. It extracts reasoning content, tool calls, and usage statistics
    from the response and updates instance variables for access by the agent.
    """

    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,
        requires_approval_tools: list[str] = [],
        step_id: str | None = None,
        actor: str | None = None,
    ) -> AsyncGenerator[LettaMessage | None, None]:
        """
        Execute a blocking LLM request and yield the response.

        This adapter:
        1. Makes a blocking request to the LLM
        2. Converts the response to chat completion format
        3. Extracts reasoning and tool call information
        4. Updates all instance variables
        5. Yields nothing (blocking mode doesn't stream)
        """
        # Store request data
        self.request_data = request_data

        # Make the blocking LLM request
        self.response_data = await self.llm_client.request_async(request_data, self.llm_config)
        self.llm_request_finish_timestamp_ns = get_utc_timestamp_ns()

        # Convert response to chat completion format
        self.chat_completions_response = self.llm_client.convert_response_to_chat_completion(self.response_data, messages, self.llm_config)

        # Extract reasoning content from the response
        if self.chat_completions_response.choices[0].message.reasoning_content:
            self.reasoning_content = [
                ReasoningContent(
                    reasoning=self.chat_completions_response.choices[0].message.reasoning_content,
                    is_native=True,
                    signature=self.chat_completions_response.choices[0].message.reasoning_content_signature,
                )
            ]
        elif self.chat_completions_response.choices[0].message.omitted_reasoning_content:
            self.reasoning_content = [OmittedReasoningContent()]
        elif self.chat_completions_response.choices[0].message.content:
            # Reasoning placed into content for legacy reasons
            self.reasoning_content = [TextContent(text=self.chat_completions_response.choices[0].message.content)]
        else:
            # logger.info("No reasoning content found.")
            self.reasoning_content = None

        # Extract tool call
        if self.chat_completions_response.choices[0].message.tool_calls:
            self.tool_call = self.chat_completions_response.choices[0].message.tool_calls[0]
        else:
            self.tool_call = None

        # Extract usage statistics
        self.usage.step_count = 1
        self.usage.completion_tokens = self.chat_completions_response.usage.completion_tokens
        self.usage.prompt_tokens = self.chat_completions_response.usage.prompt_tokens
        self.usage.total_tokens = self.chat_completions_response.usage.total_tokens

        self.log_provider_trace(step_id=step_id, actor=actor)

        yield None
        return

    def log_provider_trace(self, step_id: str | None, actor: User | None) -> None:
        """
        Log provider trace data for telemetry purposes in a fire-and-forget manner.

        Creates an async task to log the request/response data without blocking
        the main execution flow. The task runs in the background.

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
                    response_json=self.response_data,
                    step_id=step_id,  # Use original step_id for telemetry
                ),
            ),
            label="create_provider_trace",
        )
