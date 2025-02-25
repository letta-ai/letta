import asyncio
import json
import uuid
from typing import TYPE_CHECKING, List, Optional, Union

import httpx
import openai
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk, Choice, ChoiceDelta
from openai.types.chat.completion_create_params import CompletionCreateParams
from starlette.concurrency import run_in_threadpool

from letta.agent import Agent
from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, LETTA_TOOL_SET, NON_USER_MSG_PREFIX, PRE_EXECUTION_MESSAGE_ARG
from letta.helpers.tool_execution_helper import (
    add_pre_execution_message,
    enable_strict_mode,
    execute_external_tool,
    remove_request_heartbeat,
)
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_request import (
    AssistantMessage,
    ChatCompletionRequest,
    Tool,
    ToolCall,
    ToolCallFunction,
    ToolMessage,
    UserMessage,
)
from letta.schemas.user import User
from letta.server.rest_api.chat_completions_interface import ChatCompletionsStreamingInterface
from letta.server.rest_api.optimistic_json_parser import OptimisticJSONParser

# TODO this belongs in a controller!
from letta.server.rest_api.utils import (
    convert_letta_messages_to_openai,
    create_assistant_message_from_openai_response,
    create_user_message,
    get_letta_server,
    get_messages_from_completion_request,
    sse_async_generator,
)
from letta.settings import model_settings

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/v1", tags=["chat_completions"])

logger = get_logger(__name__)


@router.post(
    "/fast/chat/completions",
    response_model=None,
    operation_id="create_fast_chat_completions",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def create_fast_chat_completions(
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    actor = server.user_manager.get_user_or_default(user_id=user_id)

    agent_id = str(completion_request.get("user", None))
    if agent_id is None:
        raise HTTPException(status_code=400, detail="Must pass agent_id in the 'user' field")

    agent_state = server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
    if agent_state.llm_config.model_endpoint_type != "openai":
        raise HTTPException(status_code=400, detail="Only OpenAI models are supported by this endpoint.")

    # Convert Letta messages to OpenAI messages
    in_context_messages = server.message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=actor)
    openai_messages = convert_letta_messages_to_openai(in_context_messages)

    # Also parse user input from completion_request and append
    input_message = get_messages_from_completion_request(completion_request)[-1]
    openai_messages.append(input_message)

    # Tools we allow this agent to call
    tools = [t for t in agent_state.tools if t.name not in LETTA_TOOL_SET and t.tool_type in {ToolType.EXTERNAL_COMPOSIO, ToolType.CUSTOM}]

    # Initial request
    openai_request = ChatCompletionRequest(
        model=agent_state.llm_config.model,
        messages=openai_messages,
        # TODO: This nested thing here is so ugly, need to refactor
        tools=(
            [
                Tool(type="function", function=enable_strict_mode(add_pre_execution_message(remove_request_heartbeat(t.json_schema))))
                for t in tools
            ]
            if tools
            else None
        ),
        tool_choice="auto",
        user=user_id,
        max_completion_tokens=agent_state.llm_config.max_tokens,
        temperature=agent_state.llm_config.temperature,
        stream=True,
    )

    # Create the OpenAI async client
    client = openai.AsyncClient(
        api_key=model_settings.openai_api_key,
        max_retries=0,
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(connect=15.0, read=30.0, write=15.0, pool=15.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=50,
                keepalive_expiry=120,
            ),
        ),
    )

    # The messages we want to persist to the Letta agent
    user_message = create_user_message(input_message=input_message, agent_id=agent_id, actor=actor)
    message_db_queue = [user_message]

    async def event_stream():
        """
        A function-calling loop:
          - We stream partial tokens.
          - If we detect a tool call (finish_reason="tool_calls"), we parse it,
            add two messages to the conversation:
              (a) assistant message with tool_calls referencing the same ID
              (b) a tool message referencing that ID, containing the tool result.
          - Re-invoke the OpenAI request with updated conversation, streaming again.
          - End when finish_reason="stop" or no more tool calls.
        """

        # We'll keep updating this conversation in a loop
        conversation = openai_messages[:]

        while True:
            # Make the streaming request to OpenAI
            stream = await client.chat.completions.create(**openai_request.model_dump(exclude_unset=True))

            content_buffer = []
            tool_call_name = None
            tool_call_args_str = ""
            tool_call_id = None
            tool_call_happened = False
            finish_reason_stop = False
            optimistic_json_parser = OptimisticJSONParser(strict=True)
            current_parsed_json_result = {}

            async with stream:
                async for chunk in stream:
                    choice = chunk.choices[0]
                    delta = choice.delta
                    finish_reason = choice.finish_reason  # "tool_calls", "stop", or None

                    if delta.content:
                        content_buffer.append(delta.content)
                        yield f"data: {chunk.model_dump_json()}\n\n"

                    # CASE B: Partial tool call info
                    if delta.tool_calls:
                        # Typically there's only one in delta.tool_calls
                        tc = delta.tool_calls[0]
                        if tc.function.name:
                            tool_call_name = tc.function.name
                        if tc.function.arguments:
                            tool_call_args_str += tc.function.arguments

                            # See if we can stream out the pre-execution message
                            parsed_args = optimistic_json_parser.parse(tool_call_args_str)
                            if parsed_args.get(
                                PRE_EXECUTION_MESSAGE_ARG
                            ) and current_parsed_json_result.get(  # Ensure key exists and is not None/empty
                                PRE_EXECUTION_MESSAGE_ARG
                            ) != parsed_args.get(
                                PRE_EXECUTION_MESSAGE_ARG
                            ):
                                # Only stream if there's something new to stream
                                # We do this way to avoid hanging JSON at the end of the stream, e.g. '}'
                                if parsed_args != current_parsed_json_result:
                                    current_parsed_json_result = parsed_args
                                    synthetic_chunk = ChatCompletionChunk(
                                        id=chunk.id,
                                        object=chunk.object,
                                        created=chunk.created,
                                        model=chunk.model,
                                        choices=[
                                            Choice(
                                                index=choice.index,
                                                delta=ChoiceDelta(content=tc.function.arguments, role="assistant"),
                                                finish_reason=None,
                                            )
                                        ],
                                    )

                                    yield f"data: {synthetic_chunk.model_dump_json()}\n\n"

                        # We might generate a unique ID for the tool call
                        if tc.id:
                            tool_call_id = tc.id

                    # Check finish_reason
                    if finish_reason == "tool_calls":
                        tool_call_happened = True
                        break
                    elif finish_reason == "stop":
                        finish_reason_stop = True
                        break

            if content_buffer:
                # We treat that partial text as an assistant message
                content = "".join(content_buffer)
                conversation.append({"role": "assistant", "content": content})

                # Create an assistant message here to persist later
                assistant_message = create_assistant_message_from_openai_response(
                    response_text=content, agent_id=agent_id, model=agent_state.llm_config.model, actor=actor
                )
                message_db_queue.append(assistant_message)

            if tool_call_happened:
                # Parse the tool call arguments
                try:
                    tool_args = json.loads(tool_call_args_str)
                except json.JSONDecodeError:
                    tool_args = {}

                if not tool_call_id:
                    # If no tool_call_id given by the model, generate one
                    tool_call_id = f"call_{uuid.uuid4().hex[:8]}"

                # 1) Insert the "assistant" message with the tool_calls field
                #    referencing the same tool_call_id
                assistant_tool_call_msg = AssistantMessage(
                    content=None,
                    tool_calls=[ToolCall(id=tool_call_id, function=ToolCallFunction(name=tool_call_name, arguments=tool_call_args_str))],
                )

                conversation.append(assistant_tool_call_msg.model_dump())

                # 2) Execute the tool
                target_tool = next((x for x in tools if x.name == tool_call_name), None)
                if not target_tool:
                    # Tool not found, handle error
                    yield f"data: {json.dumps({'error': 'Tool not found', 'tool': tool_call_name})}\n\n"
                    break

                try:
                    tool_result, _ = execute_external_tool(
                        agent_state=agent_state,
                        function_name=tool_call_name,
                        function_args=tool_args,
                        target_letta_tool=target_tool,
                        actor=actor,
                        allow_agent_state_modifications=False,
                    )
                except Exception as e:
                    tool_result = f"Failed to call tool. Error: {e}"

                # 3) Insert the "tool" message referencing the same tool_call_id
                tool_message = ToolMessage(content=json.dumps({"result": tool_result}), tool_call_id=tool_call_id)

                conversation.append(tool_message.model_dump())

                # 4) Add a user message prompting the tool call result summarization
                heartbeat_user_message = UserMessage(
                    content=f"{NON_USER_MSG_PREFIX} Tool finished executing. Summarize the result for the user.",
                )
                conversation.append(heartbeat_user_message.model_dump())

                # Now, re-invoke OpenAI with the updated conversation
                openai_request.messages = conversation

                continue  # Start the while loop again

            if finish_reason_stop:
                # Model is done, no more calls
                break

            # If we reach here, no tool call, no "stop", but we've ended streaming
            # Possibly a model error or some other finish reason. We'll just end.
            break

        await run_in_threadpool(
            server.agent_manager.append_to_in_context_messages,
            message_db_queue,
            agent_id=agent_id,
            actor=actor,
        )

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post(
    "/chat/completions",
    response_model=None,
    operation_id="create_chat_completions",
    responses={
        200: {
            "description": "Successful response",
            "content": {
                "text/event-stream": {"description": "Server-Sent Events stream"},
            },
        }
    },
)
async def create_chat_completions(
    completion_request: CompletionCreateParams = Body(...),
    server: "SyncServer" = Depends(get_letta_server),
    user_id: Optional[str] = Header(None, alias="user_id"),
):
    # Validate and process fields
    messages = get_messages_from_completion_request(completion_request)
    input_message = messages[-1]

    # Process remaining fields
    if not completion_request["stream"]:
        raise HTTPException(status_code=400, detail="Must be streaming request: `stream` was set to `False` in the request.")

    actor = server.user_manager.get_user_or_default(user_id=user_id)

    agent_id = str(completion_request.get("user", None))
    if agent_id is None:
        error_msg = "Must pass agent_id in the 'user' field"
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    letta_agent = server.load_agent(agent_id=agent_id, actor=actor)
    llm_config = letta_agent.agent_state.llm_config
    if llm_config.model_endpoint_type != "openai" or "inference.memgpt.ai" in llm_config.model_endpoint:
        error_msg = f"You can only use models with type 'openai' for chat completions. This agent {agent_id} has llm_config: \n{llm_config.model_dump_json(indent=4)}"
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    model = completion_request.get("model")
    if model != llm_config.model:
        warning_msg = f"The requested model {model} is different from the model specified in this agent's ({agent_id}) llm_config: \n{llm_config.model_dump_json(indent=4)}"
        logger.warning(f"Defaulting to {llm_config.model}...")
        logger.warning(warning_msg)

    logger.info(f"Received input message: {input_message}")

    return await send_message_to_agent_chat_completions(
        server=server,
        letta_agent=letta_agent,
        actor=actor,
        messages=[MessageCreate(role=input_message["role"], content=input_message["content"])],
    )


async def send_message_to_agent_chat_completions(
    server: "SyncServer",
    letta_agent: Agent,
    actor: User,
    messages: Union[List[Message], List[MessageCreate]],
    assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
    assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
) -> StreamingResponse:
    """Split off into a separate function so that it can be imported in the /chat/completion proxy."""
    # For streaming response
    try:
        # TODO: cleanup this logic
        llm_config = letta_agent.agent_state.llm_config

        # Create a new interface per request
        letta_agent.interface = ChatCompletionsStreamingInterface()
        streaming_interface = letta_agent.interface
        if not isinstance(streaming_interface, ChatCompletionsStreamingInterface):
            raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

        # Allow AssistantMessage is desired by client
        streaming_interface.assistant_message_tool_name = assistant_message_tool_name
        streaming_interface.assistant_message_tool_kwarg = assistant_message_tool_kwarg

        # Related to JSON buffer reader
        streaming_interface.inner_thoughts_in_kwargs = (
            llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
        )

        # Offload the synchronous message_func to a separate thread
        streaming_interface.stream_start()
        asyncio.create_task(
            asyncio.to_thread(
                server.send_messages,
                actor=actor,
                agent_id=letta_agent.agent_state.id,
                messages=messages,
                interface=streaming_interface,
                put_inner_thoughts_first=False,
            )
        )

        # return a stream
        return StreamingResponse(
            sse_async_generator(
                streaming_interface.get_generator(),
                usage_task=None,
                finish_message=True,
            ),
            media_type="text/event-stream",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{e}")
