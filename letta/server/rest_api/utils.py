import asyncio
import json
import os
import uuid
from enum import Enum
from typing import Any, AsyncGenerator, Dict, Iterable, List, Optional, Union, cast

from fastapi import Header, HTTPException
from openai.types.chat import ChatCompletionMessageParam
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall, Function as OpenAIFunction
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
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import ToolReturn as LettaToolReturn
from letta.schemas.letta_message_content import (
    OmittedReasoningContent,
    ReasoningContent,
    RedactedReasoningContent,
    SummarizedReasoningContent,
    TextContent,
)
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import ApprovalCreate, Message, MessageCreate, ToolReturn
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.system import get_heartbeat, package_function_response

SENTRY_ENABLED = bool(os.getenv("SENTRY_DSN"))

if SENTRY_ENABLED:
    import sentry_sdk

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
                yield sse_formatter(usage.model_dump())

            except ContextWindowExceededError as e:
                capture_sentry_exception(e)
                logger.error(f"ContextWindowExceededError error: {e}")
                yield sse_formatter({"error": f"Stream failed: {e}", "code": str(e.code.value) if e.code else None})

            except RateLimitExceededError as e:
                capture_sentry_exception(e)
                logger.error(f"RateLimitExceededError error: {e}")
                yield sse_formatter({"error": f"Stream failed: {e}", "code": str(e.code.value) if e.code else None})

            except Exception as e:
                capture_sentry_exception(e)
                logger.error(f"Caught unexpected Exception: {e}")
                yield sse_formatter({"error": "Stream failed (internal error occurred)"})

    except Exception as e:
        capture_sentry_exception(e)
        logger.error(f"Caught unexpected Exception: {e}")
        yield sse_formatter({"error": "Stream failed (decoder encountered an error)"})

    finally:
        if finish_message:
            # Signal that the stream is complete
            yield sse_formatter(SSE_FINISH_MSG)


def capture_sentry_exception(e: BaseException):
    """This will capture the exception in sentry, since the exception handler upstack (in FastAPI) won't catch it, because this may be a 200 response"""
    if SENTRY_ENABLED:
        sentry_sdk.capture_exception(e)


def create_input_messages(input_messages: List[MessageCreate], agent_id: str, timezone: str, run_id: str, actor: User) -> List[Message]:
    """
    Converts a user input message into the internal structured format.

    TODO (cliandy): this effectively duplicates the functionality of `convert_message_creates_to_messages`,
    we should unify this when it's clear what message attributes we need.
    """

    messages = convert_message_creates_to_messages(
        input_messages, agent_id, timezone, run_id, wrap_user_message=False, wrap_system_message=False
    )
    return messages


def create_approval_response_message_from_input(
    agent_state: AgentState, input_message: ApprovalCreate, run_id: Optional[str] = None
) -> List[Message]:
    def maybe_convert_tool_return_message(maybe_tool_return: LettaToolReturn):
        if isinstance(maybe_tool_return, LettaToolReturn):
            packaged_function_response = package_function_response(
                maybe_tool_return.status == "success", maybe_tool_return.tool_return, agent_state.timezone
            )
            return ToolReturn(
                tool_call_id=maybe_tool_return.tool_call_id,
                status=maybe_tool_return.status,
                func_response=packaged_function_response,
                stdout=maybe_tool_return.stdout,
                stderr=maybe_tool_return.stderr,
            )
        return maybe_tool_return

    # Guard against None approvals - treat as empty list to avoid TypeError
    approvals_list = input_message.approvals or []
    if input_message.approvals is None:
        logger.warning(
            "ApprovalCreate.approvals is None; treating as empty list (approval_request_id=%s)",
            getattr(input_message, "approval_request_id", None),
        )

    return [
        Message(
            role=MessageRole.approval,
            agent_id=agent_state.id,
            model=agent_state.llm_config.model,
            approval_request_id=input_message.approval_request_id,
            approve=input_message.approve,
            denial_reason=input_message.reason,
            approvals=[maybe_convert_tool_return_message(approval) for approval in approvals_list],
            run_id=run_id,
            group_id=input_message.group_id
            if input_message.group_id
            else (agent_state.multi_agent_group.id if agent_state.multi_agent_group else None),
        )
    ]


def create_approval_request_message_from_llm_response(
    agent_id: str,
    model: str,
    requested_tool_calls: List[OpenAIToolCall],
    allowed_tool_calls: List[OpenAIToolCall] = [],
    reasoning_content: Optional[List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent]]] = None,
    pre_computed_assistant_message_id: Optional[str] = None,
    step_id: str | None = None,
    run_id: str = None,
) -> Message:
    messages = []
    if allowed_tool_calls:
        oai_tool_calls = [
            OpenAIToolCall(
                id=tool_call.id,
                function=OpenAIFunction(
                    name=tool_call.function.name,
                    arguments=tool_call.function.arguments,
                ),
                type="function",
            )
            for tool_call in allowed_tool_calls
        ]
        tool_message = Message(
            role=MessageRole.assistant,
            content=reasoning_content if reasoning_content else [],
            agent_id=agent_id,
            model=model,
            tool_calls=oai_tool_calls,
            tool_call_id=allowed_tool_calls[0].id,
            created_at=get_utc_time(),
            step_id=step_id,
            run_id=run_id,
        )
        if pre_computed_assistant_message_id:
            tool_message.id = pre_computed_assistant_message_id
        messages.append(tool_message)
    # Construct the tool call with the assistant's message
    oai_tool_calls = [
        OpenAIToolCall(
            id=tool_call.id,
            function=OpenAIFunction(
                name=tool_call.function.name,
                arguments=tool_call.function.arguments,
            ),
            type="function",
        )
        for tool_call in requested_tool_calls
    ]
    # TODO: Use ToolCallContent instead of tool_calls
    # TODO: This helps preserve ordering
    approval_message = Message(
        role=MessageRole.approval,
        content=reasoning_content if reasoning_content and not allowed_tool_calls else [],
        agent_id=agent_id,
        model=model,
        tool_calls=oai_tool_calls,
        tool_call_id=oai_tool_calls[0].id,
        created_at=get_utc_time(),
        step_id=step_id,
        run_id=run_id,
    )
    if pre_computed_assistant_message_id:
        approval_message.id = decrement_message_uuid(pre_computed_assistant_message_id)
    messages.append(approval_message)
    return messages


def decrement_message_uuid(message_id: str):
    message_uuid = uuid.UUID(message_id.split("-", maxsplit=1)[1])
    uuid_as_int = message_uuid.int
    decremented_int = uuid_as_int - 1
    decremented_uuid = uuid.UUID(int=decremented_int)
    return "message-" + str(decremented_uuid)


def create_letta_messages_from_llm_response(
    agent_id: str,
    model: str,
    function_name: Optional[str],
    function_arguments: Optional[Dict],
    tool_execution_result: Optional[ToolExecutionResult],
    tool_call_id: Optional[str],
    function_response: Optional[str],
    timezone: str,
    run_id: str | None = None,
    step_id: str = None,
    continue_stepping: bool = False,
    heartbeat_reason: Optional[str] = None,
    reasoning_content: Optional[
        List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent | SummarizedReasoningContent]]
    ] = None,
    pre_computed_assistant_message_id: Optional[str] = None,
    llm_batch_item_id: Optional[str] = None,
    is_approval_response: bool | None = None,
    # force set request_heartbeat, useful for v2 loop to ensure matching tool rules
    force_set_request_heartbeat: bool = True,
    add_heartbeat_on_continue: bool = True,
) -> List[Message]:
    messages = []
    if not is_approval_response:  # Skip approval responses (omit them)
        if function_name is not None:
            # Construct the tool call with the assistant's message
            # Force set request_heartbeat in tool_args to calculated continue_stepping
            if force_set_request_heartbeat:
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

            # Safeguard against empty text messages
            content = []
            if reasoning_content:
                for content_part in reasoning_content:
                    if isinstance(content_part, TextContent) and content_part.text == "":
                        continue
                    content.append(content_part)

            assistant_message = Message(
                role=MessageRole.assistant,
                content=content,
                agent_id=agent_id,
                model=model,
                tool_calls=[tool_call],
                tool_call_id=tool_call_id,
                created_at=get_utc_time(),
                batch_item_id=llm_batch_item_id,
                run_id=run_id,
            )
        else:
            # Safeguard against empty text messages
            content = []
            if reasoning_content:
                for content_part in reasoning_content:
                    if isinstance(content_part, TextContent) and content_part.text == "":
                        continue
                    content.append(content_part)

            # Should only hit this if using react agents
            if content and len(content) > 0:
                assistant_message = Message(
                    role=MessageRole.assistant,
                    # NOTE: weird that this is called "reasoning_content" here, since it's not
                    content=content,
                    agent_id=agent_id,
                    model=model,
                    tool_calls=None,
                    tool_call_id=None,
                    created_at=get_utc_time(),
                    batch_item_id=llm_batch_item_id,
                    run_id=run_id,
                )
            else:
                assistant_message = None

        if assistant_message:
            if pre_computed_assistant_message_id:
                assistant_message.id = pre_computed_assistant_message_id
            messages.append(assistant_message)

    # TODO: Use ToolReturnContent instead of TextContent
    # TODO: This helps preserve ordering
    if tool_execution_result is not None:
        packaged_function_response = package_function_response(tool_execution_result.success_flag, function_response, timezone)
        tool_message = Message(
            role=MessageRole.tool,
            content=[TextContent(text=packaged_function_response)],
            agent_id=agent_id,
            model=model,
            tool_calls=[],
            tool_call_id=tool_call_id,
            created_at=get_utc_time(),
            name=function_name,
            batch_item_id=llm_batch_item_id,
            tool_returns=[
                ToolReturn(
                    tool_call_id=tool_call_id,
                    status=tool_execution_result.status,
                    stderr=tool_execution_result.stderr,
                    stdout=tool_execution_result.stdout,
                    func_response=packaged_function_response,
                )
            ],
            run_id=run_id,
        )
        messages.append(tool_message)

    if continue_stepping and add_heartbeat_on_continue:
        # TODO skip this for react agents, instead we just force looping
        heartbeat_system_message = create_heartbeat_system_message(
            agent_id=agent_id,
            model=model,
            function_call_success=(tool_execution_result.success_flag if tool_execution_result is not None else True),
            timezone=timezone,
            heartbeat_reason=heartbeat_reason,
            run_id=run_id,
        )
        messages.append(heartbeat_system_message)

    for message in messages:
        message.step_id = step_id

    return messages


def create_parallel_tool_messages_from_llm_response(
    agent_id: str,
    model: str,
    tool_call_specs: List[Dict[str, Any]],  # List of tool call specs: {"name": str, "arguments": Dict, "id": Optional[str]}
    tool_execution_results: List[ToolExecutionResult],
    function_responses: List[Optional[str]],
    timezone: str,
    run_id: Optional[str] = None,
    step_id: Optional[str] = None,
    reasoning_content: Optional[
        List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent | SummarizedReasoningContent]]
    ] = None,
    pre_computed_assistant_message_id: Optional[str] = None,
    llm_batch_item_id: Optional[str] = None,
    is_approval_response: bool = False,
    tool_returns: List[ToolReturn] = [],
) -> List[Message]:
    """
    Build two messages representing a parallel tool-call step:
    - One assistant message with ALL tool_calls populated (tool_call_id left empty)
    - One tool message with ALL tool_returns populated (tool_call_id left empty)

    Notes:
    - Consumers should read tool_calls/tool_returns arrays for per-call details.
    - The tool message's content includes only the first call's packaged response for
      backward-compatibility with legacy renderers. UIs should prefer tool_returns.
    - When invoked for an approval response, the assistant message is omitted (the approval
      tool call was previously surfaced).
    """

    # Construct OpenAI-style tool_calls for the assistant message
    openai_tool_calls: List[OpenAIToolCall] = []
    for spec in tool_call_specs:
        name = spec.get("name")
        args = spec.get("arguments", {})
        call_id = spec.get("id") or str(uuid.uuid4())
        # Ensure the spec carries the resolved id so returns/content can reference it
        if not spec.get("id"):
            spec["id"] = call_id
        openai_tool_calls.append(
            OpenAIToolCall(
                id=call_id,
                function=OpenAIFunction(name=name, arguments=json.dumps(args)),
                type="function",
            )
        )

    messages: List[Message] = []

    if not is_approval_response:
        # Assistant message with all tool_calls (no single tool_call_id)
        # Safeguard against empty text messages
        content: List[
            Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent, SummarizedReasoningContent]
        ] = []
        if reasoning_content:
            for content_part in reasoning_content:
                if isinstance(content_part, TextContent) and content_part.text == "":
                    continue
                content.append(content_part)

        assistant_message = Message(
            role=MessageRole.assistant,
            content=content,
            agent_id=agent_id,
            model=model,
            tool_calls=openai_tool_calls,
            tool_call_id=None,
            created_at=get_utc_time(),
            batch_item_id=llm_batch_item_id,
            run_id=run_id,
        )
        if step_id:
            assistant_message.step_id = step_id
        if pre_computed_assistant_message_id:
            assistant_message.id = pre_computed_assistant_message_id
        messages.append(assistant_message)

    content: List[TextContent] = []
    for spec, exec_result, response in zip(tool_call_specs, tool_execution_results, function_responses):
        packaged = package_function_response(exec_result.success_flag, response, timezone)
        content.append(TextContent(text=packaged))
        tool_returns.append(
            ToolReturn(
                tool_call_id=spec.get("id"),
                status=exec_result.status,
                stdout=exec_result.stdout,
                stderr=exec_result.stderr,
                func_response=packaged,
            )
        )

    tool_message = Message(
        role=MessageRole.tool,
        content=content,
        agent_id=agent_id,
        model=model,
        tool_calls=[],
        tool_call_id=tool_returns[0].tool_call_id,  # For legacy reasons, set to first one
        created_at=get_utc_time(),
        batch_item_id=llm_batch_item_id,
        tool_returns=tool_returns,
        run_id=run_id,
    )
    if step_id:
        tool_message.step_id = step_id

    messages.append(tool_message)
    return messages


def create_heartbeat_system_message(
    agent_id: str,
    model: str,
    function_call_success: bool,
    timezone: str,
    llm_batch_item_id: Optional[str] = None,
    heartbeat_reason: Optional[str] = None,
    run_id: Optional[str] = None,
) -> Message:
    if heartbeat_reason:
        text_content = heartbeat_reason
    else:
        text_content = REQ_HEARTBEAT_MESSAGE if function_call_success else FUNC_FAILED_HEARTBEAT_MESSAGE

    heartbeat_system_message = Message(
        role=MessageRole.user,
        content=[TextContent(text=get_heartbeat(timezone, text_content))],
        agent_id=agent_id,
        model=model,
        tool_calls=[],
        tool_call_id=None,
        created_at=get_utc_time(),
        batch_item_id=llm_batch_item_id,
        run_id=run_id,
    )
    return heartbeat_system_message


def create_assistant_messages_from_openai_response(
    response_text: str,
    agent_id: str,
    model: str,
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
        function_response=None,
        timezone=timezone,
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
        m = msg.to_openai_dict()
        assert m is not None
        openai_messages.append(m)

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
