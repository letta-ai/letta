import uuid
from typing import List, Optional, Union

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from letta.constants import DEFAULT_MAX_STEPS, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import LettaMessageContentUnion
from letta.schemas.message import MessageCreate, MessageCreateUnion, MessageRole


class LettaRequest(BaseModel):
    messages: Optional[List[MessageCreateUnion]] = Field(None, description="The messages to be sent to the agent.")
    input: Optional[Union[str, List[LettaMessageContentUnion]]] = Field(
        None, description="Syntactic sugar for a single user message. Equivalent to messages=[{'role': 'user', 'content': input}]."
    )
    max_steps: int = Field(
        default=DEFAULT_MAX_STEPS,
        description="Maximum number of steps the agent should take to process the request.",
    )
    use_assistant_message: bool = Field(
        default=True,
        description="Whether the server should parse specific tool call arguments (default `send_message`) as `AssistantMessage` objects. Still supported for legacy agent types, but deprecated for letta_v1_agent onward.",
        deprecated=True,
    )
    assistant_message_tool_name: str = Field(
        default=DEFAULT_MESSAGE_TOOL,
        description="The name of the designated message tool. Still supported for legacy agent types, but deprecated for letta_v1_agent onward.",
        deprecated=True,
    )
    assistant_message_tool_kwarg: str = Field(
        default=DEFAULT_MESSAGE_TOOL_KWARG,
        description="The name of the message argument in the designated message tool. Still supported for legacy agent types, but deprecated for letta_v1_agent onward.",
        deprecated=True,
    )

    # filter to only return specific message types
    include_return_message_types: Optional[List[MessageType]] = Field(
        default=None, description="Only return specified message types in the response. If `None` (default) returns all messages."
    )

    enable_thinking: str = Field(
        default=True,
        description="If set to True, enables reasoning before responses or tool calls from the agent.",
        deprecated=True,
    )

    @field_validator("messages", mode="before")
    @classmethod
    def add_default_type_to_messages(cls, v):
        """Handle union without discriminator - default to 'message' type if not specified"""
        if isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    # If type is not present, determine based on fields
                    if "type" not in item:
                        # If it has approval-specific fields, it's an approval
                        if "approval_request_id" in item or "approve" in item:
                            item["type"] = "approval"
                        else:
                            # Default to message
                            item["type"] = "message"
        return v

    @model_validator(mode="after")
    def validate_input_or_messages(self):
        """Ensure exactly one of input or messages is set, and convert input to messages if needed"""
        if self.input is not None and self.messages is not None:
            raise ValueError("Cannot specify both 'input' and 'messages'. Use one or the other.")
        if self.input is None and self.messages is None:
            raise ValueError("Must specify either 'input' or 'messages'.")

        # Convert input to messages format
        # input can be either a string or List[LettaMessageContentUnion]
        if self.input is not None:
            # Both str and List[LettaMessageContentUnion] are valid content types for MessageCreate
            self.messages = [MessageCreate(role=MessageRole.user, content=self.input, otid=str(uuid.uuid4()))]

        return self


class LettaStreamingRequest(LettaRequest):
    streaming: bool = Field(
        default=False,
        description="If True, returns a streaming response (Server-Sent Events). If False (default), returns a complete response.",
    )
    stream_tokens: bool = Field(
        default=False,
        description="Flag to determine if individual tokens should be streamed, rather than streaming per step (only used when streaming=true).",
    )
    include_pings: bool = Field(
        default=True,
        description="Whether to include periodic keepalive ping messages in the stream to prevent connection timeouts (only used when streaming=true).",
    )
    background: bool = Field(
        default=False,
        description="Whether to process the request in the background (only used when streaming=true).",
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


class RetrieveStreamRequest(BaseModel):
    starting_after: int = Field(
        0, description="Sequence id to use as a cursor for pagination. Response will start streaming after this chunk sequence id"
    )
    include_pings: Optional[bool] = Field(
        default=True,
        description="Whether to include periodic keepalive ping messages in the stream to prevent connection timeouts.",
    )
    poll_interval: Optional[float] = Field(
        default=0.1,
        description="Seconds to wait between polls when no new data.",
    )
    batch_size: Optional[int] = Field(
        default=100,
        description="Number of entries to read per batch.",
    )
