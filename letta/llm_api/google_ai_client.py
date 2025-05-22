from typing import List, Optional, Tuple

import json
import uuid

import httpx
from google import genai
from opentelemetry import trace

from letta.errors import ErrorCode, LLMAuthenticationError, LLMError
from letta.llm_api.google_constants import GOOGLE_MODEL_FOR_API_KEY_CHECK
from letta.llm_api.google_vertex_client import GoogleVertexClient
from letta.log import get_logger
from letta.settings import model_settings
from letta.utils import clean_json_string_extra_backslash, count_tokens, json_dumps
from letta.llm_api.schemas import (
    ChatCompletionResponse,
    Choice,
    FunctionCall,
    FunctionCallingConfig,
    FunctionCallingConfigMode,
    Message,
    PydanticMessage,
    Tool,
    ToolCall,
    ToolConfig,
    UsageStatistics,
    get_tool_call_id,
    get_utc_time_int,
    NON_USER_MSG_PREFIX,
)

logger = get_logger(__name__)


class GoogleAIClient(GoogleVertexClient):
    """Gemini client with OpenAI‑style interface and extra instrumentation."""

    def _get_client(self):
        """Return a raw Google Generative AI client."""
        return genai.Client(api_key=model_settings.gemini_api_key)

    def request(self, request_data: dict, llm_config: "LLMConfig") -> dict:
        """Perform the HTTP request to Gemini and return the raw dict."""
        url, headers = get_gemini_endpoint_and_headers(
            base_url=str(llm_config.model_endpoint),
            model=llm_config.model,
            api_key=str(model_settings.gemini_api_key),
            key_in_header=True,
            generate_content=True,
        )
        return make_post_request(url, headers, request_data)

    # --------------------------------------------------------------------- #
    #                        Payload construction                           #
    # --------------------------------------------------------------------- #

    def build_request_data(
        self,
        messages: List["PydanticMessage"],
        llm_config: "LLMConfig",
        tools: List[dict],
        force_tool_call: Optional[str] = None,
    ) -> dict:
        """Convert Letta‑internal chat objects into a Gemini request."""
        if tools:
            tools = [{"type": "function", "function": f} for f in tools]
            tool_objs = [Tool(**t) for t in tools]
            tool_names = [t.function.name for t in tool_objs]
            tools = self.convert_tools_to_google_ai_format(tool_objs, llm_config)
        else:
            tool_names = []

        contents = self.add_dummy_model_messages([m.to_google_ai_dict() for m in messages])

        request_data = {
            "contents": contents,
            "tools": tools,
            "generation_config": {
                "temperature": llm_config.temperature,
                "max_output_tokens": llm_config.max_tokens,
            },
            "tool_config": ToolConfig(
                function_calling_config=FunctionCallingConfig(
                    mode=FunctionCallingConfigMode.ANY,
                    allowed_function_names=tool_names,
                )
            ).model_dump(),
        }

        return request_data

    def convert_response_to_chat_completion(
        self,
        response_data: dict,
        input_messages: List["PydanticMessage"],
        llm_config: "LLMConfig",
    ) -> "ChatCompletionResponse":
        """Translate a Gemini response into ChatCompletionResponse."""
        choices: List[Choice] = []
        index = 0

        for candidate in response_data["candidates"]:
            content = candidate["content"]
            role = content["role"]
            assert role == "model", f"Unknown role in response: {role}"

            parts = content["parts"]
            if len(parts) > 1:
                logger.warning("Unexpected multiple parts in Gemini response: %s", parts)
                parts = [parts[-1]]

            for response_part in parts:
                if "functionCall" in response_part and response_part["functionCall"]:
                    call = response_part["functionCall"]
                    function_name = call["name"]
                    function_args = call["args"]

                    inner_thoughts = None
                    if llm_config.put_inner_thoughts_in_kwargs:
                        from letta.local_llm.constants import INNER_THOUGHTS_KWARG

                        inner_thoughts = function_args.pop(INNER_THOUGHTS_KWARG)

                    message = Message(
                        role="assistant",
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
                    message = Message(role="assistant", content=response_part["text"])

                finish_reason = candidate["finishReason"]
                if finish_reason == "STOP":
                    openai_finish = "function_call" if message.tool_calls else "stop"
                elif finish_reason == "MAX_TOKENS":
                    openai_finish = "length"
                elif finish_reason in ("SAFETY", "RECITATION"):
                    openai_finish = "content_filter"
                else:
                    raise ValueError(f"Unexpected finish reason: {finish_reason}")

                choices.append(
                    Choice(
                        finish_reason=openai_finish,
                        index=index,
                        message=message,
                    )
                )
                index += 1

        if "usageMetadata" in response_data:
            usage_meta = response_data["usageMetadata"]
            prompt_tokens = usage_meta["promptTokenCount"]
            completion_tokens = usage_meta["candidatesTokenCount"]
            total_tokens = usage_meta["totalTokenCount"]
        else:
            prompt_tokens = count_tokens(json_dumps(input_messages))
            completion_tokens = count_tokens(json_dumps(choices[0].message.model_dump()))
            total_tokens = prompt_tokens + completion_tokens

        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("llm.prompt_tokens", prompt_tokens)
            span.set_attribute("llm.completion_tokens", completion_tokens)
            span.set_attribute("llm.total_tokens", total_tokens)

        usage = UsageStatistics(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )

        return ChatCompletionResponse(
            id=str(uuid.uuid4()),
            model=llm_config.model,
            choices=choices,
            created=get_utc_time_int(),
            usage=usage,
        )

    def _clean_google_ai_schema_properties(self, schema_part: dict):
        """Recursively strip unsupported OpenAPI fields from a schema."""
        if not isinstance(schema_part, dict):
            return

        unsupported = {"default", "exclusiveMaximum", "exclusiveMinimum"}
        for key in unsupported & schema_part.keys():
            logger.warning("Removing unsupported keyword '%s' from schema.", key)
            schema_part.pop(key, None)

        if schema_part.get("type") == "string" and schema_part.get("format") not in (None, "enum", "date-time"):
            logger.warning("Removing unsupported format '%s'.", schema_part["format"])
            schema_part.pop("format", None)

        for container in ("properties", "items"):
            if container in schema_part:
                sub = schema_part[container]
                if isinstance(sub, dict):
                    for value in sub.values():
                        self._clean_google_ai_schema_properties(value)

        for key in ("anyOf", "allOf", "oneOf"):
            if key in schema_part and isinstance(schema_part[key], list):
                for item in schema_part[key]:
                    self._clean_google_ai_schema_properties(item)

    def convert_tools_to_google_ai_format(self, tools: List["Tool"], llm_config: "LLMConfig") -> List[dict]:
        function_list = [
            {
                "name": t.function.name,
                "description": t.function.description,
                "parameters": t.function.parameters,
            }
            for t in tools
        ]

        for func in function_list:
            self._clean_google_ai_schema_properties(func["parameters"])

            if llm_config.put_inner_thoughts_in_kwargs:
                from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION

                func["parameters"]["properties"][INNER_THOUGHTS_KWARG] = {
                    "type": "string",
                    "description": INNER_THOUGHTS_KWARG_DESCRIPTION,
                }
                func["parameters"]["required"].append(INNER_THOUGHTS_KWARG)

        return [{"functionDeclarations": function_list}]

    def add_dummy_model_messages(self, messages: List[dict]) -> List[dict]:
        dummy = {
            "role": "model",
            "parts": [{"text": f"{NON_USER_MSG_PREFIX}Function call returned, waiting for user response."}],
        }
        output = []
        for i, msg in enumerate(messages):
            output.append(msg)
            if msg["role"] in {"tool", "function"} and i + 1 < len(messages) and messages[i + 1]["role"] == "user":
                output.append(dummy)
        return output

def make_post_request(url: str, headers: dict, data: dict) -> dict:
    with httpx.Client(timeout=30) as client:
        response = client.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
