from datetime import timedelta

from temporalio import workflow

from letta.agents.helpers import generate_step_id
from letta.agents.temporal.constants import (
    LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
    REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
)
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.usage import LettaUsageStatistics

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
        # 1) Prepare messages (context + new input), no persistence
        prepared: PreparedMessages = await workflow.execute_activity(
            prepare_messages,
            params,
            start_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=PREPARE_MESSAGES_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )
        combined_messages = prepared.in_context_messages + prepared.input_messages_to_persist

        # 2) Approval pair detection (pure) — TODO: implement if needed in this workflow
        # maybe_approval_request, maybe_approval_response = (<detect on combined_messages tail>)

        # 3) Refresh context + system prompt, scrub inner thoughts (I/O)
        refreshed_messages = await workflow.execute_activity(
            refresh_context_and_system_message,
            RefreshContextParams(
                agent_state=params.agent_state,
                in_context_messages=combined_messages,
                actor=params.actor,
            ),
            start_to_close_timeout=REFRESH_CONTEXT_ACTIVITY_START_TO_CLOSE_TIMEOUT,
            schedule_to_close_timeout=REFRESH_CONTEXT_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
        )

        # Accumulate usage over steps
        usage = LettaUsageStatistics()
        stop_reason = StopReasonType.end_turn

        # TODO: valid tools computation (pure): ToolRulesSolver + enable_strict_mode + runtime_override_tool_json_schema
        allowed_tools: list[dict] = []
        requires_approval_tools: list[str] | None = None

        for step_index in range(params.max_steps):
            step_id = generate_step_id(workflow.uuid4())

            # TODO: decide force_tool_call if exactly one tool allowed
            force_tool_call: str | None = None

            # 4) LLM request (I/O), with future summarize-then-retry on overflow
            try:
                call_result: LLMCallResult = await workflow.execute_activity(
                    llm_request,
                    LLMRequestParams(
                        agent_state=params.agent_state,
                        messages=refreshed_messages,
                        allowed_tools=allowed_tools,
                        force_tool_call=force_tool_call,
                        requires_approval_tools=requires_approval_tools,
                        actor=params.actor,
                        step_id=step_id,
                    ),
                    start_to_close_timeout=LLM_ACTIVITY_START_TO_CLOSE_TIMEOUT,
                    schedule_to_close_timeout=LLM_ACTIVITY_SCHEDULE_TO_CLOSE_TIMEOUT,
                )
            except Exception as e:
                # TODO: On ContextWindowExceededError, call summarize_conversation_history then retry bounded times
                raise e

            # Update usage totals (pure)
            usage.step_count += 1
            usage.completion_tokens += call_result.usage.completion_tokens
            usage.prompt_tokens += call_result.usage.prompt_tokens
            usage.total_tokens += call_result.usage.total_tokens

            # TODO: Hand off to _handle_ai_response-equivalent activities
            # For now, break after one LLM call since handling is not yet wired
            break

        return FinalResult(stop_reason=stop_reason, usage=usage)
