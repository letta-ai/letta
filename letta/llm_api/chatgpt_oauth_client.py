"""ChatGPT OAuth Client - handles requests to chatgpt.com/backend-api/codex/responses."""

import json
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Union

import httpx
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk
from openai.types.responses import (
    Response,
    ResponseCompletedEvent,
    ResponseContentPartAddedEvent,
    ResponseContentPartDoneEvent,
    ResponseCreatedEvent,
    ResponseFunctionCallArgumentsDeltaEvent,
    ResponseFunctionCallArgumentsDoneEvent,
    ResponseFunctionToolCall,
    ResponseInProgressEvent,
    ResponseOutputItemAddedEvent,
    ResponseOutputItemDoneEvent,
    ResponseOutputMessage,
    ResponseOutputText,
    ResponseReasoningItem,
    ResponseReasoningSummaryPartAddedEvent,
    ResponseReasoningSummaryPartDoneEvent,
    ResponseReasoningSummaryTextDeltaEvent,
    ResponseReasoningSummaryTextDoneEvent,
    ResponseTextDeltaEvent,
    ResponseTextDoneEvent,
)
from openai.types.responses.response_stream_event import ResponseStreamEvent

from letta.errors import (
    ContextWindowExceededError,
    ErrorCode,
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
)
from letta.llm_api.llm_client_base import LLMClientBase
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import AgentType, ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    Choice,
    FunctionCall,
    Message as ChoiceMessage,
    ToolCall,
    UsageStatistics,
)
from letta.schemas.providers.chatgpt_oauth import ChatGPTOAuthCredentials, ChatGPTOAuthProvider

logger = get_logger(__name__)

# ChatGPT Backend API endpoint
CHATGPT_CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"


class AsyncStreamWrapper:
    """Wraps an async generator to provide async context manager protocol.

    The OpenAI SDK's AsyncStream implements __aenter__ and __aexit__,
    but our custom SSE handler returns a raw async generator. This wrapper
    provides the context manager protocol so it can be used with 'async with'.
    """

    def __init__(self, generator: AsyncIterator[ResponseStreamEvent]):
        self._generator = generator

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Close the generator if it has an aclose method
        if hasattr(self._generator, "aclose"):
            await self._generator.aclose()
        return False

    def __aiter__(self):
        return self

    async def __anext__(self) -> ResponseStreamEvent:
        return await self._generator.__anext__()


class ChatGPTOAuthClient(LLMClientBase):
    """
    LLM client for ChatGPT OAuth provider.

    This client:
    1. Transforms standard OpenAI chat format to ChatGPT backend Responses API format
    2. Adds required headers (Authorization, ChatGPT-Account-Id, OpenAI-Beta, OpenAI-Originator)
    3. Makes requests to chatgpt.com/backend-api/codex/responses
    4. Transforms responses back to OpenAI ChatCompletion format
    """

    @trace_method
    async def _get_provider_and_credentials_async(self, llm_config: LLMConfig) -> tuple[ChatGPTOAuthProvider, ChatGPTOAuthCredentials]:
        """Get the ChatGPT OAuth provider and credentials with automatic refresh if needed.

        Args:
            llm_config: The LLM configuration containing provider info.

        Returns:
            Tuple of (provider, credentials).

        Raises:
            LLMAuthenticationError: If credentials cannot be obtained.
        """
        from letta.services.provider_manager import ProviderManager

        if llm_config.provider_category != ProviderCategory.byok:
            raise ValueError("ChatGPT OAuth requires BYOK provider credentials")

        # Get provider
        provider_manager = ProviderManager()
        providers = await provider_manager.list_providers_async(
            name=llm_config.provider_name,
            actor=self.actor,
            provider_category=[ProviderCategory.byok],
        )

        if not providers:
            raise LLMAuthenticationError(
                message=f"ChatGPT OAuth provider '{llm_config.provider_name}' not found",
                code=ErrorCode.UNAUTHENTICATED,
            )

        provider: ChatGPTOAuthProvider = providers[0].cast_to_subtype()

        # Get credentials with automatic refresh (pass actor for persistence)
        creds = await provider.refresh_token_if_needed(actor=self.actor)
        if not creds:
            raise LLMAuthenticationError(
                message="Failed to obtain valid ChatGPT OAuth credentials",
                code=ErrorCode.UNAUTHENTICATED,
            )

        return provider, creds

    def _build_headers(self, creds: ChatGPTOAuthCredentials) -> Dict[str, str]:
        """Build required headers for ChatGPT backend API.

        Args:
            creds: OAuth credentials containing access_token and account_id.

        Returns:
            Dictionary of HTTP headers.
        """
        return {
            "Authorization": f"Bearer {creds.access_token}",
            "ChatGPT-Account-Id": creds.account_id,
            "OpenAI-Beta": "responses=v1",
            "OpenAI-Originator": "codex",
            "Content-Type": "application/json",
            "accept": "text/event-stream",
        }

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
        """
        Build request data for ChatGPT backend API in Responses API format.

        The ChatGPT backend uses the OpenAI Responses API format:
        - `input` array instead of `messages`
        - `role: "developer"` instead of `role: "system"`
        - Structured content arrays
        """
        # Use the existing method to convert messages to Responses API format
        input_messages = PydanticMessage.to_openai_responses_dicts_from_list(
            messages,
            tool_return_truncation_chars=tool_return_truncation_chars,
        )

        # Extract system message as instructions
        instructions = None
        filtered_input = []
        for msg in input_messages:
            if msg.get("role") == "developer":
                # First developer message becomes instructions
                if instructions is None:
                    content = msg.get("content", [])
                    if isinstance(content, list) and content:
                        instructions = content[0].get("text", "")
                    elif isinstance(content, str):
                        instructions = content
                else:
                    filtered_input.append(msg)
            else:
                filtered_input.append(msg)

        # Build tool_choice
        tool_choice = None
        if tools:
            if force_tool_call is not None:
                tool_choice = {"type": "function", "name": force_tool_call}
            elif requires_subsequent_tool_call:
                tool_choice = "required"
            else:
                tool_choice = "auto"

        # Build request payload for ChatGPT backend
        data: Dict[str, Any] = {
            "model": llm_config.model,
            "input": filtered_input,
            "store": False,  # Required for stateless operation
            "stream": True,  # ChatGPT backend requires streaming
        }

        if instructions:
            data["instructions"] = instructions

        if tools:
            # Convert tools to Responses API format
            responses_tools = [
                {
                    "type": "function",
                    "name": t.get("name"),
                    "description": t.get("description"),
                    "parameters": t.get("parameters"),
                }
                for t in tools
            ]
            data["tools"] = responses_tools
            data["tool_choice"] = tool_choice

        # Note: ChatGPT backend does NOT support max_output_tokens parameter

        # Add reasoning effort for reasoning models (GPT-5.x, o-series)
        if self.is_reasoning_model(llm_config) and llm_config.reasoning_effort:
            data["reasoning"] = {
                "effort": llm_config.reasoning_effort,
                "summary": "detailed",
            }

        return data

    def _transform_response_from_chatgpt_backend(self, response_data: dict) -> dict:
        """Transform ChatGPT backend response to standard OpenAI ChatCompletion format.

        The ChatGPT backend returns responses in Responses API format.
        This method normalizes them to ChatCompletion format.

        Args:
            response_data: Raw response from ChatGPT backend.

        Returns:
            Response in OpenAI ChatCompletion format.
        """
        # If response is already in ChatCompletion format, return as-is
        if "choices" in response_data:
            return response_data

        # Extract from Responses API format
        output = response_data.get("output", [])
        message_content = ""
        tool_calls = None
        reasoning_content = ""

        for item in output:
            item_type = item.get("type")

            if item_type == "message":
                content_parts = item.get("content", [])
                for part in content_parts:
                    if part.get("type") in ("output_text", "text"):
                        message_content += part.get("text", "")
                    elif part.get("type") == "refusal":
                        message_content += part.get("refusal", "")

            elif item_type == "function_call":
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append(
                    {
                        "id": item.get("call_id", item.get("id", "")),
                        "type": "function",
                        "function": {
                            "name": item.get("name", ""),
                            "arguments": item.get("arguments", ""),
                        },
                    }
                )

            elif item_type == "reasoning":
                # Capture reasoning/thinking content if present
                summary = item.get("summary", [])
                for s in summary:
                    if s.get("type") == "summary_text":
                        reasoning_content += s.get("text", "")

        # Build ChatCompletion response
        finish_reason = "stop"
        if tool_calls:
            finish_reason = "tool_calls"

        transformed = {
            "id": response_data.get("id", "chatgpt-response"),
            "object": "chat.completion",
            "created": response_data.get("created_at", 0),
            "model": response_data.get("model", ""),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": message_content or None,
                        "tool_calls": tool_calls,
                    },
                    "finish_reason": finish_reason,
                }
            ],
            "usage": self._transform_usage(response_data.get("usage", {})),
        }

        return transformed

    def _transform_usage(self, usage: dict) -> dict:
        """Transform usage statistics from Responses API format."""
        return {
            "prompt_tokens": usage.get("input_tokens", 0),
            "completion_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
        }

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """Synchronous request - not recommended for ChatGPT OAuth."""
        import asyncio

        return asyncio.run(self.request_async(request_data, llm_config))

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """Make asynchronous request to ChatGPT backend API.

        Args:
            request_data: Request payload in Responses API format.
            llm_config: LLM configuration.

        Returns:
            Response data in OpenAI ChatCompletion format.
        """
        _, creds = await self._get_provider_and_credentials_async(llm_config)
        headers = self._build_headers(creds)

        endpoint = llm_config.model_endpoint or CHATGPT_CODEX_ENDPOINT

        # ChatGPT backend requires streaming, so we use client.stream() to handle SSE
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    endpoint,
                    json=request_data,
                    headers=headers,
                    timeout=120.0,
                ) as response:
                    response.raise_for_status()
                    # Accumulate SSE events into a final response
                    return await self._accumulate_sse_response(response)

            except httpx.HTTPStatusError as e:
                raise self._handle_http_error(e)
            except httpx.TimeoutException:
                raise LLMTimeoutError(
                    message="ChatGPT backend request timed out",
                    code=ErrorCode.TIMEOUT,
                )
            except httpx.RequestError as e:
                raise LLMConnectionError(
                    message=f"Failed to connect to ChatGPT backend: {str(e)}",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                )

    async def _accumulate_sse_response(self, response: httpx.Response) -> dict:
        """Accumulate SSE stream into a final response.

        ChatGPT backend may return SSE even for non-streaming requests.
        This method accumulates all events into a single response.

        Args:
            response: httpx Response object with SSE content.

        Returns:
            Accumulated response data.
        """
        accumulated_content = ""
        accumulated_tool_calls: List[Dict[str, Any]] = []
        model = ""
        response_id = ""
        usage = {}

        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue

            data_str = line[6:]  # Remove "data: " prefix
            if data_str == "[DONE]":
                break

            try:
                event = json.loads(data_str)
            except json.JSONDecodeError:
                continue

            # Extract response metadata
            if not response_id and event.get("id"):
                response_id = event["id"]
            if not model and event.get("model"):
                model = event["model"]
            if event.get("usage"):
                usage = event["usage"]

            # Handle different event types
            event_type = event.get("type")

            if event_type == "response.output_item.done":
                item = event.get("item", {})
                item_type = item.get("type")

                if item_type == "message":
                    for content in item.get("content", []):
                        if content.get("type") in ("output_text", "text"):
                            accumulated_content += content.get("text", "")

                elif item_type == "function_call":
                    accumulated_tool_calls.append(
                        {
                            "id": item.get("call_id", item.get("id", "")),
                            "type": "function",
                            "function": {
                                "name": item.get("name", ""),
                                "arguments": item.get("arguments", ""),
                            },
                        }
                    )

            elif event_type == "response.content_part.delta":
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta":
                    accumulated_content += delta.get("text", "")

            elif event_type == "response.done":
                # Final response event
                if event.get("response", {}).get("usage"):
                    usage = event["response"]["usage"]

        # Build final response
        finish_reason = "stop" if not accumulated_tool_calls else "tool_calls"

        return {
            "id": response_id or "chatgpt-response",
            "object": "chat.completion",
            "created": 0,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": accumulated_content or None,
                        "tool_calls": accumulated_tool_calls if accumulated_tool_calls else None,
                    },
                    "finish_reason": finish_reason,
                }
            ],
            "usage": self._transform_usage(usage),
        }

    @trace_method
    async def request_embeddings(
        self,
        texts: List[str],
        embedding_config,
    ) -> List[List[float]]:
        """ChatGPT backend does not support embeddings."""
        raise NotImplementedError("ChatGPT OAuth does not support embeddings")

    @trace_method
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """Convert response to ChatCompletionResponse.

        Args:
            response_data: Response data (already in ChatCompletion format).
            input_messages: Original input messages.
            llm_config: LLM configuration.

        Returns:
            ChatCompletionResponse object.
        """
        # Response should already be in ChatCompletion format after transformation
        return ChatCompletionResponse(**response_data)

    @trace_method
    async def stream_async(
        self,
        request_data: dict,
        llm_config: LLMConfig,
    ) -> AsyncStreamWrapper:
        """Stream response from ChatGPT backend.

        Note: ChatGPT backend uses SSE by default. This returns a custom
        async generator that yields ResponseStreamEvent objects compatible
        with the OpenAI SDK.

        Args:
            request_data: Request payload.
            llm_config: LLM configuration.

        Returns:
            Async generator yielding ResponseStreamEvent objects.
        """
        _, creds = await self._get_provider_and_credentials_async(llm_config)
        headers = self._build_headers(creds)

        endpoint = llm_config.model_endpoint or CHATGPT_CODEX_ENDPOINT

        async def stream_generator():
            event_count = 0
            # Track output item index for proper event construction
            output_index = 0
            # Track sequence_number in case backend doesn't provide it
            # (OpenAI SDK expects incrementing sequence numbers starting at 0)
            sequence_counter = 0

            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    endpoint,
                    json=request_data,
                    headers=headers,
                    timeout=120.0,
                ) as response:
                    # Check for error status
                    if response.status_code != 200:
                        error_body = await response.aread()
                        logger.error(f"ChatGPT SSE error: {response.status_code} - {error_body}")
                        raise self._handle_http_error_from_status(response.status_code, error_body.decode())

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue

                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break

                        try:
                            raw_event = json.loads(data_str)
                            event_type = raw_event.get("type")
                            event_count += 1

                            # Use backend-provided sequence_number if available, else use counter
                            # This ensures proper ordering even if backend doesn't provide it
                            if "sequence_number" not in raw_event:
                                raw_event["sequence_number"] = sequence_counter
                            sequence_counter = raw_event["sequence_number"] + 1

                            # Track output index for output_item.added events
                            if event_type == "response.output_item.added":
                                output_index = raw_event.get("output_index", output_index)

                            # Convert to OpenAI SDK ResponseStreamEvent
                            sdk_event = self._convert_to_sdk_event(raw_event, output_index)
                            if sdk_event:
                                yield sdk_event

                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse SSE event: {data_str[:100]}")
                            continue

        # Wrap the async generator in AsyncStreamWrapper to provide context manager protocol
        return AsyncStreamWrapper(stream_generator())

    def _convert_to_sdk_event(
        self,
        raw_event: dict,
        output_index: int = 0,
    ) -> Optional[ResponseStreamEvent]:
        """Convert raw ChatGPT backend SSE event to OpenAI SDK ResponseStreamEvent.

        Uses model_construct() to bypass validation since ChatGPT backend doesn't
        provide all fields required by OpenAI SDK (e.g., sequence_number).

        Args:
            raw_event: Raw SSE event data from ChatGPT backend.
            output_index: Current output item index.

        Returns:
            OpenAI SDK ResponseStreamEvent or None if event type not handled.
        """
        event_type = raw_event.get("type")
        response_id = raw_event.get("response_id", "")
        seq_num = raw_event.get("sequence_number", 0)

        # response.created -> ResponseCreatedEvent
        if event_type == "response.created":
            response_data = raw_event.get("response", {})
            return ResponseCreatedEvent.model_construct(
                type="response.created",
                sequence_number=seq_num,
                response=Response.model_construct(
                    id=response_data.get("id", response_id),
                    created_at=response_data.get("created_at", 0),
                    model=response_data.get("model", ""),
                    object="response",
                    output=[],
                    status=response_data.get("status", "in_progress"),
                    parallel_tool_calls=response_data.get("parallel_tool_calls", True),
                ),
            )

        # response.in_progress -> ResponseInProgressEvent
        elif event_type == "response.in_progress":
            response_data = raw_event.get("response", {})
            return ResponseInProgressEvent.model_construct(
                type="response.in_progress",
                sequence_number=seq_num,
                response=Response.model_construct(
                    id=response_data.get("id", response_id),
                    created_at=response_data.get("created_at", 0),
                    model=response_data.get("model", ""),
                    object="response",
                    output=[],
                    status="in_progress",
                    parallel_tool_calls=response_data.get("parallel_tool_calls", True),
                ),
            )

        # response.output_item.added -> ResponseOutputItemAddedEvent
        elif event_type == "response.output_item.added":
            item_data = raw_event.get("item", {})
            item_type = item_data.get("type")
            idx = raw_event.get("output_index", output_index)

            if item_type == "message":
                item = ResponseOutputMessage.model_construct(
                    id=item_data.get("id", ""),
                    type="message",
                    role=item_data.get("role", "assistant"),
                    content=[],
                    status=item_data.get("status", "in_progress"),
                )
            elif item_type == "function_call":
                item = ResponseFunctionToolCall.model_construct(
                    id=item_data.get("id", ""),
                    type="function_call",
                    call_id=item_data.get("call_id", ""),
                    name=item_data.get("name", ""),
                    arguments=item_data.get("arguments", ""),
                    status=item_data.get("status", "in_progress"),
                )
            elif item_type == "reasoning":
                # Reasoning item for o-series, GPT-5 models
                item = ResponseReasoningItem.model_construct(
                    id=item_data.get("id", ""),
                    type="reasoning",
                    summary=item_data.get("summary", []),
                    status=item_data.get("status", "in_progress"),
                )
            else:
                # Unknown item type, skip
                return None

            return ResponseOutputItemAddedEvent.model_construct(
                type="response.output_item.added",
                sequence_number=seq_num,
                output_index=idx,
                item=item,
            )

        # response.content_part.added -> ResponseContentPartAddedEvent
        elif event_type == "response.content_part.added":
            part_data = raw_event.get("part", {})
            return ResponseContentPartAddedEvent.model_construct(
                type="response.content_part.added",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                content_index=raw_event.get("content_index", 0),
                part=ResponseOutputText.model_construct(
                    type="output_text",
                    text=part_data.get("text", ""),
                    annotations=[],
                ),
            )

        # response.output_text.delta -> ResponseTextDeltaEvent
        # Note: OpenAI SDK uses "response.output_text.delta" (matching ChatGPT backend)
        elif event_type == "response.output_text.delta":
            return ResponseTextDeltaEvent.model_construct(
                type="response.output_text.delta",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                content_index=raw_event.get("content_index", 0),
                delta=raw_event.get("delta", ""),
            )

        # response.output_text.done -> ResponseTextDoneEvent
        elif event_type == "response.output_text.done":
            return ResponseTextDoneEvent.model_construct(
                type="response.output_text.done",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                content_index=raw_event.get("content_index", 0),
                text=raw_event.get("text", ""),
            )

        # response.function_call_arguments.delta -> ResponseFunctionCallArgumentsDeltaEvent
        elif event_type == "response.function_call_arguments.delta":
            return ResponseFunctionCallArgumentsDeltaEvent.model_construct(
                type="response.function_call_arguments.delta",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                call_id=raw_event.get("call_id", ""),
                delta=raw_event.get("delta", ""),
            )

        # response.function_call_arguments.done -> ResponseFunctionCallArgumentsDoneEvent
        elif event_type == "response.function_call_arguments.done":
            return ResponseFunctionCallArgumentsDoneEvent.model_construct(
                type="response.function_call_arguments.done",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                call_id=raw_event.get("call_id", ""),
                arguments=raw_event.get("arguments", ""),
            )

        # response.content_part.done -> ResponseContentPartDoneEvent
        elif event_type == "response.content_part.done":
            part_data = raw_event.get("part", {})
            return ResponseContentPartDoneEvent.model_construct(
                type="response.content_part.done",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                content_index=raw_event.get("content_index", 0),
                part=ResponseOutputText.model_construct(
                    type="output_text",
                    text=part_data.get("text", ""),
                    annotations=[],
                ),
            )

        # response.output_item.done -> ResponseOutputItemDoneEvent
        elif event_type == "response.output_item.done":
            item_data = raw_event.get("item", {})
            item_type = item_data.get("type")
            idx = raw_event.get("output_index", output_index)

            if item_type == "message":
                # Build content from item data
                content_list = []
                for c in item_data.get("content", []):
                    if c.get("type") in ("output_text", "text"):
                        content_list.append(
                            ResponseOutputText.model_construct(
                                type="output_text",
                                text=c.get("text", ""),
                                annotations=[],
                            )
                        )
                item = ResponseOutputMessage.model_construct(
                    id=item_data.get("id", ""),
                    type="message",
                    role=item_data.get("role", "assistant"),
                    content=content_list,
                    status=item_data.get("status", "completed"),
                )
            elif item_type == "function_call":
                item = ResponseFunctionToolCall.model_construct(
                    id=item_data.get("id", ""),
                    type="function_call",
                    call_id=item_data.get("call_id", ""),
                    name=item_data.get("name", ""),
                    arguments=item_data.get("arguments", ""),
                    status=item_data.get("status", "completed"),
                )
            elif item_type == "reasoning":
                # Build summary from item data
                summary_list = item_data.get("summary", [])
                item = ResponseReasoningItem.model_construct(
                    id=item_data.get("id", ""),
                    type="reasoning",
                    summary=summary_list,
                    status=item_data.get("status", "completed"),
                )
            else:
                return None

            return ResponseOutputItemDoneEvent.model_construct(
                type="response.output_item.done",
                sequence_number=seq_num,
                output_index=idx,
                item=item,
            )

        # response.completed or response.done -> ResponseCompletedEvent
        elif event_type in ("response.completed", "response.done"):
            response_data = raw_event.get("response", {})

            # Build output items from response data
            output_items = []
            for out in response_data.get("output", []):
                out_type = out.get("type")
                if out_type == "message":
                    content_list = []
                    for c in out.get("content", []):
                        if c.get("type") in ("output_text", "text"):
                            content_list.append(
                                ResponseOutputText.model_construct(
                                    type="output_text",
                                    text=c.get("text", ""),
                                    annotations=[],
                                )
                            )
                    output_items.append(
                        ResponseOutputMessage.model_construct(
                            id=out.get("id", ""),
                            type="message",
                            role=out.get("role", "assistant"),
                            content=content_list,
                            status=out.get("status", "completed"),
                        )
                    )
                elif out_type == "function_call":
                    output_items.append(
                        ResponseFunctionToolCall.model_construct(
                            id=out.get("id", ""),
                            type="function_call",
                            call_id=out.get("call_id", ""),
                            name=out.get("name", ""),
                            arguments=out.get("arguments", ""),
                            status=out.get("status", "completed"),
                        )
                    )

            return ResponseCompletedEvent.model_construct(
                type="response.completed",
                sequence_number=seq_num,
                response=Response.model_construct(
                    id=response_data.get("id", response_id),
                    created_at=response_data.get("created_at", 0),
                    model=response_data.get("model", ""),
                    object="response",
                    output=output_items,
                    status=response_data.get("status", "completed"),
                    parallel_tool_calls=response_data.get("parallel_tool_calls", True),
                    usage=response_data.get("usage"),
                ),
            )

        # Reasoning events (for o-series, GPT-5 models)
        # response.reasoning_summary_part.added -> ResponseReasoningSummaryPartAddedEvent
        elif event_type == "response.reasoning_summary_part.added":
            part_data = raw_event.get("part", {})
            # Use a simple dict for Part since we use model_construct
            part = {"text": part_data.get("text", ""), "type": part_data.get("type", "summary_text")}
            return ResponseReasoningSummaryPartAddedEvent.model_construct(
                type="response.reasoning_summary_part.added",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                summary_index=raw_event.get("summary_index", 0),
                part=part,
            )

        # response.reasoning_summary_text.delta -> ResponseReasoningSummaryTextDeltaEvent
        elif event_type == "response.reasoning_summary_text.delta":
            return ResponseReasoningSummaryTextDeltaEvent.model_construct(
                type="response.reasoning_summary_text.delta",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                summary_index=raw_event.get("summary_index", 0),
                delta=raw_event.get("delta", ""),
            )

        # response.reasoning_summary_text.done -> ResponseReasoningSummaryTextDoneEvent
        elif event_type == "response.reasoning_summary_text.done":
            return ResponseReasoningSummaryTextDoneEvent.model_construct(
                type="response.reasoning_summary_text.done",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                summary_index=raw_event.get("summary_index", 0),
                text=raw_event.get("text", ""),
            )

        # response.reasoning_summary_part.done -> ResponseReasoningSummaryPartDoneEvent
        elif event_type == "response.reasoning_summary_part.done":
            part_data = raw_event.get("part", {})
            part = {"text": part_data.get("text", ""), "type": part_data.get("type", "summary_text")}
            return ResponseReasoningSummaryPartDoneEvent.model_construct(
                type="response.reasoning_summary_part.done",
                sequence_number=seq_num,
                item_id=raw_event.get("item_id", ""),
                output_index=raw_event.get("output_index", output_index),
                summary_index=raw_event.get("summary_index", 0),
                part=part,
            )

        # Unhandled event types - log for debugging
        logger.debug(f"Unhandled SSE event type: {event_type}")
        return None

    def _handle_http_error_from_status(self, status_code: int, error_body: str) -> Exception:
        """Create appropriate exception from HTTP status code.

        Args:
            status_code: HTTP status code.
            error_body: Error response body.

        Returns:
            Appropriate LLM exception.
        """
        if status_code == 401:
            return LLMAuthenticationError(
                message=f"ChatGPT authentication failed: {error_body}",
                code=ErrorCode.UNAUTHENTICATED,
            )
        elif status_code == 429:
            return LLMRateLimitError(
                message=f"ChatGPT rate limit exceeded: {error_body}",
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
            )
        elif status_code >= 500:
            return LLMServerError(
                message=f"ChatGPT server error: {error_body}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )
        else:
            return LLMBadRequestError(
                message=f"ChatGPT request failed ({status_code}): {error_body}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        """Check if model is a reasoning model.

        Args:
            llm_config: LLM configuration.

        Returns:
            True if model supports extended reasoning.
        """
        model = llm_config.model.lower()
        return "o1" in model or "o3" in model or "o4" in model or "gpt-5" in model

    @trace_method
    def handle_llm_error(self, e: Exception) -> Exception:
        """Map ChatGPT-specific errors to common LLMError types.

        Args:
            e: Original exception.

        Returns:
            Mapped LLMError subclass.
        """
        if isinstance(e, httpx.HTTPStatusError):
            return self._handle_http_error(e)

        return super().handle_llm_error(e)

    def _handle_http_error(self, e: httpx.HTTPStatusError) -> Exception:
        """Handle HTTP status errors from ChatGPT backend.

        Args:
            e: HTTP status error.

        Returns:
            Appropriate LLMError subclass.
        """
        status_code = e.response.status_code
        error_text = str(e)

        try:
            error_json = e.response.json()
            error_message = error_json.get("error", {}).get("message", error_text)
        except Exception:
            error_message = error_text

        if status_code == 401:
            return LLMAuthenticationError(
                message=f"ChatGPT authentication failed: {error_message}",
                code=ErrorCode.UNAUTHENTICATED,
            )
        elif status_code == 429:
            return LLMRateLimitError(
                message=f"ChatGPT rate limit exceeded: {error_message}",
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
            )
        elif status_code == 400:
            if "context" in error_message.lower() or "token" in error_message.lower():
                return ContextWindowExceededError(
                    message=f"ChatGPT context window exceeded: {error_message}",
                )
            return LLMBadRequestError(
                message=f"ChatGPT bad request: {error_message}",
                code=ErrorCode.INVALID_ARGUMENT,
            )
        elif status_code >= 500:
            return LLMServerError(
                message=f"ChatGPT server error: {error_message}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )
        else:
            return LLMBadRequestError(
                message=f"ChatGPT request failed ({status_code}): {error_message}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )
