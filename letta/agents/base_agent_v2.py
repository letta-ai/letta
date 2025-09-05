from abc import ABC, abstractmethod
from typing import AsyncGenerator

from letta.constants import DEFAULT_MAX_STEPS
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import MessageCreate
from letta.schemas.user import User


class BaseAgentV2(ABC):
    """
    Abstract base class for the letta gent loop, handling message management,
    llm api request, tool execution, and context tracking.
    """

    def __init__(self, agent_state: AgentState, actor: User):
        self.agent_state = agent_state
        self.actor = actor
        self.logger = get_logger(agent_state.id)

    @abstractmethod
    async def build_request(
        self,
        input_messages: list[MessageCreate],
    ) -> dict:
        """
        Main execution loop for the agent. This method only returns once the agent completes
        execution, returning all messages at once.
        """
        raise NotImplementedError

    @abstractmethod
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
    ) -> LettaResponse:
        """
        Main execution loop for the agent. This method only returns once the agent completes
        execution, returning all messages at once.
        """
        raise NotImplementedError

    @abstractmethod
    async def stream_steps(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
    ) -> AsyncGenerator[LettaMessage | LegacyLettaMessage | MessageStreamStatus, None]:
        """
        Main execution loop for the agent. This method returns an async generator, streaming
        each step as it completes on the server side.
        """
        raise NotImplementedError

    @abstractmethod
    async def stream_tokens(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
    ) -> AsyncGenerator[LettaMessage | LegacyLettaMessage | MessageStreamStatus, None]:
        """
        Main execution loop for the agent. This method returns an async generator, streaming
        each token as it is returned from the underlying llm api. Not all llm providers offer
        native token streaming functionality; in these cases, this api streams back steps
        rather than individual tokens.
        """
        raise NotImplementedError
