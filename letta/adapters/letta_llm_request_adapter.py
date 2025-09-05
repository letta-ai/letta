from typing import AsyncGenerator

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, TextContent


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
    ) -> AsyncGenerator[LettaMessage, None]:
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

        yield None
        return
