import json
from typing import Dict, Optional, Union

from letta.agent import Agent
from letta.interface import AgentInterface
from letta.orm.group import Group
from letta.orm.user import User
from letta.schemas.agent import AgentState
from letta.schemas.group import ManagerType
from letta.schemas.message import Message
from letta.services.mcp.base_client import AsyncBaseMCPClient


def load_multi_agent(
    group: Group,
    agent_state: Optional[AgentState],
    actor: User,
    interface: Union[AgentInterface, None] = None,
    mcp_clients: Optional[Dict[str, AsyncBaseMCPClient]] = None,
) -> Agent:
    if len(group.agent_ids) == 0:
        raise ValueError("Empty group: group must have at least one agent")

    if not agent_state:
        raise ValueError("Empty manager agent state: manager agent state must be provided")

    match group.manager_type:
        case ManagerType.round_robin:
            from letta.groups.round_robin_multi_agent import RoundRobinMultiAgent

            return RoundRobinMultiAgent(
                agent_state=agent_state,
                interface=interface,
                user=actor,
                group_id=group.id,
                agent_ids=group.agent_ids,
                description=group.description,
                max_turns=group.max_turns,
            )
        case ManagerType.dynamic:
            from letta.groups.dynamic_multi_agent import DynamicMultiAgent

            return DynamicMultiAgent(
                agent_state=agent_state,
                interface=interface,
                user=actor,
                group_id=group.id,
                agent_ids=group.agent_ids,
                description=group.description,
                max_turns=group.max_turns,
                termination_token=group.termination_token,
            )
        case ManagerType.supervisor:
            from letta.groups.supervisor_multi_agent import SupervisorMultiAgent

            return SupervisorMultiAgent(
                agent_state=agent_state,
                interface=interface,
                user=actor,
                group_id=group.id,
                agent_ids=group.agent_ids,
                description=group.description,
            )
        case ManagerType.sleeptime:
            if not agent_state.enable_sleeptime:
                return Agent(
                    agent_state=agent_state,
                    interface=interface,
                    user=actor,
                    mcp_clients=mcp_clients,
                )

            from letta.groups.sleeptime_multi_agent import SleeptimeMultiAgent

            return SleeptimeMultiAgent(
                agent_state=agent_state,
                interface=interface,
                user=actor,
                group_id=group.id,
                agent_ids=group.agent_ids,
                description=group.description,
                sleeptime_agent_frequency=group.sleeptime_agent_frequency,
            )
        case _:
            raise ValueError(f"Type {group.manager_type} is not supported.")


def stringify_message(message: Message, use_assistant_name: bool = False) -> str | None:
    assistant_name = message.name or "assistant" if use_assistant_name else "assistant"
    if message.role == "user":
        try:
            content = json.loads(message.content[0].text)
            if content["type"] == "user_message":
                return f"{message.name or 'user'}: {content['message']}"
            else:
                return None
        except:
            return f"{message.name or 'user'}: {message.content[0].text}"
    elif message.role == "assistant":
        messages = []
        if message.tool_calls:
            if message.tool_calls[0].function.name == "send_message":
                messages.append(f"{assistant_name}: {json.loads(message.tool_calls[0].function.arguments)['message']}")
            else:
                messages.append(f"{assistant_name}: Calling tool {message.tool_calls[0].function.name}")
        return "\n".join(messages)
    elif message.role == "tool":
        if message.content:
            content = json.loads(message.content[0].text)
            if str(content["message"]) != "None":
                return f"{assistant_name}: Tool call returned {content['message']}"
        return None
    elif message.role == "system":
        return None
    else:
        return f"{message.name or 'user'}: {message.content[0].text}"
