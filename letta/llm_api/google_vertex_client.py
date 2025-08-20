import json
import uuid
from typing import List, Optional

from google import genai
from google.genai.types import (
    FunctionCallingConfig,
    FunctionCallingConfigMode,
    GenerateContentResponse,
    HttpOptions,
    ThinkingConfig,
    ToolConfig,
)

from letta.constants import NON_USER_MSG_PREFIX
from letta.helpers.datetime_helpers import get_utc_time_int
from letta.helpers.json_helpers import json_dumps, json_loads
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.json_parser import clean_json_string_extra_backslash
from letta.local_llm.utils import count_tokens
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_request import Tool
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice, FunctionCall, Message, ToolCall, UsageStatistics
from letta.settings import model_settings, settings
from letta.utils import get_tool_call_id

logger = get_logger(__name__)


class GoogleVertexClient(LLMClientBase):

    def _get_client(self):
        timeout_ms = int(settings.llm_request_timeout_seconds * 1000)
        return genai.Client(
            vertexai=True,
            project=model_settings.google_cloud_project,
            location=model_settings.google_cloud_location,
            http_options=HttpOptions(api_version="v1", timeout=timeout_ms),
        )

    @trace_method
    def request(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        client = self._get_client()
        response = client.models.generate_content(
            model=llm_config.model,
            contents=request_data["contents"],
            config=request_data["config"],
        )
        return response.model_dump()

    @trace_method
    async def request_async(self, request_data: dict, llm_config: LLMConfig) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        client = self._get_client()
        response = await client.aio.models.generate_content(
            model=llm_config.model,
            contents=request_data["contents"],
            config=request_data["config"],
        )
        return response.model_dump()

    @staticmethod
    def add_dummy_model_messages(messages: List[dict]) -> List[dict]:
        """Google AI API requires all function call returns are immediately followed by a 'model' role message.

        In Letta, the 'model' will often call a function (e.g. send_message) that itself yields to the user,
        so there is no natural follow-up 'model' role message.

        To satisfy the Google AI API restrictions, we can add a dummy 'yield' message
        with role == 'model' that is placed in-betweeen and function output
        (role == 'tool') and user message (role == 'user').
        """
        dummy_yield_message = {
            "role": "model",
            "parts": [{"text": f"{NON_USER_MSG_PREFIX}Function call returned, waiting for user response."}],
        }
        messages_with_padding = []
        for i, message in enumerate(messages):
            messages_with_padding.append(message)
            # Check if the current message role is 'tool' and the next message role is 'user'
            if message["role"] in ["tool", "function"] and (i + 1 < len(messages) and messages[i + 1]["role"] == "user"):
                messages_with_padding.append(dummy_yield_message)

        return messages_with_padding

    def _clean_google_ai_schema_properties(self, schema_part: dict):
        """Recursively clean schema parts to remove unsupported Google AI keywords."""
        if not isinstance(schema_part, dict):
            return

        # Per https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#notes_and_limitations
        # * Only a subset of the OpenAPI schema is supported.
        # * Supported parameter types in Python are limited.
        unsupported_keys = ["default", "exclusiveMaximum", "exclusiveMinimum", "additionalProperties", "$schema"]
        keys_to_remove_at_this_level = [key for key in unsupported_keys if key in schema_part]
        for key_to_remove in keys_to_remove_at_this_level:
            logger.debug(f"Removing unsupported keyword 	'{key_to_remove}' from schema part.")
            del schema_part[key_to_remove]

        if schema_part.get("type") == "string" and "format" in schema_part:
            allowed_formats = ["enum", "date-time"]
            if schema_part["format"] not in allowed_formats:
                logger.warning(f"Removing unsupported format 	'{schema_part['format']}' for string type. Allowed: {allowed_formats}")
                del schema_part["format"]

        # Check properties within the current level
        if "properties" in schema_part and isinstance(schema_part["properties"], dict):
            for prop_name, prop_schema in schema_part["properties"].items():
                self._clean_google_ai_schema_properties(prop_schema)

        # Check items within arrays
        if "items" in schema_part and isinstance(schema_part["items"], dict):
            self._clean_google_ai_schema_properties(schema_part["items"])

        # Check within anyOf, allOf, oneOf lists
        for key in ["anyOf", "allOf", "oneOf"]:
            if key in schema_part and isinstance(schema_part[key], list):
                for item_schema in schema_part[key]:
                    self._clean_google_ai_schema_properties(item_schema)

    def convert_tools_to_google_ai_format(self, tools: List[Tool], llm_config: LLMConfig) -> List[dict]:
        """
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

        Google AI style:
        "tools": [{
            "functionDeclarations": [{
            "name": "find_movies",
            "description": "find movie titles currently playing in theaters based on any description, genre, title words, etc.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                "location": {
                    "type": "STRING",
                    "description": "The city and state, e.g. San Francisco, CA or a zip code e.g. 95616"
                },
                "description": {
                    "type": "STRING",
                    "description": "Any kind of description including category or genre, title words, attributes, etc."
                }
                },
                "required": ["description"]
            }
            }, {
            "name": "find_theaters",
            ...
        """
        function_list = [
            dict(
                name=t.function.name,
                description=t.function.description,
                parameters=t.function.parameters,  # TODO need to unpack
            )
            for t in tools
        ]

        # Add inner thoughts if needed
        for func in function_list:
            # Note: Google AI API used to have weird casing requirements, but not any more

            # Google AI API only supports a subset of OpenAPI 3.0, so unsupported params must be cleaned
            if "parameters" in func and isinstance(func["parameters"], dict):
                self._clean_google_ai_schema_properties(func["parameters"])

            # Add inner thoughts
            if llm_config.put_inner_thoughts_in_kwargs:
                from letta.local_llm.constants import INNER_THOUGHTS_KWARG_DESCRIPTION, INNER_THOUGHTS_KWARG_VERTEX

                func["parameters"]["properties"][INNER_THOUGHTS_KWARG_VERTEX] = {
                    "type": "string",
                    "description": INNER_THOUGHTS_KWARG_DESCRIPTION,
                }
                func["parameters"]["required"].append(INNER_THOUGHTS_KWARG_VERTEX)

        return [{"functionDeclarations": function_list}]

    @trace_method
    def build_request_data(
        self,
        messages: List[PydanticMessage],
        llm_config: LLMConfig,
        tools: List[dict],
        force_tool_call: Optional[str] = None,
    ) -> dict:
        """
        Constructs a request object in the expected data format for this client.
        """

        if tools:
            tool_objs = [Tool(type="function", function=t) for t in tools]
            tool_names = [t.function.name for t in tool_objs]
            # Convert to the exact payload style Google expects
            formatted_tools = self.convert_tools_to_google_ai_format(tool_objs, llm_config)
        else:
            formatted_tools = []
            tool_names = []

        contents = self.add_dummy_model_messages(
            [m.to_google_ai_dict() for m in messages],
        )

        request_data = {
            "contents": contents,
            "config": {
                "temperature": llm_config.temperature,
                "max_output_tokens": llm_config.max_tokens,
                "tools": formatted_tools,
            },
        }

        if len(tool_names) == 1 and settings.use_vertex_structured_outputs_experimental:
            request_data["config"]["response_mime_type"] = "application/json"
            request_data["config"]["response_schema"] = self.get_function_call_response_schema(tools[0])
            del request_data["config"]["tools"]
        elif tools:
            tool_config = ToolConfig(
                function_calling_config=FunctionCallingConfig(
                    # ANY mode forces the model to predict only function calls
                    mode=FunctionCallingConfigMode.ANY,
                    # Provide the list of tools (though empty should also work, it seems not to)
                    allowed_function_names=tool_names,
                )
            )
            request_data["config"]["tool_config"] = tool_config.model_dump()

        # Add thinking_config for flash
        # If enable_reasoner is False, set thinking_budget to 0
        # Otherwise, use the value from max_reasoning_tokens
        if "flash" in llm_config.model:
            # Gemini flash models may fail to call tools even with FunctionCallingConfigMode.ANY if thinking is fully disabled, set to minimum to prevent tool call failure
            thinking_budget = llm_config.max_reasoning_tokens if llm_config.enable_reasoner else self.get_thinking_budget(llm_config.model)
            if thinking_budget <= 0:
                logger.error(
                    f"Thinking budget of {thinking_budget} for Gemini reasoning model {llm_config.model}, this will likely cause tool call failures"
                )
            thinking_config = ThinkingConfig(
                thinking_budget=(thinking_budget),
            )
            request_data["config"]["thinking_config"] = thinking_config.model_dump()

        return request_data

    @trace_method
    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
        llm_config: LLMConfig,
    ) -> ChatCompletionResponse:
        """
        Converts custom response format from llm client into an OpenAI
        ChatCompletionsResponse object.

        Example:
        {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": " OK. Barbie is showing in two theaters in Mountain View, CA: AMC Mountain View 16 and Regal Edwards 14."
                        }
                    ]
                }
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 9,
            "candidatesTokenCount": 27,
            "totalTokenCount": 36
        }
        }
        """

        response = GenerateContentResponse(**response_data)
        try:
            choices = []
            index = 0
            for candidate in response.candidates:
                content = candidate.content

                if content is None or content.role is None or content.parts is None:
                    # This means the response is malformed like MALFORMED_FUNCTION_CALL
                    # NOTE: must be a ValueError to trigger a retry
                    if candidate.finish_reason == "MALFORMED_FUNCTION_CALL":
                        raise ValueError(f"Error in response data from LLM: {candidate.finish_reason}...")
                    else:
                        raise ValueError(f"Error in response data from LLM: {candidate.model_dump()}")

                role = content.role
                assert role == "model", f"Unknown role in response: {role}"

                parts = content.parts

                # NOTE: we aren't properly supported multi-parts here anyways (we're just appending choices),
                #       so let's disable it for now

                # NOTE(Apr 9, 2025): there's a very strange bug on 2.5 where the response has a part with broken text
                # {'candidates': [{'content': {'parts': [{'functionCall': {'name': 'send_message', 'args': {'request_heartbeat': False, 'message': 'Hello! How can I make your day better?', 'inner_thoughts': 'User has initiated contact. Sending a greeting.'}}}], 'role': 'model'}, 'finishReason': 'STOP', 'avgLogprobs': -0.25891534213362066}], 'usageMetadata': {'promptTokenCount': 2493, 'candidatesTokenCount': 29, 'totalTokenCount': 2522, 'promptTokensDetails': [{'modality': 'TEXT', 'tokenCount': 2493}], 'candidatesTokensDetails': [{'modality': 'TEXT', 'tokenCount': 29}]}, 'modelVersion': 'gemini-1.5-pro-002'}
                # To patch this, if we have multiple parts we can take the last one
                if len(parts) > 1:
                    logger.warning(f"Unexpected multiple parts in response from Google AI: {parts}")
                    parts = [parts[-1]]

                # TODO support parts / multimodal
                # TODO support parallel tool calling natively
                # TODO Alternative here is to throw away everything else except for the first part
                for response_message in parts:
                    # Convert the actual message style to OpenAI style
                    if response_message.function_call:
                        function_call = response_message.function_call
                        function_name = function_call.name
                        function_args = function_call.args
                        assert isinstance(function_args, dict), function_args

                        # NOTE: this also involves stripping the inner monologue out of the function
                        if llm_config.put_inner_thoughts_in_kwargs:
                            from letta.local_llm.constants import INNER_THOUGHTS_KWARG_VERTEX

                            assert (
                                INNER_THOUGHTS_KWARG_VERTEX in function_args
                            ), f"Couldn't find inner thoughts in function args:\n{function_call}"
                            inner_thoughts = function_args.pop(INNER_THOUGHTS_KWARG_VERTEX)
                            assert inner_thoughts is not None, f"Expected non-null inner thoughts function arg:\n{function_call}"
                        else:
                            inner_thoughts = None

                        # Google AI API doesn't generate tool call IDs
                        openai_response_message = Message(
                            role="assistant",  # NOTE: "model" -> "assistant"
                            content=inner_thoughts,
                            tool_calls=[
                                ToolCall(
                                    id=get_tool_call_id(),
                                    type="function",
                                    function=FunctionCall(
                                        name=function_name,
                                        arguments=clean_json_string_extra_backslash(json_dumps(function_args)),
                                    ),
                                )
                            ],
                        )

                    else:
                        try:
                            # Structured output tool call
                            function_call = json_loads(response_message.text)
                            function_name = function_call["name"]
                            function_args = function_call["args"]
                            assert isinstance(function_args, dict), function_args

                            # NOTE: this also involves stripping the inner monologue out of the function
                            if llm_config.put_inner_thoughts_in_kwargs:
                                from letta.local_llm.constants import INNER_THOUGHTS_KWARG_VERTEX

                                assert (
                                    INNER_THOUGHTS_KWARG_VERTEX in function_args
                                ), f"Couldn't find inner thoughts in function args:\n{function_call}"
                                inner_thoughts = function_args.pop(INNER_THOUGHTS_KWARG_VERTEX)
                                assert inner_thoughts is not None, f"Expected non-null inner thoughts function arg:\n{function_call}"
                            else:
                                inner_thoughts = None

                            # Google AI API doesn't generate tool call IDs
                            openai_response_message = Message(
                                role="assistant",  # NOTE: "model" -> "assistant"
                                content=inner_thoughts,
                                tool_calls=[
                                    ToolCall(
                                        id=get_tool_call_id(),
                                        type="function",
                                        function=FunctionCall(
                                            name=function_name,
                                            arguments=clean_json_string_extra_backslash(json_dumps(function_args)),
                                        ),
                                    )
                                ],
                            )

                        except json.decoder.JSONDecodeError:
                            if candidate.finish_reason == "MAX_TOKENS":
                                raise ValueError(f"Could not parse response data from LLM: exceeded max token limit")
                            # Inner thoughts are the content by default
                            inner_thoughts = response_message.text

                            # Google AI API doesn't generate tool call IDs
                            openai_response_message = Message(
                                role="assistant",  # NOTE: "model" -> "assistant"
                                content=inner_thoughts,
                            )

                    # Google AI API uses different finish reason strings than OpenAI
                    # OpenAI: 'stop', 'length', 'function_call', 'content_filter', null
                    #   see: https://platform.openai.com/docs/guides/text-generation/chat-completions-api
                    # Google AI API: FINISH_REASON_UNSPECIFIED, STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER
                    #   see: https://ai.google.dev/api/python/google/ai/generativelanguage/Candidate/FinishReason
                    finish_reason = candidate.finish_reason.value
                    if finish_reason == "STOP":
                        openai_finish_reason = (
                            "function_call"
                            if openai_response_message.tool_calls is not None and len(openai_response_message.tool_calls) > 0
                            else "stop"
                        )
                    elif finish_reason == "MAX_TOKENS":
                        openai_finish_reason = "length"
                    elif finish_reason == "SAFETY":
                        openai_finish_reason = "content_filter"
                    elif finish_reason == "RECITATION":
                        openai_finish_reason = "content_filter"
                    else:
                        raise ValueError(f"Unrecognized finish reason in Google AI response: {finish_reason}")

                    choices.append(
                        Choice(
                            finish_reason=openai_finish_reason,
                            index=index,
                            message=openai_response_message,
                        )
                    )
                    index += 1

            # if len(choices) > 1:
            #     raise UserWarning(f"Unexpected number of candidates in response (expected 1, got {len(choices)})")

            # NOTE: some of the Google AI APIs show UsageMetadata in the response, but it seems to not exist?
            #  "usageMetadata": {
            #     "promptTokenCount": 9,
            #     "candidatesTokenCount": 27,
            #     "totalTokenCount": 36
            #   }
            if response.usage_metadata:
                usage = UsageStatistics(
                    prompt_tokens=response.usage_metadata.prompt_token_count,
                    completion_tokens=response.usage_metadata.candidates_token_count,
                    total_tokens=response.usage_metadata.total_token_count,
                )
            else:
                # Count it ourselves
                assert input_messages is not None, f"Didn't get UsageMetadata from the API response, so input_messages is required"
                prompt_tokens = count_tokens(json_dumps(input_messages))  # NOTE: this is a very rough approximation
                completion_tokens = count_tokens(json_dumps(openai_response_message.model_dump()))  # NOTE: this is also approximate
                total_tokens = prompt_tokens + completion_tokens
                usage = UsageStatistics(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                )

            response_id = str(uuid.uuid4())
            return ChatCompletionResponse(
                id=response_id,
                choices=choices,
                model=llm_config.model,  # NOTE: Google API doesn't pass back model in the response
                created=get_utc_time_int(),
                usage=usage,
            )
        except KeyError as e:
            raise e

    def get_function_call_response_schema(self, tool: dict) -> dict:
        return {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "STRING", "enum": [tool["name"]]},
                "args": {
                    "type": "OBJECT",
                    "properties": tool["parameters"]["properties"],
                    "required": tool["parameters"]["required"],
                },
            },
            "propertyOrdering": ["name", "args"],
            "required": ["name", "args"],
        }

    # https://ai.google.dev/gemini-api/docs/thinking#set-budget
    # | Model           | Default setting                                                   | Range        | Disable thinking           | Turn on dynamic thinking|
    # |-----------------|-------------------------------------------------------------------|--------------|----------------------------|-------------------------|
    # | 2.5 Pro         | Dynamic thinking: Model decides when and how much to think        | 128-32768    | N/A: Cannot disable        | thinkingBudget = -1     |
    # | 2.5 Flash       | Dynamic thinking: Model decides when and how much to think        | 0-24576      | thinkingBudget = 0         | thinkingBudget = -1     |
    # | 2.5 Flash Lite  | Model does not think                                              | 512-24576    | thinkingBudget = 0         | thinkingBudget = -1     |
    def get_thinking_budget(self, model: str) -> bool:
        if model_settings.gemini_force_minimum_thinking_budget:
            if all(substring in model for substring in ["2.5", "flash", "lite"]):
                return 512
            elif all(substring in model for substring in ["2.5", "flash"]):
                return 1
        return 0

    def is_reasoning_model(self, llm_config: LLMConfig) -> bool:
        return llm_config.model.startswith("gemini-2.5-flash") or llm_config.model.startswith("gemini-2.5-pro")

    @trace_method
    def handle_llm_error(self, e: Exception) -> Exception:
        # Fallback to base implementation
        return super().handle_llm_error(e)
