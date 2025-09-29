import asyncio
from typing import Any, Dict, List, Optional

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import AssistantMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import MessageCreate
from letta.schemas.run import Run
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.run_manager import RunManager
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.settings import settings
from letta.utils import safe_create_task

logger = get_logger(__name__)


class LettaMultiAgentToolExecutor(ToolExecutor):
    """Executor for LETTA multi-agent core tools."""

    async def execute(
        self,
        function_name: str,
        function_args: dict,
        tool: Tool,
        actor: User,
        agent_state: Optional[AgentState] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ) -> ToolExecutionResult:
        assert agent_state is not None, "Agent state is required for multi-agent tools"
        function_map = {
            "send_message_to_agent_and_wait_for_reply": self.send_message_to_agent_and_wait_for_reply,
            "send_message_to_agent_async": self.send_message_to_agent_async,
            "send_message_to_agents_matching_tags": self.send_message_to_agents_matching_tags_async,
        }

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        # Execute the appropriate function
        function_args_copy = function_args.copy()  # Make a copy to avoid modifying the original
        function_response = await function_map[function_name](agent_state, actor, **function_args_copy)
        return ToolExecutionResult(
            status="success",
            func_return=function_response,
        )

    async def send_message_to_agent_and_wait_for_reply(
        self, agent_state: AgentState, actor: User, message: str, other_agent_id: str
    ) -> str:
        augmented_message = (
            f"[Incoming message from agent with ID '{agent_state.id}' - to reply to this message, "
            f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
            f"{message}"
        )

        other_agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=other_agent_id, actor=self.actor)
        return str(await self._process_agent(agent_state=other_agent_state, message=augmented_message, actor=actor))

    async def send_message_to_agents_matching_tags_async(
        self, agent_state: AgentState, actor: User, message: str, match_all: List[str], match_some: List[str]
    ) -> str:
        # Find matching agents
        matching_agents = await self.agent_manager.list_agents_matching_tags_async(
            actor=self.actor, match_all=match_all, match_some=match_some
        )
        if not matching_agents:
            return str([])

        augmented_message = (
            "[Incoming message from external Letta agent - to reply to this message, "
            "make sure to use the 'send_message' at the end, and the system will notify "
            "the sender of your response] "
            f"{message}"
        )

        # Run concurrent requests and collect their return values.
        # Note: Do not wrap with safe_create_task here — it swallows return values (returns None).
        coros = [self._process_agent(agent_state=a_state, message=augmented_message, actor=actor) for a_state in matching_agents]
        results = await asyncio.gather(*coros)
        return str(results)

    async def _process_agent(self, agent_state: AgentState, message: str, actor: User) -> Dict[str, Any]:
        from letta.agents.letta_agent_v2 import LettaAgentV2

        try:
            runs_manager = RunManager()
            run = await runs_manager.create_run(
                pydantic_run=Run(
                    agent_id=agent_state.id,
                    background=False,
                    metadata={
                        "run_type": "agent_send_message_to_agent",  # TODO: Make this a constant
                    },
                ),
                actor=actor,
            )

            letta_agent = LettaAgentV2(
                agent_state=agent_state,
                actor=self.actor,
            )

            letta_response = await letta_agent.step(
                [MessageCreate(role=MessageRole.system, content=[TextContent(text=message)])], run_id=run.id
            )
            messages = letta_response.messages

            send_message_content = [message.content for message in messages if isinstance(message, AssistantMessage)]

            return {
                "agent_id": agent_state.id,
                "response": send_message_content if send_message_content else ["<no response>"],
            }

        except Exception as e:
            return {
                "agent_id": agent_state.id,
                "error": str(e),
                "type": type(e).__name__,
            }

    async def send_message_to_agent_async(self, agent_state: AgentState, actor: User, message: str, other_agent_id: str) -> str:
        if settings.environment == "PRODUCTION":
            raise RuntimeError("This tool is not allowed to be run on Letta Cloud.")

        # 1) Build the prefixed system‐message
        prefixed = (
            f"[Incoming message from agent with ID '{agent_state.id}' - "
            f"to reply to this message, make sure to use the "
            f"'send_message_to_agent_async' tool, or the agent will not receive your message] "
            f"{message}"
        )

        other_agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=other_agent_id, actor=self.actor)
        task = safe_create_task(
            self._process_agent(agent_state=other_agent_state, message=prefixed, actor=actor), label=f"send_message_to_{other_agent_id}"
        )

        task.add_done_callback(lambda t: (logger.error(f"Async send_message task failed: {t.exception()}") if t.exception() else None))

        return "Successfully sent message"
