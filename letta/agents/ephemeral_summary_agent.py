from pathlib import Path
from typing import AsyncGenerator, Dict, List

from openai import AsyncOpenAI

from letta.agents.base_agent import BaseAgent
from letta.constants import DEFAULT_MAX_STEPS
from letta.orm.errors import NoResultFound
from letta.schemas.block import Block, BlockUpdate
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager


class EphemeralSummaryAgent(BaseAgent):
    """
    A stateless summarization agent (thin wrapper around OpenAI)

    # TODO: Extend to more clients
    """

    def __init__(
        self,
        target_block_label: str,
        agent_id: str,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        actor: User,
    ):
        super().__init__(
            agent_id=agent_id,
            openai_client=AsyncOpenAI(),
            message_manager=message_manager,
            agent_manager=agent_manager,
            actor=actor,
        )
        self.target_block_label = target_block_label
        self.block_manager = block_manager

    async def step(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> List[Message]:
        if len(input_messages) > 1:
            raise ValueError("Can only invoke EphemeralSummaryAgent with a single summarization message.")

        # Check block existence
        try:
            block = await self.agent_manager.get_block_with_label_async(
                agent_id=self.agent_id, block_label=self.target_block_label, actor=self.actor
            )
        except NoResultFound:
            block = await self.block_manager.create_or_update_block_async(
                block=Block(
                    value="", label=self.target_block_label, description="Contains recursive summarizations of the conversation so far"
                ),
                actor=self.actor,
            )
            await self.agent_manager.attach_block_async(agent_id=self.agent_id, block_id=block.id, actor=self.actor)

        if block.value:
            input_message = input_messages[0]
            input_message.content[0].text += f"\n\n--- Previous Summary ---\n{block.value}\n"

        openai_messages = self.pre_process_input_message(input_messages=input_messages)
        request = self._build_openai_request(openai_messages)

        # TODO: Extend to generic client
        chat_completion = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))
        summary = chat_completion.choices[0].message.content.strip()

        await self.block_manager.update_block_async(block_id=block.id, block_update=BlockUpdate(value=summary), actor=self.actor)

        print(block)
        print(summary)

        return [
            Message(
                role=MessageRole.assistant,
                content=[TextContent(text=summary)],
            )
        ]

    def _build_openai_request(self, openai_messages: List[Dict]) -> ChatCompletionRequest:
        current_dir = Path(__file__).parent
        file_path = current_dir / "prompts" / "summary_system_prompt.txt"
        with open(file_path, "r") as file:
            system = file.read()

        system_message = [{"role": "system", "content": system}]

        openai_request = ChatCompletionRequest(
            model="gpt-4o",
            messages=system_message + openai_messages,
            user=self.actor.id,
            max_completion_tokens=4096,
            temperature=0.7,
        )
        return openai_request

    async def step_stream(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> AsyncGenerator[str, None]:
        raise NotImplementedError("EphemeralAgent does not support async step.")
