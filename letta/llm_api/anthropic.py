import json
import re
import time
import warnings
from typing import Generator, List, Optional, Union

import anthropic
from anthropic import PermissionDeniedError
from anthropic.types.beta import (
    BetaRawContentBlockDeltaEvent,
    BetaRawContentBlockStartEvent,
    BetaRawContentBlockStopEvent,
    BetaRawMessageDeltaEvent,
    BetaRawMessageStartEvent,
    BetaRawMessageStopEvent,
    BetaRedactedThinkingBlock,
    BetaTextBlock,
    BetaThinkingBlock,
    BetaToolUseBlock,
)

from letta.errors import BedrockError, BedrockPermissionError, ErrorCode, LLMAuthenticationError, LLMError
from letta.helpers.datetime_helpers import get_utc_time_int
from letta.llm_api.aws_bedrock import get_bedrock_client
from letta.llm_api.helpers import add_inner_thoughts_to_functions
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION
from letta.log import get_logger
from letta.otel.tracing import log_event
from letta.schemas.enums import ProviderCategory
from letta.schemas.message import Message as _Message
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, Tool
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionChunkResponse,
    ChatCompletionResponse,
    Choice,
    ChunkChoice,
    FunctionCall,
    FunctionCallDelta,
)
from letta.schemas.openai.chat_completion_response import Message as ChoiceMessage
from letta.schemas.openai.chat_completion_response import MessageDelta, ToolCall, ToolCallDelta, UsageStatistics
from letta.services.provider_manager import ProviderManager
from letta.services.user_manager import UserManager
from letta.settings import model_settings

logger = get_logger(__name__)

BASE_URL = "https://api.anthropic.com/v1"


# https://docs.anthropic.com/claude/docs/models-overview
# Sadly hardcoded
MODEL_LIST = [
    ## Opus 4.1
    {
        "name": "claude-opus-4-1-20250805",
        "context_window": 200000,
    },
    ## Opus 3
    {
        "name": "claude-3-opus-20240229",
        "context_window": 200000,
    },
    # 3 latest
    {
        "name": "claude-3-opus-latest",
        "context_window": 200000,
    },
    # 4
    {
        "name": "claude-opus-4-20250514",
        "context_window": 200000,
    },
    ## Sonnet
    # 3.0
    {
        "name": "claude-3-sonnet-20240229",
        "context_window": 200000,
    },
    # 3.5
    {
        "name": "claude-3-5-sonnet-20240620",
        "context_window": 200000,
    },
    # 3.5 new
    {
        "name": "claude-3-5-sonnet-20241022",
        "context_window": 200000,
    },
    # 3.5 latest
    {
        "name": "claude-3-5-sonnet-latest",
        "context_window": 200000,
    },
    # 3.7
    {
        "name": "claude-3-7-sonnet-20250219",
        "context_window": 200000,
    },
    # 3.7 latest
    {
        "name": "claude-3-7-sonnet-latest",
        "context_window": 200000,
    },
    # 4
    {
        "name": "claude-sonnet-4-20250514",
        "context_window": 200000,
    },
    ## Haiku
    # 3.0
    {
        "name": "claude-3-haiku-20240307",
        "context_window": 200000,
    },
    # 3.5
    {
        "name": "claude-3-5-haiku-20241022",
        "context_window": 200000,
    },
    # 3.5 latest
    {
        "name": "claude-3-5-haiku-latest",
        "context_window": 200000,
    },
]

DUMMY_FIRST_USER_MESSAGE = "User initializing bootup sequence."

VALID_EVENT_TYPES = {"content_block_stop", "message_stop"}


def anthropic_check_valid_api_key(api_key: Union[str, None]) -> None:
    if api_key:
        anthropic_client = anthropic.Anthropic(api_key=api_key)
        try:
            # just use a cheap model to count some tokens - as of 5/7/2025 this is faster than fetching the list of models
            anthropic_client.messages.count_tokens(model=MODEL_LIST[-1]["name"], messages=[{"role": "user", "content": "a"}])
        except anthropic.AuthenticationError as e:
            raise LLMAuthenticationError(message=f"Failed to authenticate with Anthropic: {e}", code=ErrorCode.UNAUTHENTICATED)
        except Exception as e:
            raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)
    else:
        raise ValueError("No API key provided")


def antropic_get_model_context_window(url: str, api_key: Union[str, None], model: str) -> int:
    for model_dict in anthropic_get_model_list(api_key=api_key):
        if model_dict["name"] == model:
            return model_dict["context_window"]
    raise ValueError(f"Can't find model '{model}' in Anthropic model list")


def anthropic_get_model_list(api_key: Optional[str]) -> dict:
    """https://docs.anthropic.com/claude/docs/models-overview"""

    # NOTE: currently there is no GET /models, so we need to hardcode
    # return MODEL_LIST

    if api_key:
        anthropic_client = anthropic.Anthropic(api_key=api_key)
    elif model_settings.anthropic_api_key:
        anthropic_client = anthropic.Anthropic()
    else:
        raise ValueError("No API key provided")

    models = anthropic_client.models.list()
    models_json = models.model_dump()
    assert "data" in models_json, f"Anthropic model query response missing 'data' field: {models_json}"
    return models_json["data"]


async def anthropic_get_model_list_async(api_key: Optional[str]) -> dict:
    """https://docs.anthropic.com/claude/docs/models-overview"""

    # NOTE: currently there is no GET /models, so we need to hardcode
    # return MODEL_LIST

    if api_key:
        anthropic_client = anthropic.AsyncAnthropic(api_key=api_key)
    elif model_settings.anthropic_api_key:
        anthropic_client = anthropic.AsyncAnthropic()
    else:
        raise ValueError("No API key provided")

    models = await anthropic_client.models.list()
    models_json = models.model_dump()
    assert "data" in models_json, f"Anthropic model query response missing 'data' field: {models_json}"
    return models_json["data"]


def convert_tools_to_anthropic_format(tools: List[Tool]) -> List[dict]:
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
        formatted_tool = {
            "name": tool.function.name,
            "description": tool.function.description,
            "input_schema": tool.function.parameters or {"type": "object", "properties": {}, "required": []},
        }
        formatted_tools.append(formatted_tool)

    return formatted_tools


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
            merged_content = current_content + next_content
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
        raise ValueError(f"Unexpected stop_reason: {stop_reason}")


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


def convert_anthropic_response_to_chatcompletion(
    response: anthropic.types.Message,
    inner_thoughts_xml_tag: Optional[str] = None,
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
    prompt_tokens = response.usage.input_tokens
    completion_tokens = response.usage.output_tokens
    finish_reason = remap_finish_reason(response.stop_reason)

    content = None
    reasoning_content = None
    reasoning_content_signature = None
    redacted_reasoning_content = None
    tool_calls = None

    if len(response.content) > 0:
        for content_part in response.content:
            if content_part.type == "text":
                content = strip_xml_tags(string=content_part.text, tag=inner_thoughts_xml_tag)
            if content_part.type == "tool_use":
                tool_calls = [
                    ToolCall(
                        id=content_part.id,
                        type="function",
                        function=FunctionCall(
                            name=content_part.name,
                            arguments=json.dumps(content_part.input, indent=2),
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

    return ChatCompletionResponse(
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


def convert_anthropic_stream_event_to_chatcompletion(
    event: Union[
        BetaRawMessageStartEvent,
        BetaRawContentBlockStartEvent,
        BetaRawContentBlockDeltaEvent,
        BetaRawContentBlockStopEvent,
        BetaRawMessageDeltaEvent,
        BetaRawMessageStopEvent,
    ],
    message_id: str,
    model: str,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
) -> ChatCompletionChunkResponse:
    """Convert Anthropic stream events to OpenAI ChatCompletionResponse format.

        Args:
            event: The event to convert
            message_id: The ID of the message. Anthropic does not return this on every event, so we need to keep track of it
            model: The model used. Anthropic does not return this on every event, so we need to keep track of it

        Example response from OpenAI:

        'id': 'MESSAGE_ID',
        'choices': [
            {
                'finish_reason': None,
                'index': 0,
                'delta': {
                    'content': None,
                    'tool_calls': [
                        {
                            'index': 0,
                            'id': None,
                            'type': 'function',
                            'function': {
                                'name': None,
                                'arguments': '_th'
                            }
                        }
                    ],
                    'function_call': None
                },
                'logprobs': None
            }
        ],
        'created': 1713216662,
        'model': 'gpt-4o-mini-2024-07-18',
        'system_fingerprint': 'fp_bd83329f63',
        'object': 'chat.completion.chunk'
    }
    """
    # Get finish reason
    finish_reason = None
    completion_chunk_tokens = 0

    # Get content and tool calls
    content = None
    reasoning_content = None
    reasoning_content_signature = None
    redacted_reasoning_content = None  # NOTE called "data" in the stream
    tool_calls = None
    if isinstance(event, BetaRawMessageStartEvent):
        """
        BetaRawMessageStartEvent(
            message=BetaMessage(
                content=[],
                usage=BetaUsage(
                    input_tokens=3086,
                    output_tokens=1,
                ),
                ...,
            ),
            type='message_start'
        )
        """
        completion_chunk_tokens += event.message.usage.output_tokens

    elif isinstance(event, BetaRawMessageDeltaEvent):
        """
        BetaRawMessageDeltaEvent(
            delta=Delta(
                stop_reason='tool_use',
                stop_sequence=None
            ),
            type='message_delta',
            usage=BetaMessageDeltaUsage(output_tokens=45)
        )
        """
        finish_reason = remap_finish_reason(event.delta.stop_reason)
        completion_chunk_tokens += event.usage.output_tokens

    elif isinstance(event, BetaRawContentBlockDeltaEvent):
        """
        BetaRawContentBlockDeltaEvent(
            delta=BetaInputJSONDelta(
                partial_json='lo',
                type='input_json_delta'
            ),
            index=0,
            type='content_block_delta'
        )

        OR

        BetaRawContentBlockDeltaEvent(
            delta=BetaTextDelta(
                text='👋 ',
                type='text_delta'
            ),
            index=0,
            type='content_block_delta'
        )

        """
        # ReACT COT
        if event.delta.type == "text_delta":
            content = strip_xml_tags_streaming(string=event.delta.text, tag=inner_thoughts_xml_tag)

        # Extended thought COT
        elif event.delta.type == "thinking_delta":
            # Redacted doesn't come in the delta chunks, comes all at once
            # "redacted_thinking blocks will not have any deltas associated and will be sent as a single event."
            # Thinking might start with ""
            if len(event.delta.thinking) > 0:
                reasoning_content = event.delta.thinking

        # Extended thought COT signature
        elif event.delta.type == "signature_delta":
            if len(event.delta.signature) > 0:
                reasoning_content_signature = event.delta.signature

        # Tool calling
        elif event.delta.type == "input_json_delta":
            tool_calls = [
                ToolCallDelta(
                    index=0,
                    function=FunctionCallDelta(
                        name=None,
                        arguments=event.delta.partial_json,
                    ),
                )
            ]
        else:
            warnings.warn("Unexpected delta type: " + event.delta.type)

    elif isinstance(event, BetaRawContentBlockStartEvent):
        """
        BetaRawContentBlockStartEvent(
             content_block=BetaToolUseBlock(
                 id='toolu_01LmpZhRhR3WdrRdUrfkKfFw',
                 input={},
                 name='get_weather',
                 type='tool_use'
             ),
             index=0,
             type='content_block_start'
         )

         OR

         BetaRawContentBlockStartEvent(
             content_block=BetaTextBlock(
                 text='',
                 type='text'
             ),
             index=0,
             type='content_block_start'
         )
        """
        if isinstance(event.content_block, BetaToolUseBlock):
            tool_calls = [
                ToolCallDelta(
                    index=0,
                    id=event.content_block.id,
                    function=FunctionCallDelta(
                        name=event.content_block.name,
                        arguments="",
                    ),
                )
            ]
        elif isinstance(event.content_block, BetaTextBlock):
            content = event.content_block.text
        elif isinstance(event.content_block, BetaThinkingBlock):
            reasoning_content = event.content_block.thinking
        elif isinstance(event.content_block, BetaRedactedThinkingBlock):
            redacted_reasoning_content = event.content_block.data
        else:
            warnings.warn("Unexpected content start type: " + str(type(event.content_block)))
    elif event.type in VALID_EVENT_TYPES:
        pass
    else:
        warnings.warn("Unexpected event type: " + event.type)

    # Initialize base response
    choice = ChunkChoice(
        index=0,
        finish_reason=finish_reason,
        delta=MessageDelta(
            content=content,
            reasoning_content=reasoning_content,
            reasoning_content_signature=reasoning_content_signature,
            redacted_reasoning_content=redacted_reasoning_content,
            tool_calls=tool_calls,
        ),
    )
    return ChatCompletionChunkResponse(
        id=message_id,
        choices=[choice],
        created=get_utc_time_int(),
        model=model,
        output_tokens=completion_chunk_tokens,
    )


def _prepare_anthropic_request(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
    # if true, prefix fill the generation with the thinking tag
    prefix_fill: bool = False,
    # if true, put COT inside the tool calls instead of inside the content
    put_inner_thoughts_in_kwargs: bool = True,
    bedrock: bool = False,
    # extended thinking related fields
    # https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
    extended_thinking: bool = False,
    max_reasoning_tokens: Optional[int] = None,
) -> dict:
    """Prepare the request data for Anthropic API format."""
    if extended_thinking:
        assert (
            max_reasoning_tokens is not None and max_reasoning_tokens < data.max_tokens
        ), "max tokens must be greater than thinking budget"
        if put_inner_thoughts_in_kwargs:
            logger.warning("Extended thinking not compatible with put_inner_thoughts_in_kwargs")
            put_inner_thoughts_in_kwargs = False
        # assert not prefix_fill, "extended thinking not compatible with prefix_fill"
        # Silently disable prefix_fill for now
        prefix_fill = False

    # if needed, put inner thoughts as a kwarg for all tools
    if data.tools and put_inner_thoughts_in_kwargs:
        functions = add_inner_thoughts_to_functions(
            functions=[t.function.model_dump() for t in data.tools],
            inner_thoughts_key=INNER_THOUGHTS_KWARG,
            inner_thoughts_description=INNER_THOUGHTS_KWARG_DESCRIPTION,
        )
        data.tools = [Tool(function=f) for f in functions]

    # convert the tools to Anthropic's payload format
    anthropic_tools = None if data.tools is None else convert_tools_to_anthropic_format(data.tools)

    # pydantic -> dict
    data = data.model_dump(exclude_none=True)

    if extended_thinking:
        data["thinking"] = {
            "type": "enabled",
            "budget_tokens": max_reasoning_tokens,
        }
        # `temperature` may only be set to 1 when thinking is enabled. Please consult our documentation at https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#important-considerations-when-using-extended-thinking'
        data["temperature"] = 1.0

    if "functions" in data:
        raise ValueError("'functions' unexpected in Anthropic API payload")

    # Handle tools
    if "tools" in data and data["tools"] is None:
        data.pop("tools")
        data.pop("tool_choice", None)
    elif anthropic_tools is not None:
        # TODO eventually enable parallel tool use
        data["tools"] = anthropic_tools

    # Move 'system' to the top level
    assert data["messages"][0]["role"] == "system", f"Expected 'system' role in messages[0]:\n{data['messages'][0]}"
    data["system"] = data["messages"][0]["content"]
    data["messages"] = data["messages"][1:]

    # Process messages
    for message in data["messages"]:
        if "content" not in message:
            message["content"] = None

    # Convert to Anthropic format
    msg_objs = [
        _Message.dict_to_message(
            agent_id=None,
            openai_message_dict=m,
        )
        for m in data["messages"]
    ]
    data["messages"] = [
        m.to_anthropic_dict(
            inner_thoughts_xml_tag=inner_thoughts_xml_tag,
            put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
        )
        for m in msg_objs
    ]

    # Ensure first message is user
    if data["messages"][0]["role"] != "user":
        data["messages"] = [{"role": "user", "content": DUMMY_FIRST_USER_MESSAGE}] + data["messages"]

    # Handle alternating messages
    data["messages"] = merge_tool_results_into_user_messages(data["messages"])

    # Handle prefix fill (not compatible with inner-thouguhts-in-kwargs)
    # https://docs.anthropic.com/en/api/messages#body-messages
    # NOTE: cannot prefill with tools for opus:
    # Your API request included an `assistant` message in the final position, which would pre-fill the `assistant` response. When using tools with "claude-3-opus-20240229"
    if prefix_fill and not put_inner_thoughts_in_kwargs and "opus" not in data["model"]:
        if not bedrock:  # not support for bedrock
            data["messages"].append(
                # Start the thinking process for the assistant
                {"role": "assistant", "content": f"<{inner_thoughts_xml_tag}>"},
            )

    # Validate max_tokens
    assert "max_tokens" in data, data

    # Remove OpenAI-specific fields
    for field in ["frequency_penalty", "logprobs", "n", "top_p", "presence_penalty", "user", "stream"]:
        data.pop(field, None)

    return data


def anthropic_bedrock_chat_completions_request(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
    provider_name: Optional[str] = None,
    provider_category: Optional[ProviderCategory] = None,
    user_id: Optional[str] = None,
) -> ChatCompletionResponse:
    """Make a chat completion request to Anthropic via AWS Bedrock."""
    data = _prepare_anthropic_request(data, inner_thoughts_xml_tag, bedrock=True)

    # Get the client
    if provider_category == ProviderCategory.byok:
        actor = UserManager().get_user_or_default(user_id=user_id)
        access_key, secret_key, region = ProviderManager().get_bedrock_credentials_async(provider_name, actor=actor)
        client = get_bedrock_client(access_key, secret_key, region)
    else:
        client = get_bedrock_client()

    # Make the request
    try:
        # bedrock does not support certain args
        print("Warning: Tool rules not supported with Anthropic Bedrock")
        data["tool_choice"] = {"type": "any"}
        log_event(name="llm_request_sent", attributes=data)
        response = client.messages.create(**data)
        log_event(name="llm_response_received", attributes={"response": response.json()})
        return convert_anthropic_response_to_chatcompletion(response=response, inner_thoughts_xml_tag=inner_thoughts_xml_tag)
    except PermissionDeniedError:
        raise BedrockPermissionError(f"User does not have access to the Bedrock model with the specified ID. {data['model']}")
    except Exception as e:
        raise BedrockError(f"Bedrock error: {e}")


def anthropic_chat_completions_request_stream(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
    put_inner_thoughts_in_kwargs: bool = False,
    extended_thinking: bool = False,
    max_reasoning_tokens: Optional[int] = None,
    provider_name: Optional[str] = None,
    provider_category: Optional[ProviderCategory] = None,
    betas: List[str] = ["tools-2024-04-04"],
    user_id: Optional[str] = None,
) -> Generator[ChatCompletionChunkResponse, None, None]:
    """Stream chat completions from Anthropic API.

    Similar to OpenAI's streaming, but using Anthropic's native streaming support.
    See: https://docs.anthropic.com/claude/reference/messages-streaming
    """
    data = _prepare_anthropic_request(
        data=data,
        inner_thoughts_xml_tag=inner_thoughts_xml_tag,
        put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
        extended_thinking=extended_thinking,
        max_reasoning_tokens=max_reasoning_tokens,
    )
    if provider_category == ProviderCategory.byok:
        actor = UserManager().get_user_or_default(user_id=user_id)
        api_key = ProviderManager().get_override_key(provider_name, actor=actor)
        anthropic_client = anthropic.Anthropic(api_key=api_key)
    elif model_settings.anthropic_api_key:
        anthropic_client = anthropic.Anthropic()

    with anthropic_client.beta.messages.stream(
        **data,
        betas=betas,
    ) as stream:
        # Stream: https://github.com/anthropics/anthropic-sdk-python/blob/d212ec9f6d5e956f13bc0ddc3d86b5888a954383/src/anthropic/lib/streaming/_beta_messages.py#L22
        message_id = None
        model = None

        for chunk in stream._raw_stream:
            time.sleep(0.01)  # Anthropic is really fast, faster than frontend can upload.
            if isinstance(chunk, BetaRawMessageStartEvent):
                """
                BetaRawMessageStartEvent(
                    message=BetaMessage(
                        id='MESSAGE ID HERE',
                        content=[],
                        model='claude-3-5-sonnet-20241022',
                        role='assistant',
                        stop_reason=None,
                        stop_sequence=None,
                        type='message',
                        usage=BetaUsage(
                            cache_creation_input_tokens=0,
                            cache_read_input_tokens=0,
                            input_tokens=30,
                            output_tokens=4
                        )
                    ),
                    type='message_start'
                ),
                """
                message_id = chunk.message.id
                model = chunk.message.model
            yield convert_anthropic_stream_event_to_chatcompletion(chunk, message_id, model, inner_thoughts_xml_tag)
