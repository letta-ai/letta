import uuid

from colorama import init
from temporalio import workflow

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
from letta.agents.helpers import _load_last_function_response, generate_step_id
from letta.agents.temporal.constants import (
    CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    PERSIST_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    PERSIST_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    TOOL_EXECUTION_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    TOOL_EXECUTION_ACTIVITY_START_TO_CLOSE_TIMEOUT,
)
from letta.helpers import ToolRulesSolver
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.llm_api.llm_client import LLMClient
from letta.schemas.agent import AgentState
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema

# Import activity, passing it through the sandbox without reloading the module
with workflow.unsafe.imports_passed_through():
    from letta.agents.helpers import _build_rule_violation_result, _pop_heartbeat, _safe_load_tool_call_str
    from letta.agents.temporal.activities import (
        create_messages_activity,
        execute_tool_activity,
        llm_request,
        persist_messages_activity,
        prepare_messages,
        refresh_context_and_system_message,
    )
    from letta.agents.temporal.types import (
        CreateMessagesParams,
        ExecuteToolParams,
        ExecuteToolResult,
        FinalResult,
        InnerStepResult,
        LLMCallResult,
        LLMRequestParams,
        PersistMessagesParams,
        PreparedMessages,
        RefreshContextParams,
        WorkflowInputParams,
    )
    from letta.constants import NON_USER_MSG_PREFIX
    from letta.local_llm.constants import INNER_THOUGHTS_KWARG
    from letta.log import get_logger
    from letta.server.rest_api.utils import create_approval_request_message_from_llm_response, load_last_function_response_from_messages
    from letta.system import package_function_response
    from letta.utils import validate_function_response

logger = get_logger(__name__)


@workflow.defn
class TemporalAgentWorkflow:
    @workflow.run
    async def run(self, params: WorkflowInputParams) -> FinalResult:
        # Initialize workflow state
        tool_rules_solver = ToolRulesSolver(tool_rules=params.agent_state.tool_rules)
        # Initialize tracking variables
        usage = LettaUsageStatistics()
        stop_reason = StopReasonType.end_turn
        should_continue = True

        # 1) Prepare messages (context + new input), no persistence
        prepared: PreparedMessages = await workflow.execute_activity(
            prepare_messages,
            params,
            start_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )
        combined_messages = prepared.in_context_messages + prepared.input_messages_to_persist

        # Main agent loop - execute steps until max_steps or stop condition
        for step_index in range(params.max_steps):
            remaining_turns = params.max_steps - step_index - 1

            # Execute single step
            step_result = await self.inner_step(
                agent_state=params.agent_state,
                tool_rules_solver=tool_rules_solver,
                messages=combined_messages,
                input_messages_to_persist=prepared.input_messages_to_persist,
                use_assistant_message=params.use_assistant_message,
                include_return_message_types=params.include_return_message_types,
                actor=params.actor,
                remaining_turns=remaining_turns,
            )

            # Update aggregate usage
            usage.step_count += step_result.usage.step_count
            usage.completion_tokens += step_result.usage.completion_tokens
            usage.prompt_tokens += step_result.usage.prompt_tokens
            usage.total_tokens += step_result.usage.total_tokens

            # Update stop reason from step result
            stop_reason = step_result.stop_reason

            # TODO: update combined_messages with response messages
            # combined_messages.extend(step_result.response_messages)

            # Check if we should continue
            if not step_result.should_continue:
                break

        return FinalResult(stop_reason=stop_reason, usage=usage)

    async def inner_step(
        self,
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        messages: list[Message],
        actor: User,
        input_messages_to_persist: list[Message] | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
        remaining_turns: int = -1,
    ) -> InnerStepResult:
        # Initialize step state
        usage = LettaUsageStatistics()
        stop_reason = StopReasonType.end_turn
        tool_call = None
        reasoning_content = None
        step_id = None

        last_function_response = _load_last_function_response(messages)
        allowed_tools = await self._get_valid_tools(
            agent_state=agent_state, tool_rules_solver=tool_rules_solver, last_function_response=last_function_response
        )

        # TODO: approval pair detection (pure)
        approval_request, approval_response = None, None
        # maybe_approval_request, maybe_approval_response = self._maybe_get_approval_messages(messages)

        if approval_request and approval_response:
            # TODO: extract tool_call and reasoning from approval_request
            tool_call = None  # approval_request.tool_calls[0]
            reasoning_content = None  # approval_request.content
            step_id = None  # approval_request.step_id
            # TODO: get step metrics from step_manager
        else:
            # TODO: check for run cancellation if run_id provided

            # Generate new step ID
            step_id = generate_step_id(workflow.uuid4())

            # TODO: step checkpoint start (logging/telemetry)

            # Refresh context + system prompt, scrub inner thoughts (I/O)
            refreshed_messages = await workflow.execute_activity(
                refresh_context_and_system_message,
                RefreshContextParams(
                    agent_state=agent_state,
                    in_context_messages=messages,
                    tool_rules_solver=tool_rules_solver,
                    actor=actor,
                ),
                start_to_close_timeout=REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                schedule_to_close_timeout=REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
            )

            # Decide force_tool_call if exactly one tool allowed
            force_tool_call = allowed_tools[0]["name"] if len(allowed_tools) == 1 else None

            # Get requires_approval_tools from solver
            requires_approval_tools = (
                tool_rules_solver.get_requires_approval_tools(set([t["name"] for t in allowed_tools])) if allowed_tools else None
            )

            # LLM request with retry loop for summarization on context window overflow
            for llm_request_attempt in range(3):  # TODO: use max_summarizer_retries setting
                try:
                    # TODO: build request data (pure)

                    # TODO: step checkpoint for LLM request start

                    call_result: LLMCallResult = await workflow.execute_activity(
                        llm_request,
                        LLMRequestParams(
                            agent_state=agent_state,
                            messages=refreshed_messages,
                            allowed_tools=allowed_tools,
                            force_tool_call=force_tool_call,
                            requires_approval_tools=requires_approval_tools,
                            actor=actor,
                            step_id=step_id,
                            use_assistant_message=use_assistant_message,
                        ),
                        start_to_close_timeout=LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                        schedule_to_close_timeout=LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                    )

                    # If successful, break out of retry loop
                    break

                except Exception as e:
                    # TODO: check if ContextWindowExceededError and attempt < max_retries
                    # if so, call summarize_conversation_history activity then retry
                    # refreshed_messages = await workflow.execute_activity(
                    #     summarize_conversation_history,
                    #     SummarizeParams(...),
                    #     ...
                    # )
                    raise e

            # TODO: step checkpoint for LLM request finish

            # Update usage stats (pure)
            usage.step_count += 1
            usage.completion_tokens += call_result.usage.completion_tokens
            usage.prompt_tokens += call_result.usage.prompt_tokens
            usage.total_tokens += call_result.usage.total_tokens

            # Validate tool call exists
            if tool_call is None:
                stop_reason = StopReasonType.no_tool_call
                # TODO: proper error handling
                raise ValueError("No tool calls found in response")

            # FIX THIS: stubbing these variables all for now to flag dependencies on above logic - not sure yet which ones are critical to new loop
            last_function_response = load_last_function_response_from_messages(messages)
            is_approval = None
            is_denial = None
            requires_approval = None
            stop_reason = None
            denial_reason = None
            messages_to_persist = []
            initial_messages = []
            reasoning_content = []
            pre_computed_assistant_message_id = None
            valid_tool_names = []
            timezone = agent_state.timezone
            step_index = None
            max_steps = None

            # Unpack params
            agent_state = agent_state
            actor = actor
            tool_call = call_result.tool_call

            # Parse and validate the tool-call envelope
            tool_call_id = call_result.tool_call.id or f"call_{uuid.uuid4().hex[:8]}"
            tool_call_name = call_result.tool_call.function.name
            tool_args = _safe_load_tool_call_str(call_result.tool_call.function.arguments)
            request_heartbeat = _pop_heartbeat(tool_args)
            tool_args.pop(INNER_THOUGHTS_KWARG, None)

            # Handle denial flow
            if is_denial:
                continue_stepping = True
                stop_reason = None
                tool_call_messages = create_letta_messages_from_llm_response(
                    agent_id=agent_state.id,
                    model=agent_state.llm_config.model,
                    function_name=tool_call.function.name,
                    function_arguments={},
                    tool_execution_result=ToolExecutionResult(status="error"),
                    tool_call_id=tool_call_id,
                    function_call_success=False,
                    function_response=f"Error: request to call tool denied. User reason: {denial_reason}",
                    timezone=agent_state.timezone,
                    actor=actor,
                    continue_stepping=continue_stepping,
                    heartbeat_reason=f"{NON_USER_MSG_PREFIX}Continuing: user denied request to call tool.",
                    reasoning_content=reasoning_content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                    is_approval_response=True,
                )
                # TODO: handle persisting messages
                messages_to_persist = (initial_messages or []) + tool_call_messages
                # persisted_messages = await self.message_manager.create_many_messages_async(
                #     messages_to_persist,
                #     actor=actor,
                #     project_id=agent_state.project_id,
                #     template_id=agent_state.template_id,
                # )
                # return persisted_messages, continue_stepping, stop_reason

            # Handle approval request flow
            if not is_approval and tool_rules_solver.is_requires_approval_tool(tool_call_name):
                approval_message = create_approval_request_message_from_llm_response(
                    agent_id=agent_state.id,
                    model=agent_state.llm_config.model,
                    function_name=tool_call_name,
                    function_arguments=tool_args,
                    tool_call_id=tool_call_id,
                    actor=actor,
                    continue_stepping=request_heartbeat,
                    reasoning_content=reasoning_content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                )
                # TODO: handle persisting messages
                messages_to_persist = (initial_messages or []) + [approval_message]
                continue_stepping = False
                stop_reason = LettaStopReason(stop_reason=StopReasonType.requires_approval.value)
            else:
                # Execute tool if tool rules allow
                tool_rule_violated = tool_call_name not in valid_tool_names and not is_approval
                if tool_rule_violated:
                    tool_result = _build_rule_violation_result(tool_call_name, valid_tool_names, tool_rules_solver)
                else:
                    execution: ExecuteToolResult = await workflow.execute_activity(
                        execute_tool_activity,
                        ExecuteToolParams(
                            tool_name=tool_call_name,
                            tool_args=tool_args,
                            agent_state=agent_state,
                            actor=actor,
                            step_id=step_id,
                        ),
                        start_to_close_timeout=TOOL_EXECUTION_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                        schedule_to_close_timeout=TOOL_EXECUTION_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                    )
                    tool_result = execution.tool_execution_result
                    # TODO: store tool execution time?

                # Prepare the function-response payload
                truncate = tool_call_name not in {"conversation_search", "conversation_search_date", "archival_memory_search"}
                return_char_limit = next(
                    (t.return_char_limit for t in agent_state.tools if t.name == tool_call_name),
                    None,
                )
                function_response_string = validate_function_response(
                    tool_result.func_return,
                    return_char_limit=return_char_limit,
                    truncate=truncate,
                )
                last_function_response = package_function_response(
                    was_success=tool_result.success_flag,
                    response_string=function_response_string,
                    timezone=timezone,
                )

                # Decide whether to continue stepping
                continue_stepping = request_heartbeat
                heartbeat_reason = None

                # TODO: fix this, handle tool rule solver mutation
                if tool_rule_violated:
                    continue_stepping = True
                    heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: tool rule violation."
                else:
                    tool_rules_solver.register_tool_call(tool_call_name)

                    if tool_rules_solver.is_terminal_tool(tool_call_name):
                        if continue_stepping:
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.tool_rule.value)
                        continue_stepping = False
                    elif tool_rules_solver.has_children_tools(tool_call_name):
                        continue_stepping = True
                        heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: child tool rule."
                    elif tool_rules_solver.is_continue_tool(tool_call_name):
                        continue_stepping = True
                        heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: continue tool rule."

                is_final_step = step_index == max_steps - 1  # TODO: fix this

                if is_final_step and continue_stepping:
                    continue_stepping = False
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)
                else:
                    uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in agent_state.tools]))
                    if not continue_stepping and uncalled:
                        continue_stepping = True
                        heartbeat_reason = (
                            f"{NON_USER_MSG_PREFIX}Continuing, user expects these tools: [{', '.join(uncalled)}] to be called still."
                        )
                        stop_reason = None

                # Persist messages to the agent
                created_messages = await workflow.execute_activity(
                    create_messages_activity,
                    CreateMessagesParams(
                        agent_id=agent_state.id,
                        model=agent_state.llm_config.model,
                        tool_name=tool_call_name,
                        tool_args=tool_args,
                        tool_execution_result=tool_result,
                        tool_call_id=tool_call_id,
                        function_response_string=function_response_string,
                        timezone=agent_state.timezone,
                        actor=actor,
                        continue_stepping=continue_stepping,
                        heartbeat_reason=heartbeat_reason,
                        reasoning_content=reasoning_content,
                        pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                        step_id=step_id,
                        is_approval=False,
                        is_denial=False,
                        initial_messages=initial_messages,
                    ),
                    start_to_close_timeout=CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                    schedule_to_close_timeout=CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                )

                # Persist messages to job
                # _ = await workflow.execute_activity(
                #     persist_messages_activity,
                #     PersistMessagesParams(
                #         messages=created_messages.messages,
                #         actor=actor,
                #         project_id=agent_state.project_id,
                #         template_id=agent_state.template_id,
                #         run_id=run_id,
                #     ),
                #     start_to_close_timeout=PERSIST_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                #     schedule_to_close_timeout=PERSIST_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                # )

                should_continue = continue_stepping
                persisted_messages = created_messages.messages

                # TODO: process response messages for streaming/non-streaming
                # - extend response_messages
                # - yield appropriate messages based on include_return_message_types
                # - handle approval persistence if needed

                # TODO: step checkpoint finish

                # TODO: determine should_continue based on stop_reason and remaining_turns
                response_messages = []  # Placeholder - should be populated from handle_ai_response

        return InnerStepResult(stop_reason=stop_reason, usage=usage, should_continue=should_continue, response_messages=response_messages)

    def _get_valid_tools(self, agent_state: AgentState, tool_rules_solver: ToolRulesSolver, last_function_response: str):
        tools = agent_state.tools
        valid_tool_names = tool_rules_solver.get_allowed_tool_names(
            available_tools=set([t.name for t in tools]),
            last_function_response=last_function_response,
            error_on_empty=False,  # Return empty list instead of raising error
        ) or list(set(t.name for t in tools))
        allowed_tools = [enable_strict_mode(t.json_schema) for t in tools if t.name in set(valid_tool_names)]
        terminal_tool_names = {rule.tool_name for rule in tool_rules_solver.terminal_tool_rules}
        allowed_tools = runtime_override_tool_json_schema(
            tool_list=allowed_tools,
            response_format=agent_state.response_format,
            request_heartbeat=True,
            terminal_tools=terminal_tool_names,
        )
        return allowed_tools
