import json
from typing import Dict, Optional, Union

from letta.interface import AgentInterface
from letta.orm.group import Group
from letta.orm.user import User
from letta.schemas.agent import AgentState
from letta.schemas.group import ManagerType
from letta.schemas.letta_message_content import ImageContent, ReasoningContent, TextContent
from letta.schemas.message import Message
from letta.services.mcp.base_client import AsyncBaseMCPClient


def load_multi_agent(
    group: Group,
    agent_state: Optional[AgentState],
    actor: User,
    interface: Union[AgentInterface, None] = None,
    mcp_clients: Optional[Dict[str, AsyncBaseMCPClient]] = None,
) -> "Agent":
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
            messages = []
            for content in message.content:
                if isinstance(content, TextContent):
                    messages.append(f"{message.name or 'user'}: {content.text}")
                elif isinstance(content, ImageContent):
                    messages.append(f"{message.name or 'user'}: [Image Here]")
            return "\n".join(messages)
        except:
            if message.content and len(message.content) > 0:
                return f"{message.name or 'user'}: {message.content[0].text}"
            return None
    elif message.role == "assistant":
        messages = []
        if message.content:
            for content in message.content:
                if isinstance(content, TextContent):
                    messages.append(f"{assistant_name}: {content.text}")
                elif isinstance(content, ReasoningContent):
                    messages.append(f"{assistant_name}: <thinking>{content.reasoning}</thinking>")
        if message.tool_calls:
            for tool_call in message.tool_calls:
                if tool_call.function.name == "send_message":
                    messages.append(f"{assistant_name}: {json.loads(tool_call.function.arguments)['message']}")
                else:
                    messages.append(f"{assistant_name}: Calling tool {tool_call.function.name}")
        return "\n".join(messages) if messages else None
    elif message.role == "approval":
        # role == "approval" has two cases:
        # 1. Approval REQUEST: has tool_calls (assistant calling tool that needs HITL)
        # 2. Approval RESPONSE: no tool_calls, has approve field (user's decision)

        # Check if this is an approval request (has tool_calls)
        if hasattr(message, "tool_calls") and message.tool_calls:
            # Treat like assistant message calling a tool
            messages = []
            if message.content:
                for content in message.content:
                    if isinstance(content, TextContent):
                        messages.append(f"{assistant_name}: {content.text}")
                    elif isinstance(content, ReasoningContent):
                        messages.append(f"{assistant_name}: <thinking>{content.reasoning}</thinking>")
            for tool_call in message.tool_calls:
                if tool_call.function.name == "send_message":
                    messages.append(f"{assistant_name}: {json.loads(tool_call.function.arguments)['message']}")
                else:
                    messages.append(f"{assistant_name}: Calling tool {tool_call.function.name}")
            return "\n".join(messages) if messages else None
        else:
            # Approval response - user approved/rejected
            if hasattr(message, "approve") and message.approve is not None:
                status = "approved" if message.approve else "rejected"
                reason = f": {message.denial_reason}" if hasattr(message, "denial_reason") and message.denial_reason else ""
                return f"[User {status}{reason}]"
            return None
    elif message.role == "tool":
        if message.content:
            content = json.loads(message.content[0].text)
            if str(content["message"]) != "None":
                return f"{assistant_name}: Tool call returned {content['message']}"
        return None
    elif message.role == "system":
        return None
    else:
        if message.content and len(message.content) > 0:
            # Handle different content types
            content_item = message.content[0]
            if isinstance(content_item, TextContent):
                return f"{message.name or 'user'}: {content_item.text}"
            elif isinstance(content_item, ReasoningContent):
                return f"{message.name or 'user'}: <thinking>{content_item.reasoning}</thinking>"
            elif isinstance(content_item, ImageContent):
                return f"{message.name or 'user'}: [Image Here]"
        return None
