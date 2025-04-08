from typing import List, Optional

from letta.agent import Agent, AgentState
from letta.constants import DEFAULT_MESSAGE_TOOL
from letta.functions.function_sets.multi_agent import send_message_to_all_agents_in_group
from letta.functions.functions import parse_source_code
from letta.functions.schema_generator import generate_schema
from letta.interface import AgentInterface
from letta.orm import User
from letta.orm.enums import ToolType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.tool import Tool
from letta.schemas.tool_rule import ChildToolRule, InitToolRule, TerminalToolRule
from letta.schemas.usage import LettaUsageStatistics
from letta.services.agent_manager import AgentManager
from letta.services.tool_manager import ToolManager


class SupervisorMultiAgent(Agent):
    def __init__(
        self,
        interface: AgentInterface,
        agent_state: AgentState,
        user: User,
        # custom
        group_id: str = "",
        agent_ids: List[str] = [],
        description: str = "",
    ):
        super().__init__(interface, agent_state, user)
        self.group_id = group_id
        self.agent_ids = agent_ids
        self.description = description
        self.agent_manager = AgentManager()
        self.tool_manager = ToolManager()

    def step(
        self,
        messages: List[MessageCreate],
        chaining: bool = True,
        max_chaining_steps: Optional[int] = None,
        put_inner_thoughts_first: bool = True,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        **kwargs,
    ) -> LettaUsageStatistics:
        token_streaming = self.interface.streaming_mode if hasattr(self.interface, "streaming_mode") else False
        metadata = self.interface.metadata if hasattr(self.interface, "metadata") else None

        # add multi agent tool
        if self.tool_manager.get_tool_by_name(tool_name="send_message_to_all_agents_in_group", actor=self.user) is None:
            multi_agent_tool = Tool(
                name=send_message_to_all_agents_in_group.__name__,
                description="",
                source_type="python",
                tags=[],
                source_code=parse_source_code(send_message_to_all_agents_in_group),
                json_schema=generate_schema(send_message_to_all_agents_in_group, None),
            )
            multi_agent_tool.tool_type = ToolType.LETTA_MULTI_AGENT_CORE
            multi_agent_tool = self.tool_manager.create_or_update_tool(
                pydantic_tool=multi_agent_tool,
                actor=self.user,
            )
            self.agent_state = self.agent_manager.attach_tool(agent_id=self.agent_state.id, tool_id=multi_agent_tool.id, actor=self.user)

        # override tool rules
        old_tool_rules = self.agent_state.tool_rules
        self.agent_state.tool_rules = [
            InitToolRule(
                tool_name="send_message_to_all_agents_in_group",
            ),
            TerminalToolRule(
                tool_name=assistant_message_tool_name,
            ),
            ChildToolRule(
                tool_name="send_message_to_all_agents_in_group",
                children=[assistant_message_tool_name],
            ),
        ]

        supervisor_messages = [
            Message(
                agent_id=self.agent_state.id,
                role="user",
                content=[TextContent(text=message.content)],
                name=None,
                model=None,
                tool_calls=None,
                tool_call_id=None,
                group_id=self.group_id,
                otid=message.otid,
            )
            for message in messages
        ]
        try:
            supervisor_agent = Agent(agent_state=self.agent_state, interface=self.interface, user=self.user)
            usage_stats = supervisor_agent.step(
                messages=supervisor_messages,
                chaining=chaining,
                max_chaining_steps=max_chaining_steps,
                stream=token_streaming,
                skip_verify=True,
                metadata=metadata,
                put_inner_thoughts_first=put_inner_thoughts_first,
            )
        except Exception as e:
            raise e
        finally:
            self.interface.step_yield()
            self.agent_state.tool_rules = old_tool_rules

        self.interface.step_complete()

        return usage_stats
