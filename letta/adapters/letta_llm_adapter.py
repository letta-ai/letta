from abc import ABC, abstractmethod
from typing import AsyncGenerator

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.enums import LLMCallType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, ChoiceLogprobs, ToolCall
from letta.schemas.provider_trace import BillingContext
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.services.telemetry_manager import TelemetryManager


class LettaLLMAdapter(ABC):
    """
    Base adapter for handling LLM calls in a unified way.

    This abstract class defines the interface for both blocking and streaming
    LLM interactions, allowing the agent to use different execution modes
    through a consistent API.
    """

    def __init__(
        self,
        llm_client: LLMClientBase,
        llm_config: LLMConfig,
        call_type: LLMCallType,
        agent_id: str | None = None,
        agent_tags: list[str] | None = None,
        run_id: str | None = None,
        org_id: str | None = None,
        user_id: str | None = None,
        billing_context: BillingContext | None = None,
    ) -> None:
        self.llm_client: LLMClientBase = llm_client
        self.llm_config: LLMConfig = llm_config
        self.call_type: LLMCallType = call_type
        self.agent_id: str | None = agent_id
        self.agent_tags: list[str] | None = agent_tags
        self.run_id: str | None = run_id
        self.org_id: str | None = org_id
        self.user_id: str | None = user_id
        self.billing_context: BillingContext | None = billing_context
        self.message_id: str | None = None
        self.request_data: dict | None = None
        self.response_data: dict | None = None
        self.chat_completions_response: ChatCompletionResponse | None = None
        self.reasoning_content: list[TextContent | ReasoningContent | RedactedReasoningContent] | None = None
        self.content: list[TextContent | ReasoningContent | RedactedReasoningContent] | None = None
        self.tool_call: ToolCall | None = None
        self.tool_calls: list[ToolCall] = []
        self.logprobs: ChoiceLogprobs | None = None
        # SGLang native endpoint data (for multi-turn RL training)
        self.output_ids: list[int] | None = None
        self.output_token_logprobs: list[list[float]] | None = None
        self.usage: LettaUsageStatistics = LettaUsageStatistics()
        self.telemetry_manager: TelemetryManager = TelemetryManager()
        self.llm_request_finish_timestamp_ns: int | None = None
        self._finish_reason: str | None = None

    @abstractmethod
    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,
        requires_approval_tools: list[str] = [],
        step_id: str | None = None,
        actor: User | None = None,
    ) -> AsyncGenerator[LettaMessage | None, None]:
        """
        Execute the LLM call and yield results as they become available.

        Args:
            request_data: The prepared request data for the LLM API
            messages: The messages in context for the request
            tools: The tools available for the LLM to use
            use_assistant_message: If true, use assistant messages when streaming response
            requires_approval_tools: The subset of tools that require approval before use
            step_id: The step ID associated with this request. If provided, logs request and response data.
            actor: The optional actor associated with this request for logging purposes.

        Yields:
            LettaMessage: Chunks of data for streaming adapters, or None for blocking adapters
        """
        raise NotImplementedError

    @property
    def finish_reason(self) -> str | None:
        """
        Get the finish_reason from the LLM response.

        Returns:
            str | None: The finish_reason if available, None otherwise
        """
        if self._finish_reason is not None:
            return self._finish_reason
        if self.chat_completions_response and self.chat_completions_response.choices:
            return self.chat_completions_response.choices[0].finish_reason
        return None

    def supports_token_streaming(self) -> bool:
        """
        Check if the adapter supports token-level streaming.

        Returns:
            bool: True if the adapter can stream back tokens as they are generated, False otherwise
        """
        return False

    async def aclose(self) -> None:
        """
        Clean up any resources held by the adapter.

        Subclasses that hold long-lived connections (e.g. WebSocket sessions)
        should override this to release them.  The default implementation is a no-op.
        """
        pass

    def log_provider_trace(self, step_id: str | None, actor: User | None) -> None:
        """
        Log provider trace data for telemetry purposes.

        Args:
            step_id: The step ID associated with this request for logging purposes
            actor: The user associated with this request for logging purposes
        """
        raise NotImplementedError
