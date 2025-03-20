import uuid
from typing import List, Optional, Tuple

from letta.constants import NON_USER_MSG_PREFIX
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.json_helpers import json_dumps
from letta.llm_api.helpers import make_post_request
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.json_parser import clean_json_string_extra_backslash
from letta.local_llm.utils import count_tokens
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_request import Tool
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice, FunctionCall, Message, ToolCall, UsageStatistics
from letta.settings import model_settings
from letta.utils import get_tool_call_id


class GoogleAIClient(LLMClientBase):

    def request(self, request_data: dict) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        url, headers = self.get_gemini_endpoint_and_headers(generate_content=True)
        return make_post_request(url, headers, request_data)

    def build_request_data(
        self,
        messages: List[PydanticMessage],
        tools: List[dict],
        tool_call: Optional[str],
    ) -> dict:
        """
        Constructs a request object in the expected data format for this client.
        """
        if tools:
            tools = [{"type": "function", "function": f} for f in tools]
            tools = self.convert_tools_to_google_ai_format(
                [Tool(**t) for t in tools],
            )
        contents = self.add_dummy_model_messages(
            [m.to_google_ai_dict() for m in messages],
        )

        return {
            "contents": contents,
            "tools": tools,
            "generation_config": {
                "temperature": self.llm_config.temperature,
                "max_output_tokens": self.llm_config.max_tokens,
            },
        }

    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
    ) -> ChatCompletionResponse:
        """
        Converts custom response format from llm client into an OpenAI
        ChatCompletionsResponse object.

        Example Input:
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
        try:
            choices = []
            index = 0
            for candidate in response_data["candidates"]:
                content = candidate["content"]

                role = content["role"]
                assert role == "model", f"Unknown role in response: {role}"

                parts = content["parts"]
                # TODO support parts / multimodal
                # TODO support parallel tool calling natively
                # TODO Alternative here is to throw away everything else except for the first part
                for response_message in parts:
                    # Convert the actual message style to OpenAI style
                    if "functionCall" in response_message and response_message["functionCall"] is not None:
                        function_call = response_message["functionCall"]
                        assert isinstance(function_call, dict), function_call
                        function_name = function_call["name"]
                        assert isinstance(function_name, str), function_name
                        function_args = function_call["args"]
                        assert isinstance(function_args, dict), function_args

                        # NOTE: this also involves stripping the inner monologue out of the function
                        if self.llm_config.put_inner_thoughts_in_kwargs:
                            from letta.local_llm.constants import INNER_THOUGHTS_KWARG

                            assert INNER_THOUGHTS_KWARG in function_args, f"Couldn't find inner thoughts in function args:\n{function_call}"
                            inner_thoughts = function_args.pop(INNER_THOUGHTS_KWARG)
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

                        # Inner thoughts are the content by default
                        inner_thoughts = response_message["text"]

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
                    finish_reason = candidate["finishReason"]
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
            if "usageMetadata" in response_data:
                usage = UsageStatistics(
                    prompt_tokens=response_data["usageMetadata"]["promptTokenCount"],
                    completion_tokens=response_data["usageMetadata"]["candidatesTokenCount"],
                    total_tokens=response_data["usageMetadata"]["totalTokenCount"],
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
                model=self.llm_config.model,  # NOTE: Google API doesn't pass back model in the response
                created=get_utc_time(),
                usage=usage,
            )
        except KeyError as e:
            raise e

    def get_gemini_endpoint_and_headers(
        self,
        key_in_header: bool = True,
        generate_content: bool = False,
    ) -> Tuple[str, dict]:
        """
        Dynamically generate the model endpoint and headers.
        """

        url = f"{self.llm_config.model_endpoint}/v1beta/models"

        # Add the model
        url += f"/{self.llm_config.model}"

        # Add extension for generating content if we're hitting the LM
        if generate_content:
            url += ":generateContent"

        # Decide if api key should be in header or not
        # Two ways to pass the key: https://ai.google.dev/tutorials/setup
        if key_in_header:
            headers = {"Content-Type": "application/json", "x-goog-api-key": model_settings.gemini_api_key}
        else:
            url += f"?key={model_settings.gemini_api_key}"
            headers = {"Content-Type": "application/json"}

        return url, headers

    def convert_tools_to_google_ai_format(self, tools: List[Tool]) -> List[dict]:
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

        # Correct casing + add inner thoughts if needed
        for func in function_list:
            func["parameters"]["type"] = "OBJECT"
            for param_name, param_fields in func["parameters"]["properties"].items():
                param_fields["type"] = param_fields["type"].upper()
            # Add inner thoughts
            if self.llm_config.put_inner_thoughts_in_kwargs:
                from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION

                func["parameters"]["properties"][INNER_THOUGHTS_KWARG] = {
                    "type": "STRING",
                    "description": INNER_THOUGHTS_KWARG_DESCRIPTION,
                }
                func["parameters"]["required"].append(INNER_THOUGHTS_KWARG)

        return [{"functionDeclarations": function_list}]

    def add_dummy_model_messages(self, messages: List[dict]) -> List[dict]:
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
