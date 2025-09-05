from abc import ABC, abstractmethod
from typing import AsyncGenerator

from letta.llm_api.llm_client_base import LLMClientBase
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, ToolCall
from letta.schemas.usage import LettaUsageStatistics


class LettaLLMAdapter(ABC):
    """
    Base adapter for handling LLM calls in a unified way.

    This abstract class defines the interface for both blocking and streaming
    LLM interactions, allowing the agent to use different execution modes
    through a consistent API.
    """

    def __init__(self, llm_client: LLMClientBase, llm_config: LLMConfig):
        self.llm_client: LLMClientBase = llm_client
        self.llm_config: LLMConfig = llm_config
        self.message_id: str | None = None
        self.request_data: dict | None = None
        self.response_data: dict | None = None
        self.chat_completions_response: ChatCompletionResponse | None = None
        self.reasoning_content: list[TextContent | ReasoningContent | RedactedReasoningContent] | None = None
        self.tool_call: ToolCall | None = None
        self.usage: LettaUsageStatistics = LettaUsageStatistics()

    @abstractmethod
    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,
    ) -> AsyncGenerator[LettaMessage, None]:
        """
        Execute the LLM call and yield results as they become available.

        Args:
            request_data: The prepared request data for the LLM API
            messages: The messages in context for the request
            tools: The tools available for the LLM to use
            use_assistant_message: If true, use assistant messages when streaming response

        Yields:
            LettaMessage: Chunks of data for streaming adapters, or None for blocking adapters
        """
        raise NotImplementedError

    def supports_token_streaming(self) -> bool:
        return False
