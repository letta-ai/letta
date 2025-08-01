from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from letta.schemas.enums import JobStatus


class StopReasonType(str, Enum):
    end_turn = "end_turn"
    error = "error"
    invalid_tool_call = "invalid_tool_call"
    max_steps = "max_steps"
    no_tool_call = "no_tool_call"
    tool_rule = "tool_rule"
    cancelled = "cancelled"

    @property
    def run_status(self) -> JobStatus:
        if self in (
            StopReasonType.end_turn,
            StopReasonType.max_steps,
            StopReasonType.tool_rule,
        ):
            return JobStatus.completed
        elif self in (StopReasonType.error, StopReasonType.invalid_tool_call, StopReasonType.no_tool_call):
            return JobStatus.failed
        elif self == StopReasonType.cancelled:
            return JobStatus.cancelled
        else:
            raise ValueError("Unknown StopReasonType")


class LettaStopReason(BaseModel):
    """
    The stop reason from Letta indicating why agent loop stopped execution.
    """

    message_type: Literal["stop_reason"] = Field("stop_reason", description="The type of the message.")
    stop_reason: StopReasonType = Field(..., description="The reason why execution stopped.")


def create_letta_ping_schema():
    return {
        "properties": {
            "message_type": {
                "type": "string",
                "const": "ping",
                "title": "Message Type",
                "description": "The type of the message.",
                "default": "ping",
            }
        },
        "type": "object",
        "required": ["message_type"],
        "title": "LettaPing",
        "description": "Ping messages are a keep-alive to prevent SSE streams from timing out during long running requests.",
    }


class LettaPing(BaseModel):
    message_type: Literal["ping"] = Field(
        "ping",
        description="The type of the message. Ping messages are a keep-alive to prevent SSE streams from timing out during long running requests.",
    )
