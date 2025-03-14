from typing import List, Optional

from letta.agent import Agent, AgentState
from letta.interface import AgentInterface
from letta.orm import User
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.usage import LettaUsageStatistics


class RoundRobinMultiAgent(Agent):
    def __init__(
        self,
        interface: AgentInterface,
        agent_state: AgentState,
        user: User = None,
        # custom
        group_id: str = "",
        agent_ids: List[str] = [],
        description: str = "",
        max_turns: Optional[int] = None,
    ):
        super().__init__(interface, agent_state, user)
        self.group_id = group_id
        self.agent_ids = agent_ids
        self.description = description
        self.max_turns = max_turns or len(agent_ids)

    def step(
        self,
        messages: List[MessageCreate],
        chaining: bool = True,
        max_chaining_steps: Optional[int] = None,
        put_inner_thoughts_first: bool = True,
        **kwargs,
    ) -> LettaUsageStatistics:
        total_usage = UsageStatistics()
        step_count = 0

        token_streaming = self.interface.streaming_mode if hasattr(self.interface, "streaming_mode") else False
        metadata = self.interface.metadata if hasattr(self.interface, "metadata") else None

        agents = {}
        for agent_id in self.agent_ids:
            agents[agent_id] = self.load_participant_agent(agent_id=agent_id)

        message_index = {}
        chat_history: List[Message] = []
        new_messages = messages
        speaker_id = None
        try:
            for i in range(self.max_turns):
                speaker_id = self.agent_ids[i % len(self.agent_ids)]
                # initialize input messages
                start_index = message_index[speaker_id] if speaker_id in message_index else 0
                for message in chat_history[start_index:]:
                    message.id = Message.generate_id()
                    message.agent_id = speaker_id

                for message in new_messages:
                    chat_history.append(
                        Message(
                            agent_id=speaker_id,
                            role=message.role,
                            content=[TextContent(text=message.content)],
                            name=message.name,
                            model=None,
                            tool_calls=None,
                            tool_call_id=None,
                            group_id=self.group_id,
                        )
                    )

                # load agent and perform step
                participant_agent = agents[speaker_id]
                usage_stats = participant_agent.step(
                    messages=chat_history[start_index:],
                    chaining=chaining,
                    max_chaining_steps=max_chaining_steps,
                    stream=token_streaming,
                    skip_verify=True,
                    metadata=metadata,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )

                # parse new messages for next step
                responses = Message.to_letta_messages_from_list(participant_agent.last_response_messages)
                assistant_messages = [response for response in responses if response.message_type == "assistant_message"]
                new_messages = [
                    MessageCreate(
                        role="system",
                        content=message.content,
                        name=participant_agent.agent_state.name,
                    )
                    for message in assistant_messages
                ]
                message_index[speaker_id] = len(chat_history) + len(new_messages)

                # sum usage
                total_usage.prompt_tokens += usage_stats.prompt_tokens
                total_usage.completion_tokens += usage_stats.completion_tokens
                total_usage.total_tokens += usage_stats.total_tokens
                step_count += 1

            # persist remaining chat history
            for message in new_messages:
                chat_history.append(
                    Message(
                        agent_id=agent_id,
                        role=message.role,
                        content=[TextContent(text=message.content)],
                        name=message.name,
                        model=None,
                        tool_calls=None,
                        tool_call_id=None,
                        group_id=self.group_id,
                    )
                )
            for agent_id, index in message_index.items():
                if agent_id == speaker_id:
                    continue
                for message in chat_history[index:]:
                    message.id = Message.generate_id()
                    message.agent_id = agent_id
                self.message_manager.create_many_messages(chat_history[index:], actor=self.user)

        except Exception as e:
            raise e
        finally:
            self.interface.step_yield()

        self.interface.step_complete()

        return LettaUsageStatistics(**total_usage.model_dump(), step_count=step_count)

    def load_participant_agent(self, agent_id: str) -> Agent:
        agent_state = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=self.user)
        persona_block = agent_state.memory.get_block(label="persona")
        group_chat_participant_persona = (
            "\n\n====Group Chat Contex===="
            f"\nYou are speaking in a group chat with {len(self.agent_ids) - 1} other "
            "agents and one user. Respond to new messages in the group chat when prompted. "
            f"Description of the group: {self.description}"
        )
        agent_state.memory.update_block_value(label="persona", value=persona_block.value + group_chat_participant_persona)
        return Agent(
            agent_state=agent_state,
            interface=self.interface,
            user=self.user,
            save_last_response=True,
        )
