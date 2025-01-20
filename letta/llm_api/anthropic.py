import json
import re
from typing import List, Optional, Tuple, Union

import anthropic
from anthropic import PermissionDeniedError

from letta.errors import BedrockError, BedrockPermissionError
from letta.llm_api.aws_bedrock import get_bedrock_client
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, Tool
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice, FunctionCall
from letta.schemas.openai.chat_completion_response import (
    Message as ChoiceMessage,  # NOTE: avoid conflict with our own Letta Message datatype
)
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.services.provider_manager import ProviderManager
from letta.settings import model_settings
from letta.utils import get_utc_time, smart_urljoin

BASE_URL = "https://api.anthropic.com/v1"


# https://docs.anthropic.com/claude/docs/models-overview
# Sadly hardcoded
MODEL_LIST = [
    {
        "name": "claude-3-opus-20240229",
        "context_window": 200000,
    },
    {
        "name": "claude-3-5-sonnet-20241022",
        "context_window": 200000,
    },
    {
        "name": "claude-3-5-haiku-20241022",
        "context_window": 200000,
    },
]

DUMMY_FIRST_USER_MESSAGE = "User initializing bootup sequence."


def antropic_get_model_context_window(url: str, api_key: Union[str, None], model: str) -> int:
    for model_dict in anthropic_get_model_list(url=url, api_key=api_key):
        if model_dict["name"] == model:
            return model_dict["context_window"]
    raise ValueError(f"Can't find model '{model}' in Anthropic model list")


def anthropic_get_model_list(url: str, api_key: Union[str, None]) -> dict:
    """https://docs.anthropic.com/claude/docs/models-overview"""

    # NOTE: currently there is no GET /models, so we need to hardcode
    return MODEL_LIST


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
    tool_calls = None

    if len(response.content) > 1:
        # inner mono + function call
        assert len(response.content) == 2
        text_block = response.content[0]
        tool_block = response.content[1]
        assert text_block.type == "text"
        assert tool_block.type == "tool_use"
        content = strip_xml_tags(string=text_block.text, tag=inner_thoughts_xml_tag)
        tool_calls = [
            ToolCall(
                id=tool_block.id,
                type="function",
                function=FunctionCall(
                    name=tool_block.name,
                    arguments=json.dumps(tool_block.input, indent=2),
                ),
            )
        ]
    elif len(response.content) == 1:
        block = response.content[0]
        if block.type == "tool_use":
            # function call only
            tool_calls = [
                ToolCall(
                    id=block.id,
                    type="function",
                    function=FunctionCall(
                        name=block.name,
                        arguments=json.dumps(block.input, indent=2),
                    ),
                )
            ]
        else:
            # inner mono only
            content = strip_xml_tags(string=block.text, tag=inner_thoughts_xml_tag)
    else:
        raise RuntimeError("Unexpected empty content in response")

    assert response.role == "assistant"
    choice = Choice(
        index=0,
        finish_reason=finish_reason,
        message=ChoiceMessage(
            role=response.role,
            content=content,
            tool_calls=tool_calls,
        ),
    )

    return ChatCompletionResponse(
        id=response.id,
        choices=[choice],
        created=get_utc_time(),
        model=response.model,
        usage=UsageStatistics(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


def _prepare_anthropic_request(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
) -> dict:
    """Prepare the request data for Anthropic API format."""
    # convert the tools
    anthropic_tools = None if data.tools is None else convert_tools_to_anthropic_format(data.tools)

    # pydantic -> dict
    data = data.model_dump(exclude_none=True)

    if "functions" in data:
        raise ValueError(f"'functions' unexpected in Anthropic API payload")

    # Handle tools
    if "tools" in data and data["tools"] is None:
        data.pop("tools")
        data.pop("tool_choice", None)
    elif anthropic_tools is not None:
        data["tools"] = anthropic_tools
        if len(anthropic_tools) == 1:
            data["tool_choice"] = {
                "type": "tool",
                "name": anthropic_tools[0]["name"],
                "disable_parallel_tool_use": True,
            }

    # Move 'system' to the top level
    assert data["messages"][0]["role"] == "system", f"Expected 'system' role in messages[0]:\n{data['messages'][0]}"
    data["system"] = data["messages"][0]["content"]
    data["messages"] = data["messages"][1:]

    # Process messages
    for message in data["messages"]:
        if "content" not in message:
            message["content"] = None

    # Convert to Anthropic format
    msg_objs = [Message.dict_to_message(user_id=None, agent_id=None, openai_message_dict=m) for m in data["messages"]]
    data["messages"] = [m.to_anthropic_dict(inner_thoughts_xml_tag=inner_thoughts_xml_tag) for m in msg_objs]

    # Ensure first message is user
    if data["messages"][0]["role"] != "user":
        data["messages"] = [{"role": "user", "content": DUMMY_FIRST_USER_MESSAGE}] + data["messages"]

    # Handle alternating messages
    data["messages"] = merge_tool_results_into_user_messages(data["messages"])

    # Validate max_tokens
    assert "max_tokens" in data, data

    # Remove OpenAI-specific fields
    for field in ["frequency_penalty", "logprobs", "n", "top_p", "presence_penalty", "user"]:
        data.pop(field, None)

    return data


def get_anthropic_endpoint_and_headers(
    base_url: str,
    api_key: str,
    version: str = "2023-06-01",
    beta: Optional[str] = "tools-2024-04-04",
) -> Tuple[str, dict]:
    """
    Dynamically generate the Anthropic endpoint and headers.
    """
    url = smart_urljoin(base_url, "messages")

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": version,
    }

    # Add beta header if specified
    if beta:
        headers["anthropic-beta"] = beta

    return url, headers


def anthropic_chat_completions_request(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
    betas: List[str] = ["tools-2024-04-04"],
) -> ChatCompletionResponse:
    """https://docs.anthropic.com/claude/docs/tool-use"""
    anthropic_client = None
    anthropic_override_key = ProviderManager().get_anthropic_override_key()
    if anthropic_override_key:
        anthropic_client = anthropic.Anthropic(api_key=anthropic_override_key)
    elif model_settings.anthropic_api_key:
        anthropic_client = anthropic.Anthropic()
    data = _prepare_anthropic_request(data, inner_thoughts_xml_tag)
    response = anthropic_client.beta.messages.create(
        **data,
        betas=betas,
    )
    return convert_anthropic_response_to_chatcompletion(response=response, inner_thoughts_xml_tag=inner_thoughts_xml_tag)


def anthropic_bedrock_chat_completions_request(
    data: ChatCompletionRequest,
    inner_thoughts_xml_tag: Optional[str] = "thinking",
) -> ChatCompletionResponse:
    """Make a chat completion request to Anthropic via AWS Bedrock."""
    data = _prepare_anthropic_request(data, inner_thoughts_xml_tag)

    # Get the client
    client = get_bedrock_client()

    # Make the request
    try:
        response = client.messages.create(**data)
        return convert_anthropic_response_to_chatcompletion(response=response, inner_thoughts_xml_tag=inner_thoughts_xml_tag)
    except PermissionDeniedError:
        raise BedrockPermissionError(f"User does not have access to the Bedrock model with the specified ID. {data['model']}")
    except Exception as e:
        raise BedrockError(f"Bedrock error: {e}")
