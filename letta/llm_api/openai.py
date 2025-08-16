import warnings
from typing import Generator, List, Optional, Union

import httpx
import requests
from openai import OpenAI

from letta.constants import LETTA_MODEL_ENDPOINT
from letta.errors import ErrorCode, LLMAuthenticationError, LLMError
from letta.helpers.datetime_helpers import timestamp_to_datetime
from letta.llm_api.helpers import add_inner_thoughts_to_functions, convert_to_structured_output, make_post_request
from letta.llm_api.openai_client import (
    accepts_developer_role,
    requires_auto_tool_choice,
    supports_parallel_tool_calling,
    supports_structured_output,
    supports_temperature_param,
)
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_DESCRIPTION, INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST
from letta.local_llm.utils import num_tokens_from_functions, num_tokens_from_messages
from letta.log import get_logger
from letta.otel.tracing import log_event
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message as _Message
from letta.schemas.message import MessageRole as _MessageRole
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.openai.chat_completion_request import FunctionCall as ToolFunctionChoiceFunctionCall
from letta.schemas.openai.chat_completion_request import FunctionSchema, Tool, ToolFunctionChoice, cast_message_to_subtype
from letta.schemas.openai.chat_completion_response import (
    ChatCompletionChunkResponse,
    ChatCompletionResponse,
    Choice,
    FunctionCall,
    Message,
    ToolCall,
    UsageStatistics,
)
from letta.schemas.openai.embedding_response import EmbeddingResponse
from letta.streaming_interface import AgentChunkStreamingInterface, AgentRefreshStreamingInterface
from letta.utils import get_tool_call_id, smart_urljoin

logger = get_logger(__name__)


# TODO: MOVE THIS TO OPENAI_CLIENT
def openai_check_valid_api_key(base_url: str, api_key: Union[str, None]) -> None:
    if api_key:
        try:
            # just get model list to check if the api key is valid until we find a cheaper / quicker endpoint
            openai_get_model_list(url=base_url, api_key=api_key)
        except requests.HTTPError as e:
            if e.response.status_code == 401:
                raise LLMAuthenticationError(message=f"Failed to authenticate with OpenAI: {e}", code=ErrorCode.UNAUTHENTICATED)
            raise e
        except Exception as e:
            raise LLMError(message=f"{e}", code=ErrorCode.INTERNAL_SERVER_ERROR)
    else:
        raise ValueError("No API key provided")


def openai_get_model_list(url: str, api_key: Optional[str] = None, fix_url: bool = False, extra_params: Optional[dict] = None) -> dict:
    """https://platform.openai.com/docs/api-reference/models/list"""

    # In some cases we may want to double-check the URL and do basic correction, eg:
    # In Letta config the address for vLLM is w/o a /v1 suffix for simplicity
    # However if we're treating the server as an OpenAI proxy we want the /v1 suffix on our model hit

    import warnings

    warnings.warn("The synchronous version of openai_get_model_list function is deprecated. Use the async one instead.", DeprecationWarning)

    if fix_url:
        if not url.endswith("/v1"):
            url = smart_urljoin(url, "v1")

    url = smart_urljoin(url, "models")

    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["Authorization"] = f"Bearer {api_key}"

    logger.debug(f"Sending request to {url}")
    response = None
    try:
        # TODO add query param "tool" to be true
        response = requests.get(url, headers=headers, params=extra_params)
        response.raise_for_status()  # Raises HTTPError for 4XX/5XX status
        response = response.json()  # convert to dict from string
        logger.debug(f"response = {response}")
        return response
    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        try:
            if response:
                response = response.json()
        except:
            pass
        logger.debug(f"Got HTTPError, exception={http_err}, response={response}")
        raise http_err
    except requests.exceptions.RequestException as req_err:
        # Handle other requests-related errors (e.g., connection error)
        try:
            if response:
                response = response.json()
        except:
            pass
        logger.debug(f"Got RequestException, exception={req_err}, response={response}")
        raise req_err
    except Exception as e:
        # Handle other potential errors
        try:
            if response:
                response = response.json()
        except:
            pass
        logger.debug(f"Got unknown Exception, exception={e}, response={response}")
        raise e


async def openai_get_model_list_async(
    url: str,
    api_key: Optional[str] = None,
    fix_url: bool = False,
    extra_params: Optional[dict] = None,
    client: Optional["httpx.AsyncClient"] = None,
) -> dict:
    """https://platform.openai.com/docs/api-reference/models/list"""

    # In some cases we may want to double-check the URL and do basic correction
    if fix_url and not url.endswith("/v1"):
        url = smart_urljoin(url, "v1")

    url = smart_urljoin(url, "models")

    headers = {"Content-Type": "application/json"}
    if api_key is not None:
        headers["Authorization"] = f"Bearer {api_key}"

    logger.debug(f"Sending request to {url}")

    # Use provided client or create a new one
    close_client = False
    if client is None:
        client = httpx.AsyncClient()
        close_client = True

    try:
        response = await client.get(url, headers=headers, params=extra_params)
        response.raise_for_status()
        result = response.json()
        logger.debug(f"response = {result}")
        return result
    except httpx.HTTPStatusError as http_err:
        # Handle HTTP errors (e.g., response 4XX, 5XX)
        try:
            error_response = http_err.response.json()
        except:
            error_response = {"status_code": http_err.response.status_code, "text": http_err.response.text}
        logger.debug(f"Got HTTPError, exception={http_err}, response={error_response}")
        raise http_err
    except httpx.RequestError as req_err:
        # Handle other httpx-related errors (e.g., connection error)
        logger.debug(f"Got RequestException, exception={req_err}")
        raise req_err
    except Exception as e:
        # Handle other potential errors
        logger.debug(f"Got unknown Exception, exception={e}")
        raise e
    finally:
        if close_client:
            await client.aclose()


def build_openai_chat_completions_request(
    llm_config: LLMConfig,
    messages: List[_Message],
    user_id: Optional[str],
    functions: Optional[list],
    function_call: Optional[str],
    use_tool_naming: bool,
    put_inner_thoughts_first: bool = True,
    use_structured_output: bool = True,
) -> ChatCompletionRequest:
    if functions and llm_config.put_inner_thoughts_in_kwargs:
        # Special case for LM Studio backend since it needs extra guidance to force out the thoughts first
        # TODO(fix)
        inner_thoughts_desc = (
            INNER_THOUGHTS_KWARG_DESCRIPTION_GO_FIRST if ":1234" in llm_config.model_endpoint else INNER_THOUGHTS_KWARG_DESCRIPTION
        )
        functions = add_inner_thoughts_to_functions(
            functions=functions,
            inner_thoughts_key=INNER_THOUGHTS_KWARG,
            inner_thoughts_description=inner_thoughts_desc,
            put_inner_thoughts_first=put_inner_thoughts_first,
        )

    use_developer_message = accepts_developer_role(llm_config.model)

    openai_message_list = [
        cast_message_to_subtype(
            m.to_openai_dict(
                put_inner_thoughts_in_kwargs=llm_config.put_inner_thoughts_in_kwargs,
                use_developer_message=use_developer_message,
            )
        )
        for m in messages
    ]

    if llm_config.model:
        model = llm_config.model
    else:
        warnings.warn(f"Model type not set in llm_config: {llm_config.model_dump_json(indent=4)}")
        model = None

    if use_tool_naming:
        if function_call is None:
            tool_choice = None
        elif function_call not in ["none", "auto", "required"]:
            tool_choice = ToolFunctionChoice(type="function", function=ToolFunctionChoiceFunctionCall(name=function_call))
        else:
            if requires_auto_tool_choice(llm_config):
                tool_choice = "auto"
            else:
                tool_choice = function_call
        data = ChatCompletionRequest(
            model=model,
            messages=openai_message_list,
            tools=[Tool(type="function", function=f) for f in functions] if functions else None,
            tool_choice=tool_choice,
            user=str(user_id),
            max_completion_tokens=llm_config.max_tokens,
            temperature=llm_config.temperature if supports_temperature_param(model) else 1.0,
            reasoning_effort=llm_config.reasoning_effort,
        )
    else:
        data = ChatCompletionRequest(
            model=model,
            messages=openai_message_list,
            functions=functions,
            function_call=function_call,
            user=str(user_id),
            max_completion_tokens=llm_config.max_tokens,
            temperature=llm_config.temperature if supports_temperature_param(model) else 1.0,
            reasoning_effort=llm_config.reasoning_effort,
        )
        # https://platform.openai.com/docs/guides/text-generation/json-mode
        # only supported by gpt-4o, gpt-4-turbo, or gpt-3.5-turbo
        # if "gpt-4o" in llm_config.model or "gpt-4-turbo" in llm_config.model or "gpt-3.5-turbo" in llm_config.model:
        # data.response_format = {"type": "json_object"}

    # always set user id for openai requests
    if user_id:
        data.user = str(user_id)

    if llm_config.model_endpoint == LETTA_MODEL_ENDPOINT:
        if not user_id:
            # override user id for inference.letta.com
            import uuid

            data.user = str(uuid.UUID(int=0))

        data.model = "memgpt-openai"

    if use_structured_output and data.tools is not None and len(data.tools) > 0:
        # Convert to structured output style (which has 'strict' and no optionals)
        for tool in data.tools:
            if supports_structured_output(llm_config):
                try:
                    # tool["function"] = convert_to_structured_output(tool["function"])
                    structured_output_version = convert_to_structured_output(tool.function.model_dump())
                    tool.function = FunctionSchema(**structured_output_version)
                except ValueError as e:
                    warnings.warn(f"Failed to convert tool function to structured output, tool={tool}, error={e}")
    return data


def openai_chat_completions_process_stream(
    url: str,
    api_key: str,
    chat_completion_request: ChatCompletionRequest,
    stream_interface: Optional[Union[AgentChunkStreamingInterface, AgentRefreshStreamingInterface]] = None,
    create_message_id: bool = True,
    create_message_datetime: bool = True,
    override_tool_call_id: bool = True,
    # if we expect reasoning content in the response,
    # then we should emit reasoning_content as "inner_thoughts"
    # however, we don't necessarily want to put these
    # expect_reasoning_content: bool = False,
    expect_reasoning_content: bool = True,
    name: Optional[str] = None,
) -> ChatCompletionResponse:
    """Process a streaming completion response, and return a ChatCompletionResponse at the end.

    To "stream" the response in Letta, we want to call a streaming-compatible interface function
    on the chunks received from the OpenAI-compatible server POST SSE response.
    """
    assert chat_completion_request.stream == True
    assert stream_interface is not None, "Required"

    # Count the prompt tokens
    # TODO move to post-request?
    chat_history = [m.model_dump(exclude_none=True) for m in chat_completion_request.messages]
    # print(chat_history)

    prompt_tokens = num_tokens_from_messages(
        messages=chat_history,
        model=chat_completion_request.model,
    )
    # We also need to add the cost of including the functions list to the input prompt
    if chat_completion_request.tools is not None:
        assert chat_completion_request.functions is None
        prompt_tokens += num_tokens_from_functions(
            functions=[t.function.model_dump() for t in chat_completion_request.tools],
            model=chat_completion_request.model,
        )
    elif chat_completion_request.functions is not None:
        assert chat_completion_request.tools is None
        prompt_tokens += num_tokens_from_functions(
            functions=[f.model_dump() for f in chat_completion_request.functions],
            model=chat_completion_request.model,
        )

    # Create a dummy Message object to get an ID and date
    # TODO(sarah): add message ID generation function
    dummy_message = _Message(
        role=_MessageRole.assistant,
        content=[],
        agent_id="",
        model="",
        name=None,
        tool_calls=None,
        tool_call_id=None,
    )

    TEMP_STREAM_RESPONSE_ID = "temp_id"
    TEMP_STREAM_FINISH_REASON = "temp_null"
    TEMP_STREAM_TOOL_CALL_ID = "temp_id"
    chat_completion_response = ChatCompletionResponse(
        id=dummy_message.id if create_message_id else TEMP_STREAM_RESPONSE_ID,
        choices=[],
        created=int(dummy_message.created_at.timestamp()),  # NOTE: doesn't matter since both will do get_utc_time()
        model=chat_completion_request.model,
        usage=UsageStatistics(
            completion_tokens=0,
            prompt_tokens=prompt_tokens,
            total_tokens=prompt_tokens,
        ),
    )

    log_event(name="llm_request_sent", attributes=chat_completion_request.model_dump())

    if stream_interface:
        stream_interface.stream_start()

    n_chunks = 0  # approx == n_tokens
    chunk_idx = 0
    prev_message_type = None
    message_idx = 0
    try:
        for chat_completion_chunk in openai_chat_completions_request_stream(
            url=url, api_key=api_key, chat_completion_request=chat_completion_request
        ):
            assert isinstance(chat_completion_chunk, ChatCompletionChunkResponse), type(chat_completion_chunk)
            if chat_completion_chunk.choices is None or len(chat_completion_chunk.choices) == 0:
                warnings.warn(f"No choices in chunk: {chat_completion_chunk}")
                continue

            # NOTE: this assumes that the tool call ID will only appear in one of the chunks during the stream
            if override_tool_call_id:
                for choice in chat_completion_chunk.choices:
                    if choice.delta.tool_calls and len(choice.delta.tool_calls) > 0:
                        for tool_call in choice.delta.tool_calls:
                            if tool_call.id is not None:
                                tool_call.id = get_tool_call_id()

            if stream_interface:
                if isinstance(stream_interface, AgentChunkStreamingInterface):
                    message_type = stream_interface.process_chunk(
                        chat_completion_chunk,
                        message_id=chat_completion_response.id if create_message_id else chat_completion_chunk.id,
                        message_date=(
                            timestamp_to_datetime(chat_completion_response.created)
                            if create_message_datetime
                            else timestamp_to_datetime(chat_completion_chunk.created)
                        ),
                        expect_reasoning_content=expect_reasoning_content,
                        name=name,
                        message_index=message_idx,
                        prev_message_type=prev_message_type,
                    )
                    if message_type != prev_message_type and message_type is not None and prev_message_type is not None:
                        message_idx += 1
                    if message_type is not None:
                        prev_message_type = message_type
                elif isinstance(stream_interface, AgentRefreshStreamingInterface):
                    stream_interface.process_refresh(chat_completion_response)
                else:
                    raise TypeError(stream_interface)

            if chunk_idx == 0:
                # initialize the choice objects which we will increment with the deltas
                num_choices = len(chat_completion_chunk.choices)
                assert num_choices > 0
                chat_completion_response.choices = [
                    Choice(
                        finish_reason=TEMP_STREAM_FINISH_REASON,  # NOTE: needs to be ovrerwritten
                        index=i,
                        message=Message(
                            role="assistant",
                        ),
                    )
                    for i in range(len(chat_completion_chunk.choices))
                ]

            # add the choice delta
            assert len(chat_completion_chunk.choices) == len(chat_completion_response.choices), chat_completion_chunk
            for chunk_choice in chat_completion_chunk.choices:
                if chunk_choice.finish_reason is not None:
                    chat_completion_response.choices[chunk_choice.index].finish_reason = chunk_choice.finish_reason

                if chunk_choice.logprobs is not None:
                    chat_completion_response.choices[chunk_choice.index].logprobs = chunk_choice.logprobs

                accum_message = chat_completion_response.choices[chunk_choice.index].message
                message_delta = chunk_choice.delta

                if message_delta.content is not None:
                    content_delta = message_delta.content
                    if accum_message.content is None:
                        accum_message.content = content_delta
                    else:
                        accum_message.content += content_delta

                if expect_reasoning_content and message_delta.reasoning_content is not None:
                    reasoning_content_delta = message_delta.reasoning_content
                    if accum_message.reasoning_content is None:
                        accum_message.reasoning_content = reasoning_content_delta
                    else:
                        accum_message.reasoning_content += reasoning_content_delta

                # TODO(charles) make sure this works for parallel tool calling?
                if message_delta.tool_calls is not None:
                    tool_calls_delta = message_delta.tool_calls

                    # If this is the first tool call showing up in a chunk, initialize the list with it
                    if accum_message.tool_calls is None:
                        accum_message.tool_calls = [
                            ToolCall(id=TEMP_STREAM_TOOL_CALL_ID, function=FunctionCall(name="", arguments=""))
                            for _ in range(len(tool_calls_delta))
                        ]

                    # There may be many tool calls in a tool calls delta (e.g. parallel tool calls)
                    for tool_call_delta in tool_calls_delta:
                        if tool_call_delta.id is not None:
                            # TODO assert that we're not overwriting?
                            # TODO += instead of =?
                            try:
                                accum_message.tool_calls[tool_call_delta.index].id = tool_call_delta.id
                            except IndexError:
                                warnings.warn(
                                    f"Tool call index out of range ({tool_call_delta.index})\ncurrent tool calls: {accum_message.tool_calls}\ncurrent delta: {tool_call_delta}"
                                )
                                # force index 0
                                # accum_message.tool_calls[0].id = tool_call_delta.id
                            else:
                                accum_message.tool_calls[tool_call_delta.index].id = tool_call_delta.id
                        if tool_call_delta.function is not None:
                            if tool_call_delta.function.name is not None:
                                try:
                                    accum_message.tool_calls[
                                        tool_call_delta.index
                                    ].function.name += tool_call_delta.function.name  # TODO check for parallel tool calls
                                except IndexError:
                                    warnings.warn(
                                        f"Tool call index out of range ({tool_call_delta.index})\ncurrent tool calls: {accum_message.tool_calls}\ncurrent delta: {tool_call_delta}"
                                    )
                            if tool_call_delta.function.arguments is not None:
                                try:
                                    accum_message.tool_calls[tool_call_delta.index].function.arguments += tool_call_delta.function.arguments
                                except IndexError:
                                    warnings.warn(
                                        f"Tool call index out of range ({tool_call_delta.index})\ncurrent tool calls: {accum_message.tool_calls}\ncurrent delta: {tool_call_delta}"
                                    )

                if message_delta.function_call is not None:
                    raise NotImplementedError("Old function_call style not support with stream=True")

            # overwrite response fields based on latest chunk
            if not create_message_id:
                chat_completion_response.id = chat_completion_chunk.id
            if not create_message_datetime:
                chat_completion_response.created = chat_completion_chunk.created
            chat_completion_response.model = chat_completion_chunk.model
            chat_completion_response.system_fingerprint = chat_completion_chunk.system_fingerprint

            # increment chunk counter
            n_chunks += 1
            chunk_idx += 1

    except Exception as e:
        if stream_interface:
            stream_interface.stream_end()
        import traceback

        traceback.print_exc()
        logger.error(f"Parsing ChatCompletion stream failed with error:\n{str(e)}")
        raise e
    finally:
        logger.info("Finally ending streaming interface.")
        if stream_interface:
            stream_interface.stream_end()

    # make sure we didn't leave temp stuff in
    assert all([c.finish_reason != TEMP_STREAM_FINISH_REASON for c in chat_completion_response.choices])
    assert all(
        [
            all([tc.id != TEMP_STREAM_TOOL_CALL_ID for tc in c.message.tool_calls]) if c.message.tool_calls else True
            for c in chat_completion_response.choices
        ]
    )
    if not create_message_id:
        assert chat_completion_response.id != dummy_message.id

    # compute token usage before returning
    # TODO try actually computing the #tokens instead of assuming the chunks is the same
    chat_completion_response.usage.completion_tokens = n_chunks
    chat_completion_response.usage.total_tokens = prompt_tokens + n_chunks

    assert len(chat_completion_response.choices) > 0, f"No response from provider {chat_completion_response}"

    log_event(name="llm_response_received", attributes=chat_completion_response.model_dump())
    return chat_completion_response


def openai_chat_completions_request_stream(
    url: str,
    api_key: str,
    chat_completion_request: ChatCompletionRequest,
    fix_url: bool = False,
) -> Generator[ChatCompletionChunkResponse, None, None]:
    # In some cases we may want to double-check the URL and do basic correction, eg:
    # In Letta config the address for vLLM is w/o a /v1 suffix for simplicity
    # However if we're treating the server as an OpenAI proxy we want the /v1 suffix on our model hit
    if fix_url:
        if not url.endswith("/v1"):
            url = smart_urljoin(url, "v1")

    data = prepare_openai_payload(chat_completion_request)
    data["stream"] = True
    client = OpenAI(api_key=api_key, base_url=url, max_retries=0)
    try:
        stream = client.chat.completions.create(**data)
        for chunk in stream:
            # TODO: Use the native OpenAI objects here?
            yield ChatCompletionChunkResponse(**chunk.model_dump(exclude_none=True))
    except Exception as e:
        print(f"Error request stream from /v1/chat/completions, url={url}, data={data}:\n{e}")
        raise e


def openai_chat_completions_request(
    url: str,
    api_key: str,
    chat_completion_request: ChatCompletionRequest,
) -> ChatCompletionResponse:
    """Send a ChatCompletion request to an OpenAI-compatible server

    If request.stream == True, will yield ChatCompletionChunkResponses
    If request.stream == False, will return a ChatCompletionResponse

    https://platform.openai.com/docs/guides/text-generation?lang=curl
    """
    data = prepare_openai_payload(chat_completion_request)
    client = OpenAI(api_key=api_key, base_url=url, max_retries=0)
    log_event(name="llm_request_sent", attributes=data)
    chat_completion = client.chat.completions.create(**data)
    log_event(name="llm_response_received", attributes=chat_completion.model_dump())
    return ChatCompletionResponse(**chat_completion.model_dump())


def openai_embeddings_request(url: str, api_key: str, data: dict) -> EmbeddingResponse:
    """https://platform.openai.com/docs/api-reference/embeddings/create"""

    url = smart_urljoin(url, "embeddings")
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    response_json = make_post_request(url, headers, data)
    return EmbeddingResponse(**response_json)


def prepare_openai_payload(chat_completion_request: ChatCompletionRequest):
    data = chat_completion_request.model_dump(exclude_none=True)

    # add check otherwise will cause error: "Invalid value for 'parallel_tool_calls': 'parallel_tool_calls' is only allowed when 'tools' are specified."
    if chat_completion_request.tools is not None:
        data["parallel_tool_calls"] = False

    # If functions == None, strip from the payload
    if "functions" in data and data["functions"] is None:
        data.pop("functions")
        data.pop("function_call", None)  # extra safe,  should exist always (default="auto")

    if "tools" in data and data["tools"] is None:
        data.pop("tools")
        data.pop("tool_choice", None)  # extra safe,  should exist always (default="auto")

    # # NOTE: move this out to wherever the ChatCompletionRequest is created
    # if "tools" in data:
    #     for tool in data["tools"]:
    #         try:
    #             tool["function"] = convert_to_structured_output(tool["function"])
    #         except ValueError as e:
    #             warnings.warn(f"Failed to convert tool function to structured output, tool={tool}, error={e}")

    if not supports_parallel_tool_calling(chat_completion_request.model):
        data.pop("parallel_tool_calls", None)

    return data
