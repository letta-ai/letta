from datetime import timedelta

from temporalio import workflow

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
from letta.agents.helpers import generate_step_id
from letta.agents.temporal.constants import (
    LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
)
from letta.helpers import ToolRulesSolver
from letta.llm_api.llm_client import LLMClient
from letta.schemas.agent import AgentState
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.message import Message
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User

# Import activity, passing it through the sandbox without reloading the module
with workflow.unsafe.imports_passed_through():
    from letta.agents.temporal.activities import (
        example_activity,
        llm_request,
        prepare_messages,
        refresh_context_and_system_message,
        summarize_conversation_history,
    )
    from letta.agents.temporal.types import (
        FinalResult,
        InnerStepResult,
        LLMCallResult,
        LLMRequestParams,
        PreparedMessages,
        RefreshContextParams,
        SummarizeParams,
        WorkflowInputParams,
    )


@workflow.defn
class TemporalAgentWorkflow:
    @workflow.run
    async def run(self, params: WorkflowInputParams) -> FinalResult:
        # Initialize workflow state
        tool_rules_solver = ToolRulesSolver(tool_rules=params.agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=params.agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=params.actor,
        )
        llm_adapter = LettaLLMRequestAdapter(llm_client=llm_client, llm_config=params.agent_state.llm_config)

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
                llm_adapter=llm_adapter,
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
        llm_adapter: LettaLLMAdapter,
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

        # TODO: load last function response from messages (pure)
        last_function_response = None

        # TODO: compute valid tools (pure): ToolRulesSolver + enable_strict_mode + runtime_override_tool_json_schema
        allowed_tools: list[dict] = []

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

            # Extract tool_call and reasoning from LLM result
            tool_call = call_result.tool_call
            reasoning_content = call_result.reasoning_content

        # Validate tool call exists
        if tool_call is None:
            stop_reason = StopReasonType.no_tool_call
            # TODO: proper error handling
            raise ValueError("No tool calls found in response")

        # TODO: handle AI response activity
        # persisted_messages, should_continue, stop_reason = await workflow.execute_activity(
        #     handle_ai_response,
        #     HandleAIResponseParams(
        #         tool_call=tool_call,
        #         valid_tool_names=[t["name"] for t in allowed_tools],
        #         agent_state=agent_state,
        #         tool_rules_solver=tool_rules_solver,
        #         usage=usage,
        #         reasoning_content=reasoning_content,
        #         step_id=step_id,
        #         initial_messages=input_messages_to_persist,
        #         is_final_step=(remaining_turns == 0),
        #         is_approval=approval_response.approve if approval_response else False,
        #         is_denial=(approval_response.approve == False) if approval_response else False,
        #         denial_reason=approval_response.denial_reason if approval_response else None,
        #     ),
        #     ...
        # )

        # TODO: process response messages for streaming/non-streaming
        # - extend response_messages
        # - yield appropriate messages based on include_return_message_types
        # - handle approval persistence if needed

        # TODO: step checkpoint finish

        # TODO: determine should_continue based on stop_reason and remaining_turns
        should_continue = True  # Placeholder - needs proper logic based on handle_ai_response result
        response_messages = []  # Placeholder - should be populated from handle_ai_response

        return InnerStepResult(stop_reason=stop_reason, usage=usage, should_continue=should_continue, response_messages=response_messages)
