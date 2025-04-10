from typing import Dict, List

from letta.agents.helpers import _prepare_in_context_messages
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState, AgentStepState
from letta.schemas.enums import JobStatus, ProviderType
from letta.schemas.letta_request import LettaBatchRequest
from letta.schemas.letta_response import LettaBatchResponse
from letta.schemas.message import Message, MessageCreate, MessageUpdate
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import compile_system_message
from letta.services.llm_batch_manager import LLMBatchManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.utils import united_diff

logger = get_logger(__name__)


# TODO: Limitations ->
# TODO: Only works with anthropic for now
class LettaAgentBatch:

    def __init__(
        self,
        batch_id: str,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        batch_manager: LLMBatchManager,
        actor: User,
        use_assistant_message: bool = True,
        max_steps: int = 10,
    ):
        self.batch_id = batch_id
        self.message_manager = message_manager
        self.agent_manager = agent_manager
        self.block_manager = block_manager
        self.passage_manager = passage_manager
        self.batch_manager = batch_manager
        self.use_assistant_message = use_assistant_message
        self.actor = actor
        self.max_steps = max_steps

    async def step_until_request(
        self, batch_requests: List[LettaBatchRequest], agent_step_state_mapping: Dict[str, AgentStepState]
    ) -> LettaBatchResponse:
        agent_messages_mapping: Dict[str, List[Message]] = {}
        agent_tools_mapping: Dict[str, List[dict]] = {}
        agent_states = []

        for batch_request in batch_requests:
            agent_id = batch_request.agent_id
            agent_state = self.agent_manager.get_agent_by_id(agent_id, actor=self.actor)
            agent_states.append(agent_state)
            agent_messages_mapping[agent_id] = self.get_in_context_messages_per_agent(
                agent_state=agent_state, input_messages=batch_request.messages
            )
            agent_tools_mapping[agent_id] = self.prepare_tools_per_agent(
                agent_state, agent_step_state_mapping.get(agent_id).tool_rules_solver
            )

        # TODO: This is a hack, this is because LLM client expects a LLM config
        # TODO: But that doesn't really work in batch land
        # TODO: @caren will factor this out
        llm_client = LLMClient.create(
            llm_config=agent_states[0].llm_config,
            put_inner_thoughts_first=True,
        )
        agent_llm_config_mapping = {agent_state.id: agent_state.llm_config for agent_state in agent_states}
        batch_response = await llm_client.send_llm_batch_request_async(
            agent_messages_mapping=agent_messages_mapping,
            agent_tools_mapping=agent_tools_mapping,
            agent_llm_config_mapping=agent_llm_config_mapping,
        )

        # Write the response into the jobs table, where it will get picked up by the next cron run
        batch_job = self.batch_manager.create_batch_job(
            llm_provider=ProviderType.anthropic,  # TODO: Expand to more
            create_batch_response=batch_response,
            actor=self.actor,
            status=JobStatus.running,
        )

        # TODO: Make this much more efficient by doing creates in bulk
        for agent_state in agent_states:
            agent_step_state = agent_step_state_mapping.get(agent_state.id)
            self.batch_manager.create_batch_item(
                batch_id=batch_job.id,
                agent_id=agent_state.id,
                llm_config=agent_state.llm_config,
                actor=self.actor,
                step_state=agent_step_state,
            )

        return LettaBatchResponse(
            batch_id=batch_job.id, status=batch_job.status, last_polled_at=get_utc_time(), created_at=batch_job.created_at
        )

    async def resume_step_after_request(self, batch_id: str):
        pass

    def prepare_tools_per_agent(self, agent_state: AgentState, tool_rules_solver: ToolRulesSolver) -> List[dict]:
        tools = [t for t in agent_state.tools if t.tool_type in {ToolType.CUSTOM, ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE}]
        valid_tool_names = tool_rules_solver.get_allowed_tool_names(available_tools=set([t.name for t in tools]))
        return [enable_strict_mode(t.json_schema) for t in tools if t.name in set(valid_tool_names)]

    def get_in_context_messages_per_agent(self, agent_state: AgentState, input_messages: List[MessageCreate]) -> List[Message]:
        current_in_context_messages, new_in_context_messages = _prepare_in_context_messages(
            input_messages, agent_state, self.message_manager, self.actor
        )

        in_context_messages = self._rebuild_memory(current_in_context_messages + new_in_context_messages, agent_state)
        return in_context_messages

    # TODO: Make this a bullk function
    def _rebuild_memory(self, in_context_messages: List[Message], agent_state: AgentState) -> List[Message]:
        agent_state = self.agent_manager.refresh_memory(agent_state=agent_state, actor=self.actor)

        # TODO: This is a pretty brittle pattern established all over our code, need to get rid of this
        curr_system_message = in_context_messages[0]
        curr_memory_str = agent_state.memory.compile()
        curr_system_message_text = curr_system_message.content[0].text
        if curr_memory_str in curr_system_message_text:
            # NOTE: could this cause issues if a block is removed? (substring match would still work)
            logger.debug(
                f"Memory hasn't changed for agent id={agent_state.id} and actor=({self.actor.id}, {self.actor.name}), skipping system prompt rebuild"
            )
            return in_context_messages

        memory_edit_timestamp = get_utc_time()

        num_messages = self.message_manager.size(actor=self.actor, agent_id=agent_state.id)
        num_archival_memories = self.passage_manager.size(actor=self.actor, agent_id=agent_state.id)

        new_system_message_str = compile_system_message(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            previous_message_count=num_messages,
            archival_memory_size=num_archival_memories,
        )

        diff = united_diff(curr_system_message_text, new_system_message_str)
        if len(diff) > 0:
            logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            new_system_message = self.message_manager.update_message_by_id(
                curr_system_message.id, message_update=MessageUpdate(content=new_system_message_str), actor=self.actor
            )

            # Skip pulling down the agent's memory again to save on a db call
            return [new_system_message] + in_context_messages[1:]

        else:
            return in_context_messages
