from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class StopReasonType(str, Enum):
    end_turn = "end_turn"
    error = "error"
    invalid_tool_call = "invalid_tool_call"
    max_steps = "max_steps"
    no_tool_call = "no_tool_call"


class LettaStopReason(BaseModel):
    """
    The stop reason from letta used during streaming response.
    """

    message_type: Literal["stop_reason"] = "stop_reason"
    stop_reason: StopReasonType = Field(..., description="The type of the message.")


def create_letta_stop_reason_schema():
    return {
        "properties": {
            "message_type": {
                "type": "string",
                "const": "stop_reason",
                "title": "Message Type",
                "description": "The type of the message.",
                "default": "stop_reason",
            },
            "stop_reason": {
                "type": "string",
                "enum": list(StopReasonType.__members__.keys()),
                "title": "Stop Reason",
            },
        },
        "type": "object",
        "required": ["stop_reason"],
        "title": "LettaStopReason",
        "description": "Letta provided stop reason for why agent loop ended.",
    }
