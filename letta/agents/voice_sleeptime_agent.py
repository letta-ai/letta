from typing import AsyncGenerator, List, Optional, Tuple, Union

from letta.agents.helpers import _create_letta_response, serialize_message_history
from letta.agents.letta_agent import LettaAgent
from letta.constants import DEFAULT_MAX_STEPS
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.block import BlockUpdate
from letta.schemas.enums import MessageStreamStatus, ToolType
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage, MessageType
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import MessageCreate
from letta.schemas.tool_rule import ChildToolRule, ContinueToolRule, InitToolRule, TerminalToolRule
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.run_manager import RunManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.types import JsonDict


class VoiceSleeptimeAgent(LettaAgent):
    """
    A special variant of the LettaAgent that helps with offline memory computations specifically for voice.
    """

    def __init__(
        self,
        agent_id: str,
        convo_agent_state: AgentState,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        run_manager: RunManager,
        passage_manager: PassageManager,
        target_block_label: str,
        actor: User,
    ):
        super().__init__(
            agent_id=agent_id,
            message_manager=message_manager,
            agent_manager=agent_manager,
            block_manager=block_manager,
            job_manager=run_manager,
            passage_manager=passage_manager,
            actor=actor,
        )

        self.convo_agent_state = convo_agent_state
        self.target_block_label = target_block_label
        self.message_transcripts = []
        self.summarizer = Summarizer(
            mode=SummarizationMode.STATIC_MESSAGE_BUFFER,
            summarizer_agent=None,
            message_buffer_limit=20,
            message_buffer_min=10,
        )

    def update_message_transcript(self, message_transcripts: List[str]):
        self.message_transcripts = message_transcripts

    async def step(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: Optional[str] = None,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
    ) -> LettaResponse:
        """
        Process the user's input message, allowing the model to call memory-related tools
        until it decides to stop and provide a final response.
        """
        agent_state = self.agent_manager.get_agent_by_id(self.agent_id, actor=self.actor)

        # Add tool rules to the agent_state specifically for this type of agent
        agent_state.tool_rules = [
            InitToolRule(tool_name="store_memories"),
            ChildToolRule(tool_name="store_memories", children=["rethink_user_memory"]),
            ContinueToolRule(tool_name="rethink_user_memory"),
            TerminalToolRule(tool_name="finish_rethinking_memory"),
        ]

        # Summarize
        current_in_context_messages, new_in_context_messages, stop_reason, usage = await super()._step(
            agent_state=agent_state, input_messages=input_messages, max_steps=max_steps
        )
        new_in_context_messages, updated = await self.summarizer.summarize(
            in_context_messages=current_in_context_messages, new_letta_messages=new_in_context_messages
        )
        self.agent_manager.set_in_context_messages(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

        return _create_letta_response(
            new_in_context_messages=new_in_context_messages,
            use_assistant_message=use_assistant_message,
            stop_reason=stop_reason,
            usage=usage,
            include_return_message_types=include_return_message_types,
        )

    @trace_method
    async def _execute_tool(
        self,
        tool_name: str,
        tool_args: JsonDict,
        agent_state: AgentState,
        agent_step_span: Optional["Span"] = None,
        step_id: str | None = None,
    ) -> "ToolExecutionResult":
        """
        Executes a tool and returns the ToolExecutionResult
        """
        from letta.schemas.tool_execution_result import ToolExecutionResult

        # Special memory case
        target_tool = next((x for x in agent_state.tools if x.name == tool_name), None)
        if not target_tool:
            return ToolExecutionResult(status="error", func_return=f"Tool not found: {tool_name}")

        try:
            if target_tool.name == "rethink_user_memory" and target_tool.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE:
                func_return, success_flag = self.rethink_user_memory(agent_state=agent_state, **tool_args)
                return ToolExecutionResult(func_return=func_return, status="success" if success_flag else "error")
            elif target_tool.name == "finish_rethinking_memory" and target_tool.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE:
                return ToolExecutionResult(func_return="", status="success")
            elif target_tool.name == "store_memories" and target_tool.tool_type == ToolType.LETTA_VOICE_SLEEPTIME_CORE:
                chunks = tool_args.get("chunks", [])
                results = [self.store_memory(agent_state=self.convo_agent_state, **chunk_args) for chunk_args in chunks]

                aggregated_result = next((res for res, _ in results if res is not None), None)
                aggregated_success = all(success for _, success in results)

                return ToolExecutionResult(
                    func_return=aggregated_result, status="success" if aggregated_success else "error"
                )  # Note that here we store to the convo agent's archival memory
            else:
                result = f"Voice sleeptime agent tried invoking invalid tool with type {target_tool.tool_type}: {target_tool}"
                return ToolExecutionResult(func_return=result, status="error")
        except Exception as e:
            return ToolExecutionResult(func_return=f"Failed to call tool. Error: {e}", status="error")

    def rethink_user_memory(self, new_memory: str, agent_state: AgentState) -> Tuple[str, bool]:
        if agent_state.memory.get_block(self.target_block_label) is None:
            agent_state.memory.create_block(label=self.target_block_label, value=new_memory)

        agent_state.memory.update_block_value(label=self.target_block_label, value=new_memory)

        target_block = agent_state.memory.get_block(self.target_block_label)
        self.block_manager.update_block(block_id=target_block.id, block_update=BlockUpdate(value=target_block.value), actor=self.actor)

        return "", True

    def store_memory(self, start_index: int, end_index: int, context: str, agent_state: AgentState) -> Tuple[str, bool]:
        """
        Store a memory.
        """
        try:
            messages = self.message_transcripts[start_index : end_index + 1]
            memory = serialize_message_history(messages, context)
            self.agent_manager.passage_manager.insert_passage(
                agent_state=agent_state,
                text=memory,
                actor=self.actor,
            )
            self.agent_manager.rebuild_system_prompt(agent_id=agent_state.id, actor=self.actor, force=True)

            return "", True
        except Exception as e:
            return f"Failed to store memory given start_index {start_index} and end_index {end_index}: {e}", False

    async def step_stream(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
    ) -> AsyncGenerator[Union[LettaMessage, LegacyLettaMessage, MessageStreamStatus], None]:
        """
        This agent is synchronous-only. If called in an async context, raise an error.
        """
        raise NotImplementedError("VoiceSleeptimeAgent does not support async step.")
