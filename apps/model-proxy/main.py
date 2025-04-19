import os
import json
import uuid
from datetime import datetime
import logging

PUBSUB = True
if PUBSUB:
    from google.cloud import pubsub_v1
from pprint import pprint

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette_prometheus import PrometheusMiddleware, metrics
from typing import Optional, Dict
from memgpt.llm_api.llm_api_tools import create
from memgpt.config import MemGPTConfig  # TODO refactor for 0.2.12
from memgpt.data_types import AgentState, LLMConfig
from memgpt.models.chat_completion_response import ChatCompletionResponse
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, validator, ValidationError
from memgpt.models.chat_completion_request import ChatMessage, ResponseFormat, Tool, ToolChoice, FunctionSchema, FunctionCallChoice, UserMessage, SystemMessage, AssistantMessage, ToolMessage
from memgpt.data_types import Message
from pydantic import BaseModel, Field

from models.models_request import Model
#from models.chat_completion_request import ChatCompletionRequest
#from models.chat_completion_response import ChatCompletionResponse

from validation import validate_request
from policy import route_llm_request

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI()

# Add Prometheus Middleware
app.add_middleware(PrometheusMiddleware)
app.add_route("/metrics/", metrics)

# TODO: remove after 0.3.13
class ChatCompletionRequest(BaseModel):
    """https://platform.openai.com/docs/api-reference/chat/create"""

    model: str
    messages: List[ChatMessage]
    frequency_penalty: Optional[float] = 0
    logit_bias: Optional[Dict[str, int]] = None
    logprobs: Optional[bool] = False
    top_logprobs: Optional[int] = None
    max_tokens: Optional[int] = None
    n: Optional[int] = 1
    presence_penalty: Optional[float] = 0
    response_format: Optional[ResponseFormat] = None
    seed: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    stream: Optional[bool] = False
    temperature: Optional[float] = 1
    top_p: Optional[float] = 1
    user: Optional[str] = None  # unique ID of the end-user (for monitoring)

    # function-calling related
    tools: Optional[List[Tool]] = None
    tool_choice: Optional[ToolChoice] = "none"
    # deprecated scheme
    functions: Optional[List[FunctionSchema]] = None
    function_call: Optional[FunctionCallChoice] = None

    @validator('messages', pre=True, each_item=True)
    def parse_message(cls, value):
        if not isinstance(value, dict):
            raise TypeError("Each message must be a dictionary.")
        role = value.get('role')
        if role == 'system':
            return SystemMessage(**value)
        elif role == 'user':
            return UserMessage(**value)
        elif role == 'assistant':
            return AssistantMessage(**value)
        elif role == 'tool':
            return ToolMessage(**value)
        else:
            raise ValidationError(f"Invalid role for message: {role}")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Construct a detailed error message including the bad input value
    errors = []
    for error in exc.errors():
        field_path = "->".join(map(str, error["loc"]))
        message = error["msg"]
        bad_input = error.get("ctx", {}).get("input")  # Adjust based on the structure of your error context
        errors.append(f"{field_path}: {message}. Bad input: {bad_input}")

    error_summary = "; ".join(errors)
    logging.error(f"Validation error for request to {request.url.path}: {error_summary}")

    # Return a custom response or modify as needed
    return JSONResponse(
        status_code=422,
        content={"message": "Validation error", "details": errors},
    )


class ListModelsResponse(BaseModel):
    data: list[Model]
    object: str = "list"

@app.get("/healthz")
async def health_check():
    """
    Returns 200 OK for Kubernetes probes
    """
    return {"Success": True}

@app.get("/models")
@app.get("/v1/models")
async def get_model_list():
    """NOTE: added this 'dummy' method so that memgpt configure doesn't complain about not being able to retrieve models"""
    models_data = [
        # NOTE: the info here is irrelevant / not used elsewhere, but it will set the config.model value on the client
        Model(
            id="memgpt",
            created=0,
            owned_by="null",
        ),
    ]
    # return models_data
    return ListModelsResponse(data=models_data)


class ProxyLog(BaseModel):
    request: ChatCompletionRequest
    status: int
    llm_config: Optional[Dict] = None
    response: Optional[ChatCompletionResponse] = None
    error: Optional[str] = None


def log_request(
    request: ChatCompletionRequest,
    status: int,
    llm_config: Optional[LLMConfig] = None,
    response: Optional[ChatCompletionResponse] = None,
    error: Optional[str] = None,
):
    if not PUBSUB:
        return None
    log = ProxyLog(
        request=request,
        status=status,
        llm_config=vars(llm_config) if llm_config is not None else None,
        response=response,
        error=error,
    )

    # dump data
    data = log.model_dump_json().encode("utf-8")
    print(f"Logging {app.state.topic_path}, status {status}:", data)

    # publish
    try:
        future = app.state.publisher.publish(app.state.topic_path, data=data)
    except Exception as e:
        print("Logging error", str(e))
        raise e

    return future  # not used


# POST endpoint for chat completions
@app.post("/chat/completions")
@app.post("/v1/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest):
    try:
        validate_request(request)
        request_data = request.model_dump()
    except HTTPException as e:
        error_str = f"HTTPException in request validation: {e}"
        logger.error(error_str)
        log_request(request, 500, error=error_str)
        raise
    except Exception as e:
        error_str = f"HTTPException in request validation: {e}"
        logger.error(error_str)
        log_request(request, 500, error=error_str)
        raise HTTPException(status_code=500, detail="Internal server error (validation)")

    # Determine what LLM backend to forward the request to based on some policy
    try:
        llm_backend_config = route_llm_request(request=request)
    except Exception as e:
        error_str = f"Internal server error (routing): {str(e)}"
        logger.error(error_str)
        log_request(request, 500, error=error_str)
        raise HTTPException(status_code=500, detail=error_str)

    # dummy agent state: unfortunately create() requires entire agent state, even though it only needs user_id and llm_backend_config
    # unnecessary fields are set to None
    #agent_state = AgentState(
    #    name="proxy",
    #    user_id=user_id,
    #    persona=None,
    #    human=None,
    #    llm_config=llm_backend_config,
    #    embedding_config=None,  # TODO: support embeddings
    #    preset=None,
    #)

    # dummy agent/user ID
    agent_id = uuid.UUID(int=0)
    user_id = uuid.UUID(int=0)

    # Delete 'name' if it's None (it triggers an error w/ OpenAI API)
    messages_clean = [{k: v for k, v in d.items() if not (k == "name" and v is None)} for d in request_data["messages"]]

    # TODO: fix this -- very gross
    message_objs = []
    for msg in messages_clean:
        message_objs.append(
            Message.dict_to_message(
                agent_id=agent_id, user_id=user_id, model="memgpt", openai_message_dict=msg
            )
        )

    # Convert tool format to functions format
    if request.tools is not None:
        functions = [tool.function.model_dump() for tool in request.tools]
        function_call = request.tool_choice if request.tool_choice is not None else "auto"
    elif request.functions is not None:
        functions = request.functions
        function_call = request.function_call if request.function_call is not None else "auto"
    else:
        functions = None
        function_call = "auto"

    first_message = False  # TODO make dynamic

    # NOTE: the MemGPT client has its own retry, e.g. if the LLM server throws a rate-limit error, or if the first message validation fails
    # It makes sense for the proxy server itself to also have retries - for example to retry on JSON errors
    # However the proxy's retries should be very limited to reduce latency, and in the case of JSON errors it may be better to bounce
    # the request to OpenAI instead of retrying on a local LLM server
    MAX_RETRIES = 3
    count = 0
    success = False
    error = None
    while count < MAX_RETRIES:
        try:
            response = create(
                #agent_state=agent_state,
                llm_config=llm_backend_config, # ADD for version 0.3.13
                #user_id=user_id,
                messages=message_objs,
                functions=functions,
                function_call=function_call,
                first_message=first_message,
            )
            success = True
            break
        except Exception as e:
            print(e)
            error = str(e)
            count += 1

    if not success:
        error_str = f"Internal server error (unpack): {str(error)}"
        logger.error(error_str)
        log_request(request, 500, llm_config=llm_backend_config, error=error_str)
        raise HTTPException(status_code=500, detail=error_str)

    # Prepare the response to be OpenAI ChatCompletion compliant
    # TODO if we want to override any fields of the proxied request (eg the model, fingerprint, etc), we can do it here

    # log successful response
    log_request(request, status=200, llm_config=llm_backend_config, response=response)

    # before returning, override model
    response.model = "memgpt"

    return response


@app.on_event("startup")
def on_startup():
    # Make sure that all the credentials needed are set (pulled from env vars)
    # This includes OpenAI keys, Azure keys, etc.
    if os.getenv("OPENAI_API_KEY"):
        print("found openai key")
    else:
        logger.error(f"Failed to set credentials on startup (no OpenAI key)")

    # pubsub setup for logging requests
    if PUBSUB:

        # get pubsub project_id
        if os.getenv("GCP_PUBSUB_PROJECT_ID"):
            project_id = os.getenv("GCP_PUBSUB_PROJECT_ID")
        else:
            msg = f"Failed to get project id from {GCP_PUBSUB_PROJECT_ID}"
            logger.error(msg)
            raise ValueError(msg)

        # get pubsub topic_id
        if os.getenv("GCP_PUBSUB_TOPIC_ID"):
            topic_id = os.getenv("GCP_PUBSUB_TOPIC_ID")
        else:
            msg = f"Failed to get project id from {GCP_PUBSUB_TOPIC_ID}"
            logger.error(msg)
            raise ValueError(msg)

        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(project_id, topic_id)

        # add to app.state
        app.state.publisher = publisher
        app.state.topic_path = topic_path

        # Attempt to write a "startup" log to the GCS via PubSub
        data = '{"Success": true}'.encode('utf-8')
        try:
            future = app.state.publisher.publish(app.state.topic_path, data=data)
        except Exception as e:
            print("Logging error", str(e))
            raise e

        print(f"Publisher and topic path set up: project id {project_id}, topic id {topic_id}")
