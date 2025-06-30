import asyncio
import os
from typing import Any, Dict, List, Optional

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import AssistantMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import MessageCreate
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor_base import ToolExecutor

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
        function_response = await function_map[function_name](agent_state, **function_args_copy)
        return ToolExecutionResult(
            status="success",
            func_return=function_response,
        )

    async def send_message_to_agent_and_wait_for_reply(self, agent_state: AgentState, message: str, other_agent_id: str) -> str:
        augmented_message = (
            f"[Incoming message from agent with ID '{agent_state.id}' - to reply to this message, "
            f"make sure to use the 'send_message' at the end, and the system will notify the sender of your response] "
            f"{message}"
        )

        return str(await self._process_agent(agent_id=other_agent_id, message=augmented_message))

    async def send_message_to_agents_matching_tags_async(
        self, agent_state: AgentState, message: str, match_all: List[str], match_some: List[str]
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

        tasks = [
            asyncio.create_task(self._process_agent(agent_id=agent_state.id, message=augmented_message)) for agent_state in matching_agents
        ]
        results = await asyncio.gather(*tasks)
        return str(results)

    async def _process_agent(self, agent_id: str, message: str) -> Dict[str, Any]:
        from letta.agents.letta_agent import LettaAgent

        try:
            letta_agent = LettaAgent(
                agent_id=agent_id,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                block_manager=self.block_manager,
                job_manager=self.job_manager,
                passage_manager=self.passage_manager,
                actor=self.actor,
            )

            letta_response = await letta_agent.step([MessageCreate(role=MessageRole.system, content=[TextContent(text=message)])])
            messages = letta_response.messages

            send_message_content = [message.content for message in messages if isinstance(message, AssistantMessage)]

            return {
                "agent_id": agent_id,
                "response": send_message_content if send_message_content else ["<no response>"],
            }

        except Exception as e:
            return {
                "agent_id": agent_id,
                "error": str(e),
                "type": type(e).__name__,
            }

    async def send_message_to_agent_async(self, agent_state: AgentState, message: str, other_agent_id: str) -> str:
        if os.getenv("LETTA_ENVIRONMENT") == "PRODUCTION":
            raise RuntimeError("This tool is not allowed to be run on Letta Cloud.")

        # 1) Build the prefixed system‐message
        prefixed = (
            f"[Incoming message from agent with ID '{agent_state.id}' - "
            f"to reply to this message, make sure to use the "
            f"'send_message_to_agent_async' tool, or the agent will not receive your message] "
            f"{message}"
        )

        task = asyncio.create_task(self._process_agent(agent_id=other_agent_id, message=prefixed))

        task.add_done_callback(lambda t: (logger.error(f"Async send_message task failed: {t.exception()}") if t.exception() else None))

        return "Successfully sent message"
