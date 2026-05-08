from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, AsyncGenerator

from letta.constants import DEFAULT_MAX_STEPS
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage, MessageType
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import MessageCreate
from letta.schemas.user import User

if TYPE_CHECKING:
    from letta.schemas.letta_request import ClientSkillSchema, ClientToolSchema
    from letta.schemas.provider_trace import BillingContext


class BaseAgentV2(ABC):
    """
    Abstract base class for the main agent execution loop for letta agents, handling
    message management, llm api request, tool execution, and context tracking.
    """

    def __init__(self, agent_state: AgentState, actor: User):
        self.agent_state = agent_state
        self.actor = actor
        self.logger = get_logger(agent_state.id)
        self.conversation_id: str | None = None

    @property
    def agent_id(self) -> str:
        """Return the agent ID for backward compatibility with code expecting self.agent_id."""
        return self.agent_state.id

    @abstractmethod
    async def build_request(
        self,
        input_messages: list[MessageCreate],
        client_skills: list["ClientSkillSchema"] | None = None,
        client_tools: list["ClientToolSchema"] | None = None,
        conversation_id: str | None = None,
        override_system: str | None = None,
    ) -> dict:
        """
        Execute the agent loop in dry_run mode, returning just the generated request
        payload sent to the underlying llm provider.
        """
        raise NotImplementedError

    @abstractmethod
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
        client_tools: list["ClientToolSchema"] | None = None,
        client_skills: list["ClientSkillSchema"] | None = None,
        override_system: str | None = None,
        include_compaction_messages: bool = False,  # Not used in V2, but accepted for API compatibility
        billing_context: "BillingContext | None" = None,
    ) -> LettaResponse:
        """
        Execute the agent loop in blocking mode, returning all messages at once.

        Args:
            client_tools: Optional list of client-side tools. When called, execution pauses
                for client to provide tool returns.
            include_compaction_messages: Not used in V2, but accepted for API compatibility.
        """
        raise NotImplementedError

    @abstractmethod
    async def stream(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        stream_tokens: bool = False,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
        conversation_id: str | None = None,
        client_tools: list["ClientToolSchema"] | None = None,
        client_skills: list["ClientSkillSchema"] | None = None,
        override_system: str | None = None,
        include_compaction_messages: bool = False,  # Not used in V2, but accepted for API compatibility
        billing_context: "BillingContext | None" = None,
        openai_responses_websocket: bool = False,
    ) -> AsyncGenerator[LettaMessage | LegacyLettaMessage | MessageStreamStatus, None]:
        """
        Execute the agent loop in streaming mode, yielding chunks as they become available.
        If stream_tokens is True, individual tokens are streamed as they arrive from the LLM,
        providing the lowest latency experience, otherwise each complete step (reasoning +
        tool call + tool return) is yielded as it completes.

        Args:
            client_tools: Optional list of client-side tools. When called, execution pauses
                for client to provide tool returns.
            include_compaction_messages: Not used in V2, but accepted for API compatibility.
            openai_responses_websocket: If True, use WebSocket transport for OpenAI Responses API.
        """
        raise NotImplementedError
