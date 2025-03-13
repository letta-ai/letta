from typing import List, Optional

from letta.agent import Agent, AgentState
from letta.interface import AgentInterface
from letta.orm import User
from letta.schemas.block import Block
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.usage import LettaUsageStatistics
from letta.services.tool_manager import ToolManager


class DynamicMultiAgent(Agent):
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
        termination_token: str = "DONE!",
    ):
        super().__init__(interface, agent_state, user)
        self.group_id = group_id
        self.agent_ids = agent_ids
        self.description = description
        self.max_turns = max_turns or len(agent_ids)
        self.termination_token = termination_token

        self.tool_manager = ToolManager()

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
        message_index = {self.agent_state.id: 0}
        agents[self.agent_state.id] = self.load_manager_agent()
        for agent_id in self.agent_ids:
            agents[agent_id] = self.load_participant_agent(agent_id=agent_id)
            message_index[agent_id] = 0

        chat_history: List[Message] = []
        new_messages = messages
        speaker_id = None
        try:
            for _ in range(self.max_turns):
                agent_id_options = [agent_id for agent_id in self.agent_ids if agent_id != speaker_id]
                manager_message = self.ask_manager_to_choose_participant_message(new_messages, chat_history, agent_id_options)
                manager_agent = agents[self.agent_state.id]
                usage_stats = manager_agent.step(
                    messages=[manager_message],
                    chaining=chaining,
                    max_chaining_steps=max_chaining_steps,
                    stream=token_streaming,
                    skip_verify=True,
                    metadata=metadata,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )
                responses = Message.to_letta_messages_from_list(manager_agent.last_response_messages)
                assistant_message = [response for response in responses if response.message_type == "assistant_message"][0]
                for name, agent_id in [(agents[agent_id].agent_state.name, agent_id) for agent_id in agent_id_options]:
                    if name.lower() in assistant_message.content.lower():
                        speaker_id = agent_id

                # sum usage
                total_usage.prompt_tokens += usage_stats.prompt_tokens
                total_usage.completion_tokens += usage_stats.completion_tokens
                total_usage.total_tokens += usage_stats.total_tokens
                step_count += 1

                # initialize input messages
                for message in chat_history[message_index[speaker_id] :]:
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
                    messages=chat_history[message_index[speaker_id] :],
                    chaining=chaining,
                    max_chaining_steps=max_chaining_steps,
                    stream=token_streaming,
                    skip_verify=True,
                    metadata=metadata,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                )

                # parse new messages for next step
                responses = Message.to_letta_messages_from_list(
                    participant_agent.last_response_messages,
                )

                assistant_messages = [response for response in responses if response.message_type == "assistant_message"]
                new_messages = [
                    MessageCreate(
                        role="system",
                        content=message.content,
                        name=participant_agent.agent_state.name,
                    )
                    for message in assistant_messages
                ]
                message_index[agent_id] = len(chat_history) + len(new_messages)

                # sum usage
                total_usage.prompt_tokens += usage_stats.prompt_tokens
                total_usage.completion_tokens += usage_stats.completion_tokens
                total_usage.total_tokens += usage_stats.total_tokens
                step_count += 1

                # check for termination token
                if any(self.termination_token in message.content for message in new_messages):
                    break

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

    def load_manager_agent(self) -> Agent:
        for participant_agent_id in self.agent_ids:
            participant_agent_state = self.agent_manager.get_agent_by_id(agent_id=participant_agent_id, actor=self.user)
            participant_persona_block = participant_agent_state.memory.get_block(label="persona")
            new_block = self.block_manager.create_or_update_block(
                block=Block(
                    label=participant_agent_id,
                    value=participant_persona_block.value,
                ),
                actor=self.user,
            )
            self.agent_state = self.agent_manager.update_block_with_label(
                agent_id=self.agent_state.id,
                block_label=participant_agent_id,
                new_block_id=new_block.id,
                actor=self.user,
            )

        persona_block = self.agent_state.memory.get_block(label="persona")
        group_chat_manager_persona = (
            f"You are overseeing a group chat with {len(self.agent_ids) - 1} agents and "
            f"one user. Description of the group: {self.description}\n"
            "On each turn, you will be provided with the chat history and latest message. "
            "Your task is to decide which participant should speak next in the chat based "
            "on the chat history. Each agent has a memory block labeled with their ID which "
            "holds info about them, and you should use this context to inform your decision."
        )
        self.agent_state.memory.update_block_value(label="persona", value=persona_block.value + group_chat_manager_persona)
        return Agent(
            agent_state=self.agent_state,
            interface=self.interface,
            user=self.user,
            save_last_response=True,
        )

    def load_participant_agent(self, agent_id: str) -> Agent:
        agent_state = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=self.user)
        persona_block = agent_state.memory.get_block(label="persona")
        group_chat_participant_persona = (
            f"You are a participant in a group chat with {len(self.agent_ids) - 1} other "
            "agents and one user. Respond to new messages in the group chat when prompted. "
            f"Description of the group: {self.description}. About you: "
        )
        agent_state.memory.update_block_value(label="persona", value=group_chat_participant_persona + persona_block.value)
        return Agent(
            agent_state=agent_state,
            interface=self.interface,
            user=self.user,
            save_last_response=True,
        )

    '''
    def attach_choose_next_participant_tool(self) -> AgentState:
        def choose_next_participant(next_speaker_agent_id: str) -> str:
            """
            Returns ID of the agent in the group chat that should reply to the latest message in the conversation. The agent ID will always be in the format: `agent-{UUID}`.
            Args:
              next_speaker_agent_id (str): The ID of the agent that is most suitable to be the next speaker.
            Returns:
              str: The ID of the agent that should be the next speaker.
            """
            return next_speaker_agent_id
        source_code = parse_source_code(choose_next_participant)
        tool = self.tool_manager.create_or_update_tool(
            Tool(
                source_type="python",
                source_code=source_code,
                name="choose_next_participant",
            ),
            actor=self.user,
        )
        return self.agent_manager.attach_tool(agent_id=self.agent_state.id, tool_id=tool.id, actor=self.user)
    '''

    def ask_manager_to_choose_participant_message(
        self,
        new_messages: List[MessageCreate],
        chat_history: List[Message],
        agent_id_options: List[str],
    ) -> Message:
        chat_history = [f"{message.name or 'user'}: {message.content[0].text}" for message in chat_history]
        for message in new_messages:
            chat_history.append(f"{message.name or 'user'}: {message.content}")
        context_messages = "\n".join(chat_history)

        message_text = (
            "Choose the most suitable agent to reply to the latest message in the "
            f"group chat from the following options: {agent_id_options}. Do not "
            "respond to the messages yourself, your task is only to decide the "
            f"next speaker, not to participate. \nChat history:\n{context_messages}"
        )
        return Message(
            agent_id=self.agent_state.id,
            role="user",
            content=[TextContent(text=message_text)],
            name=None,
            model=None,
            tool_calls=None,
            tool_call_id=None,
            group_id=self.group_id,
        )
