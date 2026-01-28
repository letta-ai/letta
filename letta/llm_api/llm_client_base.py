import json
from abc import abstractmethod
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple, Union

import httpx
from anthropic.types.beta.messages import BetaMessageBatch
from openai import AsyncStream, Stream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.errors import ErrorCode, LLMConnectionError, LLMError
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import AgentType, ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.schemas.provider_trace import ProviderTrace
from letta.services.telemetry_manager import TelemetryManager
from letta.settings import settings

if TYPE_CHECKING:
    from letta.orm import User


class LLMClientBase:
    """
    Abstract base class for LLM clients, formatting the request objects,
    handling the downstream request and parsing into chat completions response format
    """

    def __init__(
        self,
        put_inner_thoughts_first: Optional[bool] = True,
        use_tool_naming: bool = True,
        actor: Optional["User"] = None,
    ):
        self.actor = actor
        self.put_inner_thoughts_first = put_inner_thoughts_first
        self.use_tool_naming = use_tool_naming
        self._telemetry_manager: Optional["TelemetryManager"] = None
        self._telemetry_agent_id: Optional[str] = None
        self._telemetry_agent_tags: Optional[List[str]] = None
        self._telemetry_run_id: Optional[str] = None
        self._telemetry_step_id: Optional[str] = None
        self._telemetry_call_type: Optional[str] = None

    def set_telemetry_context(
        self,
        telemetry_manager: Optional["TelemetryManager"] = None,
        agent_id: Optional[str] = None,
        agent_tags: Optional[List[str]] = None,
        run_id: Optional[str] = None,
        step_id: Optional[str] = None,
        call_type: Optional[str] = None,
    ) -> None:
        """Set telemetry context for provider trace logging."""
        self._telemetry_manager = telemetry_manager
        self._telemetry_agent_id = agent_id
        self._telemetry_agent_tags = agent_tags
        self._telemetry_run_id = run_id
        self._telemetry_step_id = step_id
        self._telemetry_call_type = call_type

    async def request_async_with_telemetry(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """Wrapper around request_async that logs telemetry for all requests including errors.

        Call set_telemetry_context() first to set agent_id, run_id, etc.
        """
        from letta.log import get_logger

        logger = get_logger(__name__)
        response_data = None
        error_msg = None
        error_type = None
        try:
            response_data = await self.request_async(request_data, llm_config)
            return response_data
        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__
            raise
        finally:
            if self._telemetry_manager and settings.track_provider_trace:
                if self.actor is None:
                    logger.warning(f"Skipping telemetry: actor is None (call_type={self._telemetry_call_type})")
                else:
                    try:
                        pydantic_actor = self.actor.to_pydantic() if hasattr(self.actor, "to_pydantic") else self.actor
                        await self._telemetry_manager.create_provider_trace_async(
                            actor=pydantic_actor,
                            provider_trace=ProviderTrace(
                                request_json=request_data,
                                response_json=response_data if response_data else {"error": error_msg, "error_type": error_type},
                                step_id=self._telemetry_step_id,
                                agent_id=self._telemetry_agent_id,
                                agent_tags=self._telemetry_agent_tags,
                                run_id=self._telemetry_run_id,
                                call_type=self._telemetry_call_type,
                            ),
                        )
                    except Exception as e:
                        logger.warning(f"Failed to log telemetry: {e}")

    async def stream_async_with_telemetry(self, request_data: dict, llm_config: LLMConfig):
        """Returns raw stream. Caller should log telemetry after processing via log_provider_trace_async().

        Call set_telemetry_context() first to set agent_id, run_id, etc.
        After consuming the stream, call log_provider_trace_async() with the response data.
        """
        return await self.stream_async(request_data, llm_config)

    async def log_provider_trace_async(self, request_data: dict, response_json: dict) -> None:
        """Log provider trace telemetry. Call after processing LLM response.

        Uses telemetry context set via set_telemetry_context().
        """
        from letta.log import get_logger

        logger = get_logger(__name__)

        if not self._telemetry_manager or not settings.track_provider_trace:
            return

        if self.actor is None:
            logger.warning(f"Skipping telemetry: actor is None (call_type={self._telemetry_call_type})")
            return

        try:
            pydantic_actor = self.actor.to_pydantic() if hasattr(self.actor, "to_pydantic") else self.actor
            await self._telemetry_manager.create_provider_trace_async(
                actor=pydantic_actor,
                provider_trace=ProviderTrace(
                    request_json=request_data,
                    response_json=response_json,
                    step_id=self._telemetry_step_id,
                    agent_id=self._telemetry_agent_id,
                    agent_tags=self._telemetry_agent_tags,
                    run_id=self._telemetry_run_id,
                    call_type=self._telemetry_call_type,
                ),
            )
        except Exception as e:
            logger.warning(f"Failed to log telemetry: {e}")

    @trace_method
    async def send_llm_request(
        self,
        agent_type: AgentType,
        messages: List[Message],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,  # TODO: change to Tool object
        force_tool_call: Optional[str] = None,
        telemetry_manager: Optional["TelemetryManager"] = None,
        step_id: Optional[str] = None,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> Union[ChatCompletionResponse, Stream[ChatCompletionChunk]]:
        """
        Issues a request to the downstream model endpoint and parses response.
        If stream=True, returns a Stream[ChatCompletionChunk] that can be iterated over.
        Otherwise returns a ChatCompletionResponse.
        """
        request_data = self.build_request_data(
            agent_type,
            messages,
            llm_config,
            tools,
            force_tool_call,
            requires_subsequent_tool_call=False,
            tool_return_truncation_chars=tool_return_truncation_chars,
        )

        try:
            log_event(name="llm_request_sent", attributes=request_data)
            response_data = await self.request_async(request_data, llm_config)
            if step_id and telemetry_manager:
                telemetry_manager.create_provider_trace(
                    actor=self.actor,
                    provider_trace=ProviderTrace(
                        request_json=request_data,
                        response_json=response_data,
                        step_id=step_id,
                    ),
                )
            log_event(name="llm_response_received", attributes=response_data)
        except Exception as e:
            raise self.handle_llm_error(e)

        return await self.convert_response_to_chat_completion(response_data, messages, llm_config)

    @trace_method
    async def send_llm_request_async(
        self,
        request_data: dict,
        messages: List[Message],
        llm_config: LLMConfig,
        telemetry_manager: "TelemetryManager | None" = None,
        step_id: str | None = None,
    ) -> Union[ChatCompletionResponse, AsyncStream[ChatCompletionChunk]]:
        """
        Issues a request to the downstream model endpoint.
        If stream=True, returns an AsyncStream[ChatCompletionChunk] that can be async iterated over.
        Otherwise returns a ChatCompletionResponse.
        """

        try:
            log_event(name="llm_request_sent", attributes=request_data)
            response_data = await self.request_async(request_data, llm_config)
            if settings.track_provider_trace and telemetry_manager:
                await telemetry_manager.create_provider_trace_async(
                    actor=self.actor,
                    provider_trace=ProviderTrace(
                        request_json=request_data,
                        response_json=response_data,
                        step_id=step_id,
                    ),
                )

            log_event(name="llm_response_received", attributes=response_data)
        except Exception as e:
            raise self.handle_llm_error(e)

        return await self.convert_response_to_chat_completion(response_data, messages, llm_config)

    async def send_llm_batch_request_async(
        self,
        agent_type: AgentType,
        agent_messages_mapping: Dict[str, List[Message]],
        agent_tools_mapping: Dict[str, List[dict]],
        agent_llm_config_mapping: Dict[str, LLMConfig],
    ) -> Union[BetaMessageBatch]:
        """
        Issues a batch request to the downstream model endpoint and parses response.
        """
        raise NotImplementedError

    @abstractmethod
    def build_request_data(
        self,
        agent_type: AgentType,
        messages: List[Message],
        llm_config: LLMConfig,
        tools: List[dict],
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for this client.

        Args:
            tool_return_truncation_chars: If set, truncates tool return content to this many characters.
                                         Used during summarization to avoid context window issues.
        """
        raise NotImplementedError

    @abstractmethod
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        raise NotImplementedError

    @abstractmethod
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        raise NotImplementedError

    @abstractmethod
    async def request_embeddings(self, texts: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts (List[str]): List of texts to generate embeddings for.
            embedding_config (EmbeddingConfig): Configuration for the embedding model.

        Returns:
            embeddings (List[List[float]]): List of embeddings for the input texts.
        """
        raise NotImplementedError

    @abstractmethod
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[Message],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Converts custom response format from llm client into an OpenAI
        ChatCompletionsResponse object.
        """
        raise NotImplementedError

    @abstractmethod
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying streaming request to llm and returns raw response.
        """
        raise NotImplementedError(f"Streaming is not supported for {llm_config.model_endpoint_type}")

    @abstractmethod
    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        """
        Returns True if the model is a native reasoning model.
        """
        raise NotImplementedError

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
        # Handle httpx.RemoteProtocolError which can occur during streaming
        # when the remote server closes the connection unexpectedly
        # (e.g., "peer closed connection without sending complete message body")
        if isinstance(e, httpx.RemoteProtocolError):
            from letta.log import get_logger

            logger = get_logger(__name__)
            logger.warning(f"[LLM] Remote protocol error during streaming: {e}")
            return LLMConnectionError(
                message=f"Connection error during streaming: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None},
            )

        return LLMError(f"Unhandled LLM error: {str(e)}")

    def get_byok_overrides(self, llm_config: LLMConfig) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Returns the override key for the given llm config.
        Only fetches API key from database for BYOK providers.
        Base providers use environment variables directly.
        """
        api_key = None
        # Only fetch API key from database for BYOK providers
        # Base providers should always use environment variables
        if llm_config.provider_category == ProviderCategory.byok:
            from letta.services.provider_manager import ProviderManager

            api_key = ProviderManager().get_override_key(llm_config.provider_name, actor=self.actor)
            # If we got an empty string from the database, treat it as None
            # so the client can fall back to environment variables or default behavior
            if api_key == "":
                api_key = None

        return api_key, None, None

    async def get_byok_overrides_async(self, llm_config: LLMConfig) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Returns the override key for the given llm config.
        Only fetches API key from database for BYOK providers.
        Base providers use environment variables directly.
        """
        api_key = None
        # Only fetch API key from database for BYOK providers
        # Base providers should always use environment variables
        if llm_config.provider_category == ProviderCategory.byok:
            from letta.services.provider_manager import ProviderManager

            api_key = await ProviderManager().get_override_key_async(llm_config.provider_name, actor=self.actor)
            # If we got an empty string from the database, treat it as None
            # so the client can fall back to environment variables or default behavior
            if api_key == "":
                api_key = None

        return api_key, None, None

    def _fix_truncated_json_response(self, response: ChatCompletionResponse) -> ChatCompletionResponse:
        """
        Fixes truncated JSON responses by ensuring the content is properly formatted.
        This is a workaround for some providers that may return incomplete JSON.
        """
        if response.choices and response.choices[0].message and response.choices[0].message.tool_calls:
            tool_call_args_str = response.choices[0].message.tool_calls[0].function.arguments
            try:
                json.loads(tool_call_args_str)
            except json.JSONDecodeError:
                try:
                    json_str_end = ""
                    quote_count = tool_call_args_str.count('"')
                    if quote_count % 2 != 0:
                        json_str_end = json_str_end + '"'

                    open_braces = tool_call_args_str.count("{")
                    close_braces = tool_call_args_str.count("}")
                    missing_braces = open_braces - close_braces
                    json_str_end += "}" * missing_braces
                    fixed_tool_call_args_str = tool_call_args_str[: -len(json_str_end)] + json_str_end
                    json.loads(fixed_tool_call_args_str)
                    response.choices[0].message.tool_calls[0].function.arguments = fixed_tool_call_args_str
                except json.JSONDecodeError:
                    pass
        return response
