from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class StopReasonType(str, Enum):
    end_turn = "end_turn"
    error = "error"
    invalid_tool_call = "invalid_tool_call"
    max_steps = "max_steps"
    no_tool_call = "no_tool_call"
    tool_rule = "tool_rule"


class LettaStopReason(BaseModel):
    """
    The stop reason from Letta indicating why agent loop stopped execution.
    """

    message_type: Literal["stop_reason"] = Field("stop_reason", description="The type of the message.")
    stop_reason: StopReasonType = Field(..., description="The reason why execution stopped.")
