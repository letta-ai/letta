import json
import os
import random
import time
from typing import List, Optional, Union

import requests

from letta.constants import CLI_WARNING_PREFIX
from letta.errors import LettaConfigurationError, RateLimitExceededError
from letta.llm_api.helpers import unpack_all_inner_thoughts_from_kwargs
from letta.log import get_logger

logger = get_logger(__name__)
from letta.llm_api.openai import (
    build_openai_chat_completions_request,
    openai_chat_completions_process_stream,
    openai_chat_completions_request,
    prepare_openai_payload,
)
from letta.local_llm.chat_completion_proxy import get_chat_completion
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.local_llm.utils import num_tokens_from_functions, num_tokens_from_messages
from letta.orm.user import User
from letta.otel.tracing import log_event, trace_method
from letta.schemas.enums import ProviderCategory
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.services.telemetry_manager import TelemetryManager
from letta.settings import ModelSettings
from letta.streaming_interface import AgentChunkStreamingInterface, AgentRefreshStreamingInterface

LLM_API_PROVIDER_OPTIONS = ["openai", "azure", "anthropic", "google_ai", "local", "groq", "deepseek"]


def retry_with_exponential_backoff(
    func,
    initial_delay: float = 1,
    exponential_base: float = 2,
    jitter: bool = True,
    max_retries: int = 20,
    # List of OpenAI error codes: https://github.com/openai/openai-python/blob/17ac6779958b2b74999c634c4ea4c7b74906027a/src/openai/_client.py#L227-L250
    # 429 = rate limit
    error_codes: tuple = (429,),
):
    """Retry a function with exponential backoff."""

    def wrapper(*args, **kwargs):
        pass

        # Initialize variables
        num_retries = 0
        delay = initial_delay

        # Loop until a successful response or max_retries is hit or an exception is raised
        while True:
            try:
                return func(*args, **kwargs)
            except KeyboardInterrupt:
                # Stop retrying if user hits Ctrl-C
                raise KeyboardInterrupt("User intentionally stopped thread. Stopping...")
            except requests.exceptions.HTTPError as http_err:
                if not hasattr(http_err, "response") or not http_err.response:
                    raise

                # Retry on specified errors
                if http_err.response.status_code in error_codes:
                    # Increment retries
                    num_retries += 1
                    log_event(
                        "llm_retry_attempt",
                        {
                            "attempt": num_retries,
                            "delay": delay,
                            "status_code": http_err.response.status_code,
                            "error_type": type(http_err).__name__,
                            "error": str(http_err),
                        },
                    )

                    # Check if max retries has been reached
                    if num_retries > max_retries:
                        log_event(
                            "llm_max_retries_exceeded",
                            {
                                "max_retries": max_retries,
                                "status_code": http_err.response.status_code,
                                "error_type": type(http_err).__name__,
                                "error": str(http_err),
                            },
                        )
                        raise RateLimitExceededError("Maximum number of retries exceeded", max_retries=max_retries)

                    # Increment the delay
                    delay *= exponential_base * (1 + jitter * random.random())

                    # Sleep for the delay
                    # printd(f"Got a rate limit error ('{http_err}') on LLM backend request, waiting {int(delay)}s then retrying...")
                    logger.warning(
                        f"{CLI_WARNING_PREFIX}Got a rate limit error ('{http_err}') on LLM backend request, waiting {int(delay)}s then retrying..."
                    )
                    time.sleep(delay)
                else:
                    # For other HTTP errors, re-raise the exception
                    log_event(
                        "llm_non_retryable_error",
                        {"status_code": http_err.response.status_code, "error_type": type(http_err).__name__, "error": str(http_err)},
                    )
                    raise

            # Raise exceptions for any errors not specified
            except Exception as e:
                log_event("llm_unexpected_error", {"error_type": type(e).__name__, "error": str(e)})
                raise e

    return wrapper


@trace_method
@retry_with_exponential_backoff
def create(
    # agent_state: AgentState,
    llm_config: LLMConfig,
    messages: List[Message],
    user_id: Optional[str] = None,  # option UUID to associate request with
    functions: Optional[list] = None,
    functions_python: Optional[dict] = None,
    function_call: Optional[str] = None,  # see: https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
    # hint
    first_message: bool = False,
    force_tool_call: Optional[str] = None,  # Force a specific tool to be called
    # use tool naming?
    # if false, will use deprecated 'functions' style
    use_tool_naming: bool = True,
    # streaming?
    stream: bool = False,
    stream_interface: Optional[Union[AgentRefreshStreamingInterface, AgentChunkStreamingInterface]] = None,
    model_settings: Optional[dict] = None,  # TODO: eventually pass from server
    put_inner_thoughts_first: bool = True,
    name: Optional[str] = None,
    telemetry_manager: Optional[TelemetryManager] = None,
    step_id: Optional[str] = None,
    actor: Optional[User] = None,
) -> ChatCompletionResponse:
    """Return response to chat completion with backoff"""
    from letta.utils import printd

    # Count the tokens first, if there's an overflow exit early by throwing an error up the stack
    # NOTE: we want to include a specific substring in the error message to trigger summarization
    messages_oai_format = Message.to_openai_dicts_from_list(messages)
    prompt_tokens = num_tokens_from_messages(messages=messages_oai_format, model=llm_config.model)
    function_tokens = num_tokens_from_functions(functions=functions, model=llm_config.model) if functions else 0
    if prompt_tokens + function_tokens > llm_config.context_window:
        raise Exception(f"Request exceeds maximum context length ({prompt_tokens + function_tokens} > {llm_config.context_window} tokens)")

    if not model_settings:
        from letta.settings import model_settings

        model_settings = model_settings
        assert isinstance(model_settings, ModelSettings)

    printd(f"Using model {llm_config.model_endpoint_type}, endpoint: {llm_config.model_endpoint}")

    if function_call and not functions:
        printd("unsetting function_call because functions is None")
        function_call = None

    # openai
    if llm_config.model_endpoint_type == "openai":
        if model_settings.openai_api_key is None and llm_config.model_endpoint == "https://api.openai.com/v1":
            # only is a problem if we are *not* using an openai proxy
            raise LettaConfigurationError(message="OpenAI key is missing from letta config file", missing_fields=["openai_api_key"])
        elif llm_config.provider_category == ProviderCategory.byok:
            from letta.services.provider_manager import ProviderManager
            from letta.services.user_manager import UserManager

            actor = UserManager().get_user_or_default(user_id=user_id)
            api_key = ProviderManager().get_override_key(llm_config.provider_name, actor=actor)
        else:
            # Prefer OpenRouter key when targeting OpenRouter
            is_openrouter = (llm_config.model_endpoint and "openrouter.ai" in llm_config.model_endpoint) or (
                llm_config.provider_name == "openrouter"
            )
            if is_openrouter:
                api_key = model_settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY")
            if not is_openrouter or not api_key:
                api_key = model_settings.openai_api_key or os.environ.get("OPENAI_API_KEY")
            # the openai python client requires some API key string
            api_key = api_key or "DUMMY_API_KEY"

        if function_call is None and functions is not None and len(functions) > 0:
            # force function calling for reliability, see https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice
            # TODO(matt) move into LLMConfig
            # TODO: This vllm checking is very brittle and is a patch at most
            if llm_config.handle and "vllm" in llm_config.handle:
                function_call = "auto"
            else:
                function_call = "required"

        data = build_openai_chat_completions_request(
            llm_config,
            messages,
            user_id,
            functions,
            function_call,
            use_tool_naming,
            put_inner_thoughts_first=put_inner_thoughts_first,
            use_structured_output=True,  # NOTE: turn on all the time for OpenAI API
        )

        if stream:  # Client requested token streaming
            data.stream = True
            assert isinstance(stream_interface, AgentChunkStreamingInterface) or isinstance(
                stream_interface, AgentRefreshStreamingInterface
            ), type(stream_interface)
            response = openai_chat_completions_process_stream(
                url=llm_config.model_endpoint,
                api_key=api_key,
                chat_completion_request=data,
                stream_interface=stream_interface,
                name=name,
                # NOTE: needs to be true for OpenAI proxies that use the `reasoning_content` field
                # For example, DeepSeek, or LM Studio
                expect_reasoning_content=False,
            )
        else:  # Client did not request token streaming (expect a blocking backend response)
            data.stream = False
            if isinstance(stream_interface, AgentChunkStreamingInterface):
                stream_interface.stream_start()
            try:
                response = openai_chat_completions_request(
                    url=llm_config.model_endpoint,
                    api_key=api_key,
                    chat_completion_request=data,
                )
            finally:
                if isinstance(stream_interface, AgentChunkStreamingInterface):
                    stream_interface.stream_end()

        telemetry_manager.create_provider_trace(
            actor=actor,
            provider_trace_create=ProviderTraceCreate(
                request_json=prepare_openai_payload(data),
                response_json=response.model_json_schema(),
                step_id=step_id,
            ),
        )

        if llm_config.put_inner_thoughts_in_kwargs:
            response = unpack_all_inner_thoughts_from_kwargs(response=response, inner_thoughts_key=INNER_THOUGHTS_KWARG)

        return response

    # local model
    else:
        if stream:
            raise NotImplementedError(f"Streaming not yet implemented for {llm_config.model_endpoint_type}")

        if "DeepSeek-R1".lower() in llm_config.model.lower():  # TODO: move this to the llm_config.
            messages[0].content[0].text += f"<available functions> {''.join(json.dumps(f) for f in functions)} </available functions>"
            messages[0].content[
                0
            ].text += 'Select best function to call simply by responding with a single json block with the keys "function" and "params". Use double quotes around the arguments.'
        return get_chat_completion(
            model=llm_config.model,
            messages=messages,
            functions=functions,
            functions_python=functions_python,
            function_call=function_call,
            context_window=llm_config.context_window,
            endpoint=llm_config.model_endpoint,
            endpoint_type=llm_config.model_endpoint_type,
            wrapper=llm_config.model_wrapper,
            user=str(user_id),
            # hint
            first_message=first_message,
            # auth-related
            auth_type=model_settings.openllm_auth_type,
            auth_key=model_settings.openllm_api_key,
        )
