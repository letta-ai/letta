import os
from typing import List, Optional

import openai
from openai import AsyncOpenAI, AsyncStream, OpenAI
from openai.types.chat.chat_completion import ChatCompletion
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from letta.constants import LETTA_MODEL_ENDPOINT
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
from letta.helpers.datetime_helpers import get_utc_time_int

from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION, INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST
from letta.log import get_logger
from letta.otel.tracing import trace_method
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
from letta.schemas.openai.chat_completion_response import ( ChatCompletionResponse,
    Choice,
    FunctionCall,
    Message as ChoiceMessage,
    ToolCall,
    UsageStatistics
)
from letta.settings import model_settings
import json

logger = get_logger(__name__)

def is_openai_reasoning_model(model: str) -> bool:
    """Utility function to check if the model is a 'reasoner'"""

    # NOTE: needs to be updated with new model releases
    is_reasoning = model.startswith("o1") or model.startswith("o3") or model.startswith("o4") or model.startswith("gpt-5")
    return is_reasoning


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
    if "nebius.com" in llm_config.model_endpoint:
        return False
    else:
        return True


# TODO move into LLMConfig as a field?
def requires_auto_tool_choice(llm_config: LLMConfig) -> bool:
    """Certain providers require the tool choice to be set to 'auto'."""
    if "nebius.com" in llm_config.model_endpoint:
        return True
    if llm_config.handle and "vllm" in llm_config.handle:
        return True
    if llm_config.compatibility_type == "mlx":
        return True
    return False


class OpenAIClient(LLMClientBase):
    def _prepare_client_kwargs(self, llm_config: LLMConfig) -> dict:
        api_key, _, _ = self.get_byok_overrides(llm_config)

        if not api_key:
            api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
        # supposedly the openai python client requires a dummy API key
        api_key = api_key or "DUMMY_API_KEY"
        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

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
        # supposedly the openai python client requires a dummy API key
        api_key = api_key or "DUMMY_API_KEY"
        kwargs = {"api_key": api_key, "base_url": llm_config.model_endpoint}

        return kwargs

    def requires_auto_tool_choice(self, llm_config: LLMConfig) -> bool:
        return requires_auto_tool_choice(llm_config)

    def supports_structured_output(self, llm_config: LLMConfig) -> bool:
        return supports_structured_output(llm_config)

    @trace_method
    def build_request_data(
        self,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: Optional[List[dict]] = None,  # Keep as dict for now as per base class
        force_tool_call: Optional[str] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for the OpenAI API.
        """
        if tools and llm_config.put_inner_thoughts_in_kwargs:
            # Special case for LM Studio backend since it needs extra guidance to force out the thoughts first
            # TODO(fix)
            inner_thoughts_desc = (
                INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST if ":1234" in llm_config.model_endpoint else INNER_THOUGHTS_KWARG_DESCRIPTION
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
            )
        ]

        if llm_config.model:
            model = llm_config.model
        else:
            logger.warning(f"Model type not set in llm_config: {llm_config.model_dump_json(indent=4)}")
            model = None

        # force function calling for reliability, see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
        # TODO(matt) move into LLMConfig
        # TODO: This vllm checking is very brittle and is a patch at most
        tool_choice = None
        if self.requires_auto_tool_choice(llm_config):
            tool_choice = "auto"
        elif tools:
            # only set if tools is non-Null
            tool_choice = "required"

        if force_tool_call is not None:
            tool_choice = ToolFunctionChoice(type="function", function=ToolFunctionChoiceFunctionCall(name=force_tool_call))

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
        return request_data

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying synchronous request to OpenAI API and returns raw response dict.
        """
        client = OpenAI(**self._prepare_client_kwargs(llm_config))

        print("CHAT REQUEST DATA: ", json.dumps(request_data, indent=4))
        responses_request_data = convert_chat_to_response(request_data)
        print("RESPONSES REQUEST DATA: ", json.dumps(responses_request_data, indent=4))
        query_response =  client.responses.create(**responses_request_data)
        return query_response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying asynchronous request to OpenAI API and returns raw response dict.
        """
        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)

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
        # OpenAI's response structure directly maps to ChatCompletionResponse
        # We just need to instantiate the Pydantic model for validation and type safety.
        chat_completion_response = ChatCompletionResponse(**response_data)
        chat_completion_response = self._fix_truncated_json_response(chat_completion_response)
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
    async def stream_async(self, request_data: dict, llm_config: LLMConfig) -> AsyncStream[ChatCompletionChunk]:
        """
        Performs underlying asynchronous streaming request to OpenAI and returns the async stream iterator.
        """
        kwargs = await self._prepare_client_kwargs_async(llm_config)
        client = AsyncOpenAI(**kwargs)
        response_stream: AsyncStream[ChatCompletionChunk] = await client.chat.completions.create(
            **request_data, stream=True, stream_options={"include_usage": True}
        )
        return response_stream

    @trace_method
    async def request_embeddings(self, inputs: List[str], embedding_config: EmbeddingConfig) -> List[List[float]]:
        """Request embeddings given texts and embedding config"""
        kwargs = self._prepare_client_kwargs_embedding(embedding_config)
        client = AsyncOpenAI(**kwargs)
        response = await client.embeddings.create(model=embedding_config.embedding_model, input=inputs)

        # TODO: add total usage
        return [r.embedding for r in response.data]

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


# convert chat completions into responses format
# doesnt support tool outputs or images or a few other things yet
def convert_chat_to_response(chat: dict):
    """
    Converts a chat completion request to a response style request.
    only support text for now
    """

    # need to do a better job of passing through here hmm
    # goal is to only modify the data that needs to be modifies and then pass through all other params like temp or topP etc
    # 1 idea is copy with a responses object def then prune with pydantic or "union" 
    response_request_data = {
        "model": chat["model"],
        "input": "",
        "store": False,
        "parallel_tool_calls": False,
        "include": ["reasoning.encrypted_content"]
    }

    #need to remove system prompt from messages and pass as instructions?  
    #this is sus, dont really understand how instructions works
    system_message = list(filter(lambda msg: msg["role"] == "system", chat["messages"]))

    if len(system_message) > 0:
        response_request_data["instructions"] = system_message[0]["content"]

    if chat.get("max_completion_tokens"):
        response_request_data["max_output_tokens"] = chat["max_completion_tokens"]

    if chat.get("reasoning_effort"):
        response_request_data["reasoning"] = {"effort": chat["reasoning_effort"] } #summary is not supported yet

    if chat.get("tools"):
        # Convert tools format from nested to flattened
        converted_tools = []
        for tool in chat["tools"]:
            converted_tool = {
                "type": tool["type"],
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "parameters": tool["function"]["parameters"]
            }
            # Add optional fields if they exist
            '''
            In Chat Completions, functions are non-strict by default, whereas in the Responses API, functions are strict by default.
            '''
            if "strict" in tool["function"]:
                converted_tool["strict"] = tool["function"]["strict"]
            else:
                converted_tool["strict"] = False # this line can be removed based on if you want to do a 1:1 conversion or adhere to responses structure 
            converted_tools.append(converted_tool)
    
        response_request_data["tools"] = converted_tools

    if chat.get("tool_choice"): #should be the same
        response_request_data["tool_choice"] = chat["tool_choice"]

    if chat.get("verbosity"):
        response_request_data.setdefault("text", {})["verbosity"] = chat["verbosity"]
    #need to consider json schema vs generic json output
    if chat.get("response_format"):
        response_request_data["text"]["format"] = {
            "type": chat.get("response_format").get("type")
            **chat.get("response_format").get("json_schema")
        }

    if len(chat["messages"]) == 1:
        response_request_data["input"] = chat["messages"][0]["content"]
    else:
        response_request_data["input"] = []
        for message in chat["messages"]:
            response_request_data["input"].append({
                "role": message["role"],
                "content": [ 
                    {
                        "type": "input_text" if (message["role"] == "user" or message["role"] == "developer") else "output_text",
                        "text": message["content"]
                    }
                ]
            })    
    return response_request_data


#convert from responses response to chat completion response
def convert_response_to_chat_completion(
        response_data: dict,
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse: 


    assert len(response_data.get("output")) > 0
    print(json.dumps(response_data, indent=4))

    prompt_tokens = response_data["usage"]["input_tokens"]
    completion_tokens = response_data["usage"]["output_tokens"]

    content = None
    reasoning_content = None
    redacted_reasoning_content = None
    tool_calls = []


    for output_message in response_data.get("output"):
        if output_message.get("type") == "reasoning":
            if "encrypted_content" in output_message:
                redacted_reasoning_content = output_message["encrypted_content"]
            elif "content" in output_message:
                reasoning_content = output_message["content"]
        if output_message.get("type") == "function_call":
            tool_calls.append(
                ToolCall(
                    id=output_message.get("call_id"),
                    type="function",
                    function=FunctionCall(
                        name=output_message.get("name"),
                        arguments=output_message.get("arguments"),
                    ),
                )
            )
        if output_message.get("type") == "message":
            content = output_message.get("content")[0].get("text")
        
    
    choice = Choice(
            index=0,
            finish_reason="stop", #this is wrong and not really compatible with responses 
            message=ChoiceMessage(
                role="assistant",
                content=content,
                reasoning_content=reasoning_content,
                redacted_reasoning_content=redacted_reasoning_content,
                tool_calls=tool_calls,
            ),
        )

    chat_completion_response = ChatCompletionResponse(
            id=response_data["id"],
            choices=[choice],
            created=get_utc_time_int(),
            model=response_data["model"],
            usage=UsageStatistics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )
    # if llm_config.put_inner_thoughts_in_kwargs:
    #     chat_completion_response = unpack_all_inner_thoughts_from_kwargs(
    #         response=chat_completion_response, inner_thoughts_key=INNER_THOUGHTS_KWARG
    #     )
    
    return chat_completion_response



# Testing

if __name__ == "__main__":
    from letta.schemas.letta_message_content import TextContent
    import json
    
    # Initialize the OpenAI client
    client = OpenAIClient()
    
    def test_single_user_message(verbosity=None, reasoning_effort=None):
        """Test single user message with optional verbosity and reasoning effort"""
        print(f"\n=== Testing Single User Message (verbosity={verbosity}, reasoning_effort={reasoning_effort}) ===")
        
        # Create LLM config with optional parameters
        config_params = {
            "model": "gpt-5",
            "model_endpoint_type": "openai", 
            "model_endpoint": "https://api.openai.com/v1"
        }
        if verbosity:
            config_params["verbosity"] = verbosity
        if reasoning_effort:
            config_params["reasoning_effort"] = reasoning_effort
            
        llm_config = LLMConfig(**config_params)
        
        # Single user message
        messages = [
            PydanticMessage(role="system", content=[TextContent(text="Return ur answer in french always")]),
            PydanticMessage(role="user", content=[TextContent(text="What is the capital of France?")])
        ]
        
        try:
            request_data = client.build_request_data(messages, llm_config)
            response = client.request(request_data, llm_config)
            print("Request Data:", json.dumps(request_data, indent=2))
            # print("Response:", json.dumps(response, indent=2))
            print ("CONVERTING BACK: ", json.dumps(convert_response_to_chat_completion(response, llm_config).model_dump(),indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_conversation_history(verbosity=None):
        """Test text-only conversation history"""
        print(f"\n=== Testing Conversation History (verbosity={verbosity}) ===")
        
        config_params = {
            "model": "gpt-5",
            "model_endpoint_type": "openai",
            "model_endpoint": "https://api.openai.com/v1"
        }
        if verbosity:
            config_params["verbosity"] = verbosity
            
        llm_config = LLMConfig(**config_params)
        
        # Multi-turn conversation
        messages = [
            PydanticMessage(role="user", content=[TextContent(text="Hello, I need help with math")]),
            PydanticMessage(role="assistant", content=[TextContent(text="I'd be happy to help you with math! What specific topic are you working on?")]),
            PydanticMessage(role="user", content=[TextContent(text="I'm struggling with calculus derivatives")]),
            PydanticMessage(role="assistant", content=[TextContent(text="Derivatives can be tricky! Let's start with the basics. What's your current understanding of limits?")]),
            PydanticMessage(role="user", content=[TextContent(text="I understand limits but I'm confused about the chain rule")])
        ]
        
        try:
            request_data = client.build_request_data(messages, llm_config)
            response = client.request(request_data, llm_config)
            print("Request Data:", json.dumps(request_data, indent=2))
            print ("CONVERTING BACK: ", json.dumps(convert_response_to_chat_completion(response, llm_config).model_dump(),indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_with_tools(verbosity=None, reasoning_effort=None):
        """Test single user message with sample tools"""
        print(f"\n=== Testing with Tools (verbosity={verbosity}, reasoning_effort={reasoning_effort}) ===")
        
        config_params = {
            "model": "gpt-5",
            "model_endpoint_type": "openai",
            "model_endpoint": "https://api.openai.com/v1"
        }

        if verbosity:
            config_params["verbosity"] = verbosity
        if reasoning_effort:
            config_params["reasoning_effort"] = reasoning_effort
            
        llm_config = LLMConfig(**config_params)
        
        # Sample tools
        tools = [
            {
                "name": "get_weather",
                "description": "Get the current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA"
                        }
                    },
                    "required": ["location"]
                }
            },
            {
                "name": "calculate",
                "description": "Perform mathematical calculations",
                "parameters": {
                    "type": "object", 
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate"
                        }
                    },
                    "required": ["expression"]
                }
            }
        ]
        
        messages = [
            PydanticMessage(role="user", content=[TextContent(text="What's the weather like in New York and calculate 15 * 23 for me do it at once?")])
        ]
        
        try:
            request_data = client.build_request_data(messages, llm_config, tools=tools)
            response = client.request(request_data, llm_config)
            print("Request Data:", json.dumps(request_data, indent=2))
            print ("CONVERTING BACK: ", json.dumps(convert_response_to_chat_completion(response, llm_config).model_dump(),indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    def test_reasoning_effort_levels():
        """Test different reasoning effort levels"""
        print(f"\n=== Testing Reasoning Effort Levels ===")
        
        reasoning_levels = ["minimal", "low", "medium", "high"]
        
        for effort in reasoning_levels:
            print(f"\n--- Testing reasoning_effort={effort} ---")
            test_single_user_message(reasoning_effort=effort)
    
    def test_verbosity_levels():
        """Test different verbosity levels"""
        print(f"\n=== Testing Verbosity Levels ===")
        
        verbosity_levels = ["low", "medium", "high"]
        
        for verbosity in verbosity_levels:
            print(f"\n--- Testing verbosity={verbosity} ---")
            test_single_user_message(verbosity=verbosity)
    
    def test_parameter_combinations():
        """Test combinations of different parameters"""
        print(f"\n=== Testing Parameter Combinations ===")
        
        # Test verbosity + reasoning + tools
        print(f"\n--- Testing verbosity=high + reasoning_effort=medium + tools ---")
        test_with_tools(verbosity="high", reasoning_effort="medium")
        
        # Test conversation history + verbosity
        print(f"\n--- Testing conversation history + verbosity=low ---")
        test_conversation_history(verbosity="low")
    
    def test_gpt5_specific():
        """Test GPT-5 specific features"""
        print(f"\n=== Testing GPT-5 Specific Features ===")
        
        # Test GPT-5 with verbosity and reasoning
        config_params = {
            "model": "gpt-5",
            "model_endpoint_type": "openai",
            "model_endpoint": "https://api.openai.com/v1",
            "verbosity": "high",
            "reasoning_effort": "high"
        }
        
        llm_config = LLMConfig(**config_params)
        
        messages = [
            PydanticMessage(role="user", content=[TextContent(text="Explain quantum computing in simple terms")])
        ]
        
        try:
            request_data = client.build_request_data(messages, llm_config)
            response = client.request(request_data, llm_config)
            print("Request Data:", json.dumps(request_data, indent=2))
            print("Response:", json.dumps(response, indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    # Run all tests
    print("Starting OpenAI Responses API Tests...")
    
    # Basic tests
    # test_single_user_message()
    test_conversation_history()
    # test_with_tools()
    
    # # Parameter-specific tests
    # test_reasoning_effort_levels()
    # test_verbosity_levels()
    # test_parameter_combinations()
    
    # # Model-specific tests
    # test_gpt5_specific()
    
    print("\n=== All tests completed ===")