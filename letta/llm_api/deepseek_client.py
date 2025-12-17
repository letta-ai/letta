import os
from typing import List, Optional

from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.llm_api.openai_client import OpenAIClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import AgentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.settings import model_settings

logger = get_logger(__name__)


def _strip_reasoning_content_for_new_user_turn(messages: List[dict]) -> List[dict]:
    """
    DeepSeek thinking mode wants reasoning_content during the active turn (e.g., before tool calls finish),
    but it should be dropped once a new user question begins.
    """
    if not messages or messages[-1].get("role") != "user":
        return messages

    cleaned: List[dict] = []
    for msg in messages:
        if msg.get("role") == "assistant":
            msg = dict(msg)
            msg.pop("reasoning_content", None)
            msg.pop("reasoning_content_signature", None)
            msg.pop("redacted_reasoning_content", None)
        cleaned.append(msg)
    return cleaned


class DeepseekClient(OpenAIClient):
    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return False

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return False

    @trace_method
    def build_request_data(
        self,
        agent_type: AgentType,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict:
        # DeepSeek thinking mode surfaces reasoning_content; keep it for active turns, drop for new user turns.
        llm_config.put_inner_thoughts_in_kwargs = False

        data = super().build_request_data(
            agent_type,
            messages,
            llm_config,
            tools,
            force_tool_call,
            requires_subsequent_tool_call,
            tool_return_truncation_chars,
        )

        if "messages" in data:
            for msg in data["messages"]:
                if msg.get("role") == "assistant" and msg.get("tool_calls") and msg.get("reasoning_content") is None:
                    # DeepSeek requires reasoning_content whenever tool_calls are present in thinking mode.
                    msg["reasoning_content"] = ""
            data["messages"] = _strip_reasoning_content_for_new_user_turn(data["messages"])

        # DeepSeek reasoning models ignore/ reject some sampling params; avoid sending them.
        if llm_config.model and "reasoner" in llm_config.model:
            for unsupported in ("temperature", "top_p", "presence_penalty", "frequency_penalty", "logprobs", "top_logprobs"):
                data.pop(unsupported, None)

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
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],  # Included for consistency, maybe used later
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Use native tool-calling and reasoning_content in DeepSeek responses; no custom parsing needed.
        """
        return await super().convert_response_to_chat_completion(response_data, input_messages, llm_config)
