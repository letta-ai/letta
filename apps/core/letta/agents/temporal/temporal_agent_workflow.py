import uuid

from temporalio import workflow
from temporalio.exceptions import ActivityError, ApplicationError

from letta.agents.helpers import _load_last_function_response, _maybe_get_approval_messages, generate_step_id
from letta.agents.temporal.activities.execute_tool import deserialize_func_return, is_serialized_exception
from letta.agents.temporal.constants import (
    CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    CREATE_STEP_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    CREATE_STEP_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_RETRY_POLICY,
    LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    SUMMARIZE_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    SUMMARIZE_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    TOOL_EXECUTION_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    TOOL_EXECUTION_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    UPDATE_RUN_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    UPDATE_RUN_ACTIVITY_START_TO_CLOSE_TIMEOUT,
)
from letta.helpers import ToolRulesSolver
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.schemas.agent import AgentState
from letta.schemas.enums import JobStatus
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import (
    OmittedReasoningContent,
    ReasoningContent,
    RedactedReasoningContent,
    TextContent,
)
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema

# Import activity, passing it through the sandbox without reloading the module
with workflow.unsafe.imports_passed_through():
    from letta.agents.helpers import _build_rule_violation_result, _load_last_function_response, _pop_heartbeat, _safe_load_tool_call_str
    from letta.agents.temporal.activities import (
        create_messages,
        create_step,
        execute_tool,
        llm_request,
        prepare_messages,
        refresh_context_and_system_message,
        summarize_conversation_history,
        update_message_ids,
        update_run,
    )
    from letta.agents.temporal.types import (
        CreateMessagesParams,
        CreateStepParams,
        ExecuteToolParams,
        ExecuteToolResult,
        FinalResult,
        InnerStepResult,
        LLMCallResult,
        LLMRequestParams,
        PreparedMessages,
        RefreshContextParams,
        RefreshContextResult,
        SummarizeParams,
        UpdateMessageIdsParams,
        UpdateMessageIdsResult,
        UpdateRunParams,
        WorkflowInputParams,
    )
    from letta.constants import NON_USER_MSG_PREFIX
    from letta.local_llm.constants import INNER_THOUGHTS_KWARG
    from letta.log import get_logger
    from letta.server.rest_api.utils import create_approval_request_message_from_llm_response
    from letta.settings import summarizer_settings
    from letta.system import package_function_response
    from letta.utils import validate_function_response

logger = get_logger(__name__)


@workflow.defn
class TemporalAgentWorkflow:
    @workflow.run
    async def run(self, params: WorkflowInputParams) -> FinalResult:
        # Initialize workflow state
        agent_state = params.agent_state  # track mutable agent state throughout workflow
        tool_rules_solver = ToolRulesSolver(tool_rules=agent_state.tool_rules)
        # Initialize tracking variables
        usage = LettaUsageStatistics()
        stop_reason = StopReasonType.end_turn
        response_messages = []

        await workflow.execute_activity(
            update_run,
            UpdateRunParams(
                run_id=params.run_id,
                actor=params.actor,
                job_status=JobStatus.pending,
                stop_reason=None,
                persisted_messages=[],
            ),
            start_to_close_timeout=UPDATE_RUN_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=UPDATE_RUN_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )

        # Prepare messages (context + new input), no persistence
        prepared: PreparedMessages = await workflow.execute_activity(
            prepare_messages,
            params,
            start_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )
        combined_messages = prepared.in_context_messages + prepared.input_messages_to_persist
        input_messages = prepared.input_messages_to_persist
        # Main agent loop - execute steps until max_steps or stop condition
        for step_index in range(params.max_steps):
            remaining_turns = params.max_steps - step_index - 1

            # Execute single step
            step_result = await self.inner_step(
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                messages=combined_messages,
                input_messages_to_persist=input_messages,
                use_assistant_message=params.use_assistant_message,
                include_return_message_types=params.include_return_message_types,
                actor=params.actor,
                remaining_turns=remaining_turns,
                run_id=params.run_id,
            )

            # Update agent state from the step result
            agent_state = step_result.agent_state

            # Update aggregate usage
            usage.step_count += step_result.usage.step_count
            usage.completion_tokens += step_result.usage.completion_tokens
            usage.prompt_tokens += step_result.usage.prompt_tokens
            usage.total_tokens += step_result.usage.total_tokens

            # Update stop reason from step result
            if step_result.stop_reason is not None:
                stop_reason = step_result.stop_reason
            response_messages.extend(step_result.response_messages)
            combined_messages.extend(step_result.response_messages)

            # Check if we should continue
            if not step_result.should_continue:
                break

            input_messages = []  # Only need to persist the input messages for the first step

        # convert to letta messages from Message objs
        letta_messages = Message.to_letta_messages_from_list(
            response_messages,
            use_assistant_message=params.use_assistant_message,
            reverse=False,
        )
        return FinalResult(
            stop_reason=stop_reason.value if isinstance(stop_reason, StopReasonType) else str(stop_reason),
            usage=usage,
            messages=letta_messages,
        )

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
        run_id: str | None = None,
    ) -> InnerStepResult:
        # Initialize step state
        usage = LettaUsageStatistics()
        stop_reason = StopReasonType.end_turn
        tool_call = None
        reasoning_content = None
        step_id = None

        # Track step start time using workflow.now() for deterministic time
        step_start_time = workflow.now()

        last_function_response = _load_last_function_response(messages)
        allowed_tools = await self._get_valid_tools(
            agent_state=agent_state, tool_rules_solver=tool_rules_solver, last_function_response=last_function_response
        )

        approval_request, approval_response = _maybe_get_approval_messages(messages)

        # TODO: Need to check approval functionality
        if approval_request and approval_response:
            tool_call = approval_request.tool_calls[0]
            reasoning_content = approval_request.content
            step_id = approval_request.step_id
        else:
            # TODO: check for run cancellation if run_id provided

            # Generate new step ID
            step_id = generate_step_id(workflow.uuid4())

            # TODO: step checkpoint start (logging/telemetry)

            refresh_result: RefreshContextResult = await workflow.execute_activity(
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
            refreshed_messages = refresh_result.messages
            agent_state = refresh_result.agent_state

            force_tool_call = allowed_tools[0]["name"] if len(allowed_tools) == 1 else None
            requires_approval_tools = (
                tool_rules_solver.get_requires_approval_tools(set([t["name"] for t in allowed_tools])) if allowed_tools else None
            )

            # LLM request with Temporal native retries; on context window overflow,
            # perform workflow-level summarization before retrying with updated input.
            call_result: LLMCallResult | None = None
            for summarize_attempt in range(summarizer_settings.max_summarizer_retries + 1):
                try:
                    # TODO: step checkpoint for LLM request start

                    call_result = await workflow.execute_activity(
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
                        retry_policy=LLM_ACTIVITY_RETRY_POLICY,
                    )

                    # Capture LLM timing from the result
                    llm_request_ns = call_result.llm_request_ns

                    # If successful, break out of summarization retry loop
                    break

                except ApplicationError as e:
                    error_type = e.type

                    # If context window exceeded, summarize then retry (up to max)
                    if (
                        error_type
                        and "ContextWindowExceededError" in error_type
                        and summarize_attempt < summarizer_settings.max_summarizer_retries
                    ):
                        refreshed_messages = await workflow.execute_activity(
                            summarize_conversation_history,
                            SummarizeParams(
                                agent_state=agent_state,
                                in_context_messages=refreshed_messages,
                                new_letta_messages=[],
                                actor=actor,
                                force=True,
                            ),
                            start_to_close_timeout=SUMMARIZE_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                            schedule_to_close_timeout=SUMMARIZE_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                        )
                        continue

                    # Map error to stop reasons similar to non‑Temporal implementation
                    if error_type in ("ValueError", "LLMJSONParsingError"):
                        stop_reason = StopReasonType.invalid_llm_response
                    else:
                        stop_reason = StopReasonType.llm_api_error
                    # Exit summarization loop and finish step with stop_reason
                    break

            # If LLM call ultimately failed, finish step early with mapped stop_reason
            if call_result is None:
                response_messages = []
                should_continue = False
                return InnerStepResult(
                    stop_reason=stop_reason,
                    usage=usage,
                    should_continue=should_continue,
                    response_messages=response_messages,
                    agent_state=agent_state,
                )

            # TODO: step checkpoint for LLM request finish

            # Update usage stats (pure)
            usage.step_count += 1
            usage.completion_tokens += call_result.usage.completion_tokens
            usage.prompt_tokens += call_result.usage.prompt_tokens
            usage.total_tokens += call_result.usage.total_tokens

            # Validate tool call exists
            tool_call = call_result.tool_call
            if tool_call is None:
                stop_reason = StopReasonType.no_tool_call.value
                should_continue = False
                response_messages = []
                return InnerStepResult(
                    stop_reason=stop_reason,
                    usage=usage,
                    should_continue=should_continue,
                    response_messages=response_messages,
                    agent_state=agent_state,
                )

            # Handle the AI response (execute tool, create messages, determine continuation)
            persisted_messages, should_continue, stop_reason, recent_last_function_response = await self._handle_ai_response(
                tool_call=tool_call,
                valid_tool_names=[t["name"] for t in allowed_tools],
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                actor=actor,
                step_id=step_id,
                reasoning_content=call_result.reasoning_content,
                pre_computed_assistant_message_id=call_result.assistant_message_id,
                initial_messages=input_messages_to_persist,
                is_approval=approval_response.approve if approval_response is not None else False,
                is_denial=(approval_response.approve == False) if approval_response is not None else False,
                denial_reason=approval_response.denial_reason if approval_response is not None else None,
                is_final_step=(remaining_turns == 0),
                usage=usage,
                run_id=run_id,
                step_start_time=step_start_time,
                llm_request_ns=llm_request_ns,
            )

            if recent_last_function_response:
                # TODO: This doesn't get used, so we can skip parsing this in the above function
                last_function_response = recent_last_function_response

            # persist approval responses immediately to prevent agent from getting into a bad state
            if (
                len(input_messages_to_persist) == 1
                and input_messages_to_persist[0].role == "approval"
                and persisted_messages[0].role == "approval"
                and persisted_messages[1].role == "tool"
            ):
                # update message ids immediately for approval persistence
                message_ids = agent_state.message_ids + [m.id for m in persisted_messages[:2]]

                # call activity to persist the updated message ids
                update_result: UpdateMessageIdsResult = await workflow.execute_activity(
                    update_message_ids,
                    UpdateMessageIdsParams(
                        agent_id=agent_state.id,
                        message_ids=message_ids,
                        actor=actor,
                    ),
                    start_to_close_timeout=CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                    schedule_to_close_timeout=CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                )

                # update agent state from the activity result
                agent_state = update_result.agent_state

            # TODO: process response messages for streaming/non-streaming
            # - yield appropriate messages based on include_return_message_types

            # TODO: step checkpoint finish

            # Update response messages with the persisted messages
            response_messages = persisted_messages

        return InnerStepResult(
            stop_reason=stop_reason,
            usage=usage,
            should_continue=should_continue,
            response_messages=response_messages,
            agent_state=agent_state,
        )

    async def _handle_ai_response(
        self,
        tool_call: ToolCall,
        valid_tool_names: list[str],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        actor: User,
        step_id: str | None = None,
        reasoning_content: list[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent] | None = None,
        pre_computed_assistant_message_id: str | None = None,
        initial_messages: list[Message] | None = None,
        is_approval: bool = False,
        is_denial: bool = False,
        denial_reason: str | None = None,
        is_final_step: bool = False,
        usage: UsageStatistics | None = None,
        run_id: str | None = None,
        step_start_time: float | None = None,
        llm_request_ns: int | None = None,
    ) -> tuple[list[Message], bool, LettaStopReason | None, str | None]:
        """
        Handle the AI response by executing the tool call, creating messages,
        and determining whether to continue stepping.

        Returns:
            tuple[list[Message], bool, LettaStopReason | None]: (persisted_messages, should_continue, stop_reason)
        """
        # Initialize default
        initial_messages = initial_messages or []

        # Parse and validate the tool-call envelope
        tool_call_id = tool_call.id or f"call_{uuid.uuid4().hex[:8]}"
        tool_call_name = tool_call.function.name
        tool_args = _safe_load_tool_call_str(tool_call.function.arguments)
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
                is_approval_response=True,
            )
            messages_to_persist = initial_messages + tool_call_messages
            return messages_to_persist, continue_stepping, stop_reason, None

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
            )
            messages_to_persist = initial_messages + [approval_message]
            continue_stepping = False
            stop_reason = LettaStopReason(stop_reason=StopReasonType.requires_approval.value)
            return messages_to_persist, continue_stepping, stop_reason, None

        # Execute tool if tool rules allow
        tool_execution_ns = None
        tool_rule_violated = tool_call_name not in valid_tool_names and not is_approval
        if tool_rule_violated:
            tool_result = _build_rule_violation_result(tool_call_name, valid_tool_names, tool_rules_solver)
        else:
            execution: ExecuteToolResult = await workflow.execute_activity(
                execute_tool,
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

            # Capture tool execution timing
            tool_execution_ns = execution.execution_time_ns

            # Deserialize any serialized exceptions for post processing
            if is_serialized_exception(execution.tool_execution_result.func_return):
                execution.tool_execution_result.func_return = deserialize_func_return(execution.tool_execution_result.func_return)
            tool_result = execution.tool_execution_result

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

        # Package the function response (for last_function_response tracking)
        last_function_response = package_function_response(
            was_success=tool_result.success_flag,
            response_string=function_response_string,
            timezone=agent_state.timezone,
        )

        # Decide whether to continue stepping
        continue_stepping = request_heartbeat
        heartbeat_reason = None
        stop_reason = None

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

        # Check if we're at max steps
        if is_final_step and continue_stepping:
            continue_stepping = False
            stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)
        else:
            uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in agent_state.tools]))
            if not continue_stepping and uncalled:
                continue_stepping = True
                heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing, user expects these tools: [{', '.join(uncalled)}] to be called still."
                stop_reason = None

        # Create Letta messages from the tool response
        tool_call_messages = create_letta_messages_from_llm_response(
            agent_id=agent_state.id,
            model=agent_state.llm_config.model,
            function_name=tool_call_name,
            function_arguments=tool_args,
            tool_execution_result=tool_result,
            tool_call_id=tool_call_id,
            function_call_success=tool_result.success_flag,
            function_response=function_response_string,
            timezone=agent_state.timezone,
            actor=actor,
            continue_stepping=continue_stepping,
            heartbeat_reason=heartbeat_reason,
            reasoning_content=reasoning_content,
            pre_computed_assistant_message_id=pre_computed_assistant_message_id,
            is_approval_response=is_approval or is_denial,
        )

        # Log step
        step_ns = int((workflow.now() - step_start_time).total_seconds() * 1e9)
        await workflow.execute_activity(
            create_step,
            CreateStepParams(
                agent_state=agent_state,
                messages=tool_call_messages,
                actor=actor,
                run_id=run_id,
                step_id=step_id,
                usage=usage,
                step_ns=step_ns,
                llm_request_ns=llm_request_ns,
                tool_execution_ns=tool_execution_ns,
                stop_reason=stop_reason.stop_reason.value if stop_reason else None,
            ),
            start_to_close_timeout=CREATE_STEP_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=CREATE_STEP_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )

        messages_to_persist = initial_messages + tool_call_messages

        # Persist messages to database
        persisted_messages_result = await workflow.execute_activity(
            create_messages,
            CreateMessagesParams(
                messages=messages_to_persist,
                actor=actor,
                project_id=agent_state.project_id,
                template_id=agent_state.template_id,
            ),
            start_to_close_timeout=CREATE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=CREATE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )

        await workflow.execute_activity(
            update_run,
            UpdateRunParams(
                run_id=run_id,
                actor=actor,
                job_status=(
                    JobStatus.running if continue_stepping else (stop_reason.stop_reason.run_status if stop_reason else JobStatus.completed)
                ),
                stop_reason=(
                    None if continue_stepping else (stop_reason if stop_reason else LettaStopReason(stop_reason=StopReasonType.end_turn))
                ),
                persisted_messages=persisted_messages_result.messages,
            ),
            start_to_close_timeout=UPDATE_RUN_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=UPDATE_RUN_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )
        return persisted_messages_result.messages, continue_stepping, stop_reason, last_function_response

    async def _get_valid_tools(self, agent_state: AgentState, tool_rules_solver: ToolRulesSolver, last_function_response: str):
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
