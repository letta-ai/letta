from typing import AsyncGenerator, List

from letta.agents.base_agent import BaseAgent
from letta.constants import DEFAULT_MAX_STEPS
from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.prompts.gpt_system import get_system_text
from letta.schemas.block import Block, BlockUpdate
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager

logger = get_logger(__name__)


class EphemeralSummaryAgent(BaseAgent):
    """
    A stateless summarization agent that utilizes the caller's LLM client to summarize the conversation.
    TODO (cliandy): allow the summarizer to use another llm_config from the main agent maybe?
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
            openai_client=None,
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

        # Gets the LLMCLient based on the calling agent's LLM Config
        agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=self.agent_id, actor=self.actor)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )

        system_message_create = MessageCreate(
            role=MessageRole.system,
            content=[TextContent(text=get_system_text("summary_system_prompt"))],
        )
        messages = convert_message_creates_to_messages(
            message_creates=[system_message_create] + input_messages,
            agent_id=self.agent_id,
            timezone=agent_state.timezone,
        )

        request_data = llm_client.build_request_data(messages, agent_state.llm_config, tools=[])
        response_data = await llm_client.request_async(request_data, agent_state.llm_config)
        response = llm_client.convert_response_to_chat_completion(response_data, messages, agent_state.llm_config)
        summary = response.choices[0].message.content.strip()

        await self.block_manager.update_block_async(block_id=block.id, block_update=BlockUpdate(value=summary), actor=self.actor)

        logger.debug("block:", block)
        logger.debug("summary:", summary)

        return [
            Message(
                role=MessageRole.assistant,
                content=[TextContent(text=summary)],
            )
        ]

    async def step_stream(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> AsyncGenerator[str, None]:
        raise NotImplementedError("EphemeralAgent does not support async step.")
