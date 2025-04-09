from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, List, Optional, Union

import openai

from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import MessageCreate
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
        # TODO: Make required once client refactor hits
        openai_client: Optional[openai.AsyncClient],
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
    async def step(self, input_messages: List[MessageCreate], max_steps: int = 10) -> LettaResponse:
        """
        Main execution loop for the agent.
        """
        raise NotImplementedError

    @abstractmethod
    async def step_stream(
        self, input_messages: List[MessageCreate], max_steps: int = 10
    ) -> AsyncGenerator[Union[LettaMessage, LegacyLettaMessage, MessageStreamStatus], None]:
        """
        Main streaming execution loop for the agent.
        """
        raise NotImplementedError

    def pre_process_input_message(self, input_messages: List[MessageCreate]) -> Any:
        """
        Pre-process function to run on the input_message.
        """

        def get_content(message: MessageCreate) -> str:
            if isinstance(message.content, str):
                return message.content
            elif message.content and len(message.content) == 1 and isinstance(message.content[0], TextContent):
                return message.content[0].text
            else:
                return ""

        return [{"role": input_message.role, "content": get_content(input_message)} for input_message in input_messages]
