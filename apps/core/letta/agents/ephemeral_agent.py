from typing import AsyncGenerator, Dict, List

import openai

from letta.agents.base_agent import BaseAgent
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager


class EphemeralAgent(BaseAgent):
    """
    A stateless agent (thin wrapper around OpenAI)

    # TODO: Extend to more clients
    """

    def __init__(
        self,
        agent_id: str,
        openai_client: openai.AsyncClient,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        actor: User,
    ):
        super().__init__(
            agent_id=agent_id,
            openai_client=openai_client,
            message_manager=message_manager,
            agent_manager=agent_manager,
            actor=actor,
        )

    async def step(self, input_messages: List[MessageCreate]) -> List[Message]:
        """
        Synchronous method that takes a user's input text and returns a summary from OpenAI.
        Returns a list of ephemeral Message objects containing both the user text and the assistant summary.
        """
        agent_state = self.agent_manager.get_agent_by_id(agent_id=self.agent_id, actor=self.actor)

        openai_messages = self.pre_process_input_message(input_messages=input_messages)
        request = self._build_openai_request(openai_messages, agent_state)

        chat_completion = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))

        return [
            Message(
                role=MessageRole.assistant,
                content=[TextContent(text=chat_completion.choices[0].message.content.strip())],
            )
        ]

    def _build_openai_request(self, openai_messages: List[Dict], agent_state: AgentState) -> ChatCompletionRequest:
        openai_request = ChatCompletionRequest(
            model=agent_state.llm_config.model,
            messages=openai_messages,
            user=self.actor.id,
            max_completion_tokens=agent_state.llm_config.max_tokens,
            temperature=agent_state.llm_config.temperature,
        )
        return openai_request

    async def step_stream(self, input_messages: List[MessageCreate]) -> AsyncGenerator[str, None]:
        """
        This agent is synchronous-only. If called in an async context, raise an error.
        """
        raise NotImplementedError("EphemeralAgent does not support async step.")
