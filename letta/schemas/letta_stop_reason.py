from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from letta.schemas.enums import RunStatus


class StopReasonType(str, Enum):
    end_turn = "end_turn"
    error = "error"
    llm_api_error = "llm_api_error"
    invalid_llm_response = "invalid_llm_response"
    invalid_tool_call = "invalid_tool_call"
    max_steps = "max_steps"
    no_tool_call = "no_tool_call"
    tool_rule = "tool_rule"
    cancelled = "cancelled"
    requires_approval = "requires_approval"

    @property
    def run_status(self) -> RunStatus:
        if self in (
            StopReasonType.end_turn,
            StopReasonType.max_steps,
            StopReasonType.tool_rule,
            StopReasonType.requires_approval,
        ):
            return RunStatus.completed
        elif self in (
            StopReasonType.error,
            StopReasonType.invalid_tool_call,
            StopReasonType.no_tool_call,
            StopReasonType.invalid_llm_response,
            StopReasonType.llm_api_error,
        ):
            return RunStatus.failed
        elif self == StopReasonType.cancelled:
            return RunStatus.cancelled
        else:
            raise ValueError("Unknown StopReasonType")


class LettaStopReason(BaseModel):
    """
    The stop reason from Letta indicating why agent loop stopped execution.
    """

    message_type: Literal["stop_reason"] = Field("stop_reason", description="The type of the message.")
    stop_reason: StopReasonType = Field(..., description="The reason why execution stopped.")
