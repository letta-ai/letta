from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, List, Optional, Union

import openai

from letta.constants import DEFAULT_MAX_STEPS
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageStreamStatus
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message, MessageCreate, MessageUpdate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.helpers.agent_manager_helper import compile_system_message
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.utils import united_diff

logger = get_logger(__name__)


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
        # TODO: Pass this in
        self.passage_manager = PassageManager()
        self.actor = actor
        self.logger = get_logger(agent_id)

    @abstractmethod
    async def step(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> LettaResponse:
        """
        Main execution loop for the agent.
        """
        raise NotImplementedError

    @abstractmethod
    async def step_stream(
        self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS
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

        return [{"role": input_message.role.value, "content": get_content(input_message)} for input_message in input_messages]

    async def _rebuild_memory_async(
        self,
        in_context_messages: List[Message],
        agent_state: AgentState,
        tool_rules_solver: Optional[ToolRulesSolver] = None,
        num_messages: Optional[int] = None,  # storing these calculations is specific to the voice agent
        num_archival_memories: Optional[int] = None,
    ) -> List[Message]:
        """
        Async version of function above. For now before breaking up components, changes should be made in both places.
        """
        try:
            # [DB Call] loading blocks (modifies: agent_state.memory.blocks)
            await self.agent_manager.refresh_memory_async(agent_state=agent_state, actor=self.actor)

            # TODO: This is a pretty brittle pattern established all over our code, need to get rid of this
            curr_system_message = in_context_messages[0]
            curr_memory_str = agent_state.memory.compile()
            curr_system_message_text = curr_system_message.content[0].text
            if curr_memory_str in curr_system_message_text:
                logger.debug(
                    f"Memory hasn't changed for agent id={agent_state.id} and actor=({self.actor.id}, {self.actor.name}), skipping system prompt rebuild"
                )
                return in_context_messages

            memory_edit_timestamp = get_utc_time()

            # [DB Call] size of messages and archival memories
            # todo: blocking for now
            if num_messages is None:
                num_messages = await self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
            if num_archival_memories is None:
                num_archival_memories = await self.passage_manager.agent_passage_size_async(actor=self.actor, agent_id=agent_state.id)

            new_system_message_str = compile_system_message(
                system_prompt=agent_state.system,
                in_context_memory=agent_state.memory,
                in_context_memory_last_edit=memory_edit_timestamp,
                previous_message_count=num_messages - len(in_context_messages),
                archival_memory_size=num_archival_memories,
                tool_rules_solver=tool_rules_solver,
            )

            diff = united_diff(curr_system_message_text, new_system_message_str)
            if len(diff) > 0:
                logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

                # [DB Call] Update Messages
                new_system_message = await self.message_manager.update_message_by_id_async(
                    curr_system_message.id, message_update=MessageUpdate(content=new_system_message_str), actor=self.actor
                )
                return [new_system_message] + in_context_messages[1:]

            else:
                return in_context_messages
        except:
            logger.exception(f"Failed to rebuild memory for agent id={agent_state.id} and actor=({self.actor.id}, {self.actor.name})")
            raise

    def get_finish_chunks_for_stream(self, usage: LettaUsageStatistics, stop_reason: Optional[LettaStopReason] = None):
        if stop_reason is None:
            stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
        return [
            stop_reason.model_dump_json(),
            usage.model_dump_json(),
            MessageStreamStatus.done.value,
        ]
