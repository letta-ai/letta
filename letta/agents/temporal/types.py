from dataclasses import dataclass
from typing import List, Optional

from letta.helpers import ToolRulesSolver
from letta.schemas.agent import AgentState
from letta.schemas.letta_message_content import (
    OmittedReasoningContent,
    ReasoningContent,
    RedactedReasoningContent,
    TextContent,
)
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
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


# ===== Additional types for activities up to _handle_ai_response =====


@dataclass
class RefreshContextParams:
    """Input to refresh_context_and_system_message activity.

    - agent_state: Current agent state (memory, sources, tools, etc.)
    - in_context_messages: Current message history to potentially rebuild/scrub
    - actor: Requesting user (for DB access control)
    """

    agent_state: AgentState
    in_context_messages: List[Message]
    tool_rules_solver: ToolRulesSolver
    actor: User


@dataclass
class LLMRequestParams:
    """Input to llm_request activity.

    - agent_state: Needed primarily for llm_config (model, endpoint, etc.)
    - messages: Full prompt messages (context + input + responses if any)
    - allowed_tools: Tools JSON schema list after rules + strict mode + runtime overrides
    - force_tool_call: Optional tool name to force call when only one valid tool exists
    - requires_approval_tools: Optional list of tool names that require approval
    - actor: Requesting user (for audit/tenant context)
    - step_id: Current step id for tracing/telemetry correlation
    """

    agent_state: AgentState
    messages: List[Message]
    allowed_tools: List[dict]
    force_tool_call: Optional[str] = None
    requires_approval_tools: Optional[List[str]] = None
    actor: Optional[User] = None
    step_id: Optional[str] = None


@dataclass
class LLMCallResult:
    """Output from llm_request activity.

    - tool_call: Parsed tool call from LLM (None for stub/approval paths)
    - reasoning_content: Optional reasoning/assistant content stream collected
    - assistant_message_id: Optional precomputed assistant message id (if adapter sets)
    - usage: Provider usage statistics for this call
    - request_finish_ns: Provider request finish time (ns) for metrics, if available
    """

    tool_call: Optional[ToolCall]
    reasoning_content: Optional[List[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent]]
    assistant_message_id: Optional[str]
    usage: UsageStatistics
    request_finish_ns: Optional[int]


@dataclass
class SummarizeParams:
    """Input to summarize_conversation_history activity.

    - agent_state: Current agent state (summarizer config, ids)
    - in_context_messages: Current context window
    - new_letta_messages: Newly generated/persisted messages to consider
    - actor: Requesting user
    - force: Whether to force summarization + clear
    """

    agent_state: AgentState
    in_context_messages: List[Message]
    new_letta_messages: List[Message]
    actor: User
    force: bool = True
