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

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, FUNC_FAILED_HEARTBEAT_MESSAGE, REQ_HEARTBEAT_MESSAGE
from letta.errors import ContextWindowExceededError, RateLimitExceededError
from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message
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
):
    """
    Wraps a generator for use in Server-Sent Events (SSE), handling errors and ensuring a completion message.

    Args:
    - generator: An asynchronous generator yielding data chunks.

    Yields:
    - Formatted Server-Sent Event strings.
    """
    try:
        async for chunk in generator:
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


def create_user_message(input_message: dict, agent_id: str, actor: User) -> Message:
    """
    Converts a user input message into the internal structured format.
    """
    # Generate timestamp in the correct format
    # Skip pytz for performance reasons
    now = get_utc_time().isoformat()

    # Format message as structured JSON
    structured_message = {"type": "user_message", "message": input_message["content"], "time": now}

    # Construct the Message object
    user_message = Message(
        id=f"message-{uuid.uuid4()}",
        role=MessageRole.user,
        content=[TextContent(text=json.dumps(structured_message, indent=2))],  # Store structured JSON
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=None,
        tool_calls=None,
        tool_call_id=None,
        created_at=get_utc_time(),
    )

    return user_message


def create_tool_call_messages_from_openai_response(
    agent_id: str,
    model: str,
    function_name: str,
    function_arguments: Dict,
    tool_call_id: str,
    function_call_success: bool,
    function_response: Optional[str],
    actor: User,
    add_heartbeat_request_system_message: bool = False,
) -> List[Message]:
    messages = []

    # Construct the tool call with the assistant's message
    function_arguments["request_heartbeat"] = True
    tool_call = OpenAIToolCall(
        id=tool_call_id,
        function=OpenAIFunction(
            name=function_name,
            arguments=json.dumps(function_arguments),
        ),
        type="function",
    )
    assistant_message = Message(
        role=MessageRole.assistant,
        content=[],
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=model,
        tool_calls=[tool_call],
        tool_call_id=tool_call_id,
        created_at=get_utc_time(),
    )
    messages.append(assistant_message)

    tool_message = Message(
        role=MessageRole.tool,
        content=[TextContent(text=package_function_response(function_call_success, function_response))],
        organization_id=actor.organization_id,
        agent_id=agent_id,
        model=model,
        tool_calls=[],
        tool_call_id=tool_call_id,
        created_at=get_utc_time(),
        name=function_name,
    )
    messages.append(tool_message)

    if add_heartbeat_request_system_message:
        text_content = REQ_HEARTBEAT_MESSAGE if function_call_success else FUNC_FAILED_HEARTBEAT_MESSAGE
        heartbeat_system_message = Message(
            role=MessageRole.user,
            content=[TextContent(text=get_heartbeat(text_content))],
            organization_id=actor.organization_id,
            agent_id=agent_id,
            model=model,
            tool_calls=[],
            tool_call_id=None,
            created_at=get_utc_time(),
        )
        messages.append(heartbeat_system_message)

    return messages


def create_assistant_messages_from_openai_response(
    response_text: str,
    agent_id: str,
    model: str,
    actor: User,
) -> List[Message]:
    """
    Converts an OpenAI response into Messages that follow the internal
    paradigm where LLM responses are structured as tool calls instead of content.
    """
    tool_call_id = str(uuid.uuid4())

    return create_tool_call_messages_from_openai_response(
        agent_id=agent_id,
        model=model,
        function_name=DEFAULT_MESSAGE_TOOL,
        function_arguments={DEFAULT_MESSAGE_TOOL_KWARG: response_text},  # Avoid raw string manipulation
        tool_call_id=tool_call_id,
        function_call_success=True,
        function_response=None,
        actor=actor,
        add_heartbeat_request_system_message=False,
    )


def convert_letta_messages_to_openai(messages: List[Message]) -> List[dict]:
    """
    Flattens Letta's messages (with system, user, assistant, tool roles, etc.)
    into standard OpenAI chat messages (system, user, assistant).

    Transformation rules:
      1. Assistant + send_message tool_call => content = tool_call's "message"
      2. Tool (role=tool) referencing send_message => skip
      3. User messages might store actual text inside JSON => parse that into content
      4. System => pass through as normal
    """

    openai_messages = []

    for msg in messages:
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

        # 4. System is left as-is (or any other role that doesn't need special handling)
        #
        # Finally, convert to dict using your existing method
        openai_messages.append(msg.to_openai_dict())

    return openai_messages


def get_messages_from_completion_request(completion_request: CompletionCreateParams) -> List[Dict]:
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

    return messages
