from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, AsyncIterator, List, Optional

import httpx
import openai
from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types import Reasoning
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk
from openai.types.responses import ResponseTextConfigParam
from openai.types.responses.response_stream_event import ResponseStreamEvent

from letta.constants import LETTA_MODEL_ENDPOINT, REQUEST_HEARTBEAT_PARAM
from letta.errors import (
    ContextWindowExceededError,
    ErrorCode,
    LLMAuthenticationError,
    LLMBadRequestError,
    LLMConnectionError,
    LLMEmptyResponseError,
    LLMInsufficientCreditsError,
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
    LLMUnprocessableEntityError,
)
from letta.helpers.json_helpers import sanitize_unicode_surrogates
from letta.llm_api.error_utils import is_context_window_overflow_message, is_insufficient_credits_message
from letta.llm_api.helpers import (
    add_inner_thoughts_to_functions,
    convert_response_format_to_responses_api,
    unpack_all_inner_thoughts_from_kwargs,
)
from letta.llm_api.llm_client_base import LLMClientBase
from letta.llm_api.openai_ws_session import AsyncStreamCompat, OpenAIWSSessionManager
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION, INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory
from letta.schemas.letta_message_content import MessageContentType, TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_request import (
    ChatCompletionRequest,
    FunctionCall as ToolFunctionChoiceFunctionCall,
    Tool as OpenAITool,
    ToolFunctionChoice,
    cast_message_to_subtype,
)
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    Choice,
    FunctionCall,
    Message as ChoiceMessage,
    ToolCall,
)
from letta.schemas.openai.responses_request import ResponsesRequest
from letta.schemas.response_format import JsonSchemaResponseFormat
from letta.schemas.usage import LettaUsageStatistics
from letta.settings import model_settings

logger = get_logger(__name__)


def is_openai_reasoning_model(model: str) -> bool:
    """Utility function to check if the model is a 'reasoner'"""

    # NOTE: needs to be updated with new model releases
    is_reasoning = model.startswith("o1") or model.startswith("o3") or model.startswith("o4") or model.startswith("gpt-5")
    return is_reasoning


def does_not_support_minimal_reasoning(model: str) -> bool:
    """Check if the model does not support minimal reasoning effort.

    Currently, models that contain codex don't support minimal reasoning.
    """
    return "codex" in model.lower()


def supports_none_reasoning_effort(model: str) -> bool:
    """Check if the model supports 'none' reasoning effort.

    Currently, GPT-5.1, GPT-5.2, GPT-5.3, and GPT-5.4 models support the 'none' reasoning effort level.
    """
    return model.startswith("gpt-5.1") or model.startswith("gpt-5.2") or model.startswith("gpt-5.3") or model.startswith("gpt-5.4")


def is_openai_5_model(model: str) -> bool:
    """Utility function to check if the model is a '5' model"""
    return model.startswith("gpt-5")


def supports_verbosity_control(model: str) -> bool:
    """Check if the model supports verbosity control, currently only GPT-5 models support this"""
    return is_openai_5_model(model)


def accepts_developer_role(model: str) -> bool:
    """Checks if the model accepts the 'developer' role. Note that not all reasoning models accept this role.

    See: https://community.openai.com/t/developer-role-not-accepted-for-o1-o1-mini-o3-mini/1110750/7
    """
    if (is_openai_reasoning_model(model) and "o1-mini" not in model) or "o1-preview" in model:
        return True
    else:
        return False


def supports_temperature_param(model: str) -> bool:
    """Certain OpenAI models don't support configuring the temperature.

    Example error: 400 - {'error': {'message': "Unsupported parameter: 'temperature' is not supported with this model.", 'type': 'invalid_request_error', 'param': 'temperature', 'code': 'unsupported_parameter'}}
    """
    if is_openai_reasoning_model(model) or is_openai_5_model(model):
        return False
    else:
        return True


def supports_parallel_tool_calling(model: str) -> bool:
    """Certain OpenAI models don't support parallel tool calls."""

    if is_openai_reasoning_model(model):
        return False
    else:
        return True


# TODO move into LLMConfig as a field?
def supports_structured_output(llm_config: LLMConfig) -> bool:
    """Certain providers don't support structured output."""

    # FIXME pretty hacky - turn off for providers we know users will use,
    #       but also don't support structured output
    if llm_config.model_endpoint and "nebius.com" in llm_config.model_endpoint:
        return False
    else:
        return True


# TODO move into LLMConfig as a field?
def requires_auto_tool_choice(llm_config: LLMConfig) -> bool:
    """Certain providers require the tool choice to be set to 'auto'."""
    if llm_config.model_endpoint and "nebius.com" in llm_config.model_endpoint:
        return True
    if llm_config.handle and "vllm" in llm_config.handle:
        return True
    if llm_config.compatibility_type == "mlx":
        return True
    return False


def use_responses_api(llm_config: LLMConfig) -> bool:
    # TODO can opt in all reasoner models to use the Responses API
    return is_openai_reasoning_model(llm_config.model)


def supports_content_none(llm_config: LLMConfig) -> bool:
    """Certain providers don't support the content None."""
    if "gpt-oss" in llm_config.model:
        return False
    return True


class OpenAIClient(LLMClientBase):
    def _prepare_client_kwargs(self, llm_config: LLMConfig) -> dict:
        api_key, _, _ = self.get_byok_overrides(llm_config)
        has_byok_key = api_key is not None  # Track if we got a BYOK key

        # Default to global OpenAI key when no BYOK override
        if not api_key:
            api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")

        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

        # OpenRouter-specific overrides: use OpenRouter key and optional headers
        is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
            llm_config.provider_name == "openrouter"
        )
        if is_openrouter:
            # Only use prod OpenRouter key if no BYOK key was provided
            if not has_byok_key:
                or_key = model_settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY")
                if or_key:
                    kwargs["api_key"] = or_key
            # Attach optional headers if provided
            headers = {}
            if model_settings.openrouter_referer:
                headers["HTTP-Referer"] = model_settings.openrouter_referer
            if model_settings.openrouter_title:
                headers["X-Title"] = model_settings.openrouter_title
            if headers:
                kwargs["default_headers"] = headers

        # The OpenAI client requires some API key value
        kwargs["api_key"] = kwargs.get("api_key") or "DUMMY_API_KEY"

        return kwargs

    def _prepare_client_kwargs_embedding(self, embedding_config: EmbeddingConfig) -> dict:
        api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
        # supposedly the openai python client requires a dummy API key
        api_key = api_key or "DUMMY_API_KEY"
        kwargs = {"api_key": api_key, "base_url": embedding_config.embedding_endpoint}
        return kwargs

    async def _prepare_client_kwargs_async(self, llm_config: LLMConfig) -> dict:
        api_key, _, _ = await self.get_byok_overrides_async(llm_config)
        has_byok_key = api_key is not None  # Track if we got a BYOK key

        if not api_key:
            api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

        is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
            llm_config.provider_name == "openrouter"
        )
        if is_openrouter:
            # Only use prod OpenRouter key if no BYOK key was provided
            if not has_byok_key:
                or_key = model_settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY")
                if or_key:
                    kwargs["api_key"] = or_key
            headers = {}
            if model_settings.openrouter_referer:
                headers["HTTP-Referer"] = model_settings.openrouter_referer
            if model_settings.openrouter_title:
                headers["X-Title"] = model_settings.openrouter_title
            if headers:
                kwargs["default_headers"] = headers

        kwargs["api_key"] = kwargs.get("api_key") or "DUMMY_API_KEY"

        return kwargs

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return requires_auto_tool_choice(llm_config)

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return supports_structured_output(llm_config)

    def _is_openrouter_request(self, llm_config: LLMConfig) -> bool:
        return (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (llm_config.provider_name == "openrouter")

    @staticmethod
    def _extract_openrouter_provider(e: Exception) -> str | None:
        """Extract upstream provider name from an OpenRouter error response."""
        body = getattr(e, "body", None)
        if not isinstance(body, dict):
            return None
        error_data = body.get("error", {})
        if not isinstance(error_data, dict):
            return None
        metadata = error_data.get("metadata", {})
        if not isinstance(metadata, dict):
            return None
        return metadata.get("provider_name")

    def _is_true_openai_request(self, llm_config: LLMConfig) -> bool:
        if llm_config.model_endpoint_type != "openai":
            return False

        if self._is_openrouter_request(llm_config):
            return False

        # Keep Letta inference endpoint behavior unchanged.
        if llm_config.model_endpoint == LETTA_MODEL_ENDPOINT:
            return False

        # If provider_name is explicitly set and not openai, don't apply OpenAI-specific prompt caching fields.
        if llm_config.provider_name and llm_config.provider_name != "openai":
            return False

        return True

    def _normalize_model_name(self, model: Optional[str]) -> Optional[str]:
        if not model:
            return None
        return model.split("/", 1)[-1]

    def _supports_extended_prompt_cache_retention(self, model: Optional[str]) -> bool:
        normalized_model = self._normalize_model_name(model)
        if not normalized_model:
            return False

        # Per OpenAI docs: extended retention is available on gpt-4.1 and gpt-5 family models.
        # gpt-5-mini is excluded (not listed in docs).
        return normalized_model == "gpt-4.1" or (normalized_model.startswith("gpt-5") and normalized_model != "gpt-5-mini")

    def _apply_prompt_cache_settings(
        self,
        llm_config: LLMConfig,
        model: Optional[str],
        messages: List[PydanticMessage],
        request_obj: Any,
    ) -> None:
        """Apply OpenAI prompt cache settings to the request.

        We intentionally do NOT set prompt_cache_key. OpenAI's default routing
        (based on a hash of the first ~256 tokens of the prompt) already provides
        good cache affinity for Letta agents, since each agent has a unique system
        prompt. Setting an explicit key can disrupt existing warm caches and reduce
        hit rates.

        We only set prompt_cache_retention to "24h" for models that support extended
        retention, which keeps cached prefixes active longer (up to 24h vs 5-10min).
        """
        if not self._is_true_openai_request(llm_config):
            return

        if self._supports_extended_prompt_cache_retention(model):
            request_obj.prompt_cache_retention = "24h"

    @staticmethod
    def _apply_system_override(messages: List[PydanticMessage], system: Optional[str]) -> List[PydanticMessage]:
        if system is None:
            return messages

        if not messages:
            raise RuntimeError("Cannot override system prompt because messages is empty")

        if messages[0].role != "system":
            raise RuntimeError(f"First message is not a system message, instead has role {messages[0].role}")

        system_message = messages[0].model_copy(deep=True)
        system_message.content = [TextContent(text=system)]
        return [system_message, *messages[1:]]

    @trace_method
    def build_request_data_responses(
        self,
        agent_type: AgentType,  # if react, use native content + strip heartbeats
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,  # Keep as dict for now as per base class
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
        system: Optional[str] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for the OpenAI Responses API.
        """
        if llm_config.put_inner_thoughts_in_kwargs:
            raise ValueError("Inner thoughts in kwargs are not supported for the OpenAI Responses API")

        request_messages = self._apply_system_override(messages, system)

        openai_messages_list = PydanticMessage.to_openai_responses_dicts_from_list(
            request_messages,
            tool_return_truncation_chars=tool_return_truncation_chars,
        )
        # Add multi-modal support for Responses API by rewriting user messages
        # into input_text/input_image parts.
        openai_messages_list = fill_image_content_in_responses_input(openai_messages_list, request_messages)

        if llm_config.model:
            model = llm_config.model
        else:
            logger.warning(f"Model type not set in llm_config: {llm_config.model_dump_json(indent=4)}")
            model = None

        # Default to auto, unless there's a forced tool call coming from above or requires_subsequent_tool_call is True
        tool_choice = None
        if tools:  # only set tool_choice if tools exist
            if force_tool_call is not None:
                tool_choice = {"type": "function", "name": force_tool_call}
            elif requires_subsequent_tool_call:
                tool_choice = "required"
            else:
                tool_choice = "auto"

        # Convert the tools from the ChatCompletions style to the Responses style
        if tools:
            # Get proper typing
            typed_tools: List[OpenAITool] = [OpenAITool(type="function", function=f) for f in tools]

            # Strip request heartbeat
            # TODO relax this?
            if agent_type == AgentType.letta_v1_agent:
                new_tools = []
                for tool in typed_tools:
                    # Remove request_heartbeat from the properties if it exists
                    if tool.function.parameters and "properties" in tool.function.parameters:
                        tool.function.parameters["properties"].pop(REQUEST_HEARTBEAT_PARAM, None)
                        # Also remove from required list if present
                        if "required" in tool.function.parameters and REQUEST_HEARTBEAT_PARAM in tool.function.parameters["required"]:
                            tool.function.parameters["required"].remove(REQUEST_HEARTBEAT_PARAM)
                    new_tools.append(tool.model_copy(deep=True))
                typed_tools = new_tools

            # Note: Tools are already processed by enable_strict_mode() in the workflow/agent code
            # (temporal_letta_v1_agent_workflow.py or letta_agent_v3.py) before reaching here.
            # enable_strict_mode() handles: strict flag, additionalProperties, required array, nullable fields
            # Convert to a Responses-friendly dict, preserving the strict setting from the tool schema
            responses_tools = [
                {
                    "type": "function",
                    "name": t.function.name,
                    "description": t.function.description,
                    "parameters": t.function.parameters,
                    "strict": t.function.strict,
                }
                for t in typed_tools
            ]
        else:
            responses_tools = None

        # Prepare the request payload
        data = ResponsesRequest(
            # Responses specific
            store=False,
            include=["reasoning.encrypted_content"],
            # More or less generic to ChatCompletions API
            model=model,
            input=openai_messages_list,
            tools=responses_tools,
            tool_choice=tool_choice,
            temperature=llm_config.temperature if supports_temperature_param(model) else None,
            parallel_tool_calls=llm_config.parallel_tool_calls if tools and supports_parallel_tool_calling(model) else False,
        )

        # Handle "fast" model variants → real model + priority service tier
        if data.model.endswith("-fast"):
            data.model = data.model.removesuffix("-fast")
            data.service_tier = "priority"

        # Handle text configuration (verbosity and response format)
        text_config_kwargs = {}

        # Only set max_output_tokens if explicitly configured
        if llm_config.max_tokens is not None:
            data.max_output_tokens = llm_config.max_tokens

        # Add verbosity control for GPT-5 models
        if supports_verbosity_control(model) and llm_config.verbosity:
            text_config_kwargs["verbosity"] = llm_config.verbosity

        # Add response_format support for structured outputs via text.format
        if hasattr(llm_config, "response_format") and llm_config.response_format is not None:
            format_dict = convert_response_format_to_responses_api(llm_config.response_format)
            if format_dict is not None:
                text_config_kwargs["format"] = format_dict

        # Set text config if we have any parameters
        if text_config_kwargs:
            data.text = ResponseTextConfigParam(**text_config_kwargs)

        # Add reasoning effort control for reasoning models
        # Only set reasoning if effort is not "none" (GPT-5.1 uses "none" to disable reasoning)
        if is_openai_reasoning_model(model) and llm_config.reasoning_effort and llm_config.reasoning_effort != "none":
            # data.reasoning_effort = llm_config.reasoning_effort
            data.reasoning = Reasoning(
                effort=llm_config.reasoning_effort,
                # NOTE: hardcoding summary level, could put in llm_config?
                summary="detailed",
            )

        # TODO I don't see this in Responses?
        # Add frequency penalty
        # if llm_config.frequency_penalty is not None:
        # data.frequency_penalty = llm_config.frequency_penalty

        # Add parallel tool calling
        if tools and supports_parallel_tool_calling(model):
            data.parallel_tool_calls = llm_config.parallel_tool_calls

        # always set user id for openai requests
        if self.actor:
            data.user = self.actor.id

        if llm_config.model_endpoint == LETTA_MODEL_ENDPOINT:
            if not self.actor:
                # override user id for inference.letta.com
                import uuid

                data.user = str(uuid.UUID(int=0))

            data.model = "memgpt-openai"

        self._apply_prompt_cache_settings(
            llm_config=llm_config,
            model=model,
            messages=request_messages,
            request_obj=data,
        )

        request_data = data.model_dump(exclude_unset=True)
        return request_data

    @trace_method
    def build_request_data(
        self,
        agent_type: AgentType,  # if react, use native content + strip heartbeats
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,  # Keep as dict for now as per base class
        force_tool_call: Optional[str] = None,
        requires_subsequent_tool_call: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
        system: Optional[str] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for the OpenAI API.
        """
        # Shortcut for GPT-5 to use Responses API, but only for letta_v1_agent
        if use_responses_api(llm_config) and agent_type == AgentType.letta_v1_agent:
            return self.build_request_data_responses(
                agent_type=agent_type,
                messages=messages,
                llm_config=llm_config,
                tools=tools,
                force_tool_call=force_tool_call,
                requires_subsequent_tool_call=requires_subsequent_tool_call,
                tool_return_truncation_chars=tool_return_truncation_chars,
                system=system,
            )

        if agent_type == AgentType.letta_v1_agent:
            # Safety hard override in case it got set somewhere by accident
            llm_config.put_inner_thoughts_in_kwargs = False

        if tools and llm_config.put_inner_thoughts_in_kwargs:
            # Special case for LM Studio backend since it needs extra guidance to force out the thoughts first
            # TODO(fix)
            inner_thoughts_desc = (
                INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST
                if llm_config.model_endpoint and ":1234" in llm_config.model_endpoint
                else INNER_THOUGHTS_KWARG_DESCRIPTION
            )
            tools = add_inner_thoughts_to_functions(
                functions=tools,
                inner_thoughts_key=INNER_THOUGHTS_KWARG,
                inner_thoughts_description=inner_thoughts_desc,
                put_inner_thoughts_first=True,
            )

        use_developer_message = accepts_developer_role(llm_config.model)

        request_messages = self._apply_system_override(messages, system)

        openai_message_list = [
            cast_message_to_subtype(m)
            for m in PydanticMessage.to_openai_dicts_from_list(
                request_messages,
                put_inner_thoughts_in_kwargs=llm_config.put_inner_thoughts_in_kwargs,
                use_developer_message=use_developer_message,
                tool_return_truncation_chars=tool_return_truncation_chars,
            )
        ]

        if llm_config.model:
            model = llm_config.model
        else:
            logger.warning(f"Model type not set in llm_config: {llm_config.model_dump_json(indent=4)}")
            model = None

        # TODO: we may need to extend this to more models using proxy?
        is_openrouter = self._is_openrouter_request(llm_config)
        if is_openrouter:
            try:
                model = llm_config.handle.split("/", 1)[-1]
            except Exception:
                # don't raise error since this isn't robust against edge cases
                pass

        # force function calling for reliability, see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
        # TODO(matt) move into LLMConfig
        # TODO: This vllm checking is very brittle and is a patch at most
        tool_choice = None
        if tools:  # only set tool_choice if tools exist
            if force_tool_call is not None:
                # OpenRouter proxies to providers that may not support object-format tool_choice
                # Use "required" instead which achieves similar effect
                if is_openrouter:
                    tool_choice = "required"
                else:
                    tool_choice = ToolFunctionChoice(type="function", function=ToolFunctionChoiceFunctionCall(name=force_tool_call))
            elif requires_subsequent_tool_call:
                tool_choice = "required"
            elif self.requires_auto_tool_choice(llm_config) or agent_type == AgentType.letta_v1_agent:
                tool_choice = "auto"
            else:
                # only set if tools is non-Null
                tool_choice = "required"

        if not supports_content_none(llm_config):
            for message in openai_message_list:
                if message.content is None:
                    message.content = ""

        data = ChatCompletionRequest(
            model=model,
            messages=fill_image_content_in_messages(openai_message_list, messages),
            tools=[OpenAITool(type="function", function=f) for f in tools] if tools else None,
            tool_choice=tool_choice,
            user=str(),
            max_completion_tokens=llm_config.max_tokens,
            # NOTE: the reasoners that don't support temperature require 1.0, not None
            temperature=llm_config.temperature if supports_temperature_param(model) else 1.0,
        )

        # Handle "fast" model variants → real model + priority service tier
        if data.model.endswith("-fast"):
            data.model = data.model.removesuffix("-fast")
            data.service_tier = "priority"

        # Add verbosity control for GPT-5 models
        if supports_verbosity_control(model) and llm_config.verbosity:
            data.verbosity = llm_config.verbosity

        # Add reasoning effort control for reasoning models
        # Only set reasoning_effort if it's not "none" (GPT-5.1 uses "none" to disable reasoning)
        if is_openai_reasoning_model(model) and llm_config.reasoning_effort and llm_config.reasoning_effort != "none":
            data.reasoning_effort = llm_config.reasoning_effort

        if llm_config.frequency_penalty is not None:
            data.frequency_penalty = llm_config.frequency_penalty

        # Add logprobs configuration for RL training
        if llm_config.return_logprobs:
            data.logprobs = True
            if llm_config.top_logprobs is not None:
                data.top_logprobs = llm_config.top_logprobs

        if tools and supports_parallel_tool_calling(model):
            data.parallel_tool_calls = llm_config.parallel_tool_calls

        # Add response_format support for structured outputs
        if hasattr(llm_config, "response_format") and llm_config.response_format is not None:
            # For Chat Completions API, we need the full nested structure
            if isinstance(llm_config.response_format, JsonSchemaResponseFormat):
                # Convert to the OpenAI SDK format
                data.response_format = {"type": "json_schema", "json_schema": llm_config.response_format.json_schema}
            else:
                # For text or json_object, just pass the type
                data.response_format = {"type": llm_config.response_format.type}

        # always set user id for openai requests
        if self.actor:
            data.user = self.actor.id

        if llm_config.model_endpoint == LETTA_MODEL_ENDPOINT:
            if not self.actor:
                # override user id for inference.letta.com
                import uuid

                data.user = str(uuid.UUID(int=0))

            data.model = "memgpt-openai"

        # For some reason, request heartbeats are still leaking into here...
        # So strip them manually for v3
        if agent_type == AgentType.letta_v1_agent:
            new_tools = []
            if data.tools:
                for tool in data.tools:
                    # Remove request_heartbeat from the properties if it exists
                    if tool.function.parameters and "properties" in tool.function.parameters:
                        tool.function.parameters["properties"].pop(REQUEST_HEARTBEAT_PARAM, None)
                        # Also remove from required list if present
                        if "required" in tool.function.parameters and REQUEST_HEARTBEAT_PARAM in tool.function.parameters["required"]:
                            tool.function.parameters["required"].remove(REQUEST_HEARTBEAT_PARAM)
                    new_tools.append(tool.model_copy(deep=True))
                data.tools = new_tools

        self._apply_prompt_cache_settings(
            llm_config=llm_config,
            model=model,
            messages=request_messages,
            request_obj=data,
        )

        # Note: Tools are already processed by enable_strict_mode() in the workflow/agent code
        # (temporal_letta_v1_agent_workflow.py or letta_agent_v3.py) before reaching here.
        # enable_strict_mode() handles: strict flag, additionalProperties, required array, nullable fields
        # We only need to ensure strict is False for providers that don't support structured output
        if data.tools is not None and len(data.tools) > 0:
            for tool in data.tools:
                if not supports_structured_output(llm_config):
                    # Provider doesn't support structured output - ensure strict is False
                    tool.function.strict = False
        request_data = data.model_dump(exclude_unset=True)

        # If Ollama
        # if llm_config.handle.startswith("ollama/") and llm_config.enable_reasoner:
        # Sadly, reasoning via the OpenAI proxy on Ollama only works for Harmony/gpt-oss
        # Ollama's OpenAI layer simply looks for the presence of 'reasoining' or 'reasoning_effort'
        # If set, then in the backend "medium" thinking is turned on
        # request_data["reasoning_effort"] = "medium"

        # GLM-5 will sometimes send turn delimiters; stop generation before the model
        # starts predicting the next turn (prevents "<|user|>" leaking into responses)
        # also strip reasoning fields that providers like Fireworks reject as extra inputs
        if (model or "").lower().endswith("glm-5"):
            request_data["stop"] = ["<|user|>", "<|assistant|>", "<|observation|>"]
            if "messages" in request_data:
                for msg in request_data["messages"]:
                    if isinstance(msg, dict):
                        for field in ("reasoning_content_signature", "redacted_reasoning_content", "omitted_reasoning_content"):
                            msg.pop(field, None)
            # Enable reasoning via chat_template_args for GLM-5 on BYOK deployments (e.g. Baseten TRT-LLM)
            # Thinking is off by default; must be explicitly enabled
            if llm_config.enable_reasoner:
                request_data["extra_body"] = {
                    "chat_template_args": {"enable_thinking": True},
                }

        # Add OpenRouter reasoning configuration via extra_body
        if is_openrouter and llm_config.enable_reasoner:
            reasoning_config = {}
            if llm_config.reasoning_effort:
                reasoning_config["effort"] = llm_config.reasoning_effort
            if llm_config.max_reasoning_tokens and llm_config.max_reasoning_tokens > 0:
                reasoning_config["max_tokens"] = llm_config.max_reasoning_tokens
            if not reasoning_config:
                reasoning_config = {"enabled": True}
            request_data["extra_body"] = {"reasoning": reasoning_config}

        # Add OpenRouter provider preferences for GLM-5 auto mode
        # Exclude low-quality (fp4), degraded, tool-unsupported, and high-error-rate providers
        if is_openrouter and (model or "").lower().endswith("glm-5"):
            existing_extra = request_data.get("extra_body", {})
            existing_extra["provider"] = {
                "ignore": ["deepinfra/fp4", "ambient/fp8", "io-net/fp8", "phala", "siliconflow/fp8"],
            }
            request_data["extra_body"] = existing_extra

        return request_data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        # Sanitize Unicode surrogates to prevent encoding errors
        request_data = sanitize_unicode_surrogates(request_data)

        client = OpenAI(**self._prepare_client_kwargs(llm_config))
        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        try:
            if "input" in request_data and "messages" not in request_data:
                resp = client.responses.create(**request_data)
                return resp.model_dump()
            else:
                response: ChatCompletion = client.chat.completions.create(**request_data)
                return response.model_dump()
        except json.JSONDecodeError as e:
            logger.error(f"[OpenAI] Failed to parse API response as JSON: {e}")
            raise LLMServerError(
                message=f"OpenAI API returned invalid JSON response (likely an HTML error page): {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"json_error": str(e), "error_position": f"line {e.lineno} column {e.colno}"},
            )

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        # Sanitize Unicode surrogates to prevent encoding errors
        request_data = sanitize_unicode_surrogates(request_data)

        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)
        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        try:
            if "input" in request_data and "messages" not in request_data:
                resp = await client.responses.create(**request_data)
                return resp.model_dump()
            else:
                response: ChatCompletion = await client.chat.completions.create(**request_data)
                return response.model_dump()
        except json.JSONDecodeError as e:
            logger.error(f"[OpenAI] Failed to parse API response as JSON: {e}")
            raise LLMServerError(
                message=f"OpenAI API returned invalid JSON response (likely an HTML error page): {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"json_error": str(e), "error_position": f"line {e.lineno} column {e.colno}"},
            )

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return is_openai_reasoning_model(llm_config.model)

    def extract_usage_statistics(self, response_data: dict | None, llm_config: LLMConfig) -> LettaUsageStatistics:
        """Extract usage statistics from OpenAI response and return as LettaUsageStatistics."""
        if not response_data:
            return LettaUsageStatistics()

        # Handle Responses API format (used by reasoning models like o1/o3)
        if response_data.get("object") == "response":
            usage = response_data.get("usage", {}) or {}
            prompt_tokens = usage.get("input_tokens") or 0
            completion_tokens = usage.get("output_tokens") or 0
            total_tokens = usage.get("total_tokens") or (prompt_tokens + completion_tokens)

            input_details = usage.get("input_tokens_details", {}) or {}
            cached_tokens = input_details.get("cached_tokens")

            output_details = usage.get("output_tokens_details", {}) or {}
            reasoning_tokens = output_details.get("reasoning_tokens")

            return LettaUsageStatistics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cached_input_tokens=cached_tokens,
                reasoning_tokens=reasoning_tokens,
            )

        # Handle standard Chat Completions API format using pydantic models
        from openai.types.chat import ChatCompletion

        try:
            completion = ChatCompletion.model_validate(response_data)
        except Exception:
            return LettaUsageStatistics()

        if not completion.usage:
            return LettaUsageStatistics()

        usage = completion.usage
        prompt_tokens = usage.prompt_tokens or 0
        completion_tokens = usage.completion_tokens or 0
        total_tokens = usage.total_tokens or (prompt_tokens + completion_tokens)

        # Extract cached tokens from prompt_tokens_details
        cached_tokens = None
        if usage.prompt_tokens_details:
            cached_tokens = usage.prompt_tokens_details.cached_tokens

        # Extract reasoning tokens from completion_tokens_details
        reasoning_tokens = None
        if usage.completion_tokens_details:
            reasoning_tokens = usage.completion_tokens_details.reasoning_tokens

        return LettaUsageStatistics(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cached_input_tokens=cached_tokens,
            reasoning_tokens=reasoning_tokens,
        )

    @trace_method
    async def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],  # Included for consistency, maybe used later
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Converts raw OpenAI response dict into the ChatCompletionResponse Pydantic model.
        Handles potential extraction of inner thoughts if they were added via kwargs.
        """
        if isinstance(response_data, str):
            raise LLMServerError(
                message="LLM endpoint returned a raw string instead of a JSON object. This usually indicates the endpoint URL is incorrect or returned an error page.",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"raw_response": response_data[:500]},
            )
        if "object" in response_data and response_data["object"] == "response":
            # Map Responses API shape to Chat Completions shape
            # See example payload in tests/integration_test_send_message_v2.py
            model = response_data.get("model")

            # Extract usage via centralized method
            from letta.schemas.enums import ProviderType

            usage_stats = self.extract_usage_statistics(response_data, llm_config).to_usage(ProviderType.openai)

            # Extract assistant message text from the outputs list
            outputs = response_data.get("output") or []
            assistant_text_parts = []
            reasoning_summary_parts = None
            reasoning_content_signature = None
            tool_calls = None

            # Check for incomplete_details first (e.g., max_output_tokens reached)
            incomplete_details = response_data.get("incomplete_details")
            if incomplete_details and incomplete_details.get("reason") == "max_output_tokens":
                finish_reason = "length"
            elif response_data.get("status") == "completed":
                finish_reason = "stop"
            else:
                finish_reason = None

            # Optionally capture reasoning presence
            for out in outputs:
                out_type = (out or {}).get("type")
                if out_type == "message":
                    content_list = (out or {}).get("content") or []
                    for part in content_list:
                        if (part or {}).get("type") == "output_text":
                            text_val = (part or {}).get("text")
                            if text_val:
                                assistant_text_parts.append(text_val)
                elif out_type == "reasoning":
                    reasoning_summary_parts = [part.get("text") for part in out.get("summary")]
                    reasoning_content_signature = out.get("encrypted_content")
                elif out_type == "function_call":
                    tool_calls = [
                        ToolCall(
                            id=out.get("call_id"),
                            type="function",
                            function=FunctionCall(
                                name=out.get("name"),
                                arguments=out.get("arguments"),
                            ),
                        )
                    ]

            assistant_text = "\n".join(assistant_text_parts) if assistant_text_parts else None

            # Build ChatCompletionResponse-compatible structure
            # Imports for these Pydantic models are already present in this module
            choice = Choice(
                index=0,
                finish_reason=finish_reason,
                message=ChoiceMessage(
                    role="assistant",
                    content=assistant_text or "",
                    reasoning_content="\n".join(reasoning_summary_parts) if reasoning_summary_parts else None,
                    reasoning_content_signature=reasoning_content_signature if reasoning_summary_parts else None,
                    redacted_reasoning_content=None,
                    omitted_reasoning_content=False,
                    tool_calls=tool_calls,
                ),
            )

            chat_completion_response = ChatCompletionResponse(
                id=response_data.get("id", ""),
                choices=[choice],
                created=int(response_data.get("created_at") or 0),
                model=model or (llm_config.model if hasattr(llm_config, "model") else None),
                usage=usage_stats,
            )

            return chat_completion_response

        # OpenAI's response structure directly maps to ChatCompletionResponse
        # We just need to instantiate the Pydantic model for validation and type safety.
        chat_completion_response = ChatCompletionResponse(**response_data)

        # Detect empty responses (no content and no tool calls)
        # Some providers (e.g., OpenRouter/GLM-5) return these instead of an error
        if chat_completion_response.choices and len(chat_completion_response.choices) > 0:
            choice = chat_completion_response.choices[0]
            if choice.message.content is None and not choice.message.tool_calls:
                raise LLMEmptyResponseError(
                    message=(
                        f"LLM provider returned empty content in response "
                        f"(ID: {chat_completion_response.id}, model: {chat_completion_response.model}, "
                        f"finish_reason: {choice.finish_reason})"
                    ),
                    code=ErrorCode.INTERNAL_SERVER_ERROR,
                    details={
                        "response_id": chat_completion_response.id,
                        "model": chat_completion_response.model,
                        "finish_reason": choice.finish_reason,
                        "response_data": str(response_data)[:500],
                    },
                )

        chat_completion_response = self._fix_truncated_json_response(chat_completion_response)

        # Parse reasoning_content from vLLM/OpenRouter/OpenAI proxies that return this field
        # This handles cases where the proxy returns .reasoning_content in the response
        if (
            chat_completion_response.choices
            and len(chat_completion_response.choices) > 0
            and chat_completion_response.choices[0].message
            and not chat_completion_response.choices[0].message.reasoning_content
        ):
            if "choices" in response_data and len(response_data["choices"]) > 0:
                choice_data = response_data["choices"][0]
                message_data = choice_data.get("message", {})
                # Check for reasoning_content (standard) or reasoning (OpenRouter)
                reasoning_content = message_data.get("reasoning_content") or message_data.get("reasoning")
                if reasoning_content:
                    chat_completion_response.choices[0].message.reasoning_content = reasoning_content
                    chat_completion_response.choices[0].message.reasoning_content_signature = None

        # Unpack inner thoughts if they were embedded in function arguments
        if llm_config.put_inner_thoughts_in_kwargs:
            chat_completion_response = unpack_all_inner_thoughts_from_kwargs(
                response=chat_completion_response, inner_thoughts_key=INNER_THOUGHTS_KWARG
            )

        # If we used a reasoning model, create a content part for the ommitted reasoning
        if self.is_reasoning_model(llm_config):
            chat_completion_response.choices[0].message.omitted_reasoning_content = True

        return chat_completion_response

    @trace_method
    async def stream_async(
        self,
        request_data: dict,
        llm_config: LLMConfig,
        use_websocket: bool = False,
        ws_session: OpenAIWSSessionManager | None = None,
    ) -> AsyncStream[ChatCompletionChunk | ResponseStreamEvent] | AsyncIterator[ResponseStreamEvent]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.

        Args:
            use_websocket: If True and the request is a Responses API request, use a
                WebSocket session instead of HTTP SSE. Requires ``ws_session``.
            ws_session: An active ``OpenAIWSSessionManager``. When provided *and*
                ``use_websocket`` is True, the request is sent over WebSocket.
                If ``use_websocket`` is True but no session is given, one is created
                on-the-fly (but won't persist across steps — prefer passing one).
        """
        # Sanitize Unicode surrogates to prevent encoding errors
        request_data = sanitize_unicode_surrogates(request_data)

        is_responses_request = "input" in request_data and "messages" not in request_data

        # --- WebSocket path (Responses API only) ---
        if use_websocket and is_responses_request:
            if ws_session is None:
                # Create a one-shot session (caller should prefer reuse)
                kwargs = await self._prepare_client_kwargs_async(llm_config)
                ws_session = OpenAIWSSessionManager(client_kwargs=kwargs)
            try:
                # Wrap in AsyncStreamCompat so callers can use ``async with stream:``
                return AsyncStreamCompat(ws_session.stream_responses(request_data))
            except Exception as e:
                logger.error(f"Error streaming OpenAI Responses WebSocket request: {e}")
                raise

        # --- HTTP SSE path (default) ---
        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)

        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if is_responses_request:
            try:
                response_stream: AsyncStream[ResponseStreamEvent] = await client.responses.create(
                    **request_data,
                    stream=True,
                    # stream_options={"include_usage": True},
                )
            except Exception as e:
                logger.error(f"Error streaming OpenAI Responses request: {e} with request data: {json.dumps(request_data)}")
                raise e
        else:
            try:
                response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
                    **request_data,
                    stream=True,
                    stream_options={"include_usage": True},
                )
            except Exception as e:
                logger.error(f"Error streaming OpenAI Chat Completions request: {e} with request data: {json.dumps(request_data)}")
                raise e
        return response_stream

    @trace_method
    async def stream_async_responses(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ResponseStreamEvent]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.
        """
        # Sanitize Unicode surrogates to prevent encoding errors
        request_data = sanitize_unicode_surrogates(request_data)

        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)
        response_stream: AsyncStream[ResponseStreamEvent] = await client.responses.create(**request_data, stream=True)
        return response_stream

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config with chunking and retry logic

        Retry strategy prioritizes reducing batch size before chunk size to maintain retrieval quality:
        1. Start with batch_size=2048 (texts per request)
        2. On failure, halve batch_size until it reaches 1
        3. Only then start reducing chunk_size (for very large individual texts)
        """
        if not inputs:
            return []

        request_start = time.time()
        logger.info(f"DIAGNOSTIC: request_embeddings called with {len(inputs)} inputs, model={embedding_config.embedding_model}")

        # Validate inputs - OpenAI rejects empty strings or non-string values
        # See: https://community.openai.com/t/embedding-api-change-input-is-invalid/707490/7
        valid_inputs = []
        input_index_map = []  # Map valid input index back to original index

        for idx, inp in enumerate(inputs):
            if not isinstance(inp, str):
                logger.error(f"Invalid input at index {idx}: type={type(inp)}, value={inp}")
                raise ValueError(f"Input at index {idx} is not a string: {type(inp)}")
            if not inp or not inp.strip():
                logger.warning(f"Empty or whitespace-only input at index {idx}, replacing with placeholder")
                # Replace empty strings with placeholder to avoid API rejection
                valid_inputs.append(" ")
                input_index_map.append(idx)
            else:
                valid_inputs.append(inp)
                input_index_map.append(idx)

        if not valid_inputs:
            logger.error("All inputs are empty after validation")
            raise ValueError("Cannot request embeddings for empty inputs")

        # Use valid_inputs instead of inputs for processing
        inputs = valid_inputs

        kwargs = self._prepare_client_kwargs_embedding(embedding_config)
        client = AsyncOpenAI(**kwargs)

        # track results by original index to maintain order
        results = [None] * len(inputs)
        initial_batch_size = 2048
        chunks_to_process = [(i, inputs[i : i + initial_batch_size], initial_batch_size) for i in range(0, len(inputs), initial_batch_size)]
        min_chunk_size = 128

        while chunks_to_process:
            tasks = []
            task_metadata = []

            for start_idx, chunk_inputs, current_batch_size in chunks_to_process:
                if not chunk_inputs:
                    logger.warning(f"Skipping empty chunk at start_idx={start_idx}")
                    continue

                logger.info(
                    f"DIAGNOSTIC: Creating embedding task: start_idx={start_idx}, batch_size={len(chunk_inputs)}, "
                    f"first_input_len={len(chunk_inputs[0]) if chunk_inputs else 0}, "
                    f"model={embedding_config.embedding_model}"
                )
                task = client.embeddings.create(model=embedding_config.embedding_model, input=chunk_inputs)
                tasks.append(task)
                task_metadata.append((start_idx, chunk_inputs, current_batch_size))

            if not tasks:
                logger.warning("All chunks were empty, skipping embedding request")
                break

            gather_start = time.time()
            logger.info(f"DIAGNOSTIC: Awaiting {len(tasks)} embedding API calls...")
            task_results = await asyncio.gather(*tasks, return_exceptions=True)
            gather_duration = time.time() - gather_start

            if gather_duration > 1.0:
                logger.warning(f"DIAGNOSTIC: SLOW embedding API gather took {gather_duration:.2f}s for {len(tasks)} tasks")
            else:
                logger.info(f"DIAGNOSTIC: Embedding API gather completed in {gather_duration:.2f}s")

            failed_chunks = []
            for (start_idx, chunk_inputs, current_batch_size), result in zip(task_metadata, task_results):
                if isinstance(result, Exception):
                    current_size = len(chunk_inputs)

                    if current_batch_size > 1:
                        new_batch_size = max(1, current_batch_size // 2)
                        logger.warning(
                            f"Embeddings request failed for batch starting at {start_idx} with size {current_size}. "
                            f"Reducing batch size from {current_batch_size} to {new_batch_size} and retrying."
                        )
                        mid = max(1, len(chunk_inputs) // 2)
                        if chunk_inputs[:mid]:
                            failed_chunks.append((start_idx, chunk_inputs[:mid], new_batch_size))
                        if chunk_inputs[mid:]:
                            failed_chunks.append((start_idx + mid, chunk_inputs[mid:], new_batch_size))
                    elif current_size > min_chunk_size:
                        logger.warning(
                            f"Embeddings request failed for single item at {start_idx} with size {current_size}. "
                            f"Splitting individual text content and retrying."
                        )
                        mid = max(1, len(chunk_inputs) // 2)
                        if chunk_inputs[:mid]:
                            failed_chunks.append((start_idx, chunk_inputs[:mid], 1))
                        if chunk_inputs[mid:]:
                            failed_chunks.append((start_idx + mid, chunk_inputs[mid:], 1))
                    else:
                        chunk_preview = str(chunk_inputs)[:500] if chunk_inputs else "None"
                        logger.error(
                            f"Failed to get embeddings for chunk starting at {start_idx} even with batch_size=1 "
                            f"and minimum chunk size {min_chunk_size}. Error: {result}. "
                            f"Chunk preview (first 500 chars): {chunk_preview}"
                        )
                        raise result
                else:
                    embeddings = [r.embedding for r in result.data]
                    for i, embedding in enumerate(embeddings):
                        results[start_idx + i] = embedding

            chunks_to_process = failed_chunks

        total_duration = time.time() - request_start
        if total_duration > 2.0:
            logger.error(f"DIAGNOSTIC: BLOCKING DETECTED - request_embeddings took {total_duration:.2f}s for {len(inputs)} inputs")
        elif total_duration > 1.0:
            logger.warning(f"DIAGNOSTIC: Slow request_embeddings took {total_duration:.2f}s for {len(inputs)} inputs")
        else:
            logger.info(f"DIAGNOSTIC: request_embeddings completed in {total_duration:.2f}s")

        return results

    @trace_method
    def handle_llm_error(self, e: Exception, llm_config: Optional[LLMConfig] = None) -> Exception:
        """
        Maps OpenAI-specific errors to common LLMError types.
        """
        is_byok = (llm_config.provider_category == ProviderCategory.byok) if llm_config else None

        # Log OpenRouter upstream provider errors with searchable tag
        if llm_config and self._is_openrouter_request(llm_config):
            or_provider = self._extract_openrouter_provider(e)
            logger.warning(
                f"[OPENROUTER_PROVIDER_ERROR] handle={llm_config.handle} "
                f"upstream_provider={or_provider} error_type={type(e).__name__} "
                f"status={getattr(e, 'status_code', None)} "
                f"message={str(e)[:500]}"
            )

        if isinstance(e, openai.APITimeoutError):
            timeout_duration = getattr(e, "timeout", "unknown")
            logger.warning(f"[OpenAI] Request timeout after {timeout_duration} seconds: {e}")
            return LLMTimeoutError(
                message=f"Request to OpenAI timed out: {str(e)}",
                code=ErrorCode.TIMEOUT,
                details={
                    "timeout_duration": timeout_duration,
                    "cause": str(e.__cause__) if e.__cause__ else None,
                    "is_byok": is_byok,
                },
            )

        if isinstance(e, openai.APIConnectionError):
            logger.warning(f"[OpenAI] API connection error: {e}")
            return LLMConnectionError(
                message=f"Failed to connect to OpenAI: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None, "is_byok": is_byok},
            )

        # Handle httpx.RemoteProtocolError which can occur during streaming
        # when the remote server closes the connection unexpectedly
        # (e.g., "peer closed connection without sending complete message body")
        if isinstance(e, httpx.RemoteProtocolError):
            logger.warning(f"[OpenAI] Remote protocol error during streaming: {e}")
            return LLMConnectionError(
                message=f"Connection error during OpenAI streaming: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None, "is_byok": is_byok},
            )

        # Handle httpx network errors which can occur during streaming
        # when the connection is unexpectedly closed while reading/writing
        if isinstance(e, (httpx.ReadError, httpx.WriteError, httpx.ConnectError)):
            logger.warning(f"[OpenAI] Network error during streaming: {type(e).__name__}: {e}")
            return LLMConnectionError(
                message=f"Network error during OpenAI streaming: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None, "error_type": type(e).__name__, "is_byok": is_byok},
            )

        if isinstance(e, openai.RateLimitError):
            logger.warning(f"[OpenAI] Rate limited (429). Consider backoff. Error: {e}")
            body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
            return LLMRateLimitError(
                message=f"Rate limited by OpenAI: {str(e)}",
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
                details={**body_details, "is_byok": is_byok},
            )

        if isinstance(e, openai.BadRequestError):
            logger.warning(f"[OpenAI] Bad request (400): {str(e)}")
            error_str = str(e)

            if "<html" in error_str.lower() or (e.body and isinstance(e.body, str) and "<html" in e.body.lower()):
                logger.warning("[OpenAI] Received HTML error response from upstream endpoint (likely ALB or reverse proxy)")
                return LLMBadRequestError(
                    message="Upstream endpoint returned HTML error (400 Bad Request). This usually indicates the configured API endpoint is not an OpenAI-compatible API or the request was rejected by a load balancer.",
                    code=ErrorCode.INVALID_ARGUMENT,
                    details={"raw_body_preview": error_str[:500], "is_byok": is_byok},
                )

            error_code = None
            if e.body and isinstance(e.body, dict):
                error_details = e.body.get("error", {})
                if isinstance(error_details, dict):
                    error_code = error_details.get("code")

            if error_code == "context_length_exceeded" or is_context_window_overflow_message(error_str):
                return ContextWindowExceededError(
                    message=f"Bad request to OpenAI (context window exceeded): {error_str}",
                    details={"is_byok": is_byok},
                )
            else:
                body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
                return LLMBadRequestError(
                    message=f"Bad request to OpenAI-compatible endpoint: {str(e)}",
                    code=ErrorCode.INVALID_ARGUMENT,
                    details={**body_details, "is_byok": is_byok},
                )

        # NOTE: The OpenAI Python SDK may raise a generic `openai.APIError` while *iterating*
        # over a stream (e.g. Responses API streaming). In this case we don't necessarily
        # get a `BadRequestError` with a structured error body, but we still want to
        # trigger Letta's context window compaction / retry logic.
        #
        # Example message:
        #   "Your input exceeds the context window of this model. Please adjust your input and try again."
        if isinstance(e, openai.APIError) and not isinstance(e, openai.APIStatusError):
            msg = str(e)
            if is_context_window_overflow_message(msg):
                return ContextWindowExceededError(
                    message=f"OpenAI request exceeded the context window: {msg}",
                    details={
                        "provider_exception_type": type(e).__name__,
                        "body": getattr(e, "body", None),
                        "is_byok": is_byok,
                    },
                )
            if is_insufficient_credits_message(msg):
                return LLMInsufficientCreditsError(
                    message=f"Insufficient credits (BYOK): {msg}" if is_byok else f"Insufficient credits: {msg}",
                    code=ErrorCode.PAYMENT_REQUIRED,
                    details={
                        "provider_exception_type": type(e).__name__,
                        "body": getattr(e, "body", None),
                        "is_byok": is_byok,
                    },
                )
            return LLMBadRequestError(
                message=f"OpenAI API error: {msg}",
                code=ErrorCode.INVALID_ARGUMENT,
                details={
                    "provider_exception_type": type(e).__name__,
                    "body": getattr(e, "body", None),
                    "is_byok": is_byok,
                },
            )

        if isinstance(e, openai.AuthenticationError):
            logger.error(f"[OpenAI] Authentication error (401): {str(e)}")  # More severe log level
            body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
            return LLMAuthenticationError(
                message=f"Authentication failed with OpenAI: {str(e)}",
                code=ErrorCode.UNAUTHENTICATED,
                details={**body_details, "is_byok": is_byok},
            )

        if isinstance(e, openai.PermissionDeniedError):
            logger.error(f"[OpenAI] Permission denied (403): {str(e)}")  # More severe log level
            body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
            return LLMPermissionDeniedError(
                message=f"Permission denied by OpenAI: {str(e)}",
                code=ErrorCode.PERMISSION_DENIED,
                details={**body_details, "is_byok": is_byok},
            )

        if isinstance(e, openai.NotFoundError):
            logger.warning(f"[OpenAI] Resource not found (404): {str(e)}")
            # Could be invalid model name, etc.
            body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
            return LLMNotFoundError(
                message=f"Resource not found in OpenAI: {str(e)}",
                code=ErrorCode.NOT_FOUND,
                details={**body_details, "is_byok": is_byok},
            )

        if isinstance(e, openai.UnprocessableEntityError):
            logger.warning(f"[OpenAI] Unprocessable entity (422): {str(e)}")
            body_details = e.body if isinstance(e.body, dict) else {"body": e.body}
            return LLMUnprocessableEntityError(
                message=f"Invalid request content for OpenAI: {str(e)}",
                code=ErrorCode.INVALID_ARGUMENT,
                details={**body_details, "is_byok": is_byok},
            )

        # General API error catch-all
        if isinstance(e, openai.APIStatusError):
            logger.warning(f"[OpenAI] API status error ({e.status_code}): {str(e)}")
            # Handle 413 Request Entity Too Large - request payload exceeds size limits
            if e.status_code == 413:
                return ContextWindowExceededError(
                    message=f"Request too large for OpenAI (413): {str(e)}",
                    details={"is_byok": is_byok},
                )
            # Handle 402 Payment Required or credit-related messages
            if e.status_code == 402 or is_insufficient_credits_message(str(e)):
                msg = str(e)
                return LLMInsufficientCreditsError(
                    message=f"Insufficient credits (BYOK): {msg}" if is_byok else f"Insufficient credits: {msg}",
                    code=ErrorCode.PAYMENT_REQUIRED,
                    details={"status_code": e.status_code, "body": e.body, "is_byok": is_byok},
                )
            # Map based on status code potentially
            if e.status_code >= 500:
                error_cls = LLMServerError
                error_code = ErrorCode.INTERNAL_SERVER_ERROR
            else:
                # Treat other 4xx as bad requests if not caught above
                error_cls = LLMBadRequestError
                error_code = ErrorCode.INVALID_ARGUMENT

            return error_cls(
                message=f"OpenAI API error: {str(e)}",
                code=error_code,
                details={
                    "status_code": e.status_code,
                    "response": str(e.response),
                    "body": e.body,
                    "is_byok": is_byok,
                },
            )

        # Fallback for unexpected errors
        return super().handle_llm_error(e, llm_config=llm_config)


def fill_image_content_in_messages(openai_message_list: List[dict], pydantic_message_list: List[PydanticMessage]) -> List[dict]:
    """
    Converts image content to openai format.
    """

    if len(openai_message_list) != len(pydantic_message_list):
        return openai_message_list

    new_message_list = []
    for idx in range(len(openai_message_list)):
        openai_message, pydantic_message = openai_message_list[idx], pydantic_message_list[idx]
        if pydantic_message.role != "user":
            new_message_list.append(openai_message)
            continue

        if not isinstance(pydantic_message.content, list) or (
            len(pydantic_message.content) == 1 and pydantic_message.content[0].type == MessageContentType.text
        ):
            new_message_list.append(openai_message)
            continue

        message_content = []
        for content in pydantic_message.content:
            if content.type == MessageContentType.text:
                message_content.append(
                    {
                        "type": "text",
                        "text": content.text,
                    }
                )
            elif content.type == MessageContentType.image:
                message_content.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content.source.media_type};base64,{content.source.data}",
                            "detail": content.source.detail or "auto",
                        },
                    }
                )
            else:
                raise ValueError(f"Unsupported content type {content.type}")

        new_message_list.append({"role": "user", "content": message_content})

    return new_message_list


def fill_image_content_in_responses_input(openai_message_list: List[dict], pydantic_message_list: List[PydanticMessage]) -> List[dict]:
    """
    Rewrite user messages in the Responses API input to embed multi-modal parts inside
    the message's content array (not as top-level items).

    Expected structure for Responses API input messages:
      { "type": "message", "role": "user", "content": [
           {"type": "input_text", "text": "..."},
           {"type": "input_image", "image_url": {"url": "data:<mime>;base64,<data>", "detail": "auto"}}
         ] }

    Non-user items are left unchanged.
    """
    user_msgs = [m for m in pydantic_message_list if getattr(m, "role", None) == "user"]
    user_idx = 0

    rewritten: List[dict] = []
    for item in openai_message_list:
        if isinstance(item, dict) and item.get("role") == "user":
            if user_idx >= len(user_msgs):
                rewritten.append(item)
                continue

            pm = user_msgs[user_idx]
            user_idx += 1

            existing_content = item.get("content")
            if _is_responses_style_content(existing_content):
                rewritten.append(item)
                continue

            # Only rewrite if the pydantic message actually contains multiple parts or images
            if not isinstance(pm.content, list) or (len(pm.content) == 1 and pm.content[0].type == MessageContentType.text):
                rewritten.append(item)
                continue

            parts: List[dict] = []
            for content in pm.content:
                if content.type == MessageContentType.text:
                    parts.append({"type": "input_text", "text": content.text})
                elif content.type == MessageContentType.image:
                    # For Responses API, image_url is a string and detail is required
                    data_url = f"data:{content.source.media_type};base64,{content.source.data}"
                    parts.append(
                        {"type": "input_image", "image_url": data_url, "detail": getattr(content.source, "detail", None) or "auto"}
                    )
                else:
                    # Skip unsupported content types for Responses input
                    continue

            # Update message content to include multi-modal parts (EasyInputMessageParam style)
            new_item = dict(item)
            new_item["content"] = parts
            rewritten.append(new_item)
        else:
            rewritten.append(item)

    return rewritten


def _is_responses_style_content(content: Optional[Any]) -> bool:
    if not isinstance(content, list):
        return False

    allowed_types = {"input_text", "input_image"}
    for part in content:
        if not isinstance(part, dict):
            return False
        part_type = part.get("type")
        if part_type not in allowed_types:
            return False
    return True
