from dataclasses import dataclass
from typing import List
from letta.schemas.agent import AgentState
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.message import Message, MessageCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User

@dataclass
class WorkflowInputParams:
    agent_state: AgentState
    messages: list[MessageCreate]
    actor: User
    max_steps: int = 50

@dataclass
class PreparedMessages:
    in_context_messages: List[Message]
    input_messages_to_persist: List[Message]


@dataclass
class FinalResult:
    stop_reason: StopReasonType
    usage: LettaUsageStatistics
