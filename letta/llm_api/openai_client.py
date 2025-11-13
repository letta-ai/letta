import asyncio
import os
from typing import List, Optional

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
    LLMNotFoundError,
    LLMPermissionDeniedError,
    LLMRateLimitError,
    LLMServerError,
    LLMTimeoutError,
    LLMUnprocessableEntityError,
)
from letta.llm_api.helpers import add_inner_thoughts_to_functions, convert_to_structured_output, unpack_all_inner_thoughts_from_kwargs
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION, INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import MessageContentType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_request import (
    ChatCompletionRequest,
    FunctionCall as ToolFunctionChoiceFunctionCall,
    FunctionSchema,
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
    UsageStatistics,
)
from letta.schemas.openai.responses_request import ResponsesRequest
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
    if is_openai_reasoning_model(model) and "o1-mini" not in model or "o1-preview" in model:
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

        # Default to global OpenAI key when no BYOK override
        if not api_key:
            api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")

        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

        # OpenRouter-specific overrides: use OpenRouter key and optional headers
        is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
            llm_config.provider_name == "openrouter"
        )
        if is_openrouter:
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

        if not api_key:
            api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

        is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
            llm_config.provider_name == "openrouter"
        )
        if is_openrouter:
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
    ) -> dict:
        """
        Constructs a request object in the expected data format for the OpenAI Responses API.
        """
        if llm_config.put_inner_thoughts_in_kwargs:
            raise ValueError("Inner thoughts in kwargs are not supported for the OpenAI Responses API")

        openai_messages_list = PydanticMessage.to_openai_responses_dicts_from_list(
            messages, tool_return_truncation_chars=tool_return_truncation_chars
        )
        # Add multi-modal support for Responses API by rewriting user messages
        # into input_text/input_image parts.
        openai_messages_list = fill_image_content_in_responses_input(openai_messages_list, messages)

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

            # Convert to strict mode
            if supports_structured_output(llm_config):
                for tool in typed_tools:
                    try:
                        structured_output_version = convert_to_structured_output(tool.function.model_dump())
                        tool.function = FunctionSchema(**structured_output_version)
                    except ValueError as e:
                        logger.warning(f"Failed to convert tool function to structured output, tool={tool}, error={e}")

                # Finally convert to a Responses-friendly dict
                responses_tools = [
                    {
                        "type": "function",
                        "name": t.function.name,
                        "description": t.function.description,
                        "parameters": t.function.parameters,
                        "strict": True,
                    }
                    for t in typed_tools
                ]

            else:
                # Finally convert to a Responses-friendly dict
                responses_tools = [
                    {
                        "type": "function",
                        "name": t.function.name,
                        "description": t.function.description,
                        "parameters": t.function.parameters,
                        # "strict": True,
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
            max_output_tokens=llm_config.max_tokens,
            temperature=llm_config.temperature if supports_temperature_param(model) else None,
            parallel_tool_calls=llm_config.parallel_tool_calls if tools and supports_parallel_tool_calling(model) else False,
        )

        # Add verbosity control for GPT-5 models
        if supports_verbosity_control(model) and llm_config.verbosity:
            # data.verbosity = llm_config.verbosity
            # https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools
            data.text = ResponseTextConfigParam(verbosity=llm_config.verbosity)

        # Add reasoning effort control for reasoning models
        if is_openai_reasoning_model(model) and llm_config.reasoning_effort:
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

        request_data = data.model_dump(exclude_unset=True)
        # print("responses request data", request_data)
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

        openai_message_list = [
            cast_message_to_subtype(m)
            for m in PydanticMessage.to_openai_dicts_from_list(
                messages,
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
        is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
            llm_config.provider_name == "openrouter"
        )
        if is_openrouter:
            try:
                model = llm_config.handle.split("/", 1)[-1]
            except:
                # don't raise error since this isn't robust against edge cases
                pass

        # force function calling for reliability, see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
        # TODO(matt) move into LLMConfig
        # TODO: This vllm checking is very brittle and is a patch at most
        tool_choice = None
        if tools:  # only set tool_choice if tools exist
            if force_tool_call is not None:
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

        # Add verbosity control for GPT-5 models
        if supports_verbosity_control(model) and llm_config.verbosity:
            data.verbosity = llm_config.verbosity

        # Add reasoning effort control for reasoning models
        if is_openai_reasoning_model(model) and llm_config.reasoning_effort:
            data.reasoning_effort = llm_config.reasoning_effort

        if llm_config.frequency_penalty is not None:
            data.frequency_penalty = llm_config.frequency_penalty

        if tools and supports_parallel_tool_calling(model):
            data.parallel_tool_calls = False

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

        if data.tools is not None and len(data.tools) > 0:
            # Convert to structured output style (which has 'strict' and no optionals)
            for tool in data.tools:
                if supports_structured_output(llm_config):
                    try:
                        structured_output_version = convert_to_structured_output(tool.function.model_dump())
                        tool.function = FunctionSchema(**structured_output_version)
                    except ValueError as e:
                        logger.warning(f"Failed to convert tool function to structured output, tool={tool}, error={e}")
        request_data = data.model_dump(exclude_unset=True)

        # If Ollama
        # if llm_config.handle.startswith("ollama/") and llm_config.enable_reasoner:
        # Sadly, reasoning via the OpenAI proxy on Ollama only works for Harmony/gpt-oss
        # Ollama's OpenAI layer simply looks for the presence of 'reasoining' or 'reasoning_effort'
        # If set, then in the backend "medium" thinking is turned on
        # request_data["reasoning_effort"] = "medium"

        return request_data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        client = OpenAI(**self._prepare_client_kwargs(llm_config))
        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if "input" in request_data and "messages" not in request_data:
            resp = client.responses.create(**request_data)
            return resp.model_dump()
        else:
            response: ChatCompletion = client.chat.completions.create(**request_data)
            return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)
        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if "input" in request_data and "messages" not in request_data:
            resp = await client.responses.create(**request_data)
            return resp.model_dump()
        else:
            response: ChatCompletion = await client.chat.completions.create(**request_data)
            return response.model_dump()

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return is_openai_reasoning_model(llm_config.model)

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
        if "object" in response_data and response_data["object"] == "response":
            # Map Responses API shape to Chat Completions shape
            # See example payload in tests/integration_test_send_message_v2.py
            model = response_data.get("model")

            # Extract usage
            usage = response_data.get("usage", {}) or {}
            prompt_tokens = usage.get("input_tokens") or 0
            completion_tokens = usage.get("output_tokens") or 0
            total_tokens = usage.get("total_tokens") or (prompt_tokens + completion_tokens)

            # Extract assistant message text from the outputs list
            outputs = response_data.get("output") or []
            assistant_text_parts = []
            reasoning_summary_parts = None
            reasoning_content_signature = None
            tool_calls = None
            finish_reason = "stop" if (response_data.get("status") == "completed") else None

            # Optionally capture reasoning presence
            found_reasoning = False
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
                    found_reasoning = True
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
                usage=UsageStatistics(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                ),
            )

            return chat_completion_response

        # OpenAI's response structure directly maps to ChatCompletionResponse
        # We just need to instantiate the Pydantic model for validation and type safety.
        chat_completion_response = ChatCompletionResponse(**response_data)
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
                if "message" in choice_data and "reasoning_content" in choice_data["message"]:
                    reasoning_content = choice_data["message"]["reasoning_content"]
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
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk | ResponseStreamEvent]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.
        """
        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)

        # Route based on payload shape: Responses uses 'input', Chat Completions uses 'messages'
        if "input" in request_data and "messages" not in request_data:
            response_stream: AsyncStream[ResponseStreamEvent] = await client.responses.create(
                **request_data,
                stream=True,
                # stream_options={"include_usage": True},
            )
        else:
            response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
                **request_data,
                stream=True,
                stream_options={"include_usage": True},
            )
        return response_stream

    @trace_method
    async def stream_async_responses(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ResponseStreamEvent]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.
        """
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

        logger.info(f"request_embeddings called with {len(inputs)} inputs, model={embedding_config.embedding_model}")

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
                logger.info(
                    f"Creating embedding task: start_idx={start_idx}, batch_size={len(chunk_inputs)}, "
                    f"first_input_len={len(chunk_inputs[0]) if chunk_inputs else 0}, "
                    f"model={embedding_config.embedding_model}"
                )
                task = client.embeddings.create(model=embedding_config.embedding_model, input=chunk_inputs)
                tasks.append(task)
                task_metadata.append((start_idx, chunk_inputs, current_batch_size))

            task_results = await asyncio.gather(*tasks, return_exceptions=True)

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
                        mid = len(chunk_inputs) // 2
                        failed_chunks.append((start_idx, chunk_inputs[:mid], new_batch_size))
                        failed_chunks.append((start_idx + mid, chunk_inputs[mid:], new_batch_size))
                    elif current_size > min_chunk_size:
                        logger.warning(
                            f"Embeddings request failed for single item at {start_idx} with size {current_size}. "
                            f"Splitting individual text content and retrying."
                        )
                        mid = len(chunk_inputs) // 2
                        failed_chunks.append((start_idx, chunk_inputs[:mid], 1))
                        failed_chunks.append((start_idx + mid, chunk_inputs[mid:], 1))
                    else:
                        logger.error(
                            f"Failed to get embeddings for chunk starting at {start_idx} even with batch_size=1 "
                            f"and minimum chunk size {min_chunk_size}. Error: {result}"
                        )
                        raise result
                else:
                    embeddings = [r.embedding for r in result.data]
                    for i, embedding in enumerate(embeddings):
                        results[start_idx + i] = embedding

            chunks_to_process = failed_chunks

        return results

    @trace_method
    def handle_llm_error(self, e: Exception) -> Exception:
        """
        Maps OpenAI-specific errors to common LLMError types.
        """
        if isinstance(e, openai.APITimeoutError):
            timeout_duration = getattr(e, "timeout", "unknown")
            logger.warning(f"[OpenAI] Request timeout after {timeout_duration} seconds: {e}")
            return LLMTimeoutError(
                message=f"Request to OpenAI timed out: {str(e)}",
                code=ErrorCode.TIMEOUT,
                details={
                    "timeout_duration": timeout_duration,
                    "cause": str(e.__cause__) if e.__cause__ else None,
                },
            )

        if isinstance(e, openai.APIConnectionError):
            logger.warning(f"[OpenAI] API connection error: {e}")
            return LLMConnectionError(
                message=f"Failed to connect to OpenAI: {str(e)}",
                code=ErrorCode.INTERNAL_SERVER_ERROR,
                details={"cause": str(e.__cause__) if e.__cause__ else None},
            )

        if isinstance(e, openai.RateLimitError):
            logger.warning(f"[OpenAI] Rate limited (429). Consider backoff. Error: {e}")
            return LLMRateLimitError(
                message=f"Rate limited by OpenAI: {str(e)}",
                code=ErrorCode.RATE_LIMIT_EXCEEDED,
                details=e.body,  # Include body which often has rate limit details
            )

        if isinstance(e, openai.BadRequestError):
            logger.warning(f"[OpenAI] Bad request (400): {str(e)}")
            # BadRequestError can signify different issues (e.g., invalid args, context length)
            # Check for context_length_exceeded error code in the error body
            error_code = None
            if e.body and isinstance(e.body, dict):
                error_details = e.body.get("error", {})
                if isinstance(error_details, dict):
                    error_code = error_details.get("code")

            # Check both the error code and message content for context length issues
            if (
                error_code == "context_length_exceeded"
                or "This model's maximum context length is" in str(e)
                or "Input tokens exceed the configured limit" in str(e)
            ):
                return ContextWindowExceededError(
                    message=f"Bad request to OpenAI (context window exceeded): {str(e)}",
                )
            else:
                return LLMBadRequestError(
                    message=f"Bad request to OpenAI: {str(e)}",
                    code=ErrorCode.INVALID_ARGUMENT,  # Or more specific if detectable
                    details=e.body,
                )

        if isinstance(e, openai.AuthenticationError):
            logger.error(f"[OpenAI] Authentication error (401): {str(e)}")  # More severe log level
            return LLMAuthenticationError(
                message=f"Authentication failed with OpenAI: {str(e)}", code=ErrorCode.UNAUTHENTICATED, details=e.body
            )

        if isinstance(e, openai.PermissionDeniedError):
            logger.error(f"[OpenAI] Permission denied (403): {str(e)}")  # More severe log level
            return LLMPermissionDeniedError(
                message=f"Permission denied by OpenAI: {str(e)}", code=ErrorCode.PERMISSION_DENIED, details=e.body
            )

        if isinstance(e, openai.NotFoundError):
            logger.warning(f"[OpenAI] Resource not found (404): {str(e)}")
            # Could be invalid model name, etc.
            return LLMNotFoundError(message=f"Resource not found in OpenAI: {str(e)}", code=ErrorCode.NOT_FOUND, details=e.body)

        if isinstance(e, openai.UnprocessableEntityError):
            logger.warning(f"[OpenAI] Unprocessable entity (422): {str(e)}")
            return LLMUnprocessableEntityError(
                message=f"Invalid request content for OpenAI: {str(e)}",
                code=ErrorCode.INVALID_ARGUMENT,  # Usually validation errors
                details=e.body,
            )

        # General API error catch-all
        if isinstance(e, openai.APIStatusError):
            logger.warning(f"[OpenAI] API status error ({e.status_code}): {str(e)}")
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
                },
            )

        # Fallback for unexpected errors
        return super().handle_llm_error(e)


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
