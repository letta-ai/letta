from datetime import timedelta

from temporalio import workflow

from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.usage import LettaUsageStatistics

# Import activity, passing it through the sandbox without reloading the module
with workflow.unsafe.imports_passed_through():
    from letta.agents.temporal.activities import example_activity, prepare_messages
    from letta.agents.temporal.types import FinalResult, WorkflowInputParams


@workflow.defn
class TemporalAgentWorkflow:
    @workflow.run
    async def run(self, params: WorkflowInputParams) -> FinalResult:
        messages = await workflow.execute_activity(prepare_messages, params, start_to_close_timeout=timedelta(seconds=5))
        result = FinalResult(
            stop_reason=StopReasonType.end_turn,
            usage=LettaUsageStatistics(),
        )

        for i in range(params.max_steps):
            _ = await workflow.execute_activity(example_activity, messages, start_to_close_timeout=timedelta(seconds=5))
            # self._maybe_get_approval_messages
            # if approval
            # parse tool params from approval message
            # else
            # self._check_run_cancellation
            # self._refresh_messages

            # try:
            # self.llm_client.build_request_data
            # self.llm_client.request_async
            # self.llm_client.convert_response_to_chat_completion
            # except ContextWindowExceededError:
            # self.summarize_conversation_history
            # self.llm_client.build_request_data
            # self.llm_client.request_async
            # self.llm_client.convert_response_to_chat_completion

            # self._update_global_usage_stats
            # parse tool call args
            # self._handle_ai_response <-- this needs to be broken up into individual pieces
            # self.agent_manager.update_message_ids_async
            # convert message to letta message and return
            pass

        # self.summarize_conversation_history
        # put together final result

        return result
