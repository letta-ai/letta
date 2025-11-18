from typing import TYPE_CHECKING

from letta.agents.base_agent_v2 import BaseAgentV2
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.agents.letta_agent_v3 import LettaAgentV3
from letta.groups.sleeptime_multi_agent_v3 import SleeptimeMultiAgentV3
from letta.groups.sleeptime_multi_agent_v4 import SleeptimeMultiAgentV4
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentType

if TYPE_CHECKING:
    from letta.orm import User


class AgentLoop:
    """Factory class for instantiating the agent execution loop based on agent type"""

    @staticmethod
    def load(agent_state: AgentState, actor: "User") -> BaseAgentV2:
        if agent_state.agent_type in [AgentType.letta_v1_agent, AgentType.sleeptime_agent]:
            if agent_state.enable_sleeptime:
                return SleeptimeMultiAgentV4(
                    agent_state=agent_state,
                    actor=actor,
                    group=agent_state.multi_agent_group,
                )
            return LettaAgentV3(
                agent_state=agent_state,
                actor=actor,
            )
        elif agent_state.enable_sleeptime and agent_state.agent_type != AgentType.voice_convo_agent:
            return SleeptimeMultiAgentV3(agent_state=agent_state, actor=actor, group=agent_state.multi_agent_group)
        else:
            return LettaAgentV2(
                agent_state=agent_state,
                actor=actor,
            )
