import asyncio
import json
import os
import uuid
import warnings
from enum import Enum
from typing import TYPE_CHECKING, AsyncGenerator, Dict, Iterable, List, Optional, Union, cast

from fastapi import Header, HTTPException
from openai.types.chat import ChatCompletionMessageParam
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from openai.types.chat.chat_completion_message_tool_call import Function as OpenAIFunction
from openai.types.chat.completion_create_params import CompletionCreateParams
from pydantic import BaseModel

from letta.constants import (
    DEFAULT_MESSAGE_TOOL,
    DEFAULT_MESSAGE_TOOL_KWARG,
    FUNC_FAILED_HEARTBEAT_MESSAGE,
    REQ_HEARTBEAT_MESSAGE,
    REQUEST_HEARTBEAT_PARAM,
)
from letta.errors import ContextWindowExceededError, RateLimitExceededError
from letta.helpers.datetime_helpers import get_utc_time, get_utc_timestamp_ns, ns_to_ms
from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.otel.tracing import tracer
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate, ToolReturn
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.interface import StreamingServerInterface
from letta.system import get_heartbeat, package_function_response

if TYPE_CHECKING:
    from letta.server.server import SyncServer


SSE_PREFIX = "data: "
SSE_SUFFIX = "\n\n"
SSE_FINISH_MSG = "[DONE]"  # mimic openai
SSE_ARTIFICIAL_DELAY = 0.1


logger = get_logger(__name__)


def sse_formatter(data: Union[dict, str]) -> str:
    """Prefix with 'data: ', and always include double newlines"""
    assert type(data) in [dict, str], f"Expected type dict or str, got type {type(data)}"
    data_str = json.dumps(data, separators=(",", ":")) if isinstance(data, dict) else data
    # print(f"data: {data_str}\n\n")
    return f"data: {data_str}\n\n"


async def sse_async_generator(
    generator: AsyncGenerator,
    usage_task: Optional[asyncio.Task] = None,
    finish_message=True,
    request_start_timestamp_ns: Optional[int] = None,
    llm_config: Optional[LLMConfig] = None,
):
    """
    Wraps a generator for use in Server-Sent Events (SSE), handling errors and ensuring a completion message.

    Args:
    - generator: An asynchronous generator yielding data chunks.
    - usage_task: Optional task that will return usage statistics.
    - finish_message: Whether to send a completion message.
    - request_start_timestamp_ns: Optional ns timestamp when the request started, used to measure time to first token.

    Yields:
    - Formatted Server-Sent Event strings.
    """
    first_chunk = True
    ttft_span = None
    if request_start_timestamp_ns is not None:
        ttft_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
        ttft_span.set_attributes({f"llm_config.{k}": v for k, v in llm_config.model_dump().items() if v is not None})

    try:
        async for chunk in generator:
            # Measure time to first token
            if first_chunk and ttft_span is not None:
                now = get_utc_timestamp_ns()
                ttft_ns = now - request_start_timestamp_ns
                ttft_span.add_event(name="time_to_first_token_ms", attributes={"ttft_ms": ns_to_ms(ttft_ns)})
                ttft_span.end()
                metric_attributes = get_ctx_attributes()
                if llm_config:
                    metric_attributes["model.name"] = llm_config.model
                MetricRegistry().ttft_ms_histogram.record(ns_to_ms(ttft_ns), metric_attributes)
                first_chunk = False

            # yield f"data: {json.dumps(chunk)}\n\n"
            if isinstance(chunk, BaseModel):
                chunk = chunk.model_dump()
            elif isinstance(chunk, Enum):
                chunk = str(chunk.value)
            elif not isinstance(chunk, dict):
                chunk = str(chunk)
            yield sse_formatter(chunk)

        # If we have a usage task, wait for it and send its result
        if usage_task is not None:
            try:
                usage = await usage_task
                # Double-check the type
                if not isinstance(usage, LettaUsageStatistics):
                    err_msg = f"Expected LettaUsageStatistics, got {type(usage)}"
                    logger.error(err_msg)
                    raise ValueError(err_msg)
                yield sse_formatter(usage.model_dump(exclude={"steps_messages"}))

            except ContextWindowExceededError as e:
                log_error_to_sentry(e)
                logger.error(f"ContextWindowExceededError error: {e}")
                yield sse_formatter({"error": f"Stream failed: {e}", "code": str(e.code.value) if e.code else None})

            except RateLimitExceededError as e:
                log_error_to_sentry(e)
                logger.error(f"RateLimitExceededError error: {e}")
                yield sse_formatter({"error": f"Stream failed: {e}", "code": str(e.code.value) if e.code else None})

            except Exception as e:
                log_error_to_sentry(e)
                logger.error(f"Caught unexpected Exception: {e}")
                yield sse_formatter({"error": f"Stream failed (internal error occurred)"})

    except Exception as e:
        log_error_to_sentry(e)
        logger.error(f"Caught unexpected Exception: {e}")
        yield sse_formatter({"error": "Stream failed (decoder encountered an error)"})

    finally:
        if finish_message:
            # Signal that the stream is complete
            yield sse_formatter(SSE_FINISH_MSG)


# TODO: why does this double up the interface?
def get_letta_server() -> "SyncServer":
    # Check if a global server is already instantiated
    from letta.server.rest_api.app import server

    # assert isinstance(server, SyncServer)
    return server


# Dependency to get user_id from headers
def get_user_id(user_id: Optional[str] = Header(None, alias="user_id")) -> Optional[str]:
    return user_id


def get_current_interface() -> StreamingServerInterface:
    return StreamingServerInterface


def log_error_to_sentry(e):
    import traceback

    traceback.print_exc()
    warnings.warn(f"SSE stream generator failed: {e}")

    # Log the error, since the exception handler upstack (in FastAPI) won't catch it, because this may be a 200 response
    # Print the stack trace
    if (os.getenv("SENTRY_DSN") is not None) and (os.getenv("SENTRY_DSN") != ""):
        import sentry_sdk

        sentry_sdk.capture_exception(e)


def create_input_messages(input_messages: List[MessageCreate], agent_id: str, timezone: str, actor: User) -> List[Message]:
    """
    Converts a user input message into the internal structured format.

    TODO (cliandy): this effectively duplicates the functionality of `convert_message_creates_to_messages`,
    we should unify this when it's clear what message attributes we need.
    """

    messages = convert_message_creates_to_messages(input_messages, agent_id, timezone, wrap_user_message=False, wrap_system_message=False)
    for message in messages:
        message.organization_id = actor.organization_id
    return messages


def create_letta_messages_from_llm_response(
    agent_id: str,
    model: str,
    function_name: str,
    function_arguments: Dict,
    tool_execution_result: ToolExecutionResult,
    tool_call_id: str,
    function_call_success: bool,
    function_response: Optional[str],
    timezone: str,
    actor: User,
    continue_stepping: bool = False,
    heartbeat_reason: Optional[str] = None,
    reasoning_content: Optional[List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent]]] = None,
    pre_computed_assistant_message_id: Optional[str] = None,
    llm_batch_item_id: Optional[str] = None,
    step_id: str | None = None,
) -> List[Message]:
    messages = []
    # Construct the tool call with the assistant's message
    # Force set request_heartbeat in tool_args to calculated continue_stepping
    function_arguments[REQUEST_HEARTBEAT_PARAM] = continue_stepping
    tool_call = OpenAIToolCall(
        id=tool_call_id,
        function=OpenAIFunction(
            name=function_name,
            arguments=json.dumps(function_arguments),
        ),
        type="function",
    )
    # TODO: Use ToolCallContent instead of tool_calls
    # TODO: This helps preserve ordering
    assistant_message = Message(
        role=MessageRole.assistant,
        content=reasoning_content if reasoning_content else [],
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=model,
        tool_calls=[tool_call],
        tool_call_id=tool_call_id,
        created_at=get_utc_time(),
        batch_item_id=llm_batch_item_id,
    )
    if pre_computed_assistant_message_id:
        assistant_message.id = pre_computed_assistant_message_id
    messages.append(assistant_message)

    # TODO: Use ToolReturnContent instead of TextContent
    # TODO: This helps preserve ordering
    tool_message = Message(
        role=MessageRole.tool,
        content=[TextContent(text=package_function_response(function_call_success, function_response, timezone))],
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=model,
        tool_calls=[],
        tool_call_id=tool_call_id,
        created_at=get_utc_time(),
        name=function_name,
        batch_item_id=llm_batch_item_id,
        tool_returns=[
            ToolReturn(
                status=tool_execution_result.status,
                stderr=tool_execution_result.stderr,
                stdout=tool_execution_result.stdout,
                # func_return=tool_execution_result.func_return,
            )
        ],
    )
    messages.append(tool_message)

    if continue_stepping:
        heartbeat_system_message = create_heartbeat_system_message(
            agent_id=agent_id,
            model=model,
            function_call_success=function_call_success,
            actor=actor,
            timezone=timezone,
            heartbeat_reason=heartbeat_reason,
        )
        messages.append(heartbeat_system_message)

    for message in messages:
        message.step_id = step_id

    return messages


def create_heartbeat_system_message(
    agent_id: str,
    model: str,
    function_call_success: bool,
    timezone: str,
    actor: User,
    llm_batch_item_id: Optional[str] = None,
    heartbeat_reason: Optional[str] = None,
) -> Message:
    if heartbeat_reason:
        text_content = heartbeat_reason
    else:
        text_content = REQ_HEARTBEAT_MESSAGE if function_call_success else FUNC_FAILED_HEARTBEAT_MESSAGE

    heartbeat_system_message = Message(
        role=MessageRole.user,
        content=[TextContent(text=get_heartbeat(timezone, text_content))],
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=model,
        tool_calls=[],
        tool_call_id=None,
        created_at=get_utc_time(),
        batch_item_id=llm_batch_item_id,
    )
    return heartbeat_system_message


def create_assistant_messages_from_openai_response(
    response_text: str,
    agent_id: str,
    model: str,
    actor: User,
    timezone: str,
) -> List[Message]:
    """
    Converts an OpenAI response into Messages that follow the internal
    paradigm where LLM responses are structured as tool calls instead of content.
    """
    tool_call_id = str(uuid.uuid4())

    return create_letta_messages_from_llm_response(
        agent_id=agent_id,
        model=model,
        function_name=DEFAULT_MESSAGE_TOOL,
        function_arguments={DEFAULT_MESSAGE_TOOL_KWARG: response_text},  # Avoid raw string manipulation
        tool_execution_result=ToolExecutionResult(status="success"),
        tool_call_id=tool_call_id,
        function_call_success=True,
        function_response=None,
        timezone=timezone,
        actor=actor,
        continue_stepping=False,
    )


def convert_in_context_letta_messages_to_openai(in_context_messages: List[Message], exclude_system_messages: bool = False) -> List[dict]:
    """
    Flattens Letta's messages (with system, user, assistant, tool roles, etc.)
    into standard OpenAI chat messages (system, user, assistant).

    Transformation rules:
      1. Assistant + send_message tool_call => content = tool_call's "message"
      2. Tool (role=tool) referencing send_message => skip
      3. User messages might store actual text inside JSON => parse that into content
      4. System => pass through as normal
    """
    # Always include the system prompt
    # TODO: This is brittle
    openai_messages = [in_context_messages[0].to_openai_dict()]

    for msg in in_context_messages[1:]:
        if msg.role == MessageRole.system and exclude_system_messages:
            # Skip if exclude_system_messages is set to True
            continue

        # 1. Assistant + 'send_message' tool_calls => flatten
        if msg.role == MessageRole.assistant and msg.tool_calls:
            # Find any 'send_message' tool_calls
            send_message_calls = [tc for tc in msg.tool_calls if tc.function.name == "send_message"]
            if send_message_calls:
                # If we have multiple calls, just pick the first or merge them
                # Typically there's only one.
                tc = send_message_calls[0]
                arguments = json.loads(tc.function.arguments)
                # Extract the "message" string
                extracted_text = arguments.get("message", "")

                # Create a new content with the extracted text
                msg = Message(
                    id=msg.id,
                    role=msg.role,
                    content=[TextContent(text=extracted_text)],
                    organization_id=msg.organization_id,
                    agent_id=msg.agent_id,
                    model=msg.model,
                    name=msg.name,
                    tool_calls=None,  # no longer needed
                    tool_call_id=None,
                    created_at=msg.created_at,
                )

        # 2. If role=tool and it's referencing send_message => skip
        if msg.role == MessageRole.tool and msg.name == "send_message":
            # Usually 'tool' messages with `send_message` are just status/OK messages
            # that OpenAI doesn't need to see. So skip them.
            continue

        # 3. User messages might store text in JSON => parse it
        if msg.role == MessageRole.user:
            # Example: content=[TextContent(text='{"type": "user_message","message":"Hello"}')]
            # Attempt to parse JSON and extract "message"
            if msg.content and msg.content[0].text.strip().startswith("{"):
                try:
                    parsed = json.loads(msg.content[0].text)
                    # If there's a "message" field, use that as the content
                    if "message" in parsed:
                        actual_user_text = parsed["message"]
                        msg = Message(
                            id=msg.id,
                            role=msg.role,
                            content=[TextContent(text=actual_user_text)],
                            organization_id=msg.organization_id,
                            agent_id=msg.agent_id,
                            model=msg.model,
                            name=msg.name,
                            tool_calls=msg.tool_calls,
                            tool_call_id=msg.tool_call_id,
                            created_at=msg.created_at,
                        )
                except json.JSONDecodeError:
                    pass  # It's not JSON, leave as-is

        # Finally, convert to dict using your existing method
        openai_messages.append(msg.to_openai_dict())

    return openai_messages


def get_user_message_from_chat_completions_request(completion_request: CompletionCreateParams) -> List[MessageCreate]:
    try:
        messages = list(cast(Iterable[ChatCompletionMessageParam], completion_request["messages"]))
    except KeyError:
        # Handle the case where "messages" is not present in the request
        raise HTTPException(status_code=400, detail="The 'messages' field is missing in the request.")
    except TypeError:
        # Handle the case where "messages" is not iterable
        raise HTTPException(status_code=400, detail="The 'messages' field must be an iterable.")
    except Exception as e:
        # Catch any other unexpected errors and include the exception message
        raise HTTPException(status_code=400, detail=f"An error occurred while processing 'messages': {str(e)}")

    if messages[-1]["role"] != "user":
        logger.error(f"The last message does not have a `user` role: {messages}")
        raise HTTPException(status_code=400, detail="'messages[-1].role' must be a 'user'")

    input_message = messages[-1]
    if not isinstance(input_message["content"], str):
        logger.error(f"The input message does not have valid content: {input_message}")
        raise HTTPException(status_code=400, detail="'messages[-1].content' must be a 'string'")

    for message in reversed(messages):
        if message["role"] == "user":
            return [MessageCreate(role=MessageRole.user, content=[TextContent(text=message["content"])])]
