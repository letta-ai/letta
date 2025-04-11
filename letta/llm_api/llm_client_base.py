from abc import abstractmethod
from typing import Dict, List, Optional, Union

from anthropic.types.beta.messages import BetaMessageBatch
from openai import AsyncStream, Stream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.errors import LLMError
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.tracing import log_event


class LLMClientBase:
    """
    Abstract base class for LLM clients, formatting the request objects,
    handling the downstream request and parsing into chat completions response format
    """

    def __init__(
        self,
        llm_config: LLMConfig,
        put_inner_thoughts_first: Optional[bool] = True,
        use_tool_naming: bool = True,
    ):
        self.llm_config = llm_config
        self.put_inner_thoughts_first = put_inner_thoughts_first
        self.use_tool_naming = use_tool_naming

    def send_llm_request(
        self,
        messages: List[Message],
        tools: Optional[List[dict]] = None,  # TODO: change to Tool object
        stream: bool = False,
        force_tool_call: Optional[str] = None,
    ) -> Union[ChatCompletionResponse, Stream[ChatCompletionChunk]]:
        """
        Issues a request to the downstream model endpoint and parses response.
        If stream=True, returns a Stream[ChatCompletionChunk] that can be iterated over.
        Otherwise returns a ChatCompletionResponse.
        """
        request_data = self.build_request_data(messages, self.llm_config, tools, force_tool_call)

        try:
            log_event(name="llm_request_sent", attributes=request_data)
            if stream:
                return self.stream(request_data)
            else:
                response_data = self.request(request_data)
            log_event(name="llm_response_received", attributes=response_data)
        except Exception as e:
            raise self.handle_llm_error(e)

        return self.convert_response_to_chat_completion(response_data, messages)

    async def send_llm_request_async(
        self,
        messages: List[Message],
        tools: Optional[List[dict]] = None,  # TODO: change to Tool object
        stream: bool = False,
        force_tool_call: Optional[str] = None,
    ) -> Union[ChatCompletionResponse, AsyncStream[ChatCompletionChunk]]:
        """
        Issues a request to the downstream model endpoint.
        If stream=True, returns an AsyncStream[ChatCompletionChunk] that can be async iterated over.
        Otherwise returns a ChatCompletionResponse.
        """
        request_data = self.build_request_data(messages, self.llm_config, tools, force_tool_call)

        try:
            log_event(name="llm_request_sent", attributes=request_data)
            if stream:
                return await self.stream_async(request_data)
            else:
                response_data = await self.request_async(request_data)
            log_event(name="llm_response_received", attributes=response_data)
        except Exception as e:
            raise self.handle_llm_error(e)

        return self.convert_response_to_chat_completion(response_data, messages)

    async def send_llm_batch_request_async(
        self,
        agent_messages_mapping: Dict[str, List[Message]],
        agent_tools_mapping: Dict[str, List[dict]],
        agent_llm_config_mapping: Dict[str, LLMConfig],
    ) -> Union[BetaMessageBatch]:
        raise NotImplementedError

    @abstractmethod
    def build_request_data(
        self,
        messages: List[Message],
        llm_config: LLMConfig,
        tools: List[dict],
        force_tool_call: Optional[str] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for this client.
        """
        raise NotImplementedError

    @abstractmethod
    def request(self, request_data: dict) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        raise NotImplementedError

    @abstractmethod
    async def request_async(self, request_data: dict) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        raise NotImplementedError

    @abstractmethod
    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[Message],
    ) -> ChatCompletionResponse:
        """
        Converts custom response format from llm client into an OpenAI
        ChatCompletionsResponse object.
        """
        raise NotImplementedError

    @abstractmethod
    def stream(self, request_data: dict) -> Stream[ChatCompletionChunk]:
        """
        Performs underlying streaming request to llm and returns raw response.
        """
        raise NotImplementedError(f"Streaming is not supported for {self.llm_config.model_endpoint_type}")

    @abstractmethod
    async def stream_async(self, request_data: dict) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying streaming request to llm and returns raw response.
        """
        raise NotImplementedError(f"Streaming is not supported for {self.llm_config.model_endpoint_type}")

    @abstractmethod
    def handle_llm_error(self, e: Exception) -> Exception:
        """
        Maps provider-specific errors to common LLMError types.
        Each LLM provider should implement this to translate their specific errors.

        Args:
            e: The original provider-specific exception

        Returns:
            An LLMError subclass that represents the error in a provider-agnostic way
        """
        return LLMError(f"Unhandled LLM error: {str(e)}")
