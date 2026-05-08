"""
SGLang Native Adapter for multi-turn RL training.

Uses SGLang's native /generate endpoint with input_ids (pre-tokenized via HF
apply_chat_template) to get token IDs and per-token logprobs for loss masking.
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
from letta.schemas.enums import ProviderType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.model import ModelSettingsUnion
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

# Global tokenizer cache keyed by model name
_tokenizer_cache: dict[str, Any] = {}


def _get_tokenizer(model_name: str) -> Any:
    """Load and cache HF tokenizer for the given model."""
    if model_name in _tokenizer_cache:
        return _tokenizer_cache[model_name]

    from transformers import AutoTokenizer

    logger.info(f"Loading tokenizer for {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    _tokenizer_cache[model_name] = tokenizer
    return tokenizer


def _resolve_tokenizer_path(model_name: str) -> str:
    """Resolve model name to a tokenizer-loadable path.

    Handles handles like 'sglang/slime-sglang//local/path' or
    'slime-sglang//local/path' by extracting the local filesystem path.
    """
    # Strip leading provider prefixes (e.g. 'sglang/', 'openai-proxy/')
    # until we find either a HF repo id or a local path
    parts = model_name.split("/")
    # Reconstruct: find where the absolute path starts (leading '/')
    # e.g. "slime-sglang//opt/..." -> after splitting on '/' gives ['slime-sglang', '', 'opt', ...]
    # join from first empty string onward to recover '/opt/...'
    for i, part in enumerate(parts):
        if part == "" and i > 0:
            local_path = "/" + "/".join(parts[i + 1 :])
            if local_path != "/":
                return local_path
    return model_name


def _messages_to_input_ids(model_name: str, messages: list, tools: list) -> list[int]:
    """Apply the model's chat template and return token IDs.

    Uses apply_chat_template(tokenize=True) — single step, correct template,
    no double tokenization. Raises clearly if tokenizer cannot be loaded.
    """
    tokenizer = _get_tokenizer(_resolve_tokenizer_path(model_name))

    openai_messages = _to_openai_messages(messages)
    openai_tools = _to_openai_tools(tools) if tools else None

    result = tokenizer.apply_chat_template(
        openai_messages,
        tokenize=True,
        add_generation_prompt=True,
        tools=openai_tools,
        return_tensors=None,  # plain Python list
    )
    # apply_chat_template may return a BatchEncoding (dict-like) or a plain list.
    # BatchEncoding doesn't pass isinstance(dict) checks, so use hasattr instead.
    if hasattr(result, "input_ids"):
        return list(result.input_ids)
    if hasattr(result, "__getitem__") and not isinstance(result, (list, tuple)):
        return list(result["input_ids"])
    return list(result)


def _to_openai_messages(messages: list) -> list[dict]:
    """Convert Letta Message objects to OpenAI-style dicts."""
    result = []
    for msg in messages:
        if hasattr(msg, "role"):
            role = msg.role
            content = msg.content or ""
            if isinstance(content, list):
                parts = []
                for c in content:
                    text = getattr(c, "text", None)
                    if text is not None:
                        parts.append(text)
                content = "\n".join(parts) if parts else ""
            tool_calls = getattr(msg, "tool_calls", None)
            tool_call_id = getattr(msg, "tool_call_id", None)
            name = getattr(msg, "name", None)
        else:
            role = msg.get("role", "user")
            content = msg.get("content", "") or ""
            tool_calls = msg.get("tool_calls")
            tool_call_id = msg.get("tool_call_id")
            name = msg.get("name")

        d: dict = {"role": role, "content": content}

        if tool_calls:
            parsed_calls = []
            for tc in tool_calls:
                if hasattr(tc, "function"):
                    tc_id = getattr(tc, "id", None) or f"call_{uuid.uuid4().hex[:8]}"
                    tc_name = tc.function.name
                    tc_args = tc.function.arguments
                else:
                    tc_id = tc.get("id", f"call_{uuid.uuid4().hex[:8]}")
                    tc_name = tc.get("function", {}).get("name", "")
                    tc_args = tc.get("function", {}).get("arguments", "{}")
                # GLM chat template expects arguments as dict, not JSON string
                if isinstance(tc_args, str):
                    try:
                        tc_args = json.loads(tc_args)
                    except (json.JSONDecodeError, ValueError):
                        tc_args = {}
                parsed_calls.append(
                    {
                        "id": tc_id,
                        "type": "function",
                        "function": {"name": tc_name, "arguments": tc_args},
                    }
                )
            d["tool_calls"] = parsed_calls

        if tool_call_id:
            d["tool_call_id"] = tool_call_id
        if name and role == "tool":
            d["name"] = name

        result.append(d)
    return result


def _to_openai_tools(tools: list) -> list[dict]:
    """Convert tool objects to OpenAI-format dicts."""
    result = []
    for tool in tools:
        if isinstance(tool, dict):
            result.append(tool if "function" in tool else {"type": "function", "function": tool})
        else:
            func = getattr(tool, "function", tool)
            result.append(
                {
                    "type": "function",
                    "function": {
                        "name": getattr(func, "name", ""),
                        "description": getattr(func, "description", ""),
                        "parameters": getattr(func, "parameters", {}),
                    },
                }
            )
    return result


def _parse_glm47_tool_calls(text: str) -> list[ToolCall]:
    """Parse GLM-4.7 XML tool call format inline (no sglang dependency).

    Format: <tool_call>func_name<arg_key>k</arg_key><arg_value>v</arg_value>...</tool_call>
    """
    tool_calls = []
    for inner in re.findall(r"<tool_call>(.*?)</tool_call>", text, re.DOTALL):
        inner = inner.strip()
        # JSON format fallback
        if inner.startswith("{"):
            try:
                data = json.loads(inner)
                args = data.get("arguments", {})
                if isinstance(args, dict):
                    args = json.dumps(args)
                tool_calls.append(
                    ToolCall(
                        id=f"call_{uuid.uuid4().hex[:8]}",
                        type="function",
                        function=FunctionCall(name=data.get("name", ""), arguments=args),
                    )
                )
                continue
            except json.JSONDecodeError:
                pass
        # GLM-4.7 XML format: first non-tag text is function name
        name_match = re.match(r"^([^<\n]+)", inner)
        if not name_match:
            continue
        func_name = name_match.group(1).strip()
        keys = re.findall(r"<arg_key>(.*?)</arg_key>", inner, re.DOTALL)
        vals = re.findall(r"<arg_value>(.*?)</arg_value>", inner, re.DOTALL)
        tool_calls.append(
            ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                type="function",
                function=FunctionCall(name=func_name, arguments=json.dumps(dict(zip(keys, vals)))),
            )
        )
    return tool_calls


def _parse_tool_calls(text: str, tools: list | None = None, tool_call_parser: str = "glm47") -> list[ToolCall]:
    """Parse tool calls from response text.

    Tries SGLang's FunctionCallParser first; falls back to inline GLM-4.7 parser.
    """
    try:
        from sglang.srt.function_call.core_types import Function, Tool
        from sglang.srt.function_call.function_call_parser import FunctionCallParser

        sglang_tools: list[Tool] = []
        for t in tools or []:
            func = t.get("function", t) if isinstance(t, dict) else getattr(t, "function", t)
            name = func.get("name", "") if isinstance(func, dict) else getattr(func, "name", "")
            desc = func.get("description", "") if isinstance(func, dict) else getattr(func, "description", "")
            params = func.get("parameters", {}) if isinstance(func, dict) else getattr(func, "parameters", {})
            sglang_tools.append(Tool(type="function", function=Function(name=name, description=desc, parameters=params)))

        parser = FunctionCallParser(tools=sglang_tools, tool_call_parser=tool_call_parser)
        result = parser.detector.detect_and_parse(text, sglang_tools)
        tool_calls = []
        for call in result.calls:
            arguments = call.parameters if isinstance(call.parameters, str) else json.dumps(call.parameters)
            tool_calls.append(
                ToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    type="function",
                    function=FunctionCall(name=call.name, arguments=arguments),
                )
            )
        return tool_calls
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"SGLang tool call parser ({tool_call_parser}) failed: {e}")

    # Inline GLM-4.7 fallback (no sglang required)
    return _parse_glm47_tool_calls(text)


def _strip_tool_calls(text: str) -> str:
    return re.sub(r"<tool_call>.*?</tool_call>", "", text, flags=re.DOTALL).strip()


class SGLangNativeAdapter(SimpleLLMRequestAdapter):
    """
    Adapter using SGLang's native /generate endpoint for multi-turn RL training.

    Flow:
    1. Apply model's chat template via HF tokenizer → input_ids (single tokenization step)
    2. POST input_ids to SGLang /generate → output_ids + output_token_logprobs
    3. Parse tool calls from response text
    """

    def __init__(self, *args, model_settings: ModelSettingsUnion | None = None, **kwargs):
        self.model_settings = model_settings
        super().__init__(*args, **kwargs)
        self._sglang_client: Optional[SGLangNativeClient] = None

    def _get_sglang_client(self) -> SGLangNativeClient:
        if self._sglang_client is None:
            base_url = (self.llm_config.model_endpoint or "").rstrip("/")
            if base_url.endswith("/v1"):
                base_url = base_url[:-3]
            self._sglang_client = SGLangNativeClient(base_url=base_url, api_key=None)
        return self._sglang_client

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
        self.request_data = request_data

        sampling_params = {
            "temperature": request_data.get("temperature", 0.7),
            "max_new_tokens": request_data.get("max_tokens", 4096),
            "top_p": request_data.get("top_p", 0.9),
        }

        # Tokenize via HF apply_chat_template — correct template, no double tokenization
        openai_msgs = _to_openai_messages(messages)
        logger.info(f"SGLang native input: {len(openai_msgs)} messages, roles={[m['role'] for m in openai_msgs]}")
        if openai_msgs:
            first_content = openai_msgs[0].get("content", "")
            logger.info(f"  first msg content[:200]: {str(first_content)[:200]}")
        input_ids = _messages_to_input_ids(self.llm_config.model, messages, tools)

        client = self._get_sglang_client()
        response = await client.generate(
            input_ids=input_ids,
            sampling_params=sampling_params,
            return_logprob=True,
        )

        self.llm_request_finish_timestamp_ns = get_utc_timestamp_ns()
        self.response_data = response

        self.output_ids = response.get("output_ids")
        meta_info = response.get("meta_info", {})
        self.output_token_logprobs = meta_info.get("output_token_logprobs")

        text_response = response.get("text", "")
        finish_reason_raw = response.get("meta_info", {}).get("finish_reason", {})
        output_ids_raw = response.get("output_ids", [])
        logger.info(f"SGLang raw response[:300]: {repr(text_response[:300])}")
        logger.info(f"SGLang finish_reason: {finish_reason_raw}")
        logger.info(f"SGLang output_ids[:15]: {output_ids_raw[:15]}")
        # Decode output_ids directly to verify what tokens were generated
        try:
            tok = _get_tokenizer(_resolve_tokenizer_path(self.llm_config.model))
            logger.info(f"SGLang output decoded[:200]: {repr(tok.decode(output_ids_raw[:50]))}")
        except Exception as _e:
            pass

        tool_call_parser = "qwen25"
        if self.model_settings is not None and getattr(self.model_settings, "provider_type", None) == ProviderType.sglang:
            tool_call_parser = getattr(self.model_settings, "tool_call_parser", None) or tool_call_parser
        parsed_tool_calls = _parse_tool_calls(text_response, tools=tools, tool_call_parser=tool_call_parser)
        content_text = _strip_tool_calls(text_response)

        finish_reason_info = meta_info.get("finish_reason", {})
        finish_reason = finish_reason_info.get("type", "stop") if isinstance(finish_reason_info, dict) else "stop"
        if parsed_tool_calls:
            finish_reason = "tool_calls"

        logprobs_content = None
        if self.output_token_logprobs:
            logprobs_content = [
                ChatCompletionTokenLogprob(
                    token=str(lp[1]) if len(lp) > 1 else "0",
                    logprob=lp[0] if len(lp) > 0 else 0.0,
                    bytes=None,
                    top_logprobs=[],
                )
                for lp in self.output_token_logprobs
            ]

        choice_logprobs = ChoiceLogprobs(content=logprobs_content) if logprobs_content else None
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
                        content=content_text or None,
                        tool_calls=parsed_tool_calls or None,
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

        self.content = [TextContent(text=content_text)] if content_text else None
        self.reasoning_content = None
        self.tool_calls = parsed_tool_calls
        self.tool_call = parsed_tool_calls[0] if parsed_tool_calls else None
        self.logprobs = choice_logprobs

        self.usage.step_count = 1
        self.usage.completion_tokens = completion_tokens
        self.usage.prompt_tokens = prompt_tokens
        self.usage.total_tokens = prompt_tokens + completion_tokens

        self.log_provider_trace(step_id=step_id, actor=actor)

        logger.info(
            f"SGLang native: {len(self.output_ids or [])} output tokens, "
            f"{len(self.output_token_logprobs or [])} logprobs, "
            f"{len(parsed_tool_calls)} tool calls"
        )

        yield None
        return
