from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, List

import openai

from letta.schemas.letta_message import UserMessage
from letta.schemas.message import Message
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager


class BaseAgent(ABC):
    """
    Abstract base class for AI agents, handling message management, tool execution,
    and context tracking.
    """

    def __init__(
        self,
        agent_id: str,
        openai_client: openai.AsyncClient,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        actor: User,
    ):
        self.agent_id = agent_id
        self.openai_client = openai_client
        self.message_manager = message_manager
        self.agent_manager = agent_manager
        self.actor = actor

    @abstractmethod
    async def step(self, input_message: UserMessage) -> List[Message]:
        """
        Main execution loop for the agent.
        """
        raise NotImplementedError

    @abstractmethod
    async def step_stream(self, input_message: UserMessage) -> AsyncGenerator[str, None]:
        """
        Main async execution loop for the agent. Implementations must yield messages as SSE events.
        """
        raise NotImplementedError

    def pre_process_input_message(self, input_message: UserMessage) -> Any:
        """
        Pre-process function to run on the input_message.
        """
        return input_message.model_dump()
