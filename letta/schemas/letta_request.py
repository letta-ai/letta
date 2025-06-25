from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl

from letta.constants import DEFAULT_MAX_STEPS, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.letta_message import MessageType
from letta.schemas.message import MessageCreate


class LettaRequest(BaseModel):
    messages: List[MessageCreate] = Field(..., description="The messages to be sent to the agent.")
    max_steps: int = Field(
        default=DEFAULT_MAX_STEPS,
        description="Maximum number of steps the agent should take to process the request.",
    )
    use_assistant_message: bool = Field(
        default=True,
        description="Whether the server should parse specific tool call arguments (default `send_message`) as `AssistantMessage` objects.",
    )
    assistant_message_tool_name: str = Field(
        default=DEFAULT_MESSAGE_TOOL,
        description="The name of the designated message tool.",
    )
    assistant_message_tool_kwarg: str = Field(
        default=DEFAULT_MESSAGE_TOOL_KWARG,
        description="The name of the message argument in the designated message tool.",
    )

    # filter to only return specific message types
    include_return_message_types: Optional[List[MessageType]] = Field(
        default=None, description="Only return specified message types in the response. If `None` (default) returns all messages."
    )


class LettaStreamingRequest(LettaRequest):
    stream_tokens: bool = Field(
        default=False,
        description="Flag to determine if individual tokens should be streamed. Set to True for token streaming (requires stream_steps = True).",
    )


class LettaAsyncRequest(LettaRequest):
    callback_url: Optional[str] = Field(None, description="Optional callback URL to POST to when the job completes")


class LettaBatchRequest(LettaRequest):
    agent_id: str = Field(..., description="The ID of the agent to send this batch request for")


class CreateBatch(BaseModel):
    requests: List[LettaBatchRequest] = Field(..., description="List of requests to be processed in batch.")
    callback_url: Optional[HttpUrl] = Field(
        None,
        description="Optional URL to call via POST when the batch completes. The callback payload will be a JSON object with the following fields: "
        "{'job_id': string, 'status': string, 'completed_at': string}. "
        "Where 'job_id' is the unique batch job identifier, "
        "'status' is the final batch status (e.g., 'completed', 'failed'), and "
        "'completed_at' is an ISO 8601 timestamp indicating when the batch job completed.",
    )
