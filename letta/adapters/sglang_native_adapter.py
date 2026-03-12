"""
SGLang Native Adapter for multi-turn RL training.

This adapter uses SGLang's native /generate endpoint instead of the OpenAI-compatible
endpoint to get token IDs and per-token logprobs, which are essential for proper
multi-turn RL training with loss masking.

Uses HuggingFace tokenizer's apply_chat_template() for proper tool formatting.
"""

import json
import re
import time
import uuid
from typing import Any, AsyncGenerator, Optional

from letta.adapters.simple_llm_request_adapter import SimpleLLMRequestAdapter
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.llm_api.sglang_native_client import SGLangNativeClient
from letta.log import get_logger
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionResponse,
    ChatCompletionTokenLogprob,
    Choice,
    ChoiceLogprobs,
    FunctionCall,
    Message as ChoiceMessage,
    ToolCall,
    UsageStatistics,
)

logger = get_logger(__name__)

# Global tokenizer cache
_tokenizer_cache: dict[str, Any] = {}


class SGLangNativeAdapter(SimpleLLMRequestAdapter):
    """
    Adapter that uses SGLang's native /generate endpoint for multi-turn RL training.

    Key differences from SimpleLLMRequestAdapter:
    - Uses /generate instead of /v1/chat/completions
    - Returns output_ids (token IDs) in addition to text
    - Returns output_token_logprobs with [logprob, token_id] pairs
    - Formats tools into prompt and parses tool calls from response

    These are essential for building accurate loss masks in multi-turn training.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._sglang_client: Optional[SGLangNativeClient] = None
        self._tokenizer: Any = None

    def _get_tokenizer(self) -> Any:
        """Get or create tokenizer for the model."""
        global _tokenizer_cache

        # Get model name from llm_config
        model_name = self.llm_config.model
        if not model_name:
            logger.warning("No model name in llm_config, cannot load tokenizer")
            return None

        # Check cache
        if model_name in _tokenizer_cache:
            return _tokenizer_cache[model_name]

        try:
            from transformers import AutoTokenizer

            logger.info(f"Loading tokenizer for model: {model_name}")
            tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
            _tokenizer_cache[model_name] = tokenizer
            return tokenizer
        except ImportError:
            logger.warning("transformers not installed, falling back to manual formatting")
            return None
        except Exception as e:
            logger.warning(f"Failed to load tokenizer: {e}, falling back to manual formatting")
            return None

    def _get_sglang_client(self) -> SGLangNativeClient:
        """Get or create SGLang native client."""
        if self._sglang_client is None:
            # Get base URL from llm_config, removing /v1 suffix if present
            base_url = self.llm_config.model_endpoint or ""
            # SGLang local instances typically don't need API key
            self._sglang_client = SGLangNativeClient(
                base_url=base_url,
                api_key=None,
            )
        return self._sglang_client

    def _format_tools_for_prompt(self, tools: list) -> str:
        """
        Format tools in Qwen3 chat template format for the system prompt.

        This matches the exact format produced by Qwen3's tokenizer.apply_chat_template()
        with tools parameter.
        """
        if not tools:
            return ""

        # Format each tool as JSON (matching Qwen3 template exactly)
        tool_jsons = []
        for tool in tools:
            # Handle both dict and object formats
            if isinstance(tool, dict):
                # Already in OpenAI format
                tool_jsons.append(json.dumps(tool))
            else:
                # Convert object to dict
                tool_dict = {
                    "type": "function",
                    "function": {
                        "name": getattr(getattr(tool, "function", tool), "name", ""),
                        "description": getattr(getattr(tool, "function", tool), "description", ""),
                        "parameters": getattr(getattr(tool, "function", tool), "parameters", {}),
                    },
                }
                tool_jsons.append(json.dumps(tool_dict))

        # Use exact Qwen3 format
        tools_section = (
            "\n\n# Tools\n\n"
            "You may call one or more functions to assist with the user query.\n\n"
            "You are provided with function signatures within <tools></tools> XML tags:\n"
            "<tools>\n" + "\n".join(tool_jsons) + "\n"
            "</tools>\n\n"
            "For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n"
            "<tool_call>\n"
            '{"name": <function-name>, "arguments": <args-json-object>}\n'
            "</tool_call>"
        )

        return tools_section

    def _convert_messages_to_openai_format(self, messages: list) -> list[dict]:
        """Convert Letta Message objects to OpenAI-style message dicts."""
        openai_messages = []

        for msg in messages:
            # Handle both dict and Pydantic Message objects
            if hasattr(msg, "role"):
                role = msg.role
                content = msg.content if hasattr(msg, "content") else ""
                # Handle content that might be a list of content parts
                if isinstance(content, list):
                    content = " ".join([c.text if hasattr(c, "text") else str(c) for c in content])
                elif content is None:
                    content = ""
                tool_calls = getattr(msg, "tool_calls", None)
                tool_call_id = getattr(msg, "tool_call_id", None)
                name = getattr(msg, "name", None)
            else:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                tool_calls = msg.get("tool_calls", None)
                tool_call_id = msg.get("tool_call_id", None)
                name = msg.get("name", None)

            openai_msg = {"role": role, "content": content}

            if tool_calls:
                # Convert tool calls to OpenAI format
                openai_tool_calls = []
                for tc in tool_calls:
                    if hasattr(tc, "function"):
                        tc_dict = {
                            "id": getattr(tc, "id", f"call_{uuid.uuid4().hex[:8]}"),
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                                if isinstance(tc.function.arguments, str)
                                else json.dumps(tc.function.arguments),
                            },
                        }
                    else:
                        tc_dict = {
                            "id": tc.get("id", f"call_{uuid.uuid4().hex[:8]}"),
                            "type": "function",
                            "function": tc.get("function", {}),
                        }
                    openai_tool_calls.append(tc_dict)
                openai_msg["tool_calls"] = openai_tool_calls

            if tool_call_id:
                openai_msg["tool_call_id"] = tool_call_id

            if name and role == "tool":
                openai_msg["name"] = name

            openai_messages.append(openai_msg)

        return openai_messages

    def _convert_tools_to_openai_format(self, tools: list) -> list[dict]:
        """Convert tools to OpenAI format for tokenizer."""
        openai_tools = []
        for tool in tools:
            if isinstance(tool, dict):
                # Already a dict, ensure it's in the right format
                if "function" in tool:
                    openai_tools.append(tool)
                else:
                    # Might be the function directly
                    openai_tools.append({"type": "function", "function": tool})
            else:
                # Convert object to dict
                func = getattr(tool, "function", tool)
                tool_dict = {
                    "type": "function",
                    "function": {
                        "name": getattr(func, "name", ""),
                        "description": getattr(func, "description", ""),
                        "parameters": getattr(func, "parameters", {}),
                    },
                }
                openai_tools.append(tool_dict)
        return openai_tools

    def _format_messages_to_text(self, messages: list, tools: list) -> str:
        """
        Format messages to text using tokenizer's apply_chat_template if available.

        Falls back to manual formatting if tokenizer is not available.
        """
        tokenizer = self._get_tokenizer()

        if tokenizer is not None:
            # Use tokenizer's apply_chat_template for proper formatting
            openai_messages = self._convert_messages_to_openai_format(messages)
            openai_tools = self._convert_tools_to_openai_format(tools) if tools else None

            try:
                formatted = tokenizer.apply_chat_template(
                    openai_messages,
                    tokenize=False,
                    add_generation_prompt=True,
                    tools=openai_tools,
                )
                logger.debug(f"Formatted prompt using tokenizer ({len(formatted)} chars)")
                return formatted
            except Exception as e:
                logger.warning(f"apply_chat_template failed: {e}, falling back to manual formatting")

        # Fallback to manual formatting
        return self._format_messages_to_text_manual(messages, tools)

    def _format_messages_to_text_manual(self, messages: list, tools: list) -> str:
        """Manual fallback formatting for when tokenizer is not available."""
        formatted_parts = []
        tools_section = self._format_tools_for_prompt(tools)

        for msg in messages:
            # Handle both dict and Pydantic Message objects
            if hasattr(msg, "role"):
                role = msg.role
                content = msg.content if hasattr(msg, "content") else ""
                if isinstance(content, list):
                    content = " ".join([c.text if hasattr(c, "text") else str(c) for c in content])
                elif content is None:
                    content = ""
                tool_calls = getattr(msg, "tool_calls", None)
            else:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                tool_calls = msg.get("tool_calls", None)

            if role == "system":
                system_content = content + tools_section if tools_section else content
                formatted_parts.append(f"<|im_start|>system\n{system_content}<|im_end|>")
                tools_section = ""
            elif role == "user":
                formatted_parts.append(f"<|im_start|>user\n{content}<|im_end|>")
            elif role == "assistant":
                if tool_calls:
                    tc_parts = []
                    for tc in tool_calls:
                        if hasattr(tc, "function"):
                            tc_name = tc.function.name
                            tc_args = tc.function.arguments
                        else:
                            tc_name = tc.get("function", {}).get("name", "")
                            tc_args = tc.get("function", {}).get("arguments", "{}")

                        if isinstance(tc_args, str):
                            try:
                                tc_args = json.loads(tc_args)
                            except Exception:
                                pass

                        tc_parts.append(f'<tool_call>\n{{"name": "{tc_name}", "arguments": {json.dumps(tc_args)}}}\n</tool_call>')

                    assistant_content = content + "\n" + "\n".join(tc_parts) if content else "\n".join(tc_parts)
                    formatted_parts.append(f"<|im_start|>assistant\n{assistant_content}<|im_end|>")
                elif content:
                    formatted_parts.append(f"<|im_start|>assistant\n{content}<|im_end|>")
            elif role == "tool":
                formatted_parts.append(f"<|im_start|>user\n<tool_response>\n{content}\n</tool_response><|im_end|>")

        formatted_parts.append("<|im_start|>assistant\n")
        return "\n".join(formatted_parts)

    def _parse_tool_calls(self, text: str) -> list[ToolCall]:
        """
        Parse tool calls from response text.

        Looks for patterns like:
        <tool_call>
        {"name": "tool_name", "arguments": {...}}
        </tool_call>
        """
        tool_calls = []

        # Find all tool_call blocks
        pattern = r"<tool_call>\s*(\{.*?\})\s*</tool_call>"
        matches = re.findall(pattern, text, re.DOTALL)

        for match in matches:
            try:
                tc_data = json.loads(match)
                name = tc_data.get("name", "")
                arguments = tc_data.get("arguments", {})

                if isinstance(arguments, dict):
                    arguments = json.dumps(arguments)

                tool_call = ToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    type="function",
                    function=FunctionCall(
                        name=name,
                        arguments=arguments,
                    ),
                )
                tool_calls.append(tool_call)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse tool call JSON: {e}")
                continue

        return tool_calls

    def _extract_content_without_tool_calls(self, text: str) -> str:
        """Extract content from response, removing tool_call blocks."""
        # Remove tool_call blocks
        cleaned = re.sub(r"<tool_call>.*?</tool_call>", "", text, flags=re.DOTALL)
        # Clean up whitespace
        cleaned = cleaned.strip()
        return cleaned

    async def invoke_llm(
        self,
        request_data: dict,
        messages: list,
        tools: list,
        use_assistant_message: bool,
        requires_approval_tools: list[str] = [],
        step_id: str | None = None,
        actor: str | None = None,
    ) -> AsyncGenerator[LettaMessage | None, None]:
        """
        Execute LLM request using SGLang native endpoint.

        This method:
        1. Formats messages and tools to text using chat template
        2. Calls SGLang native /generate endpoint
        3. Extracts output_ids and output_token_logprobs
        4. Parses tool calls from response
        5. Converts response to standard format
        """
        self.request_data = request_data

        # Get sampling params from request_data
        sampling_params = {
            "temperature": request_data.get("temperature", 0.7),
            "max_new_tokens": request_data.get("max_tokens", 4096),
            "top_p": request_data.get("top_p", 0.9),
        }

        # Format messages to text (includes tools in prompt)
        text_input = self._format_messages_to_text(messages, tools)

        # Call SGLang native endpoint
        client = self._get_sglang_client()

        try:
            response = await client.generate(
                text=text_input,
                sampling_params=sampling_params,
                return_logprob=True,
            )
        except Exception as e:
            logger.error(f"SGLang native endpoint error: {e}")
            raise

        self.llm_request_finish_timestamp_ns = get_utc_timestamp_ns()

        # Store native response data
        self.response_data = response

        # Extract SGLang native data
        self.output_ids = response.get("output_ids")
        # output_token_logprobs is inside meta_info
        meta_info = response.get("meta_info", {})
        self.output_token_logprobs = meta_info.get("output_token_logprobs")

        # Extract text response
        text_response = response.get("text", "")

        # Remove trailing end token if present
        if text_response.endswith("<|im_end|>"):
            text_response = text_response[:-10]

        # Parse tool calls from response
        parsed_tool_calls = self._parse_tool_calls(text_response)

        # Extract content (text without tool_call blocks)
        content_text = self._extract_content_without_tool_calls(text_response)

        # Determine finish reason
        meta_info = response.get("meta_info", {})
        finish_reason_info = meta_info.get("finish_reason", {})
        if isinstance(finish_reason_info, dict):
            finish_reason = finish_reason_info.get("type", "stop")
        else:
            finish_reason = "stop"

        # If we have tool calls, set finish_reason to tool_calls
        if parsed_tool_calls:
            finish_reason = "tool_calls"

        # Convert to standard ChatCompletionResponse format for compatibility
        # Build logprobs in OpenAI format from SGLang format
        logprobs_content = None
        if self.output_token_logprobs:
            logprobs_content = []
            for i, lp_data in enumerate(self.output_token_logprobs):
                # SGLang format: [logprob, token_id, top_logprob]
                logprob = lp_data[0] if len(lp_data) > 0 else 0.0
                token_id = lp_data[1] if len(lp_data) > 1 else 0
                logprobs_content.append(
                    ChatCompletionTokenLogprob(
                        token=str(token_id),
                        logprob=logprob,
                        bytes=None,
                        top_logprobs=[],
                    )
                )

        choice_logprobs = ChoiceLogprobs(content=logprobs_content) if logprobs_content else None

        # Build chat completion response
        prompt_tokens = meta_info.get("prompt_tokens", 0)
        completion_tokens = len(self.output_ids) if self.output_ids else 0

        self.chat_completions_response = ChatCompletionResponse(
            id=meta_info.get("id", "sglang-native"),
            created=int(time.time()),
            choices=[
                Choice(
                    finish_reason=finish_reason,
                    index=0,
                    message=ChoiceMessage(
                        role="assistant",
                        content=content_text if content_text else None,
                        tool_calls=parsed_tool_calls if parsed_tool_calls else None,
                    ),
                    logprobs=choice_logprobs,
                )
            ],
            usage=UsageStatistics(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

        # Extract content
        if content_text:
            self.content = [TextContent(text=content_text)]
        else:
            self.content = None

        # No reasoning content from native endpoint
        self.reasoning_content = None

        # Set tool calls
        self.tool_calls = parsed_tool_calls
        self.tool_call = parsed_tool_calls[0] if parsed_tool_calls else None

        # Set logprobs
        self.logprobs = choice_logprobs

        # Extract usage statistics
        self.usage.step_count = 1
        self.usage.completion_tokens = completion_tokens
        self.usage.prompt_tokens = prompt_tokens
        self.usage.total_tokens = prompt_tokens + completion_tokens

        self.log_provider_trace(step_id=step_id, actor=actor)

        logger.info(
            f"SGLang native response: {len(self.output_ids or [])} tokens, "
            f"{len(self.output_token_logprobs or [])} logprobs, "
            f"{len(parsed_tool_calls)} tool calls"
        )

        yield None
        return
