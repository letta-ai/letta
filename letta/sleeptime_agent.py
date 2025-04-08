from typing import List, Optional, Union

from letta.agent import Agent, AgentState, save_agent
from letta.interface import AgentInterface
from letta.orm import User
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.usage import LettaUsageStatistics


class SleeptimeAgent(Agent):
    def __init__(
        self,
        interface: AgentInterface,
        agent_state: AgentState,
        user: User = None,
        # extras
        first_message_verify_mono: bool = False,
        max_memory_rethinks: int = 10,
    ):
        super().__init__(interface, agent_state, user)
        self.first_message_verify_mono = first_message_verify_mono
        self.max_memory_rethinks = max_memory_rethinks

    def step(
        self,
        messages: Union[Message, List[Message]],
        chaining: bool = True,
        max_chaining_steps: Optional[int] = None,
        **kwargs,
    ) -> LettaUsageStatistics:
        """Go through what is currently in memory core memory and integrate information."""
        next_input_message = messages if isinstance(messages, list) else [messages]
        counter = 0
        total_usage = UsageStatistics()
        step_count = 0

        while counter < self.max_memory_rethinks:
            if counter > 0:
                next_input_message = []
            kwargs["first_message"] = False
            step_response = self.inner_step(
                messages=next_input_message,
                **kwargs,
            )
            for message in step_response.messages:
                if message.tool_calls:
                    for tool_call in message.tool_calls:
                        # check if the function name is "finish_rethinking_memory"
                        if tool_call.function.name == "finish_rethinking_memory":
                            counter = self.max_memory_rethinks
                            break
            usage = step_response.usage
            step_count += 1
            total_usage += usage
            counter += 1
            self.interface.step_complete()

            save_agent(self)

        return LettaUsageStatistics(**total_usage.model_dump(), step_count=step_count)
