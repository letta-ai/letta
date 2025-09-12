import json
import logging
import re
from typing import Dict, List, Optional, Union

import anthropic
from anthropic import AsyncStream
from anthropic.types.beta import BetaMessage as AnthropicMessage, BetaRawMessageStreamEvent
from anthropic.types.beta.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.beta.messages import BetaMessageBatch
from anthropic.types.beta.messages.batch_create_params import Request

from letta.constants import FUNC_FAILED_HEARTBEAT_MESSAGE, REQ_HEARTBEAT_MESSAGE
from letta.errors import (
    ContextWindowExceededError,
    ErrorCode,
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
    LLMUnprocessableEntityError,
)
from letta.helpers.datetime_helpers import get_utc_time_int
from letta.helpers.decorators import deprecated
from letta.llm_api.helpers import add_inner_thoughts_to_functions, unpack_all_inner_thoughts_from_kwargs
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_request import Tool as OpenAITool
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    Choice,
    FunctionCall,
    Message as ChoiceMessage,
    ToolCall,
    UsageStatistics,
)
from letta.settings import model_settings

DUMMY_FIRST_USER_MESSAGE = "User initializing bootup sequence."

logger = get_logger(__name__)


class AnthropicClient(LLMClientBase):
    @trace_method
    @deprecated("Synchronous version of this is no longer valid. Will result in model_dump of coroutine")
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        client = self._get_anthropic_client(llm_config, async_client=False)
        response = client.beta.messages.create(**request_data)
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        client = await self._get_anthropic_client_async(llm_config, async_client=True)

        if llm_config.enable_reasoner:
            response = await client.beta.messages.create(**request_data, betas=["interleaved-thinking-2025-05-14"])
        else:
            response = await client.beta.messages.create(**request_data)

        return response.model_dump()

    @trace_method
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[BetaRawMessageStreamEvent]:
        client = await self._get_anthropic_client_async(llm_config, async_client=True)
        request_data["stream"] = True

        # Add fine-grained tool streaming beta header for better streaming performance
        # This helps reduce buffering when streaming tool call parameters
        # See: https://docs.anthropic.com/en/docs/build-with-claude/tool-use/fine-grained-streaming
        betas = ["fine-grained-tool-streaming-2025-05-14"]

        # If extended thinking, turn on interleaved header
        # https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#interleaved-thinking
        if llm_config.enable_reasoner:
            betas.append("interleaved-thinking-2025-05-14")

        return await client.beta.messages.create(**request_data, betas=betas)

    @trace_method
    async def send_llm_batch_request_async(
        self,
        agent_messages_mapping: Dict[str, List[PydanticMessage]],
        agent_tools_mapping: Dict[str, List[dict]],
        agent_llm_config_mapping: Dict[str, LLMConfig],
    ) -> BetaMessageBatch:
        """
        Sends a batch request to the Anthropic API using the provided agent messages and tools mappings.

        Args:
            agent_messages_mapping: A dict mapping agent_id to their list of PydanticMessages.
            agent_tools_mapping: A dict mapping agent_id to their list of tool dicts.
            agent_llm_config_mapping: A dict mapping agent_id to their LLM config

        Returns:
            BetaMessageBatch: The batch response from the Anthropic API.

        Raises:
            ValueError: If the sets of agent_ids in the two mappings do not match.
            Exception: Transformed errors from the underlying API call.
        """
        # Validate that both mappings use the same set of agent_ids.
        if set(agent_messages_mapping.keys()) != set(agent_tools_mapping.keys()):
            raise ValueError("Agent mappings for messages and tools must use the same agent_ids.")

        try:
            requests = {
                agent_id: self.build_request_data(
                    messages=agent_messages_mapping[agent_id],
                    llm_config=agent_llm_config_mapping[agent_id],
                    tools=agent_tools_mapping[agent_id],
                )
                for agent_id in agent_messages_mapping
            }

            client = await self._get_anthropic_client_async(list(agent_llm_config_mapping.values())[0], async_client=True)

            anthropic_requests = [
                Request(custom_id=agent_id, params=MessageCreateParamsNonStreaming(**params)) for agent_id, params in requests.items()
            ]

            batch_response = await client.beta.messages.batches.create(requests=anthropic_requests)

            return batch_response

        except Exception as e:
            # Enhance logging here if additional context is needed
            logger.error("Error during send_llm_batch_request_async.", exc_info=True)
            raise self.handle_llm_error(e)

    @trace_method
    def _get_anthropic_client(
        self, llm_config: LLMConfig, async_client: bool = False
    ) -> Union[anthropic.AsyncAnthropic, anthropic.Anthropic]:
        api_key, _, _ = self.get_byok_overrides(llm_config)

        if async_client:
            return (
                anthropic.AsyncAnthropic(api_key=api_key, max_retries=model_settings.anthropic_max_retries)
                if api_key
                else anthropic.AsyncAnthropic(max_retries=model_settings.anthropic_max_retries)
            )
        return (
            anthropic.Anthropic(api_key=api_key, max_retries=model_settings.anthropic_max_retries)
            if api_key
            else anthropic.Anthropic(max_retries=model_settings.anthropic_max_retries)
        )

    @trace_method
    async def _get_anthropic_client_async(
        self, llm_config: LLMConfig, async_client: bool = False
    ) -> Union[anthropic.AsyncAnthropic, anthropic.Anthropic]:
        api_key, _, _ = await self.get_byok_overrides_async(llm_config)

        if async_client:
            return (
                anthropic.AsyncAnthropic(api_key=api_key, max_retries=model_settings.anthropic_max_retries)
                if api_key
                else anthropic.AsyncAnthropic(max_retries=model_settings.anthropic_max_retries)
            )
        return (
            anthropic.Anthropic(api_key=api_key, max_retries=model_settings.anthropic_max_retries)
            if api_key
            else anthropic.Anthropic(max_retries=model_settings.anthropic_max_retries)
        )

    @trace_method
    def build_request_data(
        self,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,
        force_tool_call: Optional[str] = None,
    ) -> dict:
        # TODO: This needs to get cleaned up. The logic here is pretty confusing.
        # TODO: I really want to get rid of prefixing, it's a recipe for disaster code maintenance wise
        prefix_fill = True
        if not self.use_tool_naming:
            raise NotImplementedError("Only tool calling supported on Anthropic API requests")

        if not llm_config.max_tokens:
            # TODO strip this default once we add provider-specific defaults
            max_output_tokens = 4096  # the minimum max tokens (for Haiku 3)
        else:
            max_output_tokens = llm_config.max_tokens

        data = {
            "model": llm_config.model,
            "max_tokens": max_output_tokens,
            "temperature": llm_config.temperature,
        }

        # Extended Thinking
        if self.is_reasoning_model(llm_config) and llm_config.enable_reasoner:
            thinking_budget = max(llm_config.max_reasoning_tokens, 1024)
            if thinking_budget != llm_config.max_reasoning_tokens:
                logger.warning(
                    f"Max reasoning tokens must be at least 1024 for Claude. Setting max_reasoning_tokens to 1024 for model {llm_config.model}."
                )
            data["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget,
            }
            # `temperature` may only be set to 1 when thinking is enabled. Please consult our documentation at https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#important-considerations-when-using-extended-thinking'
            data["temperature"] = 1.0

            # Silently disable prefix_fill for now
            prefix_fill = False

        # Tools
        # For an overview on tool choice:
        # https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview
        if not tools:
            # Special case for summarization path
            tools_for_request = None
            tool_choice = None
        elif self.is_reasoning_model(llm_config) and llm_config.enable_reasoner:
            # NOTE: reasoning models currently do not allow for `any`
            tool_choice = {"type": "auto", "disable_parallel_tool_use": True}
            tools_for_request = [OpenAITool(function=f) for f in tools]
        elif force_tool_call is not None:
            tool_choice = {"type": "tool", "name": force_tool_call, "disable_parallel_tool_use": True}
            tools_for_request = [OpenAITool(function=f) for f in tools if f["name"] == force_tool_call]

            # need to have this setting to be able to put inner thoughts in kwargs
            if not llm_config.put_inner_thoughts_in_kwargs:
                logger.warning(
                    f"Force setting put_inner_thoughts_in_kwargs to True for Claude because there is a forced tool call: {force_tool_call}"
                )
                llm_config.put_inner_thoughts_in_kwargs = True
        else:
            tool_choice = {"type": "any", "disable_parallel_tool_use": True}
            tools_for_request = [OpenAITool(function=f) for f in tools] if tools is not None else None

        # Add tool choice
        if tool_choice:
            data["tool_choice"] = tool_choice

        # Add inner thoughts kwarg
        # TODO: Can probably make this more efficient
        if tools_for_request and len(tools_for_request) > 0 and llm_config.put_inner_thoughts_in_kwargs:
            tools_with_inner_thoughts = add_inner_thoughts_to_functions(
                functions=[t.function.model_dump() for t in tools_for_request],
                inner_thoughts_key=INNER_THOUGHTS_KWARG,
                inner_thoughts_description=INNER_THOUGHTS_KWARG_DESCRIPTION,
            )
            tools_for_request = [OpenAITool(function=f) for f in tools_with_inner_thoughts]

        if tools_for_request and len(tools_for_request) > 0:
            # TODO eventually enable parallel tool use
            data["tools"] = convert_tools_to_anthropic_format(tools_for_request)

        # Messages
        inner_thoughts_xml_tag = "thinking"

        # Move 'system' to the top level
        if messages[0].role != "system":
            raise RuntimeError(f"First message is not a system message, instead has role {messages[0].role}")
        system_content = messages[0].content if isinstance(messages[0].content, str) else messages[0].content[0].text
        data["system"] = self._add_cache_control_to_system_message(system_content)
        data["messages"] = PydanticMessage.to_anthropic_dicts_from_list(
            messages=messages[1:],
            inner_thoughts_xml_tag=inner_thoughts_xml_tag,
            put_inner_thoughts_in_kwargs=bool(llm_config.put_inner_thoughts_in_kwargs),
        )

        # Ensure first message is user
        if data["messages"][0]["role"] != "user":
            data["messages"] = [{"role": "user", "content": DUMMY_FIRST_USER_MESSAGE}] + data["messages"]

        # Handle alternating messages
        data["messages"] = merge_tool_results_into_user_messages(data["messages"])

        # Strip heartbeat pings if extended thinking
        if llm_config.enable_reasoner:
            data["messages"] = merge_heartbeats_into_tool_responses(data["messages"])

        # Prefix fill
        # https://docs.anthropic.com/en/api/messages#body-messages
        # NOTE: cannot prefill with tools for opus:
        # Your API request included an `assistant` message in the final position, which would pre-fill the `assistant` response. When using tools with "claude-3-opus-20240229"
        if prefix_fill and not llm_config.put_inner_thoughts_in_kwargs and "opus" not in data["model"]:
            data["messages"].append(
                # Start the thinking process for the assistant
                {"role": "assistant", "content": f"<{inner_thoughts_xml_tag}>"},
            )

        return data

    async def count_tokens(self, messages: List[dict] = None, model: str = None, tools: List[OpenAITool] = None) -> int:
        logging.getLogger("httpx").setLevel(logging.WARNING)

        client = anthropic.AsyncAnthropic()
        if messages and len(messages) == 0:
            messages = None
        if tools and len(tools) > 0:
            anthropic_tools = convert_tools_to_anthropic_format(tools)
        else:
            anthropic_tools = None

        thinking_enabled = False
        if messages and len(messages) > 0:
            # Check if the last assistant message starts with a thinking block
            # Find the last assistant message
            last_assistant_message = None
            for message in reversed(messages):
                if message.get("role") == "assistant":
                    last_assistant_message = message
                    break

            if (
                last_assistant_message
                and isinstance(last_assistant_message.get("content"), list)
                and len(last_assistant_message["content"]) > 0
                and last_assistant_message["content"][0].get("type") == "thinking"
            ):
                thinking_enabled = True

        try:
            count_params = {
                "model": model or "claude-3-7-sonnet-20250219",
                "messages": messages or [{"role": "user", "content": "hi"}],
                "tools": anthropic_tools or [],
            }

            if thinking_enabled:
                count_params["thinking"] = {"type": "enabled", "budget_tokens": 16000}
            result = await client.beta.messages.count_tokens(**count_params)
        except:
            raise

        token_count = result.input_tokens
        if messages is None:
            token_count -= 8
        return token_count

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return (
            llm_config.model.startswith("claude-3-7-sonnet")
            or llm_config.model.startswith("claude-sonnet-4")
            or llm_config.model.startswith("claude-opus-4")
        )

    @trace_method
    def handle_llm_error(self, e: Exception) -> Exception:
        if isinstance(e, anthropic.APITimeoutError):
            logger.warning(f"[Anthropic] Request timeout: {e}")
            return LLMTimeoutError(
                message=f"Request to Anthropic timed out: {str(e)}",
                code=ErrorCode.TIMEOUT,
                details={"cause": str(e.__cause__) if e.__cause__ else None},
            )

        if isinstance(e, anthropic.APIConnectionError):
            logger.warning(f"[Anthropic] API connection error: {e.__cause__}")
            return LLMConnectionError(
                message=f"Failed to connect to Anthropic: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None},
            )

        if isinstance(e, anthropic.RateLimitError):
            logger.warning("[Anthropic] Rate limited (429). Consider backoff.")
            return LLMRateLimitError(
                message=f"Rate limited by Anthropic: {str(e)}",
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
            )

        if isinstance(e, anthropic.BadRequestError):
            logger.warning(f"[Anthropic] Bad request: {str(e)}")
            error_str = str(e).lower()
            if "prompt is too long" in error_str or "exceed context limit" in error_str:
                # If the context window is too large, we expect to receive either:
                # 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'prompt is too long: 200758 tokens > 200000 maximum'}}
                # 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'input length and `max_tokens` exceed context limit: 173298 + 32000 > 200000, decrease input length or `max_tokens` and try again'}}
                return ContextWindowExceededError(
                    message=f"Bad request to Anthropic (context window exceeded): {str(e)}",
                )
            else:
                return LLMBadRequestError(
                    message=f"Bad request to Anthropic: {str(e)}",
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                )

        if isinstance(e, anthropic.AuthenticationError):
            logger.warning(f"[Anthropic] Authentication error: {str(e)}")
            return LLMAuthenticationError(
                message=f"Authentication failed with Anthropic: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )

        if isinstance(e, anthropic.PermissionDeniedError):
            logger.warning(f"[Anthropic] Permission denied: {str(e)}")
            return LLMPermissionDeniedError(
                message=f"Permission denied by Anthropic: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )

        if isinstance(e, anthropic.NotFoundError):
            logger.warning(f"[Anthropic] Resource not found: {str(e)}")
            return LLMNotFoundError(
                message=f"Resource not found in Anthropic: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )

        if isinstance(e, anthropic.UnprocessableEntityError):
            logger.warning(f"[Anthropic] Unprocessable entity: {str(e)}")
            return LLMUnprocessableEntityError(
                message=f"Invalid request content for Anthropic: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
            )

        if isinstance(e, anthropic.APIStatusError):
            logger.warning(f"[Anthropic] API status error: {str(e)}")
            return LLMServerError(
                message=f"Anthropic API error: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={
                    "status_code": e.status_code if hasattr(e, "status_code") else None,
                    "response": str(e.response) if hasattr(e, "response") else None,
                },
            )

        return super().handle_llm_error(e)

    # TODO: Input messages doesn't get used here
    # TODO: Clean up this interface
    @trace_method
    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Example response from Claude 3:
        response.json = {
            'id': 'msg_01W1xg9hdRzbeN2CfZM7zD2w',
            'type': 'message',
            'role': 'assistant',
            'content': [
                {
                    'type': 'text',
                    'text': "<thinking>Analyzing user login event. This is Chad's first
        interaction with me. I will adjust my personality and rapport accordingly.</thinking>"
                },
                {
                    'type':
                    'tool_use',
                    'id': 'toolu_01Ka4AuCmfvxiidnBZuNfP1u',
                    'name': 'core_memory_append',
                    'input': {
                        'name': 'human',
                        'content': 'Chad is logging in for the first time. I will aim to build a warm
        and welcoming rapport.',
                        'request_heartbeat': True
                    }
                }
            ],
            'model': 'claude-3-haiku-20240307',
            'stop_reason': 'tool_use',
            'stop_sequence': None,
            'usage': {
                'input_tokens': 3305,
                'output_tokens': 141
            }
        }
        """
        response = AnthropicMessage(**response_data)
        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens
        finish_reason = remap_finish_reason(str(response.stop_reason))

        content = None
        reasoning_content = None
        reasoning_content_signature = None
        redacted_reasoning_content = None
        tool_calls = None

        if len(response.content) > 0:
            for content_part in response.content:
                if content_part.type == "text":
                    content = strip_xml_tags(string=content_part.text, tag="thinking")
                if content_part.type == "tool_use":
                    # hack for incorrect tool format
                    tool_input = json.loads(json.dumps(content_part.input))
                    if "id" in tool_input and tool_input["id"].startswith("toolu_") and "function" in tool_input:
                        arguments = json.dumps(tool_input["function"]["arguments"], indent=2)
                        try:
                            args_json = json.loads(arguments)
                            if not isinstance(args_json, dict):
                                raise LLMServerError("Expected parseable json object for arguments")
                        except:
                            arguments = str(tool_input["function"]["arguments"])
                    else:
                        arguments = json.dumps(tool_input, indent=2)
                    tool_calls = [
                        ToolCall(
                            id=content_part.id,
                            type="function",
                            function=FunctionCall(
                                name=content_part.name,
                                arguments=arguments,
                            ),
                        )
                    ]
                if content_part.type == "thinking":
                    reasoning_content = content_part.thinking
                    reasoning_content_signature = content_part.signature
                if content_part.type == "redacted_thinking":
                    redacted_reasoning_content = content_part.data

        else:
            raise RuntimeError("Unexpected empty content in response")

        assert response.role == "assistant"
        choice = Choice(
            index=0,
            finish_reason=finish_reason,
            message=ChoiceMessage(
                role=response.role,
                content=content,
                reasoning_content=reasoning_content,
                reasoning_content_signature=reasoning_content_signature,
                redacted_reasoning_content=redacted_reasoning_content,
                tool_calls=tool_calls,
            ),
        )

        chat_completion_response = ChatCompletionResponse(
            id=response.id,
            choices=[choice],
            created=get_utc_time_int(),
            model=response.model,
            usage=UsageStatistics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )
        if llm_config.put_inner_thoughts_in_kwargs:
            chat_completion_response = unpack_all_inner_thoughts_from_kwargs(
                response=chat_completion_response, inner_thoughts_key=INNER_THOUGHTS_KWARG
            )

        return chat_completion_response

    def _add_cache_control_to_system_message(self, system_content):
        """Add cache control to system message content"""
        if isinstance(system_content, str):
            # For string content, convert to list format with cache control
            return [{"type": "text", "text": system_content, "cache_control": {"type": "ephemeral"}}]
        elif isinstance(system_content, list):
            # For list content, add cache control to the last text block
            cached_content = system_content.copy()
            for i in range(len(cached_content) - 1, -1, -1):
                if cached_content[i].get("type") == "text":
                    cached_content[i]["cache_control"] = {"type": "ephemeral"}
                    break
            return cached_content

        return system_content


def convert_tools_to_anthropic_format(tools: List[OpenAITool]) -> List[dict]:
    """See: https://docs.anthropic.com/claude/docs/tool-use

    OpenAI style:
      "tools": [{
        "type": "function",
        "function": {
            "name": "find_movies",
            "description": "find ....",
            "parameters": {
              "type": "object",
              "properties": {
                 PARAM: {
                   "type": PARAM_TYPE,  # eg "string"
                   "description": PARAM_DESCRIPTION,
                 },
                 ...
              },
              "required": List[str],
            }
        }
      }
      ]

    Anthropic style:
      "tools": [{
        "name": "find_movies",
        "description": "find ....",
        "input_schema": {
          "type": "object",
          "properties": {
             PARAM: {
               "type": PARAM_TYPE,  # eg "string"
               "description": PARAM_DESCRIPTION,
             },
             ...
          },
          "required": List[str],
        }
      }
      ]

      Two small differences:
        - 1 level less of nesting
        - "parameters" -> "input_schema"
    """
    formatted_tools = []
    for tool in tools:
        # Get the input schema
        input_schema = tool.function.parameters or {"type": "object", "properties": {}, "required": []}

        # Clean up the properties in the schema
        # The presence of union types / default fields seems Anthropic to produce invalid JSON for tool calls
        if isinstance(input_schema, dict) and "properties" in input_schema:
            cleaned_properties = {}
            for prop_name, prop_schema in input_schema.get("properties", {}).items():
                if isinstance(prop_schema, dict):
                    cleaned_properties[prop_name] = _clean_property_schema(prop_schema)
                else:
                    cleaned_properties[prop_name] = prop_schema

            # Create cleaned input schema
            cleaned_input_schema = {
                "type": input_schema.get("type", "object"),
                "properties": cleaned_properties,
            }

            # Only add required field if it exists and is non-empty
            if "required" in input_schema and input_schema["required"]:
                cleaned_input_schema["required"] = input_schema["required"]
        else:
            cleaned_input_schema = input_schema

        formatted_tool = {
            "name": tool.function.name,
            "description": tool.function.description if tool.function.description else "",
            "input_schema": cleaned_input_schema,
        }
        formatted_tools.append(formatted_tool)

    return formatted_tools


def _clean_property_schema(prop_schema: dict) -> dict:
    """Clean up a property schema by removing defaults and simplifying union types."""
    cleaned = {}

    # Handle type field - simplify union types like ["null", "string"] to just "string"
    if "type" in prop_schema:
        prop_type = prop_schema["type"]
        if isinstance(prop_type, list):
            # Remove "null" from union types to simplify
            # e.g., ["null", "string"] becomes "string"
            non_null_types = [t for t in prop_type if t != "null"]
            if len(non_null_types) == 1:
                cleaned["type"] = non_null_types[0]
            elif len(non_null_types) > 1:
                # Keep as array if multiple non-null types
                cleaned["type"] = non_null_types
            else:
                # If only "null" was in the list, default to string
                cleaned["type"] = "string"
        else:
            cleaned["type"] = prop_type

    # Copy over other fields except 'default'
    for key, value in prop_schema.items():
        if key not in ["type", "default"]:  # Skip 'default' field
            if key == "properties" and isinstance(value, dict):
                # Recursively clean nested properties
                cleaned["properties"] = {k: _clean_property_schema(v) if isinstance(v, dict) else v for k, v in value.items()}
            else:
                cleaned[key] = value

    return cleaned


def is_heartbeat(message: dict, is_ping: bool = False) -> bool:
    """Check if the message is an automated heartbeat ping"""

    if "role" not in message or message["role"] != "user" or "content" not in message:
        return False

    try:
        message_json = json.loads(message["content"])
    except:
        return False

    if "reason" not in message_json:
        return False

    if message_json["type"] != "heartbeat":
        return False

    if not is_ping:
        # Just checking if 'type': 'heartbeat'
        return True
    else:
        # Also checking if it's specifically a 'ping' style message
        # NOTE: this will not catch tool rule heartbeats
        if REQ_HEARTBEAT_MESSAGE in message_json["reason"] or FUNC_FAILED_HEARTBEAT_MESSAGE in message_json["reason"]:
            return True
        else:
            return False


def merge_heartbeats_into_tool_responses(messages: List[dict]):
    """For extended thinking mode, we don't want anything other than tool responses in-between assistant actions

    Otherwise, the thinking will silently get dropped.

    NOTE: assumes merge_tool_results_into_user_messages has already been called
    """

    merged_messages = []

    # Loop through messages
    # For messages with role 'user' and len(content) > 1,
    #   Check if content[0].type == 'tool_result'
    #   If so, iterate over content[1:] and while content.type == 'text' and is_heartbeat(content.text),
    #     merge into content[0].content

    for message in messages:
        if "role" not in message or "content" not in message:
            # Skip invalid messages
            merged_messages.append(message)
            continue

        if message["role"] == "user" and len(message["content"]) > 1:
            content_parts = message["content"]

            # If the first content part is a tool result, merge the heartbeat content into index 0 of the content
            # Two end cases:
            # 1. It was [tool_result, heartbeat], in which case merged result is [tool_result+heartbeat] (len 1)
            # 2. It was [tool_result, user_text], in which case it should be unchanged (len 2)
            if "type" in content_parts[0] and "content" in content_parts[0] and content_parts[0]["type"] == "tool_result":
                new_content_parts = [content_parts[0]]

                # If the first content part is a tool result, merge the heartbeat content into index 0 of the content
                for i, content_part in enumerate(content_parts[1:]):
                    # If it's a heartbeat, add it to the merge
                    if (
                        content_part["type"] == "text"
                        and "text" in content_part
                        and is_heartbeat({"role": "user", "content": content_part["text"]})
                    ):
                        # NOTE: joining with a ','
                        new_content_parts[0]["content"] += ", " + content_part["text"]

                    # If it's not, break, and concat to finish
                    else:
                        # Append the rest directly, no merging of content strings
                        new_content_parts.extend(content_parts[i + 1 :])
                        break

                # Set the content_parts
                message["content"] = new_content_parts
                merged_messages.append(message)

            else:
                # Skip invalid messages parts
                merged_messages.append(message)
                continue
        else:
            merged_messages.append(message)

    return merged_messages


def merge_tool_results_into_user_messages(messages: List[dict]):
    """Anthropic API doesn't allow role 'tool'->'user' sequences

    Example HTTP error:
    messages: roles must alternate between "user" and "assistant", but found multiple "user" roles in a row

    From: https://docs.anthropic.com/claude/docs/tool-use
    You may be familiar with other APIs that return tool use as separate from the model's primary output,
    or which use a special-purpose tool or function message role.
    In contrast, Anthropic's models and API are built around alternating user and assistant messages,
    where each message is an array of rich content blocks: text, image, tool_use, and tool_result.
    """

    # TODO walk through the messages list
    # When a dict (dict_A) with 'role' == 'user' is followed by a dict with 'role' == 'user' (dict B), do the following
    # dict_A["content"] = dict_A["content"] + dict_B["content"]

    # The result should be a new merged_messages list that doesn't have any back-to-back dicts with 'role' == 'user'
    merged_messages = []
    if not messages:
        return merged_messages

    # Start with the first message in the list
    current_message = messages[0]

    for next_message in messages[1:]:
        if current_message["role"] == "user" and next_message["role"] == "user":
            # Merge contents of the next user message into current one
            current_content = (
                current_message["content"]
                if isinstance(current_message["content"], list)
                else [{"type": "text", "text": current_message["content"]}]
            )
            next_content = (
                next_message["content"]
                if isinstance(next_message["content"], list)
                else [{"type": "text", "text": next_message["content"]}]
            )
            merged_content: list = current_content + next_content
            current_message["content"] = merged_content
        else:
            # Append the current message to result as it's complete
            merged_messages.append(current_message)
            # Move on to the next message
            current_message = next_message

    # Append the last processed message to the result
    merged_messages.append(current_message)

    return merged_messages


def remap_finish_reason(stop_reason: str) -> str:
    """Remap Anthropic's 'stop_reason' to OpenAI 'finish_reason'

    OpenAI: 'stop', 'length', 'function_call', 'content_filter', null
    see: https://platform.openai.com/docs/guides/text-generation/chat-completions-api

    From: https://docs.anthropic.com/claude/reference/migrating-from-text-completions-to-messages#stop-reason

    Messages have a stop_reason of one of the following values:
        "end_turn": The conversational turn ended naturally.
        "stop_sequence": One of your specified custom stop sequences was generated.
        "max_tokens": (unchanged)

    """
    if stop_reason == "end_turn":
        return "stop"
    elif stop_reason == "stop_sequence":
        return "stop"
    elif stop_reason == "max_tokens":
        return "length"
    elif stop_reason == "tool_use":
        return "function_call"
    else:
        raise LLMServerError(f"Unexpected stop_reason: {stop_reason}")


def strip_xml_tags(string: str, tag: Optional[str]) -> str:
    if tag is None:
        return string
    # Construct the regular expression pattern to find the start and end tags
    tag_pattern = f"<{tag}.*?>|</{tag}>"
    # Use the regular expression to replace the tags with an empty string
    return re.sub(tag_pattern, "", string)


def strip_xml_tags_streaming(string: str, tag: Optional[str]) -> str:
    if tag is None:
        return string

    # Handle common partial tag cases
    parts_to_remove = [
        "<",  # Leftover start bracket
        f"<{tag}",  # Opening tag start
        f"</{tag}",  # Closing tag start
        f"/{tag}>",  # Closing tag end
        f"{tag}>",  # Opening tag end
        f"/{tag}",  # Partial closing tag without >
        ">",  # Leftover end bracket
    ]

    result = string
    for part in parts_to_remove:
        result = result.replace(part, "")

    return result
