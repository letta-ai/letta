import uuid
from typing import List, Optional

from google import genai
from google.genai.types import FunctionCallingConfig, FunctionCallingConfigMode, GenerateContentResponse, ToolConfig

from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.json_helpers import json_dumps
from letta.llm_api.google_ai_client import GoogleAIClient
from letta.local_llm.json_parser import clean_json_string_extra_backslash
from letta.local_llm.utils import count_tokens
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, Choice, FunctionCall, Message, ToolCall, UsageStatistics
from letta.settings import model_settings
from letta.utils import get_tool_call_id


class GoogleVertexClient(GoogleAIClient):

    def request(self, request_data: dict) -> dict:
        """
        Performs underlying request to llm and returns raw response.
        """
        client = genai.Client(
            vertexai=True,
            project=model_settings.google_cloud_project,
            location=model_settings.google_cloud_location,
            http_options={"api_version": "v1"},
        )
        response = client.models.generate_content(
            model=self.llm_config.model,
            contents=request_data["contents"],
            config=request_data["config"],
        )
        return response.model_dump()

    def build_request_data(
        self,
        messages: List[PydanticMessage],
        tools: List[dict],
        tool_call: Optional[str],
    ) -> dict:
        """
        Constructs a request object in the expected data format for this client.
        """
        request_data = super().build_request_data(messages, tools, tool_call)
        request_data["config"] = request_data.pop("generation_config")
        request_data["config"]["tools"] = request_data.pop("tools")

        tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(
                # ANY mode forces the model to predict only function calls
                mode=FunctionCallingConfigMode.ANY,
            )
        )
        request_data["config"]["tool_config"] = tool_config.model_dump()

        return request_data

    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List[PydanticMessage],
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

                role = content.role
                assert role == "model", f"Unknown role in response: {role}"

                parts = content.parts
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
                model=self.llm_config.model,  # NOTE: Google API doesn't pass back model in the response
                created=get_utc_time(),
                usage=usage,
            )
        except KeyError as e:
            raise e
