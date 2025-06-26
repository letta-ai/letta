import json
import uuid
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional, Sequence, Tuple, Union

from aiomultiprocess import Pool
from anthropic.types.beta.messages import BetaMessageBatchCanceledResult, BetaMessageBatchErroredResult, BetaMessageBatchSucceededResult

from letta.agents.base_agent import BaseAgent
from letta.agents.helpers import _prepare_in_context_messages_async
from letta.constants import DEFAULT_MAX_STEPS
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.jobs.types import RequestStatusUpdateInfo, StepStatusUpdateInfo
from letta.llm_api.llm_client import LLMClient
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import AgentStepStatus, JobStatus, MessageStreamStatus, ProviderType
from letta.schemas.job import JobUpdate
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_request import LettaBatchRequest
from letta.schemas.letta_response import LettaBatchResponse, LettaResponse
from letta.schemas.llm_batch_job import AgentStepState, LLMBatchItem
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall as OpenAIToolCall
from letta.schemas.sandbox_config import SandboxConfig, SandboxType
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.server.rest_api.utils import create_heartbeat_system_message, create_letta_messages_from_llm_response
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.job_manager import JobManager
from letta.services.llm_batch_manager import LLMBatchManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import tool_settings

logger = get_logger(__name__)


@dataclass
class ToolExecutionParams:
    agent_id: str
    tool_call_name: str
    tool_args: Dict[str, Any]
    agent_state: AgentState
    actor: User
    sbx_config: SandboxConfig
    sbx_env_vars: Dict[str, Any]


@dataclass
class _ResumeContext:
    batch_items: List[LLMBatchItem]
    agent_ids: List[str]
    agent_state_map: Dict[str, AgentState]
    provider_results: Dict[str, Any]
    tool_call_name_map: Dict[str, str]
    tool_call_args_map: Dict[str, Dict[str, Any]]
    should_continue_map: Dict[str, bool]
    request_status_updates: List[RequestStatusUpdateInfo]


async def execute_tool_wrapper(params: ToolExecutionParams) -> tuple[str, ToolExecutionResult]:
    """
    Executes the tool in an out‑of‑process worker and returns:
        (agent_id, (tool_result:str, success_flag:bool))
    """
    from letta.schemas.tool_execution_result import ToolExecutionResult

    # locate the tool on the agent
    target_tool = next((t for t in params.agent_state.tools if t.name == params.tool_call_name), None)
    if not target_tool:
        return params.agent_id, ToolExecutionResult(func_return=f"Tool not found: {params.tool_call_name}", status="error")

    try:
        mgr = ToolExecutionManager(
            agent_state=params.agent_state,
            actor=params.actor,
            sandbox_config=params.sbx_config,
            sandbox_env_vars=params.sbx_env_vars,
        )
        tool_execution_result = await mgr.execute_tool_async(
            function_name=params.tool_call_name,
            function_args=params.tool_args,
            tool=target_tool,
        )
        return params.agent_id, tool_execution_result
    except Exception as e:
        return params.agent_id, ToolExecutionResult(func_return=f"Failed to call tool. Error: {e}", status="error")


# TODO: Limitations ->
# TODO: Only works with anthropic for now
class LettaAgentBatch(BaseAgent):

    def __init__(
        self,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        batch_manager: LLMBatchManager,
        sandbox_config_manager: SandboxConfigManager,
        job_manager: JobManager,
        actor: User,
        max_steps: int = DEFAULT_MAX_STEPS,
    ):
        self.message_manager = message_manager
        self.agent_manager = agent_manager
        self.block_manager = block_manager
        self.passage_manager = passage_manager
        self.batch_manager = batch_manager
        self.sandbox_config_manager = sandbox_config_manager
        self.job_manager = job_manager
        self.actor = actor
        self.max_steps = max_steps

    @trace_method
    async def step_until_request(
        self,
        batch_requests: List[LettaBatchRequest],
        letta_batch_job_id: str,
        agent_step_state_mapping: Optional[Dict[str, AgentStepState]] = None,
    ) -> LettaBatchResponse:
        """Carry out agent steps until the LLM request is sent."""
        log_event(name="validate_inputs")
        if not batch_requests:
            raise ValueError("Empty list of batch_requests passed in!")
        if agent_step_state_mapping is None:
            agent_step_state_mapping = {}

        log_event(name="load_and_prepare_agents")
        # prepares (1) agent states, (2) step states, (3) LLMBatchItems (4) message batch_item_ids (5) messages per agent (6) tools per agent

        agent_messages_mapping: dict[str, list[Message]] = {}
        agent_tools_mapping: dict[str, list[dict]] = {}
        # TODO: This isn't optimal, moving fast - prone to bugs because we pass around this half formed pydantic object
        agent_batch_item_mapping: dict[str, LLMBatchItem] = {}

        # fetch agent states in batch
        agent_mapping = {
            agent_state.id: agent_state
            for agent_state in await self.agent_manager.get_agents_by_ids_async(
                agent_ids=[request.agent_id for request in batch_requests], include_relationships=["tools", "memory"], actor=self.actor
            )
        }

        agent_states = []
        for batch_request in batch_requests:
            agent_id = batch_request.agent_id
            agent_state = agent_mapping[agent_id]
            agent_states.append(agent_state)  # keeping this to maintain ordering, but may not be necessary

            if agent_id not in agent_step_state_mapping:
                agent_step_state_mapping[agent_id] = AgentStepState(
                    step_number=0, tool_rules_solver=ToolRulesSolver(tool_rules=agent_state.tool_rules)
                )

            llm_batch_item = LLMBatchItem(
                llm_batch_id="",  # TODO: This is hacky, it gets filled in later
                agent_id=agent_state.id,
                llm_config=agent_state.llm_config,
                request_status=JobStatus.created,
                step_status=AgentStepStatus.paused,
                step_state=agent_step_state_mapping[agent_id],
            )
            agent_batch_item_mapping[agent_id] = llm_batch_item

            # Fill in the batch_item_id for the message
            for msg in batch_request.messages:
                msg.batch_item_id = llm_batch_item.id

            agent_messages_mapping[agent_id] = await self._prepare_in_context_messages_per_agent_async(
                agent_state=agent_state, input_messages=batch_request.messages
            )

            agent_tools_mapping[agent_id] = self._prepare_tools_per_agent(agent_state, agent_step_state_mapping[agent_id].tool_rules_solver)

        log_event(name="init_llm_client")
        llm_client = LLMClient.create(
            provider_type=agent_states[0].llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        agent_llm_config_mapping = {s.id: s.llm_config for s in agent_states}

        log_event(name="send_llm_batch_request")
        batch_response = await llm_client.send_llm_batch_request_async(
            agent_messages_mapping=agent_messages_mapping,
            agent_tools_mapping=agent_tools_mapping,
            agent_llm_config_mapping=agent_llm_config_mapping,
        )

        log_event(name="persist_llm_batch_job")
        llm_batch_job = await self.batch_manager.create_llm_batch_job_async(
            llm_provider=ProviderType.anthropic,  # TODO: Expand to more providers
            create_batch_response=batch_response,
            actor=self.actor,
            status=JobStatus.running,
            letta_batch_job_id=letta_batch_job_id,
        )

        log_event(name="prepare_batch_items")
        batch_items = []
        for state in agent_states:
            llm_batch_item = agent_batch_item_mapping[state.id]
            # TODO This is hacky
            llm_batch_item.llm_batch_id = llm_batch_job.id
            batch_items.append(llm_batch_item)

        if batch_items:
            log_event(name="bulk_create_batch_items")
            batch_items_persisted = await self.batch_manager.create_llm_batch_items_bulk_async(batch_items, actor=self.actor)

        log_event(name="return_batch_response")
        return LettaBatchResponse(
            letta_batch_id=llm_batch_job.letta_batch_job_id,
            last_llm_batch_id=llm_batch_job.id,
            status=llm_batch_job.status,
            agent_count=len(agent_states),
            last_polled_at=get_utc_time(),
            created_at=llm_batch_job.created_at,
        )

    @trace_method
    async def resume_step_after_request(self, letta_batch_id: str, llm_batch_id: str) -> LettaBatchResponse:
        log_event(name="load_context")
        llm_batch_job = await self.batch_manager.get_llm_batch_job_by_id_async(llm_batch_id=llm_batch_id, actor=self.actor)
        ctx = await self._collect_resume_context(llm_batch_id)

        log_event(name="update_statuses")
        await self._update_request_statuses_async(ctx.request_status_updates)

        log_event(name="exec_tools")
        exec_results = await self._execute_tools(ctx)

        log_event(name="persist_messages")
        msg_map = await self._persist_tool_messages(exec_results, ctx)

        log_event(name="mark_steps_done")
        await self._mark_steps_complete_async(llm_batch_id, ctx.agent_ids)

        log_event(name="prepare_next")
        next_reqs, next_step_state = await self._prepare_next_iteration_async(exec_results, ctx, msg_map)
        if len(next_reqs) == 0:
            await self.job_manager.update_job_by_id_async(
                job_id=letta_batch_id, job_update=JobUpdate(status=JobStatus.completed), actor=self.actor
            )
            return LettaBatchResponse(
                letta_batch_id=llm_batch_job.letta_batch_job_id,
                last_llm_batch_id=llm_batch_job.id,
                status=JobStatus.completed,
                agent_count=len(ctx.agent_ids),
                last_polled_at=get_utc_time(),
                created_at=llm_batch_job.created_at,
            )

        return await self.step_until_request(
            batch_requests=next_reqs,
            letta_batch_job_id=letta_batch_id,
            agent_step_state_mapping=next_step_state,
        )

    @trace_method
    async def _collect_resume_context(self, llm_batch_id: str) -> _ResumeContext:
        """
        Collect context for resuming operations from completed batch items.

        Args:
            llm_batch_id: The ID of the batch to collect context for

        Returns:
            _ResumeContext object containing all necessary data for resumption
        """
        # Fetch only completed batch items
        batch_items = await self.batch_manager.list_llm_batch_items_async(llm_batch_id=llm_batch_id, request_status=JobStatus.completed)

        # Exit early if no items to process
        if not batch_items:
            return _ResumeContext(
                batch_items=[],
                agent_ids=[],
                agent_state_map={},
                provider_results={},
                tool_call_name_map={},
                tool_call_args_map={},
                should_continue_map={},
                request_status_updates=[],
            )

        # Extract agent IDs and organize items by agent ID
        agent_ids = [item.agent_id for item in batch_items]
        batch_item_map = {item.agent_id: item for item in batch_items}

        # Collect provider results
        provider_results = {item.agent_id: item.batch_request_result.result for item in batch_items}

        # Fetch agent states in a single call
        agent_states = await self.agent_manager.get_agents_by_ids_async(
            agent_ids=agent_ids, include_relationships=["tools", "memory"], actor=self.actor
        )
        agent_state_map = {agent.id: agent for agent in agent_states}

        # Process each agent's results
        tool_call_results = self._process_agent_results(
            agent_ids=agent_ids, batch_item_map=batch_item_map, provider_results=provider_results, llm_batch_id=llm_batch_id
        )

        return _ResumeContext(
            batch_items=batch_items,
            agent_ids=agent_ids,
            agent_state_map=agent_state_map,
            provider_results=provider_results,
            tool_call_name_map=tool_call_results.name_map,
            tool_call_args_map=tool_call_results.args_map,
            should_continue_map=tool_call_results.cont_map,
            request_status_updates=tool_call_results.status_updates,
        )

    def _process_agent_results(self, agent_ids, batch_item_map, provider_results, llm_batch_id):
        """
        Process the results for each agent, extracting tool calls and determining continuation status.

        Returns:
            A namedtuple containing name_map, args_map, cont_map, and status_updates
        """
        from collections import namedtuple

        ToolCallResults = namedtuple("ToolCallResults", ["name_map", "args_map", "cont_map", "status_updates"])

        name_map, args_map, cont_map = {}, {}, {}
        request_status_updates = []

        for aid in agent_ids:
            item = batch_item_map[aid]
            result = provider_results[aid]

            # Determine job status based on result type
            status = self._determine_job_status(result)
            request_status_updates.append(RequestStatusUpdateInfo(llm_batch_id=llm_batch_id, agent_id=aid, request_status=status))

            # Process tool calls
            name, args, cont = self._extract_tool_call_from_result(item, result)
            name_map[aid], args_map[aid], cont_map[aid] = name, args, cont

        return ToolCallResults(name_map, args_map, cont_map, request_status_updates)

    def _determine_job_status(self, result):
        """Determine job status based on result type"""
        if isinstance(result, BetaMessageBatchSucceededResult):
            return JobStatus.completed
        elif isinstance(result, BetaMessageBatchErroredResult):
            return JobStatus.failed
        elif isinstance(result, BetaMessageBatchCanceledResult):
            return JobStatus.cancelled
        else:
            return JobStatus.expired

    def _extract_tool_call_from_result(self, item, result):
        """Extract tool call information from a result"""
        llm_client = LLMClient.create(
            provider_type=item.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )

        # If result isn't a successful type, we can't extract a tool call
        if not isinstance(result, BetaMessageBatchSucceededResult):
            return None, None, False

        tool_call = (
            llm_client.convert_response_to_chat_completion(
                response_data=result.message.model_dump(), input_messages=[], llm_config=item.llm_config
            )
            .choices[0]
            .message.tool_calls[0]
        )

        return self._extract_tool_call_and_decide_continue(tool_call, item.step_state)

    async def _update_request_statuses_async(self, updates: List[RequestStatusUpdateInfo]) -> None:
        if updates:
            await self.batch_manager.bulk_update_llm_batch_items_request_status_by_agent_async(updates=updates)

    async def _build_sandbox(self) -> Tuple[SandboxConfig, Dict[str, Any]]:
        sbx_type = SandboxType.E2B if tool_settings.e2b_api_key else SandboxType.LOCAL
        cfg = await self.sandbox_config_manager.get_or_create_default_sandbox_config_async(sandbox_type=sbx_type, actor=self.actor)
        env = await self.sandbox_config_manager.get_sandbox_env_vars_as_dict_async(cfg.id, actor=self.actor, limit=100)
        return cfg, env

    @trace_method
    async def _execute_tools(self, ctx: _ResumeContext) -> Sequence[tuple[str, ToolExecutionResult]]:
        sbx_cfg, sbx_env = await self._build_sandbox()
        rethink_memory_tool_name = "rethink_memory"
        tool_params = []
        # TODO: This is a special case - we need to think about how to generalize this
        # TODO: Rethink memory is a common op that is easily batchable, so we pull this logic out
        rethink_memory_params = []
        for aid in ctx.agent_ids:
            param = ToolExecutionParams(
                agent_id=aid,
                tool_call_name=ctx.tool_call_name_map[aid],
                tool_args=ctx.tool_call_args_map[aid],
                agent_state=ctx.agent_state_map[aid],
                actor=self.actor,
                sbx_config=sbx_cfg,
                sbx_env_vars=sbx_env,
            )

            if ctx.tool_call_name_map[aid] == rethink_memory_tool_name:
                rethink_memory_params.append(param)
            else:
                tool_params.append(param)

        if rethink_memory_params:
            return await self._bulk_rethink_memory_async(rethink_memory_params)

        if tool_params:
            async with Pool() as pool:
                return await pool.map(execute_tool_wrapper, tool_params)

    @trace_method
    async def _bulk_rethink_memory_async(self, params: List[ToolExecutionParams]) -> Sequence[tuple[str, ToolExecutionResult]]:
        updates = {}
        result = []
        for param in params:
            # Sanity check
            # TODO: This is very brittle and done quickly for performance
            # TODO: If the end tool is changed, this will break
            # TODO: Move 'rethink_memory' to a native Letta tool that we control
            if "new_memory" not in param.tool_args or "target_block_label" not in param.tool_args:
                raise ValueError(f"Missing either `new_memory` or `target_block_label` in the tool args: {param.tool_args}")

            # Find the block id/update
            block_id = param.agent_state.memory.get_block(label=param.tool_args.get("target_block_label")).id
            new_value = param.tool_args.get("new_memory")

            # This is sensitive to multiple agents overwriting the same memory block
            updates[block_id] = new_value

            # TODO: This is quite ugly and confusing - this is mostly to align with the returns of other tools
            result.append((param.agent_id, ToolExecutionResult(status="success")))

        await self.block_manager.bulk_update_block_values_async(updates=updates, actor=self.actor)

        return result

    async def _persist_tool_messages(
        self,
        exec_results: Sequence[Tuple[str, "ToolExecutionResult"]],
        ctx: _ResumeContext,
    ) -> Dict[str, List[Message]]:
        # TODO: This is redundant, we should have this ready on the ctx
        # TODO: I am doing it quick and dirty for now
        agent_item_map: Dict[str, LLMBatchItem] = {item.agent_id: item for item in ctx.batch_items}

        msg_map: Dict[str, List[Message]] = {}
        for aid, tool_exec_result in exec_results:
            msgs = self._create_tool_call_messages(
                llm_batch_item_id=agent_item_map[aid].id,
                agent_state=ctx.agent_state_map[aid],
                tool_call_name=ctx.tool_call_name_map[aid],
                tool_call_args=ctx.tool_call_args_map[aid],
                tool_exec_result=tool_exec_result.func_return,
                success_flag=tool_exec_result.success_flag,
                tool_exec_result_obj=tool_exec_result,
                reasoning_content=None,
            )
            msg_map[aid] = msgs
        # flatten & persist
        await self.message_manager.create_many_messages_async([m for msgs in msg_map.values() for m in msgs], actor=self.actor)
        return msg_map

    async def _mark_steps_complete_async(self, llm_batch_id: str, agent_ids: List[str]) -> None:
        updates = [
            StepStatusUpdateInfo(llm_batch_id=llm_batch_id, agent_id=aid, step_status=AgentStepStatus.completed) for aid in agent_ids
        ]
        await self.batch_manager.bulk_update_llm_batch_items_step_status_by_agent_async(updates)

    async def _prepare_next_iteration_async(
        self,
        exec_results: Sequence[Tuple[str, "ToolExecutionResult"]],
        ctx: _ResumeContext,
        msg_map: Dict[str, List[Message]],
    ) -> Tuple[List[LettaBatchRequest], Dict[str, AgentStepState]]:
        # who continues?
        continues = [agent_id for agent_id, cont in ctx.should_continue_map.items() if cont]

        success_flag_map = {aid: result.success_flag for aid, result in exec_results}

        batch_reqs: List[LettaBatchRequest] = []
        for agent_id in continues:
            heartbeat = create_heartbeat_system_message(
                agent_id=agent_id,
                model=ctx.agent_state_map[agent_id].llm_config.model,
                function_call_success=success_flag_map[agent_id],
                timezone=ctx.agent_state_map[agent_id].timezone,
                actor=self.actor,
            )
            batch_reqs.append(
                LettaBatchRequest(
                    agent_id=agent_id,
                    messages=[MessageCreate.model_validate(heartbeat.model_dump(include={"role", "content", "name", "otid"}))],
                )
            )

        # extend in‑context ids when necessary
        for agent_id, new_msgs in msg_map.items():
            ast = ctx.agent_state_map[agent_id]
            if not ast.message_buffer_autoclear:
                await self.agent_manager.set_in_context_messages_async(
                    agent_id=agent_id,
                    message_ids=ast.message_ids + [m.id for m in new_msgs],
                    actor=self.actor,
                )

        # bump step number
        step_map = {
            item.agent_id: item.step_state.model_copy(update={"step_number": item.step_state.step_number + 1}) for item in ctx.batch_items
        }
        return batch_reqs, step_map

    def _create_tool_call_messages(
        self,
        llm_batch_item_id: str,
        agent_state: AgentState,
        tool_call_name: str,
        tool_call_args: Dict[str, Any],
        tool_exec_result: str,
        tool_exec_result_obj: "ToolExecutionResult",
        success_flag: bool,
        reasoning_content: Optional[List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent]]] = None,
    ) -> List[Message]:
        tool_call_id = f"call_{uuid.uuid4().hex[:8]}"

        tool_call_messages = create_letta_messages_from_llm_response(
            agent_id=agent_state.id,
            model=agent_state.llm_config.model,
            function_name=tool_call_name,
            function_arguments=tool_call_args,
            tool_call_id=tool_call_id,
            function_call_success=success_flag,
            function_response=tool_exec_result,
            tool_execution_result=tool_exec_result_obj,
            timezone=agent_state.timezone,
            actor=self.actor,
            continue_stepping=False,
            reasoning_content=reasoning_content,
            pre_computed_assistant_message_id=None,
            llm_batch_item_id=llm_batch_item_id,
        )

        return tool_call_messages

    # TODO: This is doing a lot of dict passing
    # TODO: Make the passing here typed
    def _extract_tool_call_and_decide_continue(
        self, tool_call: OpenAIToolCall, agent_step_state: AgentStepState
    ) -> Tuple[str, Dict[str, Any], bool]:
        """
        Now that streaming is done, handle the final AI response.
        This might yield additional SSE tokens if we do stalling.
        At the end, set self._continue_execution accordingly.
        """
        tool_call_name = tool_call.function.name
        tool_call_args_str = tool_call.function.arguments

        try:
            tool_args = json.loads(tool_call_args_str)
        except json.JSONDecodeError:
            logger.warning(f"Failed to JSON decode tool call argument string: {tool_call_args_str}")
            tool_args = {}

        # Get request heartbeats and coerce to bool
        request_heartbeat = tool_args.pop("request_heartbeat", False)
        # Pre-emptively pop out inner_thoughts
        tool_args.pop(INNER_THOUGHTS_KWARG, "")

        # So this is necessary, because sometimes non-structured outputs makes mistakes
        if isinstance(request_heartbeat, str):
            request_heartbeat = request_heartbeat.lower() == "true"
        else:
            request_heartbeat = bool(request_heartbeat)

        continue_stepping = request_heartbeat
        tool_rules_solver = agent_step_state.tool_rules_solver
        tool_rules_solver.register_tool_call(tool_name=tool_call_name)
        if tool_rules_solver.is_terminal_tool(tool_name=tool_call_name):
            continue_stepping = False
        elif tool_rules_solver.has_children_tools(tool_name=tool_call_name):
            continue_stepping = True
        elif tool_rules_solver.is_continue_tool(tool_name=tool_call_name):
            continue_stepping = True

        step_count = agent_step_state.step_number
        if step_count >= self.max_steps:
            logger.warning("Hit max steps, stopping agent loop prematurely.")
            continue_stepping = False

        return tool_call_name, tool_args, continue_stepping

    @staticmethod
    def _prepare_tools_per_agent(agent_state: AgentState, tool_rules_solver: ToolRulesSolver) -> List[dict]:
        tools = [t for t in agent_state.tools if t.tool_type in {ToolType.CUSTOM, ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE}]
        valid_tool_names = tool_rules_solver.get_allowed_tool_names(available_tools=set([t.name for t in tools]))
        return [enable_strict_mode(t.json_schema) for t in tools if t.name in set(valid_tool_names)]

    async def _prepare_in_context_messages_per_agent_async(
        self, agent_state: AgentState, input_messages: List[MessageCreate]
    ) -> List[Message]:
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_async(
            input_messages, agent_state, self.message_manager, self.actor
        )

        in_context_messages = await self._rebuild_memory_async(current_in_context_messages + new_in_context_messages, agent_state)
        return in_context_messages

    # Not used in batch.
    async def step(
        self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS, run_id: str | None = None
    ) -> LettaResponse:
        raise NotImplementedError

    async def step_stream(
        self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS
    ) -> AsyncGenerator[Union[LettaMessage, LegacyLettaMessage, MessageStreamStatus], None]:
        raise NotImplementedError
