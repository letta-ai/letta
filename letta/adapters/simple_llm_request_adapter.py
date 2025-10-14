from typing import AsyncGenerator

from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, TextContent


class SimpleLLMRequestAdapter(LettaLLMRequestAdapter):
    """Simplifying assumptions:

    - No inner thoughts in kwargs
    - No forced tool calls
    - Content native as assistant message
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
        try:
            self.response_data = await self.llm_client.request_async(request_data, self.llm_config)
        except Exception as e:
            raise self.llm_client.handle_llm_error(e)

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
        else:
            # logger.info("No reasoning content found.")
            self.reasoning_content = None

        if self.chat_completions_response.choices[0].message.content:
            # NOTE: big difference - 'content' goes into 'content'
            # Reasoning placed into content for legacy reasons
            self.content = [TextContent(text=self.chat_completions_response.choices[0].message.content)]
        else:
            self.content = None

        if self.reasoning_content and len(self.reasoning_content) > 0:
            # Temp workaround to consolidate parts to persist reasoning content, this should be integrated better
            self.content = self.reasoning_content + (self.content or [])

        # Extract tool call
        tool_calls = self.chat_completions_response.choices[0].message.tool_calls or []
        self.tool_calls = list(tool_calls)
        self.tool_call = self.tool_calls[0] if self.tool_calls else None

        # Extract usage statistics
        self.usage.step_count = 1
        self.usage.completion_tokens = self.chat_completions_response.usage.completion_tokens
        self.usage.prompt_tokens = self.chat_completions_response.usage.prompt_tokens
        self.usage.total_tokens = self.chat_completions_response.usage.total_tokens

        self.log_provider_trace(step_id=step_id, actor=actor)

        yield None
        return
