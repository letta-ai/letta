from typing import Any, Dict, List, Optional, Tuple

from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.files_agents_manager import FileAgentManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.source_manager import SourceManager
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.utils import get_friendly_error_msg


class LettaFileToolExecutor(ToolExecutor):
    """Executor for Letta file tools with direct implementation of functions."""

    def __init__(
        self,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        actor: User,
    ):
        super().__init__(
            message_manager=message_manager,
            agent_manager=agent_manager,
            block_manager=block_manager,
            passage_manager=passage_manager,
            actor=actor,
        )

        # TODO: This should be passed in to for testing purposes
        self.files_agents_manager = FileAgentManager()
        self.source_manager = SourceManager()

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
        if agent_state is None:
            raise ValueError("Agent state is required for file tools")

        function_map = {
            "open_file": self.open_file,
            "close_file": self.close_file,
            "grep": self.grep,
            "search_files": self.search_files,
        }

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        function_args_copy = function_args.copy()
        try:
            func_return = await function_map[function_name](agent_state, **function_args_copy)
            return ToolExecutionResult(
                status="success",
                func_return=func_return,
                agent_state=agent_state,
            )
        except Exception as e:
            return ToolExecutionResult(
                status="error",
                func_return=e,
                agent_state=agent_state,
                stderr=[get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))],
            )

    async def open_file(self, agent_state: AgentState, file_name: str, view_range: Optional[Tuple[int, int]] = None) -> str:
        """Stub for open_file tool."""
        start, end = None, None
        if view_range:
            start, end = view_range
            if start >= end:
                raise ValueError(f"Provided view range {view_range} is invalid, starting range must be less than ending range.")

        # TODO: This is inefficient. We can skip the initial DB lookup by preserving on the block metadata what the file_id is
        file_agent = await self.files_agents_manager.get_file_agent_by_file_name(
            agent_id=agent_state.id, file_name=file_name, actor=self.actor
        )

        if not file_agent:
            file_blocks = agent_state.memory.file_blocks
            file_names = [fb.label for fb in file_blocks]
            raise ValueError(
                f"{file_name} not attached - did you get the filename correct? Currently you have the following files attached: {file_names}"
            )

        file_id = file_agent.file_id
        file = await self.source_manager.get_file_by_id(file_id=file_id, actor=self.actor, include_content=True)

        # TODO: Inefficient, maybe we can pre-compute this
        # TODO: This is also not the best way to split things - would be cool to have "content aware" splitting
        # TODO: Split code differently from large text blurbs
        content_lines = LineChunker().chunk_text(text=file.content, start=start, end=end)
        visible_content = "\n".join(content_lines)

        await self.files_agents_manager.update_file_agent_by_id(
            agent_id=agent_state.id, file_id=file_id, actor=self.actor, is_open=True, visible_content=visible_content
        )

        return "Success"

    async def close_file(self, agent_state: AgentState, file_name: str) -> str:
        """Stub for close_file tool."""
        await self.files_agents_manager.update_file_agent_by_name(
            agent_id=agent_state.id, file_name=file_name, actor=self.actor, is_open=False
        )
        return "Success"

    async def grep(self, agent_state: AgentState, pattern: str) -> str:
        """Stub for grep tool."""
        raise NotImplementedError

    # TODO: Make this paginated?
    async def search_files(self, agent_state: AgentState, query: str) -> List[str]:
        """Search for text within attached files and return passages with their source filenames."""
        passages = await self.agent_manager.list_source_passages_async(actor=self.actor, agent_id=agent_state.id, query_text=query)
        formatted_results = []
        for p in passages:
            if p.file_name:
                formatted_result = f"[{p.file_name}]:\n{p.text}"
            else:
                formatted_result = p.text
            formatted_results.append(formatted_result)
        return formatted_results
