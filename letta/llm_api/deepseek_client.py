import json
import os
import re
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

logger = get_logger(__name__)
from letta.schemas.openai.chat_completion_request import (
    AssistantMessage,
    ChatCompletionRequest,
    ChatMessage,
    FunctionCall as ToolFunctionChoiceFunctionCall,
    Tool,
    ToolFunctionChoice,
    ToolMessage,
    UserMessage,
    cast_message_to_subtype,
)
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.schemas.openai.openai import Function, ToolCall
from letta.settings import model_settings
from letta.utils import get_tool_call_id


def merge_tool_message(previous_message: ChatMessage, tool_message: ToolMessage) -> ChatMessage:
    """
    Merge `ToolMessage` objects into the previous message.
    """
    previous_message.content += (
        f"<ToolMessage> content: {tool_message.content}, role: {tool_message.role}, tool_call_id: {tool_message.tool_call_id}</ToolMessage>"
    )
    return previous_message


def handle_assistant_message(assistant_message: AssistantMessage) -> AssistantMessage:
    """
    For `AssistantMessage` objects, remove the `tool_calls` field and add them to the `content` field.
    """

    if "tool_calls" in assistant_message.dict().keys():
        assistant_message.content = "".join(
            [
                # f"<ToolCall> name: {tool_call.function.name}, function: {tool_call.function}</ToolCall>"
                f"<ToolCall> {json.dumps(tool_call.function.dict())} </ToolCall>"
                for tool_call in assistant_message.tool_calls
            ]
        )
        del assistant_message.tool_calls
    return assistant_message


def map_messages_to_deepseek_format(messages: List[ChatMessage]) -> List["_Message"]:
    """
    Deepeek API has the following constraints: messages must be interleaved between user and assistant messages, ending on a user message.
    Tools are currently unstable for V3 and not supported for R1 in the API: https://api-docs.deepseek.com/guides/function_calling.

    This function merges ToolMessages into AssistantMessages and removes ToolCalls from AssistantMessages, and adds a dummy user message
    at the end.

    """
    deepseek_messages = []
    for idx, message in enumerate(messages):
        # First message is the system prompt, add it
        if idx == 0 and message.role == "system":
            deepseek_messages.append(message)
            continue
        if message.role == "user":
            if deepseek_messages[-1].role == "assistant" or deepseek_messages[-1].role == "system":
                # User message, add it
                deepseek_messages.append(UserMessage(content=message.content))
            else:
                # add to the content of the previous message
                deepseek_messages[-1].content += message.content
        elif message.role == "assistant":
            if deepseek_messages[-1].role == "user":
                # Assistant message, remove tool calls and add them to the content
                deepseek_messages.append(handle_assistant_message(message))
            else:
                # add to the content of the previous message
                deepseek_messages[-1].content += message.content
        elif message.role == "tool" and deepseek_messages[-1].role == "assistant":
            # Tool message, add it to the last assistant message
            merged_message = merge_tool_message(deepseek_messages[-1], message)
            deepseek_messages[-1] = merged_message
        else:
            logger.warning(f"Skipping message: {message}")

    # This needs to end on a user message, add a dummy message if the last was assistant
    if deepseek_messages[-1].role == "assistant":
        deepseek_messages.append(UserMessage(content=""))
    return deepseek_messages


def build_deepseek_chat_completions_request(
    llm_config: LLMConfig,
    messages: List["_Message"],
    user_id: Optional[str],
    functions: Optional[list],
    function_call: Optional[str],
    use_tool_naming: bool,
    max_tokens: Optional[int],
) -> ChatCompletionRequest:
    # if functions and llm_config.put_inner_thoughts_in_kwargs:
    #     # Special case for LM Studio backend since it needs extra guidance to force out the thoughts first
    #     # TODO(fix)
    #     inner_thoughts_desc = (
    #         INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST if ":1234" in llm_config.model_endpoint else INNER_THOUGHTS_KWARG_DESCRIPTION
    #     )
    #     functions = add_inner_thoughts_to_functions(
    #         functions=functions,
    #         inner_thoughts_key=INNER_THOUGHTS_KWARG,
    #         inner_thoughts_description=inner_thoughts_desc,
    #     )

    openai_message_list = [
        cast_message_to_subtype(m) for m in PydanticMessage.to_openai_dicts_from_list(messages, put_inner_thoughts_in_kwargs=False)
    ]

    if llm_config.model:
        model = llm_config.model
    else:
        logger.warning(f"Model type not set in llm_config: {llm_config.model_dump_json(indent=4)}")
        model = None
    if use_tool_naming:
        if function_call is None:
            tool_choice = None
        elif function_call not in ["none", "auto", "required"]:
            tool_choice = ToolFunctionChoice(type="function", function=ToolFunctionChoiceFunctionCall(name=function_call))
        else:
            tool_choice = function_call

        def add_functions_to_system_message(system_message: ChatMessage):
            system_message.content += f"<available functions> {''.join(json.dumps(f) for f in functions)} </available functions>"
            system_message.content += 'Select best function to call simply respond with a single json block with the fields "name" and "arguments". Use double quotes around the arguments.'

        if llm_config.model == "deepseek-reasoner":  # R1 currently doesn't support function calling natively
            add_functions_to_system_message(
                openai_message_list[0]
            )  # Inject additional instructions to the system prompt with the available functions

            openai_message_list = map_messages_to_deepseek_format(openai_message_list)

            data = ChatCompletionRequest(
                model=model,
                messages=openai_message_list,
                user=str(user_id),
                max_completion_tokens=max_tokens,
                temperature=llm_config.temperature,
            )
        else:
            data = ChatCompletionRequest(
                model=model,
                messages=openai_message_list,
                tools=[Tool(type="function", function=f) for f in functions] if functions else None,
                tool_choice=tool_choice,
                user=str(user_id),
                max_completion_tokens=max_tokens,
                temperature=llm_config.temperature,
            )
    else:
        data = ChatCompletionRequest(
            model=model,
            messages=openai_message_list,
            functions=functions,
            function_call=function_call,
            user=str(user_id),
            max_completion_tokens=max_tokens,
            temperature=llm_config.temperature,
        )

    return data


def convert_deepseek_response_to_chatcompletion(
    response: ChatCompletionResponse,
) -> ChatCompletionResponse:
    """
        Example response from DeepSeek (NOTE: as of 8/28/25, deepseek api does populate tool call in response):

        ChatCompletion(
        id='bc7f7d25-82e4-443a-b217-dfad2b66da8e',
        choices=[
            Choice(
                finish_reason='stop',
                index=0,
                logprobs=None,
                message=ChatCompletionMessage(
                    content='{"function": "send_message", "arguments": {"message": "Hey! Whales are such majestic creatures, aren\'t they? How\'s your day going? 🌊 "}}',
                    refusal=None,
                    role='assistant',
                    audio=None,
                    function_call=None,
                    tool_calls=None,
                    reasoning_content='Okay, the user said "hello whales". Hmm, that\'s an interesting greeting. Maybe they meant "hello there" or are they actually talking about whales? Let me check if I misheard. Whales are fascinating creatures. I should respond in a friendly way. Let me ask them how they\'re doing and mention whales to keep the conversation going.'
                )
            )
        ],
        created=1738266449,
        model='deepseek-reasoner',
        object='chat.completion',
        service_tier=None,
        system_fingerprint='fp_7e73fd9a08',
        usage=CompletionUsage(
            completion_tokens=111,
            prompt_tokens=1270,
            total_tokens=1381,
            completion_tokens_details=CompletionTokensDetails(
                accepted_prediction_tokens=None,
                audio_tokens=None,
                reasoning_tokens=72,
                rejected_prediction_tokens=None
            ),
            prompt_tokens_details=PromptTokensDetails(
                audio_tokens=None,
                cached_tokens=1088
            ),
            prompt_cache_hit_tokens=1088,
            prompt_cache_miss_tokens=182
        )
    )
    """

    def convert_dict_quotes(input_dict: dict):
        """
        Convert a dictionary with single-quoted keys to double-quoted keys,
        properly handling boolean values and nested structures.

        Args:
            input_dict (dict): Input dictionary with single-quoted keys

        Returns:
            str: JSON string with double-quoted keys
        """
        # First convert the dictionary to a JSON string to handle booleans properly
        json_str = json.dumps(input_dict)

        # Function to handle complex string replacements
        def replace_quotes(match):
            key = match.group(1)
            # Escape any existing double quotes in the key
            key = key.replace('"', '\\"')
            return f'"{key}":'

        # Replace single-quoted keys with double-quoted keys
        # This regex looks for single-quoted keys followed by a colon
        def strip_json_block(text):
            # Check if text starts with ```json or similar
            if text.strip().startswith("```"):
                # Split by \n to remove the first and last lines
                lines = text.split("\n")[1:-1]
                return "\n".join(lines)
            return text

        pattern = r"'([^']*)':"
        converted_str = re.sub(pattern, replace_quotes, strip_json_block(json_str))

        # Parse the string back to ensure valid JSON format
        try:
            json.loads(converted_str)
            return converted_str
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to create valid JSON with double quotes: {str(e)}")

    def extract_json_block(text):
        # Find the first {
        start = text.find("{")
        if start == -1:
            return text

        # Track nested braces to find the matching closing brace
        brace_count = 0
        end = start

        for i in range(start, len(text)):
            if text[i] == "{":
                brace_count += 1
            elif text[i] == "}":
                brace_count -= 1
                if brace_count == 0:
                    end = i + 1
                    break

        return text[start:end]

    content = response.choices[0].message.content
    try:
        content_dict = json.loads(extract_json_block(content))

        if type(content_dict["arguments"]) == str:
            content_dict["arguments"] = json.loads(content_dict["arguments"])

        tool_calls = [
            ToolCall(
                id=get_tool_call_id(),
                type="function",
                function=Function(
                    name=content_dict["name"],
                    arguments=convert_dict_quotes(content_dict["arguments"]),
                ),
            )
        ]
    except (json.JSONDecodeError, TypeError, KeyError) as e:
        logger.error(f"Failed to parse DeepSeek response: {e}")
        tool_calls = response.choices[0].message.tool_calls
        raise ValueError(f"Failed to create valid JSON {content}")

    # Move the "reasoning_content" into the "content" field
    response.choices[0].message.content = response.choices[0].message.reasoning_content
    response.choices[0].message.tool_calls = tool_calls

    # Remove the "reasoning_content" field
    response.choices[0].message.reasoning_content = None

    return response


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
        # Override put_inner_thoughts_in_kwargs to False for DeepSeek
        llm_config.put_inner_thoughts_in_kwargs = False

        data = super().build_request_data(agent_type, messages, llm_config, tools, force_tool_call, requires_subsequent_tool_call)

        def add_functions_to_system_message(system_message: ChatMessage):
            system_message.content += f"<available functions> {''.join(json.dumps(f) for f in tools)} </available functions>"
            system_message.content += 'Select best function to call simply respond with a single json block with the fields "name" and "arguments". Use double quotes around the arguments.'

        openai_message_list = [
            cast_message_to_subtype(m) for m in PydanticMessage.to_openai_dicts_from_list(messages, put_inner_thoughts_in_kwargs=False)
        ]

        if llm_config.model == "deepseek-reasoner":  # R1 currently doesn't support function calling natively
            add_functions_to_system_message(
                openai_message_list[0]
            )  # Inject additional instructions to the system prompt with the available functions

            openai_message_list = map_messages_to_deepseek_format(openai_message_list)

        data["messages"] = [m.dict() for m in openai_message_list]

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
        if response.choices[0].message.tool_calls:
            return super().convert_response_to_chat_completion(response_data, input_messages, llm_config)
        return convert_deepseek_response_to_chatcompletion(response)
