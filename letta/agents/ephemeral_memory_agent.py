from typing import AsyncGenerator, Dict, List

import openai

from letta.agents.base_agent import BaseAgent
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, Tool
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager


class EphemeralMemoryAgent(BaseAgent):
    """
    A stateless agent that helps with offline memory computations.

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

    def pre_process_input_message(self, input_messages: List[MessageCreate]) -> List[Dict]:
        input_message = input_messages[0]
        input_prompt_augmented = f"""
        You are a memory recall agent whose job is to comb through a large set of messages and write relevant memories in relation to a user query.
        Your response will directly populate a "memory block" called "human" that describes the user, that will be used to answer more questions in the future.
        You should err on the side of being more verbose, and also try to *predict* the trajectory of the conversation, and pull memories or messages you think will be relevant to where the conversation is going.

        Your response should include:
        - A high level summary of the relevant events/timeline of the conversation relevant to the query
        - Direct citations of quotes from the messages you used while creating the summary

        Here is a history of the messages so far:

        {self._format_messages_llm_friendly()}

        This is the query:

        "{input_message.content}"

        Your response:
        """

        return [{"role": "user", "content": input_prompt_augmented}]

    def _format_messages_llm_friendly(self):
        messages = self.message_manager.list_messages_for_agent(agent_id=self.agent_id, actor=self.actor)

        llm_friendly_messages = [f"{m.role}: {m.content[0].text}" for m in messages if m.content and isinstance(m.content[0], TextContent)]
        return "\n".join(llm_friendly_messages)

    def _build_openai_request(self, openai_messages: List[Dict], agent_state: AgentState) -> ChatCompletionRequest:
        openai_request = ChatCompletionRequest(
            model=agent_state.llm_config.model,
            messages=openai_messages,
            # tools=self._build_tool_schemas(agent_state),
            # tool_choice="auto",
            user=self.actor.id,
            max_completion_tokens=agent_state.llm_config.max_tokens,
            temperature=agent_state.llm_config.temperature,
            stream=False,
        )
        return openai_request

    def _build_tool_schemas(self, agent_state: AgentState) -> List[Tool]:
        # Only include memory tools
        tools = [t for t in agent_state.tools if t.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE}]

        return [Tool(type="function", function=enable_strict_mode(t.json_schema)) for t in tools]

    async def step_stream(self, input_messages: List[MessageCreate]) -> AsyncGenerator[str, None]:
        """
        This agent is synchronous-only. If called in an async context, raise an error.
        """
        raise NotImplementedError("EphemeralMemoryAgent does not support async step.")
