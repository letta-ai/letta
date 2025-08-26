import os
from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.llm_api.deepseek import convert_deepseek_response_to_chatcompletion, map_messages_to_deepseek_format
from letta.llm_api.openai_client import OpenAIClient
from letta.otel.tracing import trace_method
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.settings import model_settings


class DeepseekClient(OpenAIClient):

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return False

    @trace_method
    def build_request_data(
        self,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,
        force_tool_call: Optional[str] = None,
    ) -> dict:
        # Override put_inner_thoughts_in_kwargs to False for DeepSeek
        llm_config.put_inner_thoughts_in_kwargs = False

        data = super().build_request_data(messages, llm_config, tools, force_tool_call)

        def add_functions_to_system_message(system_message: ChatMessage):
            system_message.content += f"<available functions> {''.join(json.dumps(f) for f in functions)} </available functions>"
            system_message.content += 'Select best function to call simply respond with a single json block with the fields "name" and "arguments". Use double quotes around the arguments.'

        if llm_config.model == "deepseek-reasoner":  # R1 currently doesn't support function calling natively
            add_functions_to_system_message(
                data["messages"][0]
            )  # Inject additional instructions to the system prompt with the available functions

            data["messages"] = map_messages_to_deepseek_format(data["messages"])

        return data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        api_key = model_settings.deepseek_api_key or os.environ.get("DEEPSEEK_API_KEY")
        client = OpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        api_key = model_settings.deepseek_api_key or os.environ.get("DEEPSEEK_API_KEY")
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)

        response: ChatCompletion = await client.chat.completions.create(**request_data)
        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.
        """
        api_key = model_settings.deepseek_api_key or os.environ.get("DEEPSEEK_API_KEY")
        client = AsyncOpenAI(api_key=api_key, base_url=llm_config.model_endpoint)
        response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
            **request_data, stream=True, stream_options={"include_usage": True}
        )
        return response_stream

    @trace_method
    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],  # Included for consistency, maybe used later
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Converts raw OpenAI response dict into the ChatCompletionResponse Pydantic model.
        Handles potential extraction of inner thoughts if they were added via kwargs.
        """
        response = ChatCompletionResponse(**response_data)
        return convert_deepseek_response_to_chatcompletion(response)
